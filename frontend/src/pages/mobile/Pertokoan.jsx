import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios, { getStorageUrl } from '../../lib/axios';
import { 
  Store, 
  CheckCircle, 
  XCircle, 
  ChevronLeft, 
  Save, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  Power, 
  Search, 
  X, 
  RefreshCw, 
  SlidersHorizontal,
  Wallet,
  User,
  Phone,
  Building2,
  GraduationCap,
  Sparkles,
  Image as ImageIcon,
  Trash2,
  Eye,
  EyeOff,
  UploadCloud,
  Plus,
  Truck,
  UtensilsCrossed,
  Package,
  Tag,
  Pencil
} from 'lucide-react';
import toast from 'react-hot-toast';
import AppImage from '../../components/common/AppImage';
import { PRICING_CONFIG, CANTEEN_ZONES, getCanteenZone } from '../../config/pricing';
import { useAuthStore } from '../../store/authStore';
import { ROLES } from '../../config/roles';
import { ProductFormModal } from '../../components/modals/ProductFormModal';
import { hasVariants, getAvailableVariantPills } from '../../lib/variantUtils';
import { getWaUrl, buildDefaultGreetingWaText } from '../../lib/phoneUtils';

// Re-export untuk kompatibilitas
export { CANTEEN_ZONES };

/** Helper: cari objek zona berdasarkan id */
const getZone = getCanteenZone;

/** Format angka ke Rp X.XXX */
const rp = (n) => `Rp ${(n || 0).toLocaleString('id-ID')}`;

/** Standar preset jam operasional di Indonesia (WIB) */
const INDONESIA_HOUR_PRESETS = [
  { label: 'Standar Pondok', open: '06:00', close: '21:00', desc: '06:00 - 21:00 WIB' },
  { label: 'Pagi - Sore', open: '07:00', close: '17:00', desc: '07:00 - 17:00 WIB' },
  { label: 'Full Day', open: '06:00', close: '22:00', desc: '06:00 - 22:00 WIB' },
  { label: 'Kantin Malam', open: '16:00', close: '23:00', desc: '16:00 - 23:00 WIB' },
  { label: '24 Jam Penuh', open: '00:00', close: '23:59', desc: '00:00 - 23:59 WIB' },
];

