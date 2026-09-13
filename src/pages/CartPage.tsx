import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Loader2, Minus, Plus, ServerCrash, ShoppingBag, Trash2 } from 'lucide-react';
import { getAssetUrl, ApiError } from '@/api/client';
import * as cartApi from '@/api/cart';
import type { CartItemResponse, CartResponse } from '@/api/cart';
import { useAuth } from '@/auth/useAuth';
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

type FetchResult =
  | { key: number; cart: CartResponse; error?: undefined }
  | { key: number; cart?: undefined; error: string };

function CartLineItem({
  item,
  onChange,
}: {
  item: CartItemResponse;
  onChange: (cart: CartResponse) => void;
}) {
  const productId = item.productId;
  const outOfStock = item.stockStatus === 'OUT_OF_STOCK';
  const [pending, setPending] = useState(false);
  const [lineError, setLineError] = useState<string | null>(null);

  if (productId === undefined) return null;
  const id: number = productId;

  async function applyQuantity(next: number) {
    setLineError(null);
    setPending(true);
    try {
      const cart = next <= 0
        ? await cartApi.removeCartItem(id)
        : await cartApi.updateCartItem(id, next);
      onChange(cart);
    } catch (err) {
      setLineError(err instanceof ApiError ? err.message : 'Failed to update quantity.');
    } finally {
      setPending(false);
    }
  }

  async function handleRemove() {
    setLineError(null);
    setPending(true);
    try {
      const cart = await cartApi.removeCartItem(id);
      onChange(cart);
    } catch (err) {
      setLineError(err instanceof ApiError ? err.message : 'Failed to remove item.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex gap-4 border-b border-border py-5 last:border-b-0">
      <Link
        to={`/products/${productId}`}
        className="relative size-24 shrink-0 overflow-hidden rounded-sm border border-border bg-card"
      >
        {item.imageUrl && (
          <img
            src={getAssetUrl(item.imageUrl)}
            alt={item.productName ?? ''}
            className="size-full object-cover"
          />
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Link
              to={`/products/${productId}`}
              className="font-heading text-base text-foreground hover:text-cta"
            >
              {item.productName}
            </Link>
            <p className="text-sm text-muted-foreground">
              {item.price !== undefined && formatCoins(item.price)} each
            </p>
            {outOfStock && <Badge variant="destructive" className="w-fit">Out of stock</Badge>}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove item"
            disabled={pending}
            onClick={handleRemove}
          >
            <Trash2 />
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center rounded-lg border border-border">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Decrease quantity"
              disabled={outOfStock || pending}
              onClick={() => applyQuantity((item.quantity ?? 1) - 1)}
            >
              <Minus />
            </Button>
            <Input
              key={item.quantity}
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={item.quantity ?? 1}
              disabled={outOfStock || pending}
              onBlur={(e) => {
                const next = Number(e.target.value);
                if (Number.isFinite(next) && Math.trunc(next) !== item.quantity) {
                  applyQuantity(Math.max(0, Math.trunc(next)));
                }
              }}
              className="h-9 w-16 border-0 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label="Quantity"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Increase quantity"
              disabled={outOfStock || pending}
              onClick={() => applyQuantity((item.quantity ?? 1) + 1)}
            >
              <Plus />
            </Button>
          </div>

          <p className="font-heading text-base font-semibold text-foreground">
            {item.subTotal !== undefined && formatCoins(item.subTotal)}
          </p>
        </div>

        {lineError && (
          <p className="text-sm text-destructive" role="alert">
            {lineError}
          </p>
        )}
      </div>
    </div>
  );
}

function CartContents() {
  const [result, setResult] = useState<FetchResult | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    cartApi.getCart().then(
      (cart) => {
        if (!cancelled) setResult({ key: retryCount, cart });
      },
      (err) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? err.status === 403
              ? "Admin and staff accounts can't shop."
              : err.status === 401
                ? 'Please log in again to view your cart.'
                : err.message
            : 'Failed to load your cart.';
        setResult({ key: retryCount, error: message });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  const isLoading = result?.key !== retryCount;
  const error = isLoading ? null : (result?.error ?? null);
  const cart = isLoading ? null : (result?.cart ?? null);

  async function handleClear() {
    setClearError(null);
    setClearing(true);
    try {
      const cleared = await cartApi.clearCart();
      setResult({ key: retryCount, cart: cleared });
    } catch (err) {
      setClearError(err instanceof ApiError ? err.message : 'Failed to clear cart.');
    } finally {
      setClearing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex gap-4 border-b border-border py-5">
            <Skeleton className="size-24 shrink-0 rounded-sm" />
            <div className="flex flex-1 flex-col gap-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ServerCrash className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => setRetryCount((c) => c + 1)}>
          Retry
        </Button>
      </div>
    );
  }

  const items = cart?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ShoppingBag className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        <Button asChild variant="outline">
          <Link to="/">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col">
        {items.map((item) => (
          <CartLineItem
            key={item.productId}
            item={item}
            onChange={(next) => setResult({ key: retryCount, cart: next })}
          />
        ))}
      </div>

      <div className="flex h-fit flex-col gap-4 rounded-sm border border-border bg-card p-5">
        <h2 className="font-heading text-lg text-foreground">Order summary</h2>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Items</span>
          <span>{cart?.itemCount ?? 0}</span>
        </div>

        <div className="flex items-center justify-between font-heading text-lg font-semibold text-foreground">
          <span>Total</span>
          <span>{cart?.total !== undefined && formatCoins(cart.total)}</span>
        </div>

        <Button asChild className="w-full bg-cta text-cta-foreground hover:bg-cta/90">
          <Link to="/checkout">Proceed to checkout</Link>
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" className="w-full" disabled={clearing}>
              {clearing ? <Loader2 className="animate-spin" /> : null}
              Clear cart
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear your cart?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes every item from your cart. This action can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleClear}>Clear cart</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {clearError && (
          <p className="text-sm text-destructive" role="alert">
            {clearError}
          </p>
        )}
      </div>
    </div>
  );
}

export default function CartPage() {
  const { isAuthenticated, roles } = useAuth();
  const location = useLocation();
  const redirectMessage = (location.state as { message?: string } | null)?.message;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Your cart</h1>

      {redirectMessage && (
        <p role="status" className="text-sm text-muted-foreground">
          {redirectMessage}
        </p>
      )}

      {!isAuthenticated && (
        <Button asChild className="w-fit">
          <Link to="/login" state={{ from: location }}>
            Log in to view your cart
          </Link>
        </Button>
      )}

      {isAuthenticated && !roles.includes('CUSTOMER') && (
        <p className="text-sm text-muted-foreground">Admin and staff accounts can't shop.</p>
      )}

      {isAuthenticated && roles.includes('CUSTOMER') && <CartContents />}
    </div>
  );
}
