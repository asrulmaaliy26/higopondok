import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ShoppingBag, ChevronLeft, CheckCircle, Clock, Store, MessageCircle, 
  Image as ImageIcon, X, XCircle, FileText, Download, ExternalLink, 
  Trash2, Camera, Receipt, Eye, Sparkles, Filter, Calendar, ChevronDown, RefreshCw 
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getStorageUrl, getPublicUrl } from '../../lib/axios';
import { useAuthStore } from '../../store/authStore';
import { getFileType, isImageFile, isHeifFile, isPdfFile, formatFileSize, getFileNameFromPath, compressImageFiles } from '../../lib/fileUtils';
import santriData from '../../data/santri.json';
import ThermalReceiptModal from '../../components/receipt/ThermalReceiptModal';
import LoadingSpinner from '../../components/common/LoadingSpinner';

function getWeeksInMonth(year, month) {
  const weeks = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  let currentWeek = [];
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    currentWeek.push(date);
    
    if (date.getDay() === 0 || d === lastDay.getDate()) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  }
  
  return weeks.map((week, index) => {
    return {
      name: `Minggu ${index + 1} (${week[0].getDate()}-${week[week.length - 1].getDate()})`,
      startDate: week[0],
      endDate: week[week.length - 1]
    };
  });
}

function getCurrentWeekIndex(year, month) {
  const weeks = getWeeksInMonth(year, month);
  const now = new Date();
  const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const idx = weeks.findIndex(w => {
    const start = new Date(w.startDate.getFullYear(), w.startDate.getMonth(), w.startDate.getDate()).getTime();
    const end = new Date(w.endDate.getFullYear(), w.endDate.getMonth(), w.endDate.getDate()).getTime();
    return todayDateOnly >= start && todayDateOnly <= end;
  });

  return idx >= 0 ? idx : 0;
}

