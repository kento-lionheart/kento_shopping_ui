import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PackageX, SearchX, ServerCrash } from 'lucide-react';
import { getAssetUrl, ApiError } from '@/api/client';
import * as productsApi from '@/api/products';
import type { CategoryResponse, ProductResponse, ProductSort } from '@/api/products';
import { formatCoins } from '@/lib/money';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const PAGE_SIZE = 12;
const ALL_CATEGORIES = 'all';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-square w-full rounded-lg" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  );
}

function ProductCard({ product }: { product: ProductResponse }) {
  const outOfStock = product.stockStatus === 'OUT_OF_STOCK';

  return (
    <Link to={`/products/${product.id}`} className="group flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-sm border border-border bg-card shadow-sm transition-shadow duration-200 group-hover:shadow-lg">
        {product.imageUrl && (
          <img
            src={getAssetUrl(product.imageUrl)}
            alt={product.name ?? ''}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        )}
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Badge variant="destructive">Out of stock</Badge>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {product.categoryName && (
          <span className="text-[11px] font-medium tracking-widest text-cta uppercase">
            {product.categoryName}
          </span>
        )}
        <h3 className="line-clamp-2 font-heading text-base leading-tight text-foreground">
          {product.name}
        </h3>
        <p className="text-sm font-semibold text-foreground">
          {product.price !== undefined && formatCoins(product.price)}
        </p>
      </div>
    </Link>
  );
}

export default function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') ?? '';
  const categoryId = searchParams.get('categoryId');
  const sort = (searchParams.get('sort') as ProductSort | null) ?? 'newest';
  const page = Number(searchParams.get('page') ?? '0');

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [retryCount, setRetryCount] = useState(0);

  type FetchResult =
    | { key: string; data: productsApi.PageProductResponse; error?: undefined }
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
    if (debouncedSearch !== search) {
      updateParams({ search: debouncedSearch, page: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    productsApi.getCategories().then(setCategories, () => setCategories([]));
  }, []);

  const requestKey = JSON.stringify({ search, categoryId, sort, page, retryCount });

  useEffect(() => {
    let cancelled = false;

    productsApi
      .getProducts({
        search: search || undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
        sort,
        page,
        size: PAGE_SIZE,
      })
      .then(
        (data) => {
          if (!cancelled) setResult({ key: requestKey, data });
        },
        (err) => {
          if (cancelled) return;
          const message = err instanceof ApiError ? err.message : 'Failed to load products.';
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
  const products = data?.content ?? [];

  return (
    <div className="flex flex-col gap-10">
      <section className="relative overflow-hidden rounded-sm bg-primary px-8 py-16 text-center sm:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(161,98,7,0.25),_transparent_60%)]"
        />
        <p className="relative text-xs font-medium tracking-[0.3em] text-cta uppercase">
          Kento Shopping
        </p>
        <h1 className="relative mt-3 font-heading text-4xl font-medium text-primary-foreground sm:text-5xl">
          Considered goods, carefully chosen
        </h1>
        <p className="relative mx-auto mt-4 max-w-xl text-sm text-primary-foreground/70">
          A curated catalogue across electronics, apparel, home and sport — selected for
          quality, not quantity.
        </p>
      </section>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search products…"
          className="sm:max-w-xs"
          aria-label="Search products"
        />

        <div className="flex gap-3">
          <Select
            value={categoryId ?? ALL_CATEGORIES}
            onValueChange={(value) =>
              updateParams({ categoryId: value === ALL_CATEGORIES ? null : value, page: null })
            }
          >
            <SelectTrigger className="w-40" aria-label="Filter by category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(value) => updateParams({ sort: value, page: null })}>
            <SelectTrigger className="w-40" aria-label="Sort products">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_asc">Price: low to high</SelectItem>
              <SelectItem value="price_desc">Price: high to low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <ServerCrash className="size-10 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => setRetryCount((c) => c + 1)}>
            Retry
          </Button>
        </div>
      )}

      {!error && isLoading && (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: PAGE_SIZE }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!error && !isLoading && products.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          {search ? (
            <SearchX className="size-10 text-muted-foreground" aria-hidden="true" />
          ) : (
            <PackageX className="size-10 text-muted-foreground" aria-hidden="true" />
          )}
          <p className="text-sm text-muted-foreground">
            {search ? `No products match "${search}".` : 'No products found.'}
          </p>
        </div>
      )}

      {!error && !isLoading && products.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 0}
                onClick={() => updateParams({ page: String(page - 1) })}
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
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
