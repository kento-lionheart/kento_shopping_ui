import { LogOut, ShoppingCart, User } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function AccountMenu() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link to="/login">Log in</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <User className="size-4" />
          {user.fullName}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={logout}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function StorefrontLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
          <Link to="/" className="font-heading text-xl font-semibold text-foreground">
            Kento Shopping
          </Link>

          <nav className="flex flex-1 items-center gap-4 text-sm font-medium">
            <Link to="/" className="text-foreground/80 hover:text-foreground">
              Home
            </Link>
          </nav>

          <Button asChild variant="ghost" size="icon" aria-label="Cart">
            <Link to="/cart">
              <ShoppingCart />
            </Link>
          </Button>

          <AccountMenu />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
