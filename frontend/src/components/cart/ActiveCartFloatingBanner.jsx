import React, { useState } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { ShoppingBag, ArrowRight, Store, ChevronUp, ChevronDown, Trash2, X } from 'lucide-react';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { getUserRole, ROLES } from '../../config/roles';

export default function ActiveCartFloatingBanner() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const role = getUserRole(user);

  const cart = useCartStore((state) => state.cart);
  const getTotalItems = useCartStore((state) => state.getTotalItems);
  const clearCanteen = useCartStore((state) => state.clearCanteen);

  const [isExpanded, setIsExpanded] = useState(false);

  // Jangan tampilkan jika di dalam halaman Detail Kantin, Keranjang, Profil, atau Buku Panduan
  const isKantinDetailPage = Boolean(location.pathname.match(/^\/(dashboard\/)?kantin\/\d+$/));
  const isKeranjangPage = location.pathname === '/keranjang' || location.pathname === '/dashboard/keranjang';
  const isProfilePage = location.pathname === '/dashboard/profile' || location.pathname === '/profile';
  const isPanduanPage = location.pathname.includes('panduan');
  
  if ((role && role !== ROLES.USER) || isKantinDetailPage || isKeranjangPage || isProfilePage || isPanduanPage) {
    return null;
  }

  const totalItems = getTotalItems();
  const canteensWithItems = Object.values(cart).filter(
    (c) => c && c.items && Object.keys(c.items).length > 0
  );

  if (totalItems === 0 || canteensWithItems.length === 0) {
    return null;
  }

  // Hitung total harga keseluruhan
  let grandTotal = 0;
  canteensWithItems.forEach((c) => {
    Object.values(c.items).forEach((item) => {
      const price = parseFloat(item.product?.price || 0);
      grandTotal += price * item.quantity;
    });
  });

  // Ambil kantin pertama untuk ringkasan
  const primaryCanteen = canteensWithItems[0];
  const primaryCanteenName = primaryCanteen.canteen?.name || 'Kantin';
  const isMultipleCanteens = canteensWithItems.length > 1;

  // Ringkasan item string
  const primaryItemsList = Object.values(primaryCanteen.items)
    .map((i) => `${i.quantity}x ${i.product?.name || 'Menu'}`)
    .join(', ');

  return (
    <div className="fixed z-40 transition-all duration-300 ease-out left-2 right-2 bottom-[4.25rem] lg:bottom-4 lg:left-auto lg:right-6 lg:max-w-md w-auto">
      {/* EXPANDED QUICK PREVIEW DRAWER */}
      {isExpanded && (
        <div className="mb-1.5 bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800 rounded-none p-3 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2 mb-2.5">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-green-600 dark:text-green-400" />
              <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Isi Keranjang ({totalItems} Menu)
              </h4>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
              title="Tutup Pratinjau"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3.5">
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
                  className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-800 dark:text-emerald-300">
                      <Store className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate max-w-[180px]">{cName}</span>
                    </div>
                    <button
                      onClick={() => clearCanteen(cId)}
                      className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-0.5"
                      title="Kosongkan keranjang toko ini"
                    >
                      <Trash2 className="w-3 h-3" /> Hapus
                    </button>
                  </div>

                  <div className="space-y-1.5 pl-1 text-xs">
                    {itemsArr.map((it, itIdx) => (
                      <div key={itIdx} className="flex justify-between items-start text-gray-700 dark:text-gray-300">
                        <span className="truncate pr-2">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400 mr-1.5">
                            {it.quantity}x
                          </span>
                          {it.product?.name}
                        </span>
                        <span className="font-medium shrink-0 text-gray-900 dark:text-gray-100">
                          Rp {(parseFloat(it.product?.price || 0) * it.quantity).toLocaleString('id-ID')}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 pt-2 border-t border-emerald-200/50 dark:border-emerald-800/40 flex justify-between items-center text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    <span>Subtotal</span>
                    <span>Rp {canteenSubtotal.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FLOATING MAIN BAR */}
      <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 dark:from-emerald-700 dark:via-green-700 dark:to-emerald-800 text-white rounded-none shadow-[0_10px_30px_-5px_rgba(5,150,105,0.4)] border border-emerald-400/40 dark:border-emerald-600/50 p-3 sm:p-3.5 flex items-center justify-between gap-3 backdrop-blur-md">
        {/* Sisi Kiri: Badge Toko & Ringkasan Menu */}
        <div
          className="flex-1 min-w-0 cursor-pointer select-none"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2 mb-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 dark:bg-black/25 rounded-none text-[10px] sm:text-xs font-extrabold tracking-wide uppercase">
              <Store className="w-3 h-3 text-emerald-100" />
              <span className="truncate max-w-[130px] sm:max-w-[170px]">
                {primaryCanteenName}
              </span>
              {isMultipleCanteens && (
                <span className="text-[9px] bg-emerald-900/60 px-1 py-0.2 rounded-none font-bold">
                  +{canteensWithItems.length - 1} Toko
                </span>
              )}
            </span>

            <span className="text-[11px] sm:text-xs font-medium text-emerald-100 flex items-center gap-1">
              • {totalItems} item
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-emerald-200" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5 text-emerald-200" />
              )}
            </span>
          </div>

          <p className="text-xs sm:text-[13px] font-semibold text-white truncate drop-shadow-xs">
            {primaryItemsList}
          </p>
        </div>

        {/* Sisi Kanan: Total Harga & Tombol Buka Keranjang */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right hidden xs:block">
            <p className="text-[10px] text-emerald-100 font-medium leading-none">Total</p>
            <p className="text-sm font-extrabold text-white leading-tight">
              Rp {grandTotal.toLocaleString('id-ID')}
            </p>
          </div>

          <Link
            to="/keranjang"
            className="flex items-center gap-1.5 bg-white text-green-800 hover:bg-green-50 active:scale-95 px-3 py-1.5 rounded-none text-xs font-bold shadow-md transition-transform"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-green-700" />
            <span>Keranjang</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
