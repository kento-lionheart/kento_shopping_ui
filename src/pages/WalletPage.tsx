import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Coins, ServerCrash, Wallet, X } from 'lucide-react';
import { ApiError } from '@/api/client';
import * as walletApi from '@/api/wallet';
import type { CoinTransactionResponse, TopUpRequestResponse, WalletResponse } from '@/api/wallet';
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

const TX_TYPE_LABELS: Record<string, string> = {
  TOP_UP: 'Top-up',
  PURCHASE: 'Purchase',
  REFUND: 'Refund',
  ADJUSTMENT: 'Adjustment',
};

function txTypeLabel(type: CoinTransactionResponse['type']): string {
  if (!type) return 'Transaction';
  return TX_TYPE_LABELS[type] ?? type;
}

/** Reference type/id link each row to the event that caused it (an order or a top-up
 * request) so the row is self-explanatory, even without a detail page to link to. */
function referenceLabel(transaction: CoinTransactionResponse): string | null {
  const { referenceType, referenceId } = transaction;
  if (!referenceType || referenceId === undefined) return null;
  switch (referenceType) {
    case 'ORDER':
      return `Order #${referenceId}`;
    case 'TOP_UP_REQUEST':
      return `Top-up #${referenceId}`;
    default:
      return `${referenceType} #${referenceId}`;
  }
}

function formatSignedCoins(amount: number): string {
  return `${amount > 0 ? '+' : ''}${formatCoins(amount)}`;
}

function TransactionRow({ transaction }: { transaction: CoinTransactionResponse }) {
  const amount = transaction.amount ?? 0;
  const isCredit = amount >= 0;
  const reference = referenceLabel(transaction);

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
            isCredit ? 'bg-accent text-foreground' : 'bg-muted text-muted-foreground'
          }`}
          aria-hidden="true"
        >
          {isCredit ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{txTypeLabel(transaction.type)}</span>
          <span className="text-xs text-muted-foreground">
            {[reference, formatDate(transaction.createdAt)].filter(Boolean).join(' · ')}
          </span>
          {transaction.note && (
            <span className="text-xs text-muted-foreground">Note: {transaction.note}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span
          className={`text-sm font-semibold ${isCredit ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          {formatSignedCoins(amount)}
        </span>
        {transaction.balanceAfter !== undefined && (
          <span className="text-xs text-muted-foreground">
            Balance {formatCoins(transaction.balanceAfter)}
          </span>
        )}
      </div>
    </div>
  );
}

function BalanceCard({
  wallet,
  isLoading,
  error,
  onRetry,
}: {
  wallet: WalletResponse | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="size-4" />
          Current balance
        </div>

        {isLoading && <Skeleton className="h-10 w-48" />}

        {!isLoading && error && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !error && (
          <>
            <span className="font-heading text-4xl font-semibold text-foreground">
              {formatCoins(wallet?.balance ?? 0)}
            </span>
            <span className="text-xs text-muted-foreground">
              As of now — balance only changes once a top-up is approved or an order completes.
            </span>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const TRANSACTIONS_PAGE_SIZE = 20;

function TransactionLedger() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<
    | { key: number; data: walletApi.PageCoinTransactionResponse; error?: undefined }
    | { key: number; data?: undefined; error: string }
    | null
  >(null);
  const [retryCount, setRetryCount] = useState(0);

  const requestKey = page * 1000 + retryCount;
  const isLoading = result?.key !== requestKey;

  useEffect(() => {
    let cancelled = false;

    walletApi.getTransactions({ page, size: TRANSACTIONS_PAGE_SIZE }).then(
      (data) => {
        if (!cancelled) setResult({ key: requestKey, data });
      },
      (err) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : 'Failed to load transactions.';
        setResult({ key: requestKey, error: message });
      },
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const error = isLoading ? null : (result?.error ?? null);
  const data = isLoading ? null : (result?.data ?? null);
  const transactions = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-medium text-foreground">Recent activity</h2>

      <Card>
        <CardContent>
          {isLoading && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {!isLoading && error && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <ServerCrash className="size-10 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" onClick={() => setRetryCount((c) => c + 1)}>
                Retry
              </Button>
            </div>
          )}

          {!isLoading && !error && transactions.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions yet.
            </p>
          )}

          {!isLoading && !error && transactions.length > 0 && (
            <div className="flex flex-col">
              {transactions.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!isLoading && !error && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
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

function useWalletBalance() {
  const [result, setResult] = useState<
    | { key: number; wallet: WalletResponse; error?: undefined }
    | { key: number; wallet?: undefined; error: string }
  >({ key: -1, wallet: { balance: 0, recentTransactions: [] } });
  const [retryCount, setRetryCount] = useState(0);

  const isLoading = result.key !== retryCount;

  useEffect(() => {
    let cancelled = false;

    walletApi.getWallet().then(
      (wallet) => {
        if (!cancelled) setResult({ key: retryCount, wallet });
      },
      (err) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : 'Failed to load wallet balance.';
        setResult({ key: retryCount, error: message });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  return {
    wallet: result.wallet ?? null,
    error: isLoading ? null : (result.error ?? null),
    isLoading,
    retry: () => setRetryCount((c) => c + 1),
  };
}

export default function WalletPage() {
  const balance = useWalletBalance();

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

      <BalanceCard
        wallet={balance.wallet}
        isLoading={balance.isLoading}
        error={balance.error}
        onRetry={balance.retry}
      />

      <TransactionLedger />

      <Separator />

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
