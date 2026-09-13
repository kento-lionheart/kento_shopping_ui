import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Loader2, PackageSearch, ServerCrash, ShieldAlert } from 'lucide-react';
import { ApiError } from '@/api/client';
import * as ordersApi from '@/api/admin/orders';
import type { AdminOrderSummaryResponse, OrderResponse, OrderStatus } from '@/api/admin/orders';
import { useAuth } from '@/auth/useAuth';
import { RequirePermission } from '@/auth/RequirePermission';
import { formatCoins } from '@/lib/money';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

const PAGE_SIZE = 10;
const ALL_STATUSES = 'all';
const ORDER_STATUSES: OrderStatus[] = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

/**
 * Statuses selectable as an update target for a given current status.
 *
 * The real backend (OrderServiceImpl.updateOrderStatus) does not enforce a
 * strict forward-only state machine — it only rejects two things: CANCELLED
 * as a target (cancelling has its own, separate, non-existent-in-the-UI-yet
 * path so refunds/restocking aren't silently skipped) and any update at all
 * once the order is already DELIVERED or CANCELLED (terminal). So the only
 * "invalid transitions" the backend actually refuses are captured here —
 * this intentionally does not invent a stricter workflow the API doesn't have.
 */
function selectableTargetStatuses(current: OrderStatus | undefined): OrderStatus[] {
  if (current === 'DELIVERED' || current === 'CANCELLED') return [];
  return ORDER_STATUSES.filter((s) => s !== 'CANCELLED' && s !== current);
}

function statusBadgeVariant(status: string | undefined): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'DELIVERED':
      return 'default';
    case 'CANCELLED':
      return 'destructive';
    case 'PAID':
    case 'SHIPPED':
      return 'secondary';
    default:
      return 'outline';
  }
}

function paymentBadgeVariant(status: string | undefined): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'SUCCESS':
      return 'default';
    case 'FAILED':
      return 'destructive';
    case 'REFUNDED':
      return 'secondary';
    default:
      return 'outline';
  }
}

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

interface UpdateStatusSheetProps {
  order: AdminOrderSummaryResponse;
  onClose: () => void;
  onUpdated: (updated: OrderResponse) => void;
}

