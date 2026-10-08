import {
  LayoutDashboard,
  Users,
  Wallet,
  Coffee,
  Store,
  Package,
  FileText,
  ClipboardList,
  ShoppingCart,
  Ticket,
  Shield,
  User
} from 'lucide-react';
import { ROLES } from './roles';

/**
 * Konfigurasi Menu Terpadu & Konsisten untuk Seluruh Role di HiGO Pondok
 * - desktopName: Label lengkap di Desktop Sidebar
 * - mobileName: Label ringkas di Mobile Bottom Navigation
 * - showOnMobile: Menentukan apakah tampil di bottom bar mobile (dibatasi max 5 icon agar rapi)
 */
export const allMenus = [
  // 1. MENU UTAMA (Semua Role)
  {
    name: 'Beranda',
    desktopName: 'Beranda',
    mobileName: 'Beranda',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER, ROLES.KANTIN, ROLES.KURIR],
    showOnMobile: true,
  },

  // 2. MENU SUPER ADMIN & ADMIN
  {
    name: 'Manajemen User',
    desktopName: 'Manajemen User',
    mobileName: 'User',
    href: '/dashboard/users',
    icon: Users,
    roles: [ROLES.SUPER_ADMIN], // Khusus Super Admin
    showOnMobile: true,
  },
  {
    name: 'Rekap & Pesanan',
    desktopName: 'Rekap & Pesanan',
    mobileName: 'Pesanan',
    href: '/dashboard/admin/pesanan',
    icon: ClipboardList,
    roles: [ROLES.SUPER_ADMIN],
    showOnMobile: true,
  },
  {
    name: 'Manajemen Voucher',
    desktopName: 'Manajemen Voucher',
    mobileName: 'Voucher',
    href: '/dashboard/admin/vouchers',
    icon: Ticket,
    roles: [ROLES.SUPER_ADMIN], // Khusus Super Admin
    showOnMobile: true,
  },
  {
    name: 'Pengaturan Pertokoan',
    desktopName: 'Pengaturan Pertokoan',
    mobileName: 'Pertokoan',
    href: '/dashboard/pertokoan',
    icon: Store,
    roles: [ROLES.SUPER_ADMIN], // Pengaturan zonasi, biaya & operasional toko khusus Super Admin
    showOnMobile: true,
  },
  {
    name: 'Log Aktivitas',
    desktopName: 'Log Aktivitas',
    mobileName: 'Audit',
    href: '/dashboard/admin-logs',
    icon: Shield,
    roles: [ROLES.SUPER_ADMIN], // Khusus Super Admin
    showOnMobile: false, // Diakses via Sidebar Desktop & Akses Cepat Beranda
  },

  // 3. MENU MITRA KANTIN & KATALOG TOKO (Kantin & Admin)
  {
    name: 'Toko Saya',
    desktopName: 'Katalog & Toko Saya',
    mobileName: 'Toko',
    href: '/dashboard/toko-saya',
    icon: Store,
    roles: [ROLES.KANTIN, ROLES.ADMIN],
    showOnMobile: true,
  },
  {
    name: 'Pesanan Toko',
    desktopName: 'Pesanan Masuk',
    mobileName: 'Pesanan',
    href: '/dashboard/toko-saya/pesanan',
    icon: ClipboardList,
    roles: [ROLES.KANTIN, ROLES.ADMIN],
    showOnMobile: true,
  },
  {
    name: 'Promo Toko',
    desktopName: 'Promo & Banner Toko',
    mobileName: 'Promo',
    href: '/dashboard/toko-saya/promo',
    icon: Ticket,
    roles: [ROLES.KANTIN, ROLES.ADMIN],
    showOnMobile: true,
  },

  // 4. MENU KURIR
  {
    name: 'Tugas Kurir',
    desktopName: 'Tugas Pengantaran',
    mobileName: 'Tugas',
    href: '/dashboard/tugas-kurir',
    icon: Package,
    roles: [ROLES.KURIR],
    showOnMobile: true,
  },

  // 5. MENU SANTRI / WALI (USER)
  {
    name: 'Kantin',
    desktopName: 'Daftar Kantin',
    mobileName: 'Kantin',
    href: '/dashboard/kantin',
    icon: Coffee,
    roles: [ROLES.USER],
    showOnMobile: true,
  },
  {
    name: 'Keranjang',
    desktopName: 'Keranjang Belanja',
    mobileName: 'Keranjang',
    href: '/dashboard/keranjang',
    icon: ShoppingCart,
    roles: [ROLES.USER],
    showOnMobile: true,
  },
  {
    name: 'Voucher',
    desktopName: 'Kupon & Voucher',
    mobileName: 'Voucher',
    href: '/dashboard/vouchers',
    icon: Ticket,
    roles: [ROLES.USER],
    showOnMobile: true,
  },
  {
    name: 'Riwayat Transaksi',
    desktopName: 'Riwayat Pesanan',
    mobileName: 'Riwayat',
    href: '/dashboard/pembayaran',
    icon: ClipboardList,
    roles: [ROLES.USER],
    showOnMobile: true,
  },

  // 6. MENU UMUM (PANDUAN & PROFIL)
  {
    name: 'Panduan',
    desktopName: 'Buku Panduan',
    mobileName: 'Panduan',
    href: '/dashboard/panduan',
    icon: FileText,
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.KANTIN, ROLES.KURIR, ROLES.USER],
    showOnMobile: false, // Tampil di Desktop Sidebar & link profil
  },
  {
    name: 'Profil',
    desktopName: 'Profil & Akun',
    mobileName: 'Profil',
    href: '/dashboard/profile',
    icon: User,
    roles: [ROLES.KANTIN, ROLES.KURIR],
    showOnMobile: true,
  },
];
