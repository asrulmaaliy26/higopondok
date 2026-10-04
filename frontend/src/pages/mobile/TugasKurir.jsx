import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Package, Camera, CheckCircle, Upload, X, MessageCircle, Trash2, 
  FileText, Image as ImageIcon, Search, Store, User, MapPin, 
  ChevronDown, ChevronRight, Layers, Clock, Truck, RefreshCw, 
  Phone, CheckSquare, AlertCircle, ShoppingBag, Filter, Calendar,
  Download, ExternalLink, Printer
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getStorageUrl } from '../../lib/axios';
import { useAuthStore } from '../../store/authStore';
import santriData from '../../data/santri.json';
import { getFileType, isImageFile, isHeifFile, isPdfFile, formatFileSize, getFileNameFromPath, compressImageFiles } from '../../lib/fileUtils';
import ThermalReceiptModal from '../../components/receipt/ThermalReceiptModal';

function getSantriGender(santriName = '', santriRoom = '') {
  const sName = (santriName || '').toLowerCase().trim();
  const sRoom = (santriRoom || '').toLowerCase().trim();

  // 1. Match against santri.json if exists
  if (sName && santriData?.data) {
    const match = santriData.data.find(r => {
      if (!r || !r[1]) return false;
      const rawName = r[1].toLowerCase().replace(/\s+(laki-laki|perempuan)$/i, '').trim();
      return rawName === sName || sName.includes(rawName) || rawName.includes(sName);
    });

    if (match && match[1]) {
      if (match[1].toLowerCase().includes('perempuan')) return 'putri';
      if (match[1].toLowerCase().includes('laki-laki')) return 'putra';
    }
  }

  // 2. Check room / dormitory name
  if (sRoom.includes('asmah') || sRoom.includes('aminah') || sRoom.includes('putri') || sRoom.includes('akhwat') || sRoom.includes('khadijah') || sRoom.includes('fatimah') || sRoom.includes('aisyah')) {
    return 'putri';
  }
  if (sRoom.includes('majid') || sRoom.includes('malik') || sRoom.includes('putra') || sRoom.includes('ikhwan') || sRoom.includes('mannan') || sRoom.includes('ali') || sRoom.includes('umar') || sRoom.includes('utsman')) {
    return 'putra';
  }

  // 3. Heuristics
  if (/\b(binti|putri|siti|shofiya|nida|zahra|khadijah|aisyah|nurul|dewi|ayu|anisa|annisa|fatimah|salma|nayla)\b/i.test(sName)) {
    return 'putri';
  }

  return 'putra';
}

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

const formatRupiah = (val) => {
  const num = Math.round(Number(val) || 0);
  return num.toLocaleString('id-ID');
};

// Helper Modal Belanja (HPP) satuan per item
export const getItemModalHpp = (item) => {
  if (item.hpp !== undefined && item.hpp !== null && parseFloat(item.hpp) > 0) {
    return parseFloat(item.hpp);
  }
  const rawProductHpp = item.product?.hpp;
  if (rawProductHpp !== undefined && rawProductHpp !== null && parseFloat(rawProductHpp) > 0) {
    return parseFloat(rawProductHpp);
  }
  const price = parseFloat(item.price || 0);
  return price > 1000 ? (price - 1000) : price;
};

// Helper Total Modal Belanja (HPP * qty) per baris item
export const getItemModalTotalHpp = (item) => {
  if (item.total_hpp !== undefined && item.total_hpp !== null && parseFloat(item.total_hpp) > 0) {
    return parseFloat(item.total_hpp);
  }
  const qty = parseInt(item.quantity || 1, 10);
  return getItemModalHpp(item) * qty;
};

// Helper Total Modal Belanja (HPP) per pesanan untuk dibelanjakan kurir di kasir toko
export const getOrderModalBelanja = (order) => {
  if (order.hpp !== undefined && order.hpp !== null && parseFloat(order.hpp) > 0) {
    return parseFloat(order.hpp);
  }
  if (order.items && order.items.length > 0) {
    return order.items.reduce((sum, it) => sum + getItemModalTotalHpp(it), 0);
  }
  const deliveryFee = parseFloat(order.delivery_fee || 0);
  const adminFee = parseFloat(order.admin_fee || 0);
  const subtotal = Math.max(0, parseFloat(order.total_price || 0) - deliveryFee - adminFee);
  return subtotal > 1000 ? (subtotal - 1000) : subtotal;
};

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

const rollbackCaches = (queryClient, context) => {
  if (context?.previousQueries) {
    context.previousQueries.forEach(([queryKey, previousData]) => {
      queryClient.setQueryData(queryKey, previousData);
    });
  }
};

