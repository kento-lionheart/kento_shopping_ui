import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Loader2, Pencil, Plus, ServerCrash, Trash2, Warehouse } from 'lucide-react';
import { ApiError } from '@/api/client';
import * as productsApi from '@/api/products';
import type { CategoryResponse, ProductResponse } from '@/api/products';
import * as adminProductsApi from '@/api/admin/products';
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
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const PAGE_SIZE = 10;
const ALL_CATEGORIES = 'all';
const LOW_STOCK_THRESHOLD = 5;

type FetchResult =
  | { key: string; data: productsApi.PageProductResponse; error?: undefined }
  | { key: string; data?: undefined; error: string };

interface ProductFormState {
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  categoryId: string;
  quantity: string;
}

const EMPTY_FORM: ProductFormState = {
  name: '',
  description: '',
  price: '',
  imageUrl: '',
  categoryId: '',
  quantity: '',
};

interface FormErrors {
  name?: string;
  price?: string;
  categoryId?: string;
  quantity?: string;
}

function validateForm(form: ProductFormState, isCreate: boolean): FormErrors {
  const errors: FormErrors = {};

  if (!form.name.trim()) {
    errors.name = "Product's name is required";
  }

  const price = Number(form.price);
  if (form.price.trim() === '' || Number.isNaN(price)) {
    errors.price = "Product's price is required";
  } else if (price <= 0) {
    errors.price = 'Price must be greater than 0';
  }

  if (!form.categoryId) {
    errors.categoryId = 'Category is required';
  }

  if (isCreate) {
    const quantity = Number(form.quantity);
    if (form.quantity.trim() === '' || Number.isNaN(quantity)) {
      errors.quantity = 'Initial quantity is required';
    } else if (quantity < 0) {
      errors.quantity = 'Quantity can not be negative';
    }
  }

  return errors;
}

function findCategoryIdByName(categories: CategoryResponse[], name: string | undefined): string {
  if (!name) return '';
  const match = categories.find((c) => c.name === name);
  return match?.id !== undefined ? String(match.id) : '';
}

function StockBadge({ product }: { product: ProductResponse }) {
  const quantity = product.quantity ?? 0;
  if (product.stockStatus === 'OUT_OF_STOCK' || quantity <= 0) {
    return <Badge variant="destructive">Out of stock</Badge>;
  }
  if (quantity < LOW_STOCK_THRESHOLD) {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
        Low stock
      </Badge>
    );
  }
  return <Badge variant="secondary">In stock</Badge>;
}

