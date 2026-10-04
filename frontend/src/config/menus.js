import {
  LayoutDashboard,
  Users,
  Wallet,
  Coffee,
  Bus,
  Store,
  Package,
  HeartHandshake,
  FileText,
  ClipboardList,
  Tag,
  ShoppingCart,
  Ticket
} from 'lucide-react';
import { ROLES } from './roles';

export const allMenus = [
  { name: 'Beranda', href: '/dashboard', icon: LayoutDashboard, roles: [ROLES.ADMIN, ROLES.USER, ROLES.KANTIN, ROLES.KURIR] },
  { name: 'User', href: '/dashboard/users', icon: Users, roles: [ROLES.ADMIN] },
  { name: 'Pertokoan', href: '/dashboard/pertokoan', icon: Store, roles: [ROLES.ADMIN] },
  { name: 'Pesanan', href: '/dashboard/admin/pesanan', icon: ClipboardList, roles: [ROLES.ADMIN] },
  { name: 'Voucher', href: '/dashboard/admin/vouchers', icon: Ticket, roles: [ROLES.ADMIN] },
  
  // Non-Admin specific menus
  { name: 'Riwayat', href: '/dashboard/pembayaran', icon: ClipboardList, roles: [ROLES.USER] },
  { name: 'Kantin', href: '/dashboard/kantin', icon: Coffee, roles: [ROLES.USER] },
  { name: 'Voucher', href: '/dashboard/vouchers', icon: Ticket, roles: [ROLES.USER] },
  { name: 'Toko Saya', href: '/dashboard/toko-saya', icon: Store, roles: [ROLES.KANTIN] },
  { name: 'Promo Toko', href: '/dashboard/toko-saya/promo', icon: Ticket, roles: [ROLES.KANTIN] },
  { name: 'Pesanan', href: '/dashboard/toko-saya/pesanan', icon: ClipboardList, roles: [ROLES.KANTIN] },
  { name: 'Tugas', href: '/dashboard/tugas-kurir', icon: Package, roles: [ROLES.KURIR] },
  { name: 'Panduan', href: '/dashboard/panduan', icon: FileText, roles: [ROLES.ADMIN, ROLES.KANTIN, ROLES.KURIR] },
];