export default function TugasKurir() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore(state => state.user);
  const fileInputRef = useRef(null);
  
  // Period & Filter States
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

  const currentParams = getFilterParams();

  // View & Filter States
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'canteen'
  const [statusTab, setStatusTab] = useState('processing'); // Default: 'processing' (Sedang Diantar)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCanteenFilter, setSelectedCanteenFilter] = useState('all');
  const [expandedCanteen, setExpandedCanteen] = useState({});

  // Modals States
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [uploadType, setUploadType] = useState('purchase'); // 'purchase' | 'delivery'
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [selectedProofs, setSelectedProofs] = useState([]);
  const [confirmCompleteOrder, setConfirmCompleteOrder] = useState(null);
  const [confirmCancelOrder, setConfirmCancelOrder] = useState(null);
  const [receiptModalConfig, setReceiptModalConfig] = useState({
    isOpen: false,
    mode: 'single', // 'single' | 'batch'
    order: null,
    orders: [],
    title: ''
  });
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    await refetch();
    setTimeout(() => setIsManualRefreshing(false), 400);
  };

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
    // Cetak pesanan aktif sesuai filter & tab status yang sedang dibuka (kecuali dibatalkan)
    const targetOrders = filteredOrders.filter(o => o.status !== 'cancelled');

    if (targetOrders.length === 0) {
      toast.error('Tidak ada pesanan aktif pada filter saat ini.');
      return;
    }

    let tabLabel = 'Pesanan';
    if (statusTab === 'all') tabLabel = 'Semua Pesanan';
    else if (statusTab === 'my_tasks') tabLabel = 'Tugas Saya';
    else if (statusTab === 'pending') tabLabel = 'Pesanan Menunggu';
    else if (statusTab === 'processing') tabLabel = 'Pesanan Sedang Diantar';
    else if (statusTab === 'completed') tabLabel = 'Pesanan Selesai';

    setReceiptModalConfig({
      isOpen: true,
      mode: 'batch',
      order: null,
      orders: targetOrders,
      title: `Rekap ${tabLabel} (${targetOrders.length} Pesanan)`
    });
  };

  // Fetch all orders for courier
  const { data: rawOrders, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['courier_orders', currentParams.start_date, currentParams.end_date, currentParams.period],
    queryFn: async () => {
      const dateParams = currentParams.start_date ? `start_date=${currentParams.start_date}&end_date=${currentParams.end_date}&` : '';
      const periodParam = currentParams.period ? `period=${currentParams.period}` : '';
      const res = await api.get(`/courier/orders?${dateParams}${periodParam}`);
      return res.data?.data || res.data || [];
    },
    refetchInterval: 6000 // auto refresh every 6s
  });

  const orders = useMemo(() => {
    if (Array.isArray(rawOrders)) return rawOrders;
    if (rawOrders && Array.isArray(rawOrders.data)) return rawOrders.data;
    return [];
  }, [rawOrders]);

  // Fetch Canteens list for filter dropdown
  const { data: rawCanteens } = useQuery({
    queryKey: ['public_canteens_list'],
    queryFn: async () => {
      const res = await api.get('/canteens');
      return res.data?.data || res.data || [];
    },
    staleTime: 10 * 60 * 1000
  });

  const canteens = useMemo(() => {
    if (Array.isArray(rawCanteens)) return rawCanteens;
    if (rawCanteens && Array.isArray(rawCanteens.data)) return rawCanteens.data;
    return [];
  }, [rawCanteens]);

  // Take / Claim Order Mutation
  const takeOrderMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.post(`/courier/orders/${id}/take`);
      return res.data;
    },
    onMutate: async (id) => {
      return await mutateOrderInCaches(queryClient, 'courier_orders', id, (order) => ({
        ...order,
        courier_id: currentUser?.id,
        courier: currentUser || order.courier,
        status: 'processing'
      }));
    },
    onError: (err, id, context) => {
      rollbackCaches(queryClient, context);
      toast.error(err.response?.data?.message || 'Gagal mengambil pesanan');
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Pesanan berhasil diambil!');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['courier_orders'] });
    }
  });

  // Upload Proof (Receipt / Delivery) Mutation
  const uploadProofMutation = useMutation({
    mutationFn: async ({ id, files, type }) => {
      const formData = new FormData();
      const fieldName = type === 'delivery' ? 'proof_of_delivery[]' : 'proof_of_purchase[]';
      const endpoint = type === 'delivery' ? `/courier/orders/${id}/upload-delivery` : `/courier/orders/${id}/upload-receipt`;
      
      files.forEach(file => {
        formData.append(fieldName, file);
      });
      
      const res = await api.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return res.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['courier_orders'] });
      toast.success(variables.type === 'delivery' ? 'Bukti serah terima berhasil ditambahkan!' : 'Struk pembelian berhasil ditambahkan!');
      handleCloseModal();
    },
    onError: () => {
      toast.error('Gagal mengunggah bukti foto');
    }
  });

  // Delete Proof Mutation
  const deleteProofMutation = useMutation({
    mutationFn: async ({ id, type, path }) => {
      const res = await api.delete(`/courier/orders/${id}/proof`, {
        data: { type, path }
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['courier_orders'] });
      toast.success('Foto berhasil dihapus!');
      if (selectedOrder && data.order) {
        setSelectedOrder(data.order);
      }
    },
    onError: () => {
      toast.error('Gagal menghapus foto');
    }
  });

  // Complete Order Mutation
  const markCompleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.post(`/courier/orders/${id}/complete`);
      return res.data;
    },
    onMutate: async (id) => {
      return await mutateOrderInCaches(queryClient, 'courier_orders', id, (order) => ({
        ...order,
        status: 'completed'
      }));
    },
    onError: (err, id, context) => {
      rollbackCaches(queryClient, context);
      toast.error('Gagal menyelesaikan pesanan');
    },
    onSuccess: () => {
      toast.success('Pesanan berhasil diselesaikan!');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['courier_orders'] });
    }
  });

  // Cancel Order Mutation (Courier)
  const courierCancelOrderMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.put(`/courier/orders/${id}/cancel`);
      return res.data;
    },
    onMutate: async (id) => {
      setConfirmCancelOrder(null);
      return await mutateOrderInCaches(queryClient, 'courier_orders', id, (order) => ({
        ...order,
        status: 'cancelled'
      }));
    },
    onError: (err, id, context) => {
      rollbackCaches(queryClient, context);
      toast.error(err.response?.data?.message || 'Gagal membatalkan pesanan');
    },
    onSuccess: () => {
      toast.success('Pesanan berhasil dibatalkan!');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['courier_orders'] });
    }
  });

  const [isCompressing, setIsCompressing] = useState(false);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setIsCompressing(true);
      const toastId = toast.loading('Mengompresi foto...');
      try {
        const compressed = await compressImageFiles(files);
        setPhotoFiles(prev => [...prev, ...compressed]);
        setPhotoPreviews(prev => [...prev, ...compressed.map(file => URL.createObjectURL(file))]);
        toast.success('Foto berhasil disiapkan & dikompresi', { id: toastId });
      } catch (err) {
        setPhotoFiles(prev => [...prev, ...files]);
        setPhotoPreviews(prev => [...prev, ...files.map(file => URL.createObjectURL(file))]);
        toast.dismiss(toastId);
      } finally {
        setIsCompressing(false);
      }
    }
    e.target.value = '';
  };

  const handleRemoveNewPhoto = (index, e) => {
    e.stopPropagation();
    setPhotoFiles(prev => prev.filter((_, idx) => idx !== index));
    setPhotoPreviews(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleCloseModal = () => {
    setSelectedOrder(null);
    setPhotoFiles([]);
    setPhotoPreviews([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleContact = (phone, name) => {
    if (!phone) {
      toast.error(`Nomor WhatsApp ${name} tidak tersedia`);
      return;
    }
    let cleaned = phone.toString().replace(/\D/g, '');
    if (cleaned.startsWith('08')) {
      cleaned = '628' + cleaned.substring(2);
    } else if (cleaned.startsWith('8')) {
      cleaned = '628' + cleaned.substring(1);
    } else if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    } else if (!cleaned.startsWith('62') && cleaned.length > 5) {
      cleaned = '62' + cleaned;
    }
    window.open(`https://wa.me/${cleaned}`, '_blank');
  };

  const handleSubmitProof = () => {
    if (photoFiles.length === 0 || !selectedOrder) {
      toast.error('Silakan pilih atau ambil foto terlebih dahulu');
      return;
    }
    uploadProofMutation.mutate({ id: selectedOrder.id, files: photoFiles, type: uploadType });
  };

  const toggleCanteenExpand = (canteenId) => {
    setExpandedCanteen(prev => ({
      ...prev,
      [canteenId]: !prev[canteenId]
    }));
  };

  const getStatusPriority = (status) => {
    switch (status) {
      case 'processing': return 1; // Sedang Diantar (paling atas / prioritas utama kurir)
      case 'pending': return 2;    // Menunggu Diambil
      case 'completed': return 3;  // Selesai
      case 'cancelled': return 4;  // Dibatalkan
      default: return 5;
    }
  };

  // Filter & Sort Orders (Yang belum diselesaikan tampil paling atas)
  const filteredOrders = useMemo(() => {
    const list = orders.filter(order => {
      // 1. Status / Tab Filter
      if (statusTab === 'my_tasks') {
        if (order.courier_id !== currentUser?.id) return false;
      } else if (statusTab === 'pending') {
        if (order.status !== 'pending') return false;
      } else if (statusTab === 'processing') {
        if (order.status !== 'processing') return false;
      } else if (statusTab === 'completed') {
        if (order.status !== 'completed') return false;
      }

      // 2. Canteen Filter
      if (selectedCanteenFilter !== 'all') {
        if (order.canteen_id?.toString() !== selectedCanteenFilter.toString()) return false;
      }

      // 3. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = order.id?.toString().includes(q);
        const matchesSantri = order.user?.santri_name?.toLowerCase().includes(q);
        const matchesWali = order.user?.name?.toLowerCase().includes(q);
        const matchesRoom = order.user?.santri_room?.toLowerCase().includes(q);
        const matchesPhone = order.user?.phone?.toLowerCase().includes(q);
        const matchesCanteen = order.canteen?.name?.toLowerCase().includes(q);
        const matchesLocation = order.delivery_location?.toLowerCase().includes(q);
        const matchesNiy = order.user?.niy?.toLowerCase().includes(q);
        const matchesTeacherUnit = order.user?.teacher_unit?.toLowerCase().includes(q);
        const matchesOrderFor = order.order_for?.toLowerCase().includes(q);
        const matchesCustom = order.custom_notes?.toLowerCase().includes(q);
        const matchesItems = order.items?.some(i => i.product?.name?.toLowerCase().includes(q) || i.notes?.toLowerCase().includes(q));

        if (!matchesId && !matchesSantri && !matchesWali && !matchesRoom && !matchesPhone && !matchesCanteen && !matchesLocation && !matchesCustom && !matchesItems && !matchesNiy && !matchesTeacherUnit && !matchesOrderFor) {
          return false;
        }
      }

      return true;
    });

    return [...list].sort((a, b) => {
      const priorityA = getStatusPriority(a.status);
      const priorityB = getStatusPriority(b.status);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Prioritas Guru/Staff diantar lebih dulu di status yang sama
      const isPriorityA = (a.is_priority || a.order_for === 'guru') ? 1 : 0;
      const isPriorityB = (b.is_priority || b.order_for === 'guru') ? 1 : 0;
      if (isPriorityA !== isPriorityB) {
        return isPriorityB - isPriorityA;
      }

      // If same status priority: sort newest first
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (dateB !== dateA) return dateB - dateA;

      return (b.id || 0) - (a.id || 0);
    });
  }, [orders, statusTab, selectedCanteenFilter, searchQuery, currentUser?.id]);



  // Grouped by Toko / Kantin
  const groupedByCanteen = useMemo(() => {
    const map = {};

    filteredOrders.forEach(order => {
      const canteen = order.canteen;
      const canteenId = order.canteen_id || canteen?.id || 'unknown';
      const canteenName = canteen?.name || 'Toko / Kantin';
      const canteenCategory = canteen?.category || 'kauman';
      const canteenPhone = canteen?.whatsapp_number || canteen?.phone;

      if (!map[canteenId]) {
        map[canteenId] = {
          canteenId,
          canteenName,
          canteenCategory,
          canteenPhone,
          orders: [],
          customersMap: {},
          itemRecap: {},
          totalCost: 0,
          totalDeliveryFee: 0,
          totalItemCount: 0,
          hasPending: false,
          hasProcessing: false,
          allCompleted: true,
        };
      }

      // Pure product modal cost (total modal belanja at store)
      const orderModalCost = getOrderModalBelanja(order);

      map[canteenId].orders.push(order);
      map[canteenId].totalCost += orderModalCost;
      map[canteenId].totalDeliveryFee += parseFloat(order.delivery_fee || 0);

      if (order.status === 'pending') {
        map[canteenId].hasPending = true;
        map[canteenId].allCompleted = false;
      } else if (order.status === 'processing') {
        map[canteenId].hasProcessing = true;
        map[canteenId].allCompleted = false;
      } else if (order.status !== 'completed') {
        map[canteenId].allCompleted = false;
      }

      // Group customer info for "siapa aja"
      const u = order.user;
      const isTeacherOrder = order.order_for === 'guru';
      const santriName = isTeacherOrder ? `🎓 [GURU] ${u?.name || 'Guru / Staff'}` : (u?.santri_name || u?.name || 'Santri Tanpa Nama');
      const custKey = `${u?.id || 0}_${santriName}_${isTeacherOrder ? 'guru' : 'santri'}`;
      const gender = isTeacherOrder ? 'putra' : getSantriGender(santriName, u?.santri_room);

      let santriClass = isTeacherOrder ? `Unit ${u?.teacher_unit || 'Yayasan'}` : (u?.santri_class || '');
      let santriLevel = isTeacherOrder ? (u?.niy ? `NIY: ${u.niy}` : 'Staff') : (u?.santri_level || '');
      let santriRoom = order.delivery_location || (isTeacherOrder ? `Ruang Guru / Kantor ${u?.teacher_unit || ''}` : (u?.santri_room || 'Kamar belum diisi'));

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
          if ((!santriRoom || santriRoom === 'Kamar belum diisi') && match[10]) {
            santriRoom = match[10];
          }
        }
      }

      if (!map[canteenId].customersMap[custKey]) {
        map[canteenId].customersMap[custKey] = {
          custKey,
          userId: u?.id,
          santriName,
          gender,
          waliName: u?.name || 'Wali Santri',
          santriRoom,
          santriClass,
          santriLevel,
          phone: u?.phone,
          orders: [],
          items: [],
          totalCost: 0,
          totalItemCount: 0,
        };
      }

      map[canteenId].customersMap[custKey].orders.push(order);
      map[canteenId].customersMap[custKey].totalCost += orderModalCost;

      if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
          const qty = parseInt(item.quantity || 1);
          const name = item.product?.name || 'Makanan';
          map[canteenId].totalItemCount += qty;
          map[canteenId].customersMap[custKey].totalItemCount += qty;
          map[canteenId].customersMap[custKey].items.push({
            ...item,
            orderId: order.id,
            orderStatus: order.status,
          });

          if (!map[canteenId].itemRecap[name]) {
            map[canteenId].itemRecap[name] = { quantity: 0, total: 0 };
          }
          map[canteenId].itemRecap[name].quantity += qty;
          map[canteenId].itemRecap[name].total += getItemModalTotalHpp(item);
        });
      } else if (order.is_custom || order.custom_notes) {
        const customModalPrice = getOrderModalBelanja(order);
        map[canteenId].totalItemCount += 1;
        map[canteenId].customersMap[custKey].totalItemCount += 1;
        const customItem = {
          id: `custom_${order.id}`,
          orderId: order.id,
          orderStatus: order.status,
          quantity: 1,
          product: { name: order.custom_notes || 'Pesanan Khusus' },
          price: customModalPrice,
          subtotal: customModalPrice,
          notes: 'Pesanan Khusus',
        };
        map[canteenId].customersMap[custKey].items.push(customItem);

        const customName = `Titip Beli: ${order.custom_notes || 'Pesanan Khusus'}`;
        if (!map[canteenId].itemRecap[customName]) {
          map[canteenId].itemRecap[customName] = { quantity: 0, total: 0 };
        }
        map[canteenId].itemRecap[customName].quantity += 1;
        map[canteenId].itemRecap[customName].total += customModalPrice;
      }
    });

    return Object.values(map).map(c => {
      const customers = Object.values(c.customersMap);
      const customersPutra = customers.filter(cust => cust.gender === 'putra');
      const customersPutri = customers.filter(cust => cust.gender === 'putri');

      return {
        ...c,
        customers,
        customersPutra,
        customersPutri,
        itemRecapList: Object.keys(c.itemRecap).map(k => ({
          name: k,
          ...c.itemRecap[k]
        })).sort((a, b) => b.quantity - a.quantity)
      };
    }).sort((a, b) => {
      // Prioritaskan toko yang masih memiliki antaran aktif (Sedang Diantar > Menunggu > Selesai)
      const scoreA = (a.hasProcessing ? 2 : 0) + (a.hasPending ? 1 : 0);
      const scoreB = (b.hasProcessing ? 2 : 0) + (b.hasPending ? 1 : 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.orders.length - a.orders.length;
    });
  }, [filteredOrders]);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    return {
      all: orders.length,
      my_tasks: orders.filter(o => o.courier_id === currentUser?.id).length,
      pending: orders.filter(o => o.status === 'pending').length,
      processing: orders.filter(o => o.status === 'processing').length,
      completed: orders.filter(o => o.status === 'completed').length,
    };
  }, [orders, currentUser?.id]);

  // Printable orders count for current filter
  const printableOrdersCount = useMemo(() => {
    return filteredOrders.filter(o => o.status !== 'cancelled').length;
  }, [filteredOrders]);

  // Financial summary for filtered orders (modal belanja & ongkir)
  const filteredSummary = useMemo(() => {
    let totalProducts = 0;
    let totalDeliveryFee = 0;

    filteredOrders.forEach(order => {
      const deliveryFee = parseFloat(order.delivery_fee || 0);
      totalDeliveryFee += deliveryFee;
      totalProducts += getOrderModalBelanja(order);
    });

    const grandTotal = totalProducts + totalDeliveryFee;

    return {
      totalProducts,
      totalDeliveryFee,
      grandTotal,
      totalOrders: filteredOrders.length
    };
  }, [filteredOrders]);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-50 dark:bg-gray-950 font-sans gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-600 border-t-transparent shadow-md"></div>
        <p className="text-sm font-semibold text-gray-500 animate-pulse">Memuat semua pesanan kurir...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-950 min-h-screen pb-28 font-sans">
      {/* STICKY TOP HEADER */}
      <div className="bg-white dark:bg-gray-900 sticky top-0 z-20 shadow-sm border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between gap-2 max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 flex items-center justify-center shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 dark:text-white leading-tight flex items-center gap-2">
                Tugas Kurir
              </h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                {orders.length} Total Pesanan Terdaftar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isManualRefreshing ? 'animate-spin text-green-600' : ''}`} />
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800/60 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-[11px] font-bold text-green-700 dark:text-green-300">Live</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4 max-w-7xl mx-auto space-y-3">
        {/* UNIFIED FILTER CARD: PERIOD, CANTEEN, SEARCH */}
        <div className="bg-white dark:bg-gray-900 p-3 sm:p-3.5 rounded-2xl border border-green-300/80 dark:border-green-800 shadow-xs space-y-2.5">
          {/* Header & Active Period Badge */}
          <div className="flex items-center justify-between flex-wrap gap-1.5 border-b border-gray-200 dark:border-gray-700 pb-2">
            <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-green-600" />
              Filter Periode & Toko
            </h3>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300 border border-green-200 dark:border-green-800 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>📅 Periode: <strong>{getFilterLabel()}</strong></span>
            </span>
          </div>

          {/* Mode Selector Buttons */}
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
                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all shadow-xs ${
                  filterMode === m.id
                    ? 'bg-green-600 text-white shadow-xs ring-2 ring-green-600/20'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Dynamic Grid Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-0.5">
            {/* 1. Date Inputs depending on filterMode */}
            {filterMode === 'day' && (
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
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
                  <div className="w-full flex items-center justify-between px-2.5 py-1.5 border rounded-lg text-xs bg-gray-50 dark:bg-gray-800 dark:border-gray-700 text-gray-800 dark:text-white font-semibold group-hover:border-green-500 group-hover:bg-green-50/20 dark:group-hover:bg-green-950/20 transition-all shadow-xs">
                    <span className="truncate">
                      {formatFullDate(filterDate)}
                    </span>
                    <Calendar className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0 ml-1.5 group-hover:scale-110 transition-transform" />
                  </div>
                </div>
              </div>
            )}

            {filterMode === 'week' && (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                    PILIH BULAN:
                  </label>
                  <select
                    value={filterMonth}
                    onChange={(e) => {
                      const newMonth = parseInt(e.target.value);
                      setFilterMonth(newMonth);
                      setFilterWeekIndex(getCurrentWeekIndex(filterYear, newMonth));
                    }}
                    className="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-gray-50 dark:bg-gray-800 dark:border-gray-700 text-gray-800 dark:text-white font-semibold focus:ring-2 focus:ring-green-500 focus:outline-none"
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

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                    PILIH RENTANG MINGGU:
                  </label>
                  <select
                    value={filterWeekIndex < getWeeksInMonth(filterYear, filterMonth).length ? filterWeekIndex : 0}
                    onChange={(e) => setFilterWeekIndex(parseInt(e.target.value))}
                    className="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-gray-50 dark:bg-gray-800 dark:border-gray-700 text-gray-800 dark:text-white font-semibold focus:ring-2 focus:ring-green-500 focus:outline-none"
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

            {filterMode === 'month' && (
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                  PILIH BULAN:
                </label>
                <select
                  value={filterMonth}
                  onChange={(e) => {
                    const newMonth = parseInt(e.target.value);
                    setFilterMonth(newMonth);
                    setFilterWeekIndex(getCurrentWeekIndex(filterYear, newMonth));
                  }}
                  className="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-gray-50 dark:bg-gray-800 dark:border-gray-700 text-gray-800 dark:text-white font-semibold focus:ring-2 focus:ring-green-500 focus:outline-none"
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
            )}

            {(filterMode === 'week' || filterMode === 'month' || filterMode === 'year') && (
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                  PILIH TAHUN:
                </label>
                <select
                  value={filterYear}
                  onChange={(e) => {
                    const newYear = parseInt(e.target.value);
                    setFilterYear(newYear);
                    setFilterWeekIndex(getCurrentWeekIndex(newYear, filterMonth));
                  }}
                  className="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-gray-50 dark:bg-gray-800 dark:border-gray-700 text-gray-800 dark:text-white font-semibold focus:ring-2 focus:ring-green-500 focus:outline-none"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 2. Canteen Filter */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                PILIH KANTIN / TOKO:
              </label>
              <select
                value={selectedCanteenFilter}
                onChange={(e) => setSelectedCanteenFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 dark:border-gray-700 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500/20"
              >
                <option value="all">🏪 Semua Kantin ({canteens.length} Toko)</option>
                {canteens.map(c => (
                  <option key={c.id} value={c.id}>🏪 {c.name} ({c.category === 'kota' ? 'Luar/Kota' : 'Kauman'})</option>
                ))}
              </select>
            </div>

            {/* 3. Search Bar */}
            <div className={(filterMode === 'week' || filterMode === 'month' || filterMode === 'year' || filterMode === 'day') ? 'sm:col-span-2 lg:col-span-2' : 'sm:col-span-2 lg:col-span-3'}>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                PENCARIAN CEPAT:
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari santri, wali, kamar, kantin, atau makanan..."
                  className="w-full pl-8 pr-7 py-1.5 bg-gray-50 dark:bg-gray-800 dark:border-gray-700 border border-gray-200 rounded-lg text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all font-medium"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* VIEW MODE TOGGLE & STATUS TABS */}
        <div className="space-y-1.5">
          {/* Dual Mode Switcher */}
          <div className="grid grid-cols-2 gap-1.5 bg-gray-200/80 dark:bg-gray-800 p-0.5 rounded-xl shadow-inner">
            <button
              onClick={() => setViewMode('list')}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                viewMode === 'list' 
                  ? 'bg-white dark:bg-gray-900 text-green-700 dark:text-green-400 shadow-xs' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Daftar Pesanan ({filteredOrders.length})</span>
            </button>
            <button
              onClick={() => setViewMode('canteen')}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                viewMode === 'canteen' 
                  ? 'bg-white dark:bg-gray-900 text-green-700 dark:text-green-400 shadow-xs' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Rekap Per Toko ({groupedByCanteen.length})</span>
            </button>
          </div>

          {/* Status Filter Horizontal Tabs + Totals in Line */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-1.5 pt-0.5">
            {/* Horizontal Filter Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar shrink-0">
              {[
                { id: 'all', label: 'Semua', count: tabCounts.all },
                { id: 'my_tasks', label: 'Tugas Saya', count: tabCounts.my_tasks },
                { id: 'pending', label: 'Menunggu', count: tabCounts.pending },
                { id: 'processing', label: 'Sedang Diantar', count: tabCounts.processing },
                { id: 'completed', label: 'Selesai', count: tabCounts.completed },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusTab(tab.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                    statusTab === tab.id
                      ? 'bg-green-600 text-white shadow-xs'
                      : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Total Uang Produk & Total Ongkir & Tombol Cetak Rekap */}
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <button
                onClick={handlePrintBatchReceipt}
                className="py-1 px-2.5 bg-gray-900 hover:bg-black text-white dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs active:scale-95"
                title={`Cetak Rekap Pesanan (${printableOrdersCount} Pesanan)`}
              >
                <Printer className="w-3 h-3 text-green-400" />
                <span>🖨️ Cetak Rekap ({printableOrdersCount})</span>
              </button>

              <div className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs shadow-xs">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Modal Belanja:</span>
                <span className="font-extrabold text-gray-900 dark:text-white">
                  Rp {formatRupiah(filteredSummary.totalProducts)}
                </span>
              </div>

              <div className="flex items-center gap-1 px-2.5 py-1 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg text-xs shadow-xs">
                <span className="text-blue-700 dark:text-blue-300 font-medium">Total Ongkir:</span>
                <span className="font-extrabold text-blue-700 dark:text-blue-300">
                  Rp {formatRupiah(filteredSummary.totalDeliveryFee)}
                </span>
              </div>

              <div className="flex items-center gap-1 px-2.5 py-1 bg-green-50/80 dark:bg-green-950/40 border border-green-200 dark:border-green-800/60 rounded-lg text-xs shadow-xs">
                <span className="text-green-700 dark:text-green-300 font-medium">Modal + Ongkir:</span>
                <span className="font-extrabold text-green-700 dark:text-green-400">
                  Rp {formatRupiah(filteredSummary.grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* MODE 1: DAFTAR PESANAN LENGKAP (LIST MODE) */}
        {/* ======================================================== */}
        {viewMode === 'list' && (
          <div>
            {filteredOrders.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 text-center border border-gray-200 dark:border-gray-700 shadow-xs">
                <Package className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400 font-semibold text-sm">Tidak ada pesanan tugas untuk Anda.</p>
                <p className="text-xs text-gray-400 mt-1">
                  {orders.length === 0 
                    ? 'Jika Anda belum memiliki toko yang ditugaskan oleh Admin, hubungi Admin untuk penugasan toko.' 
                    : 'Coba ganti filter tab status atau ubah kata kunci pencarian.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2.5">
                {filteredOrders.map(order => {
                  const isProcessing = order.status === 'processing';
                  const isPending = order.status === 'pending';
                  const isCompleted = order.status === 'completed';
                  const isCancelled = order.status === 'cancelled';
                  const isMyTask = order.courier_id === currentUser?.id;
                  const isTeacherOrder = order.order_for === 'guru' || (order.is_priority && !order.user?.santri_name);
                  const isPriority = order.is_priority || isTeacherOrder;
                  const santriName = order.user?.santri_name || order.user?.name || 'Santri';
                  const waliName = order.user?.name || 'Wali';
                  let santriClass = order.user?.santri_class || '';
                  let santriLevel = order.user?.santri_level || '';
                  let santriRoom = order.delivery_location || order.user?.santri_room || '';

                  // Fallback match from santri.json if class/level missing
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
                      if ((!santriRoom || santriRoom === 'Kamar Santri') && match[10]) {
                        santriRoom = match[10];
                      }
                    }
                  }

                  return (
                    <div 
                      key={order.id} 
                      className={`bg-white dark:bg-gray-900 rounded-none border shadow-sm hover:shadow-md transition-all p-3 sm:p-3.5 flex flex-col justify-between gap-2 ${
                        isPriority
                          ? 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/30 bg-indigo-50/15 dark:bg-indigo-950/10'
                          : isProcessing 
                          ? 'border-green-400 dark:border-green-600 ring-1 ring-green-500/20' 
                          : isPending 
                          ? 'border-amber-300 dark:border-amber-700 ring-1 ring-amber-500/20' 
                          : isCompleted
                          ? 'border-green-200 dark:border-green-900/50'
                          : 'border-green-300/80 dark:border-green-800'
                      }`}
                    >
                      {/* Priority Strip for Teacher Orders */}
                      {isPriority && (
                        <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 text-white px-2.5 py-1 rounded-none flex items-center justify-between text-[11px] font-black tracking-tight -mx-3 -mt-3 mb-1 shadow-xs">
                          <span className="flex items-center gap-1.5">
                            <span>⚡</span>
                            <span>PRIORITAS ANTAR LANGSUNG • GURU / STAFF</span>
                          </span>
                          <span className="bg-amber-400 text-indigo-950 px-1.5 py-0.2 rounded-none uppercase text-[10px] font-mono font-black shadow-2xs">
                            UNIT {order.user?.teacher_unit || 'YAYASAN'}
                          </span>
                        </div>
                      )}

                      {/* 1. CARD HEADER: TOKO, ID, TIME & STATUS BADGES */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5 border-b border-gray-200 dark:border-gray-700/80 pb-1.5">
                          <div className="flex items-center gap-1 flex-wrap min-w-0">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-none bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 truncate max-w-[120px]">
                              🏪 {order.canteen?.name || 'Kantin'}
                            </span>
                            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">
                              #{order.id}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              • {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Status Badges */}
                          <div className="flex items-center gap-1 shrink-0">
                            {isPending && (
                              <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-[10px] font-bold rounded-none flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" /> Menunggu
                              </span>
                            )}
                            {isProcessing && (
                              <span className="px-1.5 py-0.5 bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 text-[10px] font-bold rounded-none flex items-center gap-0.5">
                                <Truck className="w-2.5 h-2.5" /> Diantar
                              </span>
                            )}
                            {isCompleted && (
                              <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold rounded-none flex items-center gap-0.5">
                                <CheckCircle className="w-2.5 h-2.5" /> Selesai
                              </span>
                            )}
                            {isCancelled && (
                              <span className="px-1.5 py-0.5 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-[10px] font-bold rounded-none">
                                Batal
                              </span>
                            )}

                            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-none ${
                              order.payment_status === 'paid'
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                                : order.payment_status === 'waiting_confirmation'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 ring-1 ring-amber-300'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            }`}>
                              {order.payment_status === 'paid' 
                                ? 'Lunas' 
                                : order.payment_status === 'waiting_confirmation' 
                                  ? 'Verifikasi' 
                                  : 'COD'}
                            </span>
                          </div>
                        </div>

                        {/* 2. SANTRI / TEACHER & ROOM INFO */}
                        {isTeacherOrder ? (
                          <div className="text-xs space-y-1">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-bold text-indigo-950 dark:text-indigo-100 truncate flex items-center gap-1">
                                <span className="text-sm">🎓</span>
                                <span className="truncate">{order.user?.name || 'Guru / Staff'}</span>
                              </span>
                              <span className="text-xs font-black text-indigo-900 dark:text-indigo-200 bg-indigo-100 dark:bg-indigo-950/70 px-2 py-0.5 rounded-none border border-indigo-300 dark:border-indigo-700 shrink-0 flex items-center gap-1 shadow-2xs">
                                <span>📍</span>
                                <span className="font-mono">{santriRoom || `Ruang Guru ${order.user?.teacher_unit || ''}`}</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-gray-600 dark:text-gray-300 pt-0.5">
                              <span className="font-mono text-purple-700 dark:text-purple-300 font-bold bg-purple-50 dark:bg-purple-950/50 px-1.5 py-0.2 border border-purple-200 dark:border-purple-800">
                                NIY: {order.user?.niy || '-'}
                              </span>
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded-none bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold">
                                Unit {order.user?.teacher_unit || 'Yayasan'}
                              </span>
                              {order.user?.phone && (
                                <span className="font-mono text-gray-500">• +{order.user.phone}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs space-y-1">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-bold text-gray-900 dark:text-white truncate flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span className="truncate">{santriName}</span>
                              </span>
                              <span className="text-xs sm:text-sm font-extrabold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-none border border-rose-200 dark:border-rose-800 shrink-0 flex items-center gap-1 shadow-2xs">
                                <span>📍</span>
                                <span className="font-black">{santriRoom || 'Kamar Santri'}</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-gray-500 dark:text-gray-400 pt-0.5">
                              <span className="truncate">Wali: {waliName}</span>
                              {(santriLevel || santriClass) && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded-none bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 text-[10px] font-bold">
                                  🎓 {santriLevel ? `${santriLevel} ` : ''}{santriClass ? `Kelas ${santriClass}` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 3. COMPACT FOOD ITEMS BOX */}
                        <div className="bg-green-50/30 dark:bg-gray-800/50 rounded-lg p-2 space-y-0.5 text-xs border border-green-100/60 dark:border-gray-800">
                          {order.custom_notes && (
                            <div className="text-[11px] font-medium text-amber-800 dark:text-amber-300 pb-0.5 border-b border-amber-100 dark:border-amber-900/40">
                              ✨ {order.custom_notes}
                            </div>
                          )}
                          {order.items && order.items.length > 0 ? (
                            order.items.map(item => (
                              <div key={item.id} className="flex justify-between items-center text-[11px]">
                                <span className="text-gray-800 dark:text-gray-200 truncate pr-2">
                                  <strong className="text-gray-900 dark:text-white font-bold">{item.quantity}x</strong> {item.product?.name || 'Produk'}
                                  {item.notes && <span className="text-gray-400 italic text-[10px]"> ({item.notes})</span>}
                                </span>
                                <span className="font-bold text-gray-900 dark:text-white shrink-0">
                                  Rp {formatRupiah(getItemModalTotalHpp(item))}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="flex justify-between items-center text-[11px] text-gray-500">
                              <span>1x Pesanan Khusus</span>
                              <span className="font-bold text-gray-900 dark:text-white">
                                Rp {formatRupiah(getOrderModalBelanja(order))}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 4. PROOF CHIPS (ONLY IF UPLOADED) */}
                        {((order.proof_of_purchase && order.proof_of_purchase.length > 0) ||
                          (order.proof_of_delivery && order.proof_of_delivery.length > 0) ||
                          (order.proof_of_payment && order.proof_of_payment.length > 0)) && (
                          <div className="flex gap-1 flex-wrap pt-0.5">
                            {order.proof_of_purchase && order.proof_of_purchase.length > 0 && (
                              <button
                                onClick={() => {
                                  const proofs = Array.isArray(order.proof_of_purchase)
                                    ? order.proof_of_purchase.map(p => getStorageUrl(p))
                                    : [getStorageUrl(order.proof_of_purchase)];
                                  setSelectedProofs(proofs);
                                }}
                                className="px-1.5 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors border border-purple-200 dark:border-purple-800"
                              >
                                📄 Struk ({Array.isArray(order.proof_of_purchase) ? order.proof_of_purchase.length : 1})
                              </button>
                            )}

                            {order.proof_of_delivery && order.proof_of_delivery.length > 0 && (
                              <button
                                onClick={() => {
                                  const proofs = Array.isArray(order.proof_of_delivery)
                                    ? order.proof_of_delivery.map(p => getStorageUrl(p))
                                    : [getStorageUrl(order.proof_of_delivery)];
                                  setSelectedProofs(proofs);
                                }}
                                className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors border border-blue-200 dark:border-blue-800"
                              >
                                📷 Antar ({Array.isArray(order.proof_of_delivery) ? order.proof_of_delivery.length : 1})
                              </button>
                            )}

                            {order.proof_of_payment && order.proof_of_payment.length > 0 && (
                              <button
                                onClick={() => {
                                  const proofs = Array.isArray(order.proof_of_payment)
                                    ? order.proof_of_payment.map(p => getStorageUrl(p))
                                    : [getStorageUrl(order.proof_of_payment)];
                                  setSelectedProofs(proofs);
                                }}
                                className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors border border-gray-200 dark:border-gray-700"
                              >
                                💳 Transfer
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 5. FOOTER: TOTAL MODAL BELANJA & COURIER ACTIONS */}
                      <div className="pt-1.5 border-t border-gray-200 dark:border-gray-700/80 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-sm font-black text-green-700 dark:text-green-400 block leading-tight">
                              Rp {formatRupiah(getOrderModalBelanja(order))}
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium truncate block">
                              Modal Toko • Ongkir: Rp {formatRupiah(order.delivery_fee > 0 ? order.delivery_fee : (order.voucher_id ? 3000 : 0))}
                              {order.delivery_fee <= 0 && order.voucher_id && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-1">(Subsidi)</span>
                              )}
                            </span>
                          </div>

                          {/* Mini Actions (Struk & Cancel) */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handlePrintSingleReceipt(order)}
                              className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-bold transition-colors"
                              title="Cetak Struk Thermal / A4"
                            >
                              <Printer className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            </button>

                            {isCompleted && (
                              <button
                                onClick={() => setConfirmCancelOrder(order)}
                                className="p-1 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 rounded-lg text-xs font-bold transition-colors border border-red-200 dark:border-red-800"
                                title="Batalkan Pesanan yang Sudah Selesai Ini"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Courier Operational Action Buttons */}
                        {!isCompleted && !isCancelled && (
                          <div className="space-y-1 pt-0.5">
                            {/* If order is pending or not yet assigned to this courier */}
                            {(!order.courier_id || (isPending && !isMyTask)) ? (
                              <button
                                onClick={() => takeOrderMutation.mutate(order.id)}
                                disabled={takeOrderMutation.isPending}
                                className="w-full py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1 shadow-xs disabled:opacity-50"
                              >
                                {takeOrderMutation.isPending ? (
                                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                                ) : (
                                  <>
                                    <Truck className="w-3.5 h-3.5" />
                                    Ambil & Antar Pesanan
                                  </>
                                )}
                              </button>
                            ) : (
                              <>
                                <div className="grid grid-cols-2 gap-1">
                                  <button 
                                    onClick={() => {
                                      setSelectedOrder(order);
                                      setUploadType('purchase');
                                      setPhotoFiles([]);
                                      setPhotoPreviews([]);
                                    }}
                                    className="py-1.5 px-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1 shadow-2xs"
                                  >
                                    <Camera className="w-3 h-3" />
                                    + Struk Toko
                                  </button>

                                  <button 
                                    onClick={() => {
                                      setSelectedOrder(order);
                                      setUploadType('delivery');
                                      setPhotoFiles([]);
                                      setPhotoPreviews([]);
                                    }}
                                    className="py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1 shadow-2xs"
                                  >
                                    <Upload className="w-3 h-3" />
                                    + Bukti Antar
                                  </button>
                                </div>

                                <button 
                                  onClick={() => setConfirmCompleteOrder(order)}
                                  disabled={markCompleteMutation.isPending}
                                  className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1 shadow-xs disabled:opacity-50"
                                >
                                  {markCompleteMutation.isPending ? (
                                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-3.5 h-3.5" /> 
                                      Selesaikan Pesanan #{order.id}
                                    </>
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* MODE 2: REKAP PER TOKO / KANTIN (CANTEEN GROUPED VIEW) */}
        {/* ======================================================== */}
        {viewMode === 'canteen' && (
          <div className="space-y-3.5 animate-fade-in-up">
            <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-2xl border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2">
              <Store className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong>Mode Rekap Per Toko / Kantin:</strong> Menampilkan total makanan yang harus diambil di setiap toko, serta daftar <strong>siapa saja santri/pemesan</strong> yang memesan di toko tersebut.
              </div>
            </div>

            {groupedByCanteen.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 text-center border border-gray-200 dark:border-gray-700 shadow-xs">
                <Store className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400 font-semibold text-sm">Tidak ada data toko/pesanan pada filter saat ini.</p>
              </div>
            ) : (
              groupedByCanteen.map(canteen => {
                const isExpanded = !!expandedCanteen[canteen.canteenId];

                return (
                  <div 
                    key={canteen.canteenId}
                    className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs overflow-hidden transition-all"
                  >
                    {/* CANTEEN HEADER BAR */}
                    <div 
                      onClick={() => toggleCanteenExpand(canteen.canteenId)}
                      className="p-3.5 sm:p-4 cursor-pointer hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors flex items-start justify-between gap-2"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center font-extrabold text-sm shrink-0 shadow-xs">
                          <Store className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
                              {canteen.canteenName}
                            </h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800 capitalize">
                              {canteen.canteenCategory || 'Kantin'}
                            </span>
                            {canteen.hasPending && (
                              <span className="px-2 py-0.2 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-bold rounded-full">
                                Perlu Diambil
                              </span>
                            )}
                            {canteen.hasProcessing && (
                              <span className="px-2 py-0.2 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 text-[10px] font-bold rounded-full">
                                Sedang Diantar
                              </span>
                            )}
                            {canteen.allCompleted && (
                              <span className="px-2 py-0.2 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-bold rounded-full">
                                Selesai
                              </span>
                            )}
                          </div>
                          
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mt-1 flex items-center gap-1.5 flex-wrap">
                            <span>🛍️ <strong>{canteen.totalItemCount} Makanan</strong></span>
                            <span>•</span>
                            <span>📦 <strong>{canteen.orders.length} Pesanan</strong></span>
                            <span>•</span>
                            <span>👥 <strong>{canteen.customers.length} Pemesan</strong></span>
                          </p>

                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            Total Modal Belanja Toko: <strong className="text-green-600 dark:text-green-400">Rp {formatRupiah(canteen.totalCost)}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Print Canteen Manifest */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const canteenOrders = canteen.orders.filter(o => o.status !== 'cancelled');
                            if (canteenOrders.length === 0) {
                              toast.error('Tidak ada pesanan aktif untuk toko ini.');
                              return;
                            }
                            setReceiptModalConfig({
                              isOpen: true,
                              mode: 'batch',
                              order: null,
                              orders: canteenOrders,
                              title: `Rekap ${canteen.canteenName} (${canteenOrders.length} Pesanan)`
                            });
                          }}
                          className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl transition-colors"
                          title={`Cetak Rekap Toko ${canteen.canteenName}`}
                        >
                          <Printer className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </button>

                        {canteen.canteenPhone && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const phone = canteen.canteenPhone.replace(/^0/, '62');
                              window.open(`https://wa.me/${phone}`, '_blank');
                            }}
                            className="p-2 bg-green-50 hover:bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl transition-colors"
                            title="Hubungi Toko via WA"
                          >
                            <Phone className="w-4 h-4" />
                          </button>
                        )}
                        <div className="p-1 text-gray-400">
                          {isExpanded ? <ChevronDown className="w-5 h-5 text-blue-600" /> : <ChevronRight className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                    {/* EXPANDED CONTENT: SUMMARY OF FOOD TO PICK UP + WHO ORDERED WHAT */}
                    {isExpanded && (
                      <div className="p-3.5 sm:p-4 bg-gray-50/70 dark:bg-gray-800/40 border-t border-gray-200 dark:border-gray-700 space-y-4">
                        
                        {/* 1. REKAP TOTAL MAKANAN DI TOKO INI */}
                        <div className="bg-white dark:bg-gray-900 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs space-y-2">
                          <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                            🍽️ Total Makanan yang Harus Diambil di {canteen.canteenName}:
                          </h4>

                          <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {canteen.itemRecapList.map((item, idx) => (
                              <div key={idx} className="py-2 first:pt-1 last:pb-0 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                    {item.quantity}x
                                  </span>
                                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                                    {item.name}
                                  </span>
                                </div>
                                <span className="text-xs font-bold text-gray-900 dark:text-white">
                                  Rp {formatRupiah(item.total)}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="pt-2.5 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs font-bold">
                            <span className="text-gray-600 dark:text-gray-400">Total Nilai Produk:</span>
                            <span className="text-green-600 dark:text-green-400 text-sm">
                              Rp {formatRupiah(canteen.totalCost)}
                            </span>
                          </div>
                        </div>

                        {/* 2. SIAPA AJA YANG PESAN DI TOKO INI (DIPISAHKAN PUTRA & PUTRI) */}
                        <div className="space-y-4 pt-1">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                              👥 Siapa Aja yang Pesan ({canteen.customers.length} Pemesan):
                            </h4>
                            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold">
                              <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                                👦 Putra: {canteen.customersPutra.length}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-900/40 text-pink-800 dark:text-pink-300">
                                👧 Putri: {canteen.customersPutri.length}
                              </span>
                            </div>
                          </div>

                          {/* KELOMPOK 1: SANTRI PUTRA (LAKI-LAKI) */}
                          {canteen.customersPutra.length > 0 && (
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between bg-blue-50/80 dark:bg-blue-950/40 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">👦</span>
                                  <span className="text-xs font-bold text-blue-900 dark:text-blue-300">
                                    Santri Putra (Laki-laki)
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-blue-200/70 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                  {canteen.customersPutra.length} Santri
                                </span>
                              </div>

                              <div className="space-y-2.5">
                                {canteen.customersPutra.map(cust => (
                                  <div 
                                    key={cust.custKey}
                                    className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-blue-100 dark:border-blue-900/40 shadow-xs space-y-2"
                                  >
                                    {/* Customer Header */}
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-start gap-2.5 min-w-0">
                                        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0">
                                          👦
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <h5 className="font-bold text-gray-900 dark:text-white text-sm">
                                              {cust.santriName}
                                            </h5>
                                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                              Putra
                                            </span>
                                            <span className="text-[10px] text-gray-500 font-medium bg-gray-100 dark:bg-gray-800 px-1.5 py-0.2 rounded">
                                              Wali: {cust.waliName}
                                            </span>
                                          </div>
                                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                            🏠 {cust.santriRoom} {cust.santriClass ? `• Kelas ${cust.santriClass}/${cust.santriLevel}` : ''}
                                          </p>
                                        </div>
                                      </div>

                                      {cust.phone && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const phone = cust.phone.replace(/^0/, '62');
                                            window.open(`https://wa.me/${phone}`, '_blank');
                                          }}
                                          className="text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/30 p-1.5 rounded-full shrink-0"
                                          title="Hubungi Wali Santri"
                                        >
                                          <MessageCircle className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>

                                    {/* Customer's items from this store */}
                                    <div className="bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-lg space-y-1.5 border border-gray-200 dark:border-gray-750">
                                      {cust.items.map((it, idx) => (
                                        <div key={idx} className="flex justify-between items-start text-xs">
                                          <div>
                                            <span className="font-semibold text-gray-800 dark:text-gray-200">
                                              {it.quantity}x {it.product?.name || 'Makanan'}
                                            </span>
                                            {it.notes && (
                                              <p className="text-[10px] text-amber-700 dark:text-amber-300">
                                                📝 {it.notes}
                                              </p>
                                            )}
                                          </div>
                                          <span className="font-medium text-gray-900 dark:text-white shrink-0 ml-2">
                                            Rp {formatRupiah(it.subtotal || it.price || 0)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Order IDs and Actions */}
                                    <div className="flex items-center justify-between pt-1 border-t border-gray-200 dark:border-gray-700 text-xs flex-wrap gap-2">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[11px] text-gray-500 font-medium">Order:</span>
                                        {cust.orders.map(o => (
                                          <span key={o.id} className="font-bold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[11px]">
                                            #{o.id} ({o.status})
                                          </span>
                                        ))}
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        {cust.orders.map(o => (
                                          <React.Fragment key={o.id}>
                                            {o.status === 'pending' && (!o.courier_id || o.courier_id !== currentUser?.id) && (
                                              <button
                                                type="button"
                                                onClick={() => takeOrderMutation.mutate(o.id)}
                                                disabled={takeOrderMutation.isPending}
                                                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs"
                                              >
                                                <CheckCircle className="w-3 h-3" /> Ambil #{o.id}
                                              </button>
                                            )}
                                            {o.status === 'processing' && o.courier_id === currentUser?.id && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setSelectedOrder(o);
                                                  setUploadType('delivery');
                                                }}
                                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs"
                                              >
                                                <Camera className="w-3 h-3" /> + Bukti #{o.id}
                                              </button>
                                            )}
                                          </React.Fragment>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* KELOMPOK 2: SANTRI PUTRI (PEREMPUAN) */}
                          {canteen.customersPutri.length > 0 && (
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between bg-pink-50/80 dark:bg-pink-950/40 px-3 py-1.5 rounded-xl border border-pink-200 dark:border-pink-800">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">👧</span>
                                  <span className="text-xs font-bold text-pink-900 dark:text-pink-300">
                                    Santri Putri (Perempuan)
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-pink-200/70 dark:bg-pink-900 text-pink-800 dark:text-pink-200">
                                  {canteen.customersPutri.length} Santri
                                </span>
                              </div>

                              <div className="space-y-2.5">
                                {canteen.customersPutri.map(cust => (
                                  <div 
                                    key={cust.custKey}
                                    className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-pink-100 dark:border-pink-900/40 shadow-xs space-y-2"
                                  >
                                    {/* Customer Header */}
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-start gap-2.5 min-w-0">
                                        <div className="w-7 h-7 rounded-lg bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300 flex items-center justify-center font-bold text-xs shrink-0">
                                          👧
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <h5 className="font-bold text-gray-900 dark:text-white text-sm">
                                              {cust.santriName}
                                            </h5>
                                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300">
                                              Putri
                                            </span>
                                            <span className="text-[10px] text-gray-500 font-medium bg-gray-100 dark:bg-gray-800 px-1.5 py-0.2 rounded">
                                              Wali: {cust.waliName}
                                            </span>
                                          </div>
                                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                            🏠 {cust.santriRoom} {cust.santriClass ? `• Kelas ${cust.santriClass}/${cust.santriLevel}` : ''}
                                          </p>
                                        </div>
                                      </div>

                                      {cust.phone && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const phone = cust.phone.replace(/^0/, '62');
                                            window.open(`https://wa.me/${phone}`, '_blank');
                                          }}
                                          className="text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/30 p-1.5 rounded-full shrink-0"
                                          title="Hubungi Wali Santri"
                                        >
                                          <MessageCircle className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>

                                    {/* Customer's items from this store */}
                                    <div className="bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-lg space-y-1.5 border border-gray-200 dark:border-gray-750">
                                      {cust.items.map((it, idx) => (
                                        <div key={idx} className="flex justify-between items-start text-xs">
                                          <div>
                                            <span className="font-semibold text-gray-800 dark:text-gray-200">
                                              {it.quantity}x {it.product?.name || 'Makanan'}
                                            </span>
                                            {it.notes && (
                                              <p className="text-[10px] text-amber-700 dark:text-amber-300">
                                                📝 {it.notes}
                                              </p>
                                            )}
                                          </div>
                                          <span className="font-medium text-gray-900 dark:text-white shrink-0 ml-2">
                                            Rp {formatRupiah(it.subtotal || it.price || 0)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Order IDs and Actions */}
                                    <div className="flex items-center justify-between pt-1 border-t border-gray-200 dark:border-gray-700 text-xs flex-wrap gap-2">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[11px] text-gray-500 font-medium">Order:</span>
                                        {cust.orders.map(o => (
                                          <span key={o.id} className="font-bold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[11px]">
                                            #{o.id} ({o.status})
                                          </span>
                                        ))}
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        {cust.orders.map(o => (
                                          <React.Fragment key={o.id}>
                                            {o.status === 'pending' && (!o.courier_id || o.courier_id !== currentUser?.id) && (
                                              <button
                                                type="button"
                                                onClick={() => takeOrderMutation.mutate(o.id)}
                                                disabled={takeOrderMutation.isPending}
                                                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs"
                                              >
                                                <CheckCircle className="w-3 h-3" /> Ambil #{o.id}
                                              </button>
                                            )}
                                            {o.status === 'processing' && o.courier_id === currentUser?.id && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setSelectedOrder(o);
                                                  setUploadType('delivery');
                                                }}
                                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs"
                                              >
                                                <Camera className="w-3 h-3" /> + Bukti #{o.id}
                                              </button>
                                            )}
                                          </React.Fragment>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {canteen.customers.length === 0 && (
                            <div className="text-center py-4 text-xs text-gray-500">
                              Belum ada pemesan di toko ini.
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}


      </div>

      {/* ======================================================== */}
      {/* UPLOAD PROOF MODAL (RECEIPT / DELIVERY PROOF) */}
      {/* ======================================================== */}
      {selectedOrder && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl my-auto">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Upload Foto Bukti #{selectedOrder.id}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4 sm:p-5 space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setUploadType('purchase')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                    uploadType === 'purchase' 
                      ? 'bg-purple-600 text-white shadow-xs' 
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> Struk Kantin
                </button>
                <button
                  type="button"
                  onClick={() => setUploadType('delivery')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                    uploadType === 'delivery' 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" /> Bukti Serah Terima
                </button>
              </div>

              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Upload <span className="font-bold text-gray-900 dark:text-white">{uploadType === 'delivery' ? 'Bukti Serah Terima (Antar Santri)' : 'Struk Pembelian Kantin'}</span> untuk <span className="font-bold text-green-600 dark:text-green-400">{selectedOrder.user?.santri_name || selectedOrder.user?.name}</span> ({selectedOrder.user?.santri_room || 'Asrama'}).
              </p>

              {/* CURRENTLY SAVED PHOTOS FOR THIS TYPE */}
              {(() => {
                const currentField = uploadType === 'delivery' ? 'proof_of_delivery' : 'proof_of_purchase';
                const currentPhotos = Array.isArray(selectedOrder[currentField]) 
                  ? selectedOrder[currentField] 
                  : (selectedOrder[currentField] ? [selectedOrder[currentField]] : []);
                
                if (currentPhotos.length === 0) return null;

                return (
                  <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      Berkas Tersimpan ({currentPhotos.length}):
                    </span>
                    <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto">
                      {currentPhotos.map((path, idx) => {
                        const fileType = getFileType(path);
                        const isImg = fileType === 'image';

                        return (
                          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 bg-black/10 flex items-center justify-center group">
                            {isImg ? (
                              <img src={getStorageUrl(path)} alt={`Saved ${idx + 1}`} className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex flex-col items-center justify-center p-1 text-center text-gray-600 dark:text-gray-300">
                                <FileText className="w-6 h-6" />
                                <span className="text-[9px] font-mono mt-0.5 uppercase truncate max-w-full px-1">{fileType}</span>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('Hapus berkas ini dari database?')) {
                                  deleteProofMutation.mutate({ id: selectedOrder.id, type: currentField, path });
                                }
                              }}
                              className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full shadow-md transition-transform active:scale-95 z-10"
                              title="Hapus berkas ini"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              
              {/* NEW PREVIEWS */}
              <div className="space-y-3">
                {photoFiles.length > 0 && (
                  <div className="border-2 border-dashed border-green-500 bg-green-50/50 dark:bg-green-900/10 rounded-xl p-3">
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Berkas Baru Dipilih ({photoFiles.length}):
                    </p>
                    <div className="grid grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                      {photoFiles.map((file, idx) => {
                        const isImg = isImageFile(file);
                        const isPdf = isPdfFile(file);
                        const isHeif = isHeifFile(file);

                        return (
                          <div key={idx} className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 flex flex-col justify-between group shadow-xs">
                            {isImg ? (
                              <div className="aspect-video w-full rounded-lg overflow-hidden bg-black/5 mb-1.5">
                                <img src={URL.createObjectURL(file)} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="aspect-video w-full rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 flex flex-col items-center justify-center text-blue-600 dark:text-blue-400 mb-1.5">
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
                                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                                    (Hemat {Math.round((1 - file.size / file.originalSize) * 100)}%)
                                  </span>
                                )}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => handleRemoveNewPhoto(idx, e)}
                              className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full shadow-md transition-transform active:scale-95 z-10"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => document.getElementById('cameraInput').click()}
                    className="flex flex-col items-center justify-center gap-1.5 p-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center">
                      <Camera className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Kamera Langsung</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => document.getElementById('galleryInput').click()}
                    className="flex flex-col items-center justify-center gap-1.5 p-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="w-9 h-9 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-full flex items-center justify-center">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Pilih Berkas / Galeri</span>
                  </button>
                </div>

                <input 
                  id="cameraInput"
                  type="file" 
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange} 
                  className="hidden"
                />
                <input 
                  id="galleryInput"
                  type="file" 
                  accept="image/*,.heic,.heif"
                  multiple
                  onChange={handleFileChange} 
                  className="hidden"
                />
              </div>
            </div>
            
            <div className="p-4 sm:p-5 pt-0 flex gap-2.5">
              <button 
                onClick={handleCloseModal}
                className="flex-1 py-2.5 rounded-xl font-bold text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 transition-colors text-xs"
              >
                Batal
              </button>
              <button 
                type="button"
                onClick={handleSubmitProof}
                disabled={photoFiles.length === 0 || uploadProofMutation.isPending || isCompressing}
                className={`flex-[2] py-2.5 rounded-xl font-bold text-white disabled:opacity-50 transition-colors flex justify-center items-center gap-1.5 text-xs ${
                  uploadType === 'delivery' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {uploadProofMutation.isPending || isCompressing ? (
                  <span className="flex items-center gap-1.5">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent inline-block"></span>
                    <span>{isCompressing ? 'Mengompresi...' : 'Mengunggah...'}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{`Simpan Berkas (${photoFiles.length})`}</span>
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* FULL SCREEN PHOTO / DOCUMENT VIEWER MODAL */}
      {/* ======================================================== */}
      {selectedProofs.length > 0 && createPortal(
        <div className="fixed inset-0 z-[110] bg-black/95 flex flex-col animate-in fade-in duration-200">
          <div className="flex justify-between items-center px-4 py-3 bg-black/80 shrink-0 border-b border-gray-800">
            <span className="text-white font-bold text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-400" />
              Berkas Bukti ({selectedProofs.length})
            </span>
            <button 
              onClick={() => setSelectedProofs([])}
              className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto flex flex-col items-center gap-4 p-4 pb-12">
            {selectedProofs.map((proof, idx) => {
              const fileType = getFileType(proof);
              const fileName = getFileNameFromPath(proof);

              if (fileType === 'pdf') {
                return (
                  <div key={idx} className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col items-center gap-3 shadow-xl">
                    <div className="w-full flex items-center justify-between text-xs text-gray-400 border-b border-gray-800 pb-2">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-red-400" /> Bukti {idx + 1}: {fileName}
                      </span>
                      <span className="px-2 py-0.5 bg-red-900/40 text-red-300 rounded font-mono text-[10px]">PDF</span>
                    </div>
                    <iframe 
                      src={proof} 
                      title={`Bukti PDF ${idx + 1}`} 
                      className="w-full h-[55vh] rounded-xl bg-white border border-gray-700" 
                    />
                    <a
                      href={proof}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 active:scale-98 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md"
                    >
                      <ExternalLink className="w-4 h-4" /> Buka / Unduh Dokumen PDF
                    </a>
                  </div>
                );
              }

              if (fileType === 'image') {
                return (
                  <div key={idx} className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl p-2.5 flex flex-col items-center gap-2">
                    <div className="w-full flex items-center justify-between px-2 text-xs text-gray-400">
                      <span className="font-medium">Bukti {idx + 1} dari {selectedProofs.length}</span>
                      <a 
                        href={proof} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-green-400 hover:text-green-300 flex items-center gap-1 text-[11px]"
                      >
                        Buka Penuh <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <img 
                      src={proof}
                      alt={`Foto ${idx + 1}`}
                      className="w-full rounded-xl shadow-2xl object-contain bg-black/40"
                      style={{ maxHeight: '75vh' }}
                    />
                  </div>
                );
              }

              // HEIF / Document / Other
              return (
                <div key={idx} className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col items-center gap-4 text-center shadow-xl">
                  <div className="w-16 h-16 rounded-2xl bg-green-950/60 border border-green-800/50 flex items-center justify-center text-green-400">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm break-all">{fileName}</p>
                    <p className="text-gray-400 text-xs mt-1">Berkas Bukti #{idx + 1}</p>
                  </div>
                  <a
                    href={proof}
                    target="_blank"
                    download
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 active:scale-98 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md"
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

      {/* ======================================================== */}
      {/* CONFIRMATION MODAL FOR COMPLETING ORDER */}
      {/* ======================================================== */}
      {confirmCompleteOrder && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl p-5 text-center space-y-3 my-auto">
            {!(confirmCompleteOrder.proof_of_purchase?.length > 0 || confirmCompleteOrder.proof_of_delivery?.length > 0) ? (
              <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
            ) : (
              <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-7 h-7" />
              </div>
            )}
            
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Selesaikan Pesanan #{confirmCompleteOrder.id}?
            </h3>
            
            {!(confirmCompleteOrder.proof_of_purchase?.length > 0 || confirmCompleteOrder.proof_of_delivery?.length > 0) ? (
              <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800 text-left font-medium">
                ⚠️ <strong>Perhatian:</strong> Anda belum mengunggah foto struk kantin ataupun foto serah terima santri. Pastikan pesanan benar-benar sudah diserahkan.
              </p>
            ) : (
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Pesanan atas nama <strong className="text-gray-900 dark:text-white">{confirmCompleteOrder.user?.santri_name || confirmCompleteOrder.user?.name}</strong> akan ditandai selesai dan saldo ongkir akan masuk ke akun Anda.
              </p>
            )}

            <div className="flex gap-2.5 pt-2">
              <button 
                onClick={() => setConfirmCompleteOrder(null)}
                className="flex-1 py-2.5 rounded-xl font-bold text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 transition-colors text-xs"
              >
                Batal
              </button>
              <button 
                onClick={() => {
                  markCompleteMutation.mutate(confirmCompleteOrder.id);
                  setConfirmCompleteOrder(null);
                }}
                className="flex-1 py-2.5 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 transition-colors text-xs shadow-xs"
              >
                Ya, Selesaikan!
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* CONFIRMATION MODAL FOR CANCELLING ORDER (COURIER) */}
      {/* ======================================================== */}
      {confirmCancelOrder && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl p-5 text-center space-y-3 my-auto">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Batalkan Pesanan #{confirmCancelOrder.id}?
            </h3>
            
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {confirmCancelOrder.status === 'completed' ? (
                <>
                  Pesanan atas nama <strong>{confirmCancelOrder.user?.santri_name || confirmCancelOrder.user?.name}</strong> yang sudah selesai ini akan diubah statusnya menjadi <strong className="text-red-600">Dibatalkan</strong> dan stok toko akan dipulihkan.
                </>
              ) : (
                <>
                  Pesanan atas nama <strong>{confirmCancelOrder.user?.santri_name || confirmCancelOrder.user?.name}</strong> akan diubah statusnya menjadi <strong className="text-red-600">Dibatalkan</strong>.
                </>
              )}
            </p>

            <div className="flex gap-2.5 pt-2">
              <button 
                onClick={() => setConfirmCancelOrder(null)}
                disabled={courierCancelOrderMutation.isPending}
                className="flex-1 py-2.5 rounded-xl font-bold text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 transition-colors text-xs"
              >
                Batal
              </button>
              <button 
                onClick={() => courierCancelOrderMutation.mutate(confirmCancelOrder.id)}
                disabled={courierCancelOrderMutation.isPending}
                className="flex-1 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors text-xs shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {courierCancelOrderMutation.isPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Membatalkan...
                  </>
                ) : (
                  <>
                    <X className="w-3.5 h-3.5" /> Ya, Batalkan!
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* MODAL CETAK STRUK THERMAL IWARE */}
      <ThermalReceiptModal
        isOpen={receiptModalConfig.isOpen}
        onClose={() => setReceiptModalConfig(prev => ({ ...prev, isOpen: false }))}
        mode={receiptModalConfig.mode}
        order={receiptModalConfig.order}
        orders={receiptModalConfig.orders}
        courierName={currentUser?.name || 'Petugas Kurir'}
        title={receiptModalConfig.title}
      />
    </div>
  );
}
