import { useEffect, useState, type FormEvent } from 'react';
import { ServerCrash } from 'lucide-react';
import * as addressApi from '@/api/address';
import type { AddressRequest, AddressResponse } from '@/api/address';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const REQUIRED_MESSAGES: Record<FieldName, string> = {
  recipientName: 'Recipient name is required',
  phone: 'Phone is required',
  street: 'Street is required',
  ward: 'Ward is required',
  district: 'District is required',
  city: 'City is required',
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

function toRequestBody(values: FormValues): AddressRequest {
  const body: AddressRequest = {
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

type FetchResult =
  | { key: number; mode: 'edit'; address: AddressResponse; error?: undefined }
  | { key: number; mode: 'create'; address?: undefined; error?: undefined }
  | { key: number; mode: 'error'; address?: undefined; error: string };

const FIELD_LABELS: Record<FieldName, string> = {
  recipientName: 'Recipient name',
  phone: 'Phone',
  street: 'Street',
  ward: 'Ward',
  district: 'District',
  city: 'City',
};

export default function AddressPage() {
  const [fetchResult, setFetchResult] = useState<FetchResult | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const requestKey = retryCount;

  useEffect(() => {
    let cancelled = false;

    addressApi.getAddress().then(
      (address) => {
        if (!cancelled) setFetchResult({ key: requestKey, mode: 'edit', address });
      },
      (err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setFetchResult({ key: requestKey, mode: 'create' });
        } else {
          const message = err instanceof ApiError ? err.message : 'Failed to load your address.';
          setFetchResult({ key: requestKey, mode: 'error', error: message });
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const isLoading = fetchResult?.key !== requestKey;

  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initializedKey, setInitializedKey] = useState<number | null>(null);

  // Initialize/reset form state whenever a fresh fetch result comes in — derived from
  // props/state rather than an imperative setState-in-effect, keyed on requestKey so
  // it only runs once per fetch (react-hooks/set-state-in-effect pattern used elsewhere).
  if (fetchResult && fetchResult.key === requestKey && initializedKey !== fetchResult.key) {
    setInitializedKey(fetchResult.key);
    if (fetchResult.mode === 'edit') {
      setMode('edit');
      setValues(toFormValues(fetchResult.address));
    } else if (fetchResult.mode === 'create') {
      setMode('create');
      setValues(EMPTY_FORM);
    }
    setFieldErrors({});
    setFormError(null);
    setSuccessMessage(null);
  }

  function updateField(field: FieldName | 'postalCode', value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const body = toRequestBody(values);
      if (mode === 'edit') {
        await addressApi.updateAddress(body);
        setSuccessMessage('Address updated successfully');
      } else {
        await addressApi.createAddress(body);
        setSuccessMessage('Address saved successfully');
        setMode('edit');
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError(err.message);
        setMode('edit');
        setRetryCount((c) => c + 1);
      } else {
        setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">My Address</h1>
        <p className="text-sm text-muted-foreground">
          Manage the shipping address used for your orders.
        </p>
      </div>

      {isLoading && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </CardContent>
        </Card>
      )}

      {!isLoading && fetchResult?.mode === 'error' && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <ServerCrash className="size-10 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{fetchResult.error}</p>
          <Button variant="outline" onClick={() => setRetryCount((c) => c + 1)}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && fetchResult && fetchResult.mode !== 'error' && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl font-semibold">
              {mode === 'edit' ? 'Update address' : 'Add address'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              {formError && (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              )}
              {successMessage && (
                <p role="status" className="text-sm text-primary">
                  {successMessage}
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

              <Button type="submit" disabled={isSubmitting} className="mt-2">
                {isSubmitting
                  ? 'Saving…'
                  : mode === 'edit'
                    ? 'Update address'
                    : 'Save address'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
