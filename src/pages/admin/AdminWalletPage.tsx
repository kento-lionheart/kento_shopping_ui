import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleAlert, Inbox, ServerCrash, ShieldAlert, Wallet as WalletIcon } from 'lucide-react';
import { ApiError } from '@/api/client';
import * as topupsApi from '@/api/admin/topups';
import type { TopUpRequestResponse, TopUpStatus } from '@/api/admin/topups';
import { useAuth } from '@/auth/useAuth';
import { RequirePermission } from '@/auth/RequirePermission';
import { formatCoins } from '@/lib/money';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const PAGE_SIZE = 20;
const ALL_STATUSES = 'ALL';

function formatDateTime(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function statusVariant(status?: TopUpStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'PENDING':
      return 'secondary';
    case 'APPROVED':
      return 'default';
    case 'REJECTED':
      return 'destructive';
    case 'CANCELLED':
      return 'outline';
    default:
      return 'outline';
  }
}

interface RejectDialogProps {
  request: TopUpRequestResponse;
  onClose: () => void;
  onRejected: (updated: TopUpRequestResponse) => void;
  onConflict: () => void;
}

function RejectDialog({ request, onClose, onRejected, onConflict }: RejectDialogProps) {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedNote = note.trim();

  async function handleSubmit() {
    if (!trimmedNote) {
      setError('A note is required when rejecting.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await topupsApi.rejectTopUp(request.id!, trimmedNote);
      onRejected(updated);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        // e.g. "Request has already been reviewed" (E1) — surface the real
        // message and let the caller refresh the row rather than retry blindly.
        setError(err.message);
        if (err.message.toLowerCase().includes('already been reviewed')) {
          onConflict();
        }
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to reject request.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject top-up request</DialogTitle>
          <DialogDescription>
            {request.requesterEmail} — {formatCoins(request.requestedAmount ?? 0)}. Explain why
            this request is being rejected.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for rejection…"
            rows={3}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="Rejection note"
            autoFocus
          />
          {error && (
            <p className="flex items-start gap-1.5 text-xs text-destructive">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || !trimmedNote}
          >
            {isSubmitting ? 'Rejecting…' : 'Reject request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TopUpQueueSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = (searchParams.get('topupStatus') as TopUpStatus | null) ?? 'PENDING';
  const page = Number(searchParams.get('topupPage') ?? '0');

  const [retryCount, setRetryCount] = useState(0);
  const [rejectingRequest, setRejectingRequest] = useState<TopUpRequestResponse | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<number | null>(null);

  type FetchResult =
    | { key: string; data: topupsApi.PageTopUpRequestResponse; error?: undefined }
    | { key: string; data?: undefined; error: string };
  const [result, setResult] = useState<FetchResult | null>(null);

  function updateParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    setSearchParams(params);
  }

  const requestKey = JSON.stringify({ status, page, retryCount });

  useEffect(() => {
    let cancelled = false;

    topupsApi
      .getTopUpQueue({
        status: status === (ALL_STATUSES as TopUpStatus) ? undefined : status,
        page,
        size: PAGE_SIZE,
      })
      .then(
        (data) => {
          if (!cancelled) setResult({ key: requestKey, data });
        },
        (err) => {
          if (cancelled) return;
          const message = err instanceof ApiError ? err.message : 'Failed to load top-up queue.';
          setResult({ key: requestKey, error: message });
        },
      );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const isLoading = result?.key !== requestKey;
  const error = isLoading ? null : (result?.error ?? null);
  const data = isLoading ? null : (result?.data ?? null);
  const totalPages = data?.totalPages ?? 0;
  const requests = data?.content ?? [];

  function refresh() {
    setRetryCount((c) => c + 1);
  }

  function replaceRow(updated: TopUpRequestResponse) {
    setResult((prev) =>
      prev?.data
        ? {
            ...prev,
            data: {
              ...prev.data,
              content: prev.data.content?.map((r) => (r.id === updated.id ? updated : r)),
            },
          }
        : prev,
    );
  }

  async function handleApprove(request: TopUpRequestResponse) {
    setPendingActionId(request.id ?? null);
    setActionError(null);
    try {
      const updated = await topupsApi.approveTopUp(request.id!);
      replaceRow(updated);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        // E1: already reviewed by someone else — refresh instead of a
        // confusing generic error.
        setActionError(err.message);
        refresh();
      } else {
        setActionError(err instanceof ApiError ? err.message : 'Failed to approve request.');
      }
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Top-up review queue</CardTitle>
            <CardDescription>
              Approving credits the requester&apos;s wallet immediately — this cannot be undone.
            </CardDescription>
          </div>

          <Select
            value={status}
            onValueChange={(value) => updateParams({ topupStatus: value, topupPage: null })}
          >
            <SelectTrigger className="w-40" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value={ALL_STATUSES}>All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {actionError && (
          <div className="flex items-start gap-2 rounded-sm border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {actionError}
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ServerCrash className="size-10 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={refresh}>
              Retry
            </Button>
          </div>
        )}

        {!error && isLoading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}

        {!error && !isLoading && requests.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Inbox className="size-10 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">No requests found.</p>
          </div>
        )}

        {!error && !isLoading && requests.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-sm border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                    <th className="px-4 py-2 font-medium">Requester</th>
                    <th className="px-4 py-2 font-medium">Amount</th>
                    <th className="px-4 py-2 font-medium">Submitted</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Reviewer</th>
                    <th className="px-4 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => {
                    const isPending = request.status === 'PENDING';
                    const isBusy = pendingActionId === request.id;
                    return (
                      <tr key={request.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2">
                          <div className="flex flex-col">
                            <span className="font-medium">{request.requesterName}</span>
                            <span className="text-xs text-muted-foreground">
                              {request.requesterEmail}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          {formatCoins(request.requestedAmount ?? 0)}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {formatDateTime(request.createdAt)}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant={statusVariant(request.status)}>{request.status}</Badge>
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {request.reviewedByEmail ? (
                            <div className="flex flex-col">
                              <span>{request.reviewedByEmail}</span>
                              <span>{formatDateTime(request.reviewedAt)}</span>
                              {request.note && (
                                <span className="italic">&ldquo;{request.note}&rdquo;</span>
                              )}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {isPending && (
                            <RequirePermission permission="TOPUP_APPROVE">
                              <div className="flex justify-end gap-2">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" disabled={isBusy}>
                                      {isBusy ? 'Approving…' : 'Approve'}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Approve top-up request?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This credits {formatCoins(request.requestedAmount ?? 0)} to{' '}
                                        {request.requesterEmail}&apos;s wallet immediately. This
                                        cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleApprove(request)}>
                                        Approve
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isBusy}
                                  onClick={() => setRejectingRequest(request)}
                                >
                                  Reject
                                </Button>
                              </div>
                            </RequirePermission>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 0}
                  onClick={() => updateParams({ topupPage: String(page - 1) })}
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
                  onClick={() => updateParams({ topupPage: String(page + 1) })}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      {rejectingRequest && (
        <RejectDialog
          request={rejectingRequest}
          onClose={() => setRejectingRequest(null)}
          onRejected={(updated) => {
            replaceRow(updated);
            setRejectingRequest(null);
          }}
          onConflict={refresh}
        />
      )}
    </Card>
  );
}

export default function AdminWalletPage() {
  const { hasPermission } = useAuth();

  if (!hasPermission('TOPUP_READ_ALL')) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ShieldAlert className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <WalletIcon className="size-6 text-muted-foreground" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold">Wallet &amp; top-ups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review pending coin top-up requests and manage wallets.
          </p>
        </div>
      </div>

      <TopUpQueueSection />
    </div>
  );
}
