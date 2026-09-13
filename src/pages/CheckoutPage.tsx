import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { CheckCircle2, Loader2, ServerCrash } from 'lucide-react';
import * as addressApi from '@/api/address';
import type { AddressResponse } from '@/api/address';
import * as cartApi from '@/api/cart';
import type { CartResponse } from '@/api/cart';
import { ApiError } from '@/api/client';
import * as ordersApi from '@/api/orders';
import type { OrderResponse } from '@/api/orders';
import { useAuth } from '@/auth/useAuth';
import { formatCoins } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

type FieldName = 'recipientName' | 'phone' | 'street' | 'ward' | 'district' | 'city';
type FieldErrors = Partial<Record<FieldName, string>>;

type FormValues = {
  recipientName: string;
  phone: string;
  street: string;
  ward: string;
  district: string;
  city: string;
  postalCode: string;
};

const EMPTY_FORM: FormValues = {
  recipientName: '',
  phone: '',
  street: '',
  ward: '',
  district: '',
  city: '',
  postalCode: '',
};

// Same field set and messages as AddressPage.tsx — CheckoutRequest shares
// the same shipping fields as AddressRequest.
const REQUIRED_MESSAGES: Record<FieldName, string> = {
  recipientName: 'Recipient name is required',
  phone: 'Phone is required',
  street: 'Street is required',
  ward: 'Ward is required',
  district: 'District is required',
  city: 'City is required',
};

const FIELD_LABELS: Record<FieldName, string> = {
  recipientName: 'Recipient name',
  phone: 'Phone',
  street: 'Street',
  ward: 'Ward',
  district: 'District',
  city: 'City',
};

const FIELD_ORDER: FieldName[] = ['recipientName', 'phone', 'street', 'ward', 'district', 'city'];

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of FIELD_ORDER) {
    if (!values[field].trim()) {
      errors[field] = REQUIRED_MESSAGES[field];
    }
  }
  return errors;
}

function toFormValues(address: AddressResponse): FormValues {
  return {
    recipientName: address.recipientName ?? '',
    phone: address.phone ?? '',
    street: address.street ?? '',
    ward: address.ward ?? '',
    district: address.district ?? '',
    city: address.city ?? '',
    postalCode: address.postalCode ?? '',
  };
}

function toRequestBody(values: FormValues): ordersApi.CheckoutRequest {
  const body: ordersApi.CheckoutRequest = {
    recipientName: values.recipientName.trim(),
    phone: values.phone.trim(),
    street: values.street.trim(),
    ward: values.ward.trim(),
    district: values.district.trim(),
    city: values.city.trim(),
  };
  const postalCode = values.postalCode.trim();
  if (postalCode) {
    body.postalCode = postalCode;
  }
  return body;
}

type LoadResult =
  | { key: number; status: 'ready'; cart: CartResponse; address: AddressResponse | null }
  | { key: number; status: 'empty' }
  | { key: number; status: 'error'; error: string };

