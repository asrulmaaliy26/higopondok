import React, { useState } from 'react';
import { 
  Ticket, 
  Clock, 
  Check, 
  ChevronLeft, 
  ShoppingBag, 
  LogIn
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/axios';
import { toast } from 'react-hot-toast';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { useAuthStore } from '../../store/authStore';
import PublicBottomNav from '../../components/layout/mobile/PublicBottomNav';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function Vouchers() {
  const navigate = useNavigate();
  const location = useLocation();
  const isInsideDashboard = location.pathname.startsWith('/dashboard');
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState('available'); // 'available' | 'claimed'

  // 1. Fetch Available Vouchers (bisa diakses publik / guest tanpa token)
  const { data: availableVouchers = [], isLoading: loadingAvailable } = useQuery({
    queryKey: ['available_vouchers', token],
    queryFn: async () => {
      const res = await api.get('/vouchers');
      return res.data || [];
    }
  });

  // 2. Fetch My Claimed Vouchers (hanya dijalankan jika user terautentikasi agar tidak memicu 401)
  const { data: myVouchers = [], isLoading: loadingMy } = useQuery({
    queryKey: ['my_vouchers', token],
    queryFn: async () => {
      const res = await api.get('/my-vouchers');
      return res.data || [];
    },
    enabled: !!token
  });

  // Set voucher ID yang sudah diklaim oleh user untuk verifikasi instan
  const claimedVoucherIds = React.useMemo(() => {
    const ids = new Set();
    if (Array.isArray(myVouchers)) {
      myVouchers.forEach(mv => {
        if (mv.voucher_id) ids.add(mv.voucher_id);
        if (mv.voucher?.id) ids.add(mv.voucher.id);
      });
    }
    return ids;
  }, [myVouchers]);

  const unclaimedCount = React.useMemo(() => {
    if (!Array.isArray(availableVouchers)) return 0;
    return availableVouchers.filter(v => !(v.is_claimed || claimedVoucherIds.has(v.id))).length;
  }, [availableVouchers, claimedVoucherIds]);

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

  const handleClaim = (voucherId) => {
    if (!token || !user) {
      toast.error('Silakan masuk / login terlebih dahulu untuk mengklaim voucher!');
      window.location.href = '/login';
      return;
    }
    claimMutation.mutate(voucherId);
  };

  const getDiscountBadge = (type, amount) => {
    const formatted = `Rp ${parseFloat(amount || 0).toLocaleString('id-ID')}`;
    if (type === 'admin_fee') {
      return (
        <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 font-extrabold px-1.5 py-0.5 text-[10px] uppercase border border-emerald-300 dark:border-emerald-700 rounded-none">
          Bebas Admin {formatted}
        </span>
      );
    }
    if (type === 'delivery_fee') {
      return (
        <span className="bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 font-extrabold px-1.5 py-0.5 text-[10px] uppercase border border-blue-300 dark:border-blue-700 rounded-none">
          Potongan Ongkir {formatted}
        </span>
      );
    }
    return (
      <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 font-extrabold px-1.5 py-0.5 text-[10px] uppercase border border-amber-300 dark:border-amber-700 rounded-none">
        Diskon Belanja {formatted}
      </span>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-3 py-2 space-y-2 pb-28 font-sans">
      {/* HEADER COMPACT GOJEK STYLE */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2 sm:p-2.5 shadow-xs rounded-none">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.href = token ? '/dashboard' : '/';
                }
              }}
              className="w-7 h-7 flex items-center justify-center border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors rounded-none cursor-pointer"
              title="Kembali"
            >
              <ChevronLeft className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            </button>
            <div>
              <h1 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-green-600" />
                Promo & Voucher Santri
              </h1>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                Klaim potongan biaya admin, ongkir, dan diskon belanja santri
              </p>
            </div>
          </div>

          {!token && (
            <button
              onClick={() => window.location.href = '/login'}
              className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white font-bold text-[11px] uppercase tracking-wider flex items-center gap-1 rounded-none shrink-0 cursor-pointer shadow-xs"
            >
              <LogIn className="w-3 h-3" />
              <span>Masuk</span>
            </button>
          )}
        </div>

        {/* TABS (FLAT SHARP) */}
        <div className="grid grid-cols-2 gap-1 pt-1.5 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setActiveTab('available')}
            className={`py-1.5 text-xs font-black uppercase tracking-wider text-center border transition-colors rounded-none cursor-pointer ${
              activeTab === 'available'
                ? 'bg-green-600 text-white border-green-600 shadow-xs'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
            }`}
          >
            Voucher Tersedia ({unclaimedCount})
          </button>
          <button
            onClick={() => setActiveTab('claimed')}
            className={`py-1.5 text-xs font-black uppercase tracking-wider text-center border transition-colors rounded-none cursor-pointer ${
              activeTab === 'claimed'
                ? 'bg-green-600 text-white border-green-600 shadow-xs'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
            }`}
          >
            Voucher Saya ({token ? myVouchers.length : 0})
          </button>
        </div>
      </div>

      {/* GUEST BANNER */}
      {!token && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 p-2 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2 rounded-none shadow-xs">
          <div className="flex items-center gap-1.5">
            <Ticket className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="text-[10.5px] sm:text-xs">Masuk ke akun untuk mengklaim dan menikmati potongan belanja.</span>
          </div>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10.5px] font-bold uppercase rounded-none whitespace-nowrap cursor-pointer shrink-0"
          >
            Masuk
          </button>
        </div>
      )}

      {/* TAB CONTENT 1: AVAILABLE VOUCHERS */}
      {activeTab === 'available' && (
        <div>
          {loadingAvailable ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none">
              <LoadingSpinner 
                text="Memeriksa voucher yang tersedia..." 
                subtext="Menghubungkan ke pusat kupon pondok" 
                minHeight="min-h-[180px]"
              />
            </div>
          ) : availableVouchers.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none">
              <Ticket className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Belum Ada Voucher Baru</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Voucher khusus santri akan muncul di sini saat diterbitkan oleh pondok atau kantin.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {availableVouchers.map((v) => {
                const isClaimedByUser = Boolean(v.is_claimed || claimedVoucherIds.has(v.id));
                const isQuotaFull = v.quota && v.claimed_count >= v.quota;
                return (
                  <div
                    key={v.id}
                    className={`p-2.5 sm:p-3 shadow-xs relative overflow-hidden rounded-none flex flex-col justify-between transition-colors ${
                      isClaimedByUser
                        ? 'bg-emerald-50/20 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800'
                        : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    {/* Left coupon edge accent */}
                    <div className={`absolute top-0 bottom-0 left-0 w-1 ${isClaimedByUser ? 'bg-emerald-500' : 'bg-green-600'}`} />

                    <div>
                      {/* Top Badges Row */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-1.5 pl-1.5">
                        <span className="font-mono font-black text-[11px] px-1.5 py-0.5 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 tracking-wider rounded-none">
                          {v.code}
                        </span>
                        {getDiscountBadge(v.discount_type, v.discount_amount)}
                        {v.canteen ? (
                          <span className="text-[9.5px] font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 border border-gray-200 dark:border-gray-700 rounded-none truncate max-w-[130px]">
                            {v.canteen.name}
                          </span>
                        ) : (
                          <span className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 border border-emerald-200 dark:border-emerald-800 rounded-none">
                            Semua Kantin
                          </span>
                        )}
                        {v.target_type === 'specific' ? (
                          <span className="text-[9.5px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 border border-amber-300 dark:border-amber-800 flex items-center gap-0.5 rounded-none">
                            ⭐ Khusus
                          </span>
                        ) : (
                          <span className="text-[9.5px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 border border-blue-200 dark:border-blue-800 flex items-center gap-0.5 rounded-none">
                            👥 Semua Santri
                          </span>
                        )}
                        {isClaimedByUser && (
                          <span className="text-[9.5px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950 px-1.5 py-0.5 border border-emerald-300 dark:border-emerald-700 rounded-none flex items-center gap-0.5">
                            <Check className="w-3 h-3 stroke-[3]" /> Tersimpan
                          </span>
                        )}
                      </div>

                      {/* Main Content & Action Row */}
                      <div className="flex items-center justify-between gap-3 pl-1.5">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white leading-snug line-clamp-1">
                            {v.title}
                          </h3>
                          {v.description && (
                            <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1 leading-tight">
                              {v.description}
                            </p>
                          )}

                          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 mt-1 text-[9.5px] text-gray-400 font-medium">
                            <span className="flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                              s/d <strong className="text-gray-700 dark:text-gray-300 font-mono">{new Date(v.valid_until).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</strong>
                            </span>
                            {v.min_purchase > 0 && (
                              <span>
                                Min. <strong className="text-gray-700 dark:text-gray-300 font-mono">Rp {parseFloat(v.min_purchase).toLocaleString('id-ID')}</strong>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Button: Beda Tampilan Jelas Antara Sudah Klaim vs Belum Klaim */}
                        <div className="shrink-0 self-center">
                          {isClaimedByUser ? (
                            <div className="flex flex-col items-end gap-1">
                              <div className="px-3 py-1.5 bg-emerald-100/90 dark:bg-emerald-950/80 border border-emerald-500 dark:border-emerald-600 text-emerald-800 dark:text-emerald-200 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 rounded-none shadow-2xs">
                                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                                <span>Sudah Diklaim</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => navigate({ to: token ? '/dashboard/keranjang' : '/keranjang' })}
                                className="text-[10.5px] font-bold text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 hover:underline uppercase tracking-wider flex items-center gap-0.5 cursor-pointer"
                              >
                                Gunakan →
                              </button>
                            </div>
                          ) : isQuotaFull ? (
                            <span className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-400 text-xs font-bold uppercase tracking-wider rounded-none whitespace-nowrap">
                              Habis
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleClaim(v.id)}
                              disabled={claimMutation.isPending}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 active:bg-green-800 active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer rounded-none whitespace-nowrap"
                            >
                              <Ticket className="w-3.5 h-3.5" />
                              <span>{claimMutation.isPending ? 'Klaim...' : 'Klaim'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: MY CLAIMED VOUCHERS */}
      {activeTab === 'claimed' && (
        <div>
          {!token ? (
            <div className="p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none shadow-xs">
              <Ticket className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Belum Masuk Akun</p>
              <p className="text-[11px] text-gray-500 mt-1 mb-4">
                Masuk / Login terlebih dahulu untuk melihat daftar voucher yang telah Anda klaim.
              </p>
              <button
                onClick={() => window.location.href = '/login'}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs uppercase tracking-wider cursor-pointer rounded-none shadow-xs"
              >
                Masuk Sekarang
              </button>
            </div>
          ) : loadingMy ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none">
              <LoadingSpinner 
                text="Memuat voucher tersimpan..." 
                subtext="Mengambil koleksi voucher Anda" 
                minHeight="min-h-[180px]"
              />
            </div>
          ) : myVouchers.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none">
              <Ticket className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Belum Ada Voucher Diklaim</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Pindah ke tab "Voucher Tersedia" dan klik klaim untuk menyimpan potongan belanja Anda.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {myVouchers.map((uv) => {
                const v = uv.voucher;
                if (!v) return null;
                return (
                  <div
                    key={uv.id}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2.5 sm:p-3 shadow-xs relative overflow-hidden rounded-none flex flex-col justify-between"
                  >
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-emerald-600" />
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap mb-1.5 pl-1.5">
                        <span className="font-mono font-black text-[11px] px-1.5 py-0.5 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 tracking-wider rounded-none">
                          {v.code}
                        </span>
                        {getDiscountBadge(v.discount_type, v.discount_amount)}
                        {v.target_type === 'specific' ? (
                          <span className="text-[9.5px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 border border-amber-300 dark:border-amber-800 flex items-center gap-0.5 rounded-none">
                            ⭐ Khusus
                          </span>
                        ) : (
                          <span className="text-[9.5px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 border border-blue-200 dark:border-blue-800 flex items-center gap-0.5 rounded-none">
                            👥 Umum
                          </span>
                        )}
                        <span className="text-[9.5px] font-bold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 px-1.5 py-0.5 border border-green-200 dark:border-green-800 rounded-none">
                          Siap Digunakan
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3 pl-1.5">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white leading-snug line-clamp-1">
                            {v.title}
                          </h3>
                          <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1 leading-tight">
                            {v.description || 'Gunakan saat checkout keranjang untuk potongan langsung.'}
                          </p>

                          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 mt-1 text-[9.5px] text-gray-400 font-medium">
                            <span>Klaim: <strong className="text-gray-600 dark:text-gray-300 font-mono">{new Date(uv.claimed_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</strong></span>
                            <span>Exp: <strong className="text-red-500 font-mono">{new Date(v.valid_until).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</strong></span>
                          </div>
                        </div>

                        <div className="shrink-0 self-center">
                          <button
                            onClick={() => navigate({ to: token ? '/dashboard/keranjang' : '/keranjang' })}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 active:scale-95 text-white font-bold text-xs uppercase tracking-wider shadow-xs flex items-center gap-1.5 cursor-pointer rounded-none whitespace-nowrap"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" /> Gunakan
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!isInsideDashboard && <PublicBottomNav />}
    </div>
  );
}