export default function Pertokoan() {
  const queryClient = useQueryClient();

  // Role detection: Super Admin
  const currentUser = useAuthStore((state) => state.user);
  const originalAdmin = useAuthStore((state) => state.originalAdmin);
  const isSuperAdmin = currentUser?.role === ROLES.SUPER_ADMIN || originalAdmin?.role === ROLES.SUPER_ADMIN;

  // Selected detail canteen modal
  const [selectedCanteen, setSelectedCanteen] = useState(null);

  // Super Admin delete canteen confirmation modal state
  const [canteenToDelete, setCanteenToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // Quick Hours Edit modal for a single canteen
  const [quickHoursCanteen, setQuickHoursCanteen] = useState(null);
  const [quickOpenTime, setQuickOpenTime] = useState('08:00');
  const [quickCloseTime, setQuickCloseTime] = useState('22:00');
  const [quickClosedDays, setQuickClosedDays] = useState([]);

  // Quick Courier Assignment modal for a single canteen
  const [courierModalCanteen, setCourierModalCanteen] = useState(null);
  const [selectedCourierIds, setSelectedCourierIds] = useState([]);

  // Bulk Hours Edit modal
  const [isBulkHoursModalOpen, setIsBulkHoursModalOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('all');
  const [bulkOpenTime, setBulkOpenTime] = useState('06:00');
  const [bulkCloseTime, setBulkCloseTime] = useState('21:00');
  const [bulkReopenForceClosed, setBulkReopenForceClosed] = useState(true);

  // Live Realtime Waktu Indonesia (WIB / Asia/Jakarta)
  const [currentWibTime, setCurrentWibTime] = useState(() => {
    return new Date().toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentWibTime(new Date().toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // all, open, schedule_closed, force_closed, pending, kauman, kota

  // Detail Modal specific states
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalNotes, setWithdrawalNotes] = useState('');
  const [detailOpenTime, setDetailOpenTime] = useState('');
  const [detailCloseTime, setDetailCloseTime] = useState('');
  const [detailClosedDays, setDetailClosedDays] = useState([]);
  const [detailCategory, setDetailCategory] = useState('kauman');

  // Detail Modal Tab & Menu Listing states
  const [detailTab, setDetailTab] = useState('info'); // 'info' | 'menu'
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState('all');
  const [menuStatusFilter, setMenuStatusFilter] = useState('all'); // 'all' | 'available' | 'unavailable'
  const [viewProductImage, setViewProductImage] = useState(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Banner Management states for selected canteen
  const [newBannerTitle, setNewBannerTitle] = useState('');
  const [newBannerFile, setNewBannerFile] = useState(null);
  const [newBannerPreview, setNewBannerPreview] = useState(null);
  const [showBannerForm, setShowBannerForm] = useState(false);

  // Canteen Main Photo states for selected canteen
  const [canteenPhotoFile, setCanteenPhotoFile] = useState(null);
  const [canteenPhotoPreview, setCanteenPhotoPreview] = useState(null);

  // 1. Fetch Canteens List
  const { data: canteens, isLoading } = useQuery({
    queryKey: ['admin-canteens'],
    queryFn: async () => {
      const res = await axios.get('/admin/canteens');
      return res.data.data || res.data;
    }
  });

  // 2. Fetch Global Emergency Status
  const { data: globalStatus } = useQuery({
    queryKey: ['admin-canteens-status'],
    queryFn: async () => {
      const res = await axios.get('/admin/canteens/status');
      return res.data;
    }
  });

  // 3. Fetch Couriers List for Store Assignment
  const { data: couriersList = [] } = useQuery({
    queryKey: ['admin_couriers_list'],
    queryFn: async () => {
      const res = await axios.get('/admin/couriers-list');
      return res.data || [];
    }
  });

  const isGlobalForceClosed = Boolean(globalStatus?.is_global_force_closed);

  const invalidateAllCanteenQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-canteens'] });
    queryClient.invalidateQueries({ queryKey: ['admin-canteens-status'] });
    queryClient.invalidateQueries({ queryKey: ['admin_couriers_list'] });
    queryClient.invalidateQueries({ queryKey: ['canteens'] });
    queryClient.invalidateQueries({ queryKey: ['public_canteens_list'] });
    queryClient.invalidateQueries({ queryKey: ['my_canteens_list'] });
    queryClient.invalidateQueries({ queryKey: ['banners'] });
  };

  // --- MUTATIONS ---

  // Bulk Close Mutation (Master Switch Close)
  const bulkCloseMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post('/admin/canteens/bulk-close');
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Semua toko berhasil ditutup langsung!');
      invalidateAllCanteenQueries();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal menutup semua toko');
    }
  });

  // Bulk Open Mutation (Master Switch Open)
  const bulkOpenMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post('/admin/canteens/bulk-open', { reset_all: true });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Semua toko berhasil dibuka kembali (mengikuti jadwal operasional)!');
      invalidateAllCanteenQueries();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal membuka semua toko');
    }
  });

  // Bulk Update Operating Hours Mutation
  const bulkUpdateHoursMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await axios.post('/admin/canteens/bulk-hours', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Jam operasional massal berhasil diperbarui!');
      invalidateAllCanteenQueries();
      setIsBulkHoursModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal memperbarui jam operasional massal');
    }
  });

  // Toggle Direct Close for a Single Canteen
  const toggleDirectCloseMutation = useMutation({
    mutationFn: async ({ id, force_close }) => {
      const res = await axios.put(`/admin/canteens/${id}/toggle-direct-close`, { force_close });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Status penutupan toko berhasil diperbarui');
      invalidateAllCanteenQueries();
      if (selectedCanteen && selectedCanteen.id === data.canteen?.id) {
        setSelectedCanteen(data.canteen);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal mengubah status penutupan toko');
    }
  });

  // Update Single Canteen Operating Hours
  const updateHoursMutation = useMutation({
    mutationFn: async ({ id, open_time, close_time, closed_days }) => {
      const res = await axios.put(`/admin/canteens/${id}/hours`, { open_time, close_time, closed_days });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Jam operasional berhasil diperbarui');
      invalidateAllCanteenQueries();
      if (selectedCanteen && selectedCanteen.id === data.canteen?.id) {
        setSelectedCanteen(data.canteen);
      }
      setQuickHoursCanteen(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal memperbarui jam operasional');
    }
  });

  // Approve Canteen Mutation
  const approveCanteenMutation = useMutation({
    mutationFn: async (id) => {
      const res = await axios.post(`/admin/canteens/${id}/approve`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Kantin berhasil disetujui');
      invalidateAllCanteenQueries();
      if (selectedCanteen && selectedCanteen.id === data.canteen?.id) {
        setSelectedCanteen(data.canteen);
      }
    }
  });

  // Reject Canteen Mutation
  const rejectCanteenMutation = useMutation({
    mutationFn: async (id) => {
      const res = await axios.post(`/admin/canteens/${id}/reject`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Izin kantin dinonaktifkan');
      invalidateAllCanteenQueries();
      if (selectedCanteen && selectedCanteen.id === data.canteen?.id) {
        setSelectedCanteen(data.canteen);
      }
    }
  });

  // Update Category & Fees
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, category }) => {
      const targetZone = getZone(category);
      const res = await axios.put(`/admin/canteens/${id}/fees`, { 
        category,
        delivery_fee: targetZone?.deliveryFee,
        admin_fee: targetZone?.adminFee
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Zona lokasi & tarif berhasil diperbarui');
      invalidateAllCanteenQueries();
      if (selectedCanteen && selectedCanteen.id === data.canteen?.id) {
        setSelectedCanteen(data.canteen);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal mengubah tarif zona');
    }
  });

  // Update Canteen Couriers
  const updateCouriersMutation = useMutation({
    mutationFn: async ({ id, courier_ids }) => {
      const res = await axios.put(`/admin/canteens/${id}/couriers`, { courier_ids });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Kurir toko berhasil diperbarui');
      invalidateAllCanteenQueries();
      if (selectedCanteen && selectedCanteen.id === data.canteen?.id) {
        setSelectedCanteen(data.canteen);
      }
      setCourierModalCanteen(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal memperbarui kurir toko');
    }
  });

  // Withdraw Canteen Balance
  const withdrawMutation = useMutation({
    mutationFn: async ({ id, amount, notes }) => {
      const res = await axios.post(`/admin/canteens/${id}/withdraw`, { amount, notes });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Pencairan dana berhasil diproses');
      invalidateAllCanteenQueries();
      setWithdrawalAmount('');
      setWithdrawalNotes('');
      if (selectedCanteen && selectedCanteen.id === data.canteen?.id) {
        setSelectedCanteen(data.canteen);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal memproses pencairan dana');
    }
  });

  // --- BANNER MUTATIONS ---
  const uploadBannerMutation = useMutation({
    mutationFn: async (formData) => {
      const res = await axios.post(`/canteen/banners?canteen_id=${selectedCanteen.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Banner toko berhasil ditambahkan');
      invalidateAllCanteenQueries();
      setNewBannerTitle('');
      setNewBannerFile(null);
      setNewBannerPreview(null);
      if (selectedCanteen && data.banner) {
        setSelectedCanteen(prev => prev ? ({
          ...prev,
          banners: [data.banner, ...(prev.banners || [])]
        }) : null);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal mengunggah banner toko');
    }
  });

  const toggleBannerStatusMutation = useMutation({
    mutationFn: async (bannerId) => {
      const res = await axios.put(`/canteen/banners/${bannerId}/status`);
      return res.data;
    },
    onSuccess: (data, bannerId) => {
      toast.success(data.message || 'Status tayang banner berhasil diubah');
      invalidateAllCanteenQueries();
      if (selectedCanteen && selectedCanteen.banners) {
        setSelectedCanteen(prev => prev ? ({
          ...prev,
          banners: prev.banners.map(b => b.id === bannerId ? { ...b, status: b.status === 'active' ? 'inactive' : 'active' } : b)
        }) : null);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal mengubah status banner');
    }
  });

  const deleteBannerMutation = useMutation({
    mutationFn: async (bannerId) => {
      const res = await axios.delete(`/canteen/banners/${bannerId}`);
      return res.data;
    },
    onSuccess: (data, bannerId) => {
      toast.success(data.message || 'Banner toko berhasil dihapus');
      invalidateAllCanteenQueries();
      if (selectedCanteen && selectedCanteen.banners) {
        setSelectedCanteen(prev => prev ? ({
          ...prev,
          banners: prev.banners.filter(b => b.id !== bannerId)
        }) : null);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal menghapus banner');
    }
  });

  // Update Canteen Main Photo (Super Admin / Admin)
  const updateCanteenPhotoMutation = useMutation({
    mutationFn: async ({ id, file }) => {
      const formData = new FormData();
      formData.append('canteen_id', id);
      formData.append('name', selectedCanteen.name);
      formData.append('image', file);
      const res = await axios.post(`/my-canteen?canteen_id=${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Foto utama toko berhasil diperbarui ke Google Drive!');
      invalidateAllCanteenQueries();
      if (selectedCanteen && data.canteen) {
        setSelectedCanteen(prev => ({ ...prev, image: data.canteen.image }));
      }
      setCanteenPhotoFile(null);
      setCanteenPhotoPreview(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal mengunggah foto toko');
    }
  });

  const deleteCanteenMutation = useMutation({
    mutationFn: async (id) => {
      const res = await axios.delete(`/admin/canteens/${id}`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Toko beserta seluruh produk, pesanan, dan rekap profit berhasil dihapus.');
      invalidateAllCanteenQueries();
      setCanteenToDelete(null);
      setDeleteConfirmText('');
      if (selectedCanteen && canteenToDelete && selectedCanteen.id === canteenToDelete.id) {
        setSelectedCanteen(null);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal menghapus toko.');
    }
  });

  // Fetch products for selected canteen in detail modal (fallback & real-time cache)
  const { 
    data: canteenProductsData, 
    isLoading: isLoadingProducts, 
    refetch: refetchProducts 
  } = useQuery({
    queryKey: ['canteen-products', selectedCanteen?.id],
    queryFn: async () => {
      const res = await axios.get(`/my-products?canteen_id=${selectedCanteen.id}&all=true`);
      return res.data?.data || res.data || [];
    },
    enabled: !!selectedCanteen?.id,
    staleTime: 1000 * 60 * 2,
  });

  // Toggle product availability mutation
  const toggleProductAvailabilityMutation = useMutation({
    mutationFn: async (productId) => {
      const res = await axios.put(`/admin/products/${productId}/toggle-availability`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Status ketersediaan menu berhasil diperbarui');
      queryClient.invalidateQueries({ queryKey: ['canteen-products', selectedCanteen?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-canteens'] });
      if (selectedCanteen && selectedCanteen.products) {
        const updated = (selectedCanteen.products || []).map(p => 
          p.id === data.product?.id ? { ...p, is_available: data.product.is_available } : p
        );
        setSelectedCanteen({ ...selectedCanteen, products: updated });
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal mengubah status ketersediaan menu');
    }
  });

  // Save/Update Product Mutation (Admin / Super Admin)
  const saveProductMutation = useMutation({
    mutationFn: async (formData) => {
      const activeCanteenId = selectedCanteen.id;
      if (editingProduct) {
        formData.append('_method', 'PUT');
        const res = await axios.post(`/my-products/${editingProduct.id}?canteen_id=${activeCanteenId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res.data;
      }
      const res = await axios.post(`/my-products?canteen_id=${activeCanteenId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(editingProduct ? 'Menu berhasil diperbarui!' : 'Menu baru berhasil ditambahkan!');
      setIsProductModalOpen(false);
      setEditingProduct(null);
      queryClient.invalidateQueries({ queryKey: ['canteen-products', selectedCanteen?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-canteens'] });
      if (selectedCanteen && selectedCanteen.products) {
        const prodData = data.product?.data || data.product;
        if (prodData) {
          if (editingProduct) {
            const updated = selectedCanteen.products.map(p => p.id === prodData.id ? prodData : p);
            setSelectedCanteen({ ...selectedCanteen, products: updated });
          } else {
            setSelectedCanteen({ ...selectedCanteen, products: [prodData, ...selectedCanteen.products] });
          }
        }
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal menyimpan data menu');
    }
  });

  const handleSaveProduct = async (data, file) => {
    if (!selectedCanteen) return;
    const formData = new FormData();
    const priceVal = parseFloat(data.price || 0);
    const fallbackHpp = priceVal > 1000 ? priceVal - 1000 : priceVal;
    const finalHpp = data.hpp !== undefined && data.hpp !== '' ? parseFloat(data.hpp) : fallbackHpp;

    formData.append('name', data.name);
    formData.append('category', data.category || '');
    formData.append('description', data.description || '');
    if (data.variant_config) {
      formData.append('variant_config', typeof data.variant_config === 'string' ? data.variant_config : JSON.stringify(data.variant_config));
    }
    formData.append('price', priceVal);
    formData.append('hpj', priceVal);
    formData.append('hpp', finalHpp);
    formData.append('stock', parseInt(data.stock || 0, 10));
    formData.append('is_available', data.is_available ? 1 : 0);
    
    if (file) {
      formData.append('image', file);
    }
    formData.append('canteen_id', selectedCanteen.id);
    
    await saveProductMutation.mutateAsync(formData);
  };

  // Delete product mutation (Admin / Super Admin)
  const deleteProductMutation = useMutation({
    mutationFn: async (productId) => {
      const res = await axios.delete(`/my-products/${productId}?canteen_id=${selectedCanteen.id}`);
      return res.data;
    },
    onSuccess: (data, productId) => {
      toast.success(data.message || 'Menu berhasil dihapus');
      queryClient.invalidateQueries({ queryKey: ['canteen-products', selectedCanteen?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-canteens'] });
      if (selectedCanteen && selectedCanteen.products) {
        const updated = selectedCanteen.products.filter(p => p.id !== productId);
        setSelectedCanteen({ ...selectedCanteen, products: updated });
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal menghapus menu');
    }
  });

  const handleBannerFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        toast.error('Ukuran file banner maksimal 3MB');
        return;
      }
      setNewBannerFile(file);
      setNewBannerPreview(URL.createObjectURL(file));
    }
  };

  const handleUploadBannerSubmit = (e) => {
    e.preventDefault();
    if (!selectedCanteen) return;
    if (!newBannerFile) {
      toast.error('Pilih gambar banner terlebih dahulu');
      return;
    }
    if (!newBannerTitle.trim()) {
      toast.error('Judul banner wajib diisi');
      return;
    }

    const formData = new FormData();
    formData.append('title', newBannerTitle.trim());
    formData.append('image', newBannerFile);
    formData.append('canteen_id', selectedCanteen.id);

    uploadBannerMutation.mutate(formData);
  };

  // --- HANDLERS ---
  const handleOpenDetail = (canteen) => {
    setSelectedCanteen(canteen);
    setDetailTab('info');
    setMenuSearch('');
    setMenuCategoryFilter('all');
    setMenuStatusFilter('all');
    setViewProductImage(null);
    setIsProductModalOpen(false);
    setEditingProduct(null);
    setDetailCategory(canteen.category || 'kauman');
    setDetailOpenTime(canteen.open_time?.substring(0, 5) || '08:00');
    setDetailCloseTime(canteen.close_time?.substring(0, 5) || '22:00');
    setDetailClosedDays(Array.isArray(canteen.closed_days) ? canteen.closed_days : []);
    setWithdrawalAmount('');
    setWithdrawalNotes('');
    setNewBannerTitle('');
    setNewBannerFile(null);
    setNewBannerPreview(null);
  };

  const handleOpenQuickHours = (e, canteen) => {
    e.stopPropagation();
    setQuickHoursCanteen(canteen);
    setQuickOpenTime(canteen.open_time?.substring(0, 5) || '08:00');
    setQuickCloseTime(canteen.close_time?.substring(0, 5) || '22:00');
    setQuickClosedDays(Array.isArray(canteen.closed_days) ? canteen.closed_days : []);
  };

  const handleOpenCourierModal = (e, canteen) => {
    e?.stopPropagation();
    setCourierModalCanteen(canteen);
    const currentIds = canteen.couriers ? canteen.couriers.map(c => c.id) : (canteen.courier_ids || []);
    setSelectedCourierIds(currentIds);
  };

  const handleDirectToggleClose = (e, canteen) => {
    e.stopPropagation();
    const isCurrentlyForceClosed = canteen.is_force_closed;
    const confirmMsg = isCurrentlyForceClosed
      ? `Buka kembali toko "${canteen.name}" agar beroperasi sesuai jam (${canteen.open_time?.substring(0,5) || '08:00'} - ${canteen.close_time?.substring(0,5) || '22:00'})?`
      : `Tutup langsung toko "${canteen.name}" sekarang juga? Santri tidak dapat memesan hingga toko dibuka kembali.`;
    
    if (window.confirm(confirmMsg)) {
      toggleDirectCloseMutation.mutate({
        id: canteen.id,
        force_close: !isCurrentlyForceClosed
      });
    }
  };

  const handleBulkClose = () => {
    if (window.confirm('⚠️ PERINGATAN DARURAT: Apakah Anda yakin ingin MENUTUP SELURUH TOKO secara langsung? Seluruh toko akan ditutup seketika dan santri tidak dapat memesan.')) {
      bulkCloseMutation.mutate();
    }
  };

  const handleBulkOpen = () => {
    if (window.confirm('Aktifkan dan Buka kembali semua toko agar beroperasi sesuai jadwal jam operasional masing-masing?')) {
      bulkOpenMutation.mutate();
    }
  };

  const handleSaveBulkHours = (e) => {
    e.preventDefault();
    const categoryName = bulkCategory === 'all'
      ? 'Semua Toko'
      : getZone(bulkCategory).label;
    if (window.confirm(`Terapkan jam operasional ${bulkOpenTime} - ${bulkCloseTime} WIB ke ${categoryName}?`)) {
      bulkUpdateHoursMutation.mutate({
        open_time: bulkOpenTime,
        close_time: bulkCloseTime,
        category: bulkCategory,
        reopen_force_closed: bulkReopenForceClosed
      });
    }
  };

  // --- STATS CALCULATION ---
  const canteensList = Array.isArray(canteens) ? canteens : [];
  const totalCount = canteensList.length;
  const openCount = canteensList.filter(c => c.status === 'approved' && c.is_open).length;
  const forceClosedCount = canteensList.filter(c => c.status === 'approved' && c.is_force_closed).length;
  const scheduleClosedCount = canteensList.filter(c => c.status === 'approved' && !c.is_open && !c.is_force_closed).length;
  const pendingCount = canteensList.filter(c => c.status === 'pending').length;
  const withBannerCount = canteensList.filter(c => c.banners && c.banners.length > 0).length;
  const withoutBannerCount = totalCount - withBannerCount;

  // --- FILTERED CANTEENS ---
  const filteredCanteens = canteensList.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.user?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filterTab === 'open') return c.status === 'approved' && c.is_open;
    if (filterTab === 'force_closed') return c.status === 'approved' && c.is_force_closed;
    if (filterTab === 'schedule_closed') return c.status === 'approved' && !c.is_open && !c.is_force_closed;
    if (filterTab === 'pending') return c.status === 'pending';
    if (filterTab === 'has_banner') return Boolean(c.banners && c.banners.length > 0);
    if (filterTab === 'no_banner') return !c.banners || c.banners.length === 0;
    // Filter zona dinamis dari CANTEEN_ZONES
    if (CANTEEN_ZONES.some(z => z.id === filterTab)) return c.category === filterTab;
    return true;
  });

  // --- DETAIL MODAL PRODUCTS CALCULATION ---
  const rawProducts = canteenProductsData || selectedCanteen?.products || [];
  const totalProductsCount = rawProducts.length;
  const availableProductsCount = rawProducts.filter(p => p.is_available).length;
  const unavailableProductsCount = totalProductsCount - availableProductsCount;

  // Extract unique categories from products
  const productCategories = Array.from(new Set(rawProducts.map(p => p.category).filter(Boolean)));

  // Filter products by search, category, and status
  const filteredProducts = rawProducts.filter(p => {
    const matchesSearch = !menuSearch || 
      p.name?.toLowerCase().includes(menuSearch.toLowerCase()) || 
      p.description?.toLowerCase().includes(menuSearch.toLowerCase());
    const matchesCategory = menuCategoryFilter === 'all' || p.category === menuCategoryFilter;
    const matchesStatus = menuStatusFilter === 'all' || 
      (menuStatusFilter === 'available' && p.is_available) || 
      (menuStatusFilter === 'unavailable' && !p.is_available);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <>
      <div className="space-y-2 animate-fade-in-up pb-20 max-w-7xl mx-auto px-1 sm:px-2">
        
        {/* UNIFIED COMPACT HEADER & MASTER ACTIONS */}
        <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2">
          {/* Left Title Info */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-none bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-800 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0">
              <Store className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm sm:text-base font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                  Manajemen Toko & Jam Operasional
                </h1>
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-none text-[10px] font-bold border border-gray-200 dark:border-gray-700">
                  Total {totalCount}
                </span>
                <span className="text-[9px] font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/80 px-1.5 py-0.5 rounded-none border border-green-200 dark:border-green-800 hidden sm:inline-block">
                  Live Realtime
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate hidden sm:block">
                Kelola status buka/tutup, jam operasional massal, serta zona tarif toko langsung.
              </p>
            </div>
          </div>

          {/* Right: Master Control Actions Bar (Inline & Sleek) */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
            {/* Action 1: Atur Jam Semua Toko */}
            <button
              type="button"
              onClick={() => setIsBulkHoursModalOpen(true)}
              className="px-2.5 py-1 rounded-none font-bold text-xs flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white shadow-xs transition-all cursor-pointer"
            >
              <Clock className="w-3 h-3" />
              <span>Atur Jam Semua</span>
            </button>

            {/* Action 2: Buka Semua (Ikuti Jadwal) */}
            <button
              type="button"
              onClick={handleBulkOpen}
              disabled={bulkOpenMutation.isPending}
              className="px-2.5 py-1 rounded-none font-bold text-xs flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 shadow-xs transition-all cursor-pointer"
            >
              <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
              <span>{bulkOpenMutation.isPending ? 'Membuka...' : 'Buka Semua'}</span>
            </button>

            {/* Action 3: Tutup Semua Toko Darurat */}
            <button
              type="button"
              onClick={handleBulkClose}
              disabled={bulkCloseMutation.isPending || isGlobalForceClosed}
              className={`px-2.5 py-1 rounded-none font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                isGlobalForceClosed 
                  ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 border border-transparent cursor-not-allowed'
                  : 'bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
              }`}
            >
              <Power className="w-3 h-3 text-red-600 dark:text-red-400" />
              <span>{bulkCloseMutation.isPending ? 'Menutup...' : 'Tutup Semua'}</span>
            </button>
          </div>
        </div>

        {/* EMERGENCY ALERT (If All Stores Closed) */}
        {isGlobalForceClosed && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-none p-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-none bg-red-600 text-white flex items-center justify-center shrink-0">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-red-700 dark:text-red-300">
                  Seluruh Toko Sedang Ditutup Langsung oleh Admin
                </h4>
                <p className="text-[10px] text-red-600 dark:text-red-400">
                  Santri tidak dapat membuat pesanan di semua toko saat ini.
                </p>
              </div>
            </div>
            <button
              onClick={handleBulkOpen}
              disabled={bulkOpenMutation.isPending}
              className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-none shadow-xs transition-all shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${bulkOpenMutation.isPending ? 'animate-spin' : ''}`} />
              <span>Buka Kembali Semua Toko</span>
            </button>
          </div>
        )}

        {/* STATUS COUNTER CARDS (Interactive Filter) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
          
          {/* Card: Sedang Buka */}
          <div 
            onClick={() => setFilterTab('open')}
            className={`cursor-pointer px-2.5 py-1.5 rounded-none border transition-all duration-150 relative ${
              filterTab === 'open' 
                ? 'bg-green-50 dark:bg-green-950/40 border-green-500 ring-1 ring-green-500' 
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sedang Buka</span>
              <div className="w-1.5 h-1.5 rounded-none bg-emerald-500 animate-pulse"></div>
            </div>
            <div className="flex items-baseline justify-between mt-0.5">
              <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono leading-none">{openCount}</p>
              <span className="text-[9px] text-gray-400">Terima order</span>
            </div>
          </div>

          {/* Card: Tutup Jadwal */}
          <div 
            onClick={() => setFilterTab('schedule_closed')}
            className={`cursor-pointer px-2.5 py-1.5 rounded-none border transition-all duration-150 relative ${
              filterTab === 'schedule_closed' 
                ? 'bg-gray-100 dark:bg-gray-800 border-gray-400 dark:border-gray-500 ring-1 ring-gray-400' 
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tutup Jadwal</span>
              <div className="w-1.5 h-1.5 rounded-none bg-gray-400"></div>
            </div>
            <div className="flex items-baseline justify-between mt-0.5">
              <p className="text-base sm:text-lg font-black text-gray-700 dark:text-gray-300 font-mono leading-none">{scheduleClosedCount}</p>
              <span className="text-[9px] text-gray-400">Di luar jam buka</span>
            </div>
          </div>

          {/* Card: Tutup Langsung */}
          <div 
            onClick={() => setFilterTab('force_closed')}
            className={`cursor-pointer px-2.5 py-1.5 rounded-none border transition-all duration-150 relative ${
              filterTab === 'force_closed' 
                ? 'bg-red-50 dark:bg-red-950/40 border-red-500 ring-1 ring-red-500' 
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tutup Langsung</span>
              <div className="w-1.5 h-1.5 rounded-none bg-red-500"></div>
            </div>
            <div className="flex items-baseline justify-between mt-0.5">
              <p className="text-base sm:text-lg font-black text-red-600 dark:text-red-400 font-mono leading-none">{forceClosedCount}</p>
              <span className="text-[9px] text-gray-400">Kunci admin</span>
            </div>
          </div>

          {/* Card: Pasang Banner Promosi */}
          <div 
            onClick={() => setFilterTab(filterTab === 'has_banner' ? 'all' : 'has_banner')}
            className={`cursor-pointer px-2.5 py-1.5 rounded-none border transition-all duration-150 relative ${
              filterTab === 'has_banner' 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500' 
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pasang Banner</span>
              <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-baseline justify-between mt-0.5">
              <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono leading-none">{withBannerCount}</p>
              <span className="text-[9px] text-gray-400">{withBannerCount} dari {totalCount} toko</span>
            </div>
          </div>

          {/* Card: Menunggu Review */}
          <div 
            onClick={() => setFilterTab('pending')}
            className={`cursor-pointer px-2.5 py-1.5 rounded-none border transition-all duration-150 relative ${
              filterTab === 'pending' 
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 ring-1 ring-amber-500' 
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Review Baru</span>
              <div className="w-1.5 h-1.5 rounded-none bg-amber-500"></div>
            </div>
            <div className="flex items-baseline justify-between mt-0.5">
              <p className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 font-mono leading-none">{pendingCount}</p>
              <span className="text-[9px] text-gray-400">Pengajuan toko</span>
            </div>
          </div>
        </div>

        {/* SEARCH & FILTER CONTROLS */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-1.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari toko, pemilik, atau kamar santri..."
              className="w-full pl-8 pr-7 py-1 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-none shadow-xs focus:ring-1 focus:ring-green-500 focus:border-green-500 text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded-none cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter Pills Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar pb-0.5 text-xs font-bold">
            {[
              { id: 'all', label: `Semua (${totalCount})` },
              { id: 'has_banner', label: `🖼️ Ada Banner (${withBannerCount})` },
              { id: 'no_banner', label: `Tanpa Banner (${withoutBannerCount})` },
              { id: 'open', label: `Buka (${openCount})` },
              { id: 'schedule_closed', label: `Tutup Jadwal (${scheduleClosedCount})` },
              { id: 'force_closed', label: `Tutup Langsung (${forceClosedCount})` },
              ...CANTEEN_ZONES.map(z => ({ id: z.id, label: z.label })),
              { id: 'pending', label: `Review (${pendingCount})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={`px-2 py-1 rounded-none whitespace-nowrap transition-all cursor-pointer text-[11px] ${
                  filterTab === tab.id
                    ? 'bg-green-600 text-white shadow-xs'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* CANTEEN CARDS GRID */}
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-1.5 animate-pulse">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-20 bg-gray-200 dark:bg-gray-800 rounded-none"></div>
              ))}
            </div>
          ) : filteredCanteens.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-1.5">
              {filteredCanteens.map((canteen) => {
                const isKota = canteen.category === 'kota';
                const openFormatted = canteen.open_time?.substring(0, 5) || '08:00';
                const closeFormatted = canteen.close_time?.substring(0, 5) || '22:00';

                return (
                  <div 
                    key={canteen.id} 
                    className="bg-white dark:bg-gray-900 rounded-none p-2 border border-gray-200 dark:border-gray-800 shadow-2xs hover:border-green-500 dark:hover:border-green-600 transition-all flex flex-col justify-between gap-1 relative overflow-hidden group"
                  >
                    {/* Upper Row: Image, Store Name, Zone, Owner, Balance */}
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-7 h-7 rounded-none bg-green-50 dark:bg-green-950/50 border border-green-100 dark:border-green-900/40 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0 overflow-hidden relative">
                          {canteen.image ? (
                            <AppImage src={canteen.image} alt={canteen.name} className="w-full h-full object-cover" />
                          ) : (
                            <Store className="w-3.5 h-3.5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <h3 className="font-bold text-xs text-gray-900 dark:text-gray-100 truncate leading-tight">
                              {canteen.name}
                            </h3>
                            <span className={`px-1 py-0.2 text-[8px] font-bold rounded-none border shrink-0 ${
                              canteen.category === 'kota' 
                                ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800' 
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                            }`}>
                              {getZone(canteen.category)?.label?.replace('Zona ', '') || (canteen.category || 'Kauman')}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                            <span className="truncate flex items-center gap-0.5">
                              <User className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                              <span className="truncate">{canteen.user?.name || '-'}</span>
                            </span>
                            <span className="text-gray-300 dark:text-gray-700 shrink-0">•</span>
                            <span 
                              onClick={(e) => handleOpenCourierModal(e, canteen)}
                              className="truncate flex items-center gap-0.5 font-medium cursor-pointer hover:underline text-gray-700 dark:text-gray-300"
                              title="Klik untuk mengatur kurir"
                            >
                              <Truck className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="truncate">
                                {canteen.couriers && canteen.couriers.length > 0
                                  ? canteen.couriers.map(c => c.name).join(', ')
                                  : 'Belum ada kurir'}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Saldo Badge */}
                      <div className="flex flex-col items-end shrink-0 bg-gray-50 dark:bg-gray-800/60 px-1.5 py-0.5 rounded-none border border-gray-200 dark:border-gray-700/60">
                        <span className="text-[7px] font-semibold text-gray-400 uppercase leading-none">Saldo</span>
                        <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 font-mono leading-tight">
                          Rp {parseFloat(canteen.balance || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Operational Status Badge & Toggle Button */}
                    <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-gray-100 dark:border-gray-800">
                      <div className="min-w-0">
                        {canteen.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[9px] font-bold rounded-none border border-amber-200 dark:border-amber-800 truncate">
                            <span className="w-1.5 h-1.5 rounded-none bg-amber-500 animate-pulse shrink-0"></span>
                            Review
                          </span>
                        ) : canteen.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300 text-[9px] font-bold rounded-none truncate">
                            <XCircle className="w-2.5 h-2.5 shrink-0" />
                            Nonaktif
                          </span>
                        ) : canteen.is_force_closed ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 text-[9px] font-bold rounded-none border border-red-200 dark:border-red-800 truncate">
                            <Power className="w-2.5 h-2.5 text-red-600 shrink-0" />
                            Tutup Paksa
                          </span>
                        ) : canteen.is_open ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[9px] font-bold rounded-none border border-emerald-200 dark:border-emerald-800 truncate">
                            <span className="w-1.5 h-1.5 rounded-none bg-emerald-500 animate-pulse shrink-0"></span>
                            Buka ({openFormatted}-{closeFormatted} WIB)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-[9px] font-semibold rounded-none border border-gray-200 dark:border-gray-700 truncate">
                            <Clock className="w-2.5 h-2.5 text-gray-500 shrink-0" />
                            Tutup ({openFormatted}-{closeFormatted} WIB)
                          </span>
                        )}
                      </div>

                      {/* Direct Toggle Action (Approve if pending, or Buka/Tutup) */}
                      <div>
                        {canteen.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Setujui pendaftaran toko "${canteen.name}" sekarang?`)) {
                                approveCanteenMutation.mutate(canteen.id);
                              }
                            }}
                            disabled={approveCanteenMutation.isPending}
                            title="Setujui toko ini agar mulai aktif berjualan"
                            className="px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded-none text-[10px] font-bold flex items-center gap-1 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                          >
                            <CheckCircle size={10} />
                            <span>{approveCanteenMutation.isPending ? '...' : 'Setujui'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleDirectToggleClose(e, canteen)}
                            disabled={toggleDirectCloseMutation.isPending}
                            title={canteen.is_force_closed ? 'Buka toko kembali' : 'Tutup toko sekarang'}
                            className={`px-2 py-0.5 rounded-none text-[10px] font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer ${
                              canteen.is_force_closed
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800'
                            }`}
                          >
                            <Power className="w-2.5 h-2.5" />
                            <span>{canteen.is_force_closed ? 'Buka' : 'Tutup'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: 4 Equal-Width Action Buttons Grid (Presisi & Bebas Potong) */}
                    <div className="grid grid-cols-4 gap-1 pt-1 border-t border-gray-100 dark:border-gray-800">
                      {/* Tombol 1: Kurir */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenCourierModal(e, canteen)}
                        title="Atur kurir yang bertugas untuk toko ini"
                        className={`w-full py-1 px-0.5 rounded-none text-[10px] font-bold flex items-center justify-center gap-0.5 transition-colors border cursor-pointer truncate ${
                          canteen.couriers?.length > 0
                            ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                        }`}
                      >
                        <Truck className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">Kurir{canteen.couriers?.length > 0 ? ` (${canteen.couriers.length})` : ''}</span>
                      </button>

                      {/* Tombol 2: Banner */}
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(canteen)}
                        title="Kelola banner promosi toko ini"
                        className={`w-full py-1 px-0.5 rounded-none text-[10px] font-bold flex items-center justify-center gap-0.5 transition-colors border cursor-pointer truncate ${
                          canteen.banners?.length > 0
                            ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <ImageIcon className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">Banner{canteen.banners?.length > 0 ? ` (${canteen.banners.length})` : ''}</span>
                      </button>

                      {/* Tombol 3: Jam */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenQuickHours(e, canteen)}
                        title="Atur jam buka/tutup toko ini"
                        className="w-full py-1 px-0.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-none text-[10px] font-bold flex items-center justify-center gap-0.5 transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer truncate"
                      >
                        <Clock className="w-2.5 h-2.5 shrink-0 text-gray-500" />
                        <span className="truncate">Jam</span>
                      </button>

                      {/* Tombol 4: Detail */}
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(canteen)}
                        title="Buka rincian lengkap toko"
                        className="w-full py-1 px-0.5 bg-green-600 hover:bg-green-700 active:scale-98 text-white rounded-none text-[10px] font-bold transition-all shadow-xs flex items-center justify-center gap-0.5 cursor-pointer truncate"
                      >
                        <span className="truncate">Detail</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 p-6 flex flex-col items-center justify-center rounded-none border border-dashed border-gray-200 dark:border-gray-700 text-center shadow-xs">
              <Store className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-1.5" />
              <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200">Tidak ada toko ditemukan</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 max-w-xs">
                {searchTerm ? 'Coba ubah kata kunci pencarian Anda.' : 'Belum ada data toko pada kategori ini.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL 1: ATUR JAM SEMUA TOKO (BULK HOURS MODAL) --- */}
      {isBulkHoursModalOpen && createPortal(
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none w-full max-w-md p-3.5 sm:p-4 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-3 my-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-none bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 flex items-center justify-center border border-green-300 dark:border-green-800">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">Atur Jam Semua Toko</h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Terapkan jadwal buka/tutup serentak (WIB)</p>
                </div>
              </div>
              <button 
                onClick={() => setIsBulkHoursModalOpen(false)}
                className="w-7 h-7 rounded-none bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 flex items-center justify-center transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Live Realtime Indonesia (WIB) Banner */}
            <div className="flex items-center justify-between p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
              <span className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600 animate-pulse shrink-0" />
                Waktu Saat Ini (Indonesia / WIB):
              </span>
              <span className="font-mono font-black text-emerald-700 dark:text-emerald-400">
                {currentWibTime} WIB
              </span>
            </div>

            <form onSubmit={handleSaveBulkHours} className="space-y-3 text-xs">
              {/* Target Zona */}
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1 text-[11px]">
                  Terapkan ke Kategori Toko:
                </label>
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 p-2 font-bold text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-green-500"
                >
                  <option value="all">Semua Toko ({totalCount} Toko)</option>
                  {CANTEEN_ZONES.map(z => (
                    <option key={z.id} value={z.id}>Hanya {z.label}</option>
                  ))}
                </select>
              </div>

              {/* Pilihan Cepat Jam Operasional Indonesia */}
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1 text-[11px]">
                  Preset Jam Operasional Indonesia (WIB):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                  {INDONESIA_HOUR_PRESETS.map((p) => {
                    const isActive = bulkOpenTime === p.open && bulkCloseTime === p.close;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setBulkOpenTime(p.open);
                          setBulkCloseTime(p.close);
                        }}
                        className={`p-1.5 text-left border rounded-none transition-all cursor-pointer ${
                          isActive
                            ? 'bg-green-600 text-white border-green-700 font-bold shadow-xs'
                            : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700/80 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="font-bold text-[10px] leading-tight flex items-center justify-between">
                          <span>{p.label}</span>
                          {isActive && <CheckCircle size={10} className="text-white shrink-0" />}
                        </div>
                        <div className={`text-[9px] font-mono mt-0.5 ${isActive ? 'text-green-100' : 'text-gray-500 dark:text-gray-400'}`}>
                          {p.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Jam Buka & Jam Tutup */}
              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded-none border border-gray-200 dark:border-gray-700">
                    <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-0.5 text-[10px]">
                      Jam Buka (WIB)
                    </label>
                    <input
                      type="time"
                      lang="id-ID"
                      value={bulkOpenTime}
                      onChange={(e) => setBulkOpenTime(e.target.value)}
                      required
                      className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 p-1.5 font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 text-center text-xs font-mono"
                    />
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded-none border border-gray-200 dark:border-gray-700">
                    <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-0.5 text-[10px]">
                      Jam Tutup (WIB)
                    </label>
                    <input
                      type="time"
                      lang="id-ID"
                      value={bulkCloseTime}
                      onChange={(e) => setBulkCloseTime(e.target.value)}
                      required
                      className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 p-1.5 font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 text-center text-xs font-mono"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
                  Standar 24 jam Indonesia (WIB). Contoh: 06:00 s/d 21:00 WIB.
                </p>
              </div>

              {/* Checkbox Reopen */}
              <label className="flex items-start gap-2 p-2 rounded-none bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkReopenForceClosed}
                  onChange={(e) => setBulkReopenForceClosed(e.target.checked)}
                  className="mt-0.5 rounded-none text-green-600 focus:ring-green-500"
                />
                <span className="text-[11px] text-green-900 dark:text-green-300 font-medium leading-tight">
                  Buka kembali toko yang sedang dalam status <strong>Tutup Langsung</strong> agar langsung aktif mengikuti jam baru ini.
                </span>
              </label>

              {/* Submit Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsBulkHoursModalOpen(false)}
                  className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 text-gray-700 font-bold text-xs rounded-none border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={bulkUpdateHoursMutation.isPending}
                  className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-none shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Save size={14} />
                  <span>{bulkUpdateHoursMutation.isPending ? 'Menerapkan...' : 'Terapkan Jam'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- MODAL 2: QUICK EDIT JAM 1 TOKO --- */}
      {quickHoursCanteen && createPortal(
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none w-full max-w-sm p-3.5 sm:p-4 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-3 my-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">Atur Jam Toko</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{quickHoursCanteen.name}</p>
              </div>
              <button 
                onClick={() => setQuickHoursCanteen(null)}
                className="w-7 h-7 rounded-none bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 flex items-center justify-center transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Live Realtime Indonesia (WIB) Banner */}
            <div className="flex items-center justify-between p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
              <span className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600 animate-pulse shrink-0" />
                Waktu Saat Ini:
              </span>
              <span className="font-mono font-black text-emerald-700 dark:text-emerald-400">
                {currentWibTime} WIB
              </span>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                updateHoursMutation.mutate({
                  id: quickHoursCanteen.id,
                  open_time: quickOpenTime,
                  close_time: quickCloseTime,
                  closed_days: quickClosedDays
                });
              }}
              className="space-y-3 text-xs"
            >
              {/* Presets Jam Indonesia */}
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1 text-[11px]">
                  Pilih Cepat Jadwal Indonesia (WIB):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                  {INDONESIA_HOUR_PRESETS.map((p) => {
                    const isActive = quickOpenTime === p.open && quickCloseTime === p.close;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setQuickOpenTime(p.open);
                          setQuickCloseTime(p.close);
                        }}
                        className={`p-1.5 text-left border rounded-none transition-all cursor-pointer ${
                          isActive
                            ? 'bg-green-600 text-white border-green-700 font-bold shadow-xs'
                            : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700/80 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="font-bold text-[10px] leading-tight flex items-center justify-between">
                          <span>{p.label}</span>
                          {isActive && <CheckCircle size={10} className="text-white shrink-0" />}
                        </div>
                        <div className={`text-[9px] font-mono mt-0.5 ${isActive ? 'text-green-100' : 'text-gray-500 dark:text-gray-400'}`}>
                          {p.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded-none border border-gray-200 dark:border-gray-700">
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-0.5 text-[10px]">
                    Jam Buka (WIB)
                  </label>
                  <input
                    type="time"
                    lang="id-ID"
                    value={quickOpenTime}
                    onChange={(e) => setQuickOpenTime(e.target.value)}
                    required
                    className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 p-1.5 font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 text-center text-xs font-mono"
                  />
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded-none border border-gray-200 dark:border-gray-700">
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-0.5 text-[10px]">
                    Jam Tutup (WIB)
                  </label>
                  <input
                    type="time"
                    lang="id-ID"
                    value={quickCloseTime}
                    onChange={(e) => setQuickCloseTime(e.target.value)}
                    required
                    className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 p-1.5 font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 text-center text-xs font-mono"
                  />
                </div>
              </div>

              {/* Selector Hari Tutup */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded-none border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 text-[10px]">
                    Hari Libur Rutin
                  </label>
                  <span className="text-[9px] font-mono text-gray-400">
                    {quickClosedDays.length > 0 ? `${quickClosedDays.length} hari` : 'Buka tiap hari'}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {[
                    { id: 'senin', label: 'Sen' },
                    { id: 'selasa', label: 'Sel' },
                    { id: 'rabu', label: 'Rab' },
                    { id: 'kamis', label: 'Kam' },
                    { id: 'jumat', label: 'Jum' },
                    { id: 'sabtu', label: 'Sab' },
                    { id: 'minggu', label: 'Min' }
                  ].map((day) => {
                    const isClosed = quickClosedDays.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => {
                          setQuickClosedDays(prev => 
                            prev.includes(day.id) ? prev.filter(d => d !== day.id) : [...prev, day.id]
                          );
                        }}
                        className={`py-1 text-center rounded-none border text-[10px] cursor-pointer ${
                          isClosed 
                            ? 'bg-red-600 text-white border-red-700 font-bold' 
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setQuickHoursCanteen(null)}
                  className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-none border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={updateHoursMutation.isPending}
                  className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-none shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Save size={14} />
                  <span>{updateHoursMutation.isPending ? 'Menyimpan...' : 'Simpan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- MODAL KHUSUS: ATUR KURIR TOKO --- */}
      {courierModalCanteen && createPortal(
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none w-full max-w-md p-3.5 sm:p-4 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-3 my-auto animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-none bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-300 dark:border-emerald-800 shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">Atur Kurir Toko</h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[240px]">
                    {courierModalCanteen.name}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setCourierModalCanteen(null)}
                className="w-7 h-7 rounded-none bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 flex items-center justify-center transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Info notice */}
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-[11px] text-emerald-800 dark:text-emerald-300 leading-snug">
              Pilih kurir yang bertanggung jawab mengantar pesanan dari <strong>{courierModalCanteen.name}</strong>. Anda dapat memilih 1 kurir utama atau lebih.
            </div>

            {/* Couriers List */}
            <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-0.5">
              {couriersList.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-400">
                  Belum ada akun pengguna dengan role kurir di sistem.
                </div>
              ) : (
                couriersList.map((courier) => {
                  const isSelected = selectedCourierIds.includes(courier.id);
                  const otherCanteens = (courier.assigned_canteens || []).filter(c => c.id !== courierModalCanteen.id);

                  return (
                    <div 
                      key={courier.id}
                      onClick={() => {
                        setSelectedCourierIds(prev => 
                          prev.includes(courier.id)
                            ? prev.filter(id => id !== courier.id)
                            : [...prev, courier.id]
                        );
                      }}
                      className={`p-2 rounded-none border transition-all cursor-pointer flex items-start justify-between gap-2 ${
                        isSelected 
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500' 
                          : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-0.5 rounded-none text-emerald-600 focus:ring-emerald-500 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-gray-900 dark:text-white truncate">
                              {courier.name}
                            </span>
                            {courier.is_working ? (
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 px-1 rounded-none border border-emerald-300 dark:border-emerald-800">
                                Aktif
                              </span>
                            ) : (
                              <span className="text-[9px] font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 px-1 rounded-none">
                                Off
                              </span>
                            )}
                          </div>
                          {courier.phone && (
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{courier.phone}</p>
                          )}
                          {otherCanteens.length > 0 && (
                            <p className="text-[9px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                              Toko lain: {otherCanteens.map(c => c.name).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Quick single-select button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCourierIds([courier.id]);
                        }}
                        title="Jadikan satu-satunya kurir untuk toko ini"
                        className="px-1.5 py-0.5 bg-gray-100 hover:bg-emerald-100 text-gray-700 hover:text-emerald-800 dark:bg-gray-700 dark:hover:bg-emerald-900 dark:text-gray-300 text-[9px] font-bold rounded-none border border-gray-200 dark:border-gray-600 shrink-0 cursor-pointer"
                      >
                        Pilih Tunggal
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Action buttons & Submit */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setSelectedCourierIds([])}
                className="text-[10px] text-red-600 hover:underline font-bold cursor-pointer"
              >
                Kosongkan Kurir
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCourierModalCanteen(null)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-none border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateCouriersMutation.mutate({
                      id: courierModalCanteen.id,
                      courier_ids: selectedCourierIds
                    });
                  }}
                  disabled={updateCouriersMutation.isPending}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-none shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Save size={13} />
                  <span>{updateCouriersMutation.isPending ? 'Menyimpan...' : 'Simpan Kurir'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* --- MODAL 3: DETAIL TOKO LENGKAP (HIGH DENSITY & COMPACT GOBIZ STYLE) --- */}
      {selectedCanteen && createPortal(
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-950 flex flex-col animate-in slide-in-from-bottom-full duration-200 font-sans">
          {/* Header */}
          <div className="sticky top-0 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xs border-b border-gray-200 dark:border-gray-800 px-2.5 sm:px-3 py-1.5 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2 min-w-0">
              <button 
                onClick={() => {
                  setSelectedCanteen(null);
                  setNewBannerTitle('');
                  setNewBannerFile(null);
                  setNewBannerPreview(null);
                  setShowBannerForm(false);
                  setCanteenPhotoFile(null);
                  setCanteenPhotoPreview(null);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-none hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer shrink-0"
                title="Kembali"
              >
                <ChevronLeft size={16} className="text-gray-600 dark:text-gray-300" />
              </button>
              <div className="min-w-0">
                <h2 className="font-black text-xs sm:text-sm text-gray-900 dark:text-white truncate leading-tight">Detail & Pengaturan Toko</h2>
                <p className="text-[10px] text-green-700 dark:text-green-400 font-semibold truncate leading-none mt-0.5">{selectedCanteen.name}</p>
              </div>
            </div>

            {/* Quick Status Pill in Header */}
            <div>
              {selectedCanteen.status === 'approved' && (
                <span className={`px-2 py-0.5 text-[9.5px] font-bold rounded-none border ${
                  selectedCanteen.is_force_closed 
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800' 
                    : selectedCanteen.is_open 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800' 
                      : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                }`}>
                  {selectedCanteen.is_force_closed ? 'Ditutup Admin' : selectedCanteen.is_open ? 'Buka' : 'Tutup Jadwal'}
                </span>
              )}
            </div>
          </div>
          
          {/* Sticky Tab Navigation Bar */}
          <div className="sticky top-[41px] z-20 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-xs border-b border-gray-200 dark:border-gray-800 px-2.5 sm:px-3 py-1 flex items-center gap-1 shadow-xs">
            <button
              type="button"
              onClick={() => setDetailTab('info')}
              className={`flex-1 py-1.5 px-2 text-[11px] font-bold rounded-none border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                detailTab === 'info'
                  ? 'bg-green-600 text-white border-green-600 shadow-xs'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              <SlidersHorizontal size={12} className="shrink-0" />
              <span>Pengaturan & Info Toko</span>
            </button>
            <button
              type="button"
              onClick={() => setDetailTab('menu')}
              className={`flex-1 py-1.5 px-2 text-[11px] font-bold rounded-none border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                detailTab === 'menu'
                  ? 'bg-green-600 text-white border-green-600 shadow-xs'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              <UtensilsCrossed size={12} className="shrink-0" />
              <span>Daftar Menu Toko</span>
              <span className={`px-1.5 py-0.2 text-[9.5px] font-mono font-black rounded-none ${
                detailTab === 'menu'
                  ? 'bg-green-800 text-white'
                  : 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300'
              }`}>
                {totalProductsCount}
              </span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 sm:p-2.5 pb-16 space-y-1.5 max-w-4xl mx-auto w-full">
            {detailTab === 'info' && (
              <>
            {/* Quick Status & Action Bar - Ramping & Padat */}
            <div className="p-1.5 sm:p-2 rounded-none bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider shrink-0 leading-tight">Status:</span>
                {selectedCanteen.status === 'pending' ? (
                  <span className="px-1.5 py-0.2 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] font-bold rounded-none border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-none bg-amber-500 animate-pulse"></span>
                    Menunggu Review
                  </span>
                ) : selectedCanteen.status === 'rejected' ? (
                  <span className="px-1.5 py-0.2 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 text-[10px] font-bold rounded-none border border-gray-300 dark:border-gray-700 flex items-center gap-1">
                    <XCircle size={11} className="text-red-500" />
                    Ditolak / Nonaktif
                  </span>
                ) : selectedCanteen.is_force_closed ? (
                  <span className="px-1.5 py-0.2 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-[10px] font-bold rounded-none border border-red-200 dark:border-red-800">
                    ● Ditutup Paksa
                  </span>
                ) : selectedCanteen.is_open ? (
                  <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-bold rounded-none border border-emerald-200 dark:border-emerald-800">
                    ● Sedang Buka
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 text-[10px] font-semibold rounded-none border border-gray-200 dark:border-gray-700">
                    ● Tutup Jadwal
                  </span>
                )}
              </div>

              {/* Action Buttons: Approve / Reject / Toggle Close */}
              <div className="flex items-center gap-1 shrink-0">
                {selectedCanteen.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Setujui toko "${selectedCanteen.name}" sekarang?`)) {
                          approveCanteenMutation.mutate(selectedCanteen.id);
                        }
                      }}
                      disabled={approveCanteenMutation.isPending}
                      className="px-2.5 py-1 rounded-none text-[11px] font-bold bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 shadow-xs transition-all disabled:opacity-50 cursor-pointer h-[29px]"
                    >
                      <CheckCircle size={12} />
                      <span>{approveCanteenMutation.isPending ? '...' : 'Setujui'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Tolak pendaftaran toko "${selectedCanteen.name}"?`)) {
                          rejectCanteenMutation.mutate(selectedCanteen.id);
                        }
                      }}
                      disabled={rejectCanteenMutation.isPending}
                      className="px-2.5 py-1 rounded-none text-[11px] font-bold bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800 border border-red-200 flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer h-[29px]"
                    >
                      <XCircle size={12} />
                      <span>{rejectCanteenMutation.isPending ? '...' : 'Tolak'}</span>
                    </button>
                  </>
                )}

                {selectedCanteen.status === 'rejected' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Aktifkan kembali toko "${selectedCanteen.name}"?`)) {
                        approveCanteenMutation.mutate(selectedCanteen.id);
                      }
                    }}
                    disabled={approveCanteenMutation.isPending}
                    className="px-2.5 py-1 rounded-none text-[11px] font-bold bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 shadow-xs transition-all disabled:opacity-50 cursor-pointer h-[29px]"
                  >
                    <CheckCircle size={12} />
                    <span>{approveCanteenMutation.isPending ? '...' : 'Aktifkan Toko'}</span>
                  </button>
                )}

                {selectedCanteen.status === 'approved' && (
                  <button
                    type="button"
                    onClick={() => {
                      const willForceClose = !selectedCanteen.is_force_closed;
                      toggleDirectCloseMutation.mutate({
                        id: selectedCanteen.id,
                        force_close: willForceClose
                      });
                    }}
                    disabled={toggleDirectCloseMutation.isPending}
                    className={`px-2.5 py-1 rounded-none text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer h-[29px] ${
                      selectedCanteen.is_force_closed
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    <Power size={12} />
                    <span>{selectedCanteen.is_force_closed ? 'Buka Toko' : 'Tutup Toko Ini Langsung'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Profil Pemilik Toko (High-Density Grid: 2 Kolom Mobile, 4 Kolom Desktop) */}
            <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs space-y-1">
              <h3 className="font-bold text-[10.5px] uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                <User className="w-3 h-3 text-green-600 dark:text-green-400" />
                Profil Pemilik Toko
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[11px]">
                <div className="bg-gray-50 dark:bg-gray-800/40 p-1 px-1.5 rounded-none border border-gray-200 dark:border-gray-700/60">
                  <span className="block text-gray-400 text-[9px] font-bold uppercase leading-none">Pemilik</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100 truncate block mt-0.5 leading-tight">{selectedCanteen.user?.name || '-'}</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/40 p-1 px-1.5 rounded-none border border-gray-200 dark:border-gray-700/60">
                  <span className="block text-gray-400 text-[9px] font-bold uppercase leading-none">WhatsApp</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100 truncate block mt-0.5 leading-tight">
                    {selectedCanteen.user?.phone ? (
                      <a 
                        href={getWaUrl(
                          selectedCanteen.user.phone, 
                          buildDefaultGreetingWaText({
                            user: currentUser,
                            recipientTitle: `Toko ${selectedCanteen.name}`,
                            intentMessage: 'saya ingin bertanya seputar menu & pesanan di HiGO Pondok.'
                          })
                        ) || `https://wa.me/${selectedCanteen.user.phone}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        {selectedCanteen.user.phone}
                      </a>
                    ) : (
                      <span className="text-red-500 font-normal">Belum diisi</span>
                    )}
                  </span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/40 p-1 px-1.5 rounded-none border border-gray-200 dark:border-gray-700/60">
                  <span className="block text-gray-400 text-[9px] font-bold uppercase leading-none">Santri</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100 truncate block mt-0.5 leading-tight">{selectedCanteen.user?.santri_name || <span className="text-red-500 font-normal">Belum diisi</span>}</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/40 p-1 px-1.5 rounded-none border border-gray-200 dark:border-gray-700/60">
                  <span className="block text-gray-400 text-[9px] font-bold uppercase leading-none">Kamar / Asrama</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100 truncate block mt-0.5 leading-tight">{selectedCanteen.user?.santri_room || <span className="text-red-500 font-normal">Belum diisi</span>}</span>
                </div>
              </div>
            </div>

            {/* Foto Utama Toko (Super Admin & Admin Upload) */}
            <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <h3 className="font-bold text-[10.5px] uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                  <ImageIcon className="w-3 h-3 text-green-600 dark:text-green-400" />
                  Foto Utama Toko (Katalog & Detail)
                </h3>
                {selectedCanteen.image && (
                  <span className="px-1.5 py-0.2 text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 rounded-none">
                    Foto Terpasang
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                {/* Preview Image */}
                <div className="w-20 h-14 sm:w-24 sm:h-16 bg-gray-100 dark:bg-gray-800 rounded-none border border-gray-300 dark:border-gray-700 overflow-hidden relative shrink-0 flex items-center justify-center">
                  {canteenPhotoPreview ? (
                    <img src={canteenPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : selectedCanteen.image ? (
                    <AppImage src={selectedCanteen.image} alt={selectedCanteen.name} className="w-full h-full object-cover" />
                  ) : (
                    <Store className="w-6 h-6 text-gray-400" />
                  )}
                  {canteenPhotoPreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setCanteenPhotoFile(null);
                        setCanteenPhotoPreview(null);
                      }}
                      className="absolute top-0 right-0 bg-red-600 text-white p-0.5 cursor-pointer leading-none"
                      title="Batalkan foto baru"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>

                {/* Form Controls */}
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                    Format gambar JPG, PNG, atau WebP. Otomatis dioptimasi dan disimpan ke Google Drive.
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            if (file.size > 2 * 1024 * 1024) {
                              toast.error('Ukuran file maksimal 2 MB');
                              e.target.value = '';
                              return;
                            }
                            setCanteenPhotoFile(file);
                            setCanteenPhotoPreview(URL.createObjectURL(file));
                          }
                        }}
                        className="hidden"
                      />
                      <div className="border border-dashed border-gray-300 dark:border-gray-700 hover:border-green-500 px-2.5 py-1 bg-gray-50 dark:bg-gray-800/40 text-center transition-colors h-[28px] flex items-center justify-center gap-1 text-[10px] text-gray-700 dark:text-gray-200 font-semibold rounded-none">
                        <UploadCloud size={12} className="text-gray-400 shrink-0" />
                        <span>{canteenPhotoFile ? canteenPhotoFile.name : (selectedCanteen.image ? 'Ganti Foto Toko' : 'Pilih Foto Toko')}</span>
                      </div>
                    </label>

                    {canteenPhotoFile && (
                      <button
                        type="button"
                        onClick={() => {
                          updateCanteenPhotoMutation.mutate({
                            id: selectedCanteen.id,
                            file: canteenPhotoFile
                          });
                        }}
                        disabled={updateCanteenPhotoMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-none font-bold text-[11px] transition-all disabled:opacity-50 flex items-center justify-center gap-1 shadow-xs cursor-pointer h-[28px]"
                      >
                        <Save size={12} />
                        <span>{updateCanteenPhotoMutation.isPending ? 'Mengunggah...' : 'Simpan Foto ke Drive'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Banner Promosi Toko di Beranda (High-Density & Collapsible Form) */}
            <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <h3 className="font-bold text-[10.5px] uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Banner Promosi Toko (Beranda)
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded-none border ${
                    (selectedCanteen.banners?.length || 0) > 0 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' 
                      : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {(selectedCanteen.banners?.length || 0) > 0 ? `${selectedCanteen.banners.length} Banner Terpasang` : 'Belum Ada'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowBannerForm(prev => !prev)}
                    className="px-2 py-0.5 text-[9.5px] font-bold bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-300 border border-green-300 dark:border-green-800 rounded-none cursor-pointer"
                  >
                    {showBannerForm ? '✕ Tutup Form' : '＋ Unggah Banner'}
                  </button>
                </div>
              </div>

              {/* Daftar Banner Terpasang (Compact List) */}
              {selectedCanteen.banners && selectedCanteen.banners.length > 0 && (
                <div className="space-y-1">
                  {selectedCanteen.banners.map((b) => (
                    <div 
                      key={b.id} 
                      className="p-1.5 bg-gray-50 dark:bg-gray-800/40 rounded-none border border-gray-200 dark:border-gray-700/60 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-14 h-8 bg-gray-200 dark:bg-gray-700 rounded-none shrink-0 overflow-hidden border border-gray-300 dark:border-gray-600">
                          <AppImage src={b.image_path} alt={b.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-[11px] text-gray-900 dark:text-white truncate">{b.title}</h4>
                          <span className={`inline-block px-1 py-0.1 text-[8px] font-bold rounded-none border ${
                            b.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {b.status === 'active' ? '● Tayang di Beranda' : '○ Disembunyikan'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleBannerStatusMutation.mutate(b.id)}
                          disabled={toggleBannerStatusMutation.isPending}
                          title={b.status === 'active' ? 'Sembunyikan banner dari beranda' : 'Tayangkan banner di beranda'}
                          className="px-1.5 py-0.5 text-[9.5px] font-bold rounded-none border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {b.status === 'active' ? (
                            <>
                              <EyeOff size={10} className="text-amber-600" />
                              <span>Sembunyikan</span>
                            </>
                          ) : (
                            <>
                              <Eye size={10} className="text-emerald-600" />
                              <span>Tayangkan</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Hapus banner "${b.title}"?`)) {
                              deleteBannerMutation.mutate(b.id);
                            }
                          }}
                          disabled={deleteBannerMutation.isPending}
                          title="Hapus banner ini"
                          className="p-1 text-xs font-bold rounded-none border border-red-200 dark:border-red-800 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Form Upload Banner Baru - Responsif & Tidak Terpotong di Mobile */}
              {(showBannerForm || (!selectedCanteen.banners || selectedCanteen.banners.length === 0)) && (
                <form onSubmit={handleUploadBannerSubmit} className="pt-1.5 border-t border-gray-100 dark:border-gray-800 space-y-1.5 text-xs">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Judul banner promo..."
                      value={newBannerTitle}
                      onChange={(e) => setNewBannerTitle(e.target.value)}
                      className="flex-1 min-w-0 w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 h-[30px]"
                      required
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <label className="flex-1 sm:flex-initial cursor-pointer">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          onChange={handleBannerFileChange}
                          className="hidden"
                        />
                        <div className="border border-dashed border-gray-300 dark:border-gray-700 hover:border-green-500 px-2.5 py-1 bg-gray-50 dark:bg-gray-800/40 text-center transition-colors h-[30px] flex items-center justify-center gap-1 text-[10px] text-gray-600 dark:text-gray-300 font-semibold">
                          <UploadCloud size={12} className="text-gray-400 shrink-0" />
                          <span className="truncate max-w-[120px] sm:max-w-[140px]">{newBannerFile ? newBannerFile.name : 'Pilih Gambar'}</span>
                        </div>
                      </label>
                      <button
                        type="submit"
                        disabled={uploadBannerMutation.isPending || !newBannerFile || !newBannerTitle.trim()}
                        className="bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white px-3.5 rounded-none font-bold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1 shadow-xs cursor-pointer h-[30px] shrink-0"
                      >
                        <Save size={12} />
                        <span>{uploadBannerMutation.isPending ? '...' : 'Pasang'}</span>
                      </button>
                    </div>
                  </div>
                  {newBannerPreview && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <div className="w-16 h-8 bg-gray-100 border border-gray-300 dark:border-gray-700 overflow-hidden relative shrink-0">
                        <img src={newBannerPreview} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setNewBannerFile(null);
                            setNewBannerPreview(null);
                          }}
                          className="absolute top-0 right-0 bg-red-600 text-white p-0.5 cursor-pointer leading-none"
                          title="Batal pilih"
                        >
                          <X size={9} />
                        </button>
                      </div>
                      <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                        Preview banner terpilih (Rasio ~16:9 atau 21:9)
                      </span>
                    </div>
                  )}
                </form>
              )}
            </div>

            {/* Grid 3 Kolom: Zona Lokasi, Jam Operasional, & Kurir Pengantar Berdampingan */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
              {/* Card A: Zona Lokasi & Tarif Layanan (Ramping & Jelas) */}
              <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs space-y-1.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h3 className="font-bold text-[10.5px] uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-green-600 dark:text-green-400 shrink-0" />
                      <span className="truncate">Zona Lokasi & Tarif</span>
                    </h3>
                    <span className="text-[10px] font-black text-green-700 dark:text-green-400 font-mono shrink-0">
                      Total {rp(getZone(detailCategory).deliveryFee + getZone(detailCategory).adminFee)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 w-full">
                    <select
                      value={detailCategory}
                      onChange={(e) => setDetailCategory(e.target.value)}
                      className="flex-1 min-w-0 w-0 rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 shadow-xs text-gray-900 dark:text-white text-xs font-bold px-2 py-1 h-[29px] focus:ring-1 focus:ring-green-500 truncate"
                    >
                      {CANTEEN_ZONES.map(z => (
                        <option key={z.id} value={z.id}>
                          {z.label} (Total {rp(z.deliveryFee + z.adminFee)})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        updateCategoryMutation.mutate({
                          id: selectedCanteen.id,
                          category: detailCategory
                        });
                      }}
                      disabled={updateCategoryMutation.isPending}
                      className="px-2.5 sm:px-3 bg-green-600 hover:bg-green-700 active:scale-98 text-white rounded-none font-bold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1 shadow-xs h-[29px] shrink-0 cursor-pointer whitespace-nowrap"
                    >
                      <Save size={12} className="shrink-0" />
                      <span className="whitespace-nowrap">{updateCategoryMutation.isPending ? '...' : 'Simpan'}</span>
                    </button>
                  </div>
                </div>

                {/* Rincian Komponen Tarif (Jelas & Kompak) */}
                <div className="pt-1.5 mt-1 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-1 text-[10px] font-mono">
                  <div className="bg-gray-50 dark:bg-gray-800/70 px-1.5 py-1 border border-gray-200 dark:border-gray-700/60 flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400 text-[9px] font-sans font-semibold">🛵 Kurir:</span>
                    <span className="font-bold text-gray-900 dark:text-white">{rp(getZone(detailCategory).deliveryFee)}</span>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/70 px-1.5 py-1 border border-gray-200 dark:border-gray-700/60 flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400 text-[9px] font-sans font-semibold">🛡️ Kas Admin:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{rp(getZone(detailCategory).adminFee)}</span>
                  </div>
                </div>
              </div>

              {/* Card B: Jam Operasional Toko (Ramping) */}
              <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs space-y-1.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h3 className="font-bold text-[10.5px] uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-green-600 dark:text-green-400 shrink-0" />
                      <span className="truncate">Jam Operasional (WIB)</span>
                    </h3>
                    <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 font-semibold shrink-0">
                      {detailOpenTime} - {detailCloseTime} WIB
                    </span>
                  </div>

                  {/* Preset Jam Indonesia di Detail Modal */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mb-1.5">
                    {INDONESIA_HOUR_PRESETS.slice(0, 3).map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setDetailOpenTime(p.open);
                          setDetailCloseTime(p.close);
                        }}
                        className={`px-1.5 py-0.5 text-[9px] border rounded-none truncate cursor-pointer ${
                          detailOpenTime === p.open && detailCloseTime === p.close
                            ? 'bg-green-600 text-white border-green-700 font-bold'
                            : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        {p.label} ({p.open}-{p.close})
                      </button>
                    ))}
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      updateHoursMutation.mutate({
                        id: selectedCanteen.id,
                        open_time: detailOpenTime,
                        close_time: detailCloseTime,
                        closed_days: detailClosedDays
                      });
                    }}
                    className="space-y-2 w-full"
                  >
                    <div className="flex items-center gap-1.5 w-full">
                      <div className="flex items-center gap-1 flex-1 min-w-0 w-0">
                        <input
                          type="time"
                          lang="id-ID"
                          value={detailOpenTime}
                          onChange={(e) => setDetailOpenTime(e.target.value)}
                          className="flex-1 min-w-0 w-0 rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white font-bold p-1 text-center text-xs font-mono h-[29px]"
                          required
                          title="Jam Buka (WIB)"
                        />
                        <span className="text-[10px] text-gray-400 font-bold shrink-0">s/d</span>
                        <input
                          type="time"
                          lang="id-ID"
                          value={detailCloseTime}
                          onChange={(e) => setDetailCloseTime(e.target.value)}
                          className="flex-1 min-w-0 w-0 rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white font-bold p-1 text-center text-xs font-mono h-[29px]"
                          required
                          title="Jam Tutup (WIB)"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={updateHoursMutation.isPending}
                        className="px-2.5 sm:px-3 bg-green-600 hover:bg-green-700 active:scale-98 text-white rounded-none font-bold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1 shadow-xs h-[29px] shrink-0 cursor-pointer whitespace-nowrap"
                      >
                        <Save size={12} className="shrink-0" />
                        <span className="whitespace-nowrap">{updateHoursMutation.isPending ? '...' : 'Simpan'}</span>
                      </button>
                    </div>

                    {/* Hari Libur Rutin */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                          Hari Libur Rutin:
                        </span>
                        <span className="text-[9px] font-mono text-gray-400">
                          {detailClosedDays.length > 0 ? `${detailClosedDays.length} hari libur` : 'Buka setiap hari'}
                        </span>
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {[
                          { id: 'senin', label: 'Sen' },
                          { id: 'selasa', label: 'Sel' },
                          { id: 'rabu', label: 'Rab' },
                          { id: 'kamis', label: 'Kam' },
                          { id: 'jumat', label: 'Jum' },
                          { id: 'sabtu', label: 'Sab' },
                          { id: 'minggu', label: 'Min' }
                        ].map((day) => {
                          const isClosed = detailClosedDays.includes(day.id);
                          return (
                            <button
                              key={day.id}
                              type="button"
                              onClick={() => {
                                setDetailClosedDays(prev => 
                                  prev.includes(day.id) ? prev.filter(d => d !== day.id) : [...prev, day.id]
                                );
                              }}
                              className={`py-1 text-center rounded-none border text-[10px] cursor-pointer ${
                                isClosed 
                                  ? 'bg-red-600 text-white border-red-700 font-bold' 
                                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700'
                              }`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </form>
                </div>
                <p className="text-[9.5px] text-gray-500 dark:text-gray-400 pt-0.5 leading-tight">
                  Format 24 jam (Jam Buka s/d Jam Tutup toko)
                </p>
              </div>

              {/* Card C: Kurir Pengantar Toko (Ramping) */}
              <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs space-y-1.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h3 className="font-bold text-[10.5px] uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Truck className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">Kurir Pengantar</span>
                    </h3>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                      {selectedCanteen.couriers?.length || 0} Kurir
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 bg-gray-50 dark:bg-gray-800/50 p-1 border border-gray-200 dark:border-gray-700 h-[29px]">
                    <div className="min-w-0 flex items-center gap-1">
                      {selectedCanteen.couriers && selectedCanteen.couriers.length > 0 ? (
                        <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 truncate">
                          {selectedCanteen.couriers.map(c => c.name).join(', ')}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <AlertTriangle size={11} className="shrink-0" />
                          <span className="truncate">Belum ada</span>
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleOpenCourierModal(e, selectedCanteen)}
                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-none font-bold text-[10px] transition-all disabled:opacity-50 flex items-center justify-center gap-1 shadow-xs h-full shrink-0 cursor-pointer whitespace-nowrap"
                    >
                      <Truck size={10} className="shrink-0" />
                      <span className="whitespace-nowrap">Ubah</span>
                    </button>
                  </div>
                </div>
                <p className="text-[9.5px] text-gray-500 dark:text-gray-400 pt-0.5 leading-tight truncate">
                  Menerima pesanan otomatis toko saat status diproses
                </p>
              </div>
            </div>

            {/* Quick Menu Card (Jembatan ke Tab Menu) */}
            <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-none bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 flex items-center justify-center shrink-0">
                  <UtensilsCrossed size={15} className="text-green-600 dark:text-green-400" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">Katalog Menu & Produk Toko</h4>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                    {totalProductsCount} menu • <span className="text-green-600 dark:text-green-400 font-bold">{availableProductsCount} tersedia</span> • <span className="text-red-500 font-bold">{unavailableProductsCount} habis</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailTab('menu')}
                className="px-2.5 py-1 bg-green-600 hover:bg-green-700 active:scale-98 text-white rounded-none font-bold text-xs transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
              >
                <span>Lihat Seluruh Menu</span>
                <span className="font-mono text-[10px]">({totalProductsCount})</span>
              </button>
            </div>

            {/* Pencairan Saldo (Withdrawal - Compact Ramping) */}
            <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between gap-1">
                <h3 className="font-bold text-[10.5px] uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  Pencairan Saldo Toko (Withdrawal)
                </h3>
                <span className="text-[11px] font-mono font-black text-emerald-700 dark:text-emerald-400">
                  Saldo: Rp {parseFloat(selectedCanteen.balance || 0).toLocaleString('id-ID')}
                </span>
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (window.confirm(`Proses pencairan dana sebesar Rp ${parseFloat(withdrawalAmount).toLocaleString('id-ID')}?`)) {
                    withdrawMutation.mutate({
                      id: selectedCanteen.id,
                      amount: parseFloat(withdrawalAmount),
                      notes: withdrawalNotes
                    });
                  }
                }}
                className="space-y-1 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    min="1000"
                    max={selectedCanteen.balance || 0}
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 p-1 px-2 font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 font-mono text-xs h-[29px]"
                    placeholder="Nominal Penarikan (Rp)"
                    required
                  />
                  <input
                    type="text"
                    value={withdrawalNotes}
                    onChange={(e) => setWithdrawalNotes(e.target.value)}
                    className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 p-1 px-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 text-xs h-[29px]"
                    placeholder="Keterangan Transfer (BSI / Tunai...)"
                  />
                </div>
                <button
                  type="submit"
                  disabled={withdrawMutation.isPending || !withdrawalAmount || parseFloat(withdrawalAmount) <= 0 || parseFloat(withdrawalAmount) > parseFloat(selectedCanteen.balance || 0)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white py-1 px-2.5 rounded-none font-bold text-xs transition-all disabled:opacity-50 shadow-xs cursor-pointer h-[29px] flex items-center justify-center gap-1.5"
                >
                  <Wallet size={12} />
                  <span>{withdrawMutation.isPending ? 'Memproses...' : 'Proses Pencairan Saldo'}</span>
                </button>
              </form>
            </div>

            {/* ZONA BAHAYA: HAPUS TOKO PERMANEN (KHUSUS SUPER ADMIN) */}
            {isSuperAdmin && (
              <div className="bg-red-50/60 dark:bg-red-950/30 p-2 sm:p-2.5 rounded-none border border-red-200 dark:border-red-900/60 shadow-xs space-y-2">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="font-bold text-[10.5px] uppercase tracking-wider text-red-700 dark:text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    Zona Bahaya (Super Admin)
                  </h3>
                  <span className="text-[8.5px] font-black text-red-600 uppercase px-1.5 py-0.2 bg-red-100 dark:bg-red-900/50 rounded-none border border-red-300 dark:border-red-800">
                    Aksi Permanen
                  </span>
                </div>
                <p className="text-[10px] text-red-700 dark:text-red-300 leading-relaxed">
                  Menghapus toko ini akan melenyapkan toko dari sistem secara permanen beserta seluruh produk, berkas gambar, transaksi pesanan, buku kas saldo, dan seluruh catatan rekap profit.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCanteenToDelete(selectedCanteen);
                    setDeleteConfirmText('');
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 active:scale-98 text-white py-1.5 px-2.5 rounded-none font-bold text-xs transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={13} />
                  <span>Hapus Toko & Bersihkan Seluruh Profit Permanen</span>
                </button>
              </div>
            )}
              </>
            )}

            {/* TAB 2: DAFTAR SELURUH MENU & PRODUK TOKO */}
            {detailTab === 'menu' && (
              <div className="space-y-1.5 animate-in fade-in-50 duration-150">
                {/* 1. Summary Bar & Refresh */}
                <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                      <UtensilsCrossed size={14} className="text-green-600 dark:text-green-400" />
                      <span>Katalog Menu Toko</span>
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-none border border-gray-200 dark:border-gray-700">
                      Total: <span className="font-mono font-black">{totalProductsCount}</span>
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-none border border-emerald-200 dark:border-emerald-800">
                      Tersedia: <span className="font-mono font-black">{availableProductsCount}</span>
                    </span>
                    {unavailableProductsCount > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-none border border-red-200 dark:border-red-800">
                        Habis: <span className="font-mono font-black">{unavailableProductsCount}</span>
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProduct(null);
                        setIsProductModalOpen(true);
                      }}
                      className="p-1 px-2.5 text-[10px] font-bold text-white bg-green-600 hover:bg-green-700 active:scale-98 rounded-none transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                      title="Tambah menu baru ke toko ini"
                    >
                      <Plus size={11} />
                      <span>Tambah Menu</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => refetchProducts()}
                      disabled={isLoadingProducts}
                      className="p-1 px-2 text-[10px] font-bold text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                      title="Segarkan data menu"
                    >
                      <RefreshCw size={11} className={isLoadingProducts ? 'animate-spin' : ''} />
                      <span>Segarkan</span>
                    </button>
                  </div>
                </div>

                {/* 2. Filter & Search Controls */}
                <div className="bg-white dark:bg-gray-900 p-2 sm:p-2.5 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs space-y-1.5">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                    {/* Search Input */}
                    <div className="relative flex-1">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={menuSearch}
                        onChange={(e) => setMenuSearch(e.target.value)}
                        placeholder="Cari nama menu, deskripsi, atau kategori..."
                        className="w-full pl-7 pr-7 py-1 text-xs rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 font-sans h-[30px]"
                      />
                      {menuSearch && (
                        <button
                          type="button"
                          onClick={() => setMenuSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* Status Filter Tabs */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setMenuStatusFilter('all')}
                        className={`px-2 py-1 text-[10px] font-bold rounded-none border transition-colors cursor-pointer h-[30px] ${
                          menuStatusFilter === 'all'
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        Semua ({totalProductsCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setMenuStatusFilter('available')}
                        className={`px-2 py-1 text-[10px] font-bold rounded-none border transition-colors cursor-pointer h-[30px] ${
                          menuStatusFilter === 'available'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        Tersedia ({availableProductsCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setMenuStatusFilter('unavailable')}
                        className={`px-2 py-1 text-[10px] font-bold rounded-none border transition-colors cursor-pointer h-[30px] ${
                          menuStatusFilter === 'unavailable'
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        Habis ({unavailableProductsCount})
                      </button>
                    </div>
                  </div>

                  {/* Category Filter Pills (if any) */}
                  {productCategories.length > 0 && (
                    <div className="flex items-center gap-1 overflow-x-auto pt-0.5 no-scrollbar">
                      <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                        <Tag size={10} />
                        Kategori:
                      </span>
                      <button
                        type="button"
                        onClick={() => setMenuCategoryFilter('all')}
                        className={`px-2 py-0.5 text-[9.5px] font-bold rounded-none border shrink-0 transition-colors cursor-pointer ${
                          menuCategoryFilter === 'all'
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Semua Kategori
                      </button>
                      {productCategories.map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setMenuCategoryFilter(cat)}
                          className={`px-2 py-0.5 text-[9.5px] font-bold rounded-none border shrink-0 transition-colors cursor-pointer capitalize ${
                            menuCategoryFilter === cat
                              ? 'bg-green-600 text-white border-green-600'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Product List Table (High Density Flat Sharp UI) */}
                {filteredProducts.length === 0 ? (
                  <div className="bg-white dark:bg-gray-900 p-8 rounded-none border border-gray-200 dark:border-gray-800 shadow-xs text-center space-y-2">
                    <UtensilsCrossed size={32} className="mx-auto text-gray-300 dark:text-gray-600" />
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Tidak ada menu yang sesuai</p>
                    <p className="text-[10px] text-gray-400">
                      {totalProductsCount === 0 
                        ? 'Toko ini belum menambahkan produk atau menu makanan/minuman.' 
                        : 'Coba ubah kata kunci pencarian atau filter status menu di atas.'}
                    </p>
                    {menuSearch && (
                      <button
                        type="button"
                        onClick={() => { setMenuSearch(''); setMenuCategoryFilter('all'); setMenuStatusFilter('all'); }}
                        className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-none border border-gray-300 dark:border-gray-700 cursor-pointer"
                      >
                        Reset Filter
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800/70 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            <th className="py-2 px-2 text-center w-8">No</th>
                            <th className="py-2 px-1.5 w-10 text-center">Foto</th>
                            <th className="py-2 px-2">Menu & Kategori</th>
                            <th className="py-2 px-2 text-center w-20">Status</th>
                            <th className="py-2 px-2 text-right w-16">Stok</th>
                            <th className="py-2 px-2 text-right w-16">Terjual</th>
                            <th className="py-2 px-2 text-right w-24">HPP</th>
                            <th className="py-2 px-2 text-right w-24">Harga Jual</th>
                            <th className="py-2 px-2 text-right w-24">Profit</th>
                            <th className="py-2 px-2 text-center w-28">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                          {filteredProducts.map((product, idx) => {
                            const price = parseFloat(product.price || product.hpj || 0);
                            const hpp = parseFloat(product.hpp || 0);
                            const profit = price - hpp;
                            const variantPills = getAvailableVariantPills(product);

                            return (
                              <tr 
                                key={product.id} 
                                className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
                              >
                                <td className="py-2 px-2 text-center font-mono text-[10px] text-gray-400">
                                  {idx + 1}
                                </td>
                                <td className="py-1 px-1.5 text-center">
                                  {product.image ? (
                                    <button
                                      type="button"
                                      onClick={() => setViewProductImage(product)}
                                      className="w-8 h-8 rounded-none border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0 cursor-pointer hover:opacity-80 transition-opacity mx-auto block"
                                      title="Klik untuk perbesar gambar"
                                    >
                                      <AppImage
                                        src={getStorageUrl(product.image)}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                      />
                                    </button>
                                  ) : (
                                    <div className="w-8 h-8 rounded-none bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center mx-auto text-gray-400">
                                      <UtensilsCrossed size={12} />
                                    </div>
                                  )}
                                </td>
                                <td className="py-1.5 px-2 min-w-[130px]">
                                  <div className="font-bold text-gray-900 dark:text-white leading-tight">
                                    {product.name}
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                    {product.category && (
                                      <span className="px-1 py-0.2 bg-gray-100 dark:bg-gray-800 text-[9px] font-semibold text-gray-600 dark:text-gray-300 rounded-none border border-gray-200 dark:border-gray-700 uppercase">
                                        {product.category}
                                      </span>
                                    )}
                                    {variantPills.length > 0 && (
                                      <div className="flex items-center gap-1 flex-wrap">
                                        {variantPills.map((pill, pIdx) => (
                                          <span
                                            key={pIdx}
                                            className="px-1 py-0.2 bg-purple-50 dark:bg-purple-950/40 text-[9px] font-semibold text-purple-700 dark:text-purple-300 rounded-none border border-purple-200 dark:border-purple-800"
                                          >
                                            {pill.label}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="py-1.5 px-2 text-center whitespace-nowrap">
                                  <span className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded-none border inline-flex items-center gap-1 ${
                                    product.is_available
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                      : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-none ${product.is_available ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                    {product.is_available ? 'Tersedia' : 'Habis'}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono text-[11px] text-gray-700 dark:text-gray-300 font-semibold whitespace-nowrap">
                                  {product.stock !== null && product.stock !== undefined ? product.stock : '∞'}
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono text-[11px] text-gray-700 dark:text-gray-300 font-semibold whitespace-nowrap">
                                  {product.sold_count || 0}
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                  {rp(hpp)}
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono text-[11px] font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                  {rp(price)}
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                  +{rp(profit)}
                                </td>
                                <td className="py-1.5 px-2 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingProduct(product);
                                        setIsProductModalOpen(true);
                                      }}
                                      className="px-1.5 py-0.5 text-[9.5px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300 rounded-none transition-colors flex items-center gap-0.5 cursor-pointer"
                                      title="Edit rincian menu"
                                    >
                                      <Pencil size={10} />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleProductAvailabilityMutation.mutate(product.id)}
                                      disabled={toggleProductAvailabilityMutation.isPending}
                                      title={product.is_available ? 'Ubah status jadi Habis' : 'Ubah status jadi Tersedia'}
                                      className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded-none border transition-all cursor-pointer ${
                                        product.is_available
                                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                                      }`}
                                    >
                                      {product.is_available ? 'Off' : 'On'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm(`Hapus menu "${product.name}" secara permanen dari toko ini?`)) {
                                          deleteProductMutation.mutate(product.id);
                                        }
                                      }}
                                      disabled={deleteProductMutation.isPending}
                                      className="p-1 text-[9.5px] font-bold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/30 dark:border-red-800 rounded-none transition-colors flex items-center cursor-pointer"
                                      title="Hapus Menu"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>,
        document.body
      )}

      {/* Lightbox Preview Gambar Menu */}
      {viewProductImage && createPortal(
        <div 
          onClick={() => setViewProductImage(null)}
          className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in-50 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none max-w-sm w-full overflow-hidden shadow-2xl space-y-2 p-2.5"
          >
            <div className="flex items-center justify-between pb-1 border-b border-gray-100 dark:border-gray-800">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                {viewProductImage.name}
              </h4>
              <button
                type="button"
                onClick={() => setViewProductImage(null)}
                className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded-none border border-gray-200 dark:border-gray-700 cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
            <div className="w-full aspect-square bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
              <AppImage
                src={getStorageUrl(viewProductImage.image)}
                alt={viewProductImage.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex items-center justify-between px-1 text-[11px] font-mono pt-1">
              <span className="text-gray-500">Harga Jual: <strong className="text-gray-900 dark:text-white font-bold">{rp(viewProductImage.price || viewProductImage.hpj || 0)}</strong></span>
              <span className="text-emerald-600 font-bold">HPP: {rp(viewProductImage.hpp || 0)}</span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Form Tambah / Edit Menu (Super Admin & Admin) */}
      <ProductFormModal
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setEditingProduct(null);
        }}
        editingProduct={editingProduct}
        onSave={handleSaveProduct}
        isPending={saveProductMutation.isPending}
      />

      {/* --- MODAL 4: KONFIRMASI HAPUS TOKO PERMANEN (SUPER ADMIN ONLY) --- */}
      {canteenToDelete && createPortal(
        <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none w-full max-w-md p-3.5 sm:p-4 shadow-2xl border-2 border-red-500 space-y-3 my-auto animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-none bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center border border-red-300 dark:border-red-800 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-xs sm:text-sm text-red-600 dark:text-red-400 leading-tight">
                    Hapus Toko Secara Permanen
                  </h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-none mt-0.5">
                    Wewenang Khusus Super Administrator
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCanteenToDelete(null);
                  setDeleteConfirmText('');
                }}
                disabled={deleteCanteenMutation.isPending}
                className="w-7 h-7 rounded-none bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 flex items-center justify-center transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer disabled:opacity-50"
              >
                <X size={15} />
              </button>
            </div>

            {/* Warning Message */}
            <div className="space-y-2 text-xs">
              <div className="p-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-none text-red-800 dark:text-red-200 text-[11px] leading-relaxed">
                <span className="font-black uppercase tracking-wider block mb-1">
                  ⚠️ Peringatan Kritis:
                </span>
                Apakah Anda yakin ingin menghapus toko <strong>"{canteenToDelete.name}"</strong>? Tindakan ini <strong className="underline">TIDAK DAPAT DIBATALKAN</strong>.
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/60 p-2 rounded-none border border-gray-200 dark:border-gray-700 text-[10.5px] space-y-1 text-gray-700 dark:text-gray-300">
                <p className="font-bold text-gray-900 dark:text-gray-100">Seluruh data yang bersangkutan akan dihapus tuntas:</p>
                <ul className="space-y-0.5 pl-1">
                  <li className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                    <span>✕</span> Data profil toko & file logo fisik
                  </li>
                  <li className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                    <span>✕</span> Seluruh produk toko & file foto produk
                  </li>
                  <li className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                    <span>✕</span> Seluruh riwayat pesanan (Orders & Order Items)
                  </li>
                  <li className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                    <span>✕</span> Seluruh catatan profit, buku kas saldo, & penarikan dana
                  </li>
                  <li className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                    <span>✕</span> Riwayat transaksi pembayaran (Payment Logs) & bukti bayar
                  </li>
                  <li className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                    <span>✕</span> Banner promosi, kupon voucher toko, & penugasan kurir
                  </li>
                </ul>
              </div>

              {/* Confirmation Input */}
              <div className="space-y-1 pt-1">
                <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300">
                  Ketik nama toko <strong className="text-red-600 font-mono select-all">"{canteenToDelete.name}"</strong> untuk konfirmasi:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={`Ketik: ${canteenToDelete.name}`}
                  className="w-full rounded-none border border-red-300 dark:border-red-700 bg-white dark:bg-gray-800 p-1.5 text-xs font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-red-500 outline-none"
                  disabled={deleteCanteenMutation.isPending}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setCanteenToDelete(null);
                  setDeleteConfirmText('');
                }}
                disabled={deleteCanteenMutation.isPending}
                className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-none border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteCanteenMutation.mutate(canteenToDelete.id);
                }}
                disabled={deleteCanteenMutation.isPending || deleteConfirmText.trim().toLowerCase() !== canteenToDelete.name.trim().toLowerCase()}
                className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 active:scale-98 text-white font-bold text-xs rounded-none shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <Trash2 size={13} />
                <span>{deleteCanteenMutation.isPending ? 'Menghapus Bersih...' : 'Hapus Permanen'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