function UpdateStatusSheet({ order, onClose, onUpdated }: UpdateStatusSheetProps) {
  const targets = selectableTargetStatuses(order.status);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrderResponse | null>(null);

  async function handleSubmit() {
    if (!status || order.orderId === undefined) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await ordersApi.updateOrderStatus(order.orderId, status);
      setResult(updated);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update order status.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Update order #{order.orderId}</SheetTitle>
          <SheetDescription>{order.userEmail}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          {!result && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>Current status</Label>
                <Badge variant={statusBadgeVariant(order.status)} className="w-fit">
                  {order.status}
                </Badge>
              </div>

              {targets.length === 0 ? (
                <div className="flex items-start gap-2 rounded-sm border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    This order is {order.status?.toLowerCase()} and cannot be updated any further.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-status">New status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
                    <SelectTrigger id="new-status">
                      <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                    <SelectContent>
                      {targets.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Cancelling a paid order isn&apos;t available through status update — it
                    requires restocking and a refund that this action doesn&apos;t perform.
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}

          {result && (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-2 rounded-sm border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                <span>
                  Order updated to{' '}
                  <Badge variant={statusBadgeVariant(result.orderStatus)}>{result.orderStatus}</Badge>
                  . This detail is only available right after an update — there is no separate
                  endpoint to fetch it later.
                </span>
              </div>

              <div className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{result.subTotal !== undefined && formatCoins(result.subTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping fee</span>
                  <span>{result.shippingFee !== undefined && formatCoins(result.shippingFee)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>{result.totalAmount !== undefined && formatCoins(result.totalAmount)}</span>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-1 text-sm">
                <p className="font-medium">Shipping address</p>
                <p className="text-muted-foreground">
                  {result.shipRecipientName} · {result.shipPhone}
                </p>
                <p className="text-muted-foreground">
                  {[result.shipStreet, result.shipWard, result.shipDistrict, result.shipCity, result.shipPostalCode]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Items</p>
                {(result.items ?? []).map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.productName} × {item.quantity}
                    </span>
                    <span>{item.subTotal !== undefined && formatCoins(item.subTotal)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <SheetFooter>
          {result ? (
            <Button onClick={onClose}>Close</Button>
          ) : (
            <>
              <Button onClick={handleSubmit} disabled={!status || submitting}>
                {submitting && <Loader2 className="animate-spin" />}
                Update status
              </Button>
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function AdminOrdersPageContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const status = searchParams.get('status') ?? '';
  const page = Number(searchParams.get('page') ?? '0');

  const [emailInput, setEmailInput] = useState(email);
  const [retryCount, setRetryCount] = useState(0);
  const [updatingOrder, setUpdatingOrder] = useState<AdminOrderSummaryResponse | null>(null);

  type FetchResult =
    | { key: string; data: ordersApi.PageAdminOrderSummaryResponse; error?: undefined }
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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (emailInput !== email) {
        updateParams({ email: emailInput, page: null });
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailInput]);

  const requestKey = JSON.stringify({ email, status, page, retryCount });

  useEffect(() => {
    let cancelled = false;

    ordersApi
      .getAllOrders({
        email: email || undefined,
        status: (status || undefined) as OrderStatus | undefined,
        page,
        size: PAGE_SIZE,
      })
      .then(
        (data) => {
          if (!cancelled) setResult({ key: requestKey, data });
        },
        (err) => {
          if (cancelled) return;
          const message = err instanceof ApiError ? err.message : 'Failed to load orders.';
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
  const orders = data?.content ?? [];

  function refetch() {
    setRetryCount((c) => c + 1);
  }

  function handleUpdated() {
    refetch();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Orders</h1>
        <p className="text-sm text-muted-foreground">
          View orders across all customers and update their status.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <Input
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="Search by customer email…"
            className="max-w-xs"
            aria-label="Search orders by customer email"
          />
          <Select
            value={status || ALL_STATUSES}
            onValueChange={(value) =>
              updateParams({ status: value === ALL_STATUSES ? null : value, page: null })
            }
          >
            <SelectTrigger className="w-40" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <ServerCrash className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      )}

      {!error && isLoading && (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      )}

      {!error && !isLoading && orders.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <PackageSearch className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No orders found.</p>
        </div>
      )}

      {!error && !isLoading && orders.length > 0 && (
        <div className="overflow-x-auto rounded-sm border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground uppercase">
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Items</th>
                <th className="px-3 py-2 font-medium">Payment</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.orderId} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium text-foreground">#{order.orderId}</td>
                  <td className="max-w-48 truncate px-3 py-2 text-muted-foreground">{order.userEmail}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {order.totalAmount !== undefined && formatCoins(order.totalAmount)}
                  </td>
                  <td className="px-3 py-2">{order.itemCount ?? 0}</td>
                  <td className="px-3 py-2">
                    <Badge variant={paymentBadgeVariant(order.paymentStatus)}>
                      {order.paymentStatus}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={statusBadgeVariant(order.status)}>{order.status}</Badge>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <RequirePermission permission="ORDER_UPDATE_STATUS">
                      <Button variant="outline" size="sm" onClick={() => setUpdatingOrder(order)}>
                        Update status
                      </Button>
                    </RequirePermission>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!error && !isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 0}
            onClick={() => updateParams({ page: String(page - 1) })}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => updateParams({ page: String(page + 1) })}
          >
            Next
          </Button>
        </div>
      )}

      {updatingOrder && (
        <UpdateStatusSheet
          order={updatingOrder}
          onClose={() => setUpdatingOrder(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  const { hasPermission } = useAuth();

  if (!hasPermission('ORDER_READ_ALL')) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ShieldAlert className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to view this page.
        </p>
      </div>
    );
  }

  return <AdminOrdersPageContent />;
}
