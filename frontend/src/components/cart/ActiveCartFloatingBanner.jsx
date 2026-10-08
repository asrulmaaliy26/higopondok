import React, { useState } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { ShoppingBag, ArrowRight, Store, ChevronUp, ChevronDown, Trash2, X, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/axios';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { getUserRole } from '../../config/roles';
import { useVoucherPopupStore } from '../../store/voucherPopupStore';

export default function ActiveCartFloatingBanner() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const isVoucherPopupOpen = useVoucherPopupStore((state) => state.isOpen);

  const cart = useCartStore((state) => state.cart);
  const totalItems = useCartStore((state) => state.getTotalItems());
  const clearCanteen = useCartStore((state) => state.clearCanteen);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Keranjang hanya untuk role 'user' (santri/guru yang berbelanja)
  // Kurir, Kantin, dan Admin tidak perlu melihat keranjang belanja
  const userRole = getUserRole(user);
  const isBuyer = !user || userRole === 'user';

  // Ambil daftar voucher dari cache React Query (unconditional hook)
  const { data: vouchers = [] } = useQuery({
    queryKey: ['available_vouchers', token],
    queryFn: async () => {
      const res = await api.get('/vouchers');
      return res.data || [];
    },
    enabled: isBuyer,
    staleTime: 1000 * 60 * 5,
  });

  const canteensWithItems = React.useMemo(() => {
    return Object.values(cart || {}).filter(
      (c) => c && c.items && Object.keys(c.items).length > 0
    );
  }, [cart]);

  // Hitung total harga keseluruhan (unconditional hook)
  const grandTotal = React.useMemo(() => {
    let sum = 0;
    canteensWithItems.forEach((c) => {
      Object.values(c.items).forEach((item) => {
        const price = parseFloat(item.product?.price || 0);
        sum += price * item.quantity;
      });
    });
    return sum;
  }, [canteensWithItems]);

  // Deteksi HANYA untuk voucher promo yang BELUM DIKLAIM oleh santri (unconditional hook)
  const unclaimedNudge = React.useMemo(() => {
    if (!isBuyer) return null;
    const isVoucherPage = location.pathname.startsWith('/vouchers') || location.pathname.startsWith('/promo');
    if (isVoucherPopupOpen || grandTotal === 0 || isVoucherPage || !Array.isArray(vouchers)) {
      return null;
    }

    const unclaimedVouchers = vouchers
      .filter((v) => v.is_active && !v.is_claimed && !v.is_used && !v.is_expired && v.min_purchase && v.min_purchase > 0)
      .sort((a, b) => a.min_purchase - b.min_purchase);

    if (unclaimedVouchers.length === 0) return null;

    const eligibleUnlocked = unclaimedVouchers
      .filter((v) => grandTotal >= v.min_purchase)
      .sort((a, b) => b.min_purchase - a.min_purchase)[0];

    if (eligibleUnlocked) {
      const discountVal = parseFloat(eligibleUnlocked.discount_amount || 0);
      const discountFormatted = eligibleUnlocked.discount_type === 'percentage' 
        ? `${discountVal}%` 
        : `Rp ${discountVal.toLocaleString('id-ID')}`;

      return {
        isUnlocked: true,
        text: `Ada Promo Diskon ${discountFormatted} (${eligibleUnlocked.code})!`,
        actionLabel: 'CEK',
        voucher: eligibleUnlocked
      };
    }

    const nextUnclaimed = unclaimedVouchers.find((v) => v.min_purchase > grandTotal);
    if (nextUnclaimed) {
      const gap = nextUnclaimed.min_purchase - grandTotal;
      const progressPercent = Math.round((grandTotal / nextUnclaimed.min_purchase) * 100);

      if (progressPercent >= 65 || gap <= 15000) {
        return {
          isUnlocked: false,
          text: `Kurang Rp ${gap.toLocaleString('id-ID')} lagi untuk promo ${nextUnclaimed.code}!`,
          actionLabel: 'CEK',
          voucher: nextUnclaimed
        };
      }
    }

    return null;
  }, [isBuyer, vouchers, grandTotal, isVoucherPopupOpen, location.pathname]);

  // Safe early returns AFTER all hooks are declared
  if (!isBuyer) return null;

  // Jangan tampilkan jika di dalam halaman Detail Kantin, Keranjang, Profil, Buku Panduan, Pembayaran, Login, atau Admin
  const isKantinDetailPage = Boolean(location.pathname.match(/^\/(dashboard\/)?kantin\/\d+$/));
  const isKeranjangPage = location.pathname === '/keranjang' || location.pathname === '/dashboard/keranjang';
  const isProfilePage = location.pathname === '/dashboard/profile' || location.pathname === '/profile';
  const isPanduanPage = location.pathname.includes('panduan');
  const isPembayaranPage = location.pathname === '/dashboard/pembayaran' || location.pathname === '/pembayaran';
  const isAuthPage = location.pathname === '/login' || location.pathname.startsWith('/register');
  const isAdminOps = 
    location.pathname.startsWith('/dashboard/admin') || 
    location.pathname.startsWith('/dashboard/users') || 
    location.pathname.startsWith('/dashboard/pertokoan') ||
    location.pathname.startsWith('/dashboard/tugas-kurir');
  
  if (isKantinDetailPage || isKeranjangPage || isProfilePage || isPanduanPage || isPembayaranPage || isAuthPage || isAdminOps) {
    return null;
  }

  if (totalItems === 0 || canteensWithItems.length === 0) {
    return null;
  }

  const primaryCanteen = canteensWithItems[0];
  const primaryCanteenName = primaryCanteen.canteen?.name || 'Kantin';
  const isMultipleCanteens = canteensWithItems.length > 1;

  const handleOpenCart = () => {
    navigate({ to: token ? '/dashboard/keranjang' : '/keranjang' });
  };

  return (
    <aside 
      aria-label="Keranjang Belanja Aktif"
      className={`fixed z-[60] transition-all duration-300 ease-out right-2 sm:right-4 w-[275px] sm:w-[295px] max-w-[calc(100vw-1rem)] ${
        isVoucherPopupOpen
          ? 'bottom-[9.8rem] lg:bottom-[7.2rem]'
          : 'bottom-[4.5rem] lg:bottom-5'
      }`}
    >
      {/* JIKA DIKECILKAN (MINIMIZED ICON SAJA) */}
      {isMinimized ? (
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="bg-green-700 hover:bg-green-800 text-white w-10 h-10 rounded-none shadow-xl border border-green-500 flex items-center justify-center relative cursor-pointer active:scale-95 transition-transform ml-auto"
          title="Buka Keranjang Belanja"
        >
          <ShoppingBag className="w-5 h-5" />
          <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white font-mono font-black text-[9px] min-w-[16px] h-4 rounded-none flex items-center justify-center border border-white px-0.5 leading-none">
            {totalItems > 99 ? '99+' : totalItems}
          </span>
        </button>
      ) : (
        <>
          {/* EXPANDED QUICK PREVIEW DRAWER (SEJAJAR DENGAN BAR BAWAH, TIDAK KEPOTONG) */}
          {isExpanded && (
            <div className="w-full mb-1.5 bg-white dark:bg-gray-900 border border-green-300 dark:border-green-800 rounded-none p-2.5 sm:p-3 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150 max-h-[50vh] overflow-y-auto">
              {/* Header Drawer */}
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-1.5 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ShoppingBag className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                  <h4 className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-wider truncate">
                    Keranjang ({totalItems})
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-none shrink-0 cursor-pointer"
                  title="Tutup Pratinjau"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Rincian Per Toko / Kantin */}
              <div className="space-y-2">
                {canteensWithItems.map((cEntry) => {
                  const cId = cEntry.canteen?.id;
                  const cName = cEntry.canteen?.name || 'Kantin';
                  const itemsArr = Object.values(cEntry.items);

                  let canteenSubtotal = 0;
                  itemsArr.forEach((i) => {
                    canteenSubtotal += parseFloat(i.product?.price || 0) * i.quantity;
                  });

                  return (
                    <div
                      key={cId}
                      className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-2 rounded-none text-xs"
                    >
                      {/* Nama Toko & Tombol Hapus */}
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <div className="flex items-center gap-1 font-bold text-[11px] text-emerald-800 dark:text-emerald-300 min-w-0 flex-1">
                          <Store className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate">{cName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => clearCanteen(cId)}
                          className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-0.5 cursor-pointer font-bold shrink-0"
                          title="Kosongkan kantin ini"
                        >
                          <Trash2 className="w-2.5 h-2.5" /> Hapus
                        </button>
                      </div>

                      {/* Daftar Item */}
                      <div className="space-y-1 text-[11px]">
                        {itemsArr.map((it, itIdx) => (
                          <div key={itIdx} className="flex justify-between items-center text-gray-700 dark:text-gray-300 gap-2">
                            <span className="truncate flex-1 min-w-0">
                              <span className="font-bold text-green-700 dark:text-green-400 mr-1 font-mono">
                                {it.quantity}x
                              </span>
                              {it.product?.name}
                            </span>
                            <span className="font-bold font-mono shrink-0 text-gray-900 dark:text-gray-100 text-[10.5px]">
                              Rp {(parseFloat(it.product?.price || 0) * it.quantity).toLocaleString('id-ID')}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Subtotal Toko */}
                      <div className="mt-1.5 pt-1 border-t border-emerald-200 dark:border-emerald-800/60 flex justify-between items-center text-[11px] font-black text-emerald-900 dark:text-emerald-200 font-mono">
                        <span>Subtotal</span>
                        <span>Rp {canteenSubtotal.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total & Checkout */}
              <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                <div className="leading-tight min-w-0 flex-1">
                  <div className="text-[9.5px] text-gray-400">Total Belanja</div>
                  <div className="text-xs sm:text-[13px] font-black text-green-700 dark:text-green-400 font-mono truncate">
                    Rp {grandTotal.toLocaleString('id-ID')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleOpenCart}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-black text-[11px] uppercase tracking-wider flex items-center gap-1 rounded-none shadow-xs cursor-pointer active:scale-95 transition-transform shrink-0"
                >
                  <span>Checkout</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* STRIP MINI HANYA UNTUK VOUCHER YANG BELUM DIKLAIM (HANYA MUNCUL TOMBOL CEK, BUKAN POP-UP) */}
          {unclaimedNudge && !isExpanded && !isVoucherPopupOpen && (
            <div 
              onClick={() => navigate({ to: '/vouchers' })}
              className={`w-full px-2 py-1 text-[9.5px] font-bold flex items-center justify-between gap-1.5 cursor-pointer transition-colors shadow-xs rounded-none border-t border-x ${
                unclaimedNudge.isUnlocked
                  ? 'bg-emerald-950 text-emerald-200 border-emerald-500 hover:bg-emerald-900'
                  : 'bg-amber-950 text-amber-200 border-amber-500 hover:bg-amber-900'
              }`}
              title="Klik untuk melihat dan mengklaim kupon promo"
            >
              <div className="flex items-center gap-1 min-w-0 truncate">
                <span className="shrink-0">{unclaimedNudge.isUnlocked ? '✨' : '🔥'}</span>
                <span className="truncate">{unclaimedNudge.text}</span>
              </div>
              <span className="text-[9px] uppercase tracking-wider font-black shrink-0 px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-none">
                {unclaimedNudge.actionLabel}
              </span>
            </div>
          )}

          {/* FLOATING COMPACT BAR (W-FULL AGAR PRESISI SEJAJAR DENGAN DRAWER DI ATASNYA) */}
          <div className="w-full bg-green-700 hover:bg-green-800 text-white rounded-none shadow-[0_8px_25px_-4px_rgba(21,128,61,0.5)] border border-green-500/80 p-1.5 sm:p-2 flex items-center justify-between gap-1.5 backdrop-blur-md transition-all">
            {/* Area Kiri: Icon, Nama Toko & Total Harga */}
            <div
              onClick={handleOpenCart}
              className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer select-none"
              title="Buka Keranjang Belanja"
            >
              <div className="relative shrink-0 flex items-center justify-center w-7 h-7 bg-white text-green-700 rounded-none shadow-xs">
                <ShoppingBag className="w-3.5 h-3.5" />
                <span className="absolute -top-1 -right-1 bg-red-600 text-white font-mono font-black text-[8.5px] min-w-[15px] h-3.5 rounded-none flex items-center justify-center leading-none border border-white px-0.5">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              </div>

              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[9.5px] font-bold text-green-100 truncate flex items-center gap-1">
                  <span className="truncate">{primaryCanteenName}</span>
                  {isMultipleCanteens && (
                    <span className="text-[8px] bg-green-900/80 px-1 font-bold shrink-0">
                      +{canteensWithItems.length - 1}
                    </span>
                  )}
                </div>
                <div className="text-xs sm:text-[13px] font-black text-white font-mono tracking-tight leading-tight truncate">
                  Rp {grandTotal.toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            {/* Area Kanan: Tombol Rincian & Tombol Minimize */}
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:bg-white/20 text-green-100 hover:text-white rounded-none transition-colors cursor-pointer"
                title={isExpanded ? 'Tutup Rincian' : 'Lihat Rincian'}
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(true);
                }}
                className="p-1 hover:bg-white/20 text-green-100 hover:text-white rounded-none transition-colors cursor-pointer"
                title="Kecilkan jadi ikon keranjang"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
