import React from 'react';
import {
  Outlet,
  RouterProvider,
  createRouter,
  createRoute,
  createRootRoute,
} from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { usePwaStore } from './store/pwaStore';

// Role Guard, Loading Bar & PWA Prompt
import RoleGuard from './components/RoleGuard';
import GlobalLoadingBar from './components/common/GlobalLoadingBar';
import PwaInstallPrompt from './components/common/PwaInstallPrompt';
import ImpersonationBanner from './components/common/ImpersonationBanner';
import { ROLES } from './config/roles';

// ==========================================
// 1. HIGH-PERFORMANCE CODE SPLITTING (React.lazy)
// ==========================================
const Home = React.lazy(() => import('./pages/mobile/Home'));
const Login = React.lazy(() => import('./pages/mobile/Login'));
const Register = React.lazy(() => import('./pages/mobile/Register'));
const RegisterCanteen = React.lazy(() => import('./pages/mobile/RegisterCanteen'));
const RegisterDriver = React.lazy(() => import('./pages/mobile/RegisterDriver'));
const DashboardLayout = React.lazy(() => import('./components/layout/mobile/DashboardLayout'));
const Dashboard = React.lazy(() => import('./pages/mobile/Dashboard'));
const UserManagement = React.lazy(() => import('./pages/mobile/UserManagement'));
const Pertokoan = React.lazy(() => import('./pages/mobile/Pertokoan'));
const AdminPesanan = React.lazy(() => import('./pages/mobile/AdminPesanan'));
const AdminLogs = React.lazy(() => import('./pages/mobile/AdminLogs'));
const BukuPanduan = React.lazy(() => import('./pages/mobile/BukuPanduan'));
const TokoSaya = React.lazy(() => import('./pages/mobile/TokoSaya'));
const Profile = React.lazy(() => import('./pages/mobile/Profile'));
const Kantin = React.lazy(() => import('./pages/mobile/Kantin'));
const DetailKantin = React.lazy(() => import('./pages/mobile/DetailKantin'));
const PesananToko = React.lazy(() => import('./pages/mobile/PesananToko'));
const PromoVoucher = React.lazy(() => import('./pages/mobile/PromoVoucher'));
const Pembayaran = React.lazy(() => import('./pages/mobile/Pembayaran'));
const TugasKurir = React.lazy(() => import('./pages/mobile/TugasKurir'));
const Keranjang = React.lazy(() => import('./pages/mobile/Keranjang'));
const AdminVouchers = React.lazy(() => import('./pages/mobile/AdminVouchers'));
const Vouchers = React.lazy(() => import('./pages/mobile/Vouchers'));

// ==========================================
// 2. ULTRA-FAST QUERY CLIENT CONFIGURATION (Caching 5-30m)
// ==========================================
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 Menit data fresh di memori (navigasi terasa 0 ms instan)
      gcTime: 1000 * 60 * 30, // 30 Menit data dipertahankan di garbage collection
      refetchOnWindowFocus: false, // Tidak spam API backend saat kursor klik window/tab
      refetchOnReconnect: 'always',
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh] w-full animate-fade-in">
      <div className="flex flex-col items-center gap-2.5">
        <div className="w-8 h-8 rounded-full border-3 border-green-500 border-t-transparent animate-spin" />
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Memuat...</span>
      </div>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: () => (
    <>
      <GlobalLoadingBar />
      <ImpersonationBanner />
      <React.Suspense fallback={<PageLoader />}>
        <Outlet />
      </React.Suspense>
      <PwaInstallPrompt />
    </>
  ),
});

// Public Routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Home,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: Register,
});

const registerCanteenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register-canteen',
  component: RegisterCanteen,
});

const registerDriverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register-driver',
  component: RegisterDriver,
});

const publicPanduanRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/buku-panduan',
  component: BukuPanduan,
});

const publicKantinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/kantin',
  component: Kantin,
});

const publicKantinDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/kantin/$id',
  component: DetailKantin,
});

const publicKeranjangRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/keranjang',
  component: Keranjang,
});

// Wrapper components to avoid inline arrow functions in createRoute
function UserManagementPage() {
  return <RoleGuard allowedRoles={[ROLES.ADMIN]}><UserManagement /></RoleGuard>;
}

function PertokoanPage() {
  return <RoleGuard allowedRoles={[ROLES.ADMIN]}><Pertokoan /></RoleGuard>;
}

function AdminLogsPage() {
  return <RoleGuard allowedRoles={[ROLES.ADMIN]}><AdminLogs /></RoleGuard>;
}