/** Order confirmation + payment view, shown after checkout() succeeds. */
function OrderConfirmation({ order: initialOrder }: { order: OrderResponse }) {
  const [order, setOrder] = useState(initialOrder);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [insufficientBalance, setInsufficientBalance] = useState(false);

  const isPaid = order.orderStatus === 'PAID';

  async function handlePay() {
    if (order.orderId === undefined) return;
    setPayError(null);
    setInsufficientBalance(false);
    setIsPaying(true);
    try {
      const paid = await ordersApi.makePayment(order.orderId);
      setOrder(paid);
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

  if (isPaid) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
        <CheckCircle2 className="size-12 text-primary" aria-hidden="true" />
        <h1 className="font-heading text-2xl font-semibold text-foreground">Order paid</h1>
        <p className="text-sm text-muted-foreground">
          Order #{order.orderId} is paid and on its way to being processed.
          {order.totalAmount !== undefined && <> You paid {formatCoins(order.totalAmount)}.</>}
        </p>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link to="/orders">View my orders</Link>
          </Button>
          <Button asChild className="bg-cta text-cta-foreground hover:bg-cta/90">
            <Link to="/">Continue shopping</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Order placed</h1>
        <p className="text-sm text-muted-foreground">
          Order #{order.orderId} has been created and is awaiting payment.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-xl font-semibold">Order summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {(order.items ?? []).map((item, i) => (
              <div key={item.id ?? `${item.productName}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">
                  {item.productName} <span className="text-muted-foreground">x{item.quantity}</span>
                </span>
                <span className="text-foreground">
                  {item.subTotal !== undefined && formatCoins(item.subTotal)}
                </span>
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{order.subTotal !== undefined && formatCoins(order.subTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Shipping fee</span>
              <span>{order.shippingFee !== undefined && formatCoins(order.shippingFee)}</span>
            </div>
            <div className="flex items-center justify-between font-heading text-base font-semibold text-foreground">
              <span>Total</span>
              <span>{order.totalAmount !== undefined && formatCoins(order.totalAmount)}</span>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Ship to</p>
            <p>{order.shipRecipientName} &middot; {order.shipPhone}</p>
            <p>
              {[order.shipStreet, order.shipWard, order.shipDistrict, order.shipCity, order.shipPostalCode]
                .filter(Boolean)
                .join(', ')}
            </p>
          </div>
        </CardContent>
      </Card>

      {payError && (
        <div className="flex flex-col gap-2 rounded-sm border border-destructive/30 bg-destructive/10 p-4">
          <p role="alert" className="text-sm text-destructive">
            {payError}
          </p>
          {insufficientBalance && (
            <Button asChild variant="outline" className="w-fit">
              <Link to="/wallet">Top up wallet</Link>
            </Button>
          )}
        </div>
      )}

      <Button
        type="button"
        disabled={isPaying}
        onClick={handlePay}
        className="w-full bg-cta text-cta-foreground hover:bg-cta/90"
      >
        {isPaying ? <Loader2 className="animate-spin" /> : null}
        {isPaying ? 'Processing…' : 'Pay now'}
      </Button>
    </div>
  );
}

function CheckoutForm({ cart, address }: { cart: CartResponse; address: AddressResponse | null }) {
  const [values, setValues] = useState<FormValues>(address ? toFormValues(address) : EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [order, setOrder] = useState<OrderResponse | null>(null);

  function updateField(field: FieldName | 'postalCode', value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const body = toRequestBody(values);
      const created = await ordersApi.checkout(body);
      setOrder(created);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (order) {
    return <OrderConfirmation order={order} />;
  }

  const items = cart.items ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Checkout</h1>
        <p className="text-sm text-muted-foreground">Review your order and confirm the shipping address.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl font-semibold">Shipping address</CardTitle>
          </CardHeader>
          <CardContent>
            <form id="checkout-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              {formError && (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              )}

              {FIELD_ORDER.map((field) => (
                <div key={field} className="flex flex-col gap-2">
                  <Label htmlFor={field}>{FIELD_LABELS[field]}</Label>
                  <Input
                    id={field}
                    type="text"
                    value={values[field]}
                    onChange={(e) => updateField(field, e.target.value)}
                    aria-invalid={fieldErrors[field] ? true : undefined}
                    aria-describedby={fieldErrors[field] ? `${field}-error` : undefined}
                  />
                  {fieldErrors[field] && (
                    <p id={`${field}-error`} role="alert" className="text-sm text-destructive">
                      {fieldErrors[field]}
                    </p>
                  )}
                </div>
              ))}

              <div className="flex flex-col gap-2">
                <Label htmlFor="postalCode">Postal code</Label>
                <Input
                  id="postalCode"
                  type="text"
                  value={values.postalCode}
                  onChange={(e) => updateField('postalCode', e.target.value)}
                />
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex h-fit flex-col gap-4 rounded-sm border border-border bg-card p-5">
          <h2 className="font-heading text-lg text-foreground">Order summary</h2>

          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <div key={item.productId} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">
                  {item.productName} <span className="text-muted-foreground">x{item.quantity}</span>
                </span>
                <span className="text-foreground">
                  {item.subTotal !== undefined && formatCoins(item.subTotal)}
                </span>
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Items subtotal</span>
            <span>{cart.total !== undefined && formatCoins(cart.total)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Shipping fee is calculated when your order is placed.
          </p>

          <Button
            type="submit"
            form="checkout-form"
            disabled={isSubmitting}
            className="w-full bg-cta text-cta-foreground hover:bg-cta/90"
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : null}
            {isSubmitting ? 'Placing order…' : 'Place order'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CheckoutContents() {
  const [result, setResult] = useState<LoadResult | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const requestKey = retryCount;

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([cartApi.getCart(), addressApi.getAddress()]).then(([cartOutcome, addressOutcome]) => {
      if (cancelled) return;

      if (cartOutcome.status === 'rejected') {
        const err = cartOutcome.reason;
        const message = err instanceof ApiError ? err.message : 'Failed to load your cart.';
        setResult({ key: requestKey, status: 'error', error: message });
        return;
      }

      const cart = cartOutcome.value;
      if (!cart.items || cart.items.length === 0) {
        setResult({ key: requestKey, status: 'empty' });
        return;
      }

      const address =
        addressOutcome.status === 'fulfilled'
          ? addressOutcome.value
          : addressOutcome.reason instanceof ApiError && addressOutcome.reason.status === 404
            ? null
            : null;

      setResult({ key: requestKey, status: 'ready', cart, address });
    });

    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const isLoading = result?.key !== requestKey;

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </CardContent>
          </Card>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (result?.status === 'error') {
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

  if (result?.status === 'empty') {
    return (
      <Navigate
        to="/cart"
        replace
        state={{ message: 'Your cart is empty. Add items before checking out.' }}
      />
    );
  }

  if (result?.status === 'ready') {
    return <CheckoutForm cart={result.cart} address={result.address} />;
  }

  return null;
}

export default function CheckoutPage() {
  const { isAuthenticated, roles } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!roles.includes('CUSTOMER')) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Checkout</h1>
        <p className="text-sm text-muted-foreground">Admin and staff accounts can't shop.</p>
      </div>
    );
  }

  return <CheckoutContents />;
}
