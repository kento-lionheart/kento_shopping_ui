import { LogOut, MapPin, ShoppingCart, User, Wallet } from 'lucide-react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <User className="size-4" />
          {user.fullName}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
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
        <DropdownMenuItem onClick={handleLogout}>
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
