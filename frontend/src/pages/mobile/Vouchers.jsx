import React, { useState } from 'react';
import { 
  Ticket, 
  Clock, 
  Check, 
  Coins, 
  Store, 
  ChevronLeft, 
  ShoppingBag, 
  Sparkles, 
  AlertCircle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/axios';
import { toast } from 'react-hot-toast';
import { useNavigate } from '@tanstack/react-router';

export default function Vouchers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('available'); // 'available' | 'claimed'

  // 1. Fetch Available Vouchers for user
  const { data: availableVouchers = [], isLoading: loadingAvailable } = useQuery({
    queryKey: ['available_vouchers'],
    queryFn: async () => {
      const res = await api.get('/vouchers');
      return res.data || [];
    }
  });

  // 2. Fetch My Claimed Vouchers
  const { data: myVouchers = [], isLoading: loadingMy } = useQuery({
    queryKey: ['my_vouchers'],
    queryFn: async () => {
      const res = await api.get('/my-vouchers');
      return res.data || [];
    }
  });

  // Mutation Claim Voucher
  const claimMutation = useMutation({
    mutationFn: (id) => api.post(`/vouchers/${id}/claim`),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['available_vouchers']);
      queryClient.invalidateQueries(['my_vouchers']);
      toast.success(res.data?.message || 'Voucher berhasil diklaim!');
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Gagal mengklaim voucher';
      toast.error(msg);
    }
  });

  const getDiscountBadge = (type, amount) => {
    const formatted = `Rp ${parseFloat(amount || 0).toLocaleString('id-ID')}`;
    if (type === 'admin_fee') {
      return (
        <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 font-extrabold px-1.5 py-0.5 text-[10px] uppercase border border-emerald-300 dark:border-emerald-700">
          Bebas Admin {formatted}
        </span>
      );
    }
    if (type === 'delivery_fee') {
      return (
        <span className="bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 font-extrabold px-1.5 py-0.5 text-[10px] uppercase border border-blue-300 dark:border-blue-700">
          Potongan Ongkir {formatted}
        </span>
      );
    }
    return (
      <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 font-extrabold px-1.5 py-0.5 text-[10px] uppercase border border-amber-300 dark:border-amber-700">
        Diskon Belanja {formatted}
      </span>
    );
  };

  return (
    <div className="space-y-2 pb-16 font-sans">
      {/* HEADER COMPACT GOJEK STYLE */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2.5 sm:p-3 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => window.history.length > 1 ? window.history.back() : navigate({ to: '/dashboard' })}
            className="w-8 h-8 flex items-center justify-center border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <div>
            <h1 className="text-sm sm:text-base font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Ticket className="w-4 h-4 text-green-600" />
              Promo & Voucher Santri
            </h1>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Klaim voucher potongan biaya admin dan promo khusus sebelum kedaluwarsa
            </p>
          </div>
        </div>

        {/* TABS (FLAT SHARP) */}
        <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setActiveTab('available')}
            className={`py-1.5 text-xs font-black uppercase tracking-wider text-center border transition-colors ${
              activeTab === 'available'
                ? 'bg-green-600 text-white border-green-600 shadow-xs'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
            }`}
          >
            Voucher Tersedia ({availableVouchers.filter(v => !v.is_claimed).length})
          </button>
          <button
            onClick={() => setActiveTab('claimed')}
            className={`py-1.5 text-xs font-black uppercase tracking-wider text-center border transition-colors ${
              activeTab === 'claimed'
                ? 'bg-green-600 text-white border-green-600 shadow-xs'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
            }`}
          >
            Voucher Saya ({myVouchers.length})
          </button>
        </div>
      </div>

      {/* TAB CONTENT 1: AVAILABLE VOUCHERS */}
      {activeTab === 'available' && (
        <div className="space-y-2">
          {loadingAvailable ? (
            <div className="p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-gray-500">Memeriksa kupon tersedia untuk Anda...</p>
            </div>
          ) : availableVouchers.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <Ticket className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Belum Ada Voucher Baru</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Voucher khusus santri akan muncul di sini saat diterbitkan oleh pondok atau kantin.</p>
            </div>
          ) : (
            availableVouchers.map((v) => {
              const isQuotaFull = v.quota && v.claimed_count >= v.quota;
              return (
                <div
                  key={v.id}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden"
                >
                  {/* Left coupon edge accent */}
                  <div className="absolute top-0 bottom-0 left-0 w-1 bg-green-600" />

                  <div className="min-w-0 pl-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="font-mono font-black text-xs px-2 py-0.5 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 tracking-wider">
                        {v.code}
                      </span>
                      {getDiscountBadge(v.discount_type, v.discount_amount)}
                      {v.canteen ? (
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 border border-gray-200 dark:border-gray-700">
                          {v.canteen.name}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 border border-emerald-200 dark:border-emerald-800">
                          Semua Kantin
                        </span>
                      )}
                      {v.target_type === 'specific' ? (
                        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 border border-amber-300 dark:border-amber-800 flex items-center gap-0.5">
                          ⭐ Khusus Wali Terpilih
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 border border-blue-200 dark:border-blue-800 flex items-center gap-0.5">
                          👥 Semua Wali
                        </span>
                      )}
                    </div>

                    <h3 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white leading-tight">
                      {v.title}
                    </h3>
                    {v.description && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                        {v.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-500" />
                        Berlaku s/d: <strong className="text-gray-700 dark:text-gray-300 font-mono">{new Date(v.valid_until).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                      </span>
                      {v.min_purchase > 0 && (
                        <span>
                          Min. Belanja: <strong className="text-gray-700 dark:text-gray-300 font-mono">Rp {parseFloat(v.min_purchase).toLocaleString('id-ID')}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Claim Button */}
                  <div className="shrink-0 self-end sm:self-center">
                    {v.is_claimed ? (
                      <span className="px-3 py-1.5 bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-800 text-green-700 dark:text-green-300 text-xs font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Sudah Diklaim
                      </span>
                    ) : isQuotaFull ? (
                      <span className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-400 text-xs font-bold">
                        Kuota Habis
                      </span>
                    ) : (
                      <button
                        onClick={() => claimMutation.mutate(v.id)}
                        disabled={claimMutation.isPending}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        {claimMutation.isPending ? 'Mengklaim...' : 'Klaim Sekarang'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB CONTENT 2: MY CLAIMED VOUCHERS */}
      {activeTab === 'claimed' && (
        <div className="space-y-2">
          {loadingMy ? (
            <div className="p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-gray-500">Memuat voucher tersimpan...</p>
            </div>
          ) : myVouchers.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <Ticket className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Belum Ada Voucher Diklaim</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Pindah ke tab "Voucher Tersedia" dan klik klaim untuk menyimpan potongan belanja Anda.</p>
            </div>
          ) : (
            myVouchers.map((uv) => {
              const v = uv.voucher;
              if (!v) return null;
              return (
                <div
                  key={uv.id}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative"
                >
                  <div className="absolute top-0 bottom-0 left-0 w-1 bg-emerald-600" />
                  <div className="min-w-0 pl-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="font-mono font-black text-xs px-2 py-0.5 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 tracking-wider">
                        {v.code}
                      </span>
                      {getDiscountBadge(v.discount_type, v.discount_amount)}
                      {v.target_type === 'specific' ? (
                        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 border border-amber-300 dark:border-amber-800 flex items-center gap-0.5">
                          ⭐ Khusus Wali Terpilih
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 border border-blue-200 dark:border-blue-800 flex items-center gap-0.5">
                          👥 Semua Wali
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 px-1.5 py-0.5 border border-green-200 dark:border-green-800">
                        Siap Digunakan
                      </span>
                    </div>

                    <h3 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white leading-tight">
                      {v.title}
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {v.description || 'Gunakan saat checkout keranjang untuk mendapatkan potongan langsung.'}
                    </p>

                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                      <span>Diklaim: <strong className="text-gray-600 dark:text-gray-300 font-mono">{new Date(uv.claimed_at).toLocaleDateString('id-ID')}</strong></span>
                      <span>Kedaluwarsa: <strong className="text-red-500 font-mono">{new Date(v.valid_until).toLocaleDateString('id-ID')}</strong></span>
                    </div>
                  </div>

                  <div className="shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => navigate({ to: '/dashboard/keranjang' })}
                      className="px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs uppercase tracking-wider shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" /> Pakai di Keranjang
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