export default function AdminProductsPage() {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') ?? '';
  const categoryId = searchParams.get('categoryId');
  const page = Number(searchParams.get('page') ?? '0');

  const [searchInput, setSearchInput] = useState(search);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [result, setResult] = useState<FetchResult | null>(null);

  // Create/edit sheet state.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductResponse | null>(null);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Manage stock dialog state.
  const [stockProduct, setStockProduct] = useState<ProductResponse | null>(null);
  const [stockValue, setStockValue] = useState('');
  const [stockError, setStockError] = useState<string | null>(null);
  const [stockSubmitting, setStockSubmitting] = useState(false);

  // Delete confirmation state.
  const [deleteProduct, setDeleteProduct] = useState<ProductResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      if (searchInput !== search) {
        updateParams({ search: searchInput, page: null });
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  useEffect(() => {
    productsApi.getCategories().then(setCategories, () => setCategories([]));
  }, []);

  const requestKey = JSON.stringify({ search, categoryId, page, retryCount });

  useEffect(() => {
    let cancelled = false;

    productsApi
      .getProducts({
        search: search || undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
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

  function refetch() {
    setRetryCount((c) => c + 1);
  }

  function openCreateSheet() {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormSubmitError(null);
    setSheetOpen(true);
  }

  function openEditSheet(product: ProductResponse) {
    setEditingProduct(product);
    setForm({
      name: product.name ?? '',
      description: product.description ?? '',
      price: product.price !== undefined ? String(product.price) : '',
      imageUrl: product.imageUrl ?? '',
      categoryId: findCategoryIdByName(categories, product.categoryName),
      quantity: '',
    });
    setFormErrors({});
    setFormSubmitError(null);
    setSheetOpen(true);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isCreate = editingProduct === null;
    const errors = validateForm(form, isCreate);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormSubmitting(true);
    setFormSubmitError(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: Number(form.price),
        imageUrl: form.imageUrl.trim() || undefined,
        categoryId: Number(form.categoryId),
      };
      if (isCreate) {
        await adminProductsApi.createProduct({ ...payload, quantity: Number(form.quantity) });
      } else if (editingProduct?.id !== undefined) {
        await adminProductsApi.updateProduct(editingProduct.id, payload);
      }
      setSheetOpen(false);
      refetch();
    } catch (err) {
      setFormSubmitError(err instanceof ApiError ? err.message : 'Failed to save product.');
    } finally {
      setFormSubmitting(false);
    }
  }

  function openStockDialog(product: ProductResponse) {
    setStockProduct(product);
    setStockValue(String(product.quantity ?? 0));
    setStockError(null);
  }

  async function handleStockSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stockProduct || stockProduct.id === undefined) return;

    const quantity = Number(stockValue);
    if (stockValue.trim() === '' || Number.isNaN(quantity)) {
      setStockError('Quantity must not be empty');
      return;
    }
    if (quantity < 0) {
      setStockError('Quantity can not be negative');
      return;
    }

    setStockSubmitting(true);
    setStockError(null);
    try {
      await adminProductsApi.updateStock(stockProduct.id, { quantity });
      setStockProduct(null);
      refetch();
    } catch (err) {
      setStockError(err instanceof ApiError ? err.message : 'Failed to update stock.');
    } finally {
      setStockSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteProduct || deleteProduct.id === undefined) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await adminProductsApi.deleteProduct(deleteProduct.id);
      setDeleteProduct(null);
      refetch();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete product.');
    } finally {
      setDeleting(false);
    }
  }

  const canReadOnly =
    !hasPermission('PRODUCT_CREATE') &&
    !hasPermission('PRODUCT_UPDATE') &&
    !hasPermission('PRODUCT_DELETE') &&
    !hasPermission('INVENTORY_UPDATE');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Products</h1>
        <p className="text-sm text-muted-foreground">
          {canReadOnly
            ? 'Read-only view — you do not have permission to create, edit, restock, or delete products.'
            : 'Manage the catalogue and inventory levels.'}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products…"
            className="max-w-xs"
            aria-label="Search products"
          />
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
        </div>

        <RequirePermission permission="PRODUCT_CREATE">
          <Button size="sm" onClick={openCreateSheet}>
            <Plus />
            Add product
          </Button>
        </RequirePermission>
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

      {!error && !isLoading && products.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="text-sm text-muted-foreground">No products found.</p>
        </div>
      )}

      {!error && !isLoading && products.length > 0 && (
        <div className="overflow-x-auto rounded-sm border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground uppercase">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 font-medium">Stock</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="max-w-64 truncate px-3 py-2 font-medium text-foreground">
                    {product.name}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{product.categoryName}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {product.price !== undefined && formatCoins(product.price)}
                  </td>
                  <td className="px-3 py-2">{product.quantity ?? 0}</td>
                  <td className="px-3 py-2">
                    <StockBadge product={product} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <RequirePermission permission="PRODUCT_UPDATE">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${product.name}`}
                          onClick={() => openEditSheet(product)}
                        >
                          <Pencil />
                        </Button>
                      </RequirePermission>
                      <RequirePermission permission="INVENTORY_UPDATE">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Manage stock for ${product.name}`}
                          onClick={() => openStockDialog(product)}
                        >
                          <Warehouse />
                        </Button>
                      </RequirePermission>
                      <RequirePermission permission="PRODUCT_DELETE">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${product.name}`}
                          onClick={() => {
                            setDeleteProduct(product);
                            setDeleteError(null);
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </RequirePermission>
                    </div>
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

      {/* Create / edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingProduct ? 'Edit product' : 'Add product'}</SheetTitle>
            <SheetDescription>
              {editingProduct
                ? 'Update the product details below.'
                : 'Fill in the details to add a new product to the catalogue.'}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleFormSubmit} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="product-name">Name</Label>
              <Input
                id="product-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                aria-invalid={!!formErrors.name}
              />
              {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="product-description">Description</Label>
              <textarea
                id="product-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="product-price">Price (coins)</Label>
              <Input
                id="product-price"
                type="number"
                min="0"
                step="1"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                aria-invalid={!!formErrors.price}
              />
              {formErrors.price && <p className="text-xs text-destructive">{formErrors.price}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="product-image">Image URL</Label>
              <Input
                id="product-image"
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="product-category">Category</Label>
              <Select
                value={form.categoryId}
                onValueChange={(value) => setForm((f) => ({ ...f, categoryId: value }))}
              >
                <SelectTrigger id="product-category" aria-invalid={!!formErrors.categoryId}>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.categoryId && (
                <p className="text-xs text-destructive">{formErrors.categoryId}</p>
              )}
            </div>

            {editingProduct === null && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="product-quantity">Initial quantity</Label>
                <Input
                  id="product-quantity"
                  type="number"
                  min="0"
                  step="1"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  aria-invalid={!!formErrors.quantity}
                />
                {formErrors.quantity && (
                  <p className="text-xs text-destructive">{formErrors.quantity}</p>
                )}
              </div>
            )}

            {formSubmitError && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>{formSubmitError}</span>
              </div>
            )}
          </form>

          <SheetFooter>
            <Button onClick={handleFormSubmit} disabled={formSubmitting}>
              {formSubmitting && <Loader2 className="animate-spin" />}
              {editingProduct ? 'Save changes' : 'Create product'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Manage stock dialog */}
      <Dialog open={stockProduct !== null} onOpenChange={(open) => !open && setStockProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage stock</DialogTitle>
            <DialogDescription>
              {stockProduct?.name} — current quantity: {stockProduct?.quantity ?? 0}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStockSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stock-quantity">New quantity</Label>
              <Input
                id="stock-quantity"
                type="number"
                min="0"
                step="1"
                value={stockValue}
                onChange={(e) => setStockValue(e.target.value)}
                aria-invalid={!!stockError}
                autoFocus
              />
              {stockError && <p className="text-xs text-destructive">{stockError}</p>}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={stockSubmitting}>
                {stockSubmitting && <Loader2 className="animate-spin" />}
                Update stock
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteProduct !== null}
        onOpenChange={(open) => !open && setDeleteProduct(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete “{deleteProduct?.name}”? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{deleteError}</span>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
            >
              {deleting && <Loader2 className="animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
