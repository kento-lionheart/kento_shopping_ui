import { LogOut } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { RequirePermission } from '@/auth/RequirePermission';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { adminNavItems } from './nav-items';

function AdminNav() {
  return (
    <SidebarMenu>
      {adminNavItems.map((item) => {
        const link = (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild>
              <NavLink to={item.href} end={item.href === '/admin'}>
                <item.icon />
                <span>{item.label}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );

        if (!item.permission) {
          return link;
        }

        return (
          <RequirePermission key={item.href} permission={item.permission}>
            {link}
          </RequirePermission>
        );
      })}
    </SidebarMenu>
  );
}

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <span className="px-2 py-1 font-heading text-lg font-semibold text-sidebar-foreground">
            Kento Admin
          </span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <AdminNav />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <span className="truncate text-sm text-sidebar-foreground/80">{user?.fullName}</span>
            <Button variant="ghost" size="icon" aria-label="Log out" onClick={handleLogout}>
              <LogOut />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-4">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
