import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShoppingCart, Trash2, Plus, Minus, Store, ChevronRight, ChevronLeft, MapPin, AlertCircle, LogIn, X, Ticket, Check, Sparkles, Search, ChevronDown, User, Phone, Home, GraduationCap, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/axios';
import { getStorageUrl } from '../../lib/axios';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { calculateOrderFees } from '../../config/pricing';
import { ROLES, getUserRole } from '../../config/roles';
import AppImage from '../../components/common/AppImage';
import santriData from '../../data/santri.json';

const uniqueJenjang = [...new Set(santriData.data.filter(r => r.length > 5 && r[4]).map(r => r[4]))].sort();

export default function Keranjang() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);
  const { cart, addItem, removeItem, incrementItem, clearCanteen, clearAll, updateItemNote } = useCartStore();

  const [orderFor, setOrderFor] = useState(user?.is_teacher ? 'guru' : 'santri');
  const [deliveryLocation, setDeliveryLocation] = useState(() => {
    if (user?.is_teacher) {
      return `Ruang Guru / Kantor ${user?.teacher_unit || 'Yayasan'}`;
    }
    return user?.santri_room || '';
  });

  // Validasi apakah akun guru sudah memiliki data santri di profil
  const hasSantriProfile = Boolean(
    user?.santri_name && 
    user?.santri_room && 
    user?.santri_room !== 'Kamar Santri Pondok' &&
    user?.santri_room.trim() !== ''
  );

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [santriSearch, setSantriSearch] = useState('');
  const [isSantriOpen, setIsSantriOpen] = useState(false);
  const [filterGender, setFilterGender] = useState('');
  const santriDropdownRef = React.useRef(null);

  const [profileFormData, setProfileFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    santri_name: user?.santri_name || '',
    santri_room: user?.santri_room || '',
    santri_class: user?.santri_class || '',
    santri_level: user?.santri_level || '',
    niy: user?.niy || '',
    teacher_unit: user?.teacher_unit || ''
  });

  React.useEffect(() => {
    if (user) {
      setProfileFormData({
        name: user?.name || '',
        phone: user?.phone || '',
        santri_name: user?.santri_name || '',
        santri_room: user?.santri_room || '',
        santri_class: user?.santri_class || '',
        santri_level: user?.santri_level || '',
        niy: user?.niy || '',
        teacher_unit: user?.teacher_unit || ''
      });
    }
  }, [user]);

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (santriDropdownRef.current && !santriDropdownRef.current.contains(event.target)) {
        setIsSantriOpen(false);
      }
    }
    if (isSantriOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isSantriOpen]);

  const availableKelas = React.useMemo(() => {
    if (!profileFormData.santri_level) {
      return [...new Set(santriData.data.filter(r => r.length > 5 && r[5]).map(r => r[5]))].sort();
    }
    return [...new Set(santriData.data.filter(r => r.length > 5 && r[4] === profileFormData.santri_level && r[5]).map(r => r[5]))].sort();
  }, [profileFormData.santri_level]);

  const filteredSantris = React.useMemo(() => {
    return santriData.data.filter(row => {
      if (row.length < 6) return false;
      const nameCol = row[1] || '';
      const jenjang = row[4] || '';
      const kelas = row[5] || '';
      
      let matchJenjang = profileFormData.santri_level ? jenjang === profileFormData.santri_level : true;
      let matchKelas = profileFormData.santri_class ? kelas === profileFormData.santri_class : true;
      let matchGender = true;
      if (filterGender) {
        matchGender = nameCol.endsWith(filterGender);
      }
      let matchSearch = true;
      if (santriSearch.trim()) {
        const q = santriSearch.toLowerCase().trim();
        const cleanName = nameCol.replace(' Laki-laki', '').replace(' Perempuan', '').toLowerCase();
        matchSearch = cleanName.includes(q);
      }
      return matchJenjang && matchKelas && matchGender && matchSearch;
    });
  }, [profileFormData.santri_level, profileFormData.santri_class, filterGender, santriSearch]);

  const handleToggleOrderFor = (target) => {
    // Jika guru ingin memesan untuk santri tapi belum isi profil santri, langsung buka modal form di layar checkout
    if (target === 'santri' && user?.is_teacher) {
      if (!hasSantriProfile) {
        setOrderFor('santri');
        setShowProfileModal(true);
        toast('Silakan lengkapi data santri untuk pengiriman.', { icon: '📝' });
        return;
      }
    }

    setOrderFor(target);
    if (target === 'guru') {
      setDeliveryLocation(`Ruang Guru / Kantor ${user?.teacher_unit || 'Yayasan'}`);
    } else {
      setDeliveryLocation(user?.santri_room || '');
    }
  };
  const [canteenNotes, setCanteenNotes] = useState({}); // canteenId -> general note
  const [isProcessing, setIsProcessing] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [showVoucherDrawer, setShowVoucherDrawer] = useState(false);

  const handleGoToPromoVoucher = () => {
    setShowVoucherDrawer(false);
    const role = getUserRole(user);
    if (role === ROLES.SUPER_ADMIN) {
      navigate({ to: '/dashboard/admin/vouchers' });
    } else if (role === ROLES.KANTIN || role === ROLES.ADMIN) {
      navigate({ to: '/dashboard/toko-saya/promo' });
    } else {
      navigate({ to: token ? '/dashboard/vouchers' : '/vouchers' });
    }
  };

  // Fetch claimed vouchers
  const { data: myVouchers = [] } = useQuery({
    queryKey: ['my_vouchers'],
    queryFn: async () => {
      const res = await api.get('/my-vouchers');
      return res.data || [];
    },
    enabled: !!token
  });

  // Fetch available public/active vouchers for dynamic motivation banner
  const { data: availableVouchers = [] } = useQuery({
    queryKey: ['available_vouchers', token],
    queryFn: async () => {
      const res = await api.get('/vouchers');
      return res.data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const canteenEntries = Object.entries(cart); // [[canteenId, { canteen, items }], ...]

  const totalItems = canteenEntries.reduce(
    (sum, [, c]) => sum + Object.values(c.items).reduce((s, i) => s + i.quantity, 0), 0
  );

  // Calculate per-canteen totals based on category
  const canteenSummaries = canteenEntries.map(([canteenId, { canteen, items }]) => {
    const itemList = Object.entries(items).map(([itemKey, itemData]) => ({
      ...itemData,
      itemKey
    }));
    const subtotal = itemList.reduce((s, i) => s + parseFloat(i.product.price) * i.quantity, 0);
    const qty = itemList.reduce((s, i) => s + i.quantity, 0);
    
    // Perhitungan Terpusat (Opsi B: Ongkir Rp 3.000 + Admin Rp 2.000)
    const feeDetails = calculateOrderFees(qty, 1, true);
    const { deliveryFee, adminFee, extraBlocks, extraCourierFee, extraAdminFee } = feeDetails;

    const total = subtotal + deliveryFee + adminFee;
    return { canteenId, canteen, itemList, subtotal, deliveryFee, adminFee, total, qty, extraBlocks, extraCourierFee, extraAdminFee };
  });

  const totalSubtotal = canteenSummaries.reduce((s, c) => s + c.subtotal, 0);
  const totalDeliveryFee = canteenSummaries.reduce((s, c) => s + c.deliveryFee, 0);
  const totalAdminFee = canteenSummaries.reduce((s, c) => s + c.adminFee, 0);
  const rawGrandTotal = canteenSummaries.reduce((s, c) => s + c.total, 0);

  // Voucher calculation
  let voucherDiscount = 0;
  if (selectedVoucher) {
    const discType = selectedVoucher.discount_type;
    const discAmt = parseFloat(selectedVoucher.discount_amount || 0);
    if (discType === 'admin_fee') {
      voucherDiscount = Math.min(totalAdminFee, discAmt);
    } else if (discType === 'delivery_fee') {
      voucherDiscount = Math.min(totalDeliveryFee, discAmt);
    } else {
      voucherDiscount = Math.min(totalSubtotal, discAmt);
    }
  }

  const grandTotal = Math.max(0, rawGrandTotal - voucherDiscount);

  // Dynamic Voucher Nudge & Threshold Calculation (Hanya tampil jika ada voucher riil di database)
  const voucherNudge = useMemo(() => {
    if (totalSubtotal <= 0) return null;

    // Kumpulkan semua voucher aktif yang valid (baik dari myVouchers maupun availableVouchers)
    const combinedVouchers = [];
    const seenIds = new Set();

    (myVouchers || []).forEach((uv) => {
      const v = uv.voucher;
      if (v && v.is_active && !seenIds.has(v.id)) {
        seenIds.add(v.id);
        combinedVouchers.push({ ...v, is_claimed: true });
      }
    });

    (availableVouchers || []).forEach((v) => {
      if (v && v.is_active && !v.is_expired && !v.is_used && !seenIds.has(v.id)) {
        seenIds.add(v.id);
        combinedVouchers.push(v);
      }
    });

    // Filter hanya voucher yang cocok dengan toko di keranjang
    const validVouchers = combinedVouchers.filter((v) => {
      if (v.canteen_id && !canteenSummaries.some((c) => c.canteen.id === v.canteen_id)) {
        return false;
      }
      return true;
    });

    if (validVouchers.length === 0) return null;

    // 1. Cek apakah ada voucher dengan min_purchase yang BELUM tercapai tapi hampir tercapai (>= 50% atau kurang <= 25rb)
    const pendingWithMin = validVouchers
      .filter((v) => {
        const minP = parseFloat(v.min_purchase || 0);
        return minP > 0 && totalSubtotal < minP;
      })
      .sort((a, b) => parseFloat(a.min_purchase) - parseFloat(b.min_purchase));

    if (pendingWithMin.length > 0) {
      const nextVoucher = pendingWithMin[0];
      const minP = parseFloat(nextVoucher.min_purchase);
      const gap = minP - totalSubtotal;
      const progressPercent = Math.min(100, Math.round((totalSubtotal / minP) * 100));

      if (progressPercent >= 50 || gap <= 25000) {
        const discAmt = parseFloat(nextVoucher.discount_amount || 0);
        const discText = nextVoucher.discount_type === 'admin_fee'
          ? `Diskon Admin Rp ${discAmt.toLocaleString('id-ID')}`
          : nextVoucher.discount_type === 'delivery_fee'
          ? `Diskon Ongkir Rp ${discAmt.toLocaleString('id-ID')}`
          : `Diskon Rp ${discAmt.toLocaleString('id-ID')}`;

        return {
          type: 'progress',
          voucher: nextVoucher,
          gap,
          minP,
          progressPercent,
          discText,
          title: `Dikit Lagi Dapat ${discText}!`,
          desc: `Tambah belanja Rp ${gap.toLocaleString('id-ID')} lagi untuk mengaktifkan voucher "${nextVoucher.title || nextVoucher.code}" (Min. Belanja Rp ${minP.toLocaleString('id-ID')}).`
        };
      }
    }

    // 2. Cek apakah ada voucher dengan min_purchase yang SUDAH memenuhi syarat (totalSubtotal >= min_purchase)
    // dan user belum memilih voucher
    if (!selectedVoucher) {
      const qualifiedVouchers = validVouchers
        .filter((v) => {
          const minP = parseFloat(v.min_purchase || 0);
          return minP > 0 && totalSubtotal >= minP;
        })
        .sort((a, b) => parseFloat(b.discount_amount || 0) - parseFloat(a.discount_amount || 0));

      if (qualifiedVouchers.length > 0) {
        const bestVoucher = qualifiedVouchers[0];
        const discAmt = parseFloat(bestVoucher.discount_amount || 0);
        const discText = bestVoucher.discount_type === 'admin_fee'
          ? `potongan biaya admin Rp ${discAmt.toLocaleString('id-ID')}`
          : bestVoucher.discount_type === 'delivery_fee'
          ? `potongan ongkir Rp ${discAmt.toLocaleString('id-ID')}`
          : `potongan belanja Rp ${discAmt.toLocaleString('id-ID')}`;

        return {
          type: 'qualified',
          voucher: bestVoucher,
          discText,
          title: `🎉 Belanja Memenuhi Syarat Voucher!`,
          desc: `Kamu berhak menggunakan voucher "${bestVoucher.title || bestVoucher.code}" dengan ${discText}.`
        };
      }
    }

    return null;
  }, [totalSubtotal, myVouchers, availableVouchers, canteenSummaries, selectedVoucher]);

  const finalLocation = deliveryLocation.trim();

  // Eksekusi pesanan ke backend API
  const executeOrderCheckout = async (loc, activeUser = user) => {
    const locFinal = (loc || deliveryLocation || '').trim();
    if (!locFinal) {
      toast.error('Silakan pilih atau ketik lokasi pengiriman Anda terlebih dahulu sebelum Checkout.');
      return;
    }

    // Validasi Toko Tutup (Wali tidak bisa membuat pesanan ketika toko tutup)
    const closedCanteens = canteenSummaries.filter(({ canteen }) => !canteen.is_open);
    if (closedCanteens.length > 0) {
      const names = closedCanteens.map(({ canteen }) => canteen.name).join(', ');
      toast.error(`Maaf, toko (${names}) saat ini sedang tutup. Pemesanan tidak dapat diproses di luar jam buka toko.`);
      return;
    }

    setIsProcessing(true);

    try {
      const payload = {
        delivery_location: locFinal,
        order_for: orderFor,
        voucher_id: selectedVoucher ? selectedVoucher.id : null,
        canteens: canteenSummaries.map(({ canteen, itemList }) => ({
          canteen_id: canteen.id,
          custom_notes: canteenNotes[canteen.id] || '',
          items: itemList.map(i => {
            const variantNote = (i.options && i.options.length > 0) ? `[${i.options.join(' | ')}]` : '';
            let userNote = (i.notes || '').trim();
            // Cegah duplikasi jika userNote sudah diawali atau memuat variantNote yang sama
            if (variantNote && userNote.startsWith(variantNote)) {
              userNote = userNote.slice(variantNote.length).replace(/^(\s*•\s*)+/, '').trim();
            }
            const parts = [variantNote, userNote].filter(Boolean);
            const combinedNotes = Array.from(new Set(parts)).join(' • ');
            return {
              product_id: i.product.id,
              quantity: i.quantity,
              extra_price: i.extraPrice || 0,
              notes: combinedNotes || null
            };
          })
        }))
      };

      const res = await api.post('/orders/batch', payload);

      // Kosongkan keranjang untuk toko-toko yang berhasil dipesan
      for (const { canteen } of canteenSummaries) {
        clearCanteen(canteen.id);
      }

      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['user_orders'] });
      toast.success(res.data?.message || 'Pesanan berhasil dibuat!');
      navigate({ to: '/dashboard/pembayaran' });
    } catch (err) {
      const errorDetail = err.response?.data?.error;
      const errorMessage = err.response?.data?.message;
      toast.error(errorDetail || errorMessage || 'Gagal membuat pesanan. Silakan coba lagi.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckoutAll = async () => {
    // 1. Validasi login
    if (!token || !user) {
      setShowLoginModal(true);
      return;
    }

    // 2. Validasi profil — jika data belum lengkap, buka form modal popup langsung di sini (tanpa keluar halaman)
    if (user?.is_teacher && orderFor === 'guru') {
      if (!user?.phone || !user?.niy || !user?.teacher_unit) {
        setShowProfileModal(true);
        return;
      }
    } else {
      if (!user?.phone || !user?.santri_name || !user?.santri_room || !user?.santri_class || !user?.santri_level) {
        setShowProfileModal(true);
        return;
      }
    }

    await executeOrderCheckout(finalLocation, user);
  };

  // Simpan profil langsung dari modal di keranjang lalu otomatis checkout
  const handleSaveProfileAndCheckout = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    let p = (profileFormData.phone || '').trim().replace(/\D/g, '');
    if (p.startsWith('62')) p = p.substring(2);
    if (p.startsWith('0')) p = p.substring(1);

    if (!p || p.length < 8) {
      toast.error('Silakan isi nomor WhatsApp aktif yang valid.');
      return;
    }
    const finalPhone = '62' + p;

    const isOrderingForTeacher = user?.is_teacher && orderFor === 'guru';
    if (!isOrderingForTeacher) {
      if (!profileFormData.santri_name?.trim()) {
        toast.error('Silakan pilih nama santri.');
        return;
      }
      if (!profileFormData.santri_room?.trim()) {
        toast.error('Silakan isi nama asrama / kamar santri.');
        return;
      }
      if (!profileFormData.santri_level) {
        toast.error('Silakan pilih jenjang pendidikan santri.');
        return;
      }
      if (!profileFormData.santri_class) {
        toast.error('Silakan pilih kelas santri.');
        return;
      }
    }

    setIsSavingProfile(true);

    try {
      const formData = new FormData();
      formData.append('_method', 'PUT');
      if (profileFormData.name && profileFormData.name.trim()) {
        formData.append('name', profileFormData.name.trim());
      }
      formData.append('phone', finalPhone);

      if (!isOrderingForTeacher) {
        formData.append('santri_name', profileFormData.santri_name.trim());
        formData.append('santri_room', profileFormData.santri_room.trim());
        formData.append('santri_class', profileFormData.santri_class);
        formData.append('santri_level', profileFormData.santri_level);
      }

      const res = await api.post('/me', formData);
      const updatedUser = res.data.user;
      setUser(updatedUser);
      toast.success('Profil pengiriman berhasil disimpan!');
      setShowProfileModal(false);

      const targetLoc = isOrderingForTeacher
        ? `Ruang Guru / Kantor ${updatedUser?.teacher_unit || 'Yayasan'}`
        : (updatedUser?.santri_room || profileFormData.santri_room.trim());

      setDeliveryLocation(targetLoc);

      // Otomatis lanjutkan proses checkout langsung tanpa perlu klik ulang!
      await executeOrderCheckout(targetLoc, updatedUser);
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan profil pengiriman.';
      toast.error(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (canteenEntries.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        {/* Header with back button */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-4 flex items-center gap-3 sticky top-0 z-20">
          <button
            onClick={() => window.history.length > 1 ? window.history.back() : navigate({ to: token ? '/dashboard/kantin' : '/kantin' })}
            className="w-8 h-8 flex items-center justify-center rounded-none border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <h1 className="text-base font-bold text-gray-900 dark:text-white">Keranjang Belanja</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-20 h-20 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-none flex items-center justify-center mb-5">
            <ShoppingCart className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">Keranjang Masih Kosong</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-xs max-w-xs">Tambahkan jajanan atau menu favoritmu dari berbagai kantin pondok Al-Mannan.</p>
          <button
            onClick={() => window.history.length > 1 ? window.history.back() : navigate({ to: '/' })}
            className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-2.5 rounded-none text-xs uppercase tracking-wider shadow-sm transition-colors"
          >
            Jelajahi Menu Kantin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-32">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.history.length > 1 ? window.history.back() : navigate({ to: token ? '/dashboard/kantin' : '/kantin' })}
            className="w-8 h-8 flex items-center justify-center rounded-none border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <ShoppingCart className="w-5 h-5 text-green-600" />
          <h1 className="text-base font-bold text-gray-900 dark:text-white">
            Keranjang <span className="text-green-600 font-mono">({totalItems})</span>
          </h1>
        </div>
        <button
          onClick={() => { if (window.confirm('Kosongkan semua keranjang?')) clearAll(); }}
          className="text-xs text-red-500 font-semibold flex items-center gap-1 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4" /> Kosongkan
        </button>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-2xl mx-auto">

        {/* Per-canteen groups */}
        {canteenSummaries.map(({ canteenId, canteen, itemList, subtotal, deliveryFee, adminFee, total, qty, extraBlocks, extraCourierFee, extraAdminFee }) => (
          <div key={canteenId} className="bg-white dark:bg-gray-900 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
            {/* Canteen header */}
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50/70 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-green-100 dark:bg-green-950/60 border border-green-200 dark:border-green-800 rounded-none flex items-center justify-center">
                  <Store className="w-3.5 h-3.5 text-green-700 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">{canteen.name}</p>
                </div>
              </div>
              <button
                onClick={() => clearCanteen(canteenId)}
                className="text-red-400 hover:text-red-600 transition-colors p-1"
                title="Hapus kantin dari keranjang"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Items */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {itemList.map(({ itemKey, product, quantity, options, extraPrice, notes }) => (
                <div key={itemKey || product.id} className="p-3 sm:p-3.5 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-none bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0 overflow-hidden">
                      <AppImage
                        src={product.image}
                        alt={product.name}
                        type="food"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white truncate">{product.name}</p>

                      {/* Pill varian yang dipilih */}
                      {options && options.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {options.map((opt, oIdx) => (
                            <span
                              key={oIdx}
                              className="text-[9.5px] bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 px-1 py-0.2 font-semibold"
                            >
                              {opt}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="text-xs text-green-700 dark:text-green-400 font-mono font-bold mt-0.5">
                        Rp {parseFloat(product.price).toLocaleString('id-ID')}
                        {extraPrice > 0 && (
                          <span className="text-[10px] text-gray-400 font-normal ml-1">
                            (+Rp {parseFloat(extraPrice).toLocaleString('id-ID')})
                          </span>
                        )}
                      </p>
                    </div>
                    {/* Qty control (Gojek Flat Sharp) */}
                    <div className="flex items-center bg-green-50 dark:bg-green-950/60 border border-green-600 rounded-none shrink-0">
                      <button
                        type="button"
                        onClick={() => removeItem(canteenId, itemKey || product.id)}
                        className="w-7 h-7 flex items-center justify-center text-green-700 dark:text-green-300 font-bold hover:bg-green-100 text-xs active:bg-green-200 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center font-mono font-bold text-xs text-green-800 dark:text-green-200">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => incrementItem(canteenId, itemKey || product.id)}
                        disabled={quantity >= 99}
                        className={`w-7 h-7 flex items-center justify-center text-xs font-bold cursor-pointer ${
                          quantity >= 99 ? 'text-gray-300' : 'text-green-700 dark:text-green-300 hover:bg-green-100 active:bg-green-200'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Input Catatan Detail Produk */}
                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/60 px-2.5 py-1.5 rounded-none border border-gray-200 dark:border-gray-700">
                    <span className="text-xs text-gray-400 shrink-0">📝</span>
                    <input
                      type="text"
                      placeholder="Catatan tambahan (misal: jangan pakai bawang, kuah dipisah)..."
                      value={notes || ''}
                      onChange={e => updateItemNote(canteenId, itemKey || product.id, e.target.value)}
                      className="w-full text-xs bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none placeholder-gray-400"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Canteen subtotal table */}
            <div className="px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/50 space-y-1.5 text-xs border-t border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                <span>Subtotal Produk</span>
                <span className="font-mono text-gray-800 dark:text-gray-200">Rp {subtotal.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                <span>🛵 Ongkir Kurir</span>
                <span className="font-mono text-gray-800 dark:text-gray-200">Rp {deliveryFee.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                <span>🛡️ Biaya Admin Layanan</span>
                <span className="font-mono text-gray-800 dark:text-gray-200">Rp {adminFee.toLocaleString('id-ID')}</span>
              </div>
              {extraBlocks > 0 && (
                <div className="text-[11px] text-green-800 dark:text-green-300 bg-green-50 dark:bg-green-950/40 p-2 rounded-none flex flex-col gap-0.5 border border-green-200/60 dark:border-green-900/40">
                  <div className="flex items-center justify-between font-medium">
                    <span>📦 Tambahan kelipatan 5 ({qty} item):</span>
                    <span className="font-bold font-mono">+Rp {(extraCourierFee + extraAdminFee).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 flex justify-between font-mono">
                    <span>(+Rp {extraCourierFee.toLocaleString('id-ID')} kurir, +Rp {extraAdminFee.toLocaleString('id-ID')} admin)</span>
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center font-bold text-gray-900 dark:text-white pt-1.5 border-t border-gray-200 dark:border-gray-700">
                <span>Total Toko</span>
                <span className="text-green-600 dark:text-green-400 font-mono text-sm font-black">
                  Rp {total.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* Recipient Selection for Guru / Staff */}
        {user?.is_teacher && (
          <div className="bg-indigo-50 dark:bg-indigo-950/40 rounded-none border border-indigo-300 dark:border-indigo-800 p-3.5 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🎓</span>
                <h3 className="font-bold text-xs sm:text-sm text-indigo-950 dark:text-indigo-100">
                  Tujuan Pengantaran (Akun Guru / Staff)
                </h3>
              </div>
              <span className="text-[10px] bg-indigo-700 text-white font-bold px-2 py-0.5 rounded-none uppercase">
                {user.teacher_unit || 'Guru'}
              </span>
            </div>
            <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
              Pilih penerima pesanan. Pesanan untuk Guru diantar langsung ke ruang guru/kantor unit & diprioritaskan oleh kurir.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleToggleOrderFor('guru')}
                className={`p-2.5 rounded-none border text-left flex flex-col gap-1 transition-all ${
                  orderFor === 'guru'
                    ? 'border-indigo-600 bg-white dark:bg-gray-900 ring-2 ring-indigo-500 shadow-xs'
                    : 'border-indigo-200 dark:border-indigo-800/60 bg-indigo-100/50 dark:bg-indigo-900/20 text-gray-600 dark:text-gray-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-indigo-950 dark:text-white flex items-center gap-1">
                    ⚡ Untuk Saya (Guru)
                  </span>
                  {orderFor === 'guru' && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                </div>
                <span className="text-[10.5px] text-gray-500 dark:text-gray-400 line-clamp-1">
                  Ruang Guru / Kantor {user.teacher_unit}
                </span>
                <span className="text-[9.5px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-1 py-0.2 self-start mt-0.5">
                  Diantar Langsung ⚡
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleOrderFor('santri')}
                className={`p-2.5 rounded-none border text-left flex flex-col gap-1 transition-all ${
                  orderFor === 'santri'
                    ? 'border-emerald-600 bg-white dark:bg-gray-900 ring-2 ring-emerald-500 shadow-xs'
                    : hasSantriProfile
                    ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-100/50 dark:bg-emerald-900/20 text-gray-600 dark:text-gray-400'
                    : 'border-amber-300 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/20 text-gray-600 dark:text-gray-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-emerald-950 dark:text-white flex items-center gap-1">
                    👦 Untuk Santri
                  </span>
                  {orderFor === 'santri' && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                </div>
                <span className="text-[10.5px] text-gray-600 dark:text-gray-300 line-clamp-1">
                  {hasSantriProfile ? `${user.santri_name} (${user.santri_room})` : 'Belum diisi di Profil'}
                </span>
                <span className={`text-[9px] font-bold self-start mt-0.5 px-1 py-0.2 rounded-none ${
                  hasSantriProfile 
                    ? 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800'
                    : 'text-amber-800 dark:text-amber-300 bg-amber-200/80 dark:bg-amber-900/60'
                }`}>
                  {hasSantriProfile ? 'Pengantaran Reguler' : '⚠️ Wajib Isi Profil Dulu'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Delivery Location */}
        <div className="bg-white dark:bg-gray-900 rounded-none border border-gray-200 dark:border-gray-800 p-3.5 shadow-xs">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-green-600" />
              <h3 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white">Lokasi Pengiriman</h3>
            </div>
            {orderFor === 'guru' && (
              <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 font-bold px-1.5 py-0.5 border border-indigo-300 dark:border-indigo-700">
                ⚡ Prioritas Diantar Langsung
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2.5">
            {orderFor === 'guru'
              ? 'Pesanan akan diantar langsung oleh kurir ke lokasi kantor atau ruang guru ini.'
              : 'Otomatis terisi dari data kamar Santri dan dapat Anda edit bebas di sini.'}
          </p>
          <div>
            <input
              type="text"
              placeholder={orderFor === 'guru' ? `Ruang Guru / Kantor ${user?.teacher_unit || 'Yayasan'}` : 'Masukkan lokasi pengiriman (misal: Al Majid 1 / Asrama B)'}
              value={deliveryLocation}
              onChange={e => setDeliveryLocation(e.target.value)}
              className={`w-full p-2.5 border rounded-none text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none font-medium ${
                orderFor === 'guru' 
                  ? 'border-indigo-300 dark:border-indigo-700 focus:border-indigo-600' 
                  : 'border-gray-300 dark:border-gray-700 focus:border-green-600'
              }`}
            />
          </div>
        </div>

        {/* DYNAMIC VOUCHER MOTIVATION BANNER (Hanya Muncul Jika Benar-Benar Ada Voucher di Database) */}
        {voucherNudge && voucherNudge.type === 'progress' ? (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 p-3 rounded-none shadow-xs">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <h4 className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                  {voucherNudge.title}
                </h4>
              </div>
              <span className="text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-200/60 dark:bg-amber-900/60 px-1.5 py-0.5 rounded-none">
                Kurang Rp {voucherNudge.gap.toLocaleString('id-ID')}
              </span>
            </div>
            <p className="text-[11px] text-amber-800/90 dark:text-amber-300 leading-snug mb-2 font-medium">
              {voucherNudge.desc}
            </p>
            {/* Progress bar */}
            <div className="w-full bg-amber-200/60 dark:bg-amber-900/60 h-1.5 rounded-none overflow-hidden mb-2">
              <div 
                className="bg-amber-500 h-full rounded-none transition-all duration-300"
                style={{ width: `${voucherNudge.progressPercent}%` }}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate({ to: '/kantin' })}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10.5px] uppercase tracking-wider rounded-none cursor-pointer"
              >
                + Tambah Menu Santri
              </button>
            </div>
          </div>
        ) : voucherNudge && voucherNudge.type === 'qualified' ? (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/80 p-2.5 rounded-none shadow-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-black text-emerald-950 dark:text-emerald-100 uppercase tracking-wider truncate">
                  {voucherNudge.title}
                </p>
                <p className="text-[10.5px] text-emerald-700 dark:text-emerald-300 truncate">
                  {voucherNudge.desc}
                </p>
              </div>
            </div>
            {!selectedVoucher && (
              <button
                type="button"
                onClick={() => setShowVoucherDrawer(true)}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] uppercase tracking-wider shrink-0 cursor-pointer rounded-none"
              >
                Pilih Voucher
              </button>
            )}
          </div>
        ) : null}

        {/* Voucher Promo Selection Card (Gojek Flat Sharp) */}
        <div className="bg-white dark:bg-gray-900 rounded-none border border-gray-200 dark:border-gray-800 p-3 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 bg-green-100 dark:bg-green-950/60 border border-green-300 dark:border-green-800 flex items-center justify-center shrink-0">
                <Ticket className="w-4 h-4 text-green-700 dark:text-green-300" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  {selectedVoucher ? selectedVoucher.title : 'Voucher & Promo Kupon'}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                  {selectedVoucher 
                    ? `Kode: ${selectedVoucher.code} • Hemat Rp ${voucherDiscount.toLocaleString('id-ID')}` 
                    : 'Gunakan voucher untuk hemat biaya admin / ongkir'}
                </p>
              </div>
            </div>
            
            <div className="shrink-0 flex items-center gap-1.5">
              {selectedVoucher ? (
                <button
                  type="button"
                  onClick={() => setSelectedVoucher(null)}
                  className="px-2 py-1 text-[10px] font-bold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 hover:bg-red-50"
                >
                  Lepas
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setShowVoucherDrawer(true)}
                className="px-2.5 py-1 text-xs font-bold bg-green-600 text-white hover:bg-green-700 transition-colors uppercase tracking-wider"
              >
                {selectedVoucher ? 'Ganti' : 'Pakai Voucher'}
              </button>
            </div>
          </div>
        </div>

        {/* Grand total info */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-none border border-green-200 dark:border-green-800 p-3.5 shadow-xs space-y-2">
          {/* Detailed summary */}
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400 border-b border-green-200/60 dark:border-green-800/60 pb-2">
            <div className="flex justify-between">
              <span>Subtotal Item ({totalItems} item)</span>
              <span className="font-mono text-gray-800 dark:text-gray-200">Rp {totalSubtotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Ongkos Kirim & Layanan ({canteenEntries.length} toko)</span>
              <span className="font-mono text-gray-800 dark:text-gray-200">Rp {(totalDeliveryFee + totalAdminFee).toLocaleString('id-ID')}</span>
            </div>
            {voucherDiscount > 0 && (
              <div className="flex justify-between text-green-700 dark:text-green-400 font-bold">
                <span className="flex items-center gap-1">
                  <Ticket className="w-3.5 h-3.5" /> Diskon Kupon ({selectedVoucher?.code})
                </span>
                <span className="font-mono">- Rp {voucherDiscount.toLocaleString('id-ID')}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-0.5">
            <div>
              <p className="text-xs sm:text-sm text-green-800 dark:text-green-300 font-bold">{canteenEntries.length} Toko • {totalItems} Item</p>
              <p className="text-[11px] text-green-600 dark:text-green-400 mt-0.5">
                {voucherDiscount > 0 ? 'Potongan voucher aktif' : 'Termasuk ongkir semua toko'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-green-600 dark:text-green-400 uppercase tracking-wider font-semibold">Total Tagihan</p>
              <p className="text-base sm:text-lg font-black font-mono text-green-700 dark:text-green-400">
                Rp {grandTotal.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed bottom checkout button */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 z-50">
        <div className="max-w-2xl mx-auto">
          {!token || !user ? (
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="w-full py-3 bg-green-600 hover:bg-green-700 active:scale-[0.99] text-white font-bold text-sm rounded-none shadow-md transition-all flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Login untuk Checkout • <span className="font-mono">Rp {grandTotal.toLocaleString('id-ID')}</span></span>
            </button>
          ) : (
            <button
              onClick={handleCheckoutAll}
              disabled={isProcessing}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-60 active:scale-[0.99] text-white font-bold text-sm rounded-none shadow-md transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Memproses Pesanan...
                </>
              ) : (
                <>
                  Checkout {canteenEntries.length} Toko • <span className="font-mono">Rp {grandTotal.toLocaleString('id-ID')}</span> <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
          <p className="text-center text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
            {!token || !user ? 'Anda belum masuk. Silakan login santri/wali untuk menyelesaikan pesanan.' : 'WA konfirmasi otomatis akan dikirim ke kantin'}
          </p>
        </div>
      </div>

      {/* Login Required Modal (Compact & Flat Sharp) */}
      {showLoginModal && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none w-full max-w-sm p-5 text-center shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 rounded-none flex items-center justify-center mx-auto mb-3">
              <LogIn className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1.5">
              Login untuk Melanjutkan Pemesanan
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-5 leading-relaxed">
              Silakan masuk dengan akun santri atau wali Anda terlebih dahulu untuk memproses pesanan dan pengantaran ke kamar pondok.
            </p>
            <div className="space-y-2">
              <Link
                to="/login"
                className="block w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs uppercase tracking-wider rounded-none text-center shadow-sm transition-colors"
              >
                Masuk / Login Sekarang
              </Link>
              <Link
                to="/register"
                className="block w-full py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold text-xs rounded-none text-center border border-gray-200 dark:border-gray-700 transition-colors"
              >
                Daftar Akun Baru
              </Link>
              <button
                type="button"
                onClick={() => setShowLoginModal(false)}
                className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium"
              >
                Kembali ke Keranjang
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Popup Lengkapi Profil Langsung di Layar Checkout (Flat Sharp High Density) */}
      {showProfileModal && createPortal(
        <div className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none w-full max-w-md shadow-2xl my-auto animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="p-3.5 sm:p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0 bg-gray-50 dark:bg-gray-950">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-none flex items-center justify-center text-green-600 dark:text-green-400">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                    Lengkapi Profil Pengiriman
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Lengkapi data sekali saja untuk checkout langsung tanpa keluar
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowProfileModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-none text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveProfileAndCheckout} className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1 text-left">
              {/* No. WhatsApp (Wajib) */}
              <div>
                <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1">
                  No. WhatsApp Aktif <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center border border-gray-300 dark:border-gray-700 rounded-none bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-green-500">
                  <span className="px-2.5 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 border-r border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 select-none">
                    +62
                  </span>
                  <input
                    type="tel"
                    required
                    placeholder="Contoh: 81234567890"
                    value={profileFormData.phone ? (profileFormData.phone.startsWith('62') ? profileFormData.phone.slice(2) : (profileFormData.phone.startsWith('0') ? profileFormData.phone.slice(1) : profileFormData.phone)) : ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setProfileFormData(prev => ({ ...prev, phone: val.startsWith('0') ? val.substring(1) : val }));
                    }}
                    className="flex-1 p-2 text-xs text-gray-900 dark:text-white bg-transparent outline-none"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Digunakan toko dan kurir untuk mengonfirmasi pengantaran makanan.
                </p>
              </div>

              {/* Data Santri (jika bukan akun guru yang memesan untuk guru) */}
              {(!user?.is_teacher || orderFor === 'santri') ? (
                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-green-600" />
                      Identitas Santri Penerima
                    </span>
                    <span className="text-[10px] text-green-600 dark:text-green-400 font-semibold bg-green-50 dark:bg-green-950/40 px-1.5 py-0.5 border border-green-200 dark:border-green-800">
                      Wajib Diisi
                    </span>
                  </div>

                  {/* Filter Jenjang & Kelas */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Jenjang <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={profileFormData.santri_level}
                        onChange={(e) => {
                          setProfileFormData(prev => ({
                            ...prev,
                            santri_level: e.target.value,
                            santri_class: '',
                            santri_name: '',
                            santri_room: ''
                          }));
                        }}
                        className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-2 text-xs focus:ring-2 focus:ring-green-500 outline-none"
                      >
                        <option value="">-- Pilih Jenjang --</option>
                        {uniqueJenjang.map(j => <option key={j} value={j}>{j}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Kelas <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={profileFormData.santri_class}
                        onChange={(e) => {
                          setProfileFormData(prev => ({
                            ...prev,
                            santri_class: e.target.value,
                            santri_name: '',
                            santri_room: ''
                          }));
                        }}
                        className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-2 text-xs focus:ring-2 focus:ring-green-500 outline-none"
                      >
                        <option value="">-- Pilih Kelas --</option>
                        {availableKelas.map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Jenis Kelamin Filter */}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Filter Jenis Kelamin (Opsional)
                    </label>
                    <select
                      value={filterGender}
                      onChange={(e) => setFilterGender(e.target.value)}
                      className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-2 text-xs focus:ring-2 focus:ring-green-500 outline-none"
                    >
                      <option value="">Semua Santri</option>
                      <option value="Laki-laki">Santri Putra (Laki-laki)</option>
                      <option value="Perempuan">Santri Putri (Perempuan)</option>
                    </select>
                  </div>

                  {/* Dropdown Santri Autocomplete */}
                  <div className="relative" ref={santriDropdownRef}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
                        Pilih Nama Santri <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[10px] text-gray-400">
                        {filteredSantris.length} santri ditemukan
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsSantriOpen(!isSantriOpen);
                        setSantriSearch('');
                      }}
                      className={`w-full text-left rounded-none border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2 text-xs flex items-center justify-between focus:ring-2 focus:ring-green-500 outline-none ${
                        isSantriOpen ? 'border-green-500 ring-1 ring-green-500' : ''
                      }`}
                    >
                      <span className={`truncate pr-2 ${profileFormData.santri_name ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                        {profileFormData.santri_name 
                          ? `${profileFormData.santri_name} ${profileFormData.santri_level || profileFormData.santri_class ? `(${[profileFormData.santri_level, profileFormData.santri_class].filter(Boolean).join(' - ')})` : ''}` 
                          : '-- Ketuk untuk Cari / Pilih Santri --'}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${isSantriOpen ? 'rotate-180 text-green-600' : ''}`} />
                    </button>

                    {/* Panel Pencarian Santri */}
                    {isSantriOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-green-500 dark:border-green-600 z-50 shadow-2xl max-h-56 flex flex-col">
                        <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80 flex items-center gap-1.5 shrink-0">
                          <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <input
                            type="text"
                            autoFocus
                            placeholder="Ketik nama santri..."
                            value={santriSearch}
                            onChange={(e) => setSantriSearch(e.target.value)}
                            className="w-full bg-transparent text-xs text-gray-900 dark:text-white outline-none placeholder:text-gray-400"
                          />
                          {santriSearch && (
                            <button
                              type="button"
                              onClick={() => setSantriSearch('')}
                              className="text-gray-400 hover:text-gray-600 p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div className="overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 flex-1">
                          {filteredSantris.length === 0 ? (
                            <div className="p-3 text-[11px] text-gray-500 dark:text-gray-400 text-center">
                              Santri tidak ditemukan {santriSearch ? `untuk "${santriSearch}"` : ''}
                            </div>
                          ) : (
                            filteredSantris.slice(0, 50).map((row, i) => {
                              const rawName = row[1] || '';
                              const cleanName = rawName.replace(' Laki-laki', '').replace(' Perempuan', '').trim();
                              const jenjang = row[4] || '';
                              const kelas = row[5] || '';
                              const info = [jenjang, kelas].filter(Boolean).join(' - ');
                              const isSelected = profileFormData.santri_name === cleanName;

                              return (
                                <button
                                  type="button"
                                  key={i}
                                  onClick={() => {
                                    setProfileFormData(prev => ({
                                      ...prev,
                                      santri_name: cleanName,
                                      santri_level: row[4] || prev.santri_level,
                                      santri_class: row[5] || prev.santri_class,
                                      santri_room: row[10] || prev.santri_room || ''
                                    }));
                                    setIsSantriOpen(false);
                                    setSantriSearch('');
                                  }}
                                  className={`w-full text-left p-2 text-xs flex items-center justify-between hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors ${
                                    isSelected 
                                      ? 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 font-bold' 
                                      : 'text-gray-800 dark:text-gray-200'
                                  }`}
                                >
                                  <div className="truncate pr-2">
                                    <span className="font-semibold text-gray-900 dark:text-white">{cleanName}</span>
                                    {info && <span className="ml-1 text-[10px] text-gray-400">({info})</span>}
                                  </div>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Kamar / Asrama Santri */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-800 dark:text-gray-200 mb-1">
                      Asrama / Kamar Santri <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center border border-gray-300 dark:border-gray-700 rounded-none bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-green-500">
                      <span className="p-2 text-gray-400">
                        <Home className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Asrama Abu Bakar 02 / Kamar Al-Ghazali 05"
                        value={profileFormData.santri_room}
                        onChange={(e) => setProfileFormData(prev => ({ ...prev, santri_room: e.target.value }))}
                        className="flex-1 p-2 text-xs text-gray-900 dark:text-white bg-transparent outline-none"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Lokasi tujuan pengantaran kurir pondok.
                    </p>
                  </div>
                </div>
              ) : (
                /* Khusus Akun Guru memesan untuk Guru */
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-none space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    <GraduationCap className="w-4 h-4 text-emerald-600" />
                    <span>Pesanan Khusus Guru / Staff Yayasan</span>
                  </div>
                  <div className="text-[11px] text-emerald-800 dark:text-emerald-300 space-y-1">
                    <p>Unit: <strong className="text-gray-900 dark:text-white">{user?.teacher_unit || 'Yayasan'}</strong></p>
                    <p>Lokasi Pengantaran: <strong className="text-gray-900 dark:text-white">{deliveryLocation}</strong></p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  disabled={isSavingProfile}
                  className="flex-1 py-2.5 rounded-none font-bold text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex-[2] py-2.5 rounded-none font-black text-xs text-white bg-green-600 hover:bg-green-700 active:bg-green-800 transition-colors flex items-center justify-center shadow-xs disabled:opacity-70 cursor-pointer"
                >
                  {isSavingProfile ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Menyimpan & Melanjutkan...</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      <span>Simpan & Lanjutkan Checkout</span>
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Voucher Selection Modal (Gojek Flat Sharp) */}
      {showVoucherDrawer && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none w-full max-w-md my-auto shadow-2xl animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            
            <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0 bg-gray-50 dark:bg-gray-950">
              <div className="flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-green-600" />
                <h3 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  Pilih Kupon Promo
                </h3>
              </div>
              <button
                onClick={() => setShowVoucherDrawer(false)}
                className="w-7 h-7 flex items-center justify-center border border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 overflow-y-auto space-y-2 flex-1 text-xs">
              {myVouchers.length === 0 ? (
                <div className="p-6 text-center">
                  <Ticket className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="font-bold text-gray-700 dark:text-gray-300">Belum Ada Kupon di Dompet Anda</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Silakan klaim kupon promo terlebih dahulu di menu Promo Voucher.
                  </p>
                  <button
                    type="button"
                    onClick={handleGoToPromoVoucher}
                    className="inline-block mt-3 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs uppercase tracking-wider rounded-none cursor-pointer"
                  >
                    Klaim Voucher Sekarang
                  </button>
                </div>
              ) : (
                myVouchers.map((uv) => {
                  const v = uv.voucher;
                  if (!v) return null;

                  // Check if order satisfies min_purchase
                  const isMinSatisfied = rawGrandTotal >= parseFloat(v.min_purchase || 0);

                  // Check canteen match if canteen_id is specified
                  const isCanteenMatch = !v.canteen_id || canteenSummaries.some(c => c.canteen.id === v.canteen_id);

                  const isEligible = isMinSatisfied && isCanteenMatch;
                  const isSelected = selectedVoucher?.id === v.id;

                  return (
                    <div
                      key={uv.id}
                      className={`border p-2.5 transition-all relative ${
                        isSelected 
                          ? 'border-green-600 bg-green-50/50 dark:bg-green-950/30' 
                          : isEligible 
                            ? 'border-gray-200 dark:border-gray-700 hover:border-gray-300 bg-white dark:bg-gray-800' 
                            : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className="font-mono font-black text-[11px] px-1.5 py-0.5 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900">
                              {v.code}
                            </span>
                            {v.discount_type === 'admin_fee' ? (
                              <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-1.5 py-0.5 text-[10px] uppercase">
                                Potong Admin Rp {parseFloat(v.discount_amount).toLocaleString('id-ID')}
                              </span>
                            ) : v.discount_type === 'delivery_fee' ? (
                              <span className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold px-1.5 py-0.5 text-[10px] uppercase">
                                Potong Ongkir Rp {parseFloat(v.discount_amount).toLocaleString('id-ID')}
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold px-1.5 py-0.5 text-[10px] uppercase">
                                Diskon Rp {parseFloat(v.discount_amount).toLocaleString('id-ID')}
                              </span>
                            )}
                          </div>

                          <h4 className="font-bold text-gray-900 dark:text-white text-xs leading-tight">
                            {v.title}
                          </h4>
                          {v.description && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                              {v.description}
                            </p>
                          )}

                          {!isMinSatisfied && (
                            <p className="text-[10px] text-red-500 font-bold mt-1">
                              * Minimal belanja Rp {parseFloat(v.min_purchase).toLocaleString('id-ID')}
                            </p>
                          )}
                          {!isCanteenMatch && (
                            <p className="text-[10px] text-red-500 font-bold mt-1">
                              * Hanya berlaku untuk pesanan di toko terkait
                            </p>
                          )}
                        </div>

                        <div className="shrink-0">
                          {isSelected ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedVoucher(null);
                                setShowVoucherDrawer(false);
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                            >
                              Batal
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={!isEligible}
                              onClick={() => {
                                setSelectedVoucher(v);
                                setShowVoucherDrawer(false);
                                toast.success(`Voucher ${v.code} berhasil dipasang!`);
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white uppercase tracking-wider"
                            >
                              Gunakan
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={handleGoToPromoVoucher}
                className="text-[11px] font-bold text-green-600 hover:underline cursor-pointer"
              >
                + Cari & Klaim Kupon Lain
              </button>
              <button
                type="button"
                onClick={() => setShowVoucherDrawer(false)}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-800 font-bold text-xs"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
