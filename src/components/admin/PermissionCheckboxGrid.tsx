import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface PermissionOption {
  name?: string;
  description?: string;
}

interface PermissionCheckboxGridProps {
  permissions: PermissionOption[];
  selected: Set<string>;
  onToggle: (name: string, checked: boolean) => void;
  disabled?: boolean;
  idPrefix: string;
}

/** Checkbox grid for selecting permissions, populated from the real catalogue — never hardcoded. */
export function PermissionCheckboxGrid({
  permissions,
  selected,
  onToggle,
  disabled,
  idPrefix,
}: PermissionCheckboxGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {permissions
        .filter((permission): permission is PermissionOption & { name: string } =>
          Boolean(permission.name),
        )
        .map((permission) => {
        const id = `${idPrefix}-${permission.name}`;
        return (
          <div key={permission.name} className="flex items-start gap-2">
            <Checkbox
              id={id}
              checked={selected.has(permission.name)}
              disabled={disabled}
              onCheckedChange={(checked) => onToggle(permission.name, checked === true)}
              className="mt-0.5"
            />
            <Label htmlFor={id} className="flex flex-col gap-0.5 font-normal">
              <span className="font-mono text-xs font-medium">{permission.name}</span>
              {permission.description && (
                <span className="text-xs text-muted-foreground">{permission.description}</span>
              )}
            </Label>
          </div>
        );
      })}
    </div>
  );
}
