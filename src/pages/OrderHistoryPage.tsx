import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, PackageOpen, ServerCrash } from 'lucide-react';
import { ApiError } from '@/api/client';
import * as ordersApi from '@/api/orders';
import type { OrderSummaryResponse } from '@/api/orders';
import { formatCoins } from '@/lib/money';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type FetchResult =
  | { key: number; orders: OrderSummaryResponse[]; error?: undefined }
  | { key: number; orders?: undefined; error: string };

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'outline',
  PAID: 'default',
  SHIPPED: 'secondary',
  DELIVERED: 'secondary',
  CANCELLED: 'destructive',
};

const PAYMENT_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'outline',
  SUCCESS: 'default',
  FAILED: 'destructive',
  REFUNDED: 'secondary',
};

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * One order's row in the history list. Kept as its own component with a
 * dedicated actions slot so the upcoming "Cancel order" feature (UC-12) can
 * add a button here — next to "Pay now" — without restructuring this page.
 */
function OrderRow({
  order,
  onPaid,
}: {
  order: OrderSummaryResponse;
  onPaid: (orderId: number, next: ordersApi.OrderResponse) => void;
}) {
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [insufficientBalance, setInsufficientBalance] = useState(false);
  const [justPaid, setJustPaid] = useState(false);

  const isPending = order.status === 'PENDING';

  async function handlePay() {
    if (order.orderId === undefined) return;
    setPayError(null);
    setInsufficientBalance(false);
    setIsPaying(true);
    try {
      const paid = await ordersApi.makePayment(order.orderId);
      setJustPaid(true);
      onPaid(order.orderId, paid);
    } catch (err) {
      if (err instanceof ApiError) {
        setPayError(err.message);
        setInsufficientBalance(err.status === 400 && err.message.startsWith('Insufficient coin balance'));
      } else {
        setPayError('Something went wrong while processing payment. Please try again.');
      }
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-b border-border py-5 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-heading text-base font-semibold text-foreground">
            Order #{order.orderId}
          </p>
          <p className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</p>
        </div>

        <div className="flex items-center gap-2">
          {order.status && (
            <Badge variant={STATUS_BADGE_VARIANT[order.status] ?? 'outline'}>{order.status}</Badge>
          )}
          {order.paymentStatus && (
            <Badge variant={PAYMENT_BADGE_VARIANT[order.paymentStatus] ?? 'outline'}>
              Payment: {order.paymentStatus}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
        </span>
        <span className="font-heading text-base font-semibold text-foreground">
          {order.totalAmount !== undefined && formatCoins(order.totalAmount)}
        </span>
      </div>

      {justPaid && (
        <div className="flex items-center gap-2 text-sm text-primary">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Payment successful.
        </div>
      )}

      {payError && (
        <div className="flex flex-col gap-2 rounded-sm border border-destructive/30 bg-destructive/10 p-3">
          <p role="alert" className="text-sm text-destructive">
            {payError}
          </p>
          {insufficientBalance && (
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link to="/wallet">Top up wallet</Link>
            </Button>
          )}
        </div>
      )}

      {isPending && !justPaid && (
        // Actions slot: room for an additional "Cancel order" button next to
        // "Pay now" for UC-12 — do not restructure this row for it.
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={isPaying}
            onClick={handlePay}
            className="bg-cta text-cta-foreground hover:bg-cta/90"
          >
            {isPaying ? <Loader2 className="animate-spin" /> : null}
            {isPaying ? 'Processing…' : 'Pay now'}
          </Button>
        </div>
      )}
    </div>
  );
}

function sortByCreatedAtDesc(orders: OrderSummaryResponse[]): OrderSummaryResponse[] {
  return [...orders].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
}

export default function OrderHistoryPage() {
  const [result, setResult] = useState<FetchResult | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const requestKey = retryCount;

  useEffect(() => {
    let cancelled = false;

    ordersApi.getOrderHistory().then(
      (orders) => {
        if (!cancelled) setResult({ key: requestKey, orders: sortByCreatedAtDesc(orders) });
      },
      (err) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : 'Failed to load your orders.';
        setResult({ key: requestKey, error: message });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const isLoading = result?.key !== requestKey;

  function handlePaid(orderId: number, updated: ordersApi.OrderResponse) {
    setResult((prev) => {
      if (!prev || prev.orders === undefined) return prev;
      return {
        key: prev.key,
        orders: prev.orders.map((order) =>
          order.orderId === orderId
            ? {
                ...order,
                status: updated.orderStatus ?? order.status,
                paymentStatus: updated.paymentStatus ?? order.paymentStatus,
              }
            : order,
        ),
      };
    });
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3 border-b border-border py-5">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-9 w-28" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (result?.error !== undefined) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ServerCrash className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{result.error}</p>
        <Button variant="outline" onClick={() => setRetryCount((c) => c + 1)}>
          Retry
        </Button>
      </div>
    );
  }

  const orders = result?.orders ?? [];

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <PackageOpen className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">You have no orders yet.</p>
        <Button asChild variant="outline">
          <Link to="/">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">My Orders</h1>
        <p className="text-sm text-muted-foreground">View your past orders and their status.</p>
      </div>

      <div className="flex flex-col rounded-sm border border-border bg-card px-5">
        {orders.map((order) => (
          <OrderRow key={order.orderId} order={order} onPaid={handlePaid} />
        ))}
      </div>
    </div>
  );
}
