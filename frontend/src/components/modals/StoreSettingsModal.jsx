import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Store, Camera, Clock, CheckCircle2, AlertCircle, Phone, MapPin, Save, ExternalLink } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api, { getStorageUrl } from '../../lib/axios';
import { CANTEEN_ZONES, PRICING_CONFIG } from '../../config/pricing';
import { compressImageFile } from '../../lib/fileUtils';

export default function StoreSettingsModal({ isOpen, onClose, canteen, onSuccess }) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    category: 'kauman',
    description: '',
    is_open: true,
    open_time: '06:00',
    close_time: '21:00',
    closed_days: [],
    whatsapp_number: '',
  });

  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Sync state ketika canteen berubah atau modal dibuka
  useEffect(() => {
    if (canteen && isOpen) {
      setFormData({
        name: canteen.name || '',
        category: canteen.category || 'kauman',
        description: canteen.description || '',
        is_open: Boolean(canteen.is_open),
        open_time: canteen.open_time ? canteen.open_time.substring(0, 5) : '06:00',
        close_time: canteen.close_time ? canteen.close_time.substring(0, 5) : '21:00',
        closed_days: Array.isArray(canteen.closed_days) ? canteen.closed_days : [],
        whatsapp_number: canteen.whatsapp_number || '',
      });
      setPreviewUrl(canteen.image ? getStorageUrl(canteen.image) : null);
      setImageFile(null);
    }
  }, [canteen, isOpen]);

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageFile(file, { maxWidth: 1000, maxHeight: 1000, quality: 0.8 });
        setImageFile(compressed);
        setPreviewUrl(URL.createObjectURL(compressed));
      } catch {
        setImageFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      }
    }
  };

  const handleToggleDay = (dayId) => {
    setFormData((prev) => {
      const exists = prev.closed_days.includes(dayId);
      const updated = exists
        ? prev.closed_days.filter((d) => d !== dayId)
        : [...prev.closed_days, dayId];
      return { ...prev, closed_days: updated };
    });
  };

  const updateStoreMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post(`/my-canteen?canteen_id=${canteen.id}`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Pengaturan toko berhasil diperbarui!');
      queryClient.invalidateQueries({ queryKey: ['canteen'] });
      queryClient.invalidateQueries({ queryKey: ['canteens'] });
      queryClient.invalidateQueries({ queryKey: ['my_canteens_list'] });
      queryClient.invalidateQueries({ queryKey: ['my_canteens_analytics'] });
      if (onSuccess) onSuccess(data);
      onClose();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Gagal menyimpan pengaturan toko. Periksa koneksi internet.';
      toast.error(msg);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canteen?.id) {
      toast.error('Data toko tidak valid.');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Nama toko wajib diisi.');
      return;
    }

    const payload = new FormData();
    payload.append('_method', 'PUT');
    payload.append('name', formData.name.trim());
    payload.append('category', formData.category || 'kauman');
    payload.append('description', formData.description || '');
    payload.append('is_open', formData.is_open ? '1' : '0');
    payload.append('open_time', formData.open_time);
    payload.append('close_time', formData.close_time);
    payload.append('delivery_fee', PRICING_CONFIG.BASE_DELIVERY_FEE);

    if (formData.closed_days && formData.closed_days.length > 0) {
      formData.closed_days.forEach((day) => payload.append('closed_days[]', day));
    } else {
      payload.append('closed_days', JSON.stringify([]));
    }

    if (formData.whatsapp_number) {
      let phone = formData.whatsapp_number.replace(/\D/g, '');
      if (phone.startsWith('0')) phone = '62' + phone.substring(1);
      payload.append('whatsapp_number', phone);
    } else {
      payload.append('whatsapp_number', '');
    }

    if (imageFile) {
      payload.append('image', imageFile);
    }

    updateStoreMutation.mutate(payload);
  };

  if (!isOpen || !canteen) return null;

  const quickHours = [
    { label: 'Standar Pondok', open: '06:00', close: '21:00' },
    { label: 'Pagi - Sore', open: '07:00', close: '17:00' },
    { label: 'Full Day', open: '06:00', close: '22:00' },
    { label: '24 Jam Penuh', open: '00:00', close: '23:59' },
  ];

  const daysList = [
    { id: 'senin', label: 'Sen' },
    { id: 'selasa', label: 'Sel' },
    { id: 'rabu', label: 'Rab' },
    { id: 'kamis', label: 'Kam' },
    { id: 'jumat', label: 'Jum' },
    { id: 'sabtu', label: 'Sab' },
    { id: 'minggu', label: 'Min' },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Header Ramping & Tegas */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-600 text-white flex items-center justify-center rounded-none shadow-2xs">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                Pengaturan Toko
              </h2>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-none">
                Kelola profil, jam operasional, dan status toko aktif
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-none transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body dengan Scroll Ramping */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 text-xs">
          {/* Banner / Foto Toko */}
          <div className="border border-gray-200 dark:border-gray-800 p-2.5 bg-gray-50/70 dark:bg-gray-800/40 rounded-none">
            <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              Foto / Logo Toko
            </label>
            <div className="flex items-center gap-3">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-none overflow-hidden shrink-0 flex items-center justify-center">
                {previewUrl ? (
                  <img src={previewUrl} alt="Store Preview" className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-7 h-7 text-gray-400" />
                )}
                <label
                  htmlFor="store-image-input"
                  className="absolute bottom-0 right-0 p-1 bg-green-600 hover:bg-green-700 text-white rounded-none cursor-pointer shadow-xs transition-colors"
                  title="Ganti Foto"
                >
                  <Camera className="w-3.5 h-3.5" />
                </label>
              </div>
              <div className="flex-1">
                <input
                  id="store-image-input"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('store-image-input')?.click()}
                  className="px-2.5 py-1 text-[11px] font-bold bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-none transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                >
                  <Camera className="w-3 h-3 text-green-600" />
                  <span>Pilih Foto Toko</span>
                </button>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-tight">
                  Format JPG, PNG, atau WebP. Maks 2MB. Tampil di katalog santri dan header toko.
                </p>
              </div>
            </div>
          </div>

          {/* Nama & Zona Toko Sebaris */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Nama Toko / Kantin <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Misal: BAKSO KUY Kauman"
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-none outline-none focus:border-green-600 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Zona Lokasi
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-2 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-none outline-none focus:border-green-600 transition-colors"
              >
                {CANTEEN_ZONES.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Deskripsi Toko */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
              Deskripsi Singkat Toko
            </label>
            <textarea
              rows="2"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Jelaskan menu unggulan atau spesialisasi kantin Anda..."
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-none outline-none focus:border-green-600 transition-colors resize-none"
            />
          </div>

          {/* Status Toko (Buka / Tutup Manual) */}
          <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-none">
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-[11px] font-bold text-gray-900 dark:text-white">
                  Status Operasional Saat Ini:
                </span>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Jika disetel Tutup, toko tidak dapat menerima pesanan baru santri.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, is_open: !prev.is_open }))}
                className={`px-3 py-1 text-xs font-black rounded-none border transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                  formData.is_open
                    ? 'bg-green-600 text-white border-green-700 hover:bg-green-700'
                    : 'bg-red-600 text-white border-red-700 hover:bg-red-700'
                }`}
              >
                {formData.is_open ? <CheckCircle2 className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                <span>{formData.is_open ? 'BUKA (Menerima Pesanan)' : 'TUTUP (Istirahat)'}</span>
              </button>
            </div>
          </div>

          {/* Jam Operasional */}
          <div className="border border-gray-200 dark:border-gray-800 p-2.5 rounded-none space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-green-600" />
                <span>Pilihan Cepat Jam Buka - Tutup (WIB):</span>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
              {quickHours.map((qh) => {
                const isActive = formData.open_time === qh.open && formData.close_time === qh.close;
                return (
                  <button
                    key={qh.label}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, open_time: qh.open, close_time: qh.close }))}
                    className={`px-1.5 py-1 text-[10px] font-bold rounded-none border transition-colors cursor-pointer text-center ${
                      isActive
                        ? 'bg-green-600 text-white border-green-700 shadow-2xs'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {qh.label} ({qh.open}-{qh.close})
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-400 mb-0.5">
                  Jam Buka (WIB)
                </label>
                <input
                  type="time"
                  required
                  value={formData.open_time}
                  onChange={(e) => setFormData({ ...formData, open_time: e.target.value })}
                  className="w-full px-2 py-1 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-none outline-none focus:border-green-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-400 mb-0.5">
                  Jam Tutup (WIB)
                </label>
                <input
                  type="time"
                  required
                  value={formData.close_time}
                  onChange={(e) => setFormData({ ...formData, close_time: e.target.value })}
                  className="w-full px-2 py-1 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-none outline-none focus:border-green-600 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Hari Libur Rutin */}
          <div className="border border-gray-200 dark:border-gray-800 p-2.5 rounded-none space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                Hari Libur Rutin (Tutup Otomatis):
              </label>
              <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                {formData.closed_days?.length > 0
                  ? `${formData.closed_days.length} hari libur`
                  : 'Buka setiap hari'}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
              Tap hari di bawah untuk menandai hari libur rutin toko:
            </p>
            <div className="grid grid-cols-7 gap-1">
              {daysList.map((day) => {
                const isSelected = formData.closed_days.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => handleToggleDay(day.id)}
                    className={`py-1.5 text-center text-[10px] font-black rounded-none border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-red-600 text-white border-red-700 shadow-2xs'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nomor WhatsApp Resmi Toko */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-green-600" />
              <span>Nomor WhatsApp Toko (Tujuan Chat Santri & Admin)</span>
            </label>
            <input
              type="tel"
              value={formData.whatsapp_number}
              onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
              placeholder="Contoh: 081234567890 atau 6281234567890"
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-none outline-none focus:border-green-600 font-mono"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">
              Nomor ini digunakan saat santri / admin menekan tombol WhatsApp Resmi Toko.
            </p>
          </div>
        </form>

        {/* Footer Tombol Aksi */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-800 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={updateStoreMutation.isPending}
            className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-none transition-colors cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={updateStoreMutation.isPending}
            className="flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-none transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            {updateStoreMutation.isPending ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{updateStoreMutation.isPending ? 'Menyimpan...' : 'Simpan Pengaturan Toko'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
