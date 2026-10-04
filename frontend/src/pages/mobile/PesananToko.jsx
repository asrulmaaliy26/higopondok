import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronLeft, ShoppingBag, CheckCircle, Clock, Truck, MessageCircle, X, Image as ImageIcon, ChevronDown, ChevronRight, Store, Upload, Trash2, RotateCcw, FileText, Filter, Search, AlertTriangle, AlertCircle, Download, ExternalLink, Printer, User, UploadCloud, Camera, FileUp, Plus, Calendar, Eye, Calculator } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getStorageUrl } from '../../lib/axios';
import { useCanteenStore } from '../../store/canteenStore';
import { getFileType, isImageFile, isHeifFile, isPdfFile, formatFileSize, getFileNameFromPath, compressImageFiles } from '../../lib/fileUtils';
import ThermalReceiptModal from '../../components/receipt/ThermalReceiptModal';
import AdminAccountingModal from '../../components/modals/AdminAccountingModal';
import santriData from '../../data/santri.json';
import { PRICING_CONFIG } from '../../config/pricing';

function getWeeksInMonth(year, month) {
  // month is 0-indexed
  const weeks = [];
  let currentDate = new Date(year, month, 1);
  let currentWeek = [];

  while (currentDate.getMonth() === month) {
    currentWeek.push(new Date(currentDate));
    // If it's Sunday (0), the week ends
    if (currentDate.getDay() === 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
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

function formatFullDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
}

const formatRupiah = (num) => {
  return Math.round(Number(num) || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });
};

function getOrderPriorityScore(order) {
  // 1. Paling Bawah: Dibatalkan / Ditolak
  if (order.status === 'cancelled') {
    return 10;
  }

  // 2. Selesai
  if (order.status === 'completed') {
    return 30;
  }

  // 3. SUDAH DILANJUTKAN (status === 'processing' - Sedang Diproses / Diantar Kurir)
  // Pesanan ini baru turun ke bawah setelah diklik "Lanjutkan Pesanan"
  if (order.status === 'processing') {
    if (order.payment_status === 'waiting_confirmation') return 70; // jika pembeli upload bukti saat processing
    if (order.payment_status === 'unpaid') return 65; // COD / belum bayar tapi sudah jalan
    return 60; // processing & sudah lunas
  }

  // 4. BELUM DILANJUTKAN (status === 'pending' - PALING UTAMA DI ATAS!)
  // Pesanan butuh tindakan toko: Validasi Bayar & Klik "Lanjutkan Pesanan"
  if (order.status === 'pending') {
    // 4a. Pembeli baru upload bukti -> Prioritas Teratas 1 (Skor 100)
    if (order.payment_status === 'waiting_confirmation') {
      return 100;
    }
    // 4b. Kantin baru klik "Konfirmasi Lunas", tapi BELUM klik "Lanjutkan Pesanan" -> TETAP DI ATAS! (Skor 95)
    if (order.payment_status === 'paid') {
      return 95;
    }
    // 4c. Belum Bayar / Belum Set Harga -> Tetap di atas sebelum dilanjutkan (Skor 90)
    return 90;
  }

  return 50;
}

// Optimistic Update Helper for React Query caches
// Optimistic Update Helper for React Query caches
const mutateOrderInCaches = async (queryClient, queryKeyPrefix, targetIds, updateFn, syncCheckout = false) => {
  await queryClient.cancelQueries({ queryKey: [queryKeyPrefix] });
  const previousQueries = queryClient.getQueriesData({ queryKey: [queryKeyPrefix] });

  const ids = Array.isArray(targetIds) ? targetIds : [targetIds];

  // Find if target order has a checkout_id to sync across sibling orders in bundle (ONLY when syncCheckout is true, e.g. for payments)
  let checkoutIds = new Set();
  if (syncCheckout) {
    for (const [, data] of previousQueries) {
      const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      for (const item of list) {
        if (item && ids.includes(item.id) && item.checkout_id) {
          checkoutIds.add(item.checkout_id);
        }
      }
    }
  }

  queryClient.setQueriesData({ queryKey: [queryKeyPrefix] }, (oldData) => {
    if (!oldData) return oldData;
    const isTarget = (item) => item && (ids.includes(item.id) || (syncCheckout && item.checkout_id && checkoutIds.has(item.checkout_id)));
    if (Array.isArray(oldData)) {
      return oldData.map(item => isTarget(item) ? updateFn(item) : item);
    }
    if (Array.isArray(oldData?.data)) {
      return {
        ...oldData,
        data: oldData.data.map(item => isTarget(item) ? updateFn(item) : item)
      };
    }
    return oldData;
  });

  return { previousQueries, targetIds: ids };
};


const rollbackCaches = (queryClient, context, failedId = null) => {
  if (context?.previousQueries) {
    if (failedId) {
      let previousItem = null;
      for (const [, data] of context.previousQueries) {
        const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        const match = list.find(item => item && item.id === failedId);
        if (match) {
          previousItem = match;
          break;
        }
      }
      if (previousItem) {
        mutateOrderInCaches(queryClient, 'canteen_orders', failedId, () => previousItem, false);
        return;
      }
    }
    context.previousQueries.forEach(([queryKey, previousData]) => {
      queryClient.setQueryData(queryKey, previousData);
    });
  }
};

export default function PesananToko() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeCanteenId, setActiveCanteenId, isStoreSelected, setIsStoreSelected } = useCanteenStore();
  const [selectedCouriers, setSelectedCouriers] = useState({});

  // Fetch all canteens owned by this user
  const { data: rawCanteensList } = useQuery({
    queryKey: ['my_canteens_list'],
    queryFn: async () => {
      const res = await api.get('/my-canteens');
      return res.data.data || res.data || [];
    }
  });

  const canteensList = Array.isArray(rawCanteensList)
    ? rawCanteensList
    : (Array.isArray(rawCanteensList?.data) ? rawCanteensList.data : []);


  const [showCourierModal, setShowCourierModal] = useState(false);
  const [activeOrderForCourier, setActiveOrderForCourier] = useState(null);

  const [showProofModal, setShowProofModal] = useState(false);
  const [activeOrderForProof, setActiveOrderForProof] = useState(null);
  const [proofFiles, setProofFiles] = useState([]);
  const [isCompressingProof, setIsCompressingProof] = useState(false);
  
  const [selectedProofs, setSelectedProofs] = useState([]);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [showAccountingModal, setShowAccountingModal] = useState(false);

  // Receipt Modal State for Canteen
  const [receiptModalConfig, setReceiptModalConfig] = useState({
    isOpen: false,
    mode: 'single', // 'single' | 'batch'
    order: null,
    orders: [],
    title: ''
  });

  const handlePrintSingleReceipt = (orderToPrint) => {
    setReceiptModalConfig({
      isOpen: true,
      mode: 'single',
      order: orderToPrint,
      orders: [],
      title: `Struk Pesanan #ORD-${orderToPrint.id}`
    });
  };

  const handlePrintBatchReceipt = () => {
    if (orders.length === 0) {
      toast.error('Tidak ada pesanan aktif pada filter saat ini.');
      return;
    }
    setReceiptModalConfig({
      isOpen: true,
      mode: 'batch',
      order: null,
      orders: orders,
      title: `Rekap Pesanan Toko (${orders.length} Pesanan)`
    });
  };

  // Manual Order by Canteen State
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualUserId, setManualUserId] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualPrice, setManualPrice] = useState('');

  // Set Custom Order Price State
  const [showSetPriceModal, setShowSetPriceModal] = useState(false);
  const [activeOrderForSetPrice, setActiveOrderForSetPrice] = useState(null);
  const [newPriceInput, setNewPriceInput] = useState('');
  
  // Recap Modal State
  const [showRecapModal, setShowRecapModal] = useState(false);

  // Unpaid Proceed Confirmation Modal State
  const [unpaidProceedOrder, setUnpaidProceedOrder] = useState(null);

  // Fetch Santri List for Manual Order
  const { data: santriList = [] } = useQuery({
    queryKey: ['santri_list'],
    queryFn: async () => {
      const res = await api.get('/canteen/santri-list');
      return res.data;
    },
    enabled: showManualModal
  });

  const createManualOrderMutation = useMutation({
    mutationFn: (data) => api.post('/canteen/orders/manual', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canteen_orders'] });
      toast.success('Pesanan manual berhasil dibuat untuk santri!');
      setShowManualModal(false);
      setManualUserId('');
      setManualNotes('');
      setManualPrice('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal membuat pesanan manual');
    }
  });

  const setCustomPriceMutation = useMutation({
    mutationFn: ({ id, price, canteen_id }) => api.put(`/canteen/orders/${id}/custom-price?canteen_id=${canteen_id || ''}`, { total_price: price }),
    onMutate: async (variables) => {
      const deliveryFee = parseFloat(activeOrderForSetPrice?.delivery_fee || 0);
      const adminFee = parseFloat(activeOrderForSetPrice?.admin_fee || 0);
      const total = parseFloat(variables.price || 0) + deliveryFee + adminFee;
      return await mutateOrderInCaches(queryClient, 'canteen_orders', variables.id, (order) => ({
        ...order,
        total_price: total
      }));
    },
    onError: (err, variables, context) => {
      rollbackCaches(queryClient, context);
      toast.error(err.response?.data?.message || 'Gagal memperbarui harga');
    },
    onSuccess: () => {
      toast.success('Harga pesanan khusus berhasil diperbarui!');
      setShowSetPriceModal(false);
      setActiveOrderForSetPrice(null);
      setNewPriceInput('');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['canteen_orders'] });
      queryClient.invalidateQueries({ queryKey: ['canteen_recap'] });
    }
  });

  const today = new Date();
  const [filterMode, setFilterMode] = useState('day'); // 'day', 'week', 'month', 'year', 'all'
  const [filterDate, setFilterDate] = useState(
    `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`
  );
  const [filterMonth, setFilterMonth] = useState(today.getMonth());
  const [filterYear, setFilterYear] = useState(today.getFullYear());
  const [filterWeekIndex, setFilterWeekIndex] = useState(() => {
    return getCurrentWeekIndex(today.getFullYear(), today.getMonth());
  });

  const selectedCanteenFilter = 'all';
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

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
      const end = new Date(filterYear, filterMonth + 1, 0); // last day
      return { start_date: format(start), end_date: format(end), period: 'month' };
    }
    else if (filterMode === 'year') {
      const start = new Date(filterYear, 0, 1);
      const end = new Date(filterYear, 11, 31);
      return { start_date: format(start), end_date: format(end), period: 'year' };
    }
    return { start_date: '', end_date: '', period: 'all' };
  };

  const getFilterLabel = () => {
    if (filterMode === 'all') return 'Semua Waktu';
    if (filterMode === 'day') {
      return formatFullDate(filterDate);
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

  const currentParams = React.useMemo(() => getFilterParams(), [
    filterMode,
    filterDate,
    filterMonth,
    filterYear,
    filterWeekIndex
  ]);

  const { data: ordersRes, isLoading, isFetching } = useQuery({
    queryKey: ['canteen_orders', selectedCanteenFilter, currentParams.start_date, currentParams.end_date, currentParams.period],
    queryFn: async () => {
      const canteenParam = selectedCanteenFilter !== 'all' ? `canteen_id=${selectedCanteenFilter}&` : '';
      const dateParams = currentParams.start_date ? `start_date=${currentParams.start_date}&end_date=${currentParams.end_date}&` : '';
      const periodParam = currentParams.period ? `period=${currentParams.period}` : '';
      const res = await api.get(`/canteen/orders?${canteenParam}${dateParams}${periodParam}`);
      return res.data;
    },
    refetchInterval: filterMode === 'day' ? 10000 : false,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    placeholderData: (previousData) => previousData,
  });

  const { data: couriersRes } = useQuery({
    queryKey: ['couriers', selectedCanteenFilter],
    queryFn: async () => {
      const canteenParam = selectedCanteenFilter !== 'all' ? `?canteen_id=${selectedCanteenFilter}` : '';
      const res = await api.get(`/couriers${canteenParam}`);
      return res.data;
    }
  });

  const [activeTab, setActiveTab] = useState('orders');
  const [visibleCompletedLimit, setVisibleCompletedLimit] = useState(30);

  const santriLookupMap = React.useMemo(() => {
    if (!santriData?.data) return new Map();
    const map = new Map();
    santriData.data.forEach(r => {
      if (!r || !r[1]) return;
      const cleanName = r[1].toLowerCase().replace(/\s+(laki-laki|perempuan)$/i, '').trim();
      if (!map.has(cleanName)) {
        map.set(cleanName, r);
      }
    });
    return map;
  }, []);

  const getSantriMeta = React.useCallback((orderUser, fallbackLocation, orderFor) => {
    if (orderFor === 'guru' || (!orderUser?.santri_name && orderUser?.is_teacher)) {
      return {
        santriName: orderUser?.name || 'Guru / Staff',
        waliName: 'Guru / Staff Yayasan',
        santriClass: orderUser?.teacher_unit ? `Unit ${orderUser.teacher_unit}` : 'Staff',
        santriLevel: orderUser?.niy ? `NIY: ${orderUser.niy}` : 'Guru',
        santriRoom: fallbackLocation || (orderUser?.teacher_unit ? `Ruang Guru ${orderUser.teacher_unit}` : 'Ruang Guru'),
        isTeacher: true
      };
    }
    const santriName = orderUser?.santri_name || orderUser?.name || 'Pembeli';
    const waliName = orderUser?.name || 'Wali';
    let santriClass = orderUser?.santri_class || '';
    let santriLevel = orderUser?.santri_level || '';
    let santriRoom = orderUser?.santri_room || fallbackLocation || '';

    if (santriName) {
      const sName = santriName.toLowerCase().trim();
      const match = santriLookupMap.get(sName);
      if (match) {
        if (!santriLevel && match[4]) santriLevel = match[4];
        const tingkat = match[5] || '';
        const rombel = match[6] || '';
        const program = match[7] && match[7] !== '-' ? match[7] : '';
        const fullClass = [tingkat, rombel, program].filter(Boolean).join(' ');
        if (!santriClass || santriClass === tingkat) {
          santriClass = fullClass || santriClass;
        }
        if ((!santriRoom || santriRoom === '-') && match[10]) {
          santriRoom = match[10];
        }
      }
    }
    return { santriName, waliName, santriClass, santriLevel, santriRoom, isTeacher: false };
  }, [santriLookupMap]);

  const { data: recapData, isLoading: isLoadingRecap, isFetching: isFetchingRecap } = useQuery({
    queryKey: ['canteen_recap', selectedCanteenFilter, currentParams.period, currentParams.start_date, currentParams.end_date],
    queryFn: async () => {
      const canteenParam = selectedCanteenFilter !== 'all' ? `canteen_id=${selectedCanteenFilter}&` : '';
      const dateParams = currentParams.start_date ? `start_date=${currentParams.start_date}&end_date=${currentParams.end_date}&` : '';
      const periodParam = currentParams.period ? `period=${currentParams.period}` : '';
      const res = await api.get(`/canteen/orders/recap?${canteenParam}${dateParams}${periodParam}`);
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    placeholderData: (previousData) => previousData,
  });

  const rawOrders = React.useMemo(() => {
    return Array.isArray(ordersRes) ? ordersRes : (Array.isArray(ordersRes?.data) ? ordersRes.data : []);
  }, [ordersRes]);
  const orders = React.useMemo(() => {
    const list = rawOrders.filter(order => {
      // 1. Status Filter
      if (selectedStatusFilter !== 'all') {
        if (selectedStatusFilter === 'waiting_confirmation') {
          if (order.payment_status !== 'waiting_confirmation') return false;
        } else if (selectedStatusFilter === 'paid') {
          if (order.payment_status !== 'paid') return false;
        } else if (selectedStatusFilter === 'unpaid') {
          if (order.payment_status !== 'unpaid') return false;
        } else {
          if (order.status !== selectedStatusFilter) return false;
        }
      }

      // 2. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const idMatch = order.id?.toString().includes(q);
        const userMatch = order.user?.name?.toLowerCase().includes(q);
        const santriMatch = order.user?.santri_name?.toLowerCase().includes(q);
        const canteenMatch = order.canteen?.name?.toLowerCase().includes(q);
        const notesMatch = order.custom_notes?.toLowerCase().includes(q);
        const itemsMatch = order.items?.some(i => i.product?.name?.toLowerCase().includes(q));

        if (!idMatch && !userMatch && !santriMatch && !canteenMatch && !notesMatch && !itemsMatch) {
          return false;
        }
      }

      return true;
    });

    // Smart Priority Sorting:
    // 1. Menunggu Validasi Bayar (Score 100) -> Paling Atas
    // 2. Belum Lunas (Score 80) -> Di atas pesanan lunas
    // 3. Sudah Lunas & Aktif (Score 60)
    // 4. Selesai (Score 30)
    // 5. Dibatalkan (Score 10) -> Paling Bawah
    return [...list].sort((a, b) => {
      const scoreA = getOrderPriorityScore(a);
      const scoreB = getOrderPriorityScore(b);

      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Skor tertinggi lebih dulu
      }

      // Jika skor prioritas sama, urutkan berdasarkan order terbaru
      return (b.id || 0) - (a.id || 0);
    });
  }, [rawOrders, selectedStatusFilter, searchQuery]);

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, status, canteen_id }) => api.put(`/canteen/orders/${id}/payment?canteen_id=${canteen_id}`, { payment_status: status }),
    onMutate: async (variables) => {
      return await mutateOrderInCaches(queryClient, 'canteen_orders', variables.id, (order) => ({
        ...order,
        payment_status: variables.status
      }), true);
    },
    onError: (err, variables, context) => {
      rollbackCaches(queryClient, context);
      toast.error('Gagal memperbarui status pembayaran');
    },
    onSuccess: () => {
      toast.success('Status pembayaran berhasil diperbarui!');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['canteen_orders'] });
      if (activeTab === 'recap') {
        queryClient.invalidateQueries({ queryKey: ['canteen_recap'] });
      }
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, canteen_id, target_date }) => 
      api.put(`/canteen/orders/${id}/status?canteen_id=${canteen_id}`, { status, target_date }),
    onMutate: async (variables) => {
      return await mutateOrderInCaches(queryClient, 'canteen_orders', variables.id, (order) => ({
        ...order,
        status: variables.status
      }), false);
    },
    onError: (err, variables, context) => {
      rollbackCaches(queryClient, context, variables.id);
      toast.error(err.response?.data?.message || 'Gagal memperbarui status');
      queryClient.invalidateQueries({ queryKey: ['canteen_orders'] });
    },
    onSuccess: (res, variables) => {
      toast.success(res.data?.message || 'Status pesanan berhasil diperbarui!');
      if (res.data?.order) {
        mutateOrderInCaches(queryClient, 'canteen_orders', variables.id, () => res.data.order, false);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['canteen_orders'] });
      if (activeTab === 'recap') {
        queryClient.invalidateQueries({ queryKey: ['canteen_recap'] });
      }
    }
  });

  const batchUpdateStatusMutation = useMutation({
    mutationFn: ({ order_ids, status, canteen_id, target_date }) => 
      api.put(`/canteen/orders/batch-status${canteen_id ? `?canteen_id=${canteen_id}` : ''}`, { order_ids, status, target_date }),
    onMutate: async (variables) => {
      return await mutateOrderInCaches(queryClient, 'canteen_orders', variables.order_ids, (order) => ({
        ...order,
        status: variables.status
      }), false);
    },
    onError: (err, variables, context) => {
      rollbackCaches(queryClient, context);
      toast.error(err.response?.data?.message || 'Gagal memperbarui status paket pesanan');
      queryClient.invalidateQueries({ queryKey: ['canteen_orders'] });
    },
    onSuccess: (res) => {
      const data = res.data;
      if (data.skipped_count > 0 && data.success_count > 0) {
        toast.success(`${data.success_count} pesanan berhasil diproses!`);
        toast.error(data.message, { duration: 5000 });
      } else if (data.skipped_count > 0 && data.success_count === 0) {
        toast.error(data.message, { duration: 5000 });
      } else {
        toast.success(data.message || 'Status pesanan berhasil diperbarui!');
      }

      if (data.updated_orders && data.updated_orders.length > 0) {
        const updateMap = new Map(data.updated_orders.map(o => [o.id, o]));
        queryClient.setQueriesData({ queryKey: ['canteen_orders'] }, (oldData) => {
          if (!oldData) return oldData;
          const updateItem = (item) => updateMap.has(item?.id) ? { ...item, ...updateMap.get(item.id) } : item;
          if (Array.isArray(oldData)) return oldData.map(updateItem);
          if (Array.isArray(oldData?.data)) return { ...oldData, data: oldData.data.map(updateItem) };
          return oldData;
        });
      }

      if (data.skipped_orders && data.skipped_orders.length > 0) {
        const skippedIds = data.skipped_orders.map(s => s.id);
        mutateOrderInCaches(queryClient, 'canteen_orders', skippedIds, (order) => ({
          ...order,
          status: 'pending'
        }), false);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['canteen_orders'] });
      if (activeTab === 'recap') {
        queryClient.invalidateQueries({ queryKey: ['canteen_recap'] });
      }
    }
  });

  const completeOrderMutation = useMutation({
    mutationFn: ({ id, formData, canteen_id }) => api.post(`/canteen/orders/${id}/complete?canteen_id=${canteen_id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
    onMutate: async (variables) => {
      return await mutateOrderInCaches(queryClient, 'canteen_orders', variables.id, (order) => ({
        ...order,
        status: 'completed',
        payment_status: 'paid'
      }));
    },
    onError: (err, variables, context) => {
      rollbackCaches(queryClient, context);
      toast.error(err.response?.data?.message || 'Gagal menyelesaikan pesanan');
    },
    onSuccess: () => {
      toast.success('Pesanan berhasil diselesaikan dan Lunas!');
      setShowProofModal(false);
      setProofFiles([]);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['canteen_orders'] });
      queryClient.invalidateQueries({ queryKey: ['canteen_recap'] });
    }
  });

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [activeOrderForReceipt, setActiveOrderForReceipt] = useState(null);
  const [receiptFiles, setReceiptFiles] = useState([]);
  const [isCompressingReceipt, setIsCompressingReceipt] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState({}); // Track which completed orders are expanded

  // Schedule Order Modal States for Canteen
  const [scheduleOrderModal, setScheduleOrderModal] = useState(null);
  const [scheduleDateMode, setScheduleDateMode] = useState('tomorrow'); // 'today' | 'tomorrow' | 'custom'
  const [scheduleCustomDate, setScheduleCustomDate] = useState('');
  const [scheduleActionStatus, setScheduleActionStatus] = useState('processing'); // 'processing' | 'pending'

  const handleOpenScheduleModal = (orderOrGroup, defaultMode = 'tomorrow') => {
    const isGroup = Boolean(orderOrGroup.orders && Array.isArray(orderOrGroup.orders));
    const targetOrders = isGroup ? orderOrGroup.orders : [orderOrGroup];
    const primary = isGroup ? (orderOrGroup.primaryOrder || targetOrders[0]) : orderOrGroup;

    setScheduleOrderModal({
      order: primary,
      orders: targetOrders,
      isGroup,
      title: isGroup ? `Jadwalkan Paket Pesanan (${targetOrders.length} Pesanan)` : `Jadwalkan Pesanan #${primary.id}`
    });
    setScheduleDateMode(defaultMode);
    setScheduleCustomDate('');
    setScheduleActionStatus('processing');
  };

  const uploadReceiptMutation = useMutation({
    mutationFn: ({ id, formData, canteen_id }) => api.post(`/canteen/orders/${id}/upload-receipt?canteen_id=${canteen_id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canteen_orders'] });
      toast.success('Bukti pesanan / struk berhasil diunggah!');
      setShowReceiptModal(false);
      setReceiptFiles([]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal mengunggah bukti pesanan');
    }
  });

  // Payment Proof Upload States & Mutations for Canteen
  const [orderToUploadPaymentProof, setOrderToUploadPaymentProof] = useState(null);
  const [canteenPaymentProofFiles, setCanteenPaymentProofFiles] = useState([]);
  const [isCompressingPaymentProof, setIsCompressingPaymentProof] = useState(false);
  const [canteenPaymentStatus, setCanteenPaymentStatus] = useState('paid');
  const canteenPaymentFileInputRef = React.useRef(null);
  const canteenPaymentCameraInputRef = React.useRef(null);

  const handleOpenUploadPaymentModal = (order) => {
    setOrderToUploadPaymentProof(order);
    setCanteenPaymentProofFiles([]);
    setCanteenPaymentStatus('paid');
  };

  const handleCanteenProofFilesSelected = async (filesList) => {
    if (!filesList || filesList.length === 0) return;
    const incomingFiles = Array.from(filesList);

    const remainingSlots = 5 - canteenPaymentProofFiles.length;
    if (remainingSlots <= 0) {
      toast.error('Maksimal 5 berkas bukti pembayaran.');
      return;
    }

    const filesToProcess = incomingFiles.slice(0, remainingSlots);
    setIsCompressingPaymentProof(true);

    try {
      const compressed = await compressImageFiles(filesToProcess, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.8
      });
      setCanteenPaymentProofFiles((prev) => [...prev, ...compressed]);
    } catch (err) {
      console.error('Gagal mengompresi gambar bukti:', err);
      setCanteenPaymentProofFiles((prev) => [...prev, ...filesToProcess]);
    } finally {
      setIsCompressingPaymentProof(false);
      if (canteenPaymentFileInputRef.current) canteenPaymentFileInputRef.current.value = '';
      if (canteenPaymentCameraInputRef.current) canteenPaymentCameraInputRef.current.value = '';
    }
  };

  const uploadCanteenPaymentProofMutation = useMutation({
    mutationFn: ({ id, formData, canteen_id }) =>
      api.post(`/canteen/orders/${id}/payment-proof?canteen_id=${canteen_id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 45000,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canteen_orders'] });
      queryClient.invalidateQueries({ queryKey: ['canteen_recap'] });
      toast.success('Bukti pembayaran santri berhasil diunggah!');
      setOrderToUploadPaymentProof(null);
      setCanteenPaymentProofFiles([]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal mengunggah bukti pembayaran');
    }
  });

  const deleteCanteenProofMutation = useMutation({
    mutationFn: async ({ id, type, path }) => {
      const res = await api.delete(`/canteen/orders/${id}/proof`, {
        data: { type, path }
      });
      return { ...res.data, deletedPath: path };
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Berkas bukti berhasil dihapus');
      queryClient.invalidateQueries({ queryKey: ['canteen_orders'] });
      queryClient.invalidateQueries({ queryKey: ['canteen_recap'] });
      if (data.order && orderToUploadPaymentProof && orderToUploadPaymentProof.id === data.order.id) {
        setOrderToUploadPaymentProof(data.order);
      }
      setSelectedProofs((prev) => prev.filter((p) => !p.includes(data.deletedPath || '')));
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal menghapus berkas bukti');
    }
  });

  const assignCourierMutation = useMutation({
    mutationFn: async ({ id, courier_id, canteen_id }) => {
      const res = await api.put(`/canteen/orders/${id}/courier?canteen_id=${canteen_id}`, { courier_id });
      return res.data;
    },
    onMutate: async (variables) => {
      const selectedCourier = couriers.find(c => c.id === variables.courier_id);
      return await mutateOrderInCaches(queryClient, 'canteen_orders', variables.id, (order) => ({
        ...order,
        courier_id: variables.courier_id === 'self' ? null : variables.courier_id,
        courier: selectedCourier || order.courier,
        status: 'processing'
      }));
    },
    onError: (err, variables, context) => {
      rollbackCaches(queryClient, context);
      toast.error('Gagal menugaskan kurir');
    },
    onSuccess: (data, variables) => {
      toast.success('Berhasil menugaskan kurir!');
      setShowCourierModal(false);
      
      // Auto-redirect to WhatsApp
      const selectedCourier = couriers.find(c => c.id === variables.courier_id);
      if (selectedCourier && selectedCourier.phone) {
        const phone = selectedCourier.phone.replace(/^0/, '62');
        const msg = encodeURIComponent(`Halo ${selectedCourier.name}, ada pesanan baru untuk diantar atas nama ${activeOrderForCourier?.user?.name || 'Santri'}. Tolong segera ambil di Kantin ya!`);
        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
      }
      
      setActiveOrderForCourier(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['canteen_orders'] });
      queryClient.invalidateQueries({ queryKey: ['canteen_recap'] });
    }
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async ({ id, canteen_id }) => {
      const res = await api.put(`/canteen/orders/${id}/cancel?canteen_id=${canteen_id}`);
      return res.data;
    },
    onMutate: async (variables) => {
      return await mutateOrderInCaches(queryClient, 'canteen_orders', variables.id, (order) => ({
        ...order,
        status: 'cancelled'
      }));
    },
    onError: (err, variables, context) => {
      rollbackCaches(queryClient, context);
      toast.error('Gagal membatalkan pesanan');
    },
    onSuccess: () => {
      toast.success('Pesanan berhasil dibatalkan');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['canteen_orders'] });
      queryClient.invalidateQueries({ queryKey: ['canteen_recap'] });
    }
  });

  const handleContact = (phone, name) => {
    if (!phone) {
      toast.error(`Nomor telepon ${name} tidak tersedia`);
      return;
    }
    let formatted = phone.toString().replace(/\D/g, '');
    if (formatted.startsWith('08')) formatted = '628' + formatted.substring(2);
    else if (formatted.startsWith('8')) formatted = '628' + formatted.substring(1);
    else if (formatted.startsWith('0')) formatted = '62' + formatted.substring(1);
    window.open(`https://wa.me/${formatted}`, '_blank');
  };

  const couriers = couriersRes || [];

  const productRecap = React.useMemo(() => {
    const recap = {};
    const customMap = {};
    let customOrderTotal = 0;
    let customOrderHpp = 0;
    let customOrderCount = 0;
    let grandTotalProducts = 0;
    let grandTotalHpp = 0;
    
    // Hanya hitung pesanan yang sudah dilanjutkan (processing / completed)
    const validOrders = (rawOrders || []).filter(o => o.status === 'processing' || o.status === 'completed');
    
    validOrders.forEach(order => {
      const isCustom = Boolean(order.is_custom) || (Boolean(order.custom_notes) && (!order.items || order.items.length === 0));
      if (isCustom) {
        const delFee = parseFloat(order.delivery_fee || 0);
        const admFee = parseFloat(order.admin_fee || 0);
        const customProductPrice = Math.max(0, parseFloat(order.total_price || 0) - delFee - admFee);
        const customHpp = customProductPrice > 1000 ? (customProductPrice - 1000) : customProductPrice;

        customOrderCount++;
        customOrderTotal += customProductPrice;
        customOrderHpp += customHpp;
        grandTotalProducts += customProductPrice;
        grandTotalHpp += customHpp;

        const customName = order.custom_notes?.trim() ? `Titip Beli: ${order.custom_notes.trim()}` : 'Pesanan Khusus / Titip Beli';
        if (!customMap[customName]) {
          customMap[customName] = { 
            name: customName, 
            quantity: 0, 
            total: 0, 
            hpp: customHpp, 
            total_hpp: 0, 
            profit: 0 
          };
        }
        customMap[customName].quantity += 1;
        customMap[customName].total += customProductPrice;
        customMap[customName].total_hpp += customHpp;
        customMap[customName].profit += (customProductPrice - customHpp);
      } else if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
          const name = item.product?.name || item.product_name || 'Produk Tidak Diketahui';
          const qty = parseInt(item.quantity || 0, 10);
          const price = parseFloat(item.price || 0);
          const defaultItemHpp = price > 1000 ? (price - 1000) : price;
          const rawItemHpp = item.product?.hpp;
          const hpp = parseFloat(
            rawItemHpp !== undefined && rawItemHpp !== null && parseFloat(rawItemHpp) > 0 
              ? rawItemHpp 
              : defaultItemHpp
          );
          const subtotal = parseFloat(item.subtotal || (price * qty));
          const totalHpp = hpp * qty;
          const profit = subtotal - totalHpp;

          if (!recap[name]) {
            recap[name] = { 
              name, 
              quantity: 0, 
              total: 0, 
              hpj: price, 
              hpp, 
              total_hpp: 0, 
              profit: 0 
            };
          }
          recap[name].quantity += qty;
          recap[name].total += subtotal;
          recap[name].total_hpp += totalHpp;
          recap[name].profit += profit;

          grandTotalProducts += subtotal;
          grandTotalHpp += totalHpp;
        });
      }
    });

    // Convert to sorted arrays
    const recapArray = Object.values(recap).sort((a, b) => b.quantity - a.quantity);
    const customArray = Object.values(customMap).sort((a, b) => b.quantity - a.quantity);

    return {
      items: recapArray,
      customItems: customArray,
      customCount: customOrderCount,
      customTotal: customOrderTotal,
      customHpp: customOrderHpp,
      customProfit: customOrderTotal - customOrderHpp,
      totalProducts: grandTotalProducts,
      totalHpp: grandTotalHpp,
      totalProfit: grandTotalProducts - grandTotalHpp
    };
  }, [rawOrders]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div></div>;
  }

  // Jika Kantin Baru Belum Memiliki Toko
  if (canteensList && canteensList.length === 0) {
    return (
      <div className="bg-gray-50 h-full min-h-screen p-6 flex items-center justify-center dark:bg-gray-950 font-sans">
        <div className="bg-white dark:bg-gray-900 rounded-none p-6 sm:p-8 max-w-md w-full border border-gray-200 dark:border-gray-700 shadow-xl text-center space-y-4 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-green-50 dark:bg-green-950/50 text-green-600 rounded-none border border-green-200 dark:border-green-800 flex items-center justify-center mx-auto shadow-inner">
            <Store className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Anda Belum Memiliki Toko</h2>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
              Sebagai Akun Kantin, Anda perlu mendaftarkan nama & profil toko terlebih dahulu sebelum dapat mengelola pesanan.
            </p>
          </div>
          <button
            onClick={() => navigate({ to: '/dashboard/profile' })}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-none shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 text-xs sm:text-sm uppercase tracking-wider cursor-pointer"
          >
            <Store className="w-4 h-4" />
            Buka Profil & Buat Toko
          </button>
        </div>
      </div>
    );
  }

  const groupOrders = (orderList) => {
    const groups = [];
    const map = new Map();

    (orderList || []).forEach(order => {
      const key = order.checkout_id ? `chk_${order.checkout_id}` : `ord_${order.id}`;
      if (!map.has(key)) {
        const groupObj = {
          key,
          checkoutId: order.checkout_id || null,
          created_at: order.created_at,
          user: order.user,
          delivery_location: order.delivery_location,
          orders: []
        };
        map.set(key, groupObj);
        groups.push(groupObj);
      }
      map.get(key).orders.push(order);
    });

    return groups.map(group => {
      const gOrders = group.orders;
      const isMultiStore = gOrders.length > 1;

      const grandTotal = gOrders.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0);
      const totalDeliveryFee = gOrders.reduce((sum, o) => sum + parseFloat(o.delivery_fee || 0), 0);
      const totalAdminFee = gOrders.reduce((sum, o) => sum + parseFloat(o.admin_fee || 0), 0);

      const isAllPaid = gOrders.every(o => o.payment_status === 'paid');
      const isAnyWaiting = gOrders.some(o => o.payment_status === 'waiting_confirmation');
      const payment_status = isAllPaid ? 'paid' : (isAnyWaiting ? 'waiting_confirmation' : 'unpaid');

      const isAllCompleted = gOrders.every(o => o.status === 'completed');
      const isAllCancelled = gOrders.every(o => o.status === 'cancelled');
      const isAllProcessing = gOrders.every(o => o.status === 'processing');
      const isAnyProcessing = gOrders.some(o => o.status === 'processing');
      const isAnyPending = gOrders.some(o => o.status === 'pending');

      let overallStatus = 'pending';
      if (isAllCompleted) overallStatus = 'completed';
      else if (isAllCancelled) overallStatus = 'cancelled';
      else if (isAllProcessing) overallStatus = 'processing';
      else if (isAnyProcessing && isAnyPending) overallStatus = 'partial';
      else if (isAnyProcessing) overallStatus = 'processing';
      else if (isAnyPending) overallStatus = 'pending';

      const primaryOrder = gOrders.find(o => o.proof_of_payment && (Array.isArray(o.proof_of_payment) ? o.proof_of_payment.length > 0 : !!o.proof_of_payment)) || gOrders[0];

      return {
        ...group,
        isMultiStore,
        grandTotal,
        totalDeliveryFee,
        totalAdminFee,
        payment_status,
        overallStatus,
        primaryOrder
      };
    });
  };

  const renderOrderCard = (order) => {
    const isCompleted = order.status === 'completed';
    const isPending = order.status === 'pending';
    const isProcessing = order.status === 'processing';
    const isCancelled = order.status === 'cancelled';
    const isPaid = order.payment_status === 'paid';
    const isWaiting = order.payment_status === 'waiting_confirmation';
    const isTeacher = order.order_for === 'guru' || (order.is_priority && !order.user?.santri_name);
    const isPriority = order.is_priority || isTeacher;

    const { santriName, waliName, santriClass, santriLevel, santriRoom } = getSantriMeta(order.user, order.delivery_location, order.order_for);

    return (
      <div 
        key={order.id} 
        className={`rounded-none border transition-all p-2 sm:p-2.5 flex flex-col justify-between gap-1.5 ${
          isPriority
            ? 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/30 bg-indigo-50/15 dark:bg-indigo-950/10'
            : isCompleted 
            ? 'bg-gray-50/70 dark:bg-gray-900/40 border-green-200 dark:border-green-900/50' 
            : isProcessing
            ? 'bg-white dark:bg-gray-900 border-green-400 dark:border-green-600 ring-1 ring-green-500/20'
            : isPending
            ? 'bg-white dark:bg-gray-900 border-amber-300 dark:border-amber-700 ring-1 ring-amber-500/20'
            : 'bg-white dark:bg-gray-900 border-green-300/80 dark:border-green-800'
        }`}
      >
        {/* Priority Banner for Teacher / Staff */}
        {isPriority && (
          <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 text-white px-2 py-0.5 rounded-none flex items-center justify-between text-[10px] font-black tracking-tight -mx-2 -mt-2 sm:-mx-2.5 sm:-mt-2.5 mb-1 shadow-xs">
            <span className="flex items-center gap-1">
              ⚡ PRIORITAS GURU/STAFF • DIANTAR LANGSUNG
            </span>
            <span className="bg-amber-400 text-indigo-950 px-1.5 py-0.2 rounded-none uppercase text-[9px] font-mono font-black shadow-2xs">
              UNIT {order.user?.teacher_unit || 'YAYASAN'}
            </span>
          </div>
        )}
        {/* 1. Header: Toko, ID, Jam & Status Badges */}
        <div className="flex items-center justify-between gap-1 border-b border-gray-200 dark:border-gray-700/80 pb-1 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded-none bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 truncate">
              🏪 {order.canteen?.name || 'Toko'}
            </span>
            <span className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200 font-mono">
              #{order.id}
            </span>
            <span className="text-[10px] sm:text-xs text-gray-400">
              • {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-1 shrink-0">
            {isPending && (!order.canteen?.couriers || order.canteen.couriers.length === 0) && (
              <span className="text-[9px] sm:text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1 py-0.5 rounded-none border border-amber-200 dark:border-amber-800 flex items-center gap-0.5">
                ⚠️ Belum ada kurir
              </span>
            )}

            <span className={`px-1.5 py-0.5 rounded-none text-[9.5px] sm:text-[10px] font-bold ${
              isPaid
                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                : isWaiting
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-300 animate-pulse'
                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
            }`}>
              {isPaid ? 'Lunas' : isWaiting ? 'Verifikasi' : 'COD / Belum'}
            </span>

            <span className={`px-1.5 py-0.5 rounded-none text-[9.5px] sm:text-[10px] font-bold ${
              isCompleted
                ? 'bg-green-50 text-green-800 dark:bg-green-950/60 dark:text-green-300 border border-green-200 dark:border-green-800'
                : isProcessing
                ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                : isCancelled
                ? 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
            }`}>
              {isCompleted ? 'Selesai' : isProcessing ? 'Diproses' : isCancelled ? 'Batal' : 'Pending'}
            </span>
          </div>
        </div>

        {/* 2. Responsive Body: Left (Customer & Payment Strip), Right (Items) */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-start flex-1">
          {/* Left Column (sm: 5 cols): Santri, Wali, Kontak, Bukti, Pembayaran dalam 1 strip padat */}
          <div className="sm:col-span-5 space-y-1">
            <div className={`p-1.5 rounded-none border text-[11px] space-y-1 ${
              isTeacher 
                ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800' 
                : 'bg-gray-50/80 dark:bg-gray-800/40 border-gray-200/80 dark:border-gray-700/80'
            }`}>
              {/* Row 1: Santri & Wali Info */}
              {isTeacher ? (
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="font-bold text-indigo-950 dark:text-indigo-100 flex items-center gap-1">
                      <span className="text-xs">🎓</span>
                      <span className="truncate">{santriName}</span>
                    </span>
                    <span className="inline-flex items-center px-1 py-0.2 rounded-none bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 text-[9px] font-bold">
                      Unit {order.user?.teacher_unit || 'Yayasan'}
                    </span>
                    {order.user?.niy && (
                      <span className="font-mono text-purple-700 dark:text-purple-300 text-[10px] font-bold">
                        NIY: {order.user.niy}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                    <span className="text-indigo-900 dark:text-indigo-200 font-extrabold bg-indigo-100 dark:bg-indigo-950/60 px-1.5 py-0.2 border border-indigo-200 dark:border-indigo-800">
                      📍 {santriRoom || '-'}
                    </span>
                    {order.user?.phone && (
                      <button
                        type="button"
                        onClick={() => handleContact(order.user?.phone, order.user?.name)}
                        className="text-green-600 dark:text-green-400 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <MessageCircle className="w-2.5 h-2.5" /> WA
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
                      <User className="w-3 h-3 text-gray-400 shrink-0" />
                      <span className="truncate">{santriName}</span>
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-[10px] truncate">
                      (Wali: {waliName})
                    </span>
                    {(santriLevel || santriClass) && (
                      <span className="inline-flex items-center px-1 py-0.2 rounded-none bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 text-[9px] font-bold">
                        🎓 {santriLevel ? `${santriLevel} ` : ''}{santriClass ? `Kelas ${santriClass}` : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                    <span className="text-gray-600 dark:text-gray-300 font-semibold">
                      📍 {santriRoom || '-'}
                    </span>
                    {order.user?.phone && (
                      <button
                        type="button"
                        onClick={() => handleContact(order.user?.phone, order.user?.name)}
                        className="text-green-600 dark:text-green-400 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <MessageCircle className="w-2.5 h-2.5" /> WA
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Row 2: Bukti & Aksi Pembayaran Segaris */}
              <div className="flex items-center justify-between gap-1 pt-1 border-t border-gray-200/60 dark:border-gray-700/60 flex-wrap">
                {/* Proof Badges */}
                <div className="flex items-center gap-1 flex-wrap">
                  {order.proof_of_payment && order.proof_of_payment.length !== 0 ? (
                    <div className="inline-flex items-center gap-0.5">
                      <button 
                        onClick={() => {
                          let proofs = [];
                          if (Array.isArray(order.proof_of_payment)) {
                            proofs = order.proof_of_payment.map(path => getStorageUrl(path));
                          } else {
                            proofs = [getStorageUrl(order.proof_of_payment)];
                          }
                          setSelectedProofs(proofs);
                        }}
                        className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 hover:bg-indigo-100 rounded-none text-[9.5px] font-semibold flex items-center gap-1 transition-colors border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                      >
                        <ImageIcon className="w-2.5 h-2.5" /> Bukti ({Array.isArray(order.proof_of_payment) ? order.proof_of_payment.length : 1})
                      </button>
                      {!isCancelled && (
                        <button 
                          type="button"
                          onClick={() => handleOpenUploadPaymentModal(order)}
                          title="Tambah / perbarui bukti transfer santri"
                          className="px-1 py-0.5 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 hover:bg-green-100 rounded-none text-[9.5px] font-bold flex items-center transition-colors border border-green-200 dark:border-green-800 cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    !isCancelled && (
                      <button 
                        type="button"
                        onClick={() => handleOpenUploadPaymentModal(order)}
                        className="px-1.5 py-0.5 bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300 rounded-none text-[9.5px] font-semibold flex items-center gap-1 transition-colors border border-green-200 dark:border-green-800 cursor-pointer"
                        title="Unggah bukti pembayaran santri"
                      >
                        <UploadCloud className="w-2.5 h-2.5 text-green-600 dark:text-green-400" />
                        <span>+ Bukti</span>
                      </button>
                    )
                  )}

                  {order.proof_of_purchase && order.proof_of_purchase.length !== 0 && (
                    <button 
                      onClick={() => {
                        let proofs = [];
                        if (Array.isArray(order.proof_of_purchase)) {
                          proofs = order.proof_of_purchase.map(path => getStorageUrl(path));
                        } else {
                          proofs = [getStorageUrl(order.proof_of_purchase)];
                        }
                        setSelectedProofs(proofs);
                      }}
                      className="px-1.5 py-0.5 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 hover:bg-purple-100 rounded-none text-[9.5px] font-semibold flex items-center gap-1 transition-colors border border-purple-200 dark:border-purple-800 cursor-pointer"
                    >
                      <ImageIcon className="w-2.5 h-2.5" /> Struk ({Array.isArray(order.proof_of_purchase) ? order.proof_of_purchase.length : 1})
                    </button>
                  )}
                  {order.proof_of_delivery && order.proof_of_delivery.length !== 0 && (
                    <button 
                      onClick={() => {
                        let proofs = [];
                        if (Array.isArray(order.proof_of_delivery)) {
                          proofs = order.proof_of_delivery.map(path => getStorageUrl(path));
                        } else {
                          proofs = [getStorageUrl(order.proof_of_delivery)];
                        }
                        setSelectedProofs(proofs);
                      }}
                      className="px-1.5 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 hover:bg-blue-100 rounded-none text-[9.5px] font-semibold flex items-center gap-1 transition-colors border border-blue-200 dark:border-blue-800 cursor-pointer"
                    >
                      <ImageIcon className="w-2.5 h-2.5" /> Antar ({Array.isArray(order.proof_of_delivery) ? order.proof_of_delivery.length : 1})
                    </button>
                  )}
                </div>

                {/* Aksi Pembayaran */}
                {!isCancelled ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenUploadPaymentModal(order)}
                      className="py-0.5 px-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-none text-[9.5px] font-bold transition-colors flex items-center gap-0.5 cursor-pointer"
                      title="Unggah Bukti Transfer Santri"
                    >
                      <UploadCloud className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Upload</span>
                    </button>

                    {!isPaid ? (
                      <button
                        type="button"
                        disabled={updatePaymentMutation.isPending}
                        onClick={() => updatePaymentMutation.mutate({ id: order.id, status: 'paid', canteen_id: order.canteen_id })}
                        className="py-0.5 px-1.5 bg-green-600 hover:bg-green-700 text-white rounded-none text-[9.5px] font-bold transition-colors flex items-center gap-0.5 disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle className="w-2.5 h-2.5" /> Lunas
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={updatePaymentMutation.isPending}
                        onClick={() => {
                          if (window.confirm('Batalkan status lunas dan kembalikan ke Belum Bayar?')) {
                            updatePaymentMutation.mutate({ id: order.id, status: 'unpaid', canteen_id: order.canteen_id });
                          }
                        }}
                        className="py-0.5 px-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-none text-[9px] font-semibold transition-colors flex items-center gap-0.5 cursor-pointer"
                      >
                        <X className="w-2.5 h-2.5" /> Batal
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1 py-0.2 rounded-none border border-red-200 dark:border-red-900/50">
                    Dibatalkan
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column (sm: 7 cols): Items List & Courier */}
          <div className="sm:col-span-7 space-y-1">
            <div className="bg-gray-50/80 dark:bg-gray-800/50 rounded-none p-1.5 space-y-0.5 text-xs border border-gray-200 dark:border-gray-700">
              {order.custom_notes && (
                <div className="text-[10px] font-medium text-purple-800 dark:text-purple-300 pb-0.5 border-b border-purple-100 dark:border-purple-900/40">
                  ✨ {order.custom_notes}
                </div>
              )}
              {order.items && order.items.length > 0 ? (
                order.items.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-[11px] sm:text-xs py-0.5 border-b border-gray-200/40 dark:border-gray-700/40 last:border-b-0">
                    <span className="text-gray-800 dark:text-gray-200 truncate pr-2">
                      <strong className="text-gray-900 dark:text-white font-bold">{item.quantity}x</strong> {item.product?.name || 'Produk'}
                      {item.notes && <span className="text-gray-400 italic text-[10px]"> ({item.notes})</span>}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white shrink-0 font-mono text-[11px] sm:text-xs">
                      Rp {formatRupiah(item.subtotal || (parseFloat(item.price) * item.quantity))}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between items-center text-[11px] text-gray-500 py-0.5">
                  <span>1x Pesanan Khusus</span>
                  <span className="font-bold text-gray-900 dark:text-white font-mono">
                    Rp {formatRupiah(Math.max(0, parseFloat(order.total_price || 0) - parseFloat(order.delivery_fee || 0) - parseFloat(order.admin_fee || 0)))}
                  </span>
                </div>
              )}

              {/* Kurir info badge if present */}
              {order.courier && (
                <div className="pt-0.5 border-t border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between text-[10px]">
                  <span className="text-gray-500 dark:text-gray-400">Petugas Antar:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 px-1 py-0.2 rounded-none border border-blue-200 dark:border-blue-800">
                    <Truck className="w-2.5 h-2.5" /> {order.courier.name}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Footer: Total Price & Canteen Operational Actions Segaris */}
        <div className="pt-1.5 border-t border-gray-200 dark:border-gray-700/80 flex items-center justify-between gap-1 flex-wrap">
          <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
            <span className="text-sm font-black text-green-700 dark:text-green-400 leading-tight font-mono">
              Rp {formatRupiah(order.total_price)}
            </span>
            <div className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <span>Makanan: <strong className="text-gray-900 dark:text-white font-mono">Rp {formatRupiah(Math.max(0, parseFloat(order.total_price || 0) - parseFloat(order.delivery_fee || 0) - parseFloat(order.admin_fee || 0)))}</strong></span>
              <span>•</span>
              <span>Ongkir: <strong className="text-blue-600 dark:text-blue-400 font-mono">Rp {formatRupiah(order.delivery_fee)}</strong></span>
            </div>
            {Boolean(order.is_custom) && parseFloat(order.total_price) === 0 && (
              <span className="text-[9.5px] text-amber-600 font-semibold">Harga belum diset</span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 flex-wrap">
            {/* Tombol Cetak Struk */}
            <button 
              onClick={() => handlePrintSingleReceipt(order)}
              className="py-1 px-1.5 sm:px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-none text-[10px] sm:text-[11px] font-bold transition-colors flex items-center gap-0.5 cursor-pointer"
              title="Cetak Struk Thermal / A4"
            >
              <Printer className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>Cetak</span>
            </button>

            {/* Set Harga Khusus */}
            {Boolean(order.is_custom) && order.payment_status !== 'paid' && (isPending || isProcessing) && (
              <button 
                onClick={() => {
                  setActiveOrderForSetPrice(order);
                  const deliveryFee = parseFloat(order.delivery_fee || 0);
                  const adminFee = parseFloat(order.admin_fee || 0);
                  const curProductPrice = Math.max(0, parseFloat(order.total_price || 0) - deliveryFee - adminFee);
                  setNewPriceInput(curProductPrice > 0 ? Math.round(curProductPrice).toString() : '');
                  setShowSetPriceModal(true);
                }}
                className="py-1 px-1.5 sm:px-2 bg-purple-600 hover:bg-purple-700 text-white rounded-none text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer"
              >
                🏷️ {parseFloat(order.total_price) === 0 ? 'Set Harga' : 'Edit'}
              </button>
            )}

            {/* Pending Actions: Tolak / Jadwalkan / Lanjutkan */}
            {isPending && (
              <>
                <button 
                  onClick={() => {
                    if(window.confirm('Yakin ingin MENOLAK pesanan ini? Pesanan akan dibatalkan.')) {
                      cancelOrderMutation.mutate({ id: order.id, canteen_id: order.canteen_id });
                    }
                  }}
                  className="py-1 px-1.5 sm:px-2 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 rounded-none text-[10px] sm:text-[11px] font-bold transition-colors border border-red-200 dark:border-red-800 flex items-center gap-0.5 cursor-pointer"
                  title="Tolak Pesanan"
                >
                  <X className="w-3 h-3" />
                  <span>Tolak</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenScheduleModal(order, 'tomorrow')}
                  disabled={updateStatusMutation.isPending}
                  className="py-1 px-1.5 sm:px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-none text-[10px] sm:text-[11px] font-bold transition-colors flex items-center gap-0.5 shadow-2xs cursor-pointer"
                  title="Jadwalkan ke Besok atau tanggal lain"
                >
                  <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>Jadwalkan</span>
                </button>

                <button 
                  disabled={updateStatusMutation.isPending || updatePaymentMutation.isPending}
                  onClick={() => {
                    if (order.payment_status !== 'paid') {
                      setUnpaidProceedOrder(order);
                    } else {
                      updateStatusMutation.mutate({ id: order.id, status: 'processing', canteen_id: order.canteen_id });
                    }
                  }}
                  className="py-1 px-2 sm:px-2.5 bg-green-600 hover:bg-green-700 text-white rounded-none text-[10px] sm:text-[11px] font-bold transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle className="w-3 h-3" /> Lanjutkan
                </button>
              </>
            )}

            {/* Cancelled Actions: Lanjutkan / Jadwalkan kembali */}
            {order.status === 'cancelled' && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleOpenScheduleModal(order, 'tomorrow')}
                  disabled={updateStatusMutation.isPending}
                  className="py-1 px-1.5 sm:px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-none text-[10px] sm:text-[11px] font-bold transition-colors flex items-center gap-0.5 shadow-2xs cursor-pointer"
                  title="Jadwalkan pesanan batal ini ke Besok"
                >
                  <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>Jadwalkan</span>
                </button>
                <button
                  type="button"
                  disabled={updateStatusMutation.isPending}
                  onClick={() => {
                    updateStatusMutation.mutate({ id: order.id, status: 'processing', canteen_id: order.canteen_id });
                  }}
                  className="py-1 px-2 bg-green-600 hover:bg-green-700 text-white rounded-none text-[10px] sm:text-[11px] font-bold transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  title="Lanjutkan kembali pesanan yang dibatalkan"
                >
                  <RotateCcw className="w-3 h-3" /> Lanjutkan
                </button>
              </div>
            )}

            {/* Processing Actions */}
            {isProcessing && (
              <>
                {!order.courier_id && (!order.proof_of_purchase || order.proof_of_purchase.length === 0) && (
                  <button 
                    onClick={() => {
                      setActiveOrderForReceipt(order);
                      setShowReceiptModal(true);
                    }}
                    className="py-1 px-1.5 sm:px-2 bg-purple-600 hover:bg-purple-700 text-white rounded-none text-[10px] sm:text-[11px] font-bold transition-colors flex items-center gap-0.5 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" /> + Struk
                  </button>
                )}
                {!order.courier_id && (
                  <button 
                    onClick={() => {
                      if(window.confirm('Yakin pesanan ini sudah selesai diantar ke santri?')) {
                        updateStatusMutation.mutate({ id: order.id, status: 'completed', canteen_id: order.canteen_id });
                      }
                    }}
                    className="py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-none text-[10px] sm:text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle className="w-3 h-3" /> Selesaikan
                  </button>
                )}
                {order.courier_id && (
                  <span className="text-[9.5px] sm:text-[10px] font-semibold text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded-none border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                    <Truck className="w-2.5 h-2.5" /> {order.courier?.name || 'Kurir'}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderBundledOrderCard = (group) => {
    const isCompleted = group.overallStatus === 'completed';
    const isPending = group.overallStatus === 'pending';
    const isProcessing = group.overallStatus === 'processing';
    const isPartial = group.overallStatus === 'partial';
    const isCancelled = group.overallStatus === 'cancelled';
    const isPaid = group.payment_status === 'paid';
    const isWaiting = group.payment_status === 'waiting_confirmation';

    const pOrder = group.primaryOrder;
    const { santriName, waliName, santriClass, santriLevel, santriRoom } = getSantriMeta(pOrder.user, pOrder.delivery_location || group.delivery_location, pOrder.order_for);

    const allPaymentProofs = Array.from(new Set(
      group.orders.flatMap(o => {
        if (!o.proof_of_payment) return [];
        return Array.isArray(o.proof_of_payment) ? o.proof_of_payment : [o.proof_of_payment];
      }).filter(Boolean)
    ));

    const allPurchaseProofs = Array.from(new Set(
      group.orders.flatMap(o => {
        if (!o.proof_of_purchase) return [];
        return Array.isArray(o.proof_of_purchase) ? o.proof_of_purchase : [o.proof_of_purchase];
      }).filter(Boolean)
    ));

    const allDeliveryProofs = Array.from(new Set(
      group.orders.flatMap(o => {
        if (!o.proof_of_delivery) return [];
        return Array.isArray(o.proof_of_delivery) ? o.proof_of_delivery : [o.proof_of_delivery];
      }).filter(Boolean)
    ));

    return (
      <div 
        key={group.key} 
        className={`rounded-none border transition-all p-2 sm:p-2.5 flex flex-col justify-between gap-1.5 col-span-1 lg:col-span-2 ${
          isCompleted 
            ? 'bg-gray-50/70 dark:bg-gray-900/40 border-green-200 dark:border-green-900/50' 
            : isProcessing
            ? 'bg-white dark:bg-gray-900 border-green-400 dark:border-green-600 ring-1 ring-green-500/20'
            : isPending
            ? 'bg-white dark:bg-gray-900 border-amber-300 dark:border-amber-700 ring-1 ring-amber-500/20'
            : isPartial
            ? 'bg-white dark:bg-gray-900 border-purple-300 dark:border-purple-700 ring-1 ring-purple-500/20'
            : 'bg-white dark:bg-gray-900 border-green-300/80 dark:border-green-800'
        }`}
      >
        {/* 1. Header: Multi-Toko Badge, Order IDs, Jam & Status Badges */}
        <div className="flex items-center justify-between gap-1 border-b border-gray-200 dark:border-gray-700/80 pb-1 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded-none bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 truncate">
              📦 {group.orders.length} Toko Pesanan
            </span>
            <span className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200 font-mono">
              #{group.orders.map(o => o.id).join(', #')}
            </span>
            <span className="text-[10px] text-gray-400">
              • {new Date(group.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-1 shrink-0">
            <span className={`px-1.5 py-0.5 rounded-none text-[9.5px] sm:text-[10px] font-bold ${
              isPaid
                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                : isWaiting
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-300 animate-pulse'
                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
            }`}>
              {isPaid ? 'Lunas' : isWaiting ? 'Verifikasi' : 'COD / Belum'}
            </span>

            <span className={`px-1.5 py-0.5 rounded-none text-[9.5px] sm:text-[10px] font-bold ${
              isCompleted
                ? 'bg-green-50 text-green-800 dark:bg-green-950/60 dark:text-green-300 border border-green-200 dark:border-green-800'
                : isProcessing
                ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                : isPartial
                ? 'bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                : isCancelled
                ? 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
            }`}>
              {isCompleted ? 'Selesai' : isProcessing ? 'Diproses' : isPartial ? 'Sebagian' : isCancelled ? 'Batal' : 'Pending'}
            </span>
          </div>
        </div>

        {/* 2. Responsive Body: Left (Customer & Payment Strip), Right (Stores breakdown) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-1.5 items-start flex-1">
          {/* Left Column (5 of 12 cols on lg+): Santri, Room, Wali, WA, Proofs, Payment */}
          <div className="lg:col-span-5 space-y-1">
            <div className="bg-gray-50/80 dark:bg-gray-800/40 p-1.5 rounded-none border border-gray-200/80 dark:border-gray-700/80 text-[11px] space-y-1">
              {/* Row 1: Santri & Wali Info */}
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
                    <User className="w-3 h-3 text-gray-400 shrink-0" />
                    <span className="truncate">{santriName}</span>
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 text-[10px] truncate">
                    (Wali: {waliName})
                  </span>
                  {(santriLevel || santriClass) && (
                    <span className="inline-flex items-center px-1 py-0.2 rounded-none bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 text-[9px] font-bold">
                      🎓 {santriLevel ? `${santriLevel} ` : ''}{santriClass ? `Kelas ${santriClass}` : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                  <span className="text-gray-600 dark:text-gray-300 font-semibold">
                    📍 {santriRoom || '-'}
                  </span>
                  {pOrder.user?.phone && (
                    <button
                      type="button"
                      onClick={() => handleContact(pOrder.user?.phone, pOrder.user?.name)}
                      className="text-green-600 dark:text-green-400 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <MessageCircle className="w-2.5 h-2.5" /> WA
                    </button>
                  )}
                </div>
              </div>

              {/* Row 2: Proofs & Payment Inline Strip */}
              <div className="flex items-center justify-between gap-1 pt-1 border-t border-gray-200/60 dark:border-gray-700/60 flex-wrap">
                {/* Proof Badges */}
                <div className="flex items-center gap-1 flex-wrap">
                  {allPaymentProofs.length > 0 ? (
                    <div className="inline-flex items-center gap-0.5">
                      <button 
                        onClick={() => setSelectedProofs(allPaymentProofs.map(p => getStorageUrl(p)))}
                        className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 hover:bg-indigo-100 rounded-none text-[9.5px] font-semibold flex items-center gap-1 transition-colors border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                      >
                        <ImageIcon className="w-2.5 h-2.5" /> Bukti ({allPaymentProofs.length})
                      </button>
                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={() => handleOpenUploadPaymentModal({ ...pOrder, _groupOrders: group.orders, _groupGrandTotal: group.grandTotal })}
                          title="Tambah / perbarui bukti transfer santri"
                          className="px-1 py-0.5 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 hover:bg-green-100 rounded-none text-[9.5px] font-bold flex items-center transition-colors border border-green-200 dark:border-green-800 cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    !isCancelled && (
                      <button 
                        type="button"
                        onClick={() => handleOpenUploadPaymentModal({ ...pOrder, _groupOrders: group.orders, _groupGrandTotal: group.grandTotal })}
                        className="px-1.5 py-0.5 bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300 rounded-none text-[9.5px] font-semibold flex items-center gap-1 transition-colors border border-green-200 dark:border-green-800 cursor-pointer"
                        title="Unggah bukti pembayaran santri"
                      >
                        <UploadCloud className="w-2.5 h-2.5 text-green-600 dark:text-green-400" />
                        <span>+ Bukti</span>
                      </button>
                    )
                  )}

                  {allPurchaseProofs.length > 0 && (
                    <button 
                      onClick={() => setSelectedProofs(allPurchaseProofs.map(p => getStorageUrl(p)))}
                      className="px-1.5 py-0.5 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 hover:bg-purple-100 rounded-none text-[9.5px] font-semibold flex items-center gap-1 transition-colors border border-purple-200 dark:border-purple-800 cursor-pointer"
                    >
                      <ImageIcon className="w-2.5 h-2.5" /> Struk ({allPurchaseProofs.length})
                    </button>
                  )}
                  {allDeliveryProofs.length > 0 && (
                    <button 
                      onClick={() => setSelectedProofs(allDeliveryProofs.map(p => getStorageUrl(p)))}
                      className="px-1.5 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 hover:bg-blue-100 rounded-none text-[9.5px] font-semibold flex items-center gap-1 transition-colors border border-blue-200 dark:border-blue-800 cursor-pointer"
                    >
                      <ImageIcon className="w-2.5 h-2.5" /> Antar ({allDeliveryProofs.length})
                    </button>
                  )}
                </div>

                {/* Payment Actions */}
                {!isCancelled ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenUploadPaymentModal({ ...pOrder, _groupOrders: group.orders, _groupGrandTotal: group.grandTotal })}
                      className="py-0.5 px-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-none text-[9.5px] font-bold transition-colors flex items-center gap-0.5 cursor-pointer"
                      title="Unggah Bukti Transfer Santri"
                    >
                      <UploadCloud className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Upload</span>
                    </button>

                    {!isPaid ? (
                      <button
                        type="button"
                        disabled={updatePaymentMutation.isPending}
                        onClick={() => {
                          updatePaymentMutation.mutate({ id: pOrder.id, status: 'paid', canteen_id: pOrder.canteen_id });
                        }}
                        className="py-0.5 px-1.5 bg-green-600 hover:bg-green-700 text-white rounded-none text-[9.5px] font-bold transition-colors flex items-center gap-0.5 disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle className="w-2.5 h-2.5" /> Lunas
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={updatePaymentMutation.isPending}
                        onClick={() => {
                          if (window.confirm('Batalkan status lunas untuk paket checkout ini dan kembalikan ke Belum Bayar?')) {
                            updatePaymentMutation.mutate({ id: pOrder.id, status: 'unpaid', canteen_id: pOrder.canteen_id });
                          }
                        }}
                        className="py-0.5 px-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-none text-[9px] font-semibold transition-colors flex items-center gap-0.5 cursor-pointer"
                      >
                        <X className="w-2.5 h-2.5" /> Batal
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1 py-0.2 rounded-none border border-red-200 dark:border-red-900/50">
                    Dibatalkan
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column (7 of 12 cols on md+): Per-Toko Breakdown Box */}
          <div className="lg:col-span-7 space-y-1">
            {group.orders.map((o, oIdx) => (
              <div key={o.id} className="bg-gray-50/80 dark:bg-gray-800/50 rounded-none p-1.5 space-y-0.5 text-xs border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between pb-0.5 border-b border-gray-200/60 dark:border-gray-700/60">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="font-bold text-[11px] sm:text-xs text-gray-900 dark:text-white truncate">
                      🏪 {o.canteen?.name || `Toko ${oIdx + 1}`}
                    </span>
                    <span className="text-[10px] text-gray-500 font-semibold shrink-0 font-mono">
                      #{o.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {o.status === 'pending' && (!o.canteen?.couriers || o.canteen.couriers.length === 0) && (
                      <span className="text-[9px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1 py-0.2 rounded-none border border-amber-200 dark:border-amber-800 flex items-center gap-0.5">
                        ⚠️ No kurir
                      </span>
                    )}
                    {o.courier && (
                      <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-0.5 bg-blue-50 dark:bg-blue-950/40 px-1 py-0.2 rounded-none border border-blue-200 dark:border-blue-800">
                        <Truck className="w-2.5 h-2.5" /> {o.courier.name}
                      </span>
                    )}
                    <span className={`px-1 py-0.2 rounded-none text-[9px] font-bold ${
                      o.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                      o.status === 'processing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                      o.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                      'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}>
                      {o.status === 'completed' ? 'Selesai' : o.status === 'processing' ? 'Diproses' : o.status === 'cancelled' ? 'Batal' : 'Pending'}
                    </span>
                  </div>
                </div>

                {o.custom_notes && (
                  <div className="text-[10px] font-medium text-purple-800 dark:text-purple-300 pb-0.5">
                    ✨ {o.custom_notes}
                  </div>
                )}

                {o.items && o.items.length > 0 ? (
                  o.items.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-[11px] sm:text-xs py-0.5 border-b border-gray-200/40 dark:border-gray-700/40 last:border-b-0">
                      <span className="text-gray-800 dark:text-gray-200 truncate pr-2">
                        <strong className="text-gray-900 dark:text-white font-bold">{item.quantity}x</strong> {item.product?.name || 'Produk'}
                        {item.notes && <span className="text-gray-400 italic text-[10px]"> ({item.notes})</span>}
                      </span>
                      <span className="font-bold text-gray-900 dark:text-white shrink-0 font-mono text-[11px] sm:text-xs">
                        Rp {formatRupiah(item.subtotal || (parseFloat(item.price) * item.quantity))}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between items-center text-[11px] text-gray-500 py-0.5">
                    <span>1x Pesanan Khusus</span>
                    <span className="font-bold text-gray-900 dark:text-white font-mono">
                      Rp {formatRupiah(Math.max(0, parseFloat(o.total_price || 0) - parseFloat(o.delivery_fee || 0) - parseFloat(o.admin_fee || 0)))}
                    </span>
                  </div>
                )}

                {/* Subtotal Toko & Custom Price Setting */}
                <div className="flex items-center justify-between pt-0.5 border-t border-gray-200/50 dark:border-gray-700/50 text-[10px]">
                  <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                    <span>Produk Toko:</span>
                    <span className="text-[9.5px] font-normal text-gray-400 font-mono">
                      (Ongkir: Rp {formatRupiah(o.delivery_fee)})
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {Boolean(o.is_custom) && o.payment_status !== 'paid' && (o.status === 'pending' || o.status === 'processing') && (
                      <button 
                        onClick={() => {
                          setActiveOrderForSetPrice(o);
                          const deliveryFee = parseFloat(o.delivery_fee || 0);
                          const adminFee = parseFloat(o.admin_fee || 0);
                          const curProductPrice = Math.max(0, parseFloat(o.total_price || 0) - deliveryFee - adminFee);
                          setNewPriceInput(curProductPrice > 0 ? Math.round(curProductPrice).toString() : '');
                          setShowSetPriceModal(true);
                        }}
                        className="py-0.5 px-1 bg-purple-600 hover:bg-purple-700 text-white rounded-none text-[9px] font-bold transition-colors cursor-pointer"
                      >
                        🏷️ {parseFloat(o.total_price) === 0 ? 'Set Harga' : 'Edit'}
                      </button>
                    )}
                    <span className="font-bold text-gray-900 dark:text-white font-mono">
                      Rp {formatRupiah(Math.max(0, parseFloat(o.total_price || 0) - parseFloat(o.delivery_fee || 0) - parseFloat(o.admin_fee || 0)))}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Footer: Total Price & Actions Segaris */}
        <div className="pt-1.5 border-t border-gray-200 dark:border-gray-700/80 flex items-center justify-between gap-1 flex-wrap">
          <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
            <span className="text-sm font-black text-green-700 dark:text-green-400 leading-tight font-mono">
              Rp {formatRupiah(group.grandTotal)}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">
              ({group.orders.length} Toko)
            </span>
            <div className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <span>Ongkir: <strong className="text-blue-600 dark:text-blue-400 font-mono">Rp {formatRupiah(group.totalDeliveryFee)}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 flex-wrap">
            {/* Tombol Cetak Struk Batch */}
            <button 
              onClick={() => {
                setReceiptModalConfig({
                  isOpen: true,
                  mode: 'batch',
                  order: null,
                  orders: group.orders,
                  title: `Struk Paket Checkout (${group.orders.length} Toko)`
                });
              }}
              className="py-1 px-1.5 sm:px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-none text-[10px] sm:text-[11px] font-bold transition-colors flex items-center gap-0.5 cursor-pointer"
              title="Cetak Struk Semua Toko dalam Paket Ini"
            >
              <Printer className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>Cetak Struk</span>
            </button>

            {/* Pending & Partial Actions: Tolak / Jadwalkan / Lanjutkan */}
            {(isPending || isPartial) && (
              <>
                {isPending && (
                  <button 
                    disabled={batchUpdateStatusMutation.isPending}
                    onClick={() => {
                      if (window.confirm('Yakin ingin MENOLAK semua pesanan dalam paket ini? Pesanan akan dibatalkan.')) {
                        const pendingOrders = group.orders.filter(o => o.status === 'pending');
                        if (pendingOrders.length > 0) {
                          batchUpdateStatusMutation.mutate({ 
                            order_ids: pendingOrders.map(o => o.id), 
                            status: 'cancelled', 
                            canteen_id: selectedCanteenFilter !== 'all' ? selectedCanteenFilter : undefined 
                          });
                        }
                      }
                    }}
                    className="py-1 px-1.5 sm:px-2 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 rounded-none text-[10px] sm:text-[11px] font-bold transition-colors border border-red-200 dark:border-red-800 disabled:opacity-50 flex items-center gap-0.5 cursor-pointer"
                    title="Tolak Semua Pesanan Paket Ini"
                  >
                    <X className="w-3 h-3" />
                    <span>Tolak</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenScheduleModal(group, 'tomorrow')}
                  disabled={batchUpdateStatusMutation.isPending}
                  className="py-1 px-1.5 sm:px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-none text-[10px] sm:text-[11px] font-bold transition-colors flex items-center gap-0.5 shadow-2xs cursor-pointer"
                  title="Jadwalkan semua pesanan paket ini ke Besok atau tanggal lain"
                >
                  <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>Jadwalkan</span>
                </button>

                <button 
                  disabled={batchUpdateStatusMutation.isPending || updatePaymentMutation.isPending}
                  onClick={() => {
                    const pendingOrders = group.orders.filter(o => o.status === 'pending');
                    if (pendingOrders.length === 0) return;

                    if (!isPaid) {
                      setUnpaidProceedOrder({ 
                        ...pOrder, 
                        _groupOrders: group.orders, 
                        _groupGrandTotal: group.grandTotal 
                      });
                    } else {
                      batchUpdateStatusMutation.mutate({ 
                        order_ids: pendingOrders.map(o => o.id), 
                        status: 'processing', 
                        canteen_id: selectedCanteenFilter !== 'all' ? selectedCanteenFilter : undefined 
                      });
                    }
                  }}
                  className="py-1 px-2 sm:px-2.5 bg-green-600 hover:bg-green-700 text-white rounded-none text-[10px] sm:text-[11px] font-bold transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle className="w-3 h-3" /> {isPartial ? 'Lanjutkan Sisa' : 'Lanjutkan'}
                </button>
              </>
            )}

            {/* Cancelled Bundled Actions: Lanjutkan / Jadwalkan kembali */}
            {isCancelled && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleOpenScheduleModal(group, 'tomorrow')}
                  disabled={batchUpdateStatusMutation.isPending}
                  className="py-1 px-1.5 sm:px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-none text-[10px] sm:text-[11px] font-bold transition-colors flex items-center gap-0.5 shadow-2xs cursor-pointer"
                  title="Jadwalkan paket pesanan yang dibatalkan ke Besok"
                >
                  <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>Jadwalkan</span>
                </button>
                <button
                  type="button"
                  disabled={batchUpdateStatusMutation.isPending}
                  onClick={() => {
                    batchUpdateStatusMutation.mutate({ 
                      order_ids: group.orders.map(o => o.id), 
                      status: 'processing', 
                      canteen_id: selectedCanteenFilter !== 'all' ? selectedCanteenFilter : undefined 
                    });
                  }}
                  className="py-1 px-2 bg-green-600 hover:bg-green-700 text-white rounded-none text-[10px] sm:text-[11px] font-bold transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  title="Lanjutkan kembali semua pesanan yang dibatalkan"
                >
                  <RotateCcw className="w-3 h-3" /> Lanjutkan
                </button>
              </div>
            )}

            {/* Processing Actions */}
            {(isProcessing || isPartial) && (
              <button 
                disabled={batchUpdateStatusMutation.isPending}
                onClick={() => {
                  if (window.confirm('Yakin semua pesanan yang sedang diproses dalam paket ini sudah selesai diantar ke santri?')) {
                    const procOrders = group.orders.filter(o => o.status === 'processing');
                    if (procOrders.length > 0) {
                      batchUpdateStatusMutation.mutate({ 
                        order_ids: procOrders.map(o => o.id), 
                        status: 'completed', 
                        canteen_id: selectedCanteenFilter !== 'all' ? selectedCanteenFilter : undefined 
                      });
                    }
                  }
                }}
                className="py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-none text-[10px] sm:text-[11px] font-bold transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle className="w-3 h-3" /> Selesaikan
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-28 dark:bg-gray-950 font-sans animate-fade-in-up">
      <div className="max-w-7xl mx-auto p-2.5 sm:p-4 space-y-2.5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate({ to: '/dashboard' })} 
              className="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-none transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer shrink-0"
              title="Kembali ke Dashboard"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black text-gray-900 dark:text-white leading-tight">
                Pesanan Masuk & Rekap Toko
              </h1>
              <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
                Kelola pesanan santri, atur harga titip beli, dan pantau omzet toko.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => setShowAccountingModal(true)}
              className="w-full sm:w-auto px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-none text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              title="Lihat Logika & Rumus Akuntansi"
            >
              <Calculator className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">Akuntansi & Ongkir</span>
            </button>
            <button
              onClick={handlePrintBatchReceipt}
              className="w-full sm:w-auto px-2 py-1.5 bg-gray-900 hover:bg-black text-white dark:bg-gray-800 dark:hover:bg-gray-700 rounded-none text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              title="Cetak Rekap Pesanan Toko ke Printer Thermal"
            >
              <Printer className="w-3.5 h-3.5 text-green-400 shrink-0" />
              <span className="truncate">Cetak Rekap ({orders.length})</span>
            </button>
            <button
              onClick={() => setShowRecapModal(true)}
              className="w-full sm:w-auto px-2 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-none text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-xs border border-gray-200 dark:border-gray-700 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-green-600 shrink-0" />
              <span className="truncate">Rekap per Produk</span>
            </button>
            <button 
              onClick={() => setShowManualModal(true)}
              className="w-full sm:w-auto px-2 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-none text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1 cursor-pointer"
            >
              <span className="text-sm leading-none">＋</span>
              <span className="truncate">Pesanan Manual</span>
            </button>
          </div>
        </div>

        {/* UNIFIED GLOBAL FILTER SECTION */}
        <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between flex-wrap gap-1 border-b border-gray-100 dark:border-gray-800 pb-1">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-green-600" />
              Filter Periode
            </h3>
            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-none bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300 border border-green-200 dark:border-green-800">
              📅 Periode: <strong>{getFilterLabel()}</strong>
            </span>
          </div>

          {/* Mode Filter Selector */}
          <div className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar">
            {[
              { id: 'day', label: 'Harian (Per Tanggal)' },
              { id: 'week', label: 'Mingguan' },
              { id: 'month', label: 'Bulanan' },
              { id: 'year', label: 'Tahunan' },
              { id: 'all', label: 'Semua Waktu' }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setFilterMode(m.id);
                  if (m.id === 'week') {
                    setFilterWeekIndex(getCurrentWeekIndex(filterYear, filterMonth));
                  }
                }}
                className={`px-2 py-0.5 rounded-none text-[11px] font-bold whitespace-nowrap transition-all shadow-xs cursor-pointer ${
                  filterMode === m.id
                    ? 'bg-green-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Dynamic Inputs & Filters Grid - Kanan-Kiri Padat */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 pt-0.5">
            {/* 1. Date Input (Per Tanggal / Datepicker) */}
            {filterMode === 'day' && (
              <div className="col-span-1">
                <label className="block text-[9.5px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 truncate">
                  PILIH TANGGAL:
                </label>
                <div className="relative group">
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.target.showPicker();
                      } catch {
                        // Fallback for older browsers
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    title="Klik untuk memilih hari / tanggal / bulan / tahun"
                  />
                  <div className="w-full flex items-center justify-between px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-none text-xs bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-semibold group-hover:border-green-500 transition-all shadow-xs">
                    <span className="truncate">
                      {formatFullDate(filterDate)}
                    </span>
                    <Calendar className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0 ml-1" />
                  </div>
                </div>
              </div>
            )}

            {/* Week Mode Inputs: Bulan & Tahun Berdampingan */}
            {filterMode === 'week' && (
              <>
                <div className="col-span-1">
                  <label className="block text-[9.5px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 truncate">
                    PILIH BULAN:
                  </label>
                  <select
                    value={filterMonth}
                    onChange={(e) => {
                      const newMonth = parseInt(e.target.value);
                      setFilterMonth(newMonth);
                      setFilterWeekIndex(getCurrentWeekIndex(filterYear, newMonth));
                    }}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-none text-xs bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-medium focus:ring-1 focus:ring-green-500"
                  >
                    {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map(
                      (m, i) => (
                        <option key={i} value={i}>
                          {m}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="col-span-1">
                  <label className="block text-[9.5px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 truncate">
                    PILIH TAHUN:
                  </label>
                  <select
                    value={filterYear}
                    onChange={(e) => {
                      const newYear = parseInt(e.target.value);
                      setFilterYear(newYear);
                      setFilterWeekIndex(getCurrentWeekIndex(newYear, filterMonth));
                    }}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-none text-xs bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-medium focus:ring-1 focus:ring-green-500"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1">
                  <label className="block text-[9.5px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 truncate">
                    RENTANG MINGGU:
                  </label>
                  <select
                    value={filterWeekIndex < getWeeksInMonth(filterYear, filterMonth).length ? filterWeekIndex : 0}
                    onChange={(e) => setFilterWeekIndex(parseInt(e.target.value))}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-none text-xs bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-medium focus:ring-1 focus:ring-green-500"
                  >
                    {getWeeksInMonth(filterYear, filterMonth).map((w, i) => (
                      <option key={i} value={i}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Month Mode Input */}
            {filterMode === 'month' && (
              <>
                <div className="col-span-1">
                  <label className="block text-[9.5px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 truncate">
                    PILIH BULAN:
                  </label>
                  <select
                    value={filterMonth}
                    onChange={(e) => {
                      const newMonth = parseInt(e.target.value);
                      setFilterMonth(newMonth);
                      setFilterWeekIndex(getCurrentWeekIndex(filterYear, newMonth));
                    }}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-none text-xs bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-medium focus:ring-1 focus:ring-green-500"
                  >
                    {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map(
                      (m, i) => (
                        <option key={i} value={i}>
                          {m}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="col-span-1">
                  <label className="block text-[9.5px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 truncate">
                    PILIH TAHUN:
                  </label>
                  <select
                    value={filterYear}
                    onChange={(e) => {
                      const newYear = parseInt(e.target.value);
                      setFilterYear(newYear);
                      setFilterWeekIndex(getCurrentWeekIndex(newYear, filterMonth));
                    }}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-none text-xs bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-medium focus:ring-1 focus:ring-green-500"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Year Mode Selector */}
            {filterMode === 'year' && (
              <div className="col-span-1">
                <label className="block text-[9.5px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 truncate">
                  PILIH TAHUN:
                </label>
                <select
                  value={filterYear}
                  onChange={(e) => {
                    const newYear = parseInt(e.target.value);
                    setFilterYear(newYear);
                    setFilterWeekIndex(getCurrentWeekIndex(newYear, filterMonth));
                  }}
                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-none text-xs bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-medium focus:ring-1 focus:ring-green-500"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status Filter */}
            <div className="col-span-1">
              <label className="block text-[9.5px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 truncate">
                FILTER STATUS:
              </label>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-none text-xs font-semibold bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-green-500"
              >
                <option value="all">📋 Semua Status</option>
                <option value="waiting_confirmation">⏳ Menunggu Validasi Bayar</option>
                <option value="paid">💳 Sudah Bayar (Lunas)</option>
                <option value="unpaid">⚠️ Belum Bayar</option>
                <option value="pending">⏳ Belum Dikonfirmasi (Pending)</option>
                <option value="processing">🚚 Sedang Diproses</option>
                <option value="completed">✅ Selesai</option>
                <option value="cancelled">❌ Ditolak / Dibatalkan</option>
              </select>
            </div>

            {/* Search Box - Fleksibel Mengisi Kanan-Kiri Padat */}
            <div className={
              filterMode === 'month' || filterMode === 'all'
                ? 'col-span-1'
                : 'col-span-2 sm:col-span-2 lg:col-span-2'
            }>
              <label className="block text-[9.5px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 truncate">
                PENCARIAN CEPAT:
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Ketik nama Santri / Wali / Toko / Order ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 border border-gray-300 dark:border-gray-700 rounded-none text-xs bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:ring-1 focus:ring-green-500 font-medium"
                />
              </div>
            </div>
          </div>
        </div>

        {/* MAIN TAB SWITCHER */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-1 flex gap-1 rounded-none shadow-xs">
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-1.5 px-3 text-xs font-bold rounded-none flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-green-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Daftar Pesanan</span>
            <span className={`px-1.5 py-0.2 rounded-none text-[10px] font-black font-mono ${
              activeTab === 'orders'
                ? 'bg-white/20 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            }`}>
              {isLoading && !ordersRes ? '...' : orders.length}
            </span>
            {isFetching && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" title="Memperbarui data..."></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('recap')}
            className={`py-1.5 px-3 text-xs font-bold rounded-none flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'recap'
                ? 'bg-green-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Tab Rekap & Statistik</span>
            {recapData?.summary?.total_orders !== undefined && (
              <span className={`px-1.5 py-0.2 rounded-none text-[10px] font-black font-mono ${
                activeTab === 'recap'
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}>
                {isLoadingRecap && !recapData ? '...' : recapData.summary.total_orders}
              </span>
            )}
            {isFetchingRecap && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" title="Memperbarui rekap..."></span>
            )}
          </button>
        </div>

        {/* TAB CONTENTS */}
        {activeTab === 'recap' ? (
          <div className="space-y-2">
            {isLoadingRecap && !recapData ? (
              <div className="bg-white dark:bg-gray-900 rounded-none border border-gray-200 dark:border-gray-800 py-12 flex flex-col items-center justify-center gap-2 text-gray-500">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-green-600"></div>
                <span className="text-xs font-semibold">Memuat data rekapitulasi...</span>
              </div>
            ) : (
              <>
                {/* Banner Logika Akuntansi & Ongkir */}
                <div className="bg-gradient-to-r from-emerald-900 via-green-800 to-teal-950 text-white rounded-none p-2 sm:p-2.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-green-700/60">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-none bg-green-500/20 border border-green-400/30 flex items-center justify-center text-green-300 shrink-0">
                      <Calculator className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5 leading-tight">
                        Sistem & Logika Akuntansi Toko
                        <span className="text-[9.5px] bg-green-500/30 text-green-300 font-bold px-1.5 py-0.2 rounded-none border border-green-400/20">
                          Transparan
                        </span>
                      </h4>
                      <p className="text-[10px] sm:text-[11px] text-green-200/80 leading-tight mt-0.5">
                        Total Belanja (HPJ) & Laba Bersih adalah hak toko Anda. Ongkir adalah hak kurir pengantar santri.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAccountingModal(true)}
                    className="py-1 px-3 bg-green-600 hover:bg-green-500 text-white font-bold text-xs rounded-none transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Panduan & Kalkulator Akuntansi</span>
                  </button>
                </div>

                {/* Summary Metric Cards (Khusus Kantin: Total Belanja, Total Modal, Laba Toko, Total Ongkir) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2">
                  <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider block">Omzet Menu (HPJ)</span>
                    <span className="text-sm sm:text-base font-black font-mono text-gray-900 dark:text-white block mt-0.5">
                      Rp {(recapData?.summary?.total_products || 0).toLocaleString('id-ID')}
                    </span>
                    <span className="text-[9.5px] text-gray-400 block mt-0.5">Penjualan Makanan</span>
                  </div>
                  <div className="bg-amber-50/60 dark:bg-amber-950/20 p-2 sm:p-2.5 rounded-none border border-amber-200/80 dark:border-amber-800/40 shadow-xs">
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider block">Total Modal (HPP)</span>
                    <span className="text-sm sm:text-base font-black font-mono text-amber-700 dark:text-amber-300 block mt-0.5">
                      Rp {(recapData?.summary?.total_hpp || 0).toLocaleString('id-ID')}
                    </span>
                    <span className="text-[9.5px] text-amber-600/80 dark:text-amber-400/80 block mt-0.5">Modal Belanja Riil</span>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 sm:p-2.5 rounded-none border border-emerald-200 dark:border-emerald-800/50 shadow-xs">
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold uppercase tracking-wider block">Laba Bersih Toko</span>
                    <span className="text-sm sm:text-base font-black font-mono text-emerald-700 dark:text-emerald-300 block mt-0.5">
                      Rp {(recapData?.summary?.total_profit || 0).toLocaleString('id-ID')}
                    </span>
                    <span className="text-[9.5px] text-emerald-600/80 dark:text-emerald-400/80 block mt-0.5">100% Hak Toko</span>
                  </div>
                  <div className="bg-blue-50/60 dark:bg-blue-950/20 p-2 sm:p-2.5 rounded-none border border-blue-200/80 dark:border-blue-800/40 shadow-xs">
                    <span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase tracking-wider block">Total Ongkir Kurir</span>
                    <span className="text-sm sm:text-base font-black font-mono text-blue-600 dark:text-blue-400 block mt-0.5">
                      Rp {(recapData?.summary?.total_delivery_fee || 0).toLocaleString('id-ID')}
                    </span>
                    <span className="text-[9.5px] text-blue-600/80 dark:text-blue-400/80 block mt-0.5">Hak Driver/Kurir</span>
                  </div>
                </div>

                {/* Rekap Per Toko / Kantin */}
                {recapData?.canteen_recap && recapData.canteen_recap.length > 0 && (
                  <div className="bg-white dark:bg-gray-900 rounded-none shadow-xs border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <div className="p-2 sm:p-2.5 border-b border-gray-200 dark:border-gray-800 bg-blue-50/50 dark:bg-blue-950/20 flex items-center justify-between">
                      <h3 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-blue-600" />
                        Rekapitulasi Per Toko / Kantin
                      </h3>
                      <span className="text-[10px] font-bold text-gray-500 bg-white dark:bg-gray-800 px-1.5 py-0.2 border border-gray-200 dark:border-gray-700">
                        {recapData.canteen_recap.length} Toko
                      </span>
                    </div>
                    <div className="divide-y divide-gray-200 dark:divide-gray-800">
                      {recapData.canteen_recap.map(c => (
                        <div key={c.canteen_id} className="p-2 sm:p-2.5 space-y-1.5 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div>
                              <h4 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm flex items-center gap-1.5">
                                🏪 {c.canteen_name}
                                <span className="text-[9.5px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold px-1.5 py-0.2 rounded-none capitalize border border-blue-200 dark:border-blue-800">
                                  Zona {c.category}
                                </span>
                              </h4>
                              <p className="text-[10px] text-gray-500">{c.order_count} Total Pesanan</p>
                            </div>
                            <div className="text-xs sm:text-sm font-black font-mono text-green-700 dark:text-green-400 self-start sm:self-auto">
                              Total Belanja: Rp {c.total_products.toLocaleString('id-ID')}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs font-semibold">
                            <div className="bg-gray-50 dark:bg-gray-800/80 p-1.5 rounded-none border border-gray-200/60 dark:border-gray-700/60">
                              <span className="text-[9.5px] text-gray-400 block">Produk & Modal (HPP)</span>
                              <div className="text-gray-800 dark:text-gray-200 font-mono">Rp {c.total_products.toLocaleString('id-ID')}</div>
                              <div className="text-[9.5px] text-amber-600 dark:text-amber-400 font-normal font-mono">HPP: Rp {(c.total_hpp || 0).toLocaleString('id-ID')}</div>
                            </div>
                            <div className="bg-emerald-50/80 dark:bg-emerald-950/30 p-1.5 rounded-none border border-emerald-200/70 dark:border-emerald-800/50">
                              <span className="text-[9.5px] text-emerald-600/80 dark:text-emerald-400/80 block">Laba Bersih Toko</span>
                              <div className="text-emerald-700 dark:text-emerald-300 font-black font-mono">+Rp {(c.total_profit || 0).toLocaleString('id-ID')}</div>
                              <div className="text-[9.5px] text-emerald-600/70 dark:text-emerald-400/70 font-normal">100% Hak Toko</div>
                            </div>
                            <div className="bg-blue-50/80 dark:bg-blue-950/30 p-1.5 rounded-none border border-blue-200/70 dark:border-blue-800/50">
                              <span className="text-[9.5px] text-blue-600/80 dark:text-blue-400/80 block">Ongkir Kurir</span>
                              <div className="text-blue-700 dark:text-blue-300 font-bold font-mono">Rp {c.total_delivery_fee.toLocaleString('id-ID')}</div>
                              <div className="text-[9.5px] text-blue-500/80 dark:text-blue-400/70 font-normal">Hak Antar Santri</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rekap Per Wali / Santri */}
                <div className="bg-white dark:bg-gray-900 rounded-none shadow-xs border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="p-2 sm:p-2.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">
                        Rekap Per Wali / Santri
                      </h3>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        Format ringkas: Total Belanja | Total Ongkir Kurir
                      </p>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-800">
                    {(!recapData?.user_recap || recapData.user_recap.length === 0) ? (
                      <div className="p-4 text-center text-gray-500 text-xs">Belum ada transaksi di periode ini.</div>
                    ) : (
                      recapData.user_recap.map(u => (
                        <div key={u.user_id} className="p-2 sm:p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                          <div>
                            <h4 className="font-bold text-gray-900 dark:text-white text-xs">{u.santri_name}</h4>
                            <p className="text-[10px] text-gray-500">Wali: {u.wali_name} {u.santri_room ? `• ${u.santri_room}` : ''}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap text-xs font-semibold">
                            <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-none text-gray-700 dark:text-gray-300 font-mono text-[11px] border border-gray-200 dark:border-gray-700">
                              Belanja: Rp {u.total_products.toLocaleString('id-ID')}
                            </span>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-none font-mono text-[11px] border border-blue-200 dark:border-blue-800">
                              Ongkir: Rp {u.total_delivery_fee.toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Rekap Per Produk */}
                <div className="bg-white dark:bg-gray-900 rounded-none shadow-xs border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="p-2 sm:p-2.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                    <h3 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">
                      Rekap Kuantitas & Laba Per Produk
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-800">
                    {(!recapData?.product_breakdown || recapData.product_breakdown.length === 0) ? (
                      <div className="p-4 text-center text-gray-500 text-xs">Belum ada produk terjual.</div>
                    ) : (
                      recapData.product_breakdown.map(p => (
                        <div key={p.product_id} className="p-2 sm:p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-gray-800 dark:text-gray-200">{p.name}</span>
                              {p.is_custom && (
                                <span className="text-[9.5px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1 py-0.2 rounded-none font-bold border border-purple-200 dark:border-purple-800">
                                  Titip Beli
                                </span>
                              )}
                              {p.canteen_name && (
                                <span className="text-[9.5px] text-gray-500 dark:text-gray-400 font-normal bg-gray-100 dark:bg-gray-800 px-1 py-0.2 rounded-none border border-gray-200 dark:border-gray-700">
                                  {p.canteen_name}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5 font-mono">
                              <span>HPJ: <strong className="text-gray-700 dark:text-gray-300">Rp {(p.hpj || 0).toLocaleString('id-ID')}</strong></span>
                              <span>•</span>
                              <span>HPP: <strong className="text-amber-700 dark:text-amber-400">Rp {(p.hpp || 1000).toLocaleString('id-ID')}</strong></span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded-none text-[11px] font-mono border border-green-200 dark:border-green-800">
                              {p.total_quantity}x terjual
                            </span>
                            <span className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded-none text-[11px] font-semibold font-mono border border-gray-200 dark:border-gray-700">
                              Rp {p.total_subtotal.toLocaleString('id-ID')}
                            </span>
                            <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 px-1.5 py-0.5 rounded-none text-[11px] font-bold font-mono">
                              +Rp {(p.total_profit || 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {isLoading && !ordersRes ? (
              <div className="bg-white dark:bg-gray-900 rounded-none border border-gray-200 dark:border-gray-800 text-center py-12 text-gray-500 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-green-600 mb-2"></div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Memuat daftar pesanan...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-none border border-gray-200 dark:border-gray-800 text-center py-8 text-gray-500 flex flex-col items-center">
                <ShoppingBag className="w-10 h-10 mb-2 opacity-20 text-green-600" />
                <p className="font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-300">Belum ada pesanan yang sesuai filter.</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Coba ganti filter tanggal, toko, status, atau kata kunci pencarian.</p>
              </div>
            ) : selectedStatusFilter === 'all' && !searchQuery.trim() ? (
              (() => {
                const activeOrders = orders.filter(o => o.status !== 'completed');
                const completedOrders = orders.filter(o => o.status === 'completed');
                
                return (
                  <div className="space-y-3">
                    {activeOrders.length === 0 && completedOrders.length > 0 && (
                      <div className="p-2 sm:p-2.5 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 rounded-none border border-green-200 dark:border-green-800/50 text-xs font-semibold text-center">
                        Semua pesanan aktif di periode ini telah selesai diproses! 🎉
                      </div>
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-2.5">
                      {groupOrders(activeOrders).map(group => 
                        group.isMultiStore ? renderBundledOrderCard(group) : renderOrderCard(group.orders[0])
                      )}
                    </div>
                    
                    {completedOrders.length > 0 && (
                      <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                        <div className="flex items-center justify-between mb-2 px-1">
                          <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                            Riwayat Selesai ({completedOrders.length})
                          </h2>
                          {completedOrders.length > visibleCompletedLimit && (
                            <span className="text-[10px] text-gray-400">
                              Menampilkan {Math.min(visibleCompletedLimit, completedOrders.length)} teratas
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-2.5">
                          {groupOrders(completedOrders.slice(0, visibleCompletedLimit)).map(group => 
                            group.isMultiStore ? renderBundledOrderCard(group) : renderOrderCard(group.orders[0])
                          )}
                        </div>
                        {completedOrders.length > visibleCompletedLimit && (
                          <div className="mt-2.5 flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setVisibleCompletedLimit(prev => prev + 50)}
                              className="px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-none text-xs font-bold hover:bg-gray-100 transition-colors cursor-pointer"
                            >
                              Tampilkan 50 Lagi ({completedOrders.length - visibleCompletedLimit} tersisa)
                            </button>
                            <button
                              type="button"
                              onClick={() => setVisibleCompletedLimit(completedOrders.length)}
                              className="px-3 py-1.5 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-800 rounded-none text-xs font-bold hover:bg-green-100 transition-colors cursor-pointer"
                            >
                              Tampilkan Semua ({completedOrders.length})
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-2.5">
                  {groupOrders(orders.slice(0, searchQuery.trim() ? orders.length : visibleCompletedLimit)).map(group => 
                    group.isMultiStore ? renderBundledOrderCard(group) : renderOrderCard(group.orders[0])
                  )}
                </div>
                {!searchQuery.trim() && orders.length > visibleCompletedLimit && (
                  <div className="mt-2.5 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setVisibleCompletedLimit(prev => prev + 50)}
                      className="px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-none text-xs font-bold hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      Tampilkan 50 Lagi ({orders.length - visibleCompletedLimit} tersisa)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibleCompletedLimit(orders.length)}
                      className="px-3 py-1.5 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-800 rounded-none text-xs font-bold hover:bg-green-100 transition-colors cursor-pointer"
                    >
                      Tampilkan Semua ({orders.length})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* COURIER SELECTION MODAL */}
      {showCourierModal && activeOrderForCourier && createPortal(
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-950 flex flex-col animate-in slide-in-from-bottom-full duration-300">
          <div className="bg-white dark:bg-gray-900 sticky top-0 z-20 shadow-sm px-4 py-3 flex items-center gap-3">
            <button 
              onClick={() => {
                setShowCourierModal(false);
                setActiveOrderForCourier(null);
              }} 
              className="p-2 -ml-2 text-gray-700 dark:text-gray-300"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Pilih Kurir</h1>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:px-8 max-w-3xl mx-auto w-full">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl mb-6 border border-blue-100 dark:border-blue-900">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Pilih kurir untuk mengantarkan pesanan <strong>#{activeOrderForCourier.id}</strong> atas nama <strong>{activeOrderForCourier.user?.name}</strong>.
              </p>
              <p className="text-sm font-semibold mt-2 flex items-center text-blue-900 dark:text-blue-200">
                <span className="mr-1">📍 Tujuan:</span> {activeOrderForCourier.delivery_location || 'Belum ada data alamat (Order Lama)'}
              </p>
            </div>

            <h2 className="font-bold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wider text-gray-500">Daftar Kurir Tersedia</h2>

            <div className="space-y-3">
              {/* OPSI KANTIN SENDIRI */}
              {(() => {
                const isSelfSelected = String(selectedCouriers[activeOrderForCourier.id]) === 'self';
                return (
                  <label 
                    className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelfSelected 
                      ? 'border-green-500 bg-green-50/50 dark:bg-green-950/30 dark:border-green-500 shadow-sm ring-1 ring-green-500' 
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="courier" 
                      value="self"
                      checked={isSelfSelected}
                      onChange={(e) => setSelectedCouriers({ ...selectedCouriers, [activeOrderForCourier.id]: e.target.value })}
                      className="w-5 h-5 text-green-600 border-gray-300 focus:ring-green-500"
                    />
                    <div className="ml-4 flex-1">
                      <span className="font-bold text-gray-900 dark:text-white text-base">Kantin Sendiri (Antar Sendiri)</span>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Store className="w-3 h-3"/> Diantarkan oleh pihak Kantin</p>
                    </div>
                  </label>
                );
              })()}

              {couriers.length === 0 ? (
                <p className="text-center text-gray-500 py-10">Belum ada kurir yang terdaftar.</p>
              ) : (
                couriers.map(c => {
                  const isSelected = String(selectedCouriers[activeOrderForCourier.id]) === String(c.id);
                  return (
                    <label 
                      key={c.id} 
                      className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected 
                        ? 'border-green-500 bg-green-50/50 dark:bg-green-950/30 dark:border-green-500 shadow-sm ring-1 ring-green-500' 
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="courier" 
                        value={c.id}
                        checked={isSelected}
                        onChange={(e) => setSelectedCouriers({ ...selectedCouriers, [activeOrderForCourier.id]: e.target.value })}
                        className="w-5 h-5 text-green-600 border-gray-300 focus:ring-green-500"
                      />
                      <div className="ml-4 flex-1">
                        <span className="font-bold text-gray-900 dark:text-white text-base">{c.name}</span>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Truck className="w-3 h-3"/> Kurir Aktif</p>
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleContact(c.phone, c.name);
                        }}
                        className="text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-300 p-2 rounded-full z-10 transition-colors"
                        title={`Tanya Kurir ${c.name}`}
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
                    </label>
                  );
                })
              )}
            </div>
          </div>
          
          <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] pb-safe">
            <div className="max-w-3xl mx-auto flex gap-3">
              <button 
                onClick={() => {
                  setShowCourierModal(false);
                  setActiveOrderForCourier(null);
                }}
                className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>
              <button 
                disabled={!selectedCouriers[activeOrderForCourier.id] || assignCourierMutation.isPending}
                onClick={() => assignCourierMutation.mutate({ id: activeOrderForCourier.id, courier_id: selectedCouriers[activeOrderForCourier.id], canteen_id: activeOrderForCourier.canteen_id })}
                className="flex-[2] py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                {assignCourierMutation.isPending ? 'Memproses...' : (
                  <>Konfirmasi <CheckCircle className="w-5 h-5"/></>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PROOF OF DELIVERY MODAL */}
      {showProofModal && activeOrderForProof && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/60 flex flex-col justify-end animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 w-full rounded-t-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-8 duration-300">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-900 z-10">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">Upload Bukti Pengiriman</h3>
                <p className="text-xs text-gray-500 mt-0.5">Order #{activeOrderForProof.id}</p>
              </div>
              <button onClick={() => {setShowProofModal(false); setProofFiles([]);}} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Silakan unggah foto/berkas bukti serah terima pesanan ke Santri untuk menyelesaikan pesanan ini {activeOrderForProof.courier?.name ? <span>(Kurir: <strong>{activeOrderForProof.courier.name}</strong>)</span> : <span>(Pengiriman oleh <strong>Kantin</strong>)</span>}.
              </p>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Foto Bukti Serah Terima <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] text-green-600 dark:text-green-400 font-medium">
                      Semua format foto & bebas ukuran
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*,.heic,.heif"
                    multiple
                    disabled={isCompressingProof}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files);
                      if (files.length > 0) {
                        setIsCompressingProof(true);
                        const toastId = toast.loading('Mengompresi foto bukti...');
                        try {
                          const compressed = await compressImageFiles(files);
                          setProofFiles(prev => [...prev, ...compressed]);
                          toast.success('Foto bukti dikompresi otomatis', { id: toastId });
                        } catch (err) {
                          setProofFiles(prev => [...prev, ...files]);
                          toast.dismiss(toastId);
                        } finally {
                          setIsCompressingProof(false);
                        }
                      }
                      e.target.value = '';
                    }}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-3 file:rounded-none file:border-0 file:text-xs file:font-bold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 dark:file:bg-green-900/30 dark:file:text-green-400 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-none p-1 disabled:opacity-60"
                  />
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5 flex items-center gap-1">
                    <span>✨ Otomatis dikompresi agar hemat ukuran & cepat terunggah.</span>
                  </p>
                </div>
                {proofFiles.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Berkas Dipilih ({proofFiles.length}):
                    </p>
                    <div className="grid grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                      {proofFiles.map((file, idx) => {
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
                              onClick={() => setProofFiles(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full shadow-md transition-transform active:scale-95 z-10"
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
                onClick={() => {setShowProofModal(false); setProofFiles([]);}}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold"
              >
                Batal
              </button>
              <button 
                disabled={proofFiles.length === 0 || completeOrderMutation.isPending}
                onClick={() => {
                  const formData = new FormData();
                  formData.append('_method', 'PUT');
                  proofFiles.forEach((file) => {
                    formData.append('proof_of_delivery[]', file);
                  });
                  completeOrderMutation.mutate({ id: activeOrderForProof.id, formData, canteen_id: activeOrderForProof.canteen_id });
                }}
                className="flex-[2] py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:bg-gray-400 flex items-center justify-center gap-2 shadow-sm"
              >
                {completeOrderMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent inline-block"></span>
                    <span>Memproses...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span>Selesaikan Pesanan</span>
                    <CheckCircle className="w-5 h-5" />
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* UPLOAD RECEIPT / BUKTI PESANAN MODAL */}
      {showReceiptModal && activeOrderForReceipt && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-none overflow-hidden flex flex-col max-h-[92vh] border border-gray-200 dark:border-gray-800 shadow-2xl my-auto">
            <div className="p-3 sm:p-3.5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-900 z-10">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">Upload Bukti Pesanan / Struk</h3>
                <p className="text-[10px] text-gray-500">Order #{activeOrderForReceipt.id}</p>
              </div>
              <button 
                onClick={() => {setShowReceiptModal(false); setReceiptFiles([]);}} 
                className="w-7 h-7 bg-gray-100 dark:bg-gray-800 rounded-none border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Unggah berkas/foto struk atau bukti pesanan siap diantar untuk pesanan #{activeOrderForReceipt.id}.
              </p>

              {activeOrderForReceipt.proof_of_purchase && activeOrderForReceipt.proof_of_purchase.length > 0 && receiptFiles.length === 0 && (
                <div className="bg-purple-50 dark:bg-purple-950/40 p-2.5 rounded-none border border-purple-200 dark:border-purple-900/50">
                  <p className="text-xs font-bold text-purple-800 dark:text-purple-300 mb-1.5">
                    Berkas Struk Terunggah Saat Ini ({Array.isArray(activeOrderForReceipt.proof_of_purchase) ? activeOrderForReceipt.proof_of_purchase.length : 1} Berkas):
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(Array.isArray(activeOrderForReceipt.proof_of_purchase) ? activeOrderForReceipt.proof_of_purchase : [activeOrderForReceipt.proof_of_purchase]).map((path, idx) => {
                      const fileType = getFileType(path);
                      const isImg = fileType === 'image';
                      return (
                        <div key={idx} className="aspect-square rounded-none overflow-hidden border border-purple-200 dark:border-purple-800 bg-black/10 flex items-center justify-center">
                          {isImg ? (
                            <img src={getStorageUrl(path)} alt={`Current ${idx + 1}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center justify-center p-1 text-center text-purple-600 dark:text-purple-300">
                              <FileText className="w-5 h-5" />
                              <span className="text-[8px] font-mono mt-0.5 uppercase truncate max-w-full px-1">{fileType}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1.5 italic">
                    *Memilih berkas baru di bawah akan ditambahkan ke daftar bukti pesanan.
                  </p>
                </div>
              )}
              
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                      Foto Struk / Bukti Pesanan <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                      Bebas format & auto kompres
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*,.heic,.heif"
                    multiple
                    disabled={isCompressingReceipt}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files);
                      if (files.length > 0) {
                        setIsCompressingReceipt(true);
                        const toastId = toast.loading('Mengompresi foto struk...');
                        try {
                          const compressed = await compressImageFiles(files);
                          setReceiptFiles(prev => [...prev, ...compressed]);
                          toast.success('Foto struk dikompresi otomatis', { id: toastId });
                        } catch (err) {
                          setReceiptFiles(prev => [...prev, ...files]);
                          toast.dismiss(toastId);
                        } finally {
                          setIsCompressingReceipt(false);
                        }
                      }
                      e.target.value = '';
                    }}
                    className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-none file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 dark:file:bg-purple-900/30 dark:file:text-purple-400 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-none p-1 disabled:opacity-60 cursor-pointer"
                  />
                </div>

                {receiptFiles.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      Berkas Dipilih ({receiptFiles.length}):
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {receiptFiles.map((file, idx) => {
                        const isImg = isImageFile(file);
                        const isPdf = isPdfFile(file);
                        const isHeif = isHeifFile(file);

                        return (
                          <div key={idx} className="relative rounded-none overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-1.5 flex flex-col justify-between group">
                            {isImg ? (
                              <div className="aspect-video w-full rounded-none overflow-hidden bg-black/5 mb-1">
                                <img src={URL.createObjectURL(file)} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="aspect-video w-full rounded-none bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 flex flex-col items-center justify-center text-purple-600 dark:text-purple-400 mb-1">
                                <FileText className="w-5 h-5" />
                                <span className="text-[9px] font-mono font-bold mt-0.5 uppercase">
                                  {isPdf ? 'PDF' : isHeif ? 'HEIF' : file.name.split('.').pop() || 'FILE'}
                                </span>
                              </div>
                            )}

                            <div className="pr-5">
                              <p className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 truncate" title={file.name}>
                                {file.name}
                              </p>
                              <p className="text-[9px] text-gray-400 flex items-center gap-1 font-mono">
                                <span>{formatFileSize(file.size)}</span>
                                {file.originalSize && file.originalSize > file.size && (
                                  <span className="text-purple-600 dark:text-purple-400 font-bold">
                                    (Hemat {Math.round((1 - file.size / file.originalSize) * 100)}%)
                                  </span>
                                )}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => setReceiptFiles(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white p-0.5 rounded-none shadow-xs cursor-pointer"
                              title="Hapus berkas ini"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex gap-2 sticky bottom-0 bg-white dark:bg-gray-900">
              <button 
                onClick={() => {setShowReceiptModal(false); setReceiptFiles([]);}}
                className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-none border border-gray-200 dark:border-gray-700 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button 
                disabled={receiptFiles.length === 0 || uploadReceiptMutation.isPending}
                onClick={() => {
                  const formData = new FormData();
                  receiptFiles.forEach((file) => {
                    formData.append('proof_of_purchase[]', file);
                  });
                  uploadReceiptMutation.mutate({ id: activeOrderForReceipt.id, formData, canteen_id: activeOrderForReceipt.canteen_id });
                }}
                className="flex-[2] py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-none font-bold text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                {uploadReceiptMutation.isPending ? (
                  <span className="flex items-center gap-1.5">
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent inline-block"></span>
                    <span>Memproses...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Unggah Bukti</span>
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MANUAL ORDER MODAL */}
      {showManualModal && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl my-auto border border-gray-200 dark:border-gray-800">
            <div className="flex justify-between items-center p-3 sm:p-3.5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Buat Pesanan Manual</h3>
              <button 
                onClick={() => setShowManualModal(false)} 
                className="w-7 h-7 bg-gray-100 dark:bg-gray-800 rounded-none border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 sm:p-4 space-y-2.5 max-h-[75vh] overflow-y-auto">
              <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-none border border-green-200 dark:border-green-900/50">
                <p className="text-[11px] text-green-800 dark:text-green-300">
                  Buatkan tagihan/pesanan tambahan atas nama Santri. Pesanan ini akan langsung muncul di HP Santri untuk dibayar.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-0.5">Pilih Santri <span className="text-red-500">*</span></label>
                <select
                  value={manualUserId}
                  onChange={e => setManualUserId(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-none text-xs dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 focus:outline-hidden"
                >
                  <option value="">-- Pilih Santri --</option>
                  {santriList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.santri_name || s.name} ({s.santri_room || 'Asrama?'} - {s.santri_class || ''}/{s.santri_level || ''})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-0.5">Catatan Pesanan / Barang <span className="text-red-500">*</span></label>
                <textarea
                  rows={2}
                  value={manualNotes}
                  onChange={e => setManualNotes(e.target.value)}
                  placeholder="Contoh: Pembelian Obat Maag + Biaya Pengantaran..."
                  className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-none text-xs dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-0.5">Harga Produk / Barang Asli (Rp) <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={manualPrice}
                  onChange={e => setManualPrice(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Contoh: 12000"
                  className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-none text-xs dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 focus:outline-hidden font-mono"
                />
              </div>

              {/* DYNAMIC FEE CALCULATION PREVIEW */}
              {(() => {
                const prodPrice = parseFloat(manualPrice || 0);
                const delFee = 2000;
                const admFee = 1000;
                const grandTotal = prodPrice > 0 ? (prodPrice + delFee + admFee) : 0;

                return (
                  <div className="bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-none border border-gray-200 dark:border-gray-700 space-y-1 text-xs text-gray-600 dark:text-gray-400 font-mono">
                    <div className="flex justify-between">
                      <span className="font-sans text-[11px]">Harga Produk / Barang:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">Rp {formatRupiah(prodPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans text-[11px]">Ongkos Kirim (Otomatis):</span>
                      <span className="font-semibold text-gray-900 dark:text-white">+ Rp {formatRupiah(delFee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans text-[11px]">Biaya Admin (Otomatis):</span>
                      <span className="font-semibold text-gray-900 dark:text-white">+ Rp {formatRupiah(admFee)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700 text-xs font-bold text-green-700 dark:text-green-400">
                      <span className="font-sans">Total Tagihan Santri:</span>
                      <span>Rp {formatRupiah(grandTotal)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
              <button 
                onClick={() => setShowManualModal(false)}
                className="flex-1 py-1.5 rounded-none font-bold text-xs text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button 
                disabled={!manualUserId || !manualNotes.trim() || !manualPrice || createManualOrderMutation.isPending}
                onClick={() => {
                  createManualOrderMutation.mutate({
                    user_id: manualUserId,
                    custom_notes: manualNotes,
                    total_price: manualPrice,
                  });
                }}
                className="flex-[2] py-1.5 rounded-none font-bold text-xs text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors flex justify-center items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {createManualOrderMutation.isPending ? 'Membuat...' : 'Buat Pesanan'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CONFIRMATION ALERT MODAL WHEN PROCEEDING UNPAID ORDER */}
      {unpaidProceedOrder && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-none w-full max-w-md overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800 p-3.5 sm:p-4 space-y-3 animate-in zoom-in-95 duration-200 my-auto text-left">
            {/* Header Icon & Title */}
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-none bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-300 dark:border-amber-800">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                  Konfirmasi Lanjutkan Pesanan
                </h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Pembayaran pesanan ini belum lunas
                </p>
              </div>
              <button 
                onClick={() => setUnpaidProceedOrder(null)}
                className="w-7 h-7 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-none border border-gray-200 dark:border-gray-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Order Info Card */}
            <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 rounded-none p-2.5 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-600 dark:text-gray-400 text-[11px]">Order ID:</span>
                <span className="font-bold text-gray-900 dark:text-white text-[11px]">
                  {unpaidProceedOrder._groupOrders?.length > 1
                    ? `#${unpaidProceedOrder._groupOrders.map(o => o.id).join(', #')} (${unpaidProceedOrder._groupOrders.length} Toko)`
                    : `#${unpaidProceedOrder.id}`}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-600 dark:text-gray-400 text-[11px]">Nama Pemesan:</span>
                <span className="font-semibold text-gray-900 dark:text-white text-[11px]">
                  {unpaidProceedOrder.user?.name || 'Santri'}
                  {unpaidProceedOrder.user?.santri_name ? ` (${unpaidProceedOrder.user.santri_name})` : ''}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-600 dark:text-gray-400 text-[11px]">Status Pembayaran:</span>
                <span className={`px-1.5 py-0.5 rounded-none font-bold text-[10px] ${
                  unpaidProceedOrder.payment_status === 'waiting_confirmation'
                    ? 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200 border border-amber-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border border-red-300'
                }`}>
                  {unpaidProceedOrder.payment_status === 'waiting_confirmation'
                    ? '⏳ Menunggu Validasi'
                    : '⚠️ Belum Bayar'}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-amber-200/60 dark:border-amber-900/50 text-xs font-bold text-gray-900 dark:text-white font-mono">
                <span className="font-sans">Total Tagihan:</span>
                <span className="text-green-600 dark:text-green-400">
                  Rp {formatRupiah(unpaidProceedOrder._groupGrandTotal || unpaidProceedOrder.total_price)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
              Pesanan ini belum dikonfirmasi lunas oleh toko. Apakah Anda yakin ingin tetap melanjutkan pesanan ini ke tahap proses?
            </p>

            {/* Action Buttons */}
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                disabled={batchUpdateStatusMutation.isPending || updateStatusMutation.isPending || updatePaymentMutation.isPending}
                onClick={async () => {
                  const ord = unpaidProceedOrder;
                  setUnpaidProceedOrder(null);
                  const targetOrders = ord._groupOrders || [ord];
                  const pendingOrders = targetOrders.filter(o => o.status === 'pending');
                  try {
                    await updatePaymentMutation.mutateAsync({ id: ord.id, status: 'paid', canteen_id: ord.canteen_id });
                    if (pendingOrders.length > 1) {
                      batchUpdateStatusMutation.mutate({
                        order_ids: pendingOrders.map(o => o.id),
                        status: 'processing',
                        canteen_id: selectedCanteenFilter !== 'all' ? selectedCanteenFilter : undefined
                      });
                    } else if (pendingOrders.length === 1) {
                      updateStatusMutation.mutate({ id: pendingOrders[0].id, status: 'processing', canteen_id: pendingOrders[0].canteen_id });
                    }
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="w-full py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white rounded-none text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Tandai Lunas & Lanjutkan
              </button>

              <button
                type="button"
                disabled={batchUpdateStatusMutation.isPending || updateStatusMutation.isPending || updatePaymentMutation.isPending}
                onClick={() => {
                  const ord = unpaidProceedOrder;
                  setUnpaidProceedOrder(null);
                  const targetOrders = ord._groupOrders || [ord];
                  const pendingOrders = targetOrders.filter(o => o.status === 'pending');
                  if (pendingOrders.length > 1) {
                    batchUpdateStatusMutation.mutate({
                      order_ids: pendingOrders.map(o => o.id),
                      status: 'processing',
                      canteen_id: selectedCanteenFilter !== 'all' ? selectedCanteenFilter : undefined
                    });
                  } else if (pendingOrders.length === 1) {
                    updateStatusMutation.mutate({ id: pendingOrders[0].id, status: 'processing', canteen_id: pendingOrders[0].canteen_id });
                  }
                }}
                className="w-full py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-none text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                Tetap Lanjutkan (Belum Lunas)
              </button>

              <button
                type="button"
                onClick={() => setUnpaidProceedOrder(null)}
                className="w-full py-1.5 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-none border border-gray-200 dark:border-gray-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL JADWALKAN PESANAN KANTIN (BESOK / TANGGAL LAIN) */}
      {scheduleOrderModal && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none max-w-md w-full p-3.5 sm:p-4 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-3 animate-in zoom-in-95 duration-150 my-auto">
            <div className="w-9 h-9 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-none flex items-center justify-center mx-auto border border-amber-300 dark:border-amber-800">
              <Calendar className="w-4 h-4" />
            </div>

            <div className="text-center space-y-0.5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {scheduleOrderModal.title}
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                {scheduleOrderModal.order.user?.santri_name || scheduleOrderModal.order.user?.name}
                {scheduleOrderModal.order.canteen?.name ? ` • ${scheduleOrderModal.order.canteen.name}` : ''}
              </p>
            </div>

            {/* Info Tanggal Pesanan Saat Ini */}
            <div className="bg-gray-50 dark:bg-gray-800/80 p-2 rounded-none border border-gray-200 dark:border-gray-700/60 flex items-center justify-between text-xs">
              <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Tanggal Saat Ini:</span>
              <span className="font-bold text-gray-800 dark:text-gray-200 font-mono text-[11px]">
                {scheduleOrderModal.order.created_at ? new Date(scheduleOrderModal.order.created_at).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
              </span>
            </div>

            {/* Pilihan Target Tanggal */}
            <div className="space-y-1.5 text-left">
              <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block">
                Pilih Jadwal Pesanan Dilanjutkan:
              </label>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setScheduleDateMode('tomorrow')}
                  className={`py-2 px-2 text-xs font-bold border rounded-none transition-colors flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    scheduleDateMode === 'tomorrow'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                  }`}
                >
                  <span className="text-[11px]">☀️ Besok</span>
                  <span className="text-[9.5px] font-normal opacity-90">
                    {(() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                    })()}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setScheduleDateMode('today')}
                  className={`py-2 px-2 text-xs font-bold border rounded-none transition-colors flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    scheduleDateMode === 'today'
                      ? 'bg-green-600 text-white border-green-600 shadow-xs'
                      : 'bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300 border-green-200 dark:border-green-800 hover:bg-green-100'
                  }`}
                >
                  <span className="text-[11px]">⚡ Hari Ini</span>
                  <span className="text-[9.5px] font-normal opacity-90">
                    {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setScheduleDateMode('custom')}
                  className={`py-2 px-2 text-xs font-bold border rounded-none transition-colors flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    scheduleDateMode === 'custom'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100'
                  }`}
                >
                  <span className="text-[11px]">📅 Tanggal Lain</span>
                  <span className="text-[9.5px] font-normal opacity-90">Pilih kalender</span>
                </button>
              </div>

              {scheduleDateMode === 'custom' && (
                <div className="pt-1">
                  <input
                    type="date"
                    value={scheduleCustomDate}
                    onChange={(e) => setScheduleCustomDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-none border border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/30 text-gray-900 dark:text-white text-xs font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <p className="text-[9.5px] text-blue-600 dark:text-blue-400 mt-0.5">
                    Pilih tanggal target pesanan ini dimasukkan dan direkap.
                  </p>
                </div>
              )}

              {scheduleDateMode === 'tomorrow' && (
                <p className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-1.5 border border-amber-200 dark:border-amber-800">
                  Pesanan akan otomatis masuk ke daftar pesanan dan rekap toko pada <strong>Besok Pagi</strong>.
                </p>
              )}

              {scheduleDateMode === 'today' && (
                <p className="text-[10px] text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 p-1.5 border border-green-200 dark:border-green-800">
                  Pesanan akan diproses untuk antrean <strong>Hari Ini</strong>.
                </p>
              )}
            </div>

            {/* Pilihan Tindakan Status */}
            <div className="space-y-1 text-left">
              <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block">
                Status Pesanan:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setScheduleActionStatus('processing')}
                  className={`py-1.5 px-2 text-xs font-bold border rounded-none transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                    scheduleActionStatus === 'processing'
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Langsung Proses</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleActionStatus('pending')}
                  className={`py-1.5 px-2 text-xs font-bold border rounded-none transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                    scheduleActionStatus === 'pending'
                      ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900 border-gray-800 dark:border-gray-200'
                      : 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Tetap Pending</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setScheduleOrderModal(null)}
                disabled={updateStatusMutation.isPending || batchUpdateStatusMutation.isPending}
                className="flex-1 py-1.5 rounded-none font-bold text-xs text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={updateStatusMutation.isPending || batchUpdateStatusMutation.isPending}
                onClick={() => {
                  let targetDateVal = undefined;
                  if (scheduleDateMode === 'today') {
                    const d = new Date();
                    targetDateVal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  } else if (scheduleDateMode === 'tomorrow') {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    targetDateVal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  } else if (scheduleDateMode === 'custom' && scheduleCustomDate) {
                    targetDateVal = scheduleCustomDate;
                  }

                  const targetOrders = scheduleOrderModal.orders;
                  if (targetOrders.length === 1) {
                    updateStatusMutation.mutate({
                      id: targetOrders[0].id,
                      status: scheduleActionStatus,
                      canteen_id: targetOrders[0].canteen_id,
                      target_date: targetDateVal
                    });
                  } else if (targetOrders.length > 1) {
                    batchUpdateStatusMutation.mutate({
                      order_ids: targetOrders.map(o => o.id),
                      status: scheduleActionStatus,
                      canteen_id: selectedCanteenFilter !== 'all' ? selectedCanteenFilter : undefined,
                      target_date: targetDateVal
                    });
                  }
                  setScheduleOrderModal(null);
                }}
                className="flex-1 py-1.5 rounded-none font-bold text-xs text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              >
                {updateStatusMutation.isPending || batchUpdateStatusMutation.isPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Simpan & Jadwalkan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* SET CUSTOM ORDER PRICE MODAL */}
      {showSetPriceModal && activeOrderForSetPrice && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150 shadow-2xl my-auto border border-gray-200 dark:border-gray-800">
            <div className="flex justify-between items-center p-3 sm:p-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Tentukan Harga Pesanan</h3>
              <button onClick={() => setShowSetPriceModal(false)} className="w-7 h-7 rounded-none bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 flex items-center justify-center transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3 sm:p-4 space-y-3">
              <div className="bg-purple-50 dark:bg-purple-900/20 p-2.5 rounded-none border border-purple-200 dark:border-purple-800">
                <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase block mb-1">Catatan dari Santri ({activeOrderForSetPrice.user?.name}):</span>
                <p className="text-xs font-medium text-purple-900 dark:text-purple-200 whitespace-pre-wrap">
                  {activeOrderForSetPrice.custom_notes || 'Tidak ada catatan.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Harga Produk / Barang Asli (Rp) <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newPriceInput}
                  onChange={e => setNewPriceInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Contoh: 12300"
                  className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-none text-xs dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 focus:outline-none"
                />
              </div>

              {/* DYNAMIC FEE CALCULATION PREVIEW */}
              {(() => {
                const prodPrice = parseFloat(newPriceInput || 0);
                const canteenCat = activeOrderForSetPrice.canteen?.category || 'kauman';
                const delFee = parseFloat(activeOrderForSetPrice.delivery_fee) > 0 
                  ? parseFloat(activeOrderForSetPrice.delivery_fee) 
                  : PRICING_CONFIG.BASE_DELIVERY_FEE;
                const admFee = parseFloat(activeOrderForSetPrice.admin_fee) > 0 
                  ? parseFloat(activeOrderForSetPrice.admin_fee) 
                  : PRICING_CONFIG.BASE_ADMIN_FEE;
                const grandTotal = prodPrice > 0 ? (prodPrice + delFee + admFee) : 0;

                return (
                  <div className="bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-none border border-gray-200 dark:border-gray-700 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>Harga Produk / Barang:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">Rp {formatRupiah(prodPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ongkos Kirim (Otomatis):</span>
                      <span className="font-semibold text-gray-900 dark:text-white">+ Rp {formatRupiah(delFee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Biaya Admin (Otomatis):</span>
                      <span className="font-semibold text-gray-900 dark:text-white">+ Rp {formatRupiah(admFee)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700 text-xs font-bold text-green-700 dark:text-green-400">
                      <span>Total Tagihan Santri:</span>
                      <span className="font-mono">Rp {formatRupiah(grandTotal)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-3 sm:p-4 pt-0 flex gap-2">
              <button 
                onClick={() => setShowSetPriceModal(false)}
                className="flex-1 py-1.5 rounded-none font-bold text-xs text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 transition-colors border border-gray-200 dark:border-gray-700"
              >
                Batal
              </button>
              <button 
                disabled={!newPriceInput || setCustomPriceMutation.isPending || activeOrderForSetPrice.payment_status === 'paid'}
                onClick={() => {
                  setCustomPriceMutation.mutate({
                    id: activeOrderForSetPrice.id,
                    price: newPriceInput,
                    canteen_id: activeOrderForSetPrice.canteen_id
                  });
                }}
                className="flex-[2] py-1.5 rounded-none font-bold text-xs text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors flex justify-center items-center gap-1.5 shadow-xs"
              >
                {setCustomPriceMutation.isPending ? 'Simpan...' : 'Set & Setujui Harga'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PROOF OF DELIVERY / PAYMENT FULL-SCREEN MODAL */}
      {selectedProofs.length > 0 && createPortal(
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-xs flex flex-col animate-in fade-in duration-150">
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-2.5 bg-black/80 border-b border-white/10 shrink-0">
            <span className="text-white font-bold text-xs flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-green-400" />
              {selectedProofs.length} Berkas Bukti
            </span>
            <button 
              onClick={() => setSelectedProofs([])}
              className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded-none flex items-center justify-center text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {/* Images & Documents */}
          <div className="flex-1 overflow-y-auto flex flex-col items-center gap-3 p-3 pb-8">
            {selectedProofs.map((proof, idx) => {
              const fileType = getFileType(proof);
              const fileName = getFileNameFromPath(proof);

              if (fileType === 'pdf') {
                return (
                  <div key={idx} className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-none p-3 flex flex-col items-center gap-2 shadow-xl">
                    <div className="w-full flex items-center justify-between text-xs text-gray-400 border-b border-gray-800 pb-2">
                      <span className="font-semibold text-white flex items-center gap-1.5 text-xs truncate">
                        <FileText className="w-3.5 h-3.5 text-red-400 shrink-0" /> Bukti {idx + 1}: {fileName}
                      </span>
                      <span className="px-1.5 py-0.5 bg-red-900/40 text-red-300 rounded-none font-mono text-[9px]">PDF</span>
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
                      className="w-full py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white rounded-none text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Buka / Unduh Dokumen PDF
                    </a>
                  </div>
                );
              }

              if (fileType === 'image') {
                return (
                  <div key={idx} className="w-full max-w-xl bg-gray-900/60 border border-white/10 rounded-none p-2 flex flex-col items-center gap-1.5">
                    <div className="w-full flex items-center justify-between px-1 text-xs text-gray-400">
                      <span className="font-semibold text-white/90 text-xs">Bukti {idx + 1}</span>
                      <div className="flex items-center gap-1.5">
                        <button 
                          type="button"
                          onClick={() => setFullscreenImage(proof)}
                          className="px-2 py-0.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 hover:text-green-300 rounded-none text-[10px] font-bold flex items-center gap-1 transition-all border border-green-500/30 cursor-pointer"
                          title="Buka Pratinjau Layar Penuh"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Layar Penuh</span>
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
                      className="w-full rounded-none shadow-xl object-contain bg-black/40 cursor-zoom-in hover:brightness-105 transition-all"
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
                      className="w-full h-40 rounded-none bg-gray-800 flex flex-col items-center justify-center text-gray-400 text-xs gap-1.5"
                    >
                      <ImageIcon className="w-8 h-8 opacity-40" />
                      <span>Gambar tidak dapat dimuat langsung</span>
                      <a href={proof} target="_blank" rel="noreferrer" className="text-green-400 text-[11px] underline break-all px-3 text-center">Buka Berkas ({fileName})</a>
                    </div>
                  </div>
                );
              }

              // HEIF / Document / Other
              return (
                <div key={idx} className="w-full max-w-xl bg-gray-900 border border-gray-800 rounded-none p-4 flex flex-col items-center gap-3 text-center shadow-xl">
                  <div className="w-12 h-12 rounded-none bg-green-950/60 border border-green-800/50 flex items-center justify-center text-green-400">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-xs break-all">{fileName}</p>
                    <p className="text-gray-400 text-[10px] mt-0.5">Berkas Bukti #{idx + 1}</p>
                  </div>
                  <a
                    href={proof}
                    target="_blank"
                    download
                    rel="noopener noreferrer"
                    className="w-full py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white rounded-none text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Unduh / Buka Berkas
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
          className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-md flex flex-col animate-in fade-in duration-150"
          onClick={() => setFullscreenImage(null)}
        >
          {/* Top Bar */}
          <div 
            className="flex items-center justify-between px-3 py-2 bg-black/80 border-b border-white/10 shrink-0 z-10"
            onClick={e => e.stopPropagation()}
          >
            <span className="text-white text-xs font-semibold flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-green-400" />
              Pratinjau Layar Penuh
            </span>
            <div className="flex items-center gap-1.5">
              <a 
                href={fullscreenImage} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="px-2.5 py-1 rounded-none bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1 transition-all"
                title="Buka di Tab Baru"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Tab Baru</span>
              </a>
              <a 
                href={fullscreenImage} 
                download
                className="px-2.5 py-1 rounded-none bg-green-600 hover:bg-green-700 text-white text-xs font-bold flex items-center gap-1 transition-all shadow-xs"
                title="Unduh Gambar"
              >
                <Download className="w-3 h-3" />
                <span>Unduh</span>
              </a>
              <button 
                onClick={() => setFullscreenImage(null)}
                className="w-7 h-7 rounded-none bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all ml-1 cursor-pointer"
                title="Tutup (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Centered Large Image */}
          <div className="flex-1 flex items-center justify-center p-2 overflow-auto">
            <img 
              src={fullscreenImage} 
              alt="Bukti Layar Penuh" 
              className="max-w-full max-h-[85vh] sm:max-h-[90vh] object-contain rounded-none shadow-2xl select-none"
              onClick={e => e.stopPropagation()}
            />
          </div>
          
          <div className="py-2 text-center text-gray-400 text-[11px] shrink-0 bg-black/50 border-t border-white/5">
            Ketuk tombol ✕ atau area luar untuk menutup layar penuh
          </div>
        </div>,
        document.body
      )}

      {/* Recap Modal */}
      {showRecapModal && createPortal(
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none w-full max-w-md overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[85vh] my-auto">
            <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-green-600" />
                Rekap per Produk
              </h3>
              <button onClick={() => setShowRecapModal(false)} className="w-7 h-7 rounded-none bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 flex items-center justify-center transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-3 sm:p-4 overflow-y-auto">
              {productRecap.items.length === 0 && productRecap.customCount === 0 ? (
                <div className="text-center text-gray-500 py-8 text-xs">
                  Belum ada data penjualan.
                </div>
              ) : (
                <div className="space-y-3">
                  {productRecap.items.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Produk Reguler</h4>
                      <div className="border border-gray-200 dark:border-gray-800 overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800/80 text-[10px] uppercase font-bold text-gray-500 border-b border-gray-200 dark:border-gray-700">
                              <th className="p-2">Produk</th>
                              <th className="p-2 text-center">Terjual</th>
                              <th className="p-2 text-right">Total</th>
                              <th className="p-2 text-right">Laba</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {productRecap.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                                <td className="p-2">
                                  <div className="font-semibold text-gray-800 dark:text-gray-200 text-xs">
                                    {item.name}
                                  </div>
                                  <div className="text-[10px] text-gray-400">
                                    HPP: Rp {formatRupiah(item.hpp)}
                                  </div>
                                </td>
                                <td className="p-2 text-center font-bold text-green-600 dark:text-green-400">
                                  {item.quantity}x
                                </td>
                                <td className="p-2 text-right font-mono font-semibold text-gray-800 dark:text-gray-200">
                                  Rp {formatRupiah(item.total)}
                                </td>
                                <td className="p-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  +Rp {formatRupiah(item.profit)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {productRecap.customCount > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1.5">Pesanan Titipan (Khusus)</h4>
                      <div className="border border-purple-200 dark:border-purple-800/60 overflow-hidden mb-2">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-purple-50 dark:bg-purple-950/40 text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300 border-b border-purple-200 dark:border-purple-800">
                              <th className="p-2">Pesanan</th>
                              <th className="p-2 text-center">Jml</th>
                              <th className="p-2 text-right">Total</th>
                              <th className="p-2 text-right">Laba</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-purple-100 dark:divide-purple-900/30">
                            {productRecap.customItems?.map((item, idx) => (
                              <tr key={idx} className="hover:bg-purple-50/40 dark:hover:bg-purple-950/20">
                                <td className="p-2">
                                  <div className="font-semibold text-purple-900 dark:text-purple-200 text-xs">
                                    {item.name}
                                  </div>
                                  <div className="text-[10px] text-purple-600 dark:text-purple-400">
                                    HPP: Rp {formatRupiah(item.hpp)}
                                  </div>
                                </td>
                                <td className="p-2 text-center font-bold text-purple-600 dark:text-purple-400">
                                  {item.quantity}x
                                </td>
                                <td className="p-2 text-right font-mono font-semibold text-gray-800 dark:text-white">
                                  Rp {formatRupiah(item.total)}
                                </td>
                                <td className="p-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  +Rp {formatRupiah(item.profit)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex justify-between items-center bg-purple-50 dark:bg-purple-950/40 p-2 rounded-none border border-purple-200 dark:border-purple-800 text-xs">
                        <div>
                          <span className="font-bold text-purple-900 dark:text-purple-300 block">Subtotal Titipan ({productRecap.customCount}x)</span>
                          <span className="text-[10px] text-purple-700 dark:text-purple-400">Modal: Rp {formatRupiah(productRecap.customHpp)}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-purple-700 dark:text-purple-300 block font-mono">Rp {formatRupiah(productRecap.customTotal)}</span>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">Laba: +Rp {formatRupiah(productRecap.customProfit)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* FOOTER TOTAL */}
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-800 space-y-1">
                    <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
                      <span>Total Belanja Produk (HPJ)</span>
                      <span className="font-bold text-gray-900 dark:text-white font-mono">Rp {formatRupiah(productRecap.totalProducts)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
                      <span>Total Modal Pokok (HPP)</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">Rp {formatRupiah(productRecap.totalHpp)}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-950/40 rounded-none border border-green-200 dark:border-green-800">
                      <span className="font-bold text-green-900 dark:text-green-200 text-xs">Estimasi Laba Bersih Toko</span>
                      <span className="font-black text-green-700 dark:text-green-300 text-sm font-mono">
                        Rp {formatRupiah(productRecap.totalProfit)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-2.5 sm:p-3 border-t border-gray-100 dark:border-gray-800">
              <button 
                onClick={() => setShowRecapModal(false)}
                className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 rounded-none font-bold text-xs transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL UNGGAH BUKTI PEMBAYARAN OLEH KANTIN */}
      {orderToUploadPaymentProof && createPortal(
        <div className="fixed inset-0 z-[105] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none max-w-md w-full p-3.5 sm:p-4 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-2.5 animate-in zoom-in-95 duration-150 my-auto">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-none bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 flex items-center justify-center border border-green-300 dark:border-green-800">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                    Unggah Bukti Bayar Santri
                  </h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    {orderToUploadPaymentProof._groupOrders?.length > 1
                      ? `Paket Checkout (${orderToUploadPaymentProof._groupOrders.length} Toko) • #${orderToUploadPaymentProof._groupOrders.map(o => o.id).join(', #')}`
                      : `Pesanan #${orderToUploadPaymentProof.id} • ${orderToUploadPaymentProof.canteen?.name || 'Toko'}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOrderToUploadPaymentProof(null);
                  setCanteenPaymentProofFiles([]);
                }}
                className="w-7 h-7 rounded-none bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 flex items-center justify-center transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Info Santri & Tagihan */}
            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-none p-2.5 border border-gray-200 dark:border-gray-700/60 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400 text-[11px]">Santri / Pemesan:</span>
                <span className="font-bold text-gray-900 dark:text-white truncate max-w-[200px] text-right text-[11px]">
                  {orderToUploadPaymentProof.user?.santri_name || orderToUploadPaymentProof.user?.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400 text-[11px]">Kamar / Lokasi:</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300 text-[11px]">
                  {orderToUploadPaymentProof.user?.santri_room || orderToUploadPaymentProof.delivery_location || '-'}
                </span>
              </div>
              <div className="pt-1.5 border-t border-gray-200 dark:border-gray-700/60 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Total Tagihan:</span>
                <span className="text-sm font-black text-green-600 dark:text-green-400 font-mono">
                  Rp {formatRupiah(orderToUploadPaymentProof._groupGrandTotal || orderToUploadPaymentProof.total_price)}
                </span>
              </div>
            </div>

            {/* Bukti Yang Sudah Ada (Jika Ada) */}
            {orderToUploadPaymentProof.proof_of_payment && orderToUploadPaymentProof.proof_of_payment.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-gray-700 dark:text-gray-300">
                  <span>Bukti Tersimpan ({orderToUploadPaymentProof.proof_of_payment.length}):</span>
                  <span className="text-[9px] text-gray-400 font-normal">Klik tombol hapus untuk membatalkan</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {(Array.isArray(orderToUploadPaymentProof.proof_of_payment) 
                    ? orderToUploadPaymentProof.proof_of_payment 
                    : [orderToUploadPaymentProof.proof_of_payment]
                  ).map((p, pIdx) => (
                    <div key={pIdx} className="relative group shrink-0 w-14 h-14 rounded-none overflow-hidden border border-gray-200 dark:border-gray-700 bg-black/10">
                      <img src={getStorageUrl(p)} alt="Bukti" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Hapus berkas bukti ini?')) {
                            deleteCanteenProofMutation.mutate({
                              id: orderToUploadPaymentProof.id,
                              type: 'proof_of_payment',
                              path: p
                            });
                          }
                        }}
                        disabled={deleteCanteenProofMutation.isPending}
                        className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Hapus berkas ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tombol Pilih File & Kamera */}
            <div className="space-y-1.5">
              <input
                type="file"
                ref={canteenPaymentFileInputRef}
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => handleCanteenProofFilesSelected(e.target.files)}
              />
              <input
                type="file"
                ref={canteenPaymentCameraInputRef}
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleCanteenProofFilesSelected(e.target.files)}
              />

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={isCompressingPaymentProof || uploadCanteenPaymentProofMutation.isPending}
                  onClick={() => canteenPaymentCameraInputRef.current?.click()}
                  className="py-2 px-2 bg-gray-50 hover:bg-green-50/80 dark:bg-gray-800/80 dark:hover:bg-green-950/40 border border-gray-200 dark:border-gray-700 hover:border-green-400 rounded-none text-gray-700 dark:text-gray-200 flex flex-col items-center justify-center gap-1 transition-all text-xs font-bold cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span>Ambil Foto</span>
                </button>

                <button
                  type="button"
                  disabled={isCompressingPaymentProof || uploadCanteenPaymentProofMutation.isPending}
                  onClick={() => canteenPaymentFileInputRef.current?.click()}
                  className="py-2 px-2 bg-gray-50 hover:bg-green-50/80 dark:bg-gray-800/80 dark:hover:bg-green-950/40 border border-gray-200 dark:border-gray-700 hover:border-green-400 rounded-none text-gray-700 dark:text-gray-200 flex flex-col items-center justify-center gap-1 transition-all text-xs font-bold cursor-pointer"
                >
                  <FileUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span>Pilih dari Galeri</span>
                </button>
              </div>

              <p className="text-[9px] text-gray-400 text-center">
                Mendukung JPG, PNG, WEBP, PDF (Maks 15MB/berkas, auto kompresi cerdas)
              </p>
            </div>

            {/* List Berkas Yang Dipilih */}
            {canteenPaymentProofFiles.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                  Berkas Terpilih ({canteenPaymentProofFiles.length}):
                </span>
                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {canteenPaymentProofFiles.map((file, fIdx) => {
                    const isImg = isImageFile(file);
                    return (
                      <div key={fIdx} className="relative rounded-none border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-1.5 flex flex-col justify-between">
                        {isImg ? (
                          <div className="aspect-video w-full rounded-none overflow-hidden bg-black/5 mb-1">
                            <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="aspect-video w-full rounded-none bg-green-50 dark:bg-green-950/40 flex flex-col items-center justify-center text-green-600 dark:text-green-400 mb-1">
                            <FileText className="w-4 h-4" />
                            <span className="text-[8px] font-bold uppercase mt-0.5">PDF</span>
                          </div>
                        )}
                        <p className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 truncate" title={file.name}>
                          {file.name}
                        </p>
                        <div className="flex items-center justify-between text-[9px] text-gray-400 mt-0.5">
                          <span className="font-mono">{formatFileSize(file.size)}</span>
                          {file.originalSize && file.originalSize > file.size && (
                            <span className="text-green-600 font-bold font-mono">
                              (-{Math.round((1 - file.size / file.originalSize) * 100)}%)
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setCanteenPaymentProofFiles((prev) => prev.filter((_, i) => i !== fIdx))}
                          className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white p-0.5 rounded-none shadow-xs cursor-pointer"
                          title="Hapus berkas"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pilihan Status Pembayaran */}
            <div className="space-y-1 text-left">
              <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block">
                Ubah Status Pembayaran Menjadi:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setCanteenPaymentStatus('paid')}
                  className={`p-1.5 rounded-none border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    canteenPaymentStatus === 'paid'
                      ? 'bg-green-50 dark:bg-green-950/60 border-green-500 text-green-700 dark:text-green-300 ring-1 ring-green-500'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                  <span>Langsung Lunas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCanteenPaymentStatus('waiting_confirmation')}
                  className={`p-1.5 rounded-none border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    canteenPaymentStatus === 'waiting_confirmation'
                      ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-800 dark:text-amber-300 ring-1 ring-amber-500'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Menunggu Validasi</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOrderToUploadPaymentProof(null);
                  setCanteenPaymentProofFiles([]);
                }}
                disabled={uploadCanteenPaymentProofMutation.isPending || isCompressingPaymentProof}
                className="flex-1 py-1.5 rounded-none font-bold text-xs text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={canteenPaymentProofFiles.length === 0 || uploadCanteenPaymentProofMutation.isPending || isCompressingPaymentProof}
                onClick={() => {
                  const formData = new FormData();
                  canteenPaymentProofFiles.forEach((file) => {
                    formData.append('proof_of_payment[]', file);
                  });
                  formData.append('payment_status', canteenPaymentStatus);
                  uploadCanteenPaymentProofMutation.mutate({
                    id: orderToUploadPaymentProof.id,
                    formData,
                    canteen_id: orderToUploadPaymentProof.canteen_id
                  });
                }}
                className="flex-1 py-1.5 rounded-none font-bold text-xs text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                {uploadCanteenPaymentProofMutation.isPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Mengunggah...</span>
                  </>
                ) : isCompressingPaymentProof ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Mengompresi...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Unggah ({canteenPaymentProofFiles.length}) Bukti</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL CETAK STRUK THERMAL IWARE UNTUK KANTIN */}
      <ThermalReceiptModal
        isOpen={receiptModalConfig.isOpen}
        onClose={() => setReceiptModalConfig(prev => ({ ...prev, isOpen: false }))}
        mode={receiptModalConfig.mode}
        order={receiptModalConfig.order}
        orders={receiptModalConfig.orders}
        courierName={receiptModalConfig.order?.courier?.name || 'Kantin Pondok'}
        title={receiptModalConfig.title}
      />

      {/* MODAL SISTEM & LOGIKA AKUNTANSI UNTUK KANTIN */}
      <AdminAccountingModal
        isOpen={showAccountingModal}
        onClose={() => setShowAccountingModal(false)}
      />
    </div>
  );
}
