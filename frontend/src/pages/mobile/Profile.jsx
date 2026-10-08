import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Edit2, ShieldCheck, PlusCircle, CreditCard, Users, Bookmark, Activity, Ticket, Shield, LogOut, ChevronRight, ChevronDown, Store, Camera, Save, X, Plus, BookOpen, Calculator, Coins, Smartphone, MapPin, GraduationCap, Search, Check } from 'lucide-react';
import { ROLES, getUserRole, isAdminLevel } from '../../config/roles';
import { useAuthStore } from '../../store/authStore';
import { usePwaStore } from '../../store/pwaStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api, { getStorageUrl } from '../../lib/axios';
import santriData from '../../data/santri.json';
import AdminAccountingModal from '../../components/modals/AdminAccountingModal';
import ThemeToggle from '../../components/ui/ThemeToggle';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { PRICING_CONFIG, formatRupiah } from '../../config/pricing';

const uniqueJenjang = [...new Set(santriData.data.filter(r => r.length > 5 && r[4]).map(r => r[4]))].sort();
const uniqueAsrama = [...new Set(santriData.data.filter(r => r.length > 10 && r[10]).map(r => r[10]))].sort();

export default function Profile() {
  const user = useAuthStore(state => state.user);
  const originalAdmin = useAuthStore(state => state.originalAdmin);
  const setUser = useAuthStore(state => state.setUser);
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();
  const userRole = getUserRole(user);
  const role = userRole;

  const { isStandalone, installApp } = usePwaStore();
  const queryClient = useQueryClient();
  const [filterGender, setFilterGender] = useState('');
  const [santriSearch, setSantriSearch] = useState('');
  const [isSantriOpen, setIsSantriOpen] = useState(false);
  const santriDropdownRef = React.useRef(null);

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

  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showKeluargaModal, setShowKeluargaModal] = useState(false);
  const [userAvatarFile, setUserAvatarFile] = useState(null);
  const [userAvatarPreview, setUserAvatarPreview] = useState(null);
  const [userData, setUserData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    password: '',
    santri_name: user?.santri_name || '',
    santri_room: user?.santri_room || '',
    santri_class: user?.santri_class || '',
    santri_level: user?.santri_level || '',
    is_teacher: !!user?.is_teacher,
    niy: user?.niy || '',
    teacher_unit: user?.teacher_unit || ''
  });

  React.useEffect(() => {
    if (user) {
      setUserData({
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        password: '',
        santri_name: user?.santri_name || '',
        santri_room: user?.santri_room || '',
        santri_class: user?.santri_class || '',
        santri_level: user?.santri_level || '',
        is_teacher: !!user?.is_teacher,
        niy: user?.niy || '',
        teacher_unit: user?.teacher_unit || ''
      });
    }
  }, [user]);

  // Otomatis buka modal data santri jika diarahkan dari keranjang atau link khusus
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'santri' || params.get('editSantri') === 'true') {
        setShowKeluargaModal(true);
      }
    } catch (_) {}
  }, []);
  
  // Store Management States
  const [showStoreListModal, setShowStoreListModal] = useState(false);
  const [showEditStoreModal, setShowEditStoreModal] = useState(false);
  const [showAddStoreModal, setShowAddStoreModal] = useState(false);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [showAccountingModal, setShowAccountingModal] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [selectedCanteenId, setSelectedCanteenId] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  // State for Editing
  const [profileData, setProfileData] = useState({
    name: '',
    description: '',
    open_time: '09:00',
    close_time: '17:00',
    image: null,
    whatsapp_number: '',
    delivery_fee: 0
  });

  // State for Adding
  const [newStoreData, setNewStoreData] = useState({
    name: '',
    description: ''
  });

  const availableKelas = React.useMemo(() => {
    if (!userData.santri_level) {
      return [...new Set(santriData.data.filter(r => r.length > 5 && r[5]).map(r => r[5]))].sort();
    }
    return [...new Set(santriData.data.filter(r => r.length > 5 && r[4] === userData.santri_level && r[5]).map(r => r[5]))].sort();
  }, [userData.santri_level]);

  const filteredSantris = React.useMemo(() => {
    return santriData.data.filter(row => {
      if (row.length < 6) return false;
      const nameCol = row[1] || '';
      const jenjang = row[4] || '';
      const kelas = row[5] || '';
      
      let matchJenjang = userData.santri_level ? jenjang === userData.santri_level : true;
      let matchKelas = userData.santri_class ? kelas === userData.santri_class : true;
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
  }, [userData.santri_level, userData.santri_class, filterGender, santriSearch]);

  // Fetch multiple canteens
  const { data: canteens = [], isLoading: isLoadingCanteens } = useQuery({
    queryKey: ['canteens'],
    queryFn: async () => {
      const res = await api.get('/my-canteens');
      return res.data.data || res.data;
    },
    enabled: userRole === ROLES.KANTIN,
    onError: () => {
      toast.error('Gagal mengambil daftar kantin.');
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: (data) => api.post('/me', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
    onSuccess: (res) => {
      setUser(res.data.user);
      setShowEditUserModal(false);
      setShowKeluargaModal(false);
      setUserData(prev => ({ ...prev, password: '' }));
      toast.success('Profil berhasil diperbarui!');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal memperbarui profil');
    }
  });

  const handleSaveUser = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('_method', 'PUT');
    if (userData.name && userData.name !== user?.name) formData.append('name', userData.name);
    if (userData.email && userData.email !== user?.email) formData.append('email', userData.email);
    if (userData.phone !== user?.phone) {
      let p = userData.phone.replace(/\D/g, '');
      if (p.startsWith('0')) p = '62' + p.substring(1);
      formData.append('phone', p);
    }
    if (userData.password) formData.append('password', userData.password);
    if (userData.santri_name !== user?.santri_name) formData.append('santri_name', userData.santri_name);
    if (userData.santri_room !== user?.santri_room) formData.append('santri_room', userData.santri_room);
    if (userData.santri_class !== user?.santri_class) formData.append('santri_class', userData.santri_class);
    if (userData.santri_level !== user?.santri_level) formData.append('santri_level', userData.santri_level);
    if (userData.is_teacher !== undefined) formData.append('is_teacher', userData.is_teacher ? '1' : '0');
    if (userData.niy !== user?.niy) formData.append('niy', userData.niy || '');
    if (userData.teacher_unit !== user?.teacher_unit) formData.append('teacher_unit', userData.teacher_unit || '');
    if (userAvatarFile) formData.append('avatar', userAvatarFile);
    await updateUserMutation.mutateAsync(formData);
  };

  // Add Store Mutation
  const addStoreMutation = useMutation({
    mutationFn: (data) => api.post('/my-canteens', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canteens'] });
      queryClient.invalidateQueries({ queryKey: ['my_canteens_list'] });
      toast.success('Toko baru berhasil dibuat!');
      setShowAddStoreModal(false);
      setNewStoreData({ name: '', description: '' });
      setShowStoreListModal(true);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal membuat toko');
    }
  });

  // Update Store Mutation
  const updateProfileMutation = useMutation({
    mutationFn: ({ id, formData }) => api.post(`/my-canteen?canteen_id=${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canteens'] });
      queryClient.invalidateQueries({ queryKey: ['my_canteens_list'] });
      queryClient.invalidateQueries({ queryKey: ['canteen'] });
      toast.success('Profil toko berhasil disimpan!');
      setShowEditStoreModal(false);
      setImageFile(null);
      setShowStoreListModal(true);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal menyimpan profil.');
    }
  });

  const handleAddStore = async (e) => {
    e.preventDefault();
    addStoreMutation.mutate(newStoreData);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!selectedCanteenId) return;

    setIsSavingProfile(true);
    
    const formData = new FormData();
    formData.append('_method', 'PUT');
    formData.append('name', profileData.name);
    formData.append('description', profileData.description || '');
    const category = profileData.category || 'kauman';
    const autoDeliveryFee = PRICING_CONFIG.BASE_DELIVERY_FEE;
    
    formData.append('open_time', profileData.open_time);
    formData.append('close_time', profileData.close_time);
    formData.append('delivery_fee', autoDeliveryFee);
    formData.append('category', category);
    if (profileData.whatsapp_number) {
      let phone = profileData.whatsapp_number.replace(/\D/g, '');
      if (phone.startsWith('0')) phone = '62' + phone.substring(1);
      formData.append('whatsapp_number', phone);
    }
    if (imageFile) {
      formData.append('image', imageFile);
    }
    
    await updateProfileMutation.mutateAsync({ id: selectedCanteenId, formData });
    setIsSavingProfile(false);
  };

  const openEditStore = (canteen) => {
    setSelectedCanteenId(canteen.id);
    setProfileData({
      name: canteen.name || '',
      category: canteen.category || 'kauman',
      description: canteen.description || '',
      open_time: canteen.open_time?.substring(0,5) || '09:00',
      close_time: canteen.close_time?.substring(0,5) || '17:00',
      image: canteen.image || null,
      whatsapp_number: canteen.whatsapp_number || '',
      delivery_fee: canteen.delivery_fee || 0
    });
    setPreviewUrl(canteen.image ? getStorageUrl(canteen.image) : null);
    setImageFile(null);
    setShowStoreListModal(false);
    setShowEditStoreModal(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Ukuran foto toko maksimal 2 MB');
        e.target.value = '';
        return;
      }
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const MenuItem = ({ icon: Icon, title, badge, badgeColor = 'bg-green-600', isLast, onClick, isRed = false }) => (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between py-3 px-4 sm:py-4 sm:px-5 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${!isLast ? 'border-b border-gray-200 dark:border-gray-700' : ''}`}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <Icon className={`w-5 h-5 ${isRed ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`} strokeWidth={2.5} />
        <span className={`font-semibold text-sm sm:text-[15px] ${isRed ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'}`}>{title}</span>
        {badge && (
          <span className={`ml-2 px-2 py-0.5 rounded-none text-white text-[10px] sm:text-xs font-bold ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>
      <ChevronRight className={`w-4 h-4 sm:w-5 sm:h-5 ${isRed ? 'text-red-400' : 'text-gray-400'}`} />
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 pb-24 font-sans">
      {/* Green Header Area (Gojek Profile Top Bar) */}
      <div className="bg-gradient-to-r from-green-700 via-green-600 to-emerald-700 dark:from-green-900 dark:to-green-950 text-white pt-5 pb-10 sm:pb-12 px-4 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate({ to: '/dashboard' })} 
              className="p-1 -ml-1 text-white hover:bg-white/10 rounded-none transition-colors cursor-pointer"
              title="Kembali"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
            </button>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">Profil</h1>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-3.5 sm:px-4 -mt-6 sm:-mt-8 relative z-10 max-w-lg mx-auto space-y-3.5">
        
        {/* 1. TOP PROFILE CARD (ala Foto 2 Gojek Profil) */}
        <div className="bg-white dark:bg-gray-900 rounded-none border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-none bg-green-600 dark:bg-green-700 flex items-center justify-center text-white text-base sm:text-lg font-black shrink-0 border border-green-700 overflow-hidden shadow-xs">
                {user?.avatar ? (
                  <img src={getStorageUrl(user.avatar)} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  getInitials(user?.name)
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                  {user?.name || 'Pengguna Pondok'}
                </h2>
                <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.email || 'email@pondok.com'}
                </p>
                <p className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-300 font-mono mt-0.5 truncate">
                  {user?.phone ? `+${user.phone}` : 'Belum ada No. WhatsApp'}
                </p>
              </div>
            </div>
            <button 
              onClick={() => setShowEditUserModal(true)} 
              className="p-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-none border border-gray-200 dark:border-gray-700 transition-colors shrink-0 cursor-pointer"
              title="Edit Profil"
            >
              <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* Banner strip spesifik per role */}
          {userRole === ROLES.SUPER_ADMIN ? (
            <div 
              onClick={() => setShowEditUserModal(true)}
              className="px-3.5 py-2 flex items-center justify-between text-xs font-bold cursor-pointer hover:opacity-95 transition-opacity border-t bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white border-amber-600 shadow-2xs"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-xs">🛡️</span>
                <span className="font-extrabold">Super Administrator</span>
                <span className="text-[10.5px] font-normal opacity-90 truncate">• Hak Akses Penuh Sistem</span>
              </div>
              <div className="flex items-center gap-0.5 text-[10.5px] font-black shrink-0">
                <span>Edit</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          ) : userRole === ROLES.ADMIN ? (
            <div 
              onClick={() => setShowEditUserModal(true)}
              className="px-3.5 py-2 flex items-center justify-between text-xs font-bold cursor-pointer hover:opacity-95 transition-opacity border-t bg-gradient-to-r from-emerald-600 via-green-600 to-teal-700 text-white border-green-600 shadow-2xs"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-xs">🛡️</span>
                <span className="font-extrabold">Administrator</span>
                <span className="text-[10.5px] font-normal opacity-90 truncate">• Pengelola & Manajemen Pondok</span>
              </div>
              <div className="flex items-center gap-0.5 text-[10.5px] font-black shrink-0">
                <span>Edit</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          ) : userRole === ROLES.KANTIN ? (
            <div 
              onClick={() => setShowEditUserModal(true)}
              className="px-3.5 py-2 flex items-center justify-between text-xs font-bold cursor-pointer hover:opacity-95 transition-opacity border-t bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-700 text-white border-purple-600 shadow-2xs"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-xs">🏪</span>
                <span className="font-extrabold">Mitra Toko / Kantin</span>
                <span className="text-[10.5px] font-normal opacity-90 truncate">• Pengelola Outlet Pondok</span>
              </div>
              <div className="flex items-center gap-0.5 text-[10.5px] font-black shrink-0">
                <span>Edit</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          ) : userRole === ROLES.KURIR ? (
            <div 
              onClick={() => setShowEditUserModal(true)}
              className="px-3.5 py-2 flex items-center justify-between text-xs font-bold cursor-pointer hover:opacity-95 transition-opacity border-t bg-gradient-to-r from-teal-700 via-cyan-700 to-blue-800 text-white border-teal-600 shadow-2xs"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-xs">🛵</span>
                <span className="font-extrabold">Kurir Pengantaran</span>
                <span className="text-[10.5px] font-normal opacity-90 truncate">• Tim Pengantar Asrama</span>
              </div>
              <div className="flex items-center gap-0.5 text-[10.5px] font-black shrink-0">
                <span>Edit</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          ) : (
            <div 
              onClick={() => setShowEditUserModal(true)}
              className={`px-3.5 py-2 flex items-center justify-between text-xs font-bold cursor-pointer hover:opacity-95 transition-opacity border-t ${
                user?.is_teacher
                  ? 'bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 text-white border-indigo-600 dark:border-indigo-500'
                  : 'bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 dark:from-amber-600 dark:to-yellow-600 text-amber-950 dark:text-white border-amber-300 dark:border-amber-700'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-xs">{user?.is_teacher ? '🎓' : '⭐'}</span>
                <span className="font-extrabold">{user?.is_teacher ? `Guru / Staff ${user?.teacher_unit || ''}` : 'Santri Al-Mannan'}</span>
                <span className="text-[10.5px] font-normal opacity-90 truncate">
                  • {user?.is_teacher ? (user?.niy ? `NIY: ${user.niy}` : 'Belum isi NIY') : `Kamar: ${user?.santri_room || 'Belum diisi'}`}
                </span>
              </div>
              <div className="flex items-center gap-0.5 text-[10.5px] font-black shrink-0">
                <span>Ubah</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          )}

        </div>

        {/* Banner Jika Kantin Belum Memiliki Toko */}
        {userRole === ROLES.KANTIN && !isLoadingCanteens && canteens.length === 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-none p-4 text-center space-y-2 shadow-xs">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-none flex items-center justify-center mx-auto">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">Anda Belum Memiliki Toko / Kantin</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Daftarkan toko/kantin Anda sekarang untuk mulai mengunggah produk dan menerima pesanan dari santri.
              </p>
            </div>
            <button
              onClick={() => setShowAddStoreModal(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-none shadow-xs transition-all active:scale-95 inline-flex items-center gap-1.5 cursor-pointer"
            >
              ＋ Buat Toko Baru Sekarang
            </button>
          </div>
        )}

        {/* 2. SECTION PREFERENSI (ala Foto 2 Gojek Profil) */}
        <div>
          <h3 className="px-1 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            Preferensi
          </h3>
          <div className="bg-white dark:bg-gray-900 rounded-none overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xs">
            <MenuItem 
              icon={ShieldCheck} 
              title="Keamanan Akun & Sandi" 
              onClick={() => setShowEditUserModal(true)} 
            />

            {/* Menu Khusus Santri / Wali (User) */}
            {(!userRole || userRole === ROLES.USER) && (
              <>
                <MenuItem 
                  icon={MapPin} 
                  title="Kamar & Lokasi Pengantaran" 
                  badge={user?.is_teacher ? (user?.teacher_unit ? `Ruang Guru ${user.teacher_unit}` : 'Ruang Guru') : (user?.santri_room ? user.santri_room : 'Atur Kamar')}
                  badgeColor={user?.is_teacher ? 'bg-indigo-700' : (user?.santri_room ? 'bg-green-600' : 'bg-amber-600')}
                  onClick={() => setShowEditUserModal(true)} 
                />
                <MenuItem 
                  icon={CreditCard} 
                  title="Metode Pembayaran Pondok" 
                  badge="QRIS / Tunai"
                  badgeColor="bg-blue-600"
                  onClick={() => navigate({ to: '/dashboard/pembayaran' })} 
                />
                <MenuItem 
                  icon={Users} 
                  title={user?.is_teacher ? "Akun Santri Terhubung (Opsional)" : "Akun Keluarga / Wali Santri"} 
                  badge={user?.santri_name ? 'Terisi' : (user?.is_teacher ? 'Opsional' : 'Wajib')}
                  badgeColor={user?.santri_name ? 'bg-green-600' : (user?.is_teacher ? 'bg-gray-500' : 'bg-amber-600')}
                  onClick={() => setShowKeluargaModal(true)} 
                />
              </>
            )}

            {/* Menu Khusus Kantin */}
            {userRole === ROLES.KANTIN && (
              <>
                <MenuItem 
                  icon={Store} 
                  title="Kelola Toko Saya" 
                  badge={canteens.length > 0 ? `${canteens.length} Toko` : 'Daftar'} 
                  badgeColor="bg-green-600"
                  onClick={() => setShowStoreListModal(true)} 
                />
                <MenuItem 
                  icon={Ticket} 
                  title="Pengajuan Promo Toko" 
                  onClick={() => navigate({ to: '/dashboard/toko-saya/promo' })} 
                />
                <MenuItem 
                  icon={Calculator} 
                  title="Logika & Aturan Akuntansi" 
                  badge="Aturan & Simulasi" 
                  badgeColor="bg-green-600"
                  onClick={() => setShowAccountingModal(true)} 
                />
              </>
            )}

            {/* Menu Khusus Kurir */}
            {userRole === ROLES.KURIR && (
              <MenuItem 
                icon={Store} 
                title="Tugas Pengantaran Hari Ini" 
                badge="Buka Tugas" 
                badgeColor="bg-teal-600"
                onClick={() => navigate({ to: '/dashboard/tugas-kurir' })} 
              />
            )}

            {/* Menu Khusus Admin & Super Admin */}
            {isAdminLevel(userRole) && (
              <>
                <MenuItem 
                  icon={Calculator} 
                  title="Logika & Aturan Akuntansi" 
                  badge="Aturan & Simulasi" 
                  badgeColor="bg-green-600"
                  onClick={() => setShowAccountingModal(true)} 
                />
                <MenuItem 
                  icon={Coins} 
                  title="Rekapitulasi Keuangan & Penjualan" 
                  onClick={() => navigate({ to: userRole === ROLES.ADMIN ? '/dashboard/toko-saya/pesanan' : '/dashboard/admin/pesanan' })} 
                />
                {userRole === ROLES.SUPER_ADMIN && (
                  <MenuItem 
                    icon={Users} 
                    title="Manajemen User & Akun" 
                    onClick={() => navigate({ to: '/dashboard/users' })} 
                  />
                )}
                <MenuItem 
                  icon={Store} 
                  title={userRole === ROLES.ADMIN ? "Katalog & Pengelolaan Toko" : "Manajemen Toko & Kantin"} 
                  onClick={() => navigate({ to: userRole === ROLES.ADMIN ? '/dashboard/toko-saya' : '/dashboard/pertokoan' })} 
                />
              </>
            )}
          </div>
        </div>

        {/* 3. SECTION AKTIVITAS (ala Foto 2 Gojek Profil) */}
        <div>
          <h3 className="px-1 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            Aktivitas di HiGO Pondok
          </h3>
          <div className="bg-white dark:bg-gray-900 rounded-none overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xs">
            <MenuItem 
              icon={Activity} 
              title="Aktivitas & Riwayat Transaksi" 
              onClick={() => navigate({ to: '/dashboard/pembayaran' })} 
            />
            <MenuItem 
              icon={Ticket} 
              title="Promo & Voucher Kupon" 
              badge="Promo terbatas 🔥"
              badgeColor="bg-red-600"
              onClick={() => navigate({ to: '/vouchers' })} 
            />
            <MenuItem 
              icon={Smartphone} 
              title="Pasang Aplikasi di HP (PWA)" 
              badge={isStandalone ? "Sudah Terpasang" : "Pasang di HP"} 
              badgeColor={isStandalone ? "bg-emerald-600" : "bg-green-600"}
              onClick={() => {
                if (isStandalone) {
                  toast.success('HiGO Pondok sudah terpasang di HP Anda!');
                } else {
                  installApp();
                }
              }} 
            />
            <MenuItem 
              icon={BookOpen} 
              title="Buku Panduan & SOP Pondok" 
              onClick={() => navigate({ to: '/dashboard/panduan' })} 
            />
          </div>
        </div>

        {/* 4. SECTION PENGATURAN APLIKASI (ala Foto 2 Gojek Profil) */}
        <div>
          <h3 className="px-1 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            Pengaturan Aplikasi
          </h3>
          <div className="bg-white dark:bg-gray-900 rounded-none overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xs">
            <div className="w-full flex items-center justify-between py-2.5 px-4 sm:py-3 sm:px-5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <span className="text-sm">🌓</span>
                <span className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                  Mode Gelap / Terang
                </span>
              </div>
              <ThemeToggle />
            </div>
            <MenuItem 
              icon={LogOut} 
              title="Keluar / Logout" 
              isLast={true} 
              isRed={true} 
              onClick={handleLogout} 
            />
          </div>
        </div>

      </div>

      {/* Modal Daftar Toko (Multi-Store) */}
      {userRole === ROLES.KANTIN && showStoreListModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] my-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Kelola Toko Saya</h3>
              <button onClick={() => setShowStoreListModal(false)} className="text-gray-400 hover:text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingCanteens ? (
                <LoadingSpinner 
                  text="Memuat data toko Anda..." 
                  subtext="Mengambil daftar kantin yang terdaftar" 
                  minHeight="min-h-[140px]"
                />
              ) : canteens.length === 0 ? (
                <div className="text-center py-8">
                  <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">Anda belum memiliki toko.</p>
                </div>
              ) : (
                canteens.map(c => (
                  <div key={c.id} onClick={() => openEditStore(c)} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none cursor-pointer transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-none bg-green-100 flex items-center justify-center overflow-hidden shrink-0">
                        {c.image ? (
                          <img src={getStorageUrl(c.image)} alt={c.name} className="w-full h-full object-cover" />
                        ) : (
                          <Store className="w-6 h-6 text-green-600" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">{c.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          {c.status === 'pending' ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-none bg-yellow-100 text-yellow-700">Menunggu Review</span>
                          ) : c.status === 'rejected' ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-none bg-red-100 text-red-700">Ditolak</span>
                          ) : c.is_open ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-none bg-green-100 text-green-700">Buka</span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-none bg-gray-200 text-gray-700">Tutup</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button 
                onClick={() => {
                  setShowStoreListModal(false);
                  setShowAddStoreModal(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-500 font-semibold rounded-none hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors border border-green-200 dark:border-green-800/50"
              >
                <Plus className="w-5 h-5" />
                Tambah Toko Baru
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Tambah Toko Baru */}
      {showAddStoreModal && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none shadow-xl w-full max-w-md overflow-hidden flex flex-col my-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <button onClick={() => {
                  setShowAddStoreModal(false);
                  setShowStoreListModal(true);
                }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Tambah Toko Baru</h3>
              </div>
            </div>
            <form onSubmit={handleAddStore} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Nama Toko/Kantin</label>
                <input required type="text" value={newStoreData.name} onChange={e => setNewStoreData({...newStoreData, name: e.target.value})} className="w-full rounded-none border border-gray-300 dark:border-gray-700 py-2.5 px-3 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500" placeholder="Misal: Kantin Barokah 2" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Deskripsi Singkat</label>
                <textarea rows="3" value={newStoreData.description} onChange={e => setNewStoreData({...newStoreData, description: e.target.value})} className="w-full rounded-none border border-gray-300 dark:border-gray-700 py-2.5 px-3 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500" placeholder="Menjual berbagai makanan..."></textarea>
              </div>
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-none flex gap-3">
                <ShieldCheck className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800 dark:text-yellow-500">Toko baru memerlukan persetujuan Admin sebelum bisa berjualan. Anda dapat melengkapi profil (foto, dll) setelah menambahkan toko ini.</p>
              </div>
              <button type="submit" disabled={addStoreMutation.isPending} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-none flex justify-center shadow-md">
                {addStoreMutation.isPending ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Tambah Toko'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Edit Kantin */}
      {userRole === ROLES.KANTIN && showEditStoreModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] my-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <button onClick={() => {
                  setShowEditStoreModal(false);
                  setShowStoreListModal(true);
                }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Pengaturan Profil Toko</h3>
              </div>
            </div>
            
            <form onSubmit={handleSaveProfile} className="flex-1 overflow-y-auto">
              <div className="h-28 sm:h-32 bg-gradient-to-r from-green-400 to-green-600 relative">
                <div className="absolute -bottom-10 left-4 sm:left-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-none bg-white dark:bg-gray-800 border-4 border-white dark:border-gray-900 flex items-center justify-center overflow-hidden shadow-md">
                      {previewUrl ? (
                        <img src={previewUrl} alt="Store" className="w-full h-full object-cover" />
                      ) : (
                        <Store className="w-8 h-8 text-green-500" />
                      )}
                    </div>
                    <label htmlFor="upload-banner" className="absolute -bottom-1 -right-1 p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-none shadow-lg transition-colors cursor-pointer">
                      <Camera className="w-3 h-3" />
                    </label>
                    <input id="upload-banner" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </div>
                </div>
              </div>
              
              <div className="pt-14 pb-5 px-4 sm:px-6">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Nama Kantin</label>
                    <input type="text" id="name" required value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} className="mt-1 block w-full rounded-none border border-gray-200 dark:border-gray-700 py-2 px-3 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors" />
                  </div>
                  <div>
                    <label htmlFor="description" className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Deskripsi Singkat</label>
                    <textarea id="description" rows="2" value={profileData.description} onChange={e => setProfileData({...profileData, description: e.target.value})} className="mt-1 block w-full rounded-none border border-gray-200 dark:border-gray-700 py-2 px-3 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="open_time" className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Jam Buka</label>
                      <input type="time" id="open_time" required value={profileData.open_time} onChange={e => setProfileData({...profileData, open_time: e.target.value})} className="mt-1 block w-full rounded-none border border-gray-200 dark:border-gray-700 py-2 px-3 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors" />
                    </div>
                    <div>
                      <label htmlFor="close_time" className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Jam Tutup</label>
                      <input type="time" id="close_time" required value={profileData.close_time} onChange={e => setProfileData({...profileData, close_time: e.target.value})} className="mt-1 block w-full rounded-none border border-gray-200 dark:border-gray-700 py-2 px-3 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label htmlFor="whatsapp_number" className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Nomor WhatsApp Toko</label>
                    <p className="text-[10px] text-gray-400 mb-1">Masukkan nomor HP format lokal (awalan 0) atau internasional (awalan 62).</p>
                    <div className="mt-1 flex items-center border border-gray-200 dark:border-gray-700 rounded-none overflow-hidden bg-gray-50 dark:bg-gray-800 focus-within:ring-2 focus-within:ring-green-500">
                      <span className="px-3 py-2 text-sm font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-700 shrink-0">+62 / 0</span>
                      <input 
                        type="tel" 
                        id="whatsapp_number" 
                        placeholder="812-3456-7890"
                        value={profileData.whatsapp_number} 
                        onChange={e => setProfileData({...profileData, whatsapp_number: e.target.value})} 
                        className="flex-1 py-2 px-3 text-sm text-gray-900 dark:text-white bg-transparent focus:outline-none" 
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="category" className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Kategori Wilayah Toko</label>
                    <p className="text-[10px] text-gray-400 mb-1">Zona jangkauan pengantaran kurir.</p>
                    <select
                      id="category"
                      value={profileData.category || 'kauman'}
                      onChange={e => setProfileData({
                        ...profileData, 
                        category: e.target.value,
                        delivery_fee: PRICING_CONFIG.BASE_DELIVERY_FEE
                      })}
                      className="w-full mt-1 p-2.5 border border-gray-200 dark:border-gray-700 rounded-none text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 font-medium"
                    >
                      <option value="kauman">Kauman / Sekitar Pondok</option>
                      <option value="kota">Area Kota / Luar</option>
                    </select>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-none border border-gray-200 dark:border-gray-700/60 space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Rincian Tarif Layanan Terpadu</label>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold pt-0.5">
                      <span className="bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800 px-2.5 py-1 rounded-none font-mono">
                        🛵 Ongkir Kurir: {formatRupiah(PRICING_CONFIG.BASE_DELIVERY_FEE)}
                      </span>
                      <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-none font-mono">
                        🛡️ Biaya Layanan: {formatRupiah(PRICING_CONFIG.BASE_ADMIN_FEE)}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                      *Tarif dasar berlaku untuk 1–5 item. Setiap kelipatan 5 item berikutnya dikenakan tambahan penyesuaian beban pesanan.
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-4 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 mt-4">
                <button type="submit" disabled={isSavingProfile} className="w-full inline-flex items-center justify-center px-5 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-none shadow-sm transition-colors disabled:opacity-70">
                  {isSavingProfile ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></span> : <Save className="w-4 h-4 mr-2" />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit User Modal */}
      {showEditUserModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 w-full sm:max-w-md rounded-none shadow-xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Profil Pribadi</h3>
              <button onClick={() => setShowEditUserModal(false)} className="text-gray-400 hover:text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveUser} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="w-24 h-24 rounded-none bg-[#55C564] flex items-center justify-center text-white text-3xl font-bold shadow-sm overflow-hidden border-4 border-gray-50 dark:border-gray-800">
                    {userAvatarPreview ? (
                      <img src={userAvatarPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : user?.avatar ? (
                      <img src={getStorageUrl(user.avatar)} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      getInitials(user?.name)
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 p-2 bg-green-600 text-white rounded-none cursor-pointer hover:bg-green-700 shadow-md transition-colors">
                    <Camera className="w-4 h-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        if (file.size > 2 * 1024 * 1024) {
                          toast.error('Ukuran foto profil maksimal 2 MB');
                          e.target.value = '';
                          return;
                        }
                        setUserAvatarFile(file);
                        setUserAvatarPreview(URL.createObjectURL(file));
                      }
                    }} />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Lengkap</label>
                <input required type="text" value={userData.name} onChange={e => setUserData({...userData, name: e.target.value})} className="w-full rounded-none border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-2.5 text-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:ring-2 focus:ring-green-500 outline-none transition-shadow" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input required type="email" value={userData.email} onChange={e => setUserData({...userData, email: e.target.value})} className="w-full rounded-none border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-2.5 text-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:ring-2 focus:ring-green-500 outline-none transition-shadow" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nomor WhatsApp</label>
                <input required type="tel" placeholder="Contoh: 08123456789" value={userData.phone} onChange={e => setUserData({...userData, phone: e.target.value})} className="w-full rounded-none border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-2.5 text-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:ring-2 focus:ring-green-500 outline-none transition-shadow" />
              </div>

              {/* Opsi Khusus Guru / Staff Yayasan */}
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-none space-y-3">
                <div className="flex items-center justify-between">
                  <div className="pr-2">
                    <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-emerald-900 dark:text-emerald-200">
                      <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Akun Guru / Staff Yayasan</span>
                    </div>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                      Prioritas pengantaran langsung ke Ruang Guru / Kantor Unit.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      checked={userData.is_teacher} 
                      onChange={e => setUserData({ ...userData, is_teacher: e.target.checked })} 
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-none peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                  </label>
                </div>

                {userData.is_teacher && (
                  <div className="pt-2.5 border-t border-emerald-200 dark:border-emerald-800/80 space-y-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1">
                        Nomor Induk Yayasan (NIY) <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        placeholder="Contoh: NIY. 1992.05.012"
                        value={userData.niy} 
                        onChange={e => setUserData({ ...userData, niy: e.target.value })}
                        className="w-full rounded-none border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2.5 text-xs focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1">
                        Unit Guru / Staff <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={userData.teacher_unit}
                        onChange={e => setUserData({ ...userData, teacher_unit: e.target.value })}
                        className="w-full rounded-none border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2.5 text-xs focus:ring-2 focus:ring-green-500 outline-none font-medium"
                      >
                        <option value="">-- Pilih Unit Yayasan --</option>
                        <option value="RA">RA (Raudhatul Athfal)</option>
                        <option value="MI">MI (Madrasah Ibtidaiyah)</option>
                        <option value="SMP">SMP (Sekolah Menengah Pertama)</option>
                        <option value="MA">MA (Madrasah Aliyah)</option>
                        <option value="Kampus">Kampus (STAI Al-Mannan)</option>
                      </select>
                    </div>

                    <p className="text-[10.5px] text-emerald-700 dark:text-emerald-300 italic leading-tight">
                      *Guru/Staff tidak wajib mengisi profil santri untuk memesan makanan, dan dapat memilih apakah pesanan untuk diri sendiri atau untuk santri saat checkout.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password Baru (Opsional)</label>
                <input type="password" placeholder="Kosongkan jika tak ingin diubah" value={userData.password} onChange={e => setUserData({...userData, password: e.target.value})} className="w-full rounded-none border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-2.5 text-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:ring-2 focus:ring-green-500 outline-none transition-shadow" />
              </div>

              <div className="pt-6 mt-2 flex gap-3">
                <button type="button" onClick={() => setShowEditUserModal(false)} className="flex-1 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-none hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={updateUserMutation.isPending} className="flex-[2] py-3 text-sm font-bold text-white bg-green-600 rounded-none hover:bg-green-700 disabled:opacity-70 flex items-center justify-center shadow-md transition-colors">
                  {updateUserMutation.isPending ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Simpan Profil'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Keluarga Santri */}
      {showKeluargaModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 w-full sm:max-w-md rounded-none shadow-xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Keluarga Santri</h3>
              <button onClick={() => setShowKeluargaModal(false)} className="text-gray-400 hover:text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveUser} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="mb-2">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                  Data Santri {user?.is_teacher ? '(Opsional bagi Guru/Staff)' : '(Wajib diisi sebelum memesan)'}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {user?.is_teacher 
                    ? 'Isi bagian ini jika Anda juga ingin memesankan makanan untuk anak / santri keluarga Anda.' 
                    : 'Pastikan nama dan lokasi kamar santri valid agar pengiriman makanan berjalan lancar.'}
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Jenjang</label>
                    <select 
                      value={userData.santri_level} 
                      onChange={e => {
                        setUserData({
                          ...userData, 
                          santri_level: e.target.value,
                          santri_class: '',
                          santri_name: '',
                          santri_room: ''
                        });
                      }} 
                      className="w-full rounded-none border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-2.5 text-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:ring-2 focus:ring-green-500 outline-none transition-shadow"
                    >
                      <option value="">Semua Jenjang</option>
                      {uniqueJenjang.map(j => <option key={j} value={j}>{j}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Kelas</label>
                    <select 
                      value={userData.santri_class} 
                      onChange={e => {
                        setUserData({
                          ...userData, 
                          santri_class: e.target.value,
                          santri_name: '',
                          santri_room: ''
                        });
                      }} 
                      className="w-full rounded-none border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-2.5 text-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:ring-2 focus:ring-green-500 outline-none transition-shadow"
                    >
                      <option value="">Semua Kelas</option>
                      {availableKelas.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Jenis Kelamin</label>
                  <select 
                    value={filterGender} 
                    onChange={e => {
                      setFilterGender(e.target.value);
                      setUserData({...userData, santri_name: '', santri_room: ''});
                    }} 
                    className="w-full rounded-none border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-2.5 text-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:ring-2 focus:ring-green-500 outline-none transition-shadow"
                  >
                    <option value="">Semua</option>
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
                <div className="relative" ref={santriDropdownRef}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                      Nama Santri
                    </label>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {filteredSantris.length} santri tersedia
                    </span>
                  </div>

                  {/* Trigger Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSantriOpen(!isSantriOpen);
                      setSantriSearch('');
                    }}
                    className={`w-full text-left rounded-none border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2.5 text-sm ring-1 ring-inset ${
                      isSantriOpen ? 'ring-2 ring-green-500 border-green-500' : 'ring-gray-300 dark:ring-gray-700'
                    } focus:ring-2 focus:ring-green-500 outline-none transition-shadow flex items-center justify-between`}
                  >
                    <span className={`truncate pr-2 ${userData.santri_name ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                      {userData.santri_name 
                        ? `${userData.santri_name} ${userData.santri_level || userData.santri_class ? `(${[userData.santri_level, userData.santri_class].filter(Boolean).join(' - ')})` : ''}` 
                        : '-- Pilih Santri --'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isSantriOpen ? 'rotate-180 text-green-600' : ''}`} />
                  </button>

                  {/* Dropdown Panel dengan Pencarian Terpadu di dalamnya */}
                  {isSantriOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-green-500 dark:border-green-600 z-50 shadow-2xl">
                      {/* Search Bar di bagian atas dropdown */}
                      <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80 flex items-center gap-2">
                        <Search className="w-4 h-4 text-gray-400 shrink-0" />
                        <input
                          type="text"
                          autoFocus
                          placeholder="Ketik untuk mencari nama santri..."
                          value={santriSearch}
                          onChange={(e) => setSantriSearch(e.target.value)}
                          className="w-full bg-transparent text-sm text-gray-900 dark:text-white outline-none placeholder:text-gray-400"
                        />
                        {santriSearch && (
                          <button
                            type="button"
                            onClick={() => setSantriSearch('')}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* List Santri */}
                      <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredSantris.length === 0 ? (
                          <div className="p-3 text-xs text-gray-500 dark:text-gray-400 text-center">
                            Santri tidak ditemukan {santriSearch ? `untuk "${santriSearch}"` : ''}
                          </div>
                        ) : (
                          filteredSantris.map((row, i) => {
                            const rawName = row[1] || '';
                            const cleanName = rawName.replace(' Laki-laki', '').replace(' Perempuan', '');
                            const jenjang = row[4] || '';
                            const kelas = row[5] || '';
                            const info = [jenjang, kelas].filter(Boolean).join(' - ');
                            const isSelected = userData.santri_name === cleanName;

                            return (
                              <button
                                type="button"
                                key={i}
                                onClick={() => {
                                  setUserData({
                                    ...userData,
                                    santri_name: cleanName,
                                    santri_level: row[4] || userData.santri_level,
                                    santri_class: row[5] || userData.santri_class,
                                    santri_room: row[10] || userData.santri_room
                                  });
                                  setIsSantriOpen(false);
                                  setSantriSearch('');
                                }}
                                className={`w-full text-left p-2.5 text-xs flex items-center justify-between hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors ${
                                  isSelected 
                                    ? 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 font-bold' 
                                    : 'text-gray-800 dark:text-gray-200'
                                }`}
                              >
                                <div className="truncate pr-2">
                                  <span className="font-semibold text-gray-900 dark:text-white">{cleanName}</span>
                                  {info && <span className="ml-1.5 text-[10.5px] text-gray-400 dark:text-gray-500">({info})</span>}
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-green-600 shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Asrama / Kamar (Isian Bebas)</label>
                  <input 
                    type="text"
                    placeholder="Ketik lokasi asrama / kamar santri..."
                    value={userData.santri_room} 
                    onChange={e => setUserData({...userData, santri_room: e.target.value})} 
                    className="w-full rounded-none border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white p-2.5 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">No. WhatsApp / HP Pembeli (Wali Santri)</label>
                  <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-none overflow-hidden bg-gray-50 dark:bg-gray-800 focus-within:ring-2 focus-within:ring-green-500">
                    <input 
                      type="text"
                      placeholder="812-3456-7890"
                      value={userData.phone} 
                      onChange={e => setUserData({...userData, phone: e.target.value})} 
                      className="flex-1 py-2.5 px-3 text-sm text-gray-900 dark:text-white bg-transparent focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Nomor ini digunakan toko & kurir untuk mengonfirmasi pesanan Anda.</p>
                </div>
              </div>

              <div className="pt-6 mt-2 flex gap-3">
                <button type="button" onClick={() => setShowKeluargaModal(false)} className="flex-1 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-none hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={updateUserMutation.isPending} className="flex-[2] py-3 text-sm font-bold text-white bg-green-600 rounded-none hover:bg-green-700 disabled:opacity-70 flex items-center justify-center shadow-md transition-colors">
                  {updateUserMutation.isPending ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Simpan Data Santri'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {/* Modal Alur Kerja */}
      {showWorkflowModal && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-none shadow-xl w-full max-w-md max-h-[85vh] flex flex-col my-auto">
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Alur Kerja Saya</h3>
              <button onClick={() => setShowWorkflowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {userRole === ROLES.KURIR && (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-blue-300 before:to-transparent">
                  <h4 className="text-center font-bold text-blue-600 mb-6">Kurir (Driver)</h4>
                  
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-none border-4 border-white bg-blue-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      1
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-none border border-gray-200 bg-white shadow-sm">
                      <h4 className="font-bold text-gray-900 text-sm">Aktifkan Status Bekerja</h4>
                      <p className="text-[10px] font-semibold text-blue-600 mb-1 mt-1">📍 Navigasi: Beranda → Switch "Status Bekerja"</p>
                      <p className="text-xs text-gray-500">Anda wajib menyalakan toggle "Status Bekerja" menjadi ON agar penyedia menu dapat melihat dan memilih Anda.</p>
                    </div>
                  </div>

                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-none border-4 border-white bg-blue-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      2
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-none border border-gray-200 bg-white shadow-sm">
                      <h4 className="font-bold text-gray-900 text-sm">Ambil Pesanan di Toko Luar</h4>
                      <p className="text-[10px] font-semibold text-blue-600 mb-1 mt-1">📍 Navigasi: Menu Bawah → Ikon Motor (Tugas)</p>
                      <p className="text-xs text-gray-500">Lihat detail pesanan di tab "Tugas". Pergilah ke toko/warung luar untuk mengambil makanan (Kantin di aplikasi hanya menyediakan menu). Jika ditalangi tunai, klik tombol "Upload Struk".</p>
                    </div>
                  </div>

                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-none border-4 border-white bg-blue-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      3
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-none border border-gray-200 bg-white shadow-sm">
                      <h4 className="font-bold text-gray-900 text-sm">Antar ke Lokasi & Foto</h4>
                      <p className="text-[10px] font-semibold text-blue-600 mb-1 mt-1">📍 Navigasi: Halaman Tugas → Upload Bukti Pengantaran</p>
                      <p className="text-xs text-gray-500">Antar makanan ke kamar/kelas santri. Lalu ambil foto serah terima sebagai bukti bahwa tugas selesai diantar.</p>
                    </div>
                  </div>
                </div>
              )}

              {userRole === ROLES.KANTIN && (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-green-300 before:to-transparent">
                  <h4 className="text-center font-bold text-green-600 mb-6">Toko / Kantin</h4>
                  
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-none border-4 border-white bg-green-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      1
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-none border border-gray-200 bg-white shadow-sm">
                      <h4 className="font-bold text-gray-900 text-sm">Buat & Kelola Toko</h4>
                      <p className="text-[10px] font-semibold text-green-600 mb-1 mt-1">📍 Navigasi: Profil → Kelola Toko Saya</p>
                      <p className="text-xs text-gray-500">Buat toko baru (klik Tambah Toko). Setelah selesai, pilih toko tersebut untuk mulai mengelola jam buka, menu makanan, dan melihat analitik harian Anda.</p>
                    </div>
                  </div>

                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-none border-4 border-white bg-green-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      2
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-none border border-gray-200 bg-white shadow-sm">
                      <h4 className="font-bold text-gray-900 text-sm">Terima Pesanan</h4>
                      <p className="text-[10px] font-semibold text-green-600 mb-1 mt-1">📍 Navigasi: Menu Bawah → Ikon Pesanan</p>
                      <p className="text-xs text-gray-500">Pantau daftar pesanan baru. Jika stok habis, klik tombol merah "Tolak". Jika pesanan disetujui, siapkan makanannya.</p>
                    </div>
                  </div>

                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-none border-4 border-white bg-green-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      3
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-none border border-gray-200 bg-white shadow-sm">
                      <h4 className="font-bold text-gray-900 text-sm">Pilih Kurir</h4>
                      <p className="text-[10px] font-semibold text-green-600 mb-1 mt-1">📍 Navigasi: Halaman Pesanan → Tombol Biru "Pilih Kurir"</p>
                      <p className="text-xs text-gray-500">Klik tombol "Pilih Kurir", lalu pilih kurir yang berstatus aktif/bekerja untuk menugaskannya mengantar pesanan ke santri.</p>
                    </div>
                  </div>

                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-none border-4 border-white bg-green-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      4
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-none border border-gray-200 bg-white shadow-sm">
                      <h4 className="font-bold text-gray-900 text-sm">Tandai Lunas & Selesai</h4>
                      <p className="text-[10px] font-semibold text-green-600 mb-1 mt-1">📍 Navigasi: Halaman Pesanan → Tombol Hijau "Lunas & Selesai"</p>
                      <p className="text-xs text-gray-500">Setelah foto bukti kurir terupload di pesanan, verifikasi, lalu klik "Lunas & Selesai". Saldo Anda akan otomatis bertambah!</p>
                    </div>
                  </div>
                </div>
              )}

              {userRole === ROLES.USER && (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-orange-300 before:to-transparent">
                  <h4 className="text-center font-bold text-orange-600 mb-6">Wali Santri (Pembeli)</h4>
                  
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-none border-4 border-white bg-orange-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      1
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-none border border-gray-200 bg-white shadow-sm">
                      <h4 className="font-bold text-gray-900 text-sm">Pilih Makanan</h4>
                      <p className="text-[10px] font-semibold text-orange-600 mb-1 mt-1">📍 Navigasi: Beranda → Pilih Kantin/Toko → Klik '+' pada Menu</p>
                      <p className="text-xs text-gray-500">Pilih menu dari toko yang berstatus Buka (Hijau). Cek juga menu "Pesanan Khusus" jika ada titipan khusus di luar menu.</p>
                    </div>
                  </div>

                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-none border-4 border-white bg-orange-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      2
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-none border border-gray-200 bg-white shadow-sm">
                      <h4 className="font-bold text-gray-900 text-sm">Checkout & Transfer</h4>
                      <p className="text-[10px] font-semibold text-orange-600 mb-1 mt-1">📍 Navigasi: Ikon Keranjang (Kanan Atas) → Checkout</p>
                      <p className="text-xs text-gray-500">Selesaikan pesanan Anda, lalu unggah bukti transfer pembayaran di halaman Profil → Aktivitas Pembayaran.</p>
                    </div>
                  </div>

                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-none border-4 border-white bg-orange-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      3
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-none border border-gray-200 bg-white shadow-sm">
                      <h4 className="font-bold text-gray-900 text-sm">Tunggu Pengantaran</h4>
                      <p className="text-[10px] font-semibold text-orange-600 mb-1 mt-1">📍 Navigasi: Halaman Pembayaran → Status Order</p>
                      <p className="text-xs text-gray-500">Pantau status pesanan. Kurir akan mengantarkan pesanan ke santri. Anda bisa melihat foto bukti serah terima jika pesanan sudah selesai.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Logika Akuntansi untuk Admin */}
      <AdminAccountingModal 
        isOpen={showAccountingModal} 
        onClose={() => setShowAccountingModal(false)} 
      />

    </div>
  );
}