function AdminPesananPage() {
  return <RoleGuard allowedRoles={[ROLES.ADMIN]}><AdminPesanan /></RoleGuard>;
}

function BukuPanduanPage() {
  return <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.USER, ROLES.KANTIN, ROLES.KURIR]}><BukuPanduan /></RoleGuard>;
}

function TokoSayaPage() {
  return <RoleGuard allowedRoles={[ROLES.KANTIN]}><TokoSaya /></RoleGuard>;
}

function PromoVoucherPage() {
  return <RoleGuard allowedRoles={[ROLES.KANTIN]}><PromoVoucher /></RoleGuard>;
}

function PesananTokoPage() {
  return <RoleGuard allowedRoles={[ROLES.KANTIN]}><PesananToko /></RoleGuard>;
}

function KantinPage() {
  return <RoleGuard allowedRoles={[ROLES.USER]}><Kantin /></RoleGuard>;
}

function DetailKantinPage() {
  return <RoleGuard allowedRoles={[ROLES.USER]}><DetailKantin /></RoleGuard>;
}

function PembayaranPage() {
  return <RoleGuard allowedRoles={[ROLES.USER]}><Pembayaran /></RoleGuard>;
}

function TugasKurirPage() {
  return <RoleGuard allowedRoles={[ROLES.KURIR]}><TugasKurir /></RoleGuard>;
}

function KeranjangPage() {
  return <RoleGuard allowedRoles={[ROLES.USER]}><Keranjang /></RoleGuard>;
}

function AdminVouchersPage() {
  return <RoleGuard allowedRoles={[ROLES.ADMIN]}><AdminVouchers /></RoleGuard>;
}

function VouchersPage() {
  return <RoleGuard allowedRoles={[ROLES.USER, ROLES.ADMIN]}><Vouchers /></RoleGuard>;
}

// Protected Dashboard Routes
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: function ProtectedDashboard() {
    const token = useAuthStore((state) => state.token);
    if (!token) {
      window.location.href = '/login';
      return null;
    }
    return <DashboardLayout />;
  },
});

const dashboardIndexRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/',
  component: Dashboard,
});

const userManagementRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/users',
  component: UserManagementPage,
});

const pertokoanRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/pertokoan',
  component: PertokoanPage,
});

const panduanRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/panduan',
  component: BukuPanduanPage,
});

const tokoSayaRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/toko-saya',
  component: TokoSayaPage,
});

const promoVoucherRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/toko-saya/promo',
  component: PromoVoucherPage,
});

const pesananTokoRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/toko-saya/pesanan',
  component: PesananTokoPage,
});

const kantinRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/kantin',
  component: KantinPage,
});

const kantinDetailRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/kantin/$id',
  component: DetailKantinPage,
});

const pembayaranRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/pembayaran',
  component: PembayaranPage,
});

const tugasKurirRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/tugas-kurir',
  component: TugasKurirPage,
});

const keranjangRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/keranjang',
  component: KeranjangPage,
});

const profileRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/profile',
  component: Profile,
});

const profilAliasRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/profil',
  component: Profile,
});

const adminLogsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/admin-logs',
  component: AdminLogsPage,
});

const adminPesananRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/admin/pesanan',
  component: AdminPesananPage,
});

const adminVouchersRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/admin/vouchers',
  component: AdminVouchersPage,
});

const vouchersRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/vouchers',
  component: VouchersPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  registerCanteenRoute,
  registerDriverRoute,
  publicPanduanRoute,
  publicKantinRoute,
  publicKantinDetailRoute,
  publicKeranjangRoute,
  dashboardRoute.addChildren([
    dashboardIndexRoute, 
    userManagementRoute,
    pertokoanRoute,
    adminPesananRoute,
    adminLogsRoute,
    adminVouchersRoute,
    vouchersRoute,
    panduanRoute,
    tokoSayaRoute,
    promoVoucherRoute,
    kantinRoute,
    kantinDetailRoute,
    pesananTokoRoute,
    pembayaranRoute,
    tugasKurirRoute,
    keranjangRoute,
    profileRoute,
    profilAliasRoute
  ]),
]);

const router = createRouter({ 
  routeTree,
  defaultNotFoundComponent: () => {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">404</h1>
        <p className="text-gray-500 dark:text-gray-400">Halaman atau fitur ini belum tersedia.</p>
      </div>
    );
  }
});

function App() {
  const initTheme = useThemeStore((state) => state.initTheme);
  const initPwa = usePwaStore((state) => state.initPwa);

  React.useEffect(() => {
    initTheme();
    initPwa();
  }, [initTheme, initPwa]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