export default function Pembayaran() {
  const user = useAuthStore(state => state.user);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedProofs, setSelectedProofs] = useState([]);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState({});
  const [activeFilter, setActiveFilter] = useState('all');

  // Handle ESC key to dismiss modal previews
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (fullscreenImage) setFullscreenImage(null);
        else if (selectedProofs.length > 0) setSelectedProofs([]);
        else if (selectedProduct) setSelectedProduct(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenImage, selectedProofs.length, selectedProduct]);

  // Unified Period Filter States (Default: Bulanan / month)
  const today = new Date();
  const [filterMode, setFilterMode] = useState('month'); // Default 'month' (Bulanan)
  const [filterDate, setFilterDate] = useState(
    `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`
  );
  const [filterMonth, setFilterMonth] = useState(today.getMonth());
  const [filterYear, setFilterYear] = useState(today.getFullYear());
  const [filterWeekIndex, setFilterWeekIndex] = useState(() => {
    return getCurrentWeekIndex(today.getFullYear(), today.getMonth());
  });

  const [showPaymentProofModal, setShowPaymentProofModal] = useState(false);
  const [activeOrderForPaymentProof, setActiveOrderForPaymentProof] = useState(null);
  const [paymentProofFiles, setPaymentProofFiles] = useState([]);
  const [isCompressing, setIsCompressing] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFileSelection = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setIsCompressing(true);
    const toastId = toast.loading('Memproses & mengompresi foto...');
    try {
      const compressed = await compressImageFiles(files);
      setPaymentProofFiles((prev) => [...prev, ...compressed]);
      toast.success(`${compressed.length} foto berhasil disiapkan`, { id: toastId });
    } catch (err) {
      setPaymentProofFiles((prev) => [...prev, ...files]);
      toast.dismiss(toastId);
    } finally {
      setIsCompressing(false);
    }
  };

  const getFilterParams = () => {
    if (filterMode === 'all') {
      return { start_date: '', end_date: '', period: 'all' };
    }
    const pad = n => n.toString().padStart(2, '0');
    const format = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (filterMode === 'day') {
      return { start_date: filterDate, end_date: filterDate, period: 'day' };
    } 
    else if (filterMode === 'week') {
      const weeks = getWeeksInMonth(filterYear, filterMonth);
      const safeIndex = filterWeekIndex < weeks.length ? filterWeekIndex : 0;
      const week = weeks[safeIndex] || weeks[0];
      return { start_date: format(week.startDate), end_date: format(week.endDate), period: 'week' };
    }
    else if (filterMode === 'month') {
      const start = new Date(filterYear, filterMonth, 1);
      const end = new Date(filterYear, filterMonth + 1, 0);
      return { start_date: format(start), end_date: format(end), period: 'month' };
    }
    else if (filterMode === 'year') {
      const start = new Date(filterYear, 0, 1);
      const end = new Date(filterYear, 11, 31);
      return { start_date: format(start), end_date: format(end), period: 'year' };
    }
    return { start_date: '', end_date: '', period: 'all' };
  };

  const currentParams = getFilterParams();

  const getFilterLabel = () => {
    if (filterMode === 'all') return 'Semua Waktu';
    if (filterMode === 'day') {
      const d = new Date(filterDate);
      return isNaN(d) ? filterDate : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (filterMode === 'week') {
      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const weeks = getWeeksInMonth(filterYear, filterMonth);
      const safeIndex = filterWeekIndex < weeks.length ? filterWeekIndex : 0;
      const weekName = (weeks[safeIndex] || weeks[0])?.name || `Minggu ${safeIndex + 1}`;
      return `${weekName} - ${months[filterMonth]} ${filterYear}`;
    }
    if (filterMode === 'month') {
      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      return `${months[filterMonth]} ${filterYear}`;
    }
    if (filterMode === 'year') {
      return `Tahun ${filterYear}`;
    }
    return '';
  };

  const isPaymentTime = (order) => {
    // Jika backend mengirimkan atribut boolean is_open, prioritaskan itu
    if (order?.canteen?.is_open !== undefined) {
      return Boolean(order.canteen.is_open);
    }

    if (!order?.canteen?.open_time || !order?.canteen?.close_time) {
      const hour = new Date().getHours();
      return hour >= 9 && hour < 17;
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    
    const openParts = order.canteen.open_time.split(':');
    const openTime = parseInt(openParts[0]) * 60 + parseInt(openParts[1]);
    
    const closeParts = order.canteen.close_time.split(':');
    const closeTime = parseInt(closeParts[0]) * 60 + parseInt(closeParts[1]);
    
    if (openTime <= closeTime) {
      return currentTime >= openTime && currentTime <= closeTime;
    } else {
      return currentTime >= openTime || currentTime <= closeTime;
    }
  };

  const getClosedCanteensInfo = (orders) => {
    const closed = (orders || []).filter(o => !isPaymentTime(o));
    if (!closed || closed.length === 0) return [];
    return closed.map(o => {
      const c = o.canteen;
      const name = c?.name || 'Toko';
      const open = c?.open_time ? c.open_time.slice(0, 5) : '07:00';
      const close = c?.close_time ? c.close_time.slice(0, 5) : '17:00';
      const hours = `${open} - ${close} WIB`;
      return {
        name,
        hours,
        toString() {
          return `${this.name} (Buka: ${this.hours})`;
        }
      };
    });
  };

  const queryClient = useQueryClient();

  const toggleOrderDetails = (orderId) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const cancelMutation = useMutation({
    mutationFn: (orderId) => api.put(`/orders/${orderId}/cancel`),
    onSuccess: () => {
      toast.success('Pesanan berhasil dibatalkan');
      queryClient.invalidateQueries(['user_orders']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Gagal membatalkan pesanan');
    }
  });

  const handleCancelOrder = (orderId) => {
    if (window.confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) {
      cancelMutation.mutate(orderId);
    }
  };

  const handleCancelGroup = async (orders) => {
    const pendingOrders = orders.filter(o => o.status === 'pending');
    if (pendingOrders.length === 0) return;
    if (window.confirm(`Apakah Anda yakin ingin membatalkan pesanan ${pendingOrders.length > 1 ? `seluruh (${pendingOrders.length}) toko ini` : 'ini'}?`)) {
      for (const o of pendingOrders) {
        try {
          await api.put(`/orders/${o.id}/cancel`);
        } catch (e) {
          // continue
        }
      }
      queryClient.invalidateQueries(['user_orders']);
      toast.success('Pesanan berhasil dibatalkan');
    }
  };

  const uploadPaymentProofMutation = useMutation({
    mutationFn: async ({ id, checkoutId, formData }) => {
      let res;
      if (checkoutId) {
        res = await api.post(`/orders/checkout/${checkoutId}/payment-proof`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000, // 30s timeout for high traffic resilience
        });
      } else {
        res = await api.post(`/orders/${id}/payment-proof`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000,
        });
      }
      return res.data;
    },
    retry: (failureCount, error) => {
      // Auto retry 2x for network drop, timeout, or 503/429 server high load
      const status = error?.response?.status;
      if (failureCount < 2 && (!status || status === 429 || status >= 500)) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1500 * (attemptIndex + 1), 6000),
    onSuccess: () => {
      queryClient.invalidateQueries(['user_orders']);
      queryClient.invalidateQueries(['orders']);
      toast.success('Bukti transfer berhasil diunggah!');
      setShowPaymentProofModal(false);
      setPaymentProofFiles([]);
      setActiveOrderForPaymentProof(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal mengunggah bukti transfer. Silakan periksa koneksi dan coba lagi.');
    }
  });

  const { data: ordersRes, isLoading } = useQuery({
    queryKey: ['user_orders', currentParams.period, currentParams.start_date, currentParams.end_date],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentParams.start_date) params.append('start_date', currentParams.start_date);
      if (currentParams.end_date) params.append('end_date', currentParams.end_date);
      if (currentParams.period) params.append('period', currentParams.period);
      const res = await api.get(`/orders?${params.toString()}`);
      return res.data;
    },
    staleTime: 5000,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => {
      const data = query?.state?.data;
      if (!Array.isArray(data) || data.length === 0) return 30000;
      const hasActive = data.some(o => ['pending', 'processing'].includes(o.status) || o.payment_status === 'waiting_confirmation');
      return hasActive ? 12000 : 30000;
    }
  });

  const rawOrders = Array.isArray(ordersRes) ? ordersRes : (ordersRes?.data || []);

  const filteredOrders = useMemo(() => {
    let list = [...rawOrders];

    // Client-side date filter (safety fallback in case backend sends all or cached)
    if (filterMode !== 'all' && currentParams.start_date && currentParams.end_date) {
      const startMs = new Date(`${currentParams.start_date}T00:00:00`).getTime();
      const endMs = new Date(`${currentParams.end_date}T23:59:59.999`).getTime();
      list = list.filter(o => {
        if (!o.created_at) return true;
        const oMs = new Date(o.created_at).getTime();
        return oMs >= startMs && oMs <= endMs;
      });
    }

    if (activeFilter !== 'all') {
      list = list.filter(o => o.status === activeFilter);
    }

    return list;
  }, [rawOrders, filterMode, currentParams.start_date, currentParams.end_date, activeFilter]);

  const checkoutGroups = useMemo(() => {
    const groups = [];
    const map = new Map();

    filteredOrders.forEach(order => {
      // Group by checkout_id if available; otherwise fallback to unique order id
      const key = order.checkout_id ? `chk_${order.checkout_id}` : `ord_${order.id}`;
      if (!map.has(key)) {
        const groupObj = {
          key,
          checkoutId: order.checkout_id || null,
          created_at: order.created_at,
          delivery_location: order.delivery_location,
          orders: []
        };
        map.set(key, groupObj);
        groups.push(groupObj);
      }
      map.get(key).orders.push(order);
    });

    return groups.map(group => {
      const orders = group.orders;
      const isMultiStore = orders.length > 1;

      // Calculate totals across all orders in group
      const grandTotal = orders.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0);
      const totalDeliveryFee = orders.reduce((sum, o) => sum + parseFloat(o.delivery_fee || 0), 0);
      const totalAdminFee = orders.reduce((sum, o) => sum + parseFloat(o.admin_fee || 0), 0);
      const totalProductSubtotal = orders.reduce((sum, o) => {
        const sub = o.is_custom 
          ? Math.max(0, parseFloat(o.total_price) - parseFloat(o.delivery_fee || 0) - parseFloat(o.admin_fee || 0))
          : (o.items?.reduce((s, i) => s + parseFloat(i.subtotal), 0) || 0);
        return sum + sub;
      }, 0);

      // Payment status across group
      const isAllPaid = orders.every(o => o.payment_status === 'paid');
      const isAnyWaiting = orders.some(o => o.payment_status === 'waiting_confirmation');
      const payment_status = isAllPaid ? 'paid' : (isAnyWaiting ? 'waiting_confirmation' : 'unpaid');

      // Order status across group
      const isAllCompleted = orders.every(o => o.status === 'completed');
      const isAllCancelled = orders.every(o => o.status === 'cancelled');
      const isAnyProcessing = orders.some(o => o.status === 'processing');
      const isAnyPending = orders.some(o => o.status === 'pending');
      
      let overallStatus = 'pending';
      if (isAllCompleted) overallStatus = 'completed';
      else if (isAllCancelled) overallStatus = 'cancelled';
      else if (isAnyProcessing) overallStatus = 'processing';
      else if (isAnyPending) overallStatus = 'pending';

      // Gather proofs
      const proof_of_payment = orders.find(o => o.proof_of_payment)?.proof_of_payment || null;
      
      const proof_of_purchase = orders.flatMap(o => {
        if (!o.proof_of_purchase) return [];
        return Array.isArray(o.proof_of_purchase) ? o.proof_of_purchase : [o.proof_of_purchase];
      });

      const proof_of_delivery = orders.flatMap(o => {
        if (!o.proof_of_delivery) return [];
        return Array.isArray(o.proof_of_delivery) ? o.proof_of_delivery : [o.proof_of_delivery];
      });

      return {
        ...group,
        isMultiStore,
        grandTotal,
        totalDeliveryFee,
        totalAdminFee,
        totalProductSubtotal,
        payment_status,
        overallStatus,
        proof_of_payment,
        proof_of_purchase,
        proof_of_delivery
      };
    });
  }, [filteredOrders]);

  // Thermal Receipt Modal States
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState(null);
  const [selectedReceiptOrders, setSelectedReceiptOrders] = useState([]);
  const [receiptModalMode, setReceiptModalMode] = useState('single');

  const handleOpenReceipt = (group) => {
    if (group.isMultiStore || (group.orders && group.orders.length > 1)) {
      setSelectedReceiptOrders(group.orders);
      setSelectedReceiptOrder(group.orders[0]);
      setReceiptModalMode('batch');
    } else {
      const ord = group.orders ? group.orders[0] : group;
      setSelectedReceiptOrder(ord);
      setSelectedReceiptOrders([ord]);
      setReceiptModalMode('single');
    }
    setReceiptModalOpen(true);
  };

  // Unified Orders Feed (Tampilkan semua status pesanan: proses, selesai, batal)
  const displayedGroups = checkoutGroups;

  const filters = [
    { key: 'all', label: 'Semua Status' },
    { key: 'pending', label: 'Menunggu' },
    { key: 'processing', label: 'Diproses' },
    { key: 'completed', label: 'Selesai' },
    { key: 'cancelled', label: 'Dibatalkan' },
  ];

  const formatPhoneWA = (phone) => {
    if (!phone) return '';
    let p = phone.toString().replace(/\D/g, '');
    if (p.startsWith('08')) p = '628' + p.substring(2);
    else if (p.startsWith('8')) p = '628' + p.substring(1);
    else if (p.startsWith('0')) p = '62' + p.substring(1);
    return `https://wa.me/${p}`;
  };

  const buildCourierWAText = (group) => {
    const isTeacher = group.orders.some(o => o.order_for === 'guru');
    const santriName = isTeacher ? `Guru / Staff (${user?.name})` : (user?.santri_name || user?.name || '-');
    let santriRoom = group.delivery_location || (isTeacher ? `Ruang Guru / Kantor ${user?.teacher_unit || ''}` : user?.santri_room || '');

    let text = `Assalamu'alaikum Warahmatullahi Wabarakatuh, Kurir Higo Pondok.\n`;
    text += `Saya ingin konfirmasi pengiriman pesanan saya${isTeacher ? ' (⚡ Pesanan Guru / Staff - Prioritas)' : ''}:\n`;
    if (group.checkoutId) {
      text += `*ID Checkout*: #${group.checkoutId}\n`;
    }
    text += `*Toko*: ${group.orders.map(o => o.canteen?.name).filter(Boolean).join(', ')}\n\n`;
    text += `*Penerima*: ${santriName}\n`;
    if (santriRoom) text += `🏠 Lokasi: ${santriRoom}\n\n`;
    text += `*Total Tagihan: Rp ${Math.round(group.grandTotal).toLocaleString('id-ID')}*\n\n`;
    text += `Mohon bantuannya untuk pengiriman ya, Syukron! 🙏`;
    return text;
  };

  const buildOrderWAText = (order) => {
    const subtotal = order.is_custom 
      ? Math.max(0, parseFloat(order.total_price) - parseFloat(order.delivery_fee || 0) - parseFloat(order.admin_fee || 0))
      : (order.items?.reduce((sum, item) => sum + parseFloat(item.subtotal), 0) || 0);
    const ongkir = parseFloat(order.delivery_fee || 0);
    const admin = parseFloat(order.admin_fee || 0);

    const santriName = user?.santri_name || user?.name || '-';
    let santriClass = user?.santri_class || '';
    let santriLevel = user?.santri_level || '';
    let santriRoom = user?.santri_room || order.delivery_location || '';

    if (santriName && santriData?.data) {
      const sName = santriName.toLowerCase().trim();
      const match = santriData.data.find(r => {
        if (!r || !r[1]) return false;
        const rawName = r[1].toLowerCase().replace(/\s+(laki-laki|perempuan)$/i, '').trim();
        return rawName === sName || sName.includes(rawName) || rawName.includes(sName);
      });
      if (match) {
        if (!santriLevel && match[4]) santriLevel = match[4];
        const tingkat = match[5] || '';
        const rombel = match[6] || '';
        const program = match[7] && match[7] !== '-' ? match[7] : '';
        const fullClass = [tingkat, rombel, program].filter(Boolean).join(' ');
        if (!santriClass || santriClass === tingkat) {
          santriClass = fullClass || santriClass;
        }
        if (!santriRoom && match[10]) santriRoom = match[10];
      }
    }

    let text = `Assalamu'alaikum Warahmatullahi Wabarakatuh, ${order.canteen?.name || 'Kantin'}.\n`;
    text += `Saya ingin mengonfirmasi pesanan saya:\n`;
    text += `*ID Pesanan*: #${order.id}\n\n`;
    text += `*Data Penerima*:\n`;
    text += `👤 Santri: ${santriName}\n`;
    text += `📚 Kelas/Jenjang: ${santriClass || '-'} / ${santriLevel || '-'}\n`;
    if (santriRoom) text += `🏠 Lokasi: ${santriRoom}\n`;
    text += `\n*Rincian Pesanan*:\n`;
    if (order.is_custom) {
      text += `🔸 1x Pesanan Khusus (${order.custom_notes || 'Titipan'})\n`;
    } else {
      order.items?.forEach(item => {
        text += `🔸 ${item.quantity}x ${item.product?.name} @ Rp ${Math.round(parseFloat(item.price_per_item || (parseFloat(item.subtotal)/item.quantity))).toLocaleString('id-ID')}\n`;
      });
    }
    text += `\n*Ringkasan Biaya*:`;
    text += `\n- Subtotal: Rp ${Math.round(subtotal).toLocaleString('id-ID')}`;
    if (ongkir > 0) text += `\n- Ongkos Kirim: Rp ${Math.round(ongkir).toLocaleString('id-ID')}`;
    if (admin > 0) text += `\n- Biaya Admin: Rp ${Math.round(admin).toLocaleString('id-ID')}`;
    text += `\n\n*Total Tagihan: Rp ${Math.round(parseFloat(order.total_price)).toLocaleString('id-ID')}*\n\n`;
    text += `Mohon segera diproses ya, Syukron Jazakumullah Khairan. 🙏`;
    return text;
  };


  const monthsList = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const currentYear = new Date().getFullYear();
  const yearsList = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="bg-gray-50 h-full min-h-screen pb-24 dark:bg-gray-950 font-sans">
      {/* Top Header & Period Filter Controls (Ikut scroll ke atas, tidak stuck) */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Aktivitas Transaksi</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Pantau pesanan aktif, riwayat transaksi, & struk belanja santri.
            </p>
          </div>
        </div>

        {/* COMPACT FILTER BAR — Mode + Status dalam 1-2 baris */}
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
          {/* Baris 1: Label + Badge Periode + Mode Buttons dalam 1 baris scroll */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              <Calendar className="w-3 h-3 text-green-600" />
              Periode:
            </span>
            {[
              { id: 'month', label: 'Bulanan' },
              { id: 'week', label: 'Mingguan' },
              { id: 'day', label: 'Harian' },
              { id: 'year', label: 'Tahunan' },
              { id: 'all', label: 'Semua' }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setFilterMode(m.id);
                  if (m.id === 'week') {
                    setFilterWeekIndex(getCurrentWeekIndex(filterYear, filterMonth));
                  }
                }}
                className={`shrink-0 px-2.5 py-1 rounded-none text-[11px] font-bold whitespace-nowrap transition-all ${
                  filterMode === m.id
                    ? 'bg-green-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                {m.label}
              </button>
            ))}
            <span className="shrink-0 ml-auto text-[10px] font-bold px-2 py-0.5 bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300 border border-green-200 dark:border-green-800 whitespace-nowrap">
              {getFilterLabel()}
            </span>
          </div>

          {/* Baris 2 (Kondisional): Sub-filter tanggal dalam 1 baris */}
          {filterMode === 'day' && (
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-3 py-1.5 border rounded-none text-xs bg-gray-50 dark:bg-gray-800 dark:border-gray-700 text-gray-800 dark:text-white font-semibold focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
          )}

          {filterMode === 'week' && (
            <div className="flex gap-1.5">
              <select
                value={filterMonth}
                onChange={(e) => { setFilterMonth(parseInt(e.target.value)); setFilterWeekIndex(0); }}
                className="flex-1 min-w-0 px-2 py-1.5 rounded-none text-xs font-semibold bg-gray-50 text-gray-800 border border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
              >
                {monthsList.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
              </select>
              <select
                value={filterYear}
                onChange={(e) => { setFilterYear(parseInt(e.target.value)); setFilterWeekIndex(0); }}
                className="w-20 px-2 py-1.5 rounded-none text-xs font-semibold bg-gray-50 text-gray-800 border border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
              >
                {yearsList.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select
                value={filterWeekIndex}
                onChange={(e) => setFilterWeekIndex(parseInt(e.target.value))}
                className="flex-1 min-w-0 px-2 py-1.5 rounded-none text-xs font-semibold bg-gray-50 text-gray-800 border border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
              >
                {getWeeksInMonth(filterYear, filterMonth).map((w, idx) => <option key={idx} value={idx}>{w.name}</option>)}
              </select>
            </div>
          )}

          {filterMode === 'month' && (
            <div className="flex gap-1.5">
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                className="flex-1 min-w-0 px-2 py-1.5 rounded-none text-xs font-semibold bg-gray-50 text-gray-800 border border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
              >
                {monthsList.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
              </select>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(parseInt(e.target.value))}
                className="w-24 px-2 py-1.5 rounded-none text-xs font-semibold bg-gray-50 text-gray-800 border border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
              >
                {yearsList.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {filterMode === 'year' && (
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(parseInt(e.target.value))}
              className="w-full px-2 py-1.5 rounded-none text-xs font-semibold bg-gray-50 text-gray-800 border border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
            >
              {yearsList.map((y) => <option key={y} value={y}>Tahun {y}</option>)}
            </select>
          )}

          {/* Baris 3: Status chips */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`shrink-0 px-2.5 py-1 rounded-none text-[11px] font-semibold transition-colors border ${
                  activeFilter === f.key
                    ? 'bg-green-600 text-white border-green-600 shadow-2xs'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/20'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4 md:px-6 max-w-7xl mx-auto pb-36 sm:pb-44">
        {isLoading && !ordersRes ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
            <LoadingSpinner 
              text="Memuat Riwayat Pesanan..." 
              subtext="Mengambil data transaksi dan status pembayaran" 
              minHeight="min-h-[160px]"
            />
          </div>
        ) : displayedGroups.length === 0 ? (
          <div className="text-center py-12 text-gray-500 flex flex-col items-center bg-white dark:bg-gray-900 rounded-none border border-gray-200 dark:border-gray-800 p-6 shadow-2xs">
            <ShoppingBag className="w-12 h-12 mb-2.5 text-gray-400 dark:text-gray-500" />
            <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-1">
              Tidak Ada Pesanan Ditemukan
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mb-3">
              {activeFilter === 'all' 
                ? `Belum ada riwayat pesanan pada periode ${getFilterLabel()}.` 
                : `Tidak ada pesanan berstatus '${filters.find(f => f.key === activeFilter)?.label}' pada periode ${getFilterLabel()}.`}
            </p>
            <div className="flex gap-2">
              {filterMode !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-none text-xs font-bold transition-all shadow-2xs cursor-pointer"
                >
                  Lihat Semua Waktu
                </button>
              )}
              <Link
                to="/dashboard/kantin"
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-none text-xs font-bold transition-all shadow-2xs"
              >
                Pesan Menu Sekarang ➔
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3">
            {displayedGroups.map(group => {
              const isMulti = group.isMultiStore;
              const singleOrder = group.orders[0];
              const cardKey = group.key;
              const isExpanded = !!expandedOrders[cardKey];
              const allPending = group.orders.every(o => o.status === 'pending');
              const isTeacherGroup = group.orders.some(o => o.order_for === 'guru' || o.is_priority);

              // Status Badges strictly using Green theme & semantic accents (AGENTS.md)
              const getOrderStatusBadge = () => {
                switch (group.overallStatus) {
                  case 'completed':
                    return {
                      label: 'Selesai',
                      cls: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/60 dark:text-green-300 dark:border-green-800'
                    };
                  case 'processing':
                    return {
                      label: 'Diproses',
                      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                    };
                  case 'cancelled':
                    return {
                      label: 'Dibatalkan',
                      cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800'
                    };
                  default:
                    return {
                      label: 'Menunggu',
                      cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                    };
                }
              };

              const getPaymentStatusBadge = () => {
                switch (group.payment_status) {
                  case 'paid':
                    return {
                      label: 'Lunas',
                      cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800'
                    };
                  case 'waiting_confirmation':
                    return {
                      label: 'Menunggu Kasir',
                      cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-400 border border-amber-200 animate-pulse'
                    };
                  default:
                    return {
                      label: 'Belum Bayar',
                      cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-200'
                    };
                }
              };

              const orderBadge = getOrderStatusBadge();
              const paymentBadge = getPaymentStatusBadge();

              // Clean duplicate item notes (e.g. "[Level 1] • [Level 1]" -> "[Level 1]")
              const cleanItemNotes = (noteStr) => {
                if (!noteStr) return '';
                const parts = noteStr.split('•').map(s => s.trim()).filter(Boolean);
                return Array.from(new Set(parts)).join(' • ');
              };

              return (
                <div 
                  key={cardKey} 
                  className={`bg-white dark:bg-gray-900 p-3 sm:p-3.5 rounded-none border shadow-2xs hover:shadow-xs transition-all space-y-2.5 ${
                    isTeacherGroup 
                      ? 'border-indigo-400 dark:border-indigo-600 ring-1 ring-indigo-400/30' 
                      : 'border-gray-200 dark:border-gray-800 hover:border-green-400 dark:hover:border-green-600'
                  }`}
                >
                  {/* Priority strip for teacher group */}
                  {isTeacherGroup && (
                    <div className="bg-gradient-to-r from-indigo-700 to-purple-700 text-white px-2.5 py-0.5 rounded-none flex items-center gap-1.5 -mx-3 sm:-mx-3.5 -mt-3 sm:-mt-3.5 mb-1 text-[10px] font-black tracking-tight">
                      <span>⚡ PESANAN PRIORITAS • GURU / STAFF YAYASAN</span>
                    </div>
                  )}

                  {/* Header: Canteen, ID, Date, & Status Badges (Gojek Style) */}
                  <div className="flex justify-between items-start gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <div className="min-w-0 flex-1">
                      {/* Merchant Title */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Store className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                        <h3 className="font-extrabold text-sm sm:text-base text-gray-900 dark:text-white truncate">
                          {isMulti ? `${group.orders.length} Toko Pesanan` : (singleOrder.canteen?.name || 'Kantin')}
                        </h3>
                      </div>

                      {/* Order ID & Date Line */}
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
                        <span className="font-semibold text-gray-600 dark:text-gray-300">
                          {group.checkoutId ? `#${group.checkoutId}` : `#ORD-${singleOrder.id}`}
                        </span>
                        <span>•</span>
                        <span>{new Date(group.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>

                      {/* Location Chip */}
                      {group.delivery_location && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500">
                          <span>📍</span>
                          <span>{isTeacherGroup ? 'Ruang Guru:' : 'Kamar:'}</span>
                          <span className="font-mono font-bold text-gray-800 dark:text-gray-200 px-1 py-0.2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                            {group.delivery_location}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Status Badges */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold border ${orderBadge.cls}`}>
                        {orderBadge.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold border ${paymentBadge.cls}`}>
                        {paymentBadge.label}
                      </span>
                    </div>
                  </div>

                  {/* Items List (Compact & Clean) */}
                  <div className="py-1 space-y-1">
                    {isMulti ? (
                      group.orders.map((order, oIdx) => (
                        <div key={order.id} className="pb-1.5 mb-1.5 border-b border-gray-100 dark:border-gray-800/80 last:border-b-0 last:mb-0">
                          <div className="flex items-center justify-between text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-0.5">
                            <span className="flex items-center gap-1 truncate">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-none shrink-0" />
                              {order.canteen?.name || `Toko ${oIdx + 1}`}
                            </span>
                            <span className="font-mono text-gray-500 text-[10px]">
                              Rp {Math.round(parseFloat(order.total_price)).toLocaleString('id-ID')}
                            </span>
                          </div>
                          {order.items?.map(item => (
                            <div key={item.id} className="flex justify-between items-start text-xs py-0.5 gap-2">
                              <div className="min-w-0 flex items-start gap-1.5">
                                <span className="text-green-700 dark:text-green-400 font-bold font-mono text-[11px] shrink-0">
                                  {item.quantity}x
                                </span>
                                <div className="min-w-0">
                                  <span className="text-gray-800 dark:text-gray-200 font-medium truncate block">
                                    {item.product?.name}
                                  </span>
                                  {item.notes && (
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 block truncate">
                                      Catatan: {cleanItemNotes(item.notes)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="font-mono text-gray-700 dark:text-gray-300 font-semibold shrink-0 text-right text-xs">
                                Rp {Math.round(parseFloat(item.subtotal)).toLocaleString('id-ID')}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))
                    ) : (
                      singleOrder.items?.map(item => (
                        <div key={item.id} className="flex justify-between items-start text-xs py-0.5 gap-2">
                          <div className="min-w-0 flex items-start gap-1.5">
                            <span className="text-green-700 dark:text-green-400 font-bold font-mono text-[11px] shrink-0">
                              {item.quantity}x
                            </span>
                            <div className="min-w-0">
                              <span className="text-gray-800 dark:text-gray-200 font-medium truncate block">
                                {item.product?.name}
                              </span>
                              {item.notes && (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 block truncate">
                                  Catatan: {cleanItemNotes(item.notes)}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="font-mono text-gray-700 dark:text-gray-300 font-semibold shrink-0 text-right text-xs">
                            Rp {Math.round(parseFloat(item.subtotal)).toLocaleString('id-ID')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* DEDICATED COMPACT DOCUMENTATION & PROOF TILES (Gojek Style) */}
                  {((group.proof_of_purchase && group.proof_of_purchase.length > 0) || 
                    (group.overallStatus === 'completed' && group.proof_of_delivery && group.proof_of_delivery.length > 0) ||
                    group.proof_of_payment || 
                    (group.overallStatus !== 'cancelled' && group.payment_status === 'unpaid')) && (
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-green-600" />
                          Bukti & Dokumentasi
                        </span>
                        <span className="text-[10px] text-gray-400">Klik untuk perbesar</span>
                      </div>

                      {/* Compact Tiles Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {/* 1. Struk Toko (Kurir) */}
                        {group.proof_of_purchase && group.proof_of_purchase.length > 0 && (() => {
                          const proofs = group.proof_of_purchase;
                          const firstProofUrl = getStorageUrl(proofs[0]);
                          const count = proofs.length;
                          const fullUrls = proofs.map(p => getStorageUrl(p));

                          return (
                            <div 
                              onClick={() => setSelectedProofs(fullUrls)}
                              className="group flex items-center justify-between gap-2 p-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/60 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none cursor-pointer transition-all active:scale-[0.99]"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-9 h-9 bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800 shrink-0 overflow-hidden flex items-center justify-center">
                                  <img 
                                    src={firstProofUrl} 
                                    alt="Struk Toko" 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                  <div className="hidden inset-0 items-center justify-center text-purple-600">
                                    <Receipt className="w-4 h-4" />
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">Struk Toko</span>
                                    <span className="text-[9px] px-1 py-0.2 bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 font-mono font-bold">{count} Foto</span>
                                  </div>
                                  <span className="text-[10px] text-gray-400 block truncate">Nota kasir kurir</span>
                                </div>
                              </div>
                              <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 shrink-0 flex items-center gap-0.5">
                                Lihat <Eye className="w-3 h-3" />
                              </span>
                            </div>
                          );
                        })()}

                        {/* 2. Foto Paket Sampai ke Santri */}
                        {group.overallStatus === 'completed' && group.proof_of_delivery && group.proof_of_delivery.length > 0 && (() => {
                          const proofs = group.proof_of_delivery;
                          const firstProofUrl = getStorageUrl(proofs[0]);
                          const count = proofs.length;
                          const fullUrls = proofs.map(p => getStorageUrl(p));

                          return (
                            <div 
                              onClick={() => setSelectedProofs(fullUrls)}
                              className="group flex items-center justify-between gap-2 p-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/60 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none cursor-pointer transition-all active:scale-[0.99]"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 shrink-0 overflow-hidden flex items-center justify-center">
                                  <img 
                                    src={firstProofUrl} 
                                    alt="Foto Paket" 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                  <div className="hidden inset-0 items-center justify-center text-blue-600">
                                    <Camera className="w-4 h-4" />
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">Paket Santri</span>
                                    <span className="text-[9px] px-1 py-0.2 bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 font-mono font-bold">{count} Foto</span>
                                  </div>
                                  <span className="text-[10px] text-gray-400 block truncate">Bukti serah terima</span>
                                </div>
                              </div>
                              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 shrink-0 flex items-center gap-0.5">
                                Lihat <Eye className="w-3 h-3" />
                              </span>
                            </div>
                          );
                        })()}

                        {/* 3. Bukti Transfer Anda */}
                        {group.proof_of_payment && (() => {
                          const proofs = Array.isArray(group.proof_of_payment) ? group.proof_of_payment : [group.proof_of_payment];
                          const firstProofUrl = getStorageUrl(proofs[0]);
                          const count = proofs.length;
                          const fullUrls = proofs.map(p => getStorageUrl(p));
                          const isPaid = group.payment_status === 'paid';
                          const isWaiting = group.payment_status === 'waiting_confirmation';

                          return (
                            <div 
                              onClick={() => setSelectedProofs(fullUrls)}
                              className="group flex items-center justify-between gap-2 p-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/60 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none cursor-pointer transition-all active:scale-[0.99]"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 shrink-0 overflow-hidden flex items-center justify-center">
                                  <img 
                                    src={firstProofUrl} 
                                    alt="Bukti Transfer" 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                  <div className="hidden inset-0 items-center justify-center text-emerald-600">
                                    <ImageIcon className="w-4 h-4" />
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">Bukti Transfer</span>
                                    <span className={`text-[9px] px-1 py-0.2 font-mono font-bold ${
                                      isPaid 
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300' 
                                        : isWaiting 
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 animate-pulse' 
                                        : 'bg-gray-100 text-gray-600'
                                    }`}>
                                      {isPaid ? 'Lunas' : isWaiting ? 'Menunggu' : `${count} Foto`}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-gray-400 block truncate">
                                    {isPaid ? 'Divalidasi kasir' : isWaiting ? 'Menunggu kasir' : 'Transfer bank'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[11px] font-bold text-green-600 dark:text-green-400 flex items-center gap-0.5">
                                  Lihat <Eye className="w-3 h-3" />
                                </span>
                                {group.overallStatus !== 'cancelled' && group.payment_status !== 'paid' && (
                                  (() => {
                                    const closedCanteens = getClosedCanteensInfo(group.orders) || [];
                                    const isAllOpen = closedCanteens.length === 0;
                                    return (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!isAllOpen) {
                                            toast.error(`Toko sedang tutup. Silakan upload bukti pembayaran besok saat toko buka (${closedCanteens.map(c => `${c.name}: ${c.hours}`).join(', ')})`);
                                            return;
                                          }
                                          setActiveOrderForPaymentProof({
                                            id: singleOrder.id,
                                            checkoutId: group.checkoutId,
                                            total_price: group.grandTotal,
                                            displayId: group.checkoutId || `#${singleOrder.id}`,
                                            canteenCount: group.orders.length
                                          });
                                          setShowPaymentProofModal(true);
                                        }}
                                        className={`px-1.5 py-0.5 rounded-none text-[10px] font-bold transition-colors ${
                                          isAllOpen 
                                            ? 'bg-green-600 text-white hover:bg-green-700' 
                                            : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                                        }`}
                                        title={isAllOpen ? "Tambah bukti transfer" : "Toko tutup (upload besok)"}
                                      >
                                        +
                                      </button>
                                    );
                                  })()
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* 4. Compact Upload Bar (Jika belum bayar dan belum upload bukti) */}
                      {group.overallStatus !== 'cancelled' && group.payment_status === 'unpaid' && !group.proof_of_payment && (
                        (() => {
                          const closedCanteens = getClosedCanteensInfo(group.orders) || [];
                          const isAllOpen = closedCanteens.length === 0;

                          return (
                            <div className="space-y-1.5 pt-1">
                              {isAllOpen ? (
                                <button 
                                  type="button"
                                  onClick={() => {
                                    setActiveOrderForPaymentProof({
                                      id: singleOrder.id,
                                      checkoutId: group.checkoutId,
                                      total_price: group.grandTotal,
                                      displayId: group.checkoutId || `#${singleOrder.id}`,
                                      canteenCount: group.orders.length
                                    });
                                    setShowPaymentProofModal(true);
                                  }}
                                  className="w-full flex items-center justify-between py-2 px-2.5 bg-green-600 hover:bg-green-700 text-white rounded-none transition-all font-bold text-xs shadow-xs active:scale-[0.99] cursor-pointer"
                                >
                                  <span className="flex items-center gap-1.5 truncate">
                                    <Camera className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">
                                      {isMulti ? `Upload Bukti Pembayaran (${group.orders.length} Toko)` : 'Upload Bukti Pembayaran'}
                                    </span>
                                  </span>
                                  <span className="font-mono text-[11px] font-black shrink-0 ml-2">
                                    Rp {Math.round(group.grandTotal).toLocaleString('id-ID')} ➔
                                  </span>
                                </button>
                              ) : (
                                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-none text-left space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold text-xs">
                                    <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                                    <span>Toko Sedang Tutup</span>
                                  </div>
                                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
                                    Upload bukti pembayaran ditutup saat malam / di luar jam buka. Silakan upload besok saat toko sudah buka kembali:
                                  </p>
                                  <div className="bg-white/90 dark:bg-black/40 p-1.5 border border-amber-200 dark:border-amber-900/60 rounded-none space-y-1 text-[10px] font-mono text-amber-900 dark:text-amber-200">
                                    {closedCanteens.map((c, i) => (
                                      <div key={i} className="flex justify-between items-center">
                                        <span className="font-semibold truncate mr-2">• {c.name}</span>
                                        <span className="shrink-0 font-bold">{c.hours}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    disabled
                                    className="w-full py-1.5 bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-none text-xs font-bold cursor-not-allowed text-center"
                                  >
                                    Upload Ditutup (Buka Besok)
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  )}

                  {/* Rincian Biaya & Total (Compact) */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
                    <button 
                      onClick={() => toggleOrderDetails(cardKey)}
                      className="w-full flex items-center justify-between text-[11px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    >
                      <span className="font-semibold">Rincian Biaya</span>
                      <span className="text-[10px] font-mono font-bold text-gray-600 dark:text-gray-300">
                        {isExpanded ? 'Tutup ⌃' : 'Detail ⌄'}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-none border border-gray-200 dark:border-gray-700/80">
                        <div className="flex justify-between">
                          <span>Subtotal Produk {isMulti ? `(${group.orders.length} Toko)` : ''}</span>
                          <span className="font-semibold font-mono text-gray-900 dark:text-white">
                            Rp {Math.round(group.totalProductSubtotal).toLocaleString('id-ID')}
                          </span>
                        </div>
                        {group.totalDeliveryFee > 0 && (
                          <div className="flex justify-between">
                            <span>Ongkos Kirim {isMulti ? `(${group.orders.length} Toko)` : '(Kurir)'}</span>
                            <span className="font-semibold font-mono text-gray-900 dark:text-white">
                              Rp {Math.round(group.totalDeliveryFee).toLocaleString('id-ID')}
                            </span>
                          </div>
                        )}
                        {group.totalAdminFee > 0 && (
                          <div className="flex justify-between">
                            <span>Biaya Layanan & Admin {isMulti ? `(${group.orders.length} Toko)` : ''}</span>
                            <span className="font-semibold font-mono text-gray-900 dark:text-white">
                              Rp {Math.round(group.totalAdminFee).toLocaleString('id-ID')}
                            </span>
                          </div>
                        )}

                        {isMulti && (
                          <div className="pt-1 mt-1 border-t border-gray-200 dark:border-gray-700 space-y-0.5 text-[11px]">
                            <span className="font-bold text-gray-700 dark:text-gray-300 block">Rincian Per Toko:</span>
                            {group.orders.map(o => (
                              <div key={o.id} className="flex justify-between text-gray-500 dark:text-gray-400">
                                <span>{o.canteen?.name || `Toko #${o.canteen_id}`}</span>
                                <span className="font-mono font-medium text-gray-800 dark:text-gray-200">
                                  Rp {Math.round(parseFloat(o.total_price)).toLocaleString('id-ID')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Total Pembayaran */}
                    <div className="flex justify-between items-baseline pt-0.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-bold">
                        Total {isMulti ? `(${group.orders.length} Toko)` : 'Pesanan'}
                      </span>
                      <span className="font-black font-mono text-green-700 dark:text-green-400 text-sm sm:text-base">
                        Rp {Math.round(group.grandTotal).toLocaleString('id-ID')}
                      </span>
                    </div>

                    {/* Action Buttons: Struk, Chat Toko, Chat Kurir */}
                    <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-800">
                      <button
                        type="button"
                        onClick={() => handleOpenReceipt(group)}
                        className="flex-1 min-w-[85px] flex items-center justify-center gap-1 py-1.5 px-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-none text-xs font-bold transition-all active:scale-[0.98] cursor-pointer"
                        title="Lihat & Cetak Struk Digital"
                      >
                        <Receipt className="w-3.5 h-3.5 text-green-600 dark:text-green-400" /> 
                        <span>Struk</span>
                      </button>

                      {/* Chat Toko (Tampil untuk single toko maupun multi toko) */}
                      {!isMulti ? (
                        (() => {
                          const phone = singleOrder.canteen?.whatsapp_number || singleOrder.canteen?.user?.phone;
                          if (!phone) return null;
                          return (
                            <a 
                              href={formatPhoneWA(phone) + `?text=${encodeURIComponent(buildOrderWAText(singleOrder))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 min-w-[85px] flex items-center justify-center gap-1 py-1.5 px-2 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-300 dark:hover:bg-green-900/50 border border-green-200 dark:border-green-800 rounded-none text-xs font-bold transition-all active:scale-[0.98]"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400" /> 
                              <span>Chat Toko</span>
                            </a>
                          );
                        })()
                      ) : (
                        group.orders.map(order => {
                          const phone = order.canteen?.whatsapp_number || order.canteen?.user?.phone;
                          if (!phone) return null;
                          const cName = order.canteen?.name || 'Toko';
                          return (
                            <a 
                              key={`chat-canteen-${order.id}`}
                              href={formatPhoneWA(phone) + `?text=${encodeURIComponent(buildOrderWAText(order))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 min-w-[95px] flex items-center justify-center gap-1 py-1.5 px-2 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-300 dark:hover:bg-green-900/50 border border-green-200 dark:border-green-800 rounded-none text-[11px] font-bold transition-all active:scale-[0.98] truncate"
                              title={`Chat WhatsApp ke ${cName}`}
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" /> 
                              <span className="truncate">Chat {cName}</span>
                            </a>
                          );
                        })
                      )}
                      {(() => {
                        const courierOrder = group.orders.find(o => o.courier?.phone);
                        if (courierOrder && group.overallStatus !== 'cancelled') {
                          return (
                            <a 
                              href={formatPhoneWA(courierOrder.courier.phone) + `?text=${encodeURIComponent(buildCourierWAText(group))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 min-w-[85px] flex items-center justify-center gap-1 py-1.5 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-none text-xs font-bold transition-all active:scale-[0.98]"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> 
                              <span>Chat Kurir</span>
                            </a>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    
                    {/* Cancel Button */}
                    {allPending && (
                      <div className="pt-1">
                        <button 
                          onClick={() => handleCancelGroup(group.orders)}
                          disabled={cancelMutation.isPending}
                          className="w-full flex items-center justify-center gap-1 py-1.5 px-2 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-none text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" /> 
                          {cancelMutation.isPending ? 'Membatalkan...' : `Batalkan Pesanan ${isMulti ? `(${group.orders.length} Toko)` : ''}`}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>

      {/* PRODUCT DETAIL FULL-SCREEN MODAL */}
      {selectedProduct && createPortal(
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-950 flex flex-col animate-in slide-in-from-bottom-full duration-300">
          {/* Header & Image */}
          <div className="relative h-64 sm:h-80 bg-gray-100 dark:bg-gray-900 shrink-0">
            {selectedProduct.image ? (
              <img src={getStorageUrl(selectedProduct.image)} alt={selectedProduct.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-700">
                <Store className="w-20 h-20" />
              </div>
            )}
            
            {/* Back Button Overlay */}
            <button 
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 left-4 w-10 h-10 bg-black/40 backdrop-blur-md rounded-none flex items-center justify-center text-white z-10 hover:bg-black/50 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20">
            <div className="max-w-3xl mx-auto">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white pr-4">{selectedProduct.name}</h2>
                {selectedProduct.discount_price && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded">PROMO</span>
                )}
              </div>
              
              <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
                <span>{selectedProduct.category || 'Makanan'}</span>
                <span>•</span>
                <span>Disukai oleh banyak santri</span>
              </div>
              
              <div className="flex items-center mb-6">
                {selectedProduct.discount_price ? (
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-400 line-through">Rp {parseFloat(selectedProduct.price).toLocaleString('id-ID')}</span>
                    <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                      Rp {parseFloat(selectedProduct.discount_price).toLocaleString('id-ID')}
                    </span>
                  </div>
                ) : (
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    Rp {parseFloat(selectedProduct.price).toLocaleString('id-ID')}
                  </span>
                )}
              </div>
              
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Deskripsi Produk</h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {selectedProduct.description || 'Tidak ada deskripsi detail untuk produk ini.'}
                </p>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PROOF OF DELIVERY / PAYMENT FULL-SCREEN MODAL */}
      {selectedProofs.length > 0 && createPortal(
        <div 
          className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-xs flex flex-col animate-in fade-in duration-200"
          onClick={() => setSelectedProofs([])}
        >
          {/* Header */}
          <div 
            className="flex justify-between items-center px-4 py-3 bg-black/80 border-b border-white/10 shrink-0 sticky top-0 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-white font-bold text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-400" />
              {selectedProofs.length} Berkas Bukti
            </span>
            <button 
              type="button"
              onClick={() => setSelectedProofs([])}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 rounded-none flex items-center gap-1.5 text-white transition-all text-xs font-bold shadow-xs cursor-pointer"
              title="Tutup Bukti (Esc)"
            >
              <X className="w-4 h-4" />
              <span>Tutup</span>
            </button>
          </div>
          
          {/* Images & Documents */}
          <div 
            className="flex-1 overflow-y-auto flex flex-col items-center gap-4 p-4 pb-16"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedProofs.map((proof, idx) => {
              const fileType = getFileType(proof);
              const fileName = getFileNameFromPath(proof);

              if (fileType === 'pdf') {
                return (
                  <div key={idx} className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-none p-4 flex flex-col items-center gap-3 shadow-xl">
                    <div className="w-full flex items-center justify-between text-xs text-gray-400 border-b border-gray-800 pb-2">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-red-400" /> Bukti {idx + 1}: {fileName}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-red-900/40 text-red-300 rounded-none font-mono text-[10px]">PDF</span>
                        <button
                          type="button"
                          onClick={() => setSelectedProofs([])}
                          className="p-1 text-red-400 hover:text-white hover:bg-red-600/40 rounded-none transition-colors"
                          title="Tutup Bukti"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <iframe 
                      src={proof} 
                      title={`Bukti PDF ${idx + 1}`} 
                      className="w-full h-[55vh] rounded-none bg-white border border-gray-700" 
                    />
                    <div className="w-full flex gap-2">
                      <a
                        href={proof}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-700 active:scale-98 text-white rounded-none text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md"
                      >
                        <ExternalLink className="w-4 h-4" /> Buka / Unduh Dokumen PDF
                      </a>
                      <button
                        type="button"
                        onClick={() => setSelectedProofs([])}
                        className="py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-none text-xs font-bold transition-all"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                );
              }

              if (fileType === 'image') {
                return (
                  <div key={idx} className="w-full max-w-xl bg-gray-900/60 border border-white/5 rounded-none p-2.5 flex flex-col items-center gap-2">
                    <div className="w-full flex items-center justify-between px-2 text-xs text-gray-400">
                      <span className="font-semibold text-white/90">Bukti {idx + 1}</span>
                      <div className="flex items-center gap-1.5">
                        <button 
                          type="button"
                          onClick={() => setFullscreenImage(proof)}
                          className="px-2.5 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 hover:text-green-300 rounded-none text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 border border-green-500/30"
                          title="Buka Pratinjau Layar Penuh"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Buka Gambar Penuh</span>
                        </button>
                        <a 
                          href={proof} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="p-1 text-gray-400 hover:text-white rounded-none hover:bg-white/10 transition-colors"
                          title="Buka di Tab Baru"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button 
                          type="button"
                          onClick={() => setSelectedProofs([])}
                          className="p-1 text-red-400 hover:text-white hover:bg-red-600/40 rounded-none transition-colors ml-0.5"
                          title="Tutup Pratinjau"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <img 
                      src={proof}
                      alt={`Bukti ${idx + 1}`}
                      onClick={() => setFullscreenImage(proof)}
                      className="w-full rounded-none shadow-2xl object-contain bg-black/40 cursor-zoom-in hover:brightness-105 transition-all"
                      style={{ maxHeight: '75vh' }}
                      title="Klik gambar untuk memperbesar"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div
                      style={{ display: 'none' }}
                      className="w-full h-48 rounded-none bg-gray-800 flex flex-col items-center justify-center text-gray-400 text-sm gap-2"
                    >
                      <ImageIcon className="w-10 h-10 opacity-40" />
                      <span>Gambar tidak dapat dimuat langsung</span>
                      <a href={proof} target="_blank" rel="noreferrer" className="text-green-400 text-xs underline break-all px-4 text-center">Buka Berkas ({fileName})</a>
                    </div>
                  </div>
                );
              }

              // HEIF / Document / Spreadsheet / Archive / Other File
              return (
                <div key={idx} className="w-full max-w-xl bg-gray-900 border border-gray-800 rounded-none p-5 flex flex-col items-center gap-4 text-center shadow-xl">
                  <div className="w-16 h-16 rounded-none bg-green-950/60 border border-green-800/50 flex items-center justify-center text-green-400">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm break-all">{fileName}</p>
                    <p className="text-gray-400 text-xs mt-1">Berkas Bukti Pembayaran #{idx + 1}</p>
                  </div>
                  <div className="w-full flex gap-2">
                    <a
                      href={proof}
                      target="_blank"
                      download
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-700 active:scale-98 text-white rounded-none text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md"
                    >
                      <Download className="w-4 h-4" /> Unduh / Buka Berkas
                    </a>
                    <button
                      type="button"
                      onClick={() => setSelectedProofs([])}
                      className="py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-none text-xs font-bold transition-all"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Bottom Close Button */}
            <div className="w-full max-w-xl pt-2">
              <button
                type="button"
                onClick={() => setSelectedProofs([])}
                className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-none text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-gray-700"
              >
                <X className="w-4 h-4 text-red-400" />
                <span>Tutup Pratinjau Bukti</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ULTRA FULLSCREEN IMAGE LIGHTBOX MODAL */}
      {fullscreenImage && createPortal(
        <div 
          className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-md flex flex-col animate-in fade-in duration-200"
          onClick={() => setFullscreenImage(null)}
        >
          {/* Top Bar */}
          <div 
            className="flex items-center justify-between px-4 py-3 bg-black/80 border-b border-white/10 shrink-0 z-10"
            onClick={e => e.stopPropagation()}
          >
            <span className="text-white text-xs font-semibold flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-green-400" />
              Pratinjau Layar Penuh
            </span>
            <div className="flex items-center gap-2">
              <a 
                href={fullscreenImage} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-none bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-all"
                title="Buka di Tab Baru"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Tab Baru</span>
              </a>
              <a 
                href={fullscreenImage} 
                download
                className="px-3 py-1.5 rounded-none bg-green-600 hover:bg-green-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                title="Unduh Gambar"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh</span>
              </a>
              <button 
                onClick={() => setFullscreenImage(null)}
                className="w-9 h-9 rounded-none bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-90 ml-1"
                title="Tutup (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Centered Large Image */}
          <div className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-auto">
            <img 
              src={fullscreenImage} 
              alt="Bukti Layar Penuh" 
              className="max-w-full max-h-[85vh] sm:max-h-[90vh] object-contain rounded-none shadow-2xl select-none"
              onClick={e => e.stopPropagation()}
            />
          </div>
          
          <div className="py-2.5 text-center text-gray-400 text-xs shrink-0 bg-black/40">
            Ketuk tombol ✕ atau area luar untuk menutup layar penuh
          </div>
        </div>,
        document.body
      )}

      {/* UPLOAD PAYMENT PROOF MODAL */}
      {showPaymentProofModal && activeOrderForPaymentProof && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/60 flex flex-col justify-end animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 w-full rounded-t-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-8 duration-300">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-900 z-10">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">Upload Bukti Transfer</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {activeOrderForPaymentProof.displayId || `Order #${activeOrderForPaymentProof.id}`}
                  {activeOrderForPaymentProof.canteenCount > 1 && ` • ${activeOrderForPaymentProof.canteenCount} Toko`}
                </p>
              </div>
              <button onClick={() => {setShowPaymentProofModal(false); setPaymentProofFiles([]);}} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-none hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {activeOrderForPaymentProof?.orders && !activeOrderForPaymentProof.orders.every(o => isPaymentTime(o)) && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs rounded-none">
                  <div className="flex items-center gap-1.5 font-bold mb-1 text-amber-800 dark:text-amber-300">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Toko Sedang Tutup — Upload Ditangguhkan</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                    {getClosedCanteensInfo(activeOrderForPaymentProof.orders)?.map(c => c.toString()).join('; ')}
                    <br />
                    Silakan unggah bukti pembayaran besok saat toko sudah buka kembali sesuai jam operasional di atas.
                  </p>
                </div>
              )}

              <div className="mb-6 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                  Silakan scan QRIS di bawah ini untuk membayar sebesar
                </p>
                {activeOrderForPaymentProof.canteenCount > 1 && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-2">
                    (1 kali transfer untuk seluruh {activeOrderForPaymentProof.canteenCount} toko)
                  </p>
                )}
                <p className="text-2xl font-black text-green-600 dark:text-green-400 mb-3">
                  Rp {parseFloat(activeOrderForPaymentProof.total_price).toLocaleString('id-ID')}
                </p>
                <div 
                  onClick={() => setSelectedProofs([getPublicUrl('QRISkantinalhidayah.jpeg')])}
                  className="border-2 border-dashed border-green-400 dark:border-green-600 p-3 rounded-none inline-block bg-white shadow-md hover:shadow-lg cursor-pointer group transition-all"
                  title="Klik untuk memperbesar QRIS"
                >
                  <img src={getPublicUrl('QRISkantinalhidayah.jpeg')} alt="QRIS Pembayaran" className="w-52 h-52 object-contain group-hover:scale-105 transition-transform rounded-none" />
                  <p className="text-xs font-bold text-green-600 dark:text-green-500 mt-2 flex items-center justify-center gap-1">
                    🔍 Klik QRIS untuk Memperbesar
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="block text-sm font-bold text-gray-800 dark:text-gray-200">
                      Pilih Foto Bukti Transfer <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Bebas Format (JPG, PNG, HEIC, PDF)
                    </span>
                  </div>

                  {/* Hidden Input Files with Dedicated Ref for 100% Mobile Reliability */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png,.webp,.pdf"
                    multiple
                    disabled={isCompressing}
                    onChange={(e) => {
                      handleFileSelection(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={isCompressing}
                    onChange={(e) => {
                      handleFileSelection(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />

                  {/* Tombol Sentuh Besar untuk Mobile & Desktop */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={isCompressing}
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex flex-col items-center justify-center p-3.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border-2 border-dashed border-emerald-400/60 dark:border-emerald-700/60 rounded-none text-emerald-800 dark:text-emerald-300 active:scale-98 transition-all gap-1.5 shadow-xs cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-none bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                        <Camera className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold">Buka Kamera</span>
                      <span className="text-[10px] text-emerald-600/90 dark:text-emerald-400">Foto Langsung</span>
                    </button>

                    <button
                      type="button"
                      disabled={isCompressing}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center p-3.5 bg-green-50 hover:bg-green-100 dark:bg-green-950/40 dark:hover:bg-green-900/50 border-2 border-dashed border-green-400/60 dark:border-green-700/60 rounded-none text-green-800 dark:text-green-300 active:scale-98 transition-all gap-1.5 shadow-xs cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-none bg-green-600 text-white flex items-center justify-center shadow-xs">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold">Pilih dari Galeri</span>
                      <span className="text-[10px] text-green-600/90 dark:text-green-400">Pilih Foto / Berkas</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 text-center">
                    ✨ Otomatis dikompresi agar hemat kuota & cepat terunggah.
                  </p>
                </div>

                {paymentProofFiles.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Berkas Dipilih ({paymentProofFiles.length}):
                    </p>
                    <div className="grid grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                      {paymentProofFiles.map((file, idx) => {
                        const isImg = isImageFile(file);
                        const isPdf = isPdfFile(file);
                        const isHeif = isHeifFile(file);

                        return (
                          <div key={idx} className="relative rounded-none overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-2 flex flex-col justify-between group">
                            {isImg ? (
                              <div className="aspect-video w-full rounded-none overflow-hidden bg-black/5 mb-1.5">
                                <img src={URL.createObjectURL(file)} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="aspect-video w-full rounded-none bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/40 flex flex-col items-center justify-center text-green-600 dark:text-green-400 mb-1.5">
                                <FileText className="w-6 h-6" />
                                <span className="text-[10px] font-mono font-bold mt-0.5 uppercase">
                                  {isPdf ? 'PDF' : isHeif ? 'HEIF' : file.name.split('.').pop() || 'FILE'}
                                </span>
                              </div>
                            )}

                            <div className="pr-6">
                              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate" title={file.name}>
                                {file.name}
                              </p>
                              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                                <span>{formatFileSize(file.size)}</span>
                                {file.originalSize && file.originalSize > file.size && (
                                  <span className="text-green-600 dark:text-green-400 font-bold">
                                    (Hemat {Math.round((1 - file.size / file.originalSize) * 100)}%)
                                  </span>
                                )}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => setPaymentProofFiles(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-none shadow-md transition-transform active:scale-95 z-10"
                              title="Hapus berkas ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 sticky bottom-0 bg-white dark:bg-gray-900">
              <button 
                onClick={() => {setShowPaymentProofModal(false); setPaymentProofFiles([]);}}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-none font-bold text-sm"
              >
                Batal
              </button>
              <button 
                type="button"
                disabled={
                  paymentProofFiles.length === 0 || 
                  uploadPaymentProofMutation.isPending || 
                  isCompressing || 
                  Boolean(activeOrderForPaymentProof?.orders && !activeOrderForPaymentProof.orders.every(o => isPaymentTime(o)))
                }
                onClick={() => {
                  if (activeOrderForPaymentProof?.orders && !activeOrderForPaymentProof.orders.every(o => isPaymentTime(o))) {
                    toast.error("Toko sedang tutup. Silakan upload bukti pembayaran besok saat toko buka.");
                    return;
                  }
                  const formData = new FormData();
                  paymentProofFiles.forEach((file) => {
                    formData.append('proof_of_payment[]', file);
                  });
                  uploadPaymentProofMutation.mutate({ 
                    id: activeOrderForPaymentProof.id, 
                    checkoutId: activeOrderForPaymentProof.checkoutId,
                    formData 
                  });
                }}
                className="flex-[2] py-3 bg-green-600 hover:bg-green-700 text-white rounded-none font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm text-sm"
              >
                {uploadPaymentProofMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent inline-block"></span>
                    <span>Mengunggah ({paymentProofFiles.length} berkas)...</span>
                  </span>
                ) : isCompressing ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent inline-block"></span>
                    <span>Mengompresi...</span>
                  </span>
                ) : (activeOrderForPaymentProof?.orders && !activeOrderForPaymentProof.orders.every(o => isPaymentTime(o))) ? (
                  <span className="flex items-center gap-2 text-amber-200">
                    <Clock className="w-4 h-4" />
                    <span>Toko Tutup (Upload Besok)</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span>{paymentProofFiles.length > 0 ? `Unggah (${paymentProofFiles.length}) Bukti` : 'Unggah Bukti'}</span>
                    <CheckCircle className="w-4 h-4" />
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* THERMAL DIGITAL RECEIPT MODAL */}
      <ThermalReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        mode={receiptModalMode}
        order={selectedReceiptOrder}
        orders={selectedReceiptOrders}
        title="Struk Belanja Santri"
      />
    </div>
  );
}
