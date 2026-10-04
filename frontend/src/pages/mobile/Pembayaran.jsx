import React, { useState, useMemo, useRef } from 'react';
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
    if (!order?.canteen?.open_time || !order?.canteen?.close_time) {
      // Default fallback jika data jam buka/tutup tidak tersedia
      const hour = new Date().getHours();
      return hour >= 9 && hour < 17;
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    
    // Parse open_time (e.g. "09:00:00" atau "09:00")
    const openParts = order.canteen.open_time.split(':');
    const openTime = parseInt(openParts[0]) * 60 + parseInt(openParts[1]);
    
    // Parse close_time (e.g. "17:00:00" atau "17:00")
    const closeParts = order.canteen.close_time.split(':');
    const closeTime = parseInt(closeParts[0]) * 60 + parseInt(closeParts[1]);
    
    return currentTime >= openTime && currentTime <= closeTime;
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

  // Gojek-style Activity Tabs: 'in_progress' (Dalam Proses) vs 'history' (Riwayat Selesai)
  const [activityTab, setActivityTab] = useState('in_progress');

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

  const inProgressGroups = useMemo(() => {
    return checkoutGroups.filter(g => 
      g.overallStatus === 'pending' || 
      g.overallStatus === 'processing' || 
      g.payment_status === 'waiting_confirmation' || 
      g.payment_status === 'unpaid'
    );
  }, [checkoutGroups]);

  const historyGroups = useMemo(() => {
    return checkoutGroups.filter(g => 
      (g.overallStatus === 'completed' || g.overallStatus === 'cancelled') &&
      g.payment_status !== 'unpaid' &&
      g.payment_status !== 'waiting_confirmation'
    );
  }, [checkoutGroups]);

  const displayedGroups = activityTab === 'in_progress' ? inProgressGroups : historyGroups;

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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

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

        {/* GOJEK-STYLE 2 SEGMENTED ACTIVITY TABS */}
        <div className="grid grid-cols-2 p-1 bg-gray-100 dark:bg-gray-800 border-t border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setActivityTab('in_progress')}
            className={`py-2 text-xs font-black uppercase tracking-wider rounded-none transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activityTab === 'in_progress'
                ? 'bg-white dark:bg-gray-900 text-green-700 dark:text-green-400 shadow-xs border border-gray-200 dark:border-gray-700'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span>Dalam Proses</span>
            {inProgressGroups.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-green-600 text-white font-mono rounded-none">
                {inProgressGroups.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActivityTab('history')}
            className={`py-2 text-xs font-black uppercase tracking-wider rounded-none transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activityTab === 'history'
                ? 'bg-white dark:bg-gray-900 text-green-700 dark:text-green-400 shadow-xs border border-gray-200 dark:border-gray-700'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span>Riwayat Selesai</span>
            {historyGroups.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-mono rounded-none">
                {historyGroups.length}
              </span>
            )}
          </button>
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

      <div className="p-3 sm:p-4 md:px-6 max-w-7xl mx-auto">
        {displayedGroups.length === 0 ? (
          activityTab === 'in_progress' ? (
            <div className="text-center py-12 text-gray-500 flex flex-col items-center bg-white dark:bg-gray-900 rounded-none border border-gray-200 dark:border-gray-800 p-6 shadow-2xs">
              <Clock className="w-14 h-14 mb-3 text-green-600/60 dark:text-green-400/60" />
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-1">
                Tidak Ada Pesanan yang Sedang Berjalan
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mb-3">
                Semua pesanan Anda telah tuntas atau Anda belum membuat pesanan baru hari ini.
              </p>
              <div className="flex gap-2">
                {historyGroups.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActivityTab('history')}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-none text-xs font-bold transition-all shadow-2xs"
                  >
                    Lihat Riwayat Selesai ({historyGroups.length})
                  </button>
                )}
                <Link
                  to="/dashboard/kantin"
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-none text-xs font-bold transition-all shadow-2xs"
                >
                  Pesan Menu ➔
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 flex flex-col items-center bg-white dark:bg-gray-900 rounded-none border border-gray-200 dark:border-gray-800 p-6 shadow-2xs">
              <ShoppingBag className="w-14 h-14 mb-3 text-gray-300 dark:text-gray-600" />
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-1">
                Belum Ada Riwayat Transaksi Selesai
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mb-3">
                {activeFilter === 'all' 
                  ? `Belum ada pesanan selesai pada periode ${getFilterLabel()}.` 
                  : `Tidak ada pesanan selesai berstatus '${filters.find(f=>f.key===activeFilter)?.label}' pada periode ${getFilterLabel()}.`}
              </p>
              {filterMode !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className="px-3 py-1.5 bg-green-50 hover:bg-green-100 dark:bg-green-950/60 dark:hover:bg-green-900 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-none text-xs font-bold transition-all shadow-2xs"
                >
                  Lihat Semua Waktu
                </button>
              )}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 sm:gap-3">
            {displayedGroups.map(group => {
              const isMulti = group.isMultiStore;
              const singleOrder = group.orders[0];
              const cardKey = group.key;
              const isExpanded = !!expandedOrders[cardKey];
              const allPending = group.orders.every(o => o.status === 'pending');

              const isTeacherGroup = group.orders.some(o => o.order_for === 'guru' || o.is_priority);

              return (
                <div key={cardKey} className={`bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-none border shadow-sm hover:shadow-md transition-all space-y-3 ${
                  isTeacherGroup 
                    ? 'border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-400/30 hover:border-indigo-600' 
                    : 'border-green-300/90 dark:border-green-800 hover:border-green-500 dark:hover:border-green-600'
                }`}>
                  {/* Priority strip for teacher group */}
                  {isTeacherGroup && (
                    <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 text-white px-3 py-1 rounded-none flex items-center gap-2 -mx-4 sm:-mx-5 -mt-4 sm:-mt-5 mb-0 shadow-xs">
                      <span className="text-[11px] font-black tracking-tight">⚡ PESANAN PRIORITAS • GURU / STAFF YAYASAN</span>
                    </div>
                  )}
                  {/* Header: ID, Date, Canteen Name & Status Badges */}

                  <div className="flex justify-between items-start gap-2 pb-3 border-b border-gray-200 dark:border-gray-700/80">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap text-xs text-gray-500 mb-1">
                        <span className="font-bold text-gray-800 dark:text-gray-200">
                          {group.checkoutId ? `Checkout #${group.checkoutId}` : `Order #${singleOrder.id}`}
                        </span>
                        <span>•</span>
                        <span>{new Date(group.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>

                      {isMulti ? (
                        <div>
                          <h3 className="font-extrabold text-base sm:text-lg text-gray-900 dark:text-white flex items-center gap-1.5">
                            <Store className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                            <span>{group.orders.length} Toko Pesanan</span>
                          </h3>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                            {group.orders.map(o => o.canteen?.name).filter(Boolean).join(' • ')}
                          </p>
                        </div>
                      ) : (
                        <h3 className="font-extrabold text-base sm:text-lg text-gray-900 dark:text-white flex items-center gap-1.5">
                          <Store className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                          {singleOrder.canteen?.name || 'Kantin'}
                        </h3>
                      )}

                      {group.delivery_location && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span>📍</span> 
                          <span className="font-semibold text-gray-700 dark:text-gray-300">
                            {isTeacherGroup ? 'Antar Langsung Guru/Staff:' : 'Kamar Santri:'}
                          </span>
                          <span className={`font-mono font-bold px-1 border text-xs ${
                            isTeacherGroup 
                              ? 'text-indigo-900 dark:text-indigo-200 bg-indigo-100 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700' 
                              : 'text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                          }`}>
                            {group.delivery_location}
                          </span>
                          {isTeacherGroup && (
                            <span className="text-[10px] bg-amber-400 text-indigo-950 font-black px-1.5 py-0.2 uppercase">
                              ⚡ Prioritas
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {/* Payment Status Badge */}
                      <div className={`px-2.5 py-0.5 rounded-none text-[10px] font-bold shadow-2xs ${
                        group.payment_status === 'paid' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800' 
                          : group.payment_status === 'waiting_confirmation'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-400 animate-pulse border border-amber-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-200'
                      }`}>
                        {group.payment_status === 'paid' 
                          ? 'Sudah Dibayar' 
                          : group.payment_status === 'waiting_confirmation' 
                            ? 'Menunggu Validasi Toko' 
                            : 'Belum Bayar'}
                      </div>

                      {/* Order Status Badge */}
                      <div className={`px-2.5 py-0.5 rounded-none text-[10px] font-bold border ${
                        group.overallStatus === 'completed' 
                          ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800' 
                          : group.overallStatus === 'processing' 
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800' 
                          : group.overallStatus === 'cancelled'
                          ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800'
                          : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                      }`}>
                        {group.overallStatus === 'pending' ? 'Menunggu Konfirmasi' : 
                         group.overallStatus === 'processing' ? 'Sedang Diproses' : 
                         group.overallStatus === 'completed' ? 'Selesai' : 
                         group.overallStatus === 'cancelled' ? 'Dibatalkan' : group.overallStatus}
                      </div>
                    </div>
                  </div>

                  {/* Items List Box */}
                  <div className="space-y-2 py-1">
                    {isMulti ? (
                      // Multi-store: Render per-canteen sections
                      group.orders.map((order, oIdx) => (
                        <div key={order.id} className="p-2.5 rounded-none bg-gray-50/80 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/60 space-y-1.5">
                          <div className="flex items-center justify-between pb-1 border-b border-gray-200/60 dark:border-gray-700/60">
                            <div className="flex items-center gap-1.5">
                              <Store className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                              <span className="font-bold text-xs text-gray-900 dark:text-white">
                                {order.canteen?.name || `Toko ${oIdx + 1}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.2 rounded-none text-[9px] font-bold border ${
                                order.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                order.status === 'processing' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                order.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-gray-100 text-gray-700 border-gray-200'
                              }`}>
                                {order.status === 'pending' ? 'Menunggu' : order.status === 'processing' ? 'Diproses' : order.status === 'completed' ? 'Selesai' : order.status}
                              </span>
                              {order.canteen?.whatsapp_number && (
                                <a
                                  href={formatPhoneWA(order.canteen.whatsapp_number) + `?text=${encodeURIComponent(buildOrderWAText(order))}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-600 hover:text-emerald-700 p-0.5 rounded-none hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                                  title="Hubungi Toko ini via WhatsApp"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </div>

                          {order.custom_notes && (
                            <div className="bg-purple-50/80 dark:bg-purple-950/30 p-2 rounded-none border border-purple-200/80 dark:border-purple-900/50">
                              <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase block mb-0.5">Catatan Toko:</span>
                              <p className="text-xs font-medium text-purple-900 dark:text-purple-200 whitespace-pre-wrap">
                                {order.custom_notes}
                              </p>
                            </div>
                          )}

                          {order.items?.map(item => (
                            <div key={item.id} className="text-xs py-1 hover:bg-gray-100/50 dark:hover:bg-gray-800/60 transition-colors rounded-none">
                              <div className="flex justify-between items-center cursor-pointer" onClick={() => setSelectedProduct(item.product)}>
                                <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                  <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-bold px-1.5 py-0.2 rounded-none text-[11px]">
                                    {item.quantity}x
                                  </span>
                                  <span className="font-medium">{item.product?.name}</span>
                                </span>
                                <span className="font-bold font-mono text-gray-900 dark:text-white">
                                  Rp {Math.round(parseFloat(item.subtotal)).toLocaleString('id-ID')}
                                </span>
                              </div>
                              {item.notes && (
                                <p className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded-none mt-0.5 inline-block font-medium ml-6">
                                  📝 {item.notes}
                                </p>
                              )}
                            </div>
                          ))}

                          <div className="flex justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-200/40 dark:border-gray-700/40">
                            <span>Total Toko Ini:</span>
                            <span className="text-gray-800 dark:text-gray-200 font-bold font-mono">
                              Rp {Math.round(parseFloat(order.total_price)).toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      // Single Store items
                      <>
                        {singleOrder.custom_notes && (
                          <div className="bg-purple-50/80 dark:bg-purple-950/30 p-2.5 rounded-none border border-purple-200/80 dark:border-purple-900/50 mb-2">
                            <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase block mb-0.5">Catatan Pesanan:</span>
                            <p className="text-xs font-medium text-purple-900 dark:text-purple-200 whitespace-pre-wrap">
                              {singleOrder.custom_notes}
                            </p>
                          </div>
                        )}

                        {singleOrder.items?.map(item => (
                          <div key={item.id} className="text-sm p-2 rounded-none hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                            <div className="flex justify-between items-center cursor-pointer" onClick={() => setSelectedProduct(item.product)}>
                              <span className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-bold px-1.5 py-0.5 rounded-none text-xs">{item.quantity}x</span>
                                <span className="font-medium text-xs sm:text-sm">{item.product?.name}</span>
                              </span>
                              <span className="font-bold font-mono text-gray-900 dark:text-white text-xs sm:text-sm">
                                Rp {Math.round(parseFloat(item.subtotal)).toLocaleString('id-ID')}
                              </span>
                            </div>
                            {item.notes && (
                              <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-none mt-1 inline-block font-medium ml-7">
                                📝 Catatan: {item.notes}
                              </p>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {/* DEDICATED VISUAL PROOF & DOCUMENTATION SECTION */}
                  {((group.proof_of_purchase && group.proof_of_purchase.length > 0) || 
                    (group.overallStatus === 'completed' && group.proof_of_delivery && group.proof_of_delivery.length > 0) ||
                    group.proof_of_payment || 
                    (group.overallStatus !== 'cancelled' && group.payment_status === 'unpaid')) && (
                    <div className="pt-3 pb-1 border-t border-gray-200 dark:border-gray-700 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-green-600" />
                          Bukti & Dokumentasi Foto
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          Klik kartu untuk memperbesar
                        </span>
                      </div>

                      {/* 1. Struk Pembelian Toko Card (Kurir) */}
                      {group.proof_of_purchase && group.proof_of_purchase.length > 0 && (() => {
                        const proofs = group.proof_of_purchase;
                        const firstProofUrl = getStorageUrl(proofs[0]);
                        const count = proofs.length;
                        const fullUrls = proofs.map(p => getStorageUrl(p));

                        return (
                          <div 
                            onClick={() => setSelectedProofs(fullUrls)}
                            className="group relative overflow-hidden bg-gradient-to-r from-purple-50 via-purple-50/70 to-indigo-50/40 dark:from-purple-950/40 dark:via-purple-950/20 dark:to-indigo-950/30 border-2 border-purple-300/80 dark:border-purple-800/80 hover:border-purple-500 dark:hover:border-purple-600 rounded-none p-2.5 sm:p-3 transition-all duration-200 hover:shadow-md cursor-pointer active:scale-[0.99] flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative w-12 h-12 rounded-none overflow-hidden bg-purple-100 dark:bg-purple-900/50 shrink-0 ring-2 ring-purple-400/80 dark:ring-purple-700 shadow-xs flex items-center justify-center">
                                <img 
                                  src={firstProofUrl} 
                                  alt="Struk Toko" 
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                                <div className="hidden absolute inset-0 bg-purple-100 dark:bg-purple-900/50 items-center justify-center text-purple-600 dark:text-purple-400">
                                  <Receipt className="w-5 h-5" />
                                </div>
                                <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-[9px] text-white px-1 py-0.2 rounded font-bold backdrop-blur-xs">
                                  🔍
                                </span>
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs sm:text-sm font-black text-purple-950 dark:text-purple-100 truncate">
                                    Struk Pembelian Toko
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded-none text-[10px] font-bold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                    {count} Foto
                                  </span>
                                </div>
                                <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80 truncate mt-0.5 flex items-center gap-1">
                                  <span>Foto nota kasir dari kurir • Sentuh untuk lihat</span>
                                </p>
                              </div>
                            </div>

                            <div className="shrink-0">
                              <button
                                type="button"
                                className="px-3 py-1.5 bg-purple-600 group-hover:bg-purple-700 text-white rounded-none text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 group-hover:gap-2"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Lihat Struk</span>
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 2. Bukti Serah Terima Card */}
                      {group.overallStatus === 'completed' && group.proof_of_delivery && group.proof_of_delivery.length > 0 && (() => {
                        const proofs = group.proof_of_delivery;
                        const firstProofUrl = getStorageUrl(proofs[0]);
                        const count = proofs.length;
                        const fullUrls = proofs.map(p => getStorageUrl(p));

                        return (
                          <div 
                            onClick={() => setSelectedProofs(fullUrls)}
                            className="group relative overflow-hidden bg-gradient-to-r from-blue-50 via-sky-50/70 to-emerald-50/40 dark:from-blue-950/40 dark:via-sky-950/20 dark:to-emerald-950/30 border-2 border-blue-300/80 dark:border-blue-800/80 hover:border-blue-500 dark:hover:border-blue-600 rounded-none p-2.5 sm:p-3 transition-all duration-200 hover:shadow-md cursor-pointer active:scale-[0.99] flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative w-12 h-12 rounded-none overflow-hidden bg-blue-100 dark:bg-blue-900/50 shrink-0 ring-2 ring-blue-400/80 dark:ring-blue-700 shadow-xs flex items-center justify-center">
                                <img 
                                  src={firstProofUrl} 
                                  alt="Bukti Serah Terima" 
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                                <div className="hidden absolute inset-0 bg-blue-100 dark:bg-blue-900/50 items-center justify-center text-blue-600 dark:text-blue-400">
                                  <Camera className="w-5 h-5" />
                                </div>
                                <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-[9px] text-white px-1 py-0.2 rounded font-bold backdrop-blur-xs">
                                  📸
                                </span>
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs sm:text-sm font-black text-blue-950 dark:text-blue-100 truncate">
                                    Foto Paket Sampai ke Santri
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded-none text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                    {count} Foto
                                  </span>
                                </div>
                                <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 truncate mt-0.5 flex items-center gap-1">
                                  <span>Foto paket diterima santri • Sentuh untuk lihat</span>
                                </p>
                              </div>
                            </div>

                            <div className="shrink-0">
                              <button
                                type="button"
                                className="px-3 py-1.5 bg-blue-600 group-hover:bg-blue-700 text-white rounded-none text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 group-hover:gap-2"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <span>Lihat Foto</span>
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 3. Bukti Transfer Card (Pembayaran Wali) */}
                      {group.proof_of_payment && (() => {
                        const proofs = Array.isArray(group.proof_of_payment) ? group.proof_of_payment : [group.proof_of_payment];
                        const firstProofUrl = getStorageUrl(proofs[0]);
                        const count = proofs.length;
                        const fullUrls = proofs.map(p => getStorageUrl(p));
                        const isPaid = group.payment_status === 'paid';
                        const isWaiting = group.payment_status === 'waiting_confirmation';

                        return (
                          <div className="space-y-2">
                            {isWaiting && (
                              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-none border border-amber-200 dark:border-amber-800 flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300 font-medium shadow-2xs">
                                <span className="text-base shrink-0 animate-pulse">⏳</span>
                                <div className="min-w-0">
                                  <strong className="block font-bold">Bukti Transfer Berhasil Terkirim</strong>
                                  <span>Sedang menunggu pihak toko memvalidasi pembayaran Anda.</span>
                                </div>
                              </div>
                            )}
                            {isPaid && (
                              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-none border border-emerald-200 dark:border-emerald-800 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 font-medium shadow-2xs">
                                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <div className="min-w-0">
                                  <strong className="block font-bold">Pembayaran Divalidasi Lunas</strong>
                                  <span>Pembayaran Anda telah diverifikasi oleh kasir toko.</span>
                                </div>
                              </div>
                            )}

                            {/* Visual Proof Card */}
                            <div 
                              onClick={() => setSelectedProofs(fullUrls)}
                              className="group relative overflow-hidden bg-gradient-to-r from-indigo-50 via-blue-50/40 to-purple-50/30 dark:from-indigo-950/40 dark:via-blue-950/20 dark:to-purple-950/30 border-2 border-indigo-300/80 dark:border-indigo-800/80 hover:border-indigo-500 dark:hover:border-indigo-600 rounded-none p-2.5 sm:p-3 transition-all duration-200 hover:shadow-md cursor-pointer active:scale-[0.99] flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative w-12 h-12 rounded-none overflow-hidden bg-indigo-100 dark:bg-indigo-900/50 shrink-0 ring-2 ring-indigo-400/80 dark:ring-indigo-700 shadow-xs flex items-center justify-center">
                                  <img 
                                    src={firstProofUrl} 
                                    alt="Bukti Transfer" 
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                  <div className="hidden absolute inset-0 bg-indigo-100 dark:bg-indigo-900/50 items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <ImageIcon className="w-5 h-5" />
                                  </div>
                                  <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-[9px] text-white px-1 py-0.2 rounded font-bold backdrop-blur-xs">
                                    💳
                                  </span>
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs sm:text-sm font-black text-indigo-950 dark:text-indigo-100 truncate">
                                      Bukti Transfer Anda
                                    </span>
                                    <span className="px-1.5 py-0.2 rounded-none text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                      {count} Foto
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 truncate mt-0.5">
                                    Klik untuk melihat foto bukti transfer Anda
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  className="px-3 py-1.5 bg-indigo-600 group-hover:bg-indigo-700 text-white rounded-none text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 group-hover:gap-2"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Lihat</span>
                                </button>

                                {group.overallStatus !== 'cancelled' && group.payment_status !== 'paid' && (
                                  <button 
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveOrderForPaymentProof({
                                        id: singleOrder.id,
                                        checkoutId: group.checkoutId,
                                        total_price: group.grandTotal,
                                        displayId: group.checkoutId || `#${singleOrder.id}`,
                                        canteenCount: group.orders.length
                                      });
                                      setShowPaymentProofModal(true);
                                    }}
                                    className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-none text-xs font-bold shadow-xs transition-all flex items-center gap-1 active:scale-95"
                                  >
                                    <span>+ Tambah</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 4. Section Upload Pertama Kali (Jika belum ada bukti & belum lunas) */}
                      {group.overallStatus !== 'cancelled' && group.payment_status === 'unpaid' && !group.proof_of_payment && (
                        <div className="space-y-2">
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
                            className="w-full flex items-center justify-between p-3.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-none transition-all font-bold shadow-md shadow-green-600/20 active:scale-[0.98] group cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 text-left">
                              <div className="w-9 h-9 bg-white/20 rounded-none flex items-center justify-center shrink-0">
                                <Camera className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <p className="text-xs sm:text-sm font-extrabold leading-tight">
                                  {isMulti ? 'Unggah 1 Bukti Transfer Bersama' : 'Unggah Bukti Transfer Sekarang'}
                                </p>
                                <p className="text-[10px] text-white/80 font-normal mt-0.5">
                                  {isMulti 
                                    ? `Bayar total Rp ${Math.round(group.grandTotal).toLocaleString('id-ID')} untuk ${group.orders.length} toko` 
                                    : 'Kirim foto bukti transfer agar pesanan segera diproses'}
                                </p>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 bg-white/20 group-hover:bg-white/30 rounded-none text-xs font-black shrink-0 flex items-center gap-1">
                              Upload ➔
                            </span>
                          </button>

                          {!group.orders.every(o => isPaymentTime(o)) && (
                            <p className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-none border border-amber-200 dark:border-amber-800/60 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                              <span>Ada toko yang sedang tutup. Bukti transfer tetap dapat Anda kirim sekarang dan akan diverifikasi saat toko buka.</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rincian Biaya & Total */}
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
                    <button 
                      onClick={() => toggleOrderDetails(cardKey)}
                      className="w-full flex items-center justify-between py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    >
                      <span className="font-semibold">Rincian Biaya & Ongkir</span>
                      <span className="text-[10px] font-bold border px-2 py-0.5 rounded-none bg-gray-50 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                        {isExpanded ? 'Tutup ⌃' : 'Lihat ⌄'}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-none border border-gray-200 dark:border-gray-700/80">
                        <div className="flex justify-between">
                          <span>Subtotal Produk {isMulti ? `(${group.orders.length} Toko)` : ''}</span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            Rp {Math.round(group.totalProductSubtotal).toLocaleString('id-ID')}
                          </span>
                        </div>
                        {group.totalDeliveryFee > 0 && (
                          <div className="flex justify-between">
                            <span>Ongkos Kirim {isMulti ? `(${group.orders.length} Toko)` : '(Kurir)'}</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              Rp {Math.round(group.totalDeliveryFee).toLocaleString('id-ID')}
                            </span>
                          </div>
                        )}
                        {group.totalAdminFee > 0 && (
                          <div className="flex justify-between">
                            <span>Biaya Layanan & Admin {isMulti ? `(${group.orders.length} Toko)` : ''}</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              Rp {Math.round(group.totalAdminFee).toLocaleString('id-ID')}
                            </span>
                          </div>
                        )}

                        {isMulti && (
                          <div className="pt-1.5 mt-1 border-t border-gray-200 dark:border-gray-700 space-y-1 text-[11px]">
                            <span className="font-bold text-gray-700 dark:text-gray-300 block">Rincian Per Toko:</span>
                            {group.orders.map(o => (
                              <div key={o.id} className="flex justify-between text-gray-500 dark:text-gray-400">
                                <span>{o.canteen?.name || `Toko #${o.canteen_id}`}</span>
                                <span className="font-medium text-gray-800 dark:text-gray-200">
                                  Rp {Math.round(parseFloat(o.total_price)).toLocaleString('id-ID')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-1">
                      <div>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
                          Total Pembayaran
                        </p>
                        {isMulti && (
                          <span className="text-[10px] text-green-600 dark:text-green-400 font-semibold">
                            (1x transfer untuk {group.orders.length} toko)
                          </span>
                        )}
                      </div>
                      <p className="font-black text-green-700 dark:text-green-400 text-base sm:text-lg">
                        Rp {Math.round(group.grandTotal).toLocaleString('id-ID')}
                      </p>
                    </div>

                    {/* Contact & Receipt Buttons */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={() => handleOpenReceipt(group)}
                        className="flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-none text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
                        title="Lihat & Cetak Struk Digital"
                      >
                        <Receipt className="w-4 h-4 text-green-600 dark:text-green-400" /> 
                        <span>Struk Digital</span>
                      </button>

                      {!isMulti && singleOrder.canteen?.whatsapp_number && (
                        <a 
                          href={formatPhoneWA(singleOrder.canteen.whatsapp_number) + `?text=${encodeURIComponent(buildOrderWAText(singleOrder))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded-none text-xs font-bold transition-all shadow-2xs active:scale-[0.98]"
                        >
                          <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> 
                          <span>Hubungi Toko</span>
                        </a>
                      )}
                      {(() => {
                        const courierOrder = group.orders.find(o => o.courier?.phone);
                        if (courierOrder && group.overallStatus !== 'cancelled') {
                          return (
                            <a 
                              href={formatPhoneWA(courierOrder.courier.phone) + `?text=${encodeURIComponent(buildCourierWAText(group))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-none text-xs font-bold transition-all shadow-2xs active:scale-[0.98]"
                            >
                              <MessageCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" /> 
                              <span>Hubungi Kurir</span>
                            </a>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    
                    {/* Cancel Button */}
                    {allPending && (
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                        <button 
                          onClick={() => handleCancelGroup(group.orders)}
                          disabled={cancelMutation.isPending}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-none text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" /> 
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
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-xs flex flex-col animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 bg-black/70 border-b border-white/10 shrink-0">
            <span className="text-white font-bold text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-400" />
              {selectedProofs.length} Berkas Bukti
            </span>
            <button 
              onClick={() => setSelectedProofs([])}
              className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-none flex items-center justify-center text-white active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Images & Documents */}
          <div className="flex-1 overflow-y-auto flex flex-col items-center gap-4 p-4 pb-12">
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
                      <span className="px-2 py-0.5 bg-red-900/40 text-red-300 rounded font-mono text-[10px]">PDF</span>
                    </div>
                    <iframe 
                      src={proof} 
                      title={`Bukti PDF ${idx + 1}`} 
                      className="w-full h-[55vh] rounded-none bg-white border border-gray-700" 
                    />
                    <a
                      href={proof}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 active:scale-98 text-white rounded-none text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md"
                    >
                      <ExternalLink className="w-4 h-4" /> Buka / Unduh Dokumen PDF
                    </a>
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
                  <a
                    href={proof}
                    target="_blank"
                    download
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 active:scale-98 text-white rounded-none text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <Download className="w-4 h-4" /> Unduh / Buka Berkas
                  </a>
                </div>
              );
            })}
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
                disabled={paymentProofFiles.length === 0 || uploadPaymentProofMutation.isPending || isCompressing}
                onClick={() => {
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
