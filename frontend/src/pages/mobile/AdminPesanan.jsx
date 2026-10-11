import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  ShoppingBag,
  Store,
  FileText,
  Trash2,
  Search,
  Calendar,
  ChevronLeft,
  X,
  Image as ImageIcon,
  CheckCircle,
  Clock,
  Truck,
  AlertCircle,
  Eye,
  RefreshCw,
  TrendingUp,
  CreditCard,
  User,
  Filter,
  RotateCcw,
  ArchiveRestore,
  AlertTriangle,
  ExternalLink,
  Download,
  Printer,
  UploadCloud,
  Plus,
  FileUp,
  Camera,
  Ticket
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getStorageUrl } from '../../lib/axios';
import {
  getFileType,
  getFileNameFromPath,
  compressImageFiles,
  formatFileSize,
  isImageFile,
  isPdfFile,
  isHeifFile
} from '../../lib/fileUtils';
import ThermalReceiptModal from '../../components/receipt/ThermalReceiptModal';
import santriData from '../../data/santri.json';
import LoadingSpinner from '../../components/common/LoadingSpinner';

function getWeeksInMonth(year, month) {
  const weeks = [];
  let currentDate = new Date(year, month, 1);
  let currentWeek = [];

  while (currentDate.getMonth() === month) {
    currentWeek.push(new Date(currentDate));
    if (currentDate.getDay() === 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return weeks.map((week, index) => ({
    name: `Minggu ${index + 1} (${week[0].getDate()}-${week[week.length - 1].getDate()})`,
    startDate: week[0],
    endDate: week[week.length - 1]
  }));
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
    if (order.payment_status === 'waiting_confirmation') return 70;
    if (order.payment_status === 'unpaid') return 65;
    return 60;
  }

  // 4. BELUM DILANJUTKAN (status === 'pending' - PALING UTAMA DI ATAS!)
  // Pesanan butuh tindakan: Validasi Bayar & Klik "Lanjutkan Pesanan"
  if (order.status === 'pending') {
    // 4a. Pembeli baru upload bukti -> Prioritas Teratas 1 (Skor 100)
    if (order.payment_status === 'waiting_confirmation') {
      return 100;
    }
    // 4b. Baru klik "Konfirmasi Lunas", tapi BELUM klik "Lanjutkan Pesanan" -> TETAP DI ATAS! (Skor 95)
    if (order.payment_status === 'paid') {
      return 95;
    }
    // 4c. Belum Bayar / Belum Set Harga -> Tetap di atas sebelum dilanjutkan (Skor 90)
    return 90;
  }

  return 50;
}

// Optimistic Update Helper for React Query caches
const mutateOrderInCaches = async (queryClient, queryKeyPrefix, targetId, updateFn) => {
  await queryClient.cancelQueries({ queryKey: [queryKeyPrefix] });
  const previousQueries = queryClient.getQueriesData({ queryKey: [queryKeyPrefix] });

  queryClient.setQueriesData({ queryKey: [queryKeyPrefix] }, (oldData) => {
    if (!oldData) return oldData;
    if (Array.isArray(oldData)) {
      return oldData.map(item => item.id === targetId ? updateFn(item) : item);
    }
    if (Array.isArray(oldData?.data)) {
      return {
        ...oldData,
        data: oldData.data.map(item => item.id === targetId ? updateFn(item) : item)
      };
    }
    return oldData;
  });

  return { previousQueries };
};

const removeOrderFromCaches = async (queryClient, queryKeyPrefix, targetId) => {
  await queryClient.cancelQueries({ queryKey: [queryKeyPrefix] });
  const previousQueries = queryClient.getQueriesData({ queryKey: [queryKeyPrefix] });

  queryClient.setQueriesData({ queryKey: [queryKeyPrefix] }, (oldData) => {
    if (!oldData) return oldData;
    if (Array.isArray(oldData)) {
      return oldData.filter(item => item.id !== targetId);
    }
    if (Array.isArray(oldData?.data)) {
      return {
        ...oldData,
        data: oldData.data.filter(item => item.id !== targetId)
      };
    }
    return oldData;
  });

  return { previousQueries };
};

const rollbackCaches = (queryClient, context) => {
  if (context?.previousQueries) {
    context.previousQueries.forEach(([queryKey, previousData]) => {
      queryClient.setQueryData(queryKey, previousData);
    });
  }
};

export default function AdminPesanan() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'recap'

  // Global Unified Filter States (Applies to both Orders list and Recap)
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

  const [selectedCanteenFilter, setSelectedCanteenFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [selectedCourierFilter, setSelectedCourierFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Delete modal state (Soft Delete / Move to Trash)
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [restoreOrderId, setRestoreOrderId] = useState(null);
  const [forceDeleteOrderId, setForceDeleteOrderId] = useState(null);

  // Cancel & Status Change Modal States
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [orderToChangeStatus, setOrderToChangeStatus] = useState(null);
  const [selectedNewStatus, setSelectedNewStatus] = useState('pending');
  const [selectedNewPaymentStatus, setSelectedNewPaymentStatus] = useState('unpaid');
  const [selectedNewCourierId, setSelectedNewCourierId] = useState('');
  const [selectedOrderDateMode, setSelectedOrderDateMode] = useState('keep'); // 'keep' | 'today' | 'tomorrow' | 'custom'
  const [selectedOrderCustomDate, setSelectedOrderCustomDate] = useState('');

  const handleOpenChangeStatusModal = (order, defaultStatus = null, defaultDateMode = 'keep') => {
    setOrderToChangeStatus(order);
    setSelectedNewStatus(defaultStatus || order.status || 'pending');
    setSelectedNewPaymentStatus(order.payment_status || 'unpaid');
    setSelectedNewCourierId(order.courier_id ? String(order.courier_id) : '');
    setSelectedOrderDateMode(defaultDateMode);
    setSelectedOrderCustomDate('');
  };

  const handleContinueOrder = (order) => {
    const couriers = order.canteen?.couriers || [];
    if (couriers.length === 0) {
      toast.error(`Toko "${order.canteen?.name || 'ini'}" belum ada kurirnya! Silakan tugaskan kurir ke toko ini terlebih dahulu.`);
      return;
    }
    updateStatusMutation.mutate({
      id: order.id,
      status: 'processing'
    });
  };

  // Receipt Modal State for Admin
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
      title: `Rekap Semua Pesanan (${orders.length} Pesanan)`
    });
  };

  // Recycle Bin Modal States (Permanent Delete & Empty Trash)
  const [orderToForceDelete, setOrderToForceDelete] = useState(null);
  const [showEmptyTrashModal, setShowEmptyTrashModal] = useState(false);

  // Proof viewer modal state
  const [selectedProofs, setSelectedProofs] = useState([]);

  // Upload Payment Proof Modal States for Admin
  const [orderToUploadProof, setOrderToUploadProof] = useState(null);
  const [proofFiles, setProofFiles] = useState([]);
  const [isCompressingProof, setIsCompressingProof] = useState(false);
  const [uploadPaymentStatus, setUploadPaymentStatus] = useState('paid'); // 'paid' (default) or 'waiting_confirmation'
  const proofFileInputRef = React.useRef(null);
  const proofCameraInputRef = React.useRef(null);

  const handleOpenUploadPaymentModal = (order) => {
    setOrderToUploadProof(order);
    setProofFiles([]);
    setUploadPaymentStatus('paid');
  };

  const handleProofFilesSelected = async (filesList) => {
    if (!filesList || filesList.length === 0) return;
    const incomingFiles = Array.from(filesList);

    const remainingSlots = 5 - proofFiles.length;
    if (remainingSlots <= 0) {
      toast.error('Maksimal 5 berkas bukti pembayaran.');
      return;
    }

    const filesToProcess = incomingFiles.slice(0, remainingSlots);
    setIsCompressingProof(true);

    try {
      const compressed = await compressImageFiles(filesToProcess, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.8
      });
      setProofFiles((prev) => [...prev, ...compressed]);
    } catch (err) {
      console.error('Gagal mengompresi berkas:', err);
      setProofFiles((prev) => [...prev, ...filesToProcess]);
    } finally {
      setIsCompressingProof(false);
      if (proofFileInputRef.current) proofFileInputRef.current.value = '';
      if (proofCameraInputRef.current) proofCameraInputRef.current.value = '';
    }
  };

  // Fetch all canteens for dropdown filter
  const { data: rawCanteens = [] } = useQuery({
    queryKey: ['admin_all_canteens'],
    queryFn: async () => {
      const res = await api.get('/admin/canteens');
      return res.data.data || res.data || [];
    }
  });

  const canteensList = Array.isArray(rawCanteens)
    ? rawCanteens
    : (Array.isArray(rawCanteens?.data) ? rawCanteens.data : []);

  // Helper to compute start_date and end_date for API queries
  const getFilterParams = () => {
    if (filterMode === 'all') {
      return { start_date: '', end_date: '', period: 'all' };
    }
    const pad = n => n.toString().padStart(2, '0');
    const format = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (filterMode === 'day') {
      return { start_date: filterDate, end_date: filterDate, period: 'day' };
    } else if (filterMode === 'week') {
      const weeks = getWeeksInMonth(filterYear, filterMonth);
      const safeIndex = filterWeekIndex < weeks.length ? filterWeekIndex : 0;
      const week = weeks[safeIndex] || weeks[0];
      return { start_date: format(week.startDate), end_date: format(week.endDate), period: 'week' };
    } else if (filterMode === 'month') {
      const start = new Date(filterYear, filterMonth, 1);
      const end = new Date(filterYear, filterMonth + 1, 0);
      return { start_date: format(start), end_date: format(end), period: 'month' };
    } else if (filterMode === 'year') {
      const start = new Date(filterYear, 0, 1);
      const end = new Date(filterYear, 11, 31);
      return { start_date: format(start), end_date: format(end), period: 'year' };
    }
    return { start_date: '', end_date: '', period: 'all' };
  };

  const currentParams = getFilterParams();

  // Query Couriers List for Filter Dropdown
  const { data: rawCouriers = [] } = useQuery({
    queryKey: ['admin_couriers_list'],
    queryFn: async () => {
      const res = await api.get('/admin/users?role=kurir&per_page=100');
      return res.data?.data || res.data || [];
    },
    staleTime: 1000 * 60 * 5
  });

  // Query Orders List
  const {
    data: rawOrders = [],
    isLoading: isLoadingOrders,
    isFetching: isFetchingOrders,
    refetch: refetchOrders
  } = useQuery({
    queryKey: [
      'admin_orders',
      selectedCanteenFilter,
      selectedCourierFilter,
      selectedStatusFilter,
      currentParams.start_date,
      currentParams.end_date,
      searchQuery
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCanteenFilter !== 'all') params.append('canteen_id', selectedCanteenFilter);
      if (selectedCourierFilter !== 'all') params.append('courier_id', selectedCourierFilter);
      if (selectedStatusFilter !== 'all') params.append('status', selectedStatusFilter);
      if (currentParams.start_date) params.append('start_date', currentParams.start_date);
      if (currentParams.end_date) params.append('end_date', currentParams.end_date);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await api.get(`/admin/orders?${params.toString()}`);
      return res.data.data || res.data || [];
    }
  });

  const rawOrdersList = Array.isArray(rawOrders)
    ? rawOrders
    : (Array.isArray(rawOrders?.data) ? rawOrders.data : []);

  // Compute merged courier list (from DB user query + any couriers present in order relations)
  const couriersList = React.useMemo(() => {
    const list = Array.isArray(rawCouriers) ? [...rawCouriers] : [];
    const existingIds = new Set(list.map((c) => c.id));
    rawOrdersList.forEach((o) => {
      if (o.courier && !existingIds.has(o.courier.id)) {
        list.push(o.courier);
        existingIds.add(o.courier.id);
      }
    });
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [rawCouriers, rawOrdersList]);

  const orders = React.useMemo(() => {
    // Smart Priority Sorting:
    // 1. Menunggu Validasi Bayar (Score 100) -> Paling Atas
    // 2. Belum Lunas (Score 80) -> Di atas pesanan lunas
    // 3. Sudah Lunas & Aktif (Score 60)
    // 4. Selesai (Score 30)
    // 5. Dibatalkan (Score 10) -> Paling Bawah
    return [...rawOrdersList].sort((a, b) => {
      const scoreA = getOrderPriorityScore(a);
      const scoreB = getOrderPriorityScore(b);

      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Skor tertinggi lebih dulu
      }

      // Jika skor prioritas sama, urutkan berdasarkan order terbaru
      return (b.id || 0) - (a.id || 0);
    });
  }, [rawOrdersList]);

  // Query Recap Data (Uses the exact same date & courier filter)
  const {
    data: recapData,
    isLoading: isLoadingRecap,
    isFetching: isFetchingRecap,
    refetch: refetchRecap
  } = useQuery({
    queryKey: [
      'admin_orders_recap',
      selectedCanteenFilter,
      selectedCourierFilter,
      currentParams.period,
      currentParams.start_date,
      currentParams.end_date
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCanteenFilter !== 'all') params.append('canteen_id', selectedCanteenFilter);
      if (selectedCourierFilter !== 'all') params.append('courier_id', selectedCourierFilter);
      if (currentParams.period) params.append('period', currentParams.period);
      if (currentParams.start_date) params.append('start_date', currentParams.start_date);
      if (currentParams.end_date) params.append('end_date', currentParams.end_date);

      const res = await api.get(`/admin/orders/recap?${params.toString()}`);
      return res.data;
    }
  });

  // Human-readable active date label
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

  // Query Recycle Bin / Trashed Orders
  const {
    data: rawTrash = [],
    isLoading: isLoadingTrash,
    isFetching: isFetchingTrash,
    refetch: refetchTrash
  } = useQuery({
    queryKey: ['admin_orders_trash'],
    queryFn: async () => {
      const res = await api.get('/admin/orders/trash');
      return res.data || [];
    }
  });

  const trashedOrders = Array.isArray(rawTrash) ? rawTrash : (rawTrash?.data || []);

  // Mutation Move to Trash (Soft Delete)
  const deleteOrderMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/admin/orders/${id}`);
      return res.data;
    },
    onMutate: async (id) => {
      const context = await removeOrderFromCaches(queryClient, 'admin_orders', id);
      setOrderToDelete(null);
      return context;
    },
    onError: (err, id, context) => {
      rollbackCaches(queryClient, context);
      toast.error(err.response?.data?.message || 'Gagal menghapus pesanan');
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Pesanan dipindahkan ke Kotak Sampah');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin_orders_trash'] });
      queryClient.invalidateQueries({ queryKey: ['admin_orders_recap'] });
      queryClient.invalidateQueries({ queryKey: ['admin_stats'] });
    }
  });

  // Mutation Restore Order from Trash
  const restoreOrderMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.post(`/admin/orders/${id}/restore`);
      return res.data;
    },
    onMutate: async (id) => {
      return await removeOrderFromCaches(queryClient, 'admin_orders_trash', id);
    },
    onError: (err, id, context) => {
      rollbackCaches(queryClient, context);
      toast.error(err.response?.data?.message || 'Gagal memulihkan pesanan');
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Pesanan berhasil dipulihkan!');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin_orders_trash'] });
      queryClient.invalidateQueries({ queryKey: ['admin_orders_recap'] });
      queryClient.invalidateQueries({ queryKey: ['admin_stats'] });
    }
  });

  // Mutation Permanently Delete Order (Force Delete)
  const forceDeleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/admin/orders/${id}/force`);
      return res.data;
    },
    onMutate: async (id) => {
      const context = await removeOrderFromCaches(queryClient, 'admin_orders_trash', id);
      setOrderToForceDelete(null);
      return context;
    },
    onError: (err, id, context) => {
      rollbackCaches(queryClient, context);
      toast.error(err.response?.data?.message || 'Gagal menghapus permanen');
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Pesanan berhasil dihapus permanen');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_orders_trash'] });
    }
  });

  // Mutation Empty Trash (Empty entire Recycle Bin)
  const emptyTrashMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/admin/orders/trash/empty');
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Kotak sampah berhasil dikosongkan');
      queryClient.invalidateQueries({ queryKey: ['admin_orders_trash'] });
      setShowEmptyTrashModal(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal mengosongkan kotak sampah');
    }
  });

  // Mutation Cancel Order (Admin can cancel ANY order, including completed ones)
  const cancelOrderMutation = useMutation({
    mutationFn: async ({ id, reason }) => {
      const res = await api.put(`/admin/orders/${id}/cancel`, { reason });
      return res.data;
    },
    onMutate: async (variables) => {
      setOrderToCancel(null);
      setCancelReason('');
      return await mutateOrderInCaches(queryClient, 'admin_orders', variables.id, (order) => ({
        ...order,
        status: 'cancelled'
      }));
    },
    onError: (err, variables, context) => {
      rollbackCaches(queryClient, context);
      toast.error(err.response?.data?.message || 'Gagal membatalkan pesanan');
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Pesanan berhasil dibatalkan');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin_orders_recap'] });
      queryClient.invalidateQueries({ queryKey: ['admin_stats'] });
      queryClient.invalidateQueries({ queryKey: ['courier_orders'] });
    }
  });

  // Mutation Update Order Status & Payment Status & Schedule Date
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, payment_status, courier_id, target_date }) => {
      const res = await api.put(`/admin/orders/${id}/status`, { status, payment_status, courier_id, target_date });
      return res.data;
    },
    onMutate: async (variables) => {
      setOrderToChangeStatus(null);
      return await mutateOrderInCaches(queryClient, 'admin_orders', variables.id, (order) => ({
        ...order,
        ...(variables.status ? { status: variables.status } : {}),
        ...(variables.payment_status ? { payment_status: variables.payment_status } : {}),
        ...(variables.courier_id ? { courier_id: variables.courier_id } : {})
      }));
    },
    onError: (err, variables, context) => {
      rollbackCaches(queryClient, context);
      toast.error(err.response?.data?.message || 'Gagal mengubah status pesanan');
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Status pesanan berhasil diperbarui');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin_orders_recap'] });
      queryClient.invalidateQueries({ queryKey: ['admin_stats'] });
      queryClient.invalidateQueries({ queryKey: ['courier_orders'] });
      queryClient.invalidateQueries({ queryKey: ['canteen_orders'] });
    }
  });

  // Mutation Upload Payment Proof by Admin
  const uploadPaymentProofMutation = useMutation({
    mutationFn: async ({ id, formData }) => {
      const res = await api.post(`/admin/orders/${id}/payment-proof`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 45000,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Bukti pembayaran berhasil diunggah!');
      queryClient.invalidateQueries({ queryKey: ['admin_orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin_orders_recap'] });
      queryClient.invalidateQueries({ queryKey: ['admin_stats'] });
      setOrderToUploadProof(null);
      setProofFiles([]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal mengunggah bukti pembayaran');
    }
  });

  // Mutation Delete Proof Photo by Admin
  const deleteProofMutation = useMutation({
    mutationFn: async ({ id, type, path }) => {
      const res = await api.delete(`/admin/orders/${id}/proof`, {
        data: { type, path }
      });
      return { ...res.data, deletedPath: path };
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Berkas bukti berhasil dihapus');
      queryClient.invalidateQueries({ queryKey: ['admin_orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin_orders_recap'] });
      if (data.order && orderToUploadProof && orderToUploadProof.id === data.order.id) {
        setOrderToUploadProof(data.order);
      }
      setSelectedProofs((prev) => prev.filter((p) => !p.includes(data.deletedPath || '')));
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal menghapus berkas bukti');
    }
  });

  const handleDeleteConfirm = () => {
    if (!orderToDelete) return;
    deleteOrderMutation.mutate(orderToDelete.id);
  };

  return (
    <div className="space-y-1.5 pb-16 animate-fade-in-up font-sans max-w-7xl mx-auto px-1 sm:px-2">
      {/* GOJEK / GOBIZ STYLE UNIFIED TOP PANEL */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none shadow-xs">
        
        {/* Baris 1: Segmented Navigasi Utama */}
        <div className="grid grid-cols-3 w-full bg-gray-100 dark:bg-gray-800/80 p-0.5 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-1.5 px-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-white dark:bg-gray-900 text-green-700 dark:text-green-400 shadow-xs border-b-2 border-green-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
            <span className="truncate">Pesanan ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('recap')}
            className={`py-2 px-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'recap'
                ? 'bg-white dark:bg-gray-900 text-green-700 dark:text-green-400 shadow-xs border-b-2 border-green-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
            <span className="truncate">Rekap & Laporan</span>
          </button>

          <button
            onClick={() => setActiveTab('trash')}
            className={`py-2 px-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'trash'
                ? 'bg-white dark:bg-gray-900 text-amber-600 dark:text-amber-400 shadow-xs border-b-2 border-amber-500'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 text-amber-500" />
            <span className="truncate">Sampah ({trashedOrders.length})</span>
          </button>
        </div>

        {/* Baris 2: Period Switcher & Aksi Cepat */}
        <div className="px-2.5 py-1.5 flex items-center justify-between gap-1.5 bg-gray-50/70 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-800">
          {/* Mode Switcher Buttons */}
          <div className="inline-flex border border-gray-200 dark:border-gray-700 divide-x divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
            {[
              { id: 'day', label: 'Hari' },
              { id: 'week', label: 'Minggu' },
              { id: 'month', label: 'Bulan' },
              { id: 'year', label: 'Tahun' },
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
                className={`px-2.5 py-1 text-[10px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  filterMode === m.id
                    ? 'bg-green-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Print Batch Button (Thermal) */}
            {activeTab === 'orders' && orders.length > 0 && (
              <button
                onClick={handlePrintBatchReceipt}
                className="py-1 px-2.5 bg-gray-900 hover:bg-black text-white dark:bg-gray-800 dark:hover:bg-gray-700 rounded-none text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                title="Cetak Rekap Seluruh Pesanan ke Printer Thermal"
              >
                <Printer className="w-3 h-3 text-green-400" />
                <span className="hidden sm:inline">Cetak ({orders.length})</span>
              </button>
            )}

            {/* Refresh Data Button */}
            <button
              onClick={() => {
                if (activeTab === 'orders') refetchOrders();
                else if (activeTab === 'recap') refetchRecap();
                else if (activeTab === 'trash') refetchTrash();
              }}
              title="Perbarui Data"
              className="p-1 text-gray-600 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetchingOrders || isFetchingRecap || isFetchingTrash ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Baris 3: Toolbar Filter Terstruktur (Padat & Flat) */}
        <div className="p-1.5 sm:p-2 bg-white dark:bg-gray-900">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 text-xs">
            {/* 1. Date / Period Selector */}
            {filterMode === 'day' && (
              <div className="relative group w-full col-span-1">
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  onClick={(e) => {
                    try {
                      e.target.showPicker();
                    } catch {
                      // Fallback
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  title="Klik untuk memilih hari / tanggal"
                />
                <div className="flex items-center justify-between h-[29px] px-2 border rounded-none text-xs bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-white font-bold group-hover:border-green-500 transition-colors">
                  <span className="truncate text-[11px]">
                    📅 {new Date(filterDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <Calendar className="w-3 h-3 text-green-600 dark:text-green-400 shrink-0 ml-1" />
                </div>
              </div>
            )}

            {filterMode === 'week' && (
              <div className="grid grid-cols-2 gap-0.5 w-full col-span-1">
                <select
                  value={filterMonth}
                  onChange={(e) => {
                    const newMonth = parseInt(e.target.value);
                    setFilterMonth(newMonth);
                    setFilterWeekIndex(getCurrentWeekIndex(filterYear, newMonth));
                  }}
                  className="h-[29px] px-1 border rounded-none text-[11px] bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-white font-bold focus:outline-none"
                >
                  {['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'].map(
                    (m, i) => (
                      <option key={i} value={i}>
                        {m}
                      </option>
                    )
                  )}
                </select>

                <select
                  value={filterWeekIndex < getWeeksInMonth(filterYear, filterMonth).length ? filterWeekIndex : 0}
                  onChange={(e) => setFilterWeekIndex(parseInt(e.target.value))}
                  className="h-[29px] px-0.5 border rounded-none text-[11px] bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-white font-bold focus:outline-none truncate"
                >
                  {getWeeksInMonth(filterYear, filterMonth).map((w, i) => (
                    <option key={i} value={i}>
                      M{i + 1}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {filterMode === 'month' && (
              <div className="w-full col-span-1">
                <select
                  value={filterMonth}
                  onChange={(e) => {
                    const newMonth = parseInt(e.target.value);
                    setFilterMonth(newMonth);
                    setFilterWeekIndex(getCurrentWeekIndex(filterYear, newMonth));
                  }}
                  className="w-full h-[29px] px-2 border rounded-none text-[11px] bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-white font-bold focus:outline-none truncate"
                >
                  {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map(
                    (m, i) => (
                      <option key={i} value={i}>
                        🗓️ {m}
                      </option>
                    )
                  )}
                </select>
              </div>
            )}

            {filterMode === 'year' && (
              <div className="w-full col-span-1">
                <select
                  value={filterYear}
                  onChange={(e) => {
                    const newYear = parseInt(e.target.value);
                    setFilterYear(newYear);
                    setFilterWeekIndex(getCurrentWeekIndex(newYear, filterMonth));
                  }}
                  className="w-full h-[29px] px-2 border rounded-none text-[11px] bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-white font-bold focus:outline-none truncate"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>
                      🗓️ Thn {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {filterMode === 'all' && (
              <div className="h-[29px] px-2 flex items-center justify-center bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-[11px] font-bold text-gray-600 dark:text-gray-300 truncate col-span-1">
                🗓️ Semua Waktu
              </div>
            )}

            {/* 2. Toko Filter */}
            <div className="w-full col-span-1">
              <select
                value={selectedCanteenFilter}
                onChange={(e) => setSelectedCanteenFilter(e.target.value)}
                className="w-full h-[29px] px-2 border rounded-none text-[11px] font-bold bg-gray-50 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 focus:outline-none truncate cursor-pointer"
              >
                <option value="all">🏪 Semua Toko ({canteensList.length})</option>
                {canteensList.map((c) => (
                  <option key={c.id} value={c.id}>
                    🏪 {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Status Filter */}
            <div className="w-full col-span-1">
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="w-full h-[29px] px-2 border rounded-none text-[11px] font-bold bg-gray-50 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 focus:outline-none truncate cursor-pointer"
              >
                <option value="all">📋 Semua Status</option>
                <option value="waiting_confirmation">⏳ Verifikasi Bayar</option>
                <option value="paid">💳 Lunas</option>
                <option value="unpaid">⚠️ Belum Bayar</option>
                <option value="pending">⏳ Pending (Baru)</option>
                <option value="processing">🚚 Diproses</option>
                <option value="completed">✅ Selesai</option>
                <option value="cancelled">❌ Dibatalkan</option>
              </select>
            </div>

            {/* 4. Courier Filter */}
            <div className="w-full col-span-1">
              <select
                value={selectedCourierFilter}
                onChange={(e) => setSelectedCourierFilter(e.target.value)}
                className="w-full h-[29px] px-2 border rounded-none text-[11px] font-bold bg-gray-50 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 focus:outline-none truncate cursor-pointer"
              >
                <option value="all">🛵 Semua Kurir</option>
                <option value="unassigned">🚫 Antar Sendiri</option>
                {couriersList.map((c) => (
                  <option key={c.id} value={c.id}>
                    🛵 {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Search Box */}
            <div className="relative w-full col-span-2 sm:col-span-2 lg:col-span-1">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari santri, toko, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-[29px] pl-7 pr-2.5 border rounded-none text-xs bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-white focus:ring-1 focus:ring-green-500 focus:outline-none font-medium placeholder:text-gray-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: DAFTAR SEMUA PESANAN */}
      {activeTab === 'orders' && (
        <div className="space-y-1.5">

          {/* Orders List */}
          {isLoadingOrders ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
              <LoadingSpinner 
                text="Memuat Data Pesanan Admin..." 
                subtext="Menghubungkan ke database seluruh transaksi" 
                minHeight="min-h-[160px]"
              />
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-none p-8 text-center border border-gray-200 dark:border-gray-700 shadow-xs">
              <ShoppingBag className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-700" />
              <h3 className="font-bold text-gray-700 dark:text-gray-300 text-sm">Tidak ada pesanan ditemukan</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Tidak ada pesanan yang sesuai dengan filter tanggal <strong>{getFilterLabel()}</strong>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2">
              {orders.map((order) => {
                const isPaid = order.payment_status === 'paid';
                const isWaiting = order.payment_status === 'waiting_confirmation';
                const isTeacherOrder = order.order_for === 'guru' || (order.is_priority && !order.user?.santri_name);
                const isPriority = order.is_priority || isTeacherOrder;
                const santriName = isTeacherOrder ? (order.user?.name || 'Guru / Staff') : (order.user?.santri_name || order.user?.name || 'Santri');
                const waliName = isTeacherOrder ? 'Guru / Staff Yayasan' : (order.user?.name || 'Wali');
                let santriClass = isTeacherOrder ? `Unit ${order.user?.teacher_unit || 'Yayasan'}` : (order.user?.santri_class || '');
                let santriLevel = isTeacherOrder ? (order.user?.niy ? `NIY: ${order.user.niy}` : 'Staff') : (order.user?.santri_level || '');
                let santriRoom = order.delivery_location || (isTeacherOrder ? `Ruang Guru ${order.user?.teacher_unit || ''}` : (order.user?.santri_room || ''));

                if (!isTeacherOrder && santriName && santriData?.data) {
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
                    if ((!santriRoom || santriRoom === '-') && match[10]) {
                      santriRoom = match[10];
                    }
                  }
                }

                return (
                  <div
                    key={order.id}
                    className={`bg-white dark:bg-gray-900 rounded-none border shadow-xs transition-all p-2 sm:p-2.5 flex flex-col justify-between gap-1 ${
                      isPriority 
                        ? 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/30 bg-indigo-50/15 dark:bg-indigo-950/10' 
                        : 'border-gray-200 dark:border-gray-800 hover:border-green-500 dark:hover:border-green-600'
                    }`}
                  >
                    {/* Priority Banner for Teacher / Staff */}
                    {isPriority && (
                      <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 text-white px-2 py-0.5 rounded-none flex items-center justify-between text-[10px] font-black tracking-tight -mx-2 -mt-2 sm:-mx-2.5 sm:-mt-2.5 mb-1 shadow-xs">
                        <span className="flex items-center gap-1">
                          ⚡ PRIORITAS GURU/STAFF • DIANTAR LANGSUNG
                        </span>
                        <span className="bg-amber-400 text-indigo-950 px-1.5 py-0.2 rounded-none uppercase text-[9px] font-mono font-black">
                          UNIT {order.user?.teacher_unit || 'YAYASAN'}
                        </span>
                      </div>
                    )}
                    {/* 1. Header: Toko, ID, Jam & Status Badges */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1 border-b border-gray-200 dark:border-gray-700/80 pb-1">
                        <div className="flex items-center gap-1 flex-wrap min-w-0">
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-none bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 truncate max-w-[130px]">
                            🏪 {order.canteen?.name || `Kantin #${order.canteen_id}`}
                          </span>
                          <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">
                            #{order.id}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            • {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Status Badges (Clickable) */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenChangeStatusModal(order)}
                            title="Klik untuk ubah status pembayaran / pesanan"
                            className={`px-1.5 py-0.5 rounded-none text-[10px] font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                              isPaid
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                : isWaiting
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-300 animate-pulse'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                            }`}
                          >
                            {isPaid ? 'Lunas' : isWaiting ? 'Verifikasi' : 'Belum Bayar'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenChangeStatusModal(order)}
                            title="Klik untuk ubah status pesanan"
                            className={`px-1.5 py-0.5 rounded-none text-[10px] font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                              order.status === 'completed'
                                ? 'bg-green-50 text-green-800 dark:bg-green-950/60 dark:text-green-300 border border-green-200 dark:border-green-800'
                                : order.status === 'processing'
                                ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                : order.status === 'cancelled'
                                ? 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            {order.status === 'completed'
                              ? 'Selesai'
                              : order.status === 'processing'
                              ? 'Proses'
                              : order.status === 'cancelled'
                              ? 'Batal'
                              : 'Pending'}
                          </button>
                        </div>
                      </div>

                      {/* 2. Customer & Room Info (Compact 1-2 lines) */}
                      <div className="text-xs space-y-0.5">
                        {isTeacherOrder ? (
                          <>
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-indigo-950 dark:text-indigo-100 truncate flex items-center gap-1">
                                <span className="text-sm">🎓</span>
                                <span className="truncate">{santriName}</span>
                              </span>
                              <span className="text-[11px] font-extrabold text-indigo-900 dark:text-indigo-200 bg-indigo-100 dark:bg-indigo-950/60 px-1.5 py-0.2 border border-indigo-300 dark:border-indigo-700 shrink-0">
                                📍 {santriRoom || '-'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] pt-0.5 flex-wrap gap-1">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <span className="font-mono text-purple-700 dark:text-purple-300 font-bold bg-purple-50 dark:bg-purple-950/50 px-1 py-0.2 border border-purple-200 dark:border-purple-800">
                                  {santriLevel}
                                </span>
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded-none bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold">
                                  {santriClass}
                                </span>
                              </div>
                              {order.courier?.name ? (
                                <span className="text-green-700 dark:text-green-400 font-bold flex items-center gap-1 shrink-0 bg-green-50 dark:bg-green-950/50 px-1.5 py-0.5 rounded-none border border-green-200 dark:border-green-800 text-[10px]">
                                  <Truck className="w-3 h-3 text-green-600 dark:text-green-400" /> {order.courier.name}
                                </span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500 font-medium flex items-center gap-0.5 shrink-0 text-[10px]">
                                  🚫 Tanpa Kurir
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-gray-900 dark:text-white truncate flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span className="truncate">{santriName}</span>
                              </span>
                              <span className="text-[11px] text-gray-600 dark:text-gray-300 font-semibold shrink-0">
                                📍 {santriRoom || '-'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 pt-0.5 flex-wrap gap-1">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <span className="truncate">Wali: {waliName}</span>
                                {(santriLevel || santriClass) && (
                                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-none bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 text-[10px] font-bold">
                                    🎓 {santriLevel ? `${santriLevel} ` : ''}{santriClass ? `Kelas ${santriClass}` : ''}
                                  </span>
                                )}
                              </div>
                              {order.courier?.name ? (
                                <span className="text-green-700 dark:text-green-400 font-bold flex items-center gap-1 shrink-0 bg-green-50 dark:bg-green-950/50 px-1.5 py-0.5 rounded-none border border-green-200 dark:border-green-800 text-[10px]">
                                  <Truck className="w-3 h-3 text-green-600 dark:text-green-400" /> {order.courier.name}
                                </span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500 font-medium flex items-center gap-0.5 shrink-0 text-[10px]">
                                  🚫 Tanpa Kurir
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>


                      {/* 3. Items List Box (Minimalist & Clean) */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-none p-1.5 space-y-0.5 text-xs border border-gray-200 dark:border-gray-700">
                        {order.custom_notes && (
                          <div className="text-[11px] font-medium text-purple-800 dark:text-purple-300 pb-0.5 border-b border-purple-100 dark:border-purple-900/40">
                            ✨ {order.custom_notes}
                          </div>
                        )}
                        {order.items && order.items.length > 0 ? (
                          order.items.map((item) => (
                            <div key={item.id} className="flex justify-between items-center text-[11px]">
                              <span className="text-gray-700 dark:text-gray-300 truncate pr-2">
                                <strong className="text-gray-900 dark:text-white font-bold">{item.quantity}x</strong> {item.product?.name || 'Produk'}
                                {item.notes && <span className="text-gray-400 italic text-[10px]"> ({item.notes})</span>}
                              </span>
                              <span className="font-bold text-gray-900 dark:text-white shrink-0">
                                Rp {parseFloat(item.subtotal).toLocaleString('id-ID')}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="flex justify-between items-center text-[11px] text-gray-500">
                            <span>1x Pesanan Khusus</span>
                            <span className="font-bold text-gray-900 dark:text-white">
                              Rp {parseFloat(order.total_price || 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 4. Proof Buttons (Only if available - compact chips) & Quick Upload */}
                      <div className="flex gap-1 flex-wrap items-center pt-0.5">
                        {order.proof_of_payment && order.proof_of_payment.length > 0 ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => {
                                const proofs = Array.isArray(order.proof_of_payment)
                                  ? order.proof_of_payment.map((p) => getStorageUrl(p))
                                  : [getStorageUrl(order.proof_of_payment)];
                                setSelectedProofs(proofs);
                              }}
                              className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 hover:bg-indigo-100 rounded-none text-[10px] font-semibold flex items-center gap-1 transition-colors border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                            >
                              <ImageIcon className="w-3 h-3" /> Bayar ({Array.isArray(order.proof_of_payment) ? order.proof_of_payment.length : 1})
                            </button>
                            <button
                              onClick={() => handleOpenUploadPaymentModal(order)}
                              title="Tambah / ganti bukti transfer santri"
                              className="px-1.5 py-0.5 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 hover:bg-green-100 rounded-none text-[10px] font-bold flex items-center gap-0.5 transition-colors border border-green-200 dark:border-green-800 cursor-pointer"
                            >
                              <Plus className="w-2.5 h-2.5" /> Bukti
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenUploadPaymentModal(order)}
                            className="px-1.5 py-0.5 bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300 rounded-none text-[10px] font-semibold flex items-center gap-1 transition-colors border border-green-200 dark:border-green-800 cursor-pointer"
                            title="Unggah bukti pembayaran santri"
                          >
                            <UploadCloud className="w-3 h-3 text-green-600 dark:text-green-400" />
                            <span>+ Bukti Transfer</span>
                          </button>
                        )}

                        {order.proof_of_purchase && order.proof_of_purchase.length > 0 && (
                          <button
                            onClick={() => {
                              const proofs = Array.isArray(order.proof_of_purchase)
                                ? order.proof_of_purchase.map((p) => getStorageUrl(p))
                                : [getStorageUrl(order.proof_of_purchase)];
                              setSelectedProofs(proofs);
                            }}
                            className="px-1.5 py-0.5 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 hover:bg-purple-100 rounded-none text-[10px] font-semibold flex items-center gap-1 transition-colors border border-purple-200 dark:border-purple-800 cursor-pointer"
                          >
                            <ImageIcon className="w-3 h-3" /> Struk
                          </button>
                        )}

                        {order.proof_of_delivery && order.proof_of_delivery.length > 0 && (
                          <button
                            onClick={() => {
                              const proofs = Array.isArray(order.proof_of_delivery)
                                ? order.proof_of_delivery.map((p) => getStorageUrl(p))
                                : [getStorageUrl(order.proof_of_delivery)];
                              setSelectedProofs(proofs);
                            }}
                            className="px-1.5 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 hover:bg-blue-100 rounded-none text-[10px] font-semibold flex items-center gap-1 transition-colors border border-blue-200 dark:border-blue-800 cursor-pointer"
                          >
                            <ImageIcon className="w-3 h-3" /> Antar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 5. Footer: Total Price & Minimalist Actions */}
                    <div className="pt-1.5 border-t border-gray-200 dark:border-gray-700/80 flex items-center justify-between gap-1.5">
                      <div className="min-w-0">
                        <span className="text-sm font-black text-green-700 dark:text-green-400 block leading-tight">
                          Rp {parseFloat(order.total_price || 0).toLocaleString('id-ID')}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium truncate block">
                          Ongkir: Rp {parseFloat(order.delivery_fee || 0).toLocaleString('id-ID')}
                        </span>
                      </div>

                      {/* Minimalist Action Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {order.status !== 'cancelled' ? (
                          <>
                            <button
                              onClick={() => {
                                setOrderToCancel(order);
                                setCancelReason('');
                              }}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 rounded-none text-xs font-bold transition-colors border border-red-200 dark:border-red-800 cursor-pointer"
                              title={order.status === 'completed' ? 'Batalkan pesanan yang sudah selesai' : 'Batalkan Pesanan'}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            {order.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => handleOpenChangeStatusModal(order, 'processing', 'tomorrow')}
                                disabled={updateStatusMutation.isPending}
                                className="px-1.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-none text-[10.5px] font-bold transition-colors flex items-center gap-0.5 shadow-2xs cursor-pointer"
                                title="Jadwalkan pesanan ke Besok"
                              >
                                <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span>Besok</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleContinueOrder(order)}
                              disabled={updateStatusMutation.isPending}
                              className="px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-300 dark:border-green-800 rounded-none text-[11px] font-bold transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                              title="Lanjutkan Pesanan (Otomatis ditugaskan ke Kurir Toko)"
                            >
                              <Truck className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                              <span>Lanjutkan</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenChangeStatusModal(order, 'processing', 'tomorrow')}
                              disabled={updateStatusMutation.isPending}
                              className="px-1.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-none text-[10.5px] font-bold transition-colors flex items-center gap-0.5 shadow-2xs cursor-pointer"
                              title="Lanjutkan dan Jadwalkan pesanan ke Besok"
                            >
                              <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>Besok</span>
                            </button>
                          </div>
                        )}

                        <button
                          onClick={() => handleOpenUploadPaymentModal(order)}
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-none text-xs font-bold transition-colors cursor-pointer"
                          title="Unggah / Tambah Bukti Transfer Santri"
                        >
                          <UploadCloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        </button>

                        <button
                          onClick={() => handleOpenChangeStatusModal(order)}
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-none text-[11px] font-bold transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                          title="Ubah Status Pesanan"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Status</span>
                        </button>

                        <button
                          onClick={() => handlePrintSingleReceipt(order)}
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-none text-xs font-bold transition-colors cursor-pointer"
                          title="Cetak Struk Thermal / A4"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        </button>

                        <button
                          onClick={() => setOrderToDelete(order)}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:text-red-600 rounded-none text-xs font-bold transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
                          title="Hapus / Pindahkan ke Kotak Sampah"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REKAPITULASI & STATISTIK */}
      {activeTab === 'recap' && (
        <div className="space-y-1.5 sm:space-y-2">
          {/* Header Ringkasan Periode Aktif */}
          <div className="bg-white dark:bg-gray-900 p-1.5 sm:p-2 rounded-none shadow-xs border border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-1">
            <h2 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-green-600" />
              Rekapitulasi Penjualan & Keuangan ({getFilterLabel()})
            </h2>
            <button
              onClick={() => refetchRecap()}
              className="flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400 hover:underline font-semibold ml-auto"
            >
              <RefreshCw className={`w-3 h-3 ${isFetchingRecap ? 'animate-spin' : ''}`} /> Refresh Rekap
            </button>
          </div>

          {isLoadingRecap ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
              <LoadingSpinner 
                text="Memuat Rekapitulasi Admin..." 
                subtext="Menghitung total transaksi, laba, dan data toko" 
                minHeight="min-h-[160px]"
              />
            </div>
          ) : (
            <>
              {/* Metric Cards - Ultra Dense */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1 sm:gap-1.5">
                <div className="bg-white dark:bg-gray-900 p-1.5 sm:p-2 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs">
                  <span className="text-[9px] sm:text-[9.5px] text-gray-500 font-medium block truncate">Total Belanja (HPJ)</span>
                  <span className="text-xs sm:text-sm font-black text-gray-900 dark:text-white block mt-0.5 font-mono truncate">
                    Rp {(recapData?.summary?.total_products || 0).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="bg-amber-50/60 dark:bg-amber-950/20 p-1.5 sm:p-2 rounded-none border border-amber-200/80 dark:border-amber-800/40 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] sm:text-[9.5px] text-amber-700 dark:text-amber-400 font-medium block truncate">Total Modal (HPP)</span>
                    <span className="text-xs sm:text-sm font-black text-amber-700 dark:text-amber-300 block mt-0.5 font-mono truncate">
                      Rp {(recapData?.summary?.total_hpp || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[8.5px] text-slate-600 dark:text-slate-300 font-medium truncate">
                    HPP+Ongkir: <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                      Rp {((recapData?.summary?.total_hpp || 0) + (recapData?.summary?.total_courier_net_delivery_fee ?? recapData?.summary?.total_delivery_fee ?? 0)).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-1.5 sm:p-2 rounded-none border border-emerald-200 dark:border-emerald-800/50 shadow-xs">
                  <span className="text-[9px] sm:text-[9.5px] text-emerald-700 dark:text-emerald-300 font-bold block truncate">Total Laba Toko</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-300 block mt-0.5 font-mono truncate">
                    Rp {(recapData?.summary?.total_profit || 0).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="bg-white dark:bg-gray-900 p-1.5 sm:p-2 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] sm:text-[9.5px] text-gray-500 font-medium block truncate">Total Ongkir Kurir</span>
                    <span className="text-xs sm:text-sm font-black text-blue-600 dark:text-blue-400 block mt-0.5 font-mono truncate">
                      Rp {(recapData?.summary?.total_courier_net_delivery_fee ?? recapData?.summary?.total_delivery_fee ?? 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    {(recapData?.summary?.total_courier_cut_to_admin || 0) > 0 && (
                      <div className="text-purple-600 dark:text-purple-400 text-[8.5px] font-medium truncate">
                        → Admin: <span className="font-mono font-bold">Rp {(recapData.summary.total_courier_cut_to_admin).toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    {(recapData?.summary?.total_delivery_discount || 0) > 0 && (
                      <div className="text-emerald-600 dark:text-emerald-400 text-[8.5px] font-medium truncate">
                        Subsidi: +Rp {(recapData.summary.total_delivery_discount).toLocaleString('id-ID')}
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-1.5 sm:p-2 rounded-none border border-purple-200/60 dark:border-purple-800/40 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] sm:text-[9.5px] text-purple-700 dark:text-purple-400 font-medium block truncate">Total Biaya Admin</span>
                    <span className="text-xs sm:text-sm font-black text-purple-600 dark:text-purple-400 block mt-0.5 font-mono truncate">
                      Rp {(recapData?.summary?.total_admin_fee || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="mt-0.5 space-y-0.5 text-[8.5px]">
                    <div className="text-gray-500 truncate">
                      Pokok: Rp {(recapData?.summary?.total_base_admin_fee || 0).toLocaleString('id-ID')}
                    </div>
                    {(recapData?.summary?.total_voucher_discount || 0) > 0 && (
                      <div className="text-rose-600 dark:text-rose-400 font-bold truncate">
                        Subsidi: -Rp {(recapData.summary.total_voucher_discount).toLocaleString('id-ID')}
                      </div>
                    )}
                    {(recapData?.summary?.total_voucher_discount || 0) > 0 && (
                      <div className="text-emerald-700 dark:text-emerald-400 font-bold truncate">
                        Bersih: Rp {(recapData.summary.net_admin_fee || 0).toLocaleString('id-ID')}
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-950/40 p-1.5 sm:p-2 rounded-none border border-green-200 dark:border-green-800/50 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] sm:text-[9.5px] text-green-700 dark:text-green-300 font-medium block truncate">
                      Grand Total ({recapData?.summary?.total_orders || 0} Order)
                    </span>
                    <span className="text-xs sm:text-sm font-black text-green-700 dark:text-green-300 block mt-0.5 font-mono truncate">
                      Rp {(recapData?.summary?.grand_total || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  {(recapData?.summary?.total_voucher_discount || 0) > 0 && (
                    <div className="mt-0.5 text-[8.5px] text-amber-700 dark:text-amber-400 font-bold truncate">
                      Diskon: -Rp {(recapData.summary.total_voucher_discount).toLocaleString('id-ID')}
                    </div>
                  )}
                </div>
              </div>

              {/* Rekapitulasi Per Toko / Kantin */}
              <div className="bg-white dark:bg-gray-900 rounded-none shadow-xs border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="p-1.5 sm:p-2 border-b border-gray-200 dark:border-gray-800 bg-blue-50/40 dark:bg-blue-950/20 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-blue-600" />
                    Rekapitulasi Per Toko / Kantin
                  </h3>
                  <span className="text-[9.5px] sm:text-[10px] text-gray-500 font-medium">
                    {recapData?.canteen_recap?.length || 0} Toko Terlibat
                  </span>
                </div>
                
                <div>
                  {!recapData?.canteen_recap || recapData.canteen_recap.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 text-sm">
                      Belum ada transaksi pada periode <strong>{getFilterLabel()}</strong>.
                    </div>
                  ) : (
                    <>
                      {/* TAMPILAN MOBILE (md:hidden): Tidak Perlu Geser ke Kanan, Rincian di Bawahnya Rapi & Tertata */}
                      <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-800">
                        {recapData.canteen_recap.map((c) => (
                          <div key={c.canteen_id} className="p-1.5 sm:p-2 space-y-1 hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors">
                            {/* Header Toko & Total Omzet */}
                            <div className="flex items-center justify-between gap-1">
                              <div className="min-w-0">
                                <h4 className="font-bold text-gray-900 dark:text-white text-xs flex items-center gap-1 truncate leading-tight">
                                  <span>🏪 {c.canteen_name}</span>
                                  <span className="text-[9px] bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold px-1 py-0.2 rounded-none border border-blue-200 dark:border-blue-800 capitalize shrink-0">
                                    {c.category}
                                  </span>
                                </h4>
                                <span className="text-[9.5px] text-gray-400 font-medium leading-tight">
                                  {c.order_count} pesanan
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="bg-green-100 dark:bg-green-950/70 px-1.5 py-0.5 rounded-none border border-green-300 dark:border-green-800 text-green-800 dark:text-green-300 font-bold font-mono text-[10.5px]">
                                  Rp {c.grand_total.toLocaleString('id-ID')}
                                </span>
                              </div>
                            </div>

                            {/* Rincian Angka Tertata Rapi di Bawahnya (Ultra Padat & Flat) */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[10px]">
                              {/* 1. Belanja & Modal */}
                              <div className="bg-gray-50 dark:bg-gray-800/60 p-1 px-1.5 rounded-none border border-gray-200/70 dark:border-gray-700/70 flex flex-col justify-between">
                                <span className="text-[8.5px] text-gray-400 font-bold uppercase leading-none">Belanja (HPJ)</span>
                                <div className="font-mono text-gray-900 dark:text-gray-100 font-bold mt-0.5">
                                  Rp {c.total_products.toLocaleString('id-ID')}
                                </div>
                                <div className="text-[8.5px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                                  HPP: Rp {(c.total_hpp || 0).toLocaleString('id-ID')}
                                </div>
                              </div>

                              {/* 2. Laba Toko */}
                              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-1 px-1.5 rounded-none border border-emerald-200/70 dark:border-emerald-800/50 flex flex-col justify-between">
                                <span className="text-[8.5px] text-emerald-700 dark:text-emerald-400 font-bold uppercase leading-none">Laba Bersih Toko</span>
                                <div className="font-mono text-emerald-700 dark:text-emerald-300 font-black mt-0.5">
                                  {(c.total_profit || 0) >= 0 ? '+' : ''}Rp {(c.total_profit || 0).toLocaleString('id-ID')}
                                </div>
                                <span className="text-[8.5px] text-emerald-600/80 font-normal mt-0.5">100% Hak Toko</span>
                              </div>

                              {/* 3. Ongkir Kurir */}
                              <div className="bg-blue-50/70 dark:bg-blue-950/30 p-1 px-1.5 rounded-none border border-blue-200/70 dark:border-blue-800/50 flex flex-col justify-between">
                                <span className="text-[8.5px] text-blue-700 dark:text-blue-400 font-bold uppercase leading-none">Ongkir Kurir</span>
                                <div className="font-mono text-blue-700 dark:text-blue-300 font-bold mt-0.5">
                                  Rp {c.total_delivery_fee.toLocaleString('id-ID')}
                                </div>
                                <span className="text-[8.5px] text-blue-500/80 font-normal mt-0.5">Hak Kurir</span>
                              </div>

                              {/* 4. Biaya Admin */}
                              <div className="bg-purple-50/70 dark:bg-purple-950/30 p-1 px-1.5 rounded-none border border-purple-200/70 dark:border-purple-800/50 flex flex-col justify-between">
                                <span className="text-[8.5px] text-purple-700 dark:text-purple-400 font-bold uppercase leading-none">Biaya Admin</span>
                                <div className="font-mono text-purple-700 dark:text-purple-300 font-bold mt-0.5">
                                  Rp {c.total_admin_fee.toLocaleString('id-ID')}
                                </div>
                                {(c.total_courier_cut_to_admin || 0) > 0 ? (
                                  <span className="text-[8.5px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                                    +{(c.total_courier_cut_to_admin || 0).toLocaleString('id-ID')}
                                  </span>
                                ) : (
                                  <span className="text-[8.5px] text-purple-400 font-normal mt-0.5">Aplikasi</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Ringkasan Total Seluruh Toko (Mobile) */}
                        <div className="p-1.5 sm:p-2 bg-gray-50/80 dark:bg-gray-950/80 border-t-2 border-gray-300 dark:border-gray-700 space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-gray-900 dark:text-white">
                            <span>Total ({recapData.canteen_recap.length} Toko)</span>
                            <span className="text-green-700 dark:text-green-300 font-mono font-black text-xs sm:text-sm">
                              Rp {recapData.canteen_recap.reduce((sum, c) => sum + (c.grand_total || 0), 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                            <div className="bg-white dark:bg-gray-900 p-1 px-1.5 border border-gray-200 dark:border-gray-800 flex justify-between">
                              <span className="text-gray-500 font-sans">Belanja:</span>
                              <span className="font-bold text-gray-800 dark:text-gray-200">
                                Rp {recapData.canteen_recap.reduce((sum, c) => sum + (c.total_products || 0), 0).toLocaleString('id-ID')}
                              </span>
                            </div>
                            <div className="bg-white dark:bg-gray-900 p-1 px-1.5 border border-gray-200 dark:border-gray-800 flex justify-between">
                              <span className="text-gray-500 font-sans">Modal:</span>
                              <span className="font-bold text-amber-600 dark:text-amber-400">
                                Rp {recapData.canteen_recap.reduce((sum, c) => sum + (c.total_hpp || 0), 0).toLocaleString('id-ID')}
                              </span>
                            </div>
                            <div className="bg-white dark:bg-gray-900 p-1 px-1.5 border border-gray-200 dark:border-gray-800 flex justify-between">
                              <span className="text-gray-500 font-sans">Laba:</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                +Rp {recapData.canteen_recap.reduce((sum, c) => sum + (c.total_profit || 0), 0).toLocaleString('id-ID')}
                              </span>
                            </div>
                            <div className="bg-white dark:bg-gray-900 p-1 px-1.5 border border-gray-200 dark:border-gray-800 flex justify-between">
                              <span className="text-gray-500 font-sans">Ongkir:</span>
                              <span className="font-bold text-blue-600 dark:text-blue-400">
                                Rp {recapData.canteen_recap.reduce((sum, c) => sum + (c.total_delivery_fee || 0), 0).toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* TAMPILAN DESKTOP (hidden md:block): Tabel Lurus & Rata di Layar Lebar */}
                      <div className="hidden md:block overflow-x-auto no-scrollbar">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-950/60 text-[11px] font-bold text-gray-500 dark:text-gray-400">
                              <th className="py-2 px-2.5 text-left whitespace-nowrap">Toko / Kantin</th>
                              <th className="py-2 px-2 text-right whitespace-nowrap">Belanja (HPJ)</th>
                              <th className="py-2 px-2 text-right whitespace-nowrap">Modal (HPP)</th>
                              <th className="py-2 px-2 text-right whitespace-nowrap">Laba Toko</th>
                              <th className="py-2 px-2 text-right whitespace-nowrap">Ongkir</th>
                              <th className="py-2 px-2 text-right whitespace-nowrap">Biaya Admin</th>
                              <th className="py-2 px-2.5 text-right whitespace-nowrap">Total Omzet</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                            {recapData.canteen_recap.map((c) => (
                              <tr
                                key={c.canteen_id}
                                className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                              >
                                <td className="py-1.5 px-2.5 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-gray-900 dark:text-white text-xs">
                                      🏪 {c.canteen_name}
                                    </span>
                                    <span className="text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold px-1.5 py-0.2 rounded-none border border-blue-200 dark:border-blue-800 capitalize">
                                      Zona {c.category}
                                    </span>
                                    <span className="text-[11px] text-gray-400 font-medium">
                                      • {c.order_count} pesanan
                                    </span>
                                  </div>
                                </td>
                                <td className="py-1.5 px-2 text-right whitespace-nowrap font-mono text-[11px] text-gray-800 dark:text-gray-200 font-medium">
                                  Rp {c.total_products.toLocaleString('id-ID')}
                                  {(c.total_voucher_discount || 0) > 0 && (
                                    <span className="text-[9px] text-red-500 font-normal block">
                                      (-Rp {(c.total_voucher_discount || 0).toLocaleString('id-ID')})
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5 px-2 text-right whitespace-nowrap font-mono text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                  Rp {(c.total_hpp || 0).toLocaleString('id-ID')}
                                </td>
                                <td className="py-1.5 px-2 text-right whitespace-nowrap font-mono text-[11px]">
                                  <span className={`px-1.5 py-0.2 rounded-none border font-bold ${
                                    (c.total_profit || 0) >= 0 
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                                      : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60'
                                  }`}>
                                    {(c.total_profit || 0) >= 0 ? '+' : ''}Rp {(c.total_profit || 0).toLocaleString('id-ID')}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2 text-right whitespace-nowrap font-mono text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                                  Rp {c.total_delivery_fee.toLocaleString('id-ID')}
                                </td>
                                <td className="py-1.5 px-2 text-right whitespace-nowrap font-mono text-[11px]">
                                  <span className="text-purple-600 dark:text-purple-400 font-medium">
                                    Rp {c.total_admin_fee.toLocaleString('id-ID')}
                                  </span>
                                  {(c.total_courier_cut_to_admin || 0) > 0 && (
                                    <span className="text-[9px] text-amber-500 font-normal block">
                                      (+{(c.total_courier_cut_to_admin || 0).toLocaleString('id-ID')})
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5 px-2.5 text-right whitespace-nowrap font-mono text-[11px]">
                                  <span className="bg-green-100 dark:bg-green-950/70 px-1.5 py-0.5 rounded-none border border-green-300 dark:border-green-800 text-green-800 dark:text-green-300 font-bold">
                                    Rp {c.grand_total.toLocaleString('id-ID')}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t-2 border-gray-300 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-950/70 font-bold text-xs">
                            <tr>
                              <td className="py-2 px-2.5 text-gray-900 dark:text-white">
                                Total ({recapData.canteen_recap.length} Toko)
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-[11px] text-gray-900 dark:text-white">
                                Rp {recapData.canteen_recap.reduce((sum, c) => sum + (c.total_products || 0), 0).toLocaleString('id-ID')}
                                {(recapData.summary?.total_voucher_discount || 0) > 0 && (
                                  <span className="text-[9.5px] text-red-500 font-normal block">
                                    Diskon: -Rp {(recapData.summary?.total_voucher_discount || 0).toLocaleString('id-ID')}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-[11px] text-amber-600 dark:text-amber-400">
                                Rp {recapData.canteen_recap.reduce((sum, c) => sum + (c.total_hpp || 0), 0).toLocaleString('id-ID')}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                                +Rp {recapData.canteen_recap.reduce((sum, c) => sum + (c.total_profit || 0), 0).toLocaleString('id-ID')}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-[11px] text-blue-600 dark:text-blue-400">
                                Rp {recapData.canteen_recap.reduce((sum, c) => sum + (c.total_delivery_fee || 0), 0).toLocaleString('id-ID')}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-[11px] text-purple-600 dark:text-purple-400">
                                Rp {recapData.canteen_recap.reduce((sum, c) => sum + (c.total_admin_fee || 0), 0).toLocaleString('id-ID')}
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono text-[11px] text-green-700 dark:text-green-300 font-black">
                                Rp {recapData.canteen_recap.reduce((sum, c) => sum + (c.grand_total || 0), 0).toLocaleString('id-ID')}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Rekapitulasi Per Kurir */}
              <div className="bg-white dark:bg-gray-900 rounded-none shadow-xs border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="p-1.5 sm:p-2 border-b border-gray-200 dark:border-gray-800 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-green-600" />
                      Rekapitulasi Per Kurir
                    </h3>
                  </div>
                  {selectedCourierFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setSelectedCourierFilter('all')}
                      className="text-[11px] font-bold text-green-600 dark:text-green-400 hover:underline cursor-pointer"
                    >
                      Reset Filter Kurir
                    </button>
                  )}
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {!recapData?.courier_recap || recapData.courier_recap.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-xs">
                      Belum ada data kurir pada periode <strong>{getFilterLabel()}</strong>.
                    </div>
                  ) : (
                    recapData.courier_recap.map((cr) => (
                      <div
                        key={cr.courier_id}
                        className={`p-1.5 sm:p-2 flex flex-col md:flex-row md:items-center justify-between gap-1 hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors ${
                          String(selectedCourierFilter) === String(cr.courier_id) ||
                          (selectedCourierFilter === 'unassigned' && cr.is_unassigned)
                            ? 'bg-green-50/60 dark:bg-green-950/30 border-l-4 border-green-500'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm flex items-center gap-1">
                            {cr.is_unassigned ? '🚫' : '🛵'} {cr.courier_name}
                          </h4>
                          {cr.is_unassigned && (
                            <span className="text-[9.5px] bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold px-1.5 py-0.2 rounded-none border border-amber-200 dark:border-amber-800">
                              Antar Sendiri
                            </span>
                          )}
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                            • {cr.order_count} Pesanan Diantar
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap text-xs font-semibold">
                          <span className="bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-none border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 text-[10.5px]">
                            Ongkir: Rp {(cr.total_delivery_fee || 0).toLocaleString('id-ID')}
                          </span>
                          {(cr.subsidized_delivery_discount || 0) > 0 && (
                            <span className="bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-none border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-[10.5px] font-bold">
                              Subsidi: +Rp {(cr.subsidized_delivery_discount || 0).toLocaleString('id-ID')}
                            </span>
                          )}
                          {(cr.total_courier_cut_to_admin || 0) > 0 && (
                            <span className="bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-none border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300 text-[10.5px]">
                              Admin: -Rp {(cr.total_courier_cut_to_admin || 0).toLocaleString('id-ID')}
                            </span>
                          )}
                          <span className="bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-none border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 font-bold text-[10.5px]">
                            Bersih: Rp {(cr.net_delivery_fee || 0).toLocaleString('id-ID')}
                          </span>
                          <span className="bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded-none border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-[10.5px] ml-auto md:ml-0 font-mono">
                            Belanja: Rp {(cr.grand_total || 0).toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Rekapitulasi Per Santri / Wali */}
              <div className="bg-white dark:bg-gray-900 rounded-none shadow-xs border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="p-1.5 sm:p-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <h3 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">Rekapitulasi Per Wali / Santri</h3>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-800 max-h-96 overflow-y-auto">
                  {!recapData?.user_recap || recapData.user_recap.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-xs">
                      Belum ada transaksi pada periode <strong>{getFilterLabel()}</strong>.
                    </div>
                  ) : (
                    recapData.user_recap.map((u) => (
                      <div
                        key={u.user_id}
                        className="p-1.5 sm:p-2 flex flex-col md:flex-row md:items-center justify-between gap-1 hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">{u.santri_name}</h4>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400">
                            Wali: {u.wali_name} {u.santri_room ? `• ${u.santri_room}` : ''} ({u.order_count} pesanan)
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap text-xs font-semibold">
                          <span className="bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded-none border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-[10.5px] font-mono">
                            Produk: Rp {u.total_products.toLocaleString('id-ID')}
                          </span>
                          {(u.total_voucher_discount || 0) > 0 && (
                            <span className="bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-none border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 text-[10.5px] font-bold font-mono">
                              Diskon: -Rp {(u.total_voucher_discount || 0).toLocaleString('id-ID')}
                            </span>
                          )}
                          <span className="bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-none border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 text-[10.5px] font-mono">
                            Ongkir: Rp {u.total_delivery_fee.toLocaleString('id-ID')}
                          </span>
                          <span className="bg-purple-50 dark:bg-purple-950/30 px-1.5 py-0.5 rounded-none border border-purple-200 dark:border-purple-800/50 text-purple-700 dark:text-purple-300 text-[10.5px] font-mono">
                            Admin: Rp {u.total_admin_fee.toLocaleString('id-ID')}
                          </span>
                          <span className="bg-green-100 dark:bg-green-950/60 px-1.5 py-0.5 rounded-none border border-green-300 dark:border-green-800 text-green-800 dark:text-green-300 font-bold text-[10.5px] ml-auto md:ml-0 font-mono">
                            Total: Rp {u.grand_total.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Rekapitulasi Produk Terjual */}
              <div className="bg-white dark:bg-gray-900 rounded-none shadow-xs border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="p-1.5 sm:p-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <h3 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">Rekapitulasi Kuantitas & Laba Produk Terjual</h3>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-800 max-h-96 overflow-y-auto">
                  {!recapData?.product_breakdown || recapData.product_breakdown.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-xs">
                      Belum ada produk terjual pada periode <strong>{getFilterLabel()}</strong>.
                    </div>
                  ) : (
                    recapData.product_breakdown.map((p) => (
                      <div key={p.product_id} className="p-1.5 sm:p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">{p.name}</span>
                            {p.is_custom && (
                              <span className="text-[10px] bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-1.5 py-0.2 rounded-none border border-purple-200 dark:border-purple-800 font-bold">
                                Titip Beli
                              </span>
                            )}
                            {p.canteen_name && (
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold bg-gray-100 dark:bg-gray-800 px-1.5 py-0.2 rounded-none border border-gray-200 dark:border-gray-700">
                                {p.canteen_name}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                            <span>HPJ: <strong className="text-gray-700 dark:text-gray-300">Rp {(p.hpj || 0).toLocaleString('id-ID')}</strong></span>
                            <span>•</span>
                            <span>HPP: <strong className="text-amber-700 dark:text-amber-400">Rp {(p.hpp || 1000).toLocaleString('id-ID')}</strong></span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/60 px-1.5 py-0.5 rounded-none text-[11px]">
                            {p.total_quantity}x terjual
                          </span>
                          <span className="bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded-none text-[11px] font-semibold">
                            Subtotal: Rp {p.total_subtotal.toLocaleString('id-ID')}
                          </span>
                          <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-1.5 py-0.5 rounded-none text-[11px] font-bold">
                            Laba: +Rp {(p.total_profit || 0).toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Rekapitulasi Audit Voucher & Promo (Beban Subsidi Kas Admin) */}
              <div className="bg-white dark:bg-gray-900 rounded-none shadow-xs border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="p-1.5 sm:p-2 border-b border-gray-200 dark:border-gray-800 bg-rose-50/50 dark:bg-rose-950/20 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm flex items-center gap-1.5">
                    <Ticket className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    Audit Beban Subsidi Voucher (Kas Admin)
                  </h3>
                  <span className="text-[9.5px] sm:text-[10px] text-rose-700 dark:text-rose-300 font-bold font-mono">
                    Total: -Rp {(recapData?.summary?.total_voucher_discount || 0).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-800 max-h-80 overflow-y-auto">
                  {!recapData?.voucher_breakdown || recapData.voucher_breakdown.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-xs">
                      Tidak ada voucher yang digunakan pada periode <strong>{getFilterLabel()}</strong>.
                    </div>
                  ) : (
                    recapData.voucher_breakdown.map((vb, idx) => (
                      <div key={idx} className="p-1.5 sm:p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-gray-900 dark:text-white text-xs">
                              Order #{vb.order_id}
                            </span>
                            <span className="bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 px-1.5 py-0.2 rounded-none font-bold font-mono text-[10px]">
                              🏷️ {vb.voucher_code}
                            </span>
                            <span className="text-[10.5px] text-gray-700 dark:text-gray-300 font-medium">
                              {vb.santri_name} {vb.santri_room ? `(${vb.santri_room})` : ''}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              • 🏪 {vb.canteen_name}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                            Jenis Subsidi: <span className="capitalize font-semibold text-gray-700 dark:text-gray-300">{vb.discount_type === 'delivery_fee' ? 'Gratis / Diskon Ongkir' : vb.discount_type}</span>
                            {vb.order_date && ` • ${vb.order_date}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800 px-2 py-0.5 rounded-none font-mono font-bold text-xs">
                            -Rp {(vb.discount_amount || 0).toLocaleString('id-ID')}
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
      )}

      {/* TAB 3: KOTAK SAMPAH / RECYCLE BIN */}
      {activeTab === 'trash' && (
        <div className="space-y-2 animate-fade-in-up">
          {/* Header Notice Card */}
          <div className="bg-white dark:bg-gray-900 p-2.5 sm:p-3 rounded-none border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.2 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold uppercase tracking-wider rounded-none">
                  Recycle Bin
                </span>
                <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Kotak Sampah ({trashedOrders.length} Pesanan)
                </h3>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                Pesanan yang dihapus sementara tersimpan di sini. Anda dapat memulihkannya kapan saja atau menghapusnya secara permanen.
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => refetchTrash()}
                className="px-2.5 py-1 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 font-bold text-xs rounded-none flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingTrash ? 'animate-spin' : ''}`} /> Refresh
              </button>

              {trashedOrders.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowEmptyTrashModal(true)}
                  disabled={emptyTrashMutation.isPending}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-none flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Kosongkan Sampah
                </button>
              )}
            </div>
          </div>

          {/* Trashed Orders List */}
          {isLoadingTrash ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
              <LoadingSpinner 
                text="Memuat Kotak Sampah..." 
                subtext="Mengambil arsip pesanan yang dibatalkan/dihapus" 
                minHeight="min-h-[160px]"
              />
            </div>
          ) : trashedOrders.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-none p-10 text-center border border-gray-200 dark:border-gray-800 shadow-xs space-y-2">
              <div className="w-12 h-12 rounded-none bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-gray-400 flex items-center justify-center mx-auto mb-2">
                <Trash2 className="w-5 h-5 text-gray-400" />
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200">Kotak Sampah Bersih</h4>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Tidak ada pesanan yang tersimpan di dalam kotak sampah saat ini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {trashedOrders.map((order) => {
                const deletedDate = order.deleted_at 
                  ? new Date(order.deleted_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) 
                  : '-';

                return (
                  <div
                    key={order.id}
                    className="bg-white dark:bg-gray-900 rounded-none p-3 border border-amber-200 dark:border-amber-950/60 shadow-xs space-y-2.5 relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs sm:text-sm text-gray-900 dark:text-white">
                            Pesanan #{order.id}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-none bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            Di Kotak Sampah
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-0.5">
                          🏪 {order.canteen?.name || 'Toko / Kantin'}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="font-extrabold text-xs sm:text-sm text-gray-900 dark:text-white">
                          Rp {parseFloat(order.total_price || 0).toLocaleString('id-ID')}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {order.payment_status === 'paid' ? '💳 Lunas' : '⚠️ Belum Lunas'}
                        </div>
                      </div>
                    </div>

                    {/* Customer & Item details */}
                    <div className="bg-gray-50 dark:bg-gray-800/60 p-2 rounded-none text-xs space-y-1 border border-gray-100 dark:border-gray-800">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Pemesan / Santri:</span>
                        <strong className="text-gray-800 dark:text-gray-200">
                          {order.user?.santri_name || order.user?.name || 'Santri'}
                        </strong>
                      </div>
                      {order.user?.santri_room && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-gray-500">Asrama / Kamar:</span>
                          <span className="text-gray-700 dark:text-gray-300">{order.user.santri_room}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-[11px] pt-1 border-t border-gray-200/60 dark:border-gray-700/60">
                        <span className="text-gray-500">Waktu Dihapus:</span>
                        <span className="text-amber-700 dark:text-amber-300 font-medium">🕒 {deletedDate}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 pt-1 border-t border-gray-200 dark:border-gray-800">
                      <button
                        type="button"
                        onClick={() => restoreOrderMutation.mutate(order.id)}
                        disabled={restoreOrderMutation.isPending}
                        className="flex-1 py-1.5 px-2.5 bg-green-50 hover:bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 font-bold text-xs rounded-none flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Pulihkan (Restore)
                      </button>

                      <button
                        type="button"
                        onClick={() => setOrderToForceDelete(order)}
                        className="py-1.5 px-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 font-bold text-xs rounded-none flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Hapus Permanen"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Permanen
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL KONFIRMASI PINDAHKAN KE SAMPAH (SOFT DELETE) */}
      {orderToDelete && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none max-w-md w-full p-3.5 sm:p-4 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-3 animate-in zoom-in-95 duration-150 my-auto">
            <div className="w-9 h-9 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-none flex items-center justify-center mx-auto border border-amber-300 dark:border-amber-800">
              <Trash2 className="w-4 h-4" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Pindahkan ke Kotak Sampah?</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Pesanan <strong>#{orderToDelete.id}</strong> atas nama{' '}
                <strong className="text-gray-800 dark:text-gray-200">
                  {orderToDelete.user?.santri_name || orderToDelete.user?.name}
                </strong>{' '}
                dari toko{' '}
                <strong className="text-gray-800 dark:text-gray-200">{orderToDelete.canteen?.name}</strong> senilai{' '}
                <strong className="text-green-600 font-mono">
                  Rp {parseFloat(orderToDelete.total_price || 0).toLocaleString('id-ID')}
                </strong>{' '}
                akan dipindahkan ke <strong>Kotak Sampah (Recycle Bin)</strong>.
              </p>
              <p className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded-none border border-amber-200 dark:border-amber-800 text-left">
                💡 Pesanan tidak akan muncul di daftar aktif atau rekap, namun dapat Anda <strong>pulihkan (restore)</strong> kapan saja.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                disabled={deleteOrderMutation.isPending}
                className="flex-1 py-1.5 rounded-none font-bold text-xs text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteOrderMutation.isPending}
                className="flex-1 py-1.5 rounded-none font-bold text-xs text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              >
                {deleteOrderMutation.isPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Memindahkan...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" /> Pindahkan ke Sampah
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL KONFIRMASI HAPUS PERMANEN (FORCE DELETE) */}
      {orderToForceDelete && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none max-w-md w-full p-3.5 sm:p-4 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-3 animate-in zoom-in-95 duration-150 my-auto">
            <div className="w-9 h-9 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-none flex items-center justify-center mx-auto border border-red-300 dark:border-red-800">
              <AlertTriangle className="w-4 h-4" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Hapus Permanen Pesanan #{orderToForceDelete.id}?</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Tindakan ini akan <strong>menghapus permanen</strong> data pesanan dan seluruh berkas bukti transfer/foto dari server. Tindakan ini <strong>tidak dapat dibatalkan</strong>.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOrderToForceDelete(null)}
                disabled={forceDeleteMutation.isPending}
                className="flex-1 py-1.5 rounded-none font-bold text-xs text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => forceDeleteMutation.mutate(orderToForceDelete.id)}
                disabled={forceDeleteMutation.isPending}
                className="flex-1 py-1.5 rounded-none font-bold text-xs text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              >
                {forceDeleteMutation.isPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" /> Ya, Hapus Permanen
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL KONFIRMASI KOSONGKAN SELURUH KOTAK SAMPAH */}
      {showEmptyTrashModal && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none max-w-md w-full p-3.5 sm:p-4 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-3 animate-in zoom-in-95 duration-150 my-auto">
            <div className="w-9 h-9 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-none flex items-center justify-center mx-auto border border-red-300 dark:border-red-800">
              <AlertTriangle className="w-4 h-4" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Kosongkan Kotak Sampah?</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Seluruh <strong>{trashedOrders.length} pesanan</strong> di dalam kotak sampah akan dihapus secara permanen beserta berkas buktinya. Tindakan ini <strong>tidak dapat dibatalkan</strong>.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowEmptyTrashModal(false)}
                disabled={emptyTrashMutation.isPending}
                className="flex-1 py-1.5 rounded-none font-bold text-xs text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => emptyTrashMutation.mutate()}
                disabled={emptyTrashMutation.isPending}
                className="flex-1 py-1.5 rounded-none font-bold text-xs text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              >
                {emptyTrashMutation.isPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Mengosongkan...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" /> Ya, Kosongkan Semua
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL VIEWER GAMBAR / BUKTI */}
      {selectedProofs.length > 0 && createPortal(
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-xs flex flex-col animate-in fade-in duration-200">
          <div className="flex justify-between items-center px-3 py-2 bg-black/80 border-b border-white/10 shrink-0">
            <span className="text-white font-bold text-xs flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-green-400" />
              {selectedProofs.length} Foto / Berkas Bukti
            </span>
            <button
              onClick={() => setSelectedProofs([])}
              className="w-7 h-7 bg-white/10 rounded-none flex items-center justify-center text-white hover:bg-white/20 transition-all border border-white/20 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col items-center gap-3 pb-8">
            {selectedProofs.map((proof, idx) => {
              const fileType = getFileType(proof);
              const fileName = getFileNameFromPath(proof);

              return (
                <div key={idx} className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-none p-2 flex flex-col items-center gap-1.5">
                  <div className="w-full flex items-center justify-between px-1 text-xs text-gray-400">
                    <span className="font-medium text-[11px]">Bukti {idx + 1} dari {selectedProofs.length}</span>
                    <a 
                      href={proof} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-green-400 hover:text-green-300 flex items-center gap-1 text-[11px]"
                    >
                      Buka Resolusi Penuh <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <img
                    src={proof}
                    alt={`Bukti ${idx + 1}`}
                    className="w-full rounded-none object-contain max-h-[75vh] bg-black/40 border border-gray-800"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div
                    style={{ display: 'none' }}
                    className="w-full h-40 rounded-none bg-gray-800 border border-gray-700 flex flex-col items-center justify-center text-gray-400 text-sm gap-2"
                  >
                    <FileText className="w-8 h-8 opacity-40 text-green-400" />
                    <span className="text-xs">Pratinjau langsung tidak tersedia untuk format ini</span>
                    <a href={proof} target="_blank" rel="noreferrer" className="text-green-400 text-xs underline break-all px-4 text-center">Buka Berkas ({fileName})</a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}

      {/* MODAL KONFIRMASI BATALKAN PESANAN */}
      {orderToCancel && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none max-w-md w-full p-3.5 sm:p-4 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-3 animate-in zoom-in-95 duration-150 my-auto">
            <div className="w-9 h-9 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-none flex items-center justify-center mx-auto border border-red-300 dark:border-red-800">
              <AlertTriangle className="w-4 h-4" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Batalkan Pesanan #{orderToCancel.id}?
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                {orderToCancel.status === 'completed' ? (
                  <>
                    Pesanan ini <strong>sudah diselesaikan oleh kurir</strong>. Membatalkannya akan mengubah status menjadi <span className="text-red-600 font-bold">Dibatalkan</span> dan mengembalikan stok produk.
                  </>
                ) : (
                  <>
                    Status pesanan <strong>#{orderToCancel.id}</strong> ({orderToCancel.canteen?.name}) milik <strong>{orderToCancel.user?.santri_name || orderToCancel.user?.name}</strong> akan diubah menjadi <span className="text-red-600 font-bold">Dibatalkan</span>.
                  </>
                )}
              </p>
            </div>

            {/* Input Alasan Pembatalan */}
            <div className="space-y-1 text-left">
              <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                Alasan Pembatalan (Opsional):
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Contoh: Kesalahan input kurir, salah tujuan, dll."
                className="w-full px-2.5 py-1.5 rounded-none border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-red-500 focus:outline-hidden"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOrderToCancel(null);
                  setCancelReason('');
                }}
                disabled={cancelOrderMutation.isPending}
                className="flex-1 py-1.5 rounded-none font-bold text-xs text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={() => cancelOrderMutation.mutate({ id: orderToCancel.id, reason: cancelReason })}
                disabled={cancelOrderMutation.isPending}
                className="flex-1 py-1.5 rounded-none font-bold text-xs text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              >
                {cancelOrderMutation.isPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Membatalkan...
                  </>
                ) : (
                  <>
                    <X className="w-3.5 h-3.5" /> Ya, Batalkan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL UBAH STATUS PESANAN & PEMBAYARAN */}
      {orderToChangeStatus && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none max-w-md w-full p-3.5 sm:p-4 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-2.5 animate-in zoom-in-95 duration-150 my-auto">
            <div className="w-9 h-9 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-none flex items-center justify-center mx-auto border border-green-300 dark:border-green-800">
              <RotateCcw className="w-4 h-4" />
            </div>

            <div className="text-center space-y-0.5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Ubah Status Pesanan #{orderToChangeStatus.id}
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                {orderToChangeStatus.canteen?.name} • {orderToChangeStatus.user?.santri_name || orderToChangeStatus.user?.name}
              </p>
            </div>

            {/* Kotak Ringkasan Status Saat Ini */}
            <div className="bg-gray-50 dark:bg-gray-800/80 p-2 rounded-none border border-gray-200 dark:border-gray-700/60 flex items-center justify-between text-xs">
              <div>
                <span className="text-gray-400 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Status Saat Ini:</span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-none font-bold text-[10px] ${
                  orderToChangeStatus.status === 'completed'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                    : orderToChangeStatus.status === 'processing'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                    : orderToChangeStatus.status === 'cancelled'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                    : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {orderToChangeStatus.status === 'completed'
                    ? '✅ Selesai'
                    : orderToChangeStatus.status === 'processing'
                    ? '🚚 Sedang Diproses'
                    : orderToChangeStatus.status === 'cancelled'
                    ? '❌ Dibatalkan'
                    : '⏳ Pending'}
                </span>
              </div>

              <div className="text-right">
                <span className="text-gray-400 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Pembayaran:</span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-none font-bold text-[10px] ${
                  orderToChangeStatus.payment_status === 'paid'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                    : orderToChangeStatus.payment_status === 'waiting_confirmation'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                }`}>
                  {orderToChangeStatus.payment_status === 'paid'
                    ? '💳 Lunas'
                    : orderToChangeStatus.payment_status === 'waiting_confirmation'
                    ? '⏳ Menunggu Validasi'
                    : '⚠️ Belum Bayar'}
                </span>
              </div>
            </div>

            {/* 1. Dropdown Status Pesanan */}
            <div className="space-y-1 text-left">
              <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>Pilih Status Pesanan:</span>
                <span className="text-[10px] font-normal text-gray-400">Default: status saat ini</span>
              </label>
              <select
                value={selectedNewStatus}
                onChange={(e) => setSelectedNewStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-none border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-semibold focus:ring-1 focus:ring-green-500 focus:outline-hidden"
              >
                <option value="pending">⏳ Belum Dikonfirmasi (Pending / Menunggu)</option>
                <option value="processing">🚚 Sedang Diproses / Diantar (Processing)</option>
                <option value="completed">✅ Selesai (Completed)</option>
                <option value="cancelled">❌ Dibatalkan (Cancelled)</option>
              </select>
            </div>

            {/* 2. Dropdown Status Pembayaran */}
            <div className="space-y-1 text-left">
              <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>Pilih Status Pembayaran:</span>
                <span className="text-[10px] font-normal text-gray-400">Default: status bayar saat ini</span>
              </label>
              <select
                value={selectedNewPaymentStatus}
                onChange={(e) => setSelectedNewPaymentStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-none border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-semibold focus:ring-1 focus:ring-green-500 focus:outline-hidden"
              >
                <option value="unpaid">⚠️ Belum Bayar (Unpaid)</option>
                <option value="waiting_confirmation">⏳ Menunggu Validasi (Waiting Confirmation)</option>
                <option value="paid">💳 Sudah Bayar / Lunas (Paid)</option>
              </select>
            </div>

            {/* Courier info / assignment box if status is processing */}
            {selectedNewStatus === 'processing' && (
              <div className="pt-0.5">
                {orderToChangeStatus.canteen?.couriers && orderToChangeStatus.canteen.couriers.length > 0 ? (
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-left text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                      <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Kurir Toko ({orderToChangeStatus.canteen?.name}):</span>
                    </div>
                    {orderToChangeStatus.canteen.couriers.length === 1 ? (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        Pesanan otomatis akan diterima oleh kurir <strong>{orderToChangeStatus.canteen.couriers[0].name}</strong>.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-[10px] text-emerald-700 dark:text-emerald-300 block">Pilih Kurir Toko:</label>
                        <select
                          value={selectedNewCourierId || orderToChangeStatus.canteen.couriers[0]?.id}
                          onChange={(e) => setSelectedNewCourierId(e.target.value)}
                          className="w-full px-2 py-1 rounded-none border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-900 dark:text-white"
                        >
                          {orderToChangeStatus.canteen.couriers.map((k) => (
                            <option key={k.id} value={k.id}>🛵 {k.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-left text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Toko Belum Ada Kurirnya!</span>
                    </div>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
                      Toko <strong>{orderToChangeStatus.canteen?.name}</strong> belum memiliki kurir yang ditugaskan. Pesanan tidak dapat dilanjutkan sebelum ada kurir di toko ini.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 3. Pilihan Jadwal / Tanggal Pesanan Dilanjutkan */}
            <div className="space-y-1.5 text-left border-t border-gray-100 dark:border-gray-800 pt-2">
              <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  Jadwalkan / Tanggal Pesanan:
                </span>
                <span className="text-[9.5px] text-gray-400 font-mono">
                  {orderToChangeStatus.created_at ? new Date(orderToChangeStatus.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : ''}
                </span>
              </label>

              <div className="grid grid-cols-4 gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedOrderDateMode('keep')}
                  className={`py-1 px-1 text-[10px] font-bold border rounded-none transition-colors cursor-pointer ${
                    selectedOrderDateMode === 'keep'
                      ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900 border-gray-800 dark:border-gray-200'
                      : 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Asli
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrderDateMode('today')}
                  className={`py-1 px-1 text-[10px] font-bold border rounded-none transition-colors flex items-center justify-center gap-0.5 cursor-pointer ${
                    selectedOrderDateMode === 'today'
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border-green-200 dark:border-green-800 hover:bg-green-100'
                  }`}
                >
                  ⚡ Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrderDateMode('tomorrow')}
                  className={`py-1 px-1 text-[10px] font-bold border rounded-none transition-colors flex items-center justify-center gap-0.5 cursor-pointer ${
                    selectedOrderDateMode === 'tomorrow'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                  }`}
                >
                  ☀️ Besok
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrderDateMode('custom')}
                  className={`py-1 px-1 text-[10px] font-bold border rounded-none transition-colors flex items-center justify-center gap-0.5 cursor-pointer ${
                    selectedOrderDateMode === 'custom'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100'
                  }`}
                >
                  📅 Lainnya
                </button>
              </div>

              {selectedOrderDateMode === 'custom' && (
                <div className="pt-1">
                  <input
                    type="date"
                    value={selectedOrderCustomDate}
                    onChange={(e) => setSelectedOrderCustomDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-none border border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/30 text-gray-900 dark:text-white text-xs font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <p className="text-[9.5px] text-blue-600 dark:text-blue-400 mt-0.5">
                    Pilih tanggal kapan pesanan ini ingin dilanjutkan dan masuk ke rekap.
                  </p>
                </div>
              )}

              {selectedOrderDateMode === 'tomorrow' && (
                <p className="text-[9.5px] text-amber-700 dark:text-amber-400">
                  Pesanan akan dijadwalkan untuk <strong>Besok</strong> ({(() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
                  })()}) dan masuk antrean besok.
                </p>
              )}

              {selectedOrderDateMode === 'today' && (
                <p className="text-[9.5px] text-green-700 dark:text-green-400">
                  Pesanan akan dipindahkan ke <strong>Hari Ini</strong> ({new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}).
                </p>
              )}
            </div>

            {/* Shortcut Unggah Bukti Bayar */}
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => {
                  const targetOrder = orderToChangeStatus;
                  setOrderToChangeStatus(null);
                  handleOpenUploadPaymentModal(targetOrder);
                }}
                className="w-full py-1.5 px-2 bg-green-50 hover:bg-green-100 dark:bg-green-950/40 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-none text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                <span>Unggah / Tambah Bukti Transfer</span>
              </button>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOrderToChangeStatus(null)}
                disabled={updateStatusMutation.isPending}
                className="flex-1 py-1.5 rounded-none font-bold text-xs text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedNewStatus === 'processing') {
                    const couriers = orderToChangeStatus.canteen?.couriers || [];
                    if (couriers.length === 0) {
                      toast.error(`Toko "${orderToChangeStatus.canteen?.name || 'ini'}" belum ada kurirnya. Silakan tugaskan kurir ke toko ini terlebih dahulu.`);
                      return;
                    }
                  }

                  let targetDateVal = undefined;
                  if (selectedOrderDateMode === 'today') {
                    const d = new Date();
                    targetDateVal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  } else if (selectedOrderDateMode === 'tomorrow') {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    targetDateVal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  } else if (selectedOrderDateMode === 'custom' && selectedOrderCustomDate) {
                    targetDateVal = selectedOrderCustomDate;
                  }

                  updateStatusMutation.mutate({
                    id: orderToChangeStatus.id,
                    status: selectedNewStatus,
                    payment_status: selectedNewPaymentStatus,
                    courier_id: selectedNewCourierId ? parseInt(selectedNewCourierId) : undefined,
                    target_date: targetDateVal
                  });
                }}
                disabled={updateStatusMutation.isPending}
                className="flex-1 py-1.5 rounded-none font-bold text-xs text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              >
                {updateStatusMutation.isPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" /> Simpan Perubahan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL UNGGAH BUKTI PEMBAYARAN OLEH ADMIN */}
      {orderToUploadProof && createPortal(
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
                    Unggah Bukti Bayar
                  </h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    Pesanan #{orderToUploadProof.id} • {orderToUploadProof.canteen?.name || 'Toko'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOrderToUploadProof(null);
                  setProofFiles([]);
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
                  {orderToUploadProof.user?.santri_name || orderToUploadProof.user?.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400 text-[11px]">Kamar / Lokasi:</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300 text-[11px]">
                  {orderToUploadProof.user?.santri_room || orderToUploadProof.delivery_location || '-'}
                </span>
              </div>
              <div className="pt-1.5 border-t border-gray-200 dark:border-gray-700/60 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Total Tagihan:</span>
                <span className="text-sm font-black text-green-600 dark:text-green-400 font-mono">
                  Rp {parseFloat(orderToUploadProof.total_price || 0).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Bukti Yang Sudah Ada (Jika Ada) */}
            {orderToUploadProof.proof_of_payment && orderToUploadProof.proof_of_payment.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-gray-700 dark:text-gray-300">
                  <span>Bukti Tersimpan ({orderToUploadProof.proof_of_payment.length}):</span>
                  <span className="text-[9px] text-gray-400 font-normal">Klik tombol hapus untuk membatalkan</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {(Array.isArray(orderToUploadProof.proof_of_payment) 
                    ? orderToUploadProof.proof_of_payment 
                    : [orderToUploadProof.proof_of_payment]
                  ).map((p, pIdx) => (
                    <div key={pIdx} className="relative group shrink-0 w-14 h-14 rounded-none overflow-hidden border border-gray-200 dark:border-gray-700 bg-black/10">
                      <img src={getStorageUrl(p)} alt="Bukti" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Hapus berkas bukti ini?')) {
                            deleteProofMutation.mutate({
                              id: orderToUploadProof.id,
                              type: 'proof_of_payment',
                              path: p
                            });
                          }
                        }}
                        disabled={deleteProofMutation.isPending}
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
                ref={proofFileInputRef}
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => handleProofFilesSelected(e.target.files)}
              />
              <input
                type="file"
                ref={proofCameraInputRef}
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleProofFilesSelected(e.target.files)}
              />

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={isCompressingProof || uploadPaymentProofMutation.isPending}
                  onClick={() => proofCameraInputRef.current?.click()}
                  className="py-2 px-2 bg-gray-50 hover:bg-green-50/80 dark:bg-gray-800/80 dark:hover:bg-green-950/40 border border-gray-200 dark:border-gray-700 hover:border-green-400 rounded-none text-gray-700 dark:text-gray-200 flex flex-col items-center justify-center gap-1 transition-all text-xs font-bold cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span>Ambil Foto</span>
                </button>

                <button
                  type="button"
                  disabled={isCompressingProof || uploadPaymentProofMutation.isPending}
                  onClick={() => proofFileInputRef.current?.click()}
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
            {proofFiles.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                  Berkas Terpilih ({proofFiles.length}):
                </span>
                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {proofFiles.map((file, fIdx) => {
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
                          onClick={() => setProofFiles((prev) => prev.filter((_, i) => i !== fIdx))}
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
                  onClick={() => setUploadPaymentStatus('paid')}
                  className={`p-1.5 rounded-none border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    uploadPaymentStatus === 'paid'
                      ? 'bg-green-50 dark:bg-green-950/60 border-green-500 text-green-700 dark:text-green-300 ring-1 ring-green-500'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                  <span>Langsung Lunas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUploadPaymentStatus('waiting_confirmation')}
                  className={`p-1.5 rounded-none border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    uploadPaymentStatus === 'waiting_confirmation'
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
                  setOrderToUploadProof(null);
                  setProofFiles([]);
                }}
                disabled={uploadPaymentProofMutation.isPending || isCompressingProof}
                className="flex-1 py-1.5 rounded-none font-bold text-xs text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={proofFiles.length === 0 || uploadPaymentProofMutation.isPending || isCompressingProof}
                onClick={() => {
                  const formData = new FormData();
                  proofFiles.forEach((file) => {
                    formData.append('proof_of_payment[]', file);
                  });
                  formData.append('payment_status', uploadPaymentStatus);
                  uploadPaymentProofMutation.mutate({
                    id: orderToUploadProof.id,
                    formData
                  });
                }}
                className="flex-1 py-1.5 rounded-none font-bold text-xs text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                {uploadPaymentProofMutation.isPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Mengunggah...</span>
                  </>
                ) : isCompressingProof ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Mengompresi...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Unggah ({proofFiles.length}) Bukti</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL CETAK STRUK THERMAL IWARE UNTUK ADMIN */}
      <ThermalReceiptModal
        isOpen={receiptModalConfig.isOpen}
        onClose={() => setReceiptModalConfig(prev => ({ ...prev, isOpen: false }))}
        mode={receiptModalConfig.mode}
        order={receiptModalConfig.order}
        orders={receiptModalConfig.orders}
        courierName={receiptModalConfig.order?.courier?.name || 'Administrator'}
        title={receiptModalConfig.title}
      />
    </div>
  );
}
