/**
 * Utility functions for parsing and categorizing audit activity logs
 */

export const parseActivityTags = (description = '') => {
  if (!description) return [];
  const lower = description.toLowerCase();
  const tags = [];

  if (lower.includes('harga') || lower.includes('modal') || lower.includes('hpp') || lower.includes('ongkir') || lower.includes('biaya')) {
    tags.push({ key: 'price', label: 'Perubahan Harga', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' });
  }
  if (lower.includes('kategori')) {
    tags.push({ key: 'category', label: 'Kategori', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' });
  }
  if (lower.includes('foto') || lower.includes('gambar') || lower.includes('upload') || lower.includes('unggah')) {
    tags.push({ key: 'image', label: 'Upload Foto', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800' });
  }
  if (lower.includes('stok')) {
    tags.push({ key: 'stock', label: 'Stok Menu', color: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' });
  }
  if (lower.includes('status') || lower.includes('buka') || lower.includes('tutup') || lower.includes('ketersediaan')) {
    tags.push({ key: 'status', label: 'Status / Jam', color: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800' });
  }
  if (lower.includes('varian')) {
    tags.push({ key: 'variant', label: 'Opsi Varian', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800' });
  }
  if (lower.includes('batal') || lower.includes('cancel')) {
    tags.push({ key: 'cancel', label: 'Pembatalan Pesanan', color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800' });
  }
  if (lower.includes('kurir')) {
    tags.push({ key: 'courier', label: 'Tugas / Pindah Kurir', color: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800' });
  }

  return tags;
};

export const getActionBadge = (action) => {
  switch (action?.toLowerCase()) {
    case 'created':
      return {
        label: 'TAMBAH',
        classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
      };
    case 'updated':
      return {
        label: 'EDIT / UBAH',
        classes: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800'
      };
    case 'deleted':
      return {
        label: 'HAPUS',
        classes: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-300 dark:border-red-800'
      };
    case 'cancelled':
    case 'cancel_order':
      return {
        label: 'DIBATALKAN',
        classes: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200 border-red-400 dark:border-red-700'
      };
    case 'impersonate':
      return {
        label: 'IMPERSONASI',
        classes: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300 dark:border-purple-800'
      };
    default:
      return {
        label: action?.toUpperCase() || 'LOG',
        classes: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700'
      };
  }
};

export const getModelBadge = (modelType) => {
  switch (modelType?.toLowerCase()) {
    case 'product':
      return {
        label: 'MENU',
        type: 'product',
        classes: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800'
      };
    case 'canteen':
      return {
        label: 'TOKO/KANTIN',
        type: 'canteen',
        classes: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-800'
      };
    case 'order':
      return {
        label: 'PESANAN',
        type: 'order',
        classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
      };
    case 'user':
      return {
        label: 'PENGGUNA',
        type: 'user',
        classes: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
      };
    default:
      return {
        label: modelType?.toUpperCase() || 'DATA',
        type: 'general',
        classes: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700'
      };
  }
};

export const getRoleBadge = (roles) => {
  const roleName = roles?.[0]?.name?.toLowerCase() || '';
  switch (roleName) {
    case 'super_admin':
      return { label: 'Super Admin', classes: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200' };
    case 'admin':
      return { label: 'Admin', classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200' };
    case 'kantin':
      return { label: 'Mitra Kantin', classes: 'bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200' };
    case 'kurir':
      return { label: 'Kurir', classes: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-200' };
    case 'user':
      return { label: 'Santri / User', classes: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
    default:
      return null;
  }
};
