import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ServerCrash, ShieldAlert, UsersRound } from 'lucide-react';
import { ApiError } from '@/api/client';
import * as usersApi from '@/api/admin/users';
import type { AdminUserResponse } from '@/api/admin/users';
import * as rolesApi from '@/api/admin/roles';
import type { RoleResponse } from '@/api/admin/roles';
import { useAuth } from '@/auth/useAuth';
import { RequirePermission } from '@/auth/RequirePermission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';

const PAGE_SIZE = 20;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

interface ManageRolesSheetProps {
  user: AdminUserResponse;
  roles: RoleResponse[];
  onClose: () => void;
  onSaved: (updated: AdminUserResponse) => void;
}

function ManageRolesSheet({ user, roles, onClose, onSaved }: ManageRolesSheetProps) {
  const { user: currentUser } = useAuth();
  const isSelf = currentUser?.id === user.id;

  const [selected, setSelected] = useState<Set<string>>(new Set(user.roles ?? []));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(name: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(name);
      } else {
        next.delete(name);
      }
      return next;
    });
  }

  async function handleSubmit() {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await usersApi.assignRoles(user.id!, Array.from(selected));
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update roles.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Manage roles</SheetTitle>
          <SheetDescription>{user.email}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          {isSelf && (
            <div className="flex items-start gap-2 rounded-sm border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>You cannot change your own roles. Ask another administrator to do this.</span>
            </div>
          )}

          {error && (
            <div className="rounded-sm border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {roles.map((role) => {
              const id = `role-${role.id}`;
              return (
                <div key={role.id} className="flex items-start gap-2">
                  <Checkbox
                    id={id}
                    checked={selected.has(role.name!)}
                    disabled={isSelf}
                    onCheckedChange={(checked) => toggle(role.name!, checked === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor={id} className="flex flex-col gap-0.5 font-normal">
                    <span className="font-medium">{role.name}</span>
                    {role.description && (
                      <span className="text-xs text-muted-foreground">{role.description}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {(role.permissions ?? []).length} permission(s)
                    </span>
                  </Label>
                </div>
              );
            })}
          </div>
        </div>

        <SheetFooter>
          <Button onClick={handleSubmit} disabled={isSelf || isSaving}>
            {isSaving ? 'Saving…' : 'Save roles'}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function AdminUsersPageContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const page = Number(searchParams.get('page') ?? '0');

  const [emailInput, setEmailInput] = useState(email);
  const debouncedEmail = useDebouncedValue(emailInput, 300);

  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [managingUser, setManagingUser] = useState<AdminUserResponse | null>(null);

  type FetchResult =
    | { key: string; data: usersApi.PageAdminUserResponse; error?: undefined }
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
    if (debouncedEmail !== email) {
      updateParams({ email: debouncedEmail, page: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedEmail]);

  useEffect(() => {
    rolesApi.getRoles().then(setRoles, () => setRoles([]));
  }, []);

  const requestKey = JSON.stringify({ email, page, retryCount });

  useEffect(() => {
    let cancelled = false;

    usersApi
      .getUsers({ email: email || undefined, page, size: PAGE_SIZE })
      .then(
        (data) => {
          if (!cancelled) setResult({ key: requestKey, data });
        },
        (err) => {
          if (cancelled) return;
          const message = err instanceof ApiError ? err.message : 'Failed to load users.';
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
  const users = data?.content ?? [];

  function handleSaved(updated: AdminUserResponse) {
    setResult((prev) =>
      prev?.data
        ? {
            ...prev,
            data: {
              ...prev.data,
              content: prev.data.content?.map((u) => (u.id === updated.id ? updated : u)),
            },
          }
        : prev,
    );
    setManagingUser(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View accounts and manage their assigned roles.
        </p>
      </div>

      <Input
        value={emailInput}
        onChange={(e) => setEmailInput(e.target.value)}
        placeholder="Search by email…"
        className="max-w-xs"
        aria-label="Search users by email"
      />

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
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {!error && !isLoading && users.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <UsersRound className="size-10 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No users found.</p>
        </div>
      )}

      {!error && !isLoading && users.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-sm border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Roles</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">{user.email}</td>
                    <td className="px-4 py-2">{user.fullName}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {(user.roles ?? []).length === 0 ? (
                          <span className="text-xs text-muted-foreground">No roles</span>
                        ) : (
                          user.roles!.map((role) => (
                            <Badge key={role} variant="secondary">
                              {role}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <RequirePermission permission="ROLE_ASSIGN">
                        <Button variant="outline" size="sm" onClick={() => setManagingUser(user)}>
                          Manage roles
                        </Button>
                      </RequirePermission>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {managingUser && (
        <ManageRolesSheet
          user={managingUser}
          roles={roles}
          onClose={() => setManagingUser(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  const { hasPermission } = useAuth();

  if (!hasPermission('USER_READ')) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ShieldAlert className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to view this page.
        </p>
      </div>
    );
  }

  return <AdminUsersPageContent />;
}
