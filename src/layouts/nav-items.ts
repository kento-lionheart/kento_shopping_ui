import type { LucideIcon } from 'lucide-react';
import { FolderTree, LayoutDashboard, Package, ShoppingCart, Users, Wallet } from 'lucide-react';

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
}

export const adminNavItems: AdminNavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Products', href: '/admin/products', icon: Package, permission: 'PRODUCT_UPDATE' },
  { label: 'Categories', href: '/admin/categories', icon: FolderTree, permission: 'CATEGORY_MANAGE' },
  { label: 'Orders', href: '/admin/orders', icon: ShoppingCart, permission: 'ORDER_READ_ALL' },
  { label: 'Users', href: '/admin/users', icon: Users, permission: 'USER_READ' },
  { label: 'Wallet & top-ups', href: '/admin/wallet', icon: Wallet, permission: 'TOPUP_READ_ALL' },
];
