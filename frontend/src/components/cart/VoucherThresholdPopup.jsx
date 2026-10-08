import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, Ticket, ChevronRight, X, ShoppingBag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from '@tanstack/react-router';
import api from '../../lib/axios';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { useVoucherPopupStore } from '../../store/voucherPopupStore';

/**
 * VoucherThresholdPopup
 * 
 * Mendeteksi jika total belanja atau jumlah item santri di keranjang mendekati syarat voucher
 * (misal: syarat belanja Rp 40.000 atau syarat lebih dari 5 item).
 * 
 * Fitur Spesial:
 * - Muncul di posisi bawah layar dengan animasi halus (slide up).
 * - Mendorong floating bar keranjang belanja lebih ke atas agar tidak saling menutupi.
 * - Memiliki timer otomatis 5 detik untuk turun / menutup kembali secara mulus.
 * - Otomatis jeda (pause) hitung mundur jika pengguna mengarahkan kursor/hover.
 */
const DURATION_SECONDS = 10;

export default function VoucherThresholdPopup() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore((state) => state.token);

  const totalItems = useCartStore((state) => state.getTotalItems());
  const totalPrice = useCartStore((state) => state.getTotalPrice());
  const setIsVoucherPopupOpen = useVoucherPopupStore((state) => state.setIsOpen);

  // Ambil daftar voucher yang tersedia
  const { data: vouchers = [] } = useQuery({
    queryKey: ['available_vouchers', token],
    queryFn: async () => {
      const res = await api.get('/vouchers');
      return res.data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const [isMounted, setIsMounted] = useState(false);
  const [isShowing, setIsShowing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS);
  const [isPaused, setIsPaused] = useState(false);
  const [dismissedKey, setDismissedKey] = useState('');

  // HANYA tampilkan pop up voucher di halaman:
  // 1. /kantin atau /dashboard/kantin
  // 2. /kantin/:id atau /dashboard/kantin/:id (misal: /kantin/4)
  // 3. /dashboard/keranjang atau /keranjang
  // Halaman lain (Home, Profil, Pembayaran, Admin, Kurir, Vouchers, dll) TIDAK BOLEH muncul.
  const path = (location.pathname || '').replace(/\/$/, '');
  const isAllowedPage = 
    path === '/kantin' || 
    path === '/dashboard/kantin' ||
    path.startsWith('/kantin/') || 
    path.startsWith('/dashboard/kantin/') ||
    path === '/dashboard/keranjang' || 
    path === '/keranjang';

  // Cari voucher target terdekat berdasarkan nilai belanja atau kuantitas item
  const bestNudge = useMemo(() => {
    if (!isAllowedPage || totalItems === 0 || totalPrice === 0) return null;

    // HANYA CEK VOUCHER YANG SUDAH DIKLAIM DAN DIMILIKI OLEH USER (ADA DI 'VOUCHER SAYA')
    // Jika pengguna belum mengklaim voucher apapun di dompetnya, pop-up TIDAK AKAN PERNAH muncul!
    const claimedVouchers = vouchers
      .filter((v) => v.is_active && v.is_claimed && !v.is_used && !v.is_expired && v.min_purchase && v.min_purchase > 0)
      .sort((a, b) => a.min_purchase - b.min_purchase);

    if (claimedVouchers.length === 0) {
      return null;
    }

    // 1. Cari voucher di dompet yang min_purchase-nya LEBIH BESAR dari totalPrice (hampir tercapai)
    const nextVoucher = claimedVouchers.find((v) => v.min_purchase > totalPrice);

    if (nextVoucher) {
      const gap = nextVoucher.min_purchase - totalPrice;
      const progressPercent = Math.min(100, Math.round((totalPrice / nextVoucher.min_purchase) * 100));
      const discountVal = parseFloat(nextVoucher.discount_amount || 0);
      const discountFormatted = nextVoucher.discount_type === 'percentage' 
        ? `${discountVal}%` 
        : `Rp ${discountVal.toLocaleString('id-ID')}`;

      // Kriteria mendekati: belanja sudah >= 65% atau sisa kurang dari Rp 15.000
      if (progressPercent >= 65 || gap <= 15000) {
        return {
          type: 'amount',
          targetVoucher: nextVoucher,
          isClaimed: true,
          current: totalPrice,
          target: nextVoucher.min_purchase,
          gap: gap,
          percent: progressPercent,
          voucherCode: nextVoucher.code,
          discountText: discountFormatted,
          title: `Kupon Milikmu Siap Dipakai!`,
          message: `Kupon di dompetmu (${nextVoucher.code}) butuh Rp ${gap.toLocaleString('id-ID')} lagi agar bisa langsung dipakai hemat ${discountFormatted}!`,
          statusLabel: '✓ Di Dompet',
          key: `amt_${nextVoucher.id}_${gap}`,
        };
      }
    }

    // 2. Cek apakah ada voucher di dompet santri yang syarat belanjanya sudah terpenuhi
    const unlockedVouchers = claimedVouchers
      .filter((v) => totalPrice >= v.min_purchase)
      .sort((a, b) => b.min_purchase - a.min_purchase);

    if (unlockedVouchers.length > 0) {
      const topVoucher = unlockedVouchers[0];
      const discountVal = parseFloat(topVoucher.discount_amount || 0);
      const discountFormatted = topVoucher.discount_type === 'percentage' 
        ? `${discountVal}%` 
        : `Rp ${discountVal.toLocaleString('id-ID')}`;

      return {
        type: 'unlocked',
        targetVoucher: topVoucher,
        isClaimed: true,
        current: totalPrice,
        target: topVoucher.min_purchase,
        gap: 0,
        percent: 100,
        voucherCode: topVoucher.code,
        discountText: discountFormatted,
        title: `🎉 Kupon Milikmu Siap Dipakai!`,
        message: `Kupon ${topVoucher.code} (${discountFormatted}) siap digunakan saat checkout!`,
        statusLabel: '✓ Siap Pakai',
        key: `unlocked_${topVoucher.id}_clm`,
      };
    }

    return null;
  }, [totalItems, totalPrice, vouchers, isAllowedPage]);

  // Efek muncul otomatis ketika belanja bertambah dan mendekati syarat di halaman yang diizinkan
  useEffect(() => {
    if (!isAllowedPage || !bestNudge) {
      if (isShowing || isMounted) {
        setIsShowing(false);
        setIsVoucherPopupOpen(false);
        const t = setTimeout(() => setIsMounted(false), 300);
        return () => clearTimeout(t);
      }
      return;
    }

    // Munculkan popup jika belum pernah di-dismiss untuk threshold ini
    if (dismissedKey !== bestNudge.key) {
      setIsMounted(true);
      setTimeLeft(DURATION_SECONDS);
      const t = setTimeout(() => {
        setIsShowing(true);
        setIsVoucherPopupOpen(true);
      }, 25);
      return () => clearTimeout(t);
    }
  }, [isAllowedPage, bestNudge, dismissedKey]);

  // Timer 10 detik untuk menutup/menurunkan kembali pop-up voucher
  useEffect(() => {
    if (!isShowing || isPaused) return;

    if (timeLeft <= 0) {
      handleDismiss();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isShowing, isPaused, timeLeft]);

  // Cleanup saat unmount
  useEffect(() => {
    return () => {
      setIsVoucherPopupOpen(false);
    };
  }, [setIsVoucherPopupOpen]);

  const handleDismiss = (e) => {
    if (e) e.stopPropagation();
    setIsShowing(false);
    setIsVoucherPopupOpen(false);
    if (bestNudge) {
      setDismissedKey(bestNudge.key);
    }
    setTimeout(() => {
      setIsMounted(false);
    }, 300);
  };

  const handleAction = () => {
    if (bestNudge?.type === 'unlocked') {
      navigate({ to: token ? '/dashboard/keranjang' : '/keranjang' });
    } else {
      // Arahkan ke daftar menu / kantin untuk tambah belanjaan
      navigate({ to: '/kantin' });
    }
  };

  if (!isAllowedPage || !bestNudge || !isMounted) {
    return null;
  }

  return (
    <div 
      className={`fixed z-[65] transition-all duration-300 ease-out right-2 sm:right-4 bottom-[4.2rem] lg:bottom-4 w-[275px] sm:w-[295px] max-w-[calc(100vw-1rem)] ${
        isShowing 
          ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto' 
          : 'translate-y-8 opacity-0 scale-95 pointer-events-none'
      }`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="alert"
    >
      <div className="bg-gray-950/95 text-white border border-emerald-500 shadow-2xl p-2 sm:p-2.5 backdrop-blur-md rounded-none relative overflow-hidden">
        {/* Visual Bar Hitung Mundur 10 Detik */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gray-800">
          <div 
            className="h-full bg-emerald-400 transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / DURATION_SECONDS) * 100}%` }}
          />
        </div>

        {/* Row 1: Status Pill, Message, Timer Badge, Close Button */}
        <div className="flex items-start justify-between gap-1.5 mb-1 pt-0.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="p-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-none shrink-0">
              <Sparkles className="w-3 h-3" />
            </span>
            <div className="flex items-center gap-1 min-w-0 truncate">
              {bestNudge.statusLabel && (
                <span className={`px-1 py-0.5 text-[8.5px] font-black uppercase tracking-wider rounded-none shrink-0 border ${
                  bestNudge.isClaimed 
                    ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50' 
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {bestNudge.statusLabel}
                </span>
              )}
              <span className="font-extrabold text-[11px] sm:text-xs text-white truncate leading-tight">
                {bestNudge.type === 'amount' 
                  ? `Kurang Rp ${bestNudge.gap.toLocaleString('id-ID')}!`
                  : bestNudge.type === 'items'
                  ? `Tambah ${bestNudge.gap} menu lagi!`
                  : (bestNudge.isClaimed ? `Kupon Siap Digunakan!` : `Diskon Terpenuhi!`)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span 
              className="text-[9px] font-mono font-bold text-gray-400 bg-gray-900 border border-gray-700 px-1 py-0.5 rounded-none leading-none" 
              title={`Otomatis turun dalam ${timeLeft} detik`}
            >
              {timeLeft}s
            </span>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-gray-400 hover:text-white p-0.5 rounded-none cursor-pointer shrink-0 transition-colors"
              title="Tutup Sekarang"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Info Detail Baris Mini */}
        {bestNudge.voucherCode && (
          <div className="text-[10px] text-gray-300 truncate mb-1 flex items-center gap-1">
            <span className="font-mono font-bold text-emerald-400">{bestNudge.voucherCode}</span>
            <span className="text-gray-400">·</span>
            <span>Hemat {bestNudge.discountText}</span>
            {bestNudge.isClaimed && (
              <span className="text-emerald-400 font-semibold text-[9px]">(Di dompet)</span>
            )}
          </div>
        )}

        {/* Row 2: Progress Line Belanja */}
        <div className="w-full bg-gray-800 h-1.5 rounded-none overflow-hidden mb-1.5">
          <div 
            className="bg-emerald-500 h-full transition-all duration-300 rounded-none"
            style={{ width: `${Math.min(100, bestNudge.percent)}%` }}
          />
        </div>

        {/* Row 3: Progress Detail & Action Buttons */}
        <div className="flex items-center justify-between gap-2 text-[9.5px]">
          <span className="font-mono text-gray-400 font-bold shrink-0">
            {bestNudge.type === 'items'
              ? `${bestNudge.current}/${bestNudge.target} menu`
              : `Rp ${bestNudge.current.toLocaleString('id-ID')} / ${bestNudge.target.toLocaleString('id-ID')}`}
            <span className="text-emerald-400 ml-1 font-sans font-semibold">({bestNudge.percent}%)</span>
          </span>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate({ to: '/vouchers' })}
              className="font-bold text-gray-300 hover:text-emerald-400 flex items-center gap-0.5 uppercase tracking-wide cursor-pointer transition-colors"
              title="Lihat semua kupon & promo"
            >
              <Ticket className="w-2.5 h-2.5 text-emerald-400" />
              <span>Kupon</span>
            </button>

            <button
              type="button"
              onClick={handleAction}
              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black uppercase tracking-wider flex items-center gap-0.5 rounded-none cursor-pointer transition-transform active:scale-95"
            >
              {bestNudge.type === 'unlocked' ? (
                <>
                  <ShoppingBag className="w-2.5 h-2.5" />
                  <span>Keranjang</span>
                </>
              ) : (
                <>
                  <span>+ Menu</span>
                  <ChevronRight className="w-2.5 h-2.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
