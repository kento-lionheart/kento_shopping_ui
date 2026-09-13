import { useEffect, useState } from 'react';
import { Coins, ServerCrash, X } from 'lucide-react';
import { ApiError } from '@/api/client';
import * as walletApi from '@/api/wallet';
import type { TopUpRequestResponse } from '@/api/wallet';
import { formatCoins } from '@/lib/money';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

const MIN_AMOUNT = 10_000;
const MAX_AMOUNT = 50_000_000;
const MAX_PENDING = 3;

function statusBadgeVariant(status: TopUpRequestResponse['status']) {
  switch (status) {
    case 'APPROVED':
      return 'default' as const;
    case 'REJECTED':
      return 'destructive' as const;
    case 'CANCELLED':
      return 'outline' as const;
    case 'PENDING':
    default:
      return 'secondary' as const;
  }
}

function formatDate(value: string | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

function TopUpForm({ onCreated }: { onCreated: (request: TopUpRequestResponse) => void }) {
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = Number(amount);
  const isValidAmount =
    amount.trim() !== '' &&
    Number.isFinite(parsedAmount) &&
    Number.isInteger(parsedAmount) &&
    parsedAmount >= MIN_AMOUNT &&
    parsedAmount <= MAX_AMOUNT;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidAmount) return;

    setStatus('submitting');
    setError(null);
    try {
      const request = await walletApi.createTopUpRequest(parsedAmount);
      setAmount('');
      setStatus('idle');
      onCreated(request);
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Failed to submit top-up request.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request top-up</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="topup-amount">Amount</Label>
            <Input
              id="topup-amount"
              type="number"
              inputMode="numeric"
              min={MIN_AMOUNT}
              max={MAX_AMOUNT}
              step={1}
              placeholder="e.g. 100000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-describedby="topup-amount-hint"
            />
            <p id="topup-amount-hint" className="text-xs text-muted-foreground">
              Min {formatCoins(MIN_AMOUNT)}, max {formatCoins(MAX_AMOUNT)}.
            </p>
          </div>

          {status === 'error' && error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-fit bg-cta text-cta-foreground hover:bg-cta/90"
            disabled={!isValidAmount || status === 'submitting'}
          >
            {status === 'submitting' ? 'Submitting…' : 'Request top-up'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CancelRequestAction({
  request,
  onCancelled,
}: {
  request: TopUpRequestResponse;
  onCancelled: (request: TopUpRequestResponse) => void;
}) {
  const [status, setStatus] = useState<'idle' | 'cancelling' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (request.id === undefined) return;
    setStatus('cancelling');
    setError(null);
    try {
      const updated = await walletApi.cancelTopUpRequest(request.id);
      onCancelled(updated);
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Failed to cancel request.');
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={status === 'cancelling'}>
            <X />
            Cancel request
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this top-up request?</AlertDialogTitle>
            <AlertDialogDescription>
              This withdraws your request for {formatCoins(request.requestedAmount ?? 0)}. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep request</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirm}>
              Cancel request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {status === 'error' && error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function WalletPage() {
  const [result, setResult] = useState<
    { key: number; requests: TopUpRequestResponse[]; error?: undefined } | { key: number; requests?: undefined; error: string }
  >({ key: -1, requests: [] });
  const [retryCount, setRetryCount] = useState(0);

  const requestKey = retryCount;
  const isLoading = result.key !== requestKey;

  useEffect(() => {
    let cancelled = false;

    walletApi.getTopUpRequests().then(
      (requests) => {
        if (!cancelled) setResult({ key: requestKey, requests });
      },
      (err) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : 'Failed to load top-up requests.';
        setResult({ key: requestKey, error: message });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const requests = result.requests ?? [];
  const error = result.error ?? null;
  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const atPendingCap = pendingCount >= MAX_PENDING;

  function handleCreated(request: TopUpRequestResponse) {
    setResult((prev) => ({ key: prev.key, requests: [request, ...(prev.requests ?? [])] }));
  }

  function handleCancelled(updated: TopUpRequestResponse) {
    setResult((prev) => ({
      key: prev.key,
      requests: (prev.requests ?? []).map((r) => (r.id === updated.id ? updated : r)),
    }));
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-2">
        <Coins className="size-6 text-cta" />
        <h1 className="font-heading text-2xl font-semibold text-foreground">Wallet</h1>
      </div>

      {atPendingCap ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You already have {MAX_PENDING} pending top-up requests. Wait for one to be reviewed
              before requesting another.
            </p>
          </CardContent>
        </Card>
      ) : (
        <TopUpForm onCreated={handleCreated} />
      )}

      <Separator />

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium text-foreground">Your requests</h2>

        {isLoading && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        )}

        {!isLoading && error && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <ServerCrash className="size-10 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => setRetryCount((c) => c + 1)}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !error && requests.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            You have not requested a top-up yet.
          </p>
        )}

        {!isLoading &&
          !error &&
          requests.map((request) => (
            <Card key={request.id}>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-base font-semibold text-foreground">
                      {formatCoins(request.requestedAmount ?? 0)}
                    </span>
                    <Badge variant={statusBadgeVariant(request.status)}>{request.status}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Requested {formatDate(request.createdAt)}
                  </span>
                  {request.status !== 'PENDING' && request.reviewedAt && (
                    <span className="text-xs text-muted-foreground">
                      Reviewed {formatDate(request.reviewedAt)}
                      {request.reviewedByEmail ? ` by ${request.reviewedByEmail}` : ''}
                    </span>
                  )}
                  {request.note && (
                    <span className="text-xs text-muted-foreground">Note: {request.note}</span>
                  )}
                </div>

                {request.status === 'PENDING' && (
                  <CancelRequestAction request={request} onCancelled={handleCancelled} />
                )}
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
