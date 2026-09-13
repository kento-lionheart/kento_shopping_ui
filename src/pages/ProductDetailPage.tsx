import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronLeft, Minus, Plus, ServerCrash } from 'lucide-react';
import { getAssetUrl, ApiError } from '@/api/client';
import * as productsApi from '@/api/products';
import * as cartApi from '@/api/cart';
import type { ProductResponse } from '@/api/products';
import { useAuth } from '@/auth/useAuth';
import { formatCoins } from '@/lib/money';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

type FetchResult =
  | { key: string; product: ProductResponse; error?: undefined }
  | { key: string; product?: undefined; error: string; notFound: boolean };

function AddToCartControls({ product }: { product: ProductResponse }) {
  const { isAuthenticated, roles } = useAuth();
  const location = useLocation();
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<'idle' | 'adding' | 'added' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const outOfStock = product.stockStatus === 'OUT_OF_STOCK';
  const maxQuantity = product.quantity ?? 1;

  if (!isAuthenticated) {
    return (
      <Button asChild className="w-full sm:w-auto">
        <Link to="/login" state={{ from: location }}>
          Log in to add to cart
        </Link>
      </Button>
    );
  }

  if (!roles.includes('CUSTOMER')) {
    return <p className="text-sm text-muted-foreground">Admin and staff accounts can't shop.</p>;
  }

  async function handleAddToCart() {
    if (product.id === undefined) return;
    setStatus('adding');
    setError(null);
    try {
      await cartApi.addCartItem({ productId: product.id, quantity });
      setStatus('added');
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Failed to add to cart.');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg border border-border">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Decrease quantity"
            disabled={outOfStock || quantity <= 1}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            <Minus />
          </Button>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={maxQuantity}
            value={quantity}
            disabled={outOfStock}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isFinite(next)) {
                setQuantity(Math.min(Math.max(1, Math.trunc(next)), maxQuantity));
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
            disabled={outOfStock || quantity >= maxQuantity}
            onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
          >
            <Plus />
          </Button>
        </div>

        <Button
          className="flex-1 sm:flex-none"
          disabled={outOfStock || status === 'adding'}
          onClick={handleAddToCart}
        >
          {outOfStock ? 'Out of stock' : status === 'adding' ? 'Adding…' : 'Add to cart'}
        </Button>
      </div>

      {status === 'added' && (
        <p className="text-sm text-primary" role="status">
          Added to cart.
        </p>
      )}
      {status === 'error' && error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const productId = Number(id);
  const isValidId = Number.isFinite(productId);
  const [result, setResult] = useState<FetchResult | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const requestKey = `${productId}:${retryCount}`;

  useEffect(() => {
    if (!isValidId) return;

    let cancelled = false;

    productsApi.getProductById(productId).then(
      (product) => {
        if (!cancelled) setResult({ key: requestKey, product });
      },
      (err) => {
        if (cancelled) return;
        const notFound = err instanceof ApiError && err.status === 404;
        const message =
          err instanceof ApiError ? err.message : 'Failed to load this product.';
        setResult({ key: requestKey, error: message, notFound });
      },
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, isValidId]);

  const isLoading = isValidId && result?.key !== requestKey;
  const product = isLoading ? null : (result?.product ?? null);
  const error = !isValidId ? 'Invalid product.' : isLoading ? null : (result?.error ?? null);
  const notFound = !isValidId || (!isLoading && result && 'notFound' in result ? result.notFound : false);

  return (
    <div className="flex flex-col gap-6">
      <Link to="/" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" />
        Back to products
      </Link>

      {isLoading && (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      )}

      {!isLoading && error && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <ServerCrash className="size-10 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{error}</p>
          {!notFound && (
            <Button variant="outline" onClick={() => setRetryCount((c) => c + 1)}>
              Retry
            </Button>
          )}
        </div>
      )}

      {!isLoading && product && (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-card">
            {product.imageUrl && (
              <img
                src={getAssetUrl(product.imageUrl)}
                alt={product.name ?? ''}
                className="size-full object-cover"
              />
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {product.categoryName && (
                <Badge variant="secondary" className="w-fit">
                  {product.categoryName}
                </Badge>
              )}
              <h1 className="font-heading text-2xl font-semibold text-foreground">
                {product.name}
              </h1>
              <p className="font-heading text-xl font-semibold text-foreground">
                {product.price !== undefined && formatCoins(product.price)}
              </p>
            </div>

            {product.description && (
              <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
            )}

            <AddToCartControls product={product} />
          </div>
        </div>
      )}
    </div>
  );
}
