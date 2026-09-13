import { useEffect, useState } from 'react';
import { LayoutDashboard, LogOut, MapPin, Receipt, ShoppingCart, User, Wallet } from 'lucide-react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import * as cartApi from '@/api/cart';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function AccountMenu() {
  const { user, roles, permissions, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link to="/login">Log in</Link>
      </Button>
    );
  }

  const isCustomer = roles.includes('CUSTOMER');
  // Customers hold zero permissions (see CLAUDE.md) — any permission at all
  // means this account has admin/staff access worth surfacing a way back to.
  const hasAdminAccess = permissions.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <User className="size-4" />
          {user.fullName}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isCustomer && (
          <>
            <DropdownMenuItem asChild>
              <Link to="/account/address">
                <MapPin />
                My Address
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/wallet">
                <Wallet />
                Wallet
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/orders">
                <Receipt />
                My Orders
              </Link>
            </DropdownMenuItem>
          </>
        )}
        {hasAdminAccess && (
          <DropdownMenuItem asChild>
            <Link to="/admin">
              <LayoutDashboard />
              Admin Dashboard
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CartLink() {
  const { isAuthenticated, roles } = useAuth();
  const [itemCount, setItemCount] = useState<number | null>(null);
  const isCustomer = isAuthenticated && roles.includes('CUSTOMER');

  useEffect(() => {
    if (!isCustomer) return;

    let cancelled = false;

    cartApi.getCart().then(
      (cart) => {
        if (!cancelled) setItemCount(cart.itemCount ?? 0);
      },
      () => {
        if (!cancelled) setItemCount(null);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [isCustomer]);

  const displayedCount = isCustomer ? itemCount : null;

  return (
    <Button asChild variant="ghost" size="icon" aria-label="Cart" className="relative">
      <Link to="/cart">
        <ShoppingCart />
        {displayedCount !== null && displayedCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-cta px-1 text-[10px] font-medium text-cta-foreground">
            {displayedCount}
          </span>
        )}
      </Link>
    </Button>
  );
}

export function StorefrontLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="glass sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-18 max-w-7xl items-center gap-6 px-4">
          <Link
            to="/"
            className="font-heading text-2xl font-semibold tracking-wide text-foreground"
          >
            Kento
          </Link>

          <nav className="flex flex-1 items-center gap-4 text-sm font-medium uppercase tracking-wide">
            <Link to="/" className="text-foreground/70 hover:text-foreground">
              Home
            </Link>
          </nav>

          <CartLink />

          <AccountMenu />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
