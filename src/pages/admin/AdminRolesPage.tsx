import { useEffect, useState } from 'react';
import { Plus, ServerCrash, ShieldAlert } from 'lucide-react';
import { ApiError } from '@/api/client';
import * as rolesApi from '@/api/admin/roles';
import type { RoleResponse, PermissionResponse } from '@/api/admin/roles';
import { useAuth } from '@/auth/useAuth';
import { RequirePermission } from '@/auth/RequirePermission';
import { PermissionCheckboxGrid } from '@/components/admin/PermissionCheckboxGrid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface CreateRoleSheetProps {
  permissions: PermissionResponse[];
  onClose: () => void;
  onCreated: (role: RoleResponse) => void;
}

function CreateRoleSheet({ permissions, onClose, onCreated }: CreateRoleSheetProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(permission: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(permission);
      } else {
        next.delete(permission);
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Role name is required.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const created = await rolesApi.createRole({
        name: name.trim(),
        description: description.trim() || undefined,
        permissions: Array.from(selected),
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create role.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Create role</SheetTitle>
          <SheetDescription>
            Role names are stored upper-case regardless of what you type here.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          {error && (
            <div className="rounded-sm border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SUPPORT_AGENT"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-description">Description (optional)</Label>
            <Input
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this role is for"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Permissions</Label>
            <PermissionCheckboxGrid
              permissions={permissions}
              selected={selected}
              onToggle={toggle}
              idPrefix="create-role"
            />
          </div>
        </div>

        <SheetFooter>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Creating…' : 'Create role'}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

interface EditRolePermissionsSheetProps {
  role: RoleResponse;
  permissions: PermissionResponse[];
  onClose: () => void;
  onSaved: (role: RoleResponse) => void;
}

function EditRolePermissionsSheet({
  role,
  permissions,
  onClose,
  onSaved,
}: EditRolePermissionsSheetProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(role.permissions ?? []));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(permission: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(permission);
      } else {
        next.delete(permission);
      }
      return next;
    });
  }

  async function handleSubmit() {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await rolesApi.updateRolePermissions(role.id!, Array.from(selected));
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update permissions.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit permissions</SheetTitle>
          <SheetDescription>{role.name}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          {error && (
            <div className="rounded-sm border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <PermissionCheckboxGrid
            permissions={permissions}
            selected={selected}
            onToggle={toggle}
            idPrefix={`edit-role-${role.id}`}
          />
        </div>

        <SheetFooter>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save permissions'}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function AdminRolesPageContent() {
  const [retryCount, setRetryCount] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleResponse | null>(null);

  type FetchResult =
    | { key: number; roles: RoleResponse[]; permissions: PermissionResponse[]; error?: undefined }
    | { key: number; roles?: undefined; permissions?: undefined; error: string };
  const [result, setResult] = useState<FetchResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([rolesApi.getRoles(), rolesApi.getPermissions()]).then(
      ([roles, permissions]) => {
        if (!cancelled) setResult({ key: retryCount, roles, permissions });
      },
      (err) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : 'Failed to load roles.';
        setResult({ key: retryCount, error: message });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  const isLoading = result?.key !== retryCount;
  const error = isLoading ? null : (result?.error ?? null);
  const roles = isLoading ? [] : (result?.roles ?? []);
  const permissions = isLoading ? [] : (result?.permissions ?? []);

  function handleCreated(role: RoleResponse) {
    setResult((prev) =>
      prev?.roles ? { ...prev, roles: [...prev.roles, role] } : prev,
    );
    setIsCreating(false);
  }

  function handleSaved(role: RoleResponse) {
    setResult((prev) =>
      prev?.roles
        ? { ...prev, roles: prev.roles.map((r) => (r.id === role.id ? role : r)) }
        : prev,
    );
    setEditingRole(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Roles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compose roles from the permission catalogue.
          </p>
        </div>
        <RequirePermission permission="ROLE_MANAGE">
          <Button onClick={() => setIsCreating(true)}>
            <Plus />
            Create role
          </Button>
        </RequirePermission>
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
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {!error && !isLoading && (
        <div className="overflow-x-auto rounded-sm border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium">Permissions</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-medium">{role.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{role.description ?? '—'}</td>
                  <td className="px-4 py-2">
                    <Badge variant="secondary">
                      {(role.permissions ?? []).length} permission
                      {(role.permissions ?? []).length === 1 ? '' : 's'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <RequirePermission permission="ROLE_MANAGE">
                      <Button variant="outline" size="sm" onClick={() => setEditingRole(role)}>
                        Edit permissions
                      </Button>
                    </RequirePermission>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isCreating && (
        <CreateRoleSheet
          permissions={permissions}
          onClose={() => setIsCreating(false)}
          onCreated={handleCreated}
        />
      )}

      {editingRole && (
        <EditRolePermissionsSheet
          role={editingRole}
          permissions={permissions}
          onClose={() => setEditingRole(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

export default function AdminRolesPage() {
  const { hasPermission } = useAuth();

  if (!hasPermission('ROLE_ASSIGN') && !hasPermission('ROLE_MANAGE')) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ShieldAlert className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to view this page.
        </p>
      </div>
    );
  }

  return <AdminRolesPageContent />;
}
