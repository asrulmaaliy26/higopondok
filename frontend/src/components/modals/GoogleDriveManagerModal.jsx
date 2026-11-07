import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  HardDrive,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Trash2,
  Edit3,
  FolderPlus,
  KeyRound,
  CloudUpload,
  Check,
  Loader2,
  Mail,
  FolderOpen,
  ShieldCheck,
  ArrowRightLeft,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/axios';
import LoadingSpinner from '../common/LoadingSpinner';

export default function GoogleDriveManagerModal({ isOpen, onClose }) {
  const queryClient = useQueryClient();

  const [mode, setMode] = useState('list'); // 'list' | 'form' | 'oauth_code'
  const [editingAccount, setEditingAccount] = useState(null);
  const [oauthTargetAccount, setOauthTargetAccount] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    folder_id: '',
    folder_name: 'Higo Pondok Storage',
    refresh_token: '',
    client_id: '',
    client_secret: '',
    is_active: true,
    auto_switch_when_full: true,
    notes: '',
  });

  const [oauthCodeData, setOauthCodeData] = useState({
    code: '',
    name: '',
    folder_id: '',
    set_active: true,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin_gdrive_accounts'],
    queryFn: async () => {
      const res = await api.get('/admin/gdrive-accounts');
      return res.data;
    },
    enabled: Boolean(isOpen),
  });

  const accounts = data?.accounts || [];
  const activeAccount = data?.active_account || accounts.find((a) => a.is_active) || accounts[0];
  const localPendingCount = data?.local_pending_count || 0;

  // Listen for postMessage from OAuth popup window
  useEffect(() => {
    if (!isOpen) return;
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'GDRIVE_OAUTH_RESULT') {
        if (event.data.success) {
          toast.success(event.data.message || 'Akun Google Drive berhasil ditautkan!');
          queryClient.invalidateQueries({ queryKey: ['admin_gdrive_accounts'] });
          setMode('list');
        } else {
          toast.error(event.data.message || 'Gagal menautkan akun Google Drive.');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, queryClient]);

  // 1. Mutasi Ganti Akun Aktif (Switch 1-Klik dengan Optimistic UI)
  const activateMutation = useMutation({
    mutationFn: async (accountId) => {
      const res = await api.post(`/admin/gdrive-accounts/${accountId}/activate`);
      return res.data;
    },
    onMutate: async (accountId) => {
      await queryClient.cancelQueries({ queryKey: ['admin_gdrive_accounts'] });
      const previous = queryClient.getQueryData(['admin_gdrive_accounts']);
      if (previous?.accounts) {
        const updatedAccounts = previous.accounts.map((acc) => ({
          ...acc,
          is_active: acc.id === accountId,
        }));
        const newActive = updatedAccounts.find((acc) => acc.id === accountId);
        queryClient.setQueryData(['admin_gdrive_accounts'], {
          ...previous,
          accounts: updatedAccounts,
          active_account: newActive || previous.active_account,
        });
      }
      return { previous };
    },
    onError: (err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['admin_gdrive_accounts'], context.previous);
      }
      toast.error(err.response?.data?.message || 'Gagal mengalihkan akun Google Drive.');
    },
    onSuccess: (res) => {
      toast.success(res.message || 'Penyimpanan Google Drive aktif berhasil diganti!');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_gdrive_accounts'] });
    },
  });

  // 2. Mutasi Cek Koneksi & Kuota
  const checkMutation = useMutation({
    mutationFn: async (accountId) => {
      const res = await api.post(`/admin/gdrive-accounts/${accountId}/check`);
      return res.data;
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
      queryClient.invalidateQueries({ queryKey: ['admin_gdrive_accounts'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal memeriksa koneksi Google Drive.');
    },
  });

  // 3. Mutasi Buat Struktur Folder Otomatis
  const createFolderMutation = useMutation({
    mutationFn: async (accountId) => {
      const res = await api.post(`/admin/gdrive-accounts/${accountId}/create-folder`);
      return res.data;
    },
    onSuccess: (res) => {
      toast.success(res.message || 'Folder standar berhasil dibuat di Google Drive!');
      queryClient.invalidateQueries({ queryKey: ['admin_gdrive_accounts'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal membuat folder di Google Drive.');
    },
  });

  // 4. Mutasi Simpan / Update Akun
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingAccount) {
        const res = await api.put(`/admin/gdrive-accounts/${editingAccount.id}`, payload);
        return res.data;
      } else {
        const res = await api.post('/admin/gdrive-accounts', payload);
        return res.data;
      }
    },
    onSuccess: (res) => {
      toast.success(res.message || 'Akun Google Drive berhasil disimpan!');
      queryClient.invalidateQueries({ queryKey: ['admin_gdrive_accounts'] });
      setMode('list');
      setEditingAccount(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal menyimpan akun Google Drive.');
    },
  });

  // 5. Mutasi Tukar Kode OAuth
  const exchangeOAuthMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/admin/gdrive-accounts/oauth-exchange', payload);
      return res.data;
    },
    onSuccess: (res) => {
      toast.success(res.message || 'Akun email Google Drive berhasil ditautkan!');
      queryClient.invalidateQueries({ queryKey: ['admin_gdrive_accounts'] });
      setMode('list');
      setOauthTargetAccount(null);
      setOauthCodeData({ code: '', name: '', folder_id: '', set_active: true });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal menukar kode OAuth Google.');
    },
  });

  // 6. Mutasi Sinkronkan Berkas Lokal ke Drive Aktif
  const syncPendingMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/admin/gdrive-accounts/sync-pending');
      return res.data;
    },
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ['admin_gdrive_accounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin_orders'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal mencadangkan berkas lokal ke Google Drive.');
    },
  });

  // 7. Mutasi Hapus Akun
  const deleteMutation = useMutation({
    mutationFn: async (accountId) => {
      const res = await api.delete(`/admin/gdrive-accounts/${accountId}`);
      return res.data;
    },
    onSuccess: (res) => {
      toast.success(res.message || 'Akun Google Drive berhasil dihapus.');
      queryClient.invalidateQueries({ queryKey: ['admin_gdrive_accounts'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal menghapus akun Google Drive.');
    },
  });

  // Buka Popup Login Google OAuth
  const handleStartPopupOAuth = async (targetAcc = null) => {
    try {
      const params = new URLSearchParams();
      if (targetAcc?.id) params.set('account_id', targetAcc.id);
      params.set('set_active', '1');

      const res = await api.get(`/admin/gdrive-accounts/oauth-url?${params.toString()}`);
      if (res.data?.auth_url) {
        const width = 560;
        const height = 680;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        window.open(
          res.data.auth_url,
          'GoogleDriveOAuthPopup',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memulai otorisasi Google OAuth.');
    }
  };

  // Buka Google OAuth Playground dengan Client ID yang sudah terisi
  const handleOpenOAuthCodeMode = (targetAcc = null) => {
    setOauthTargetAccount(targetAcc);
    setOauthCodeData({
      code: '',
      name: targetAcc?.name || '',
      folder_id: targetAcc?.folder_id || '',
      set_active: true,
    });
    setMode('oauth_code');
  };

  const handleOpenAddForm = () => {
    setEditingAccount(null);
    setFormData({
      name: `Drive Backup #${accounts.length + 1}`,
      email: '',
      folder_id: '',
      folder_name: 'Higo Pondok Storage',
      refresh_token: '',
      client_id: '',
      client_secret: '',
      is_active: true,
      auto_switch_when_full: true,
      notes: '',
    });
    setMode('form');
  };

  const handleOpenEditForm = (acc) => {
    setEditingAccount(acc);
    setFormData({
      name: acc.name || '',
      email: acc.email || '',
      folder_id: acc.folder_id || '',
      folder_name: acc.folder_name || 'Higo Pondok Storage',
      refresh_token: '',
      client_id: acc.client_id || '',
      client_secret: '',
      is_active: Boolean(acc.is_active),
      auto_switch_when_full: Boolean(acc.auto_switch_when_full),
      notes: acc.notes || '',
    });
    setMode('form');
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleOAuthCodeSubmit = (e) => {
    e.preventDefault();
    if (!oauthCodeData.code.trim()) {
      toast.error('Masukkan Authorization Code dari Google terlebih dahulu.');
      return;
    }
    exchangeOAuthMutation.mutate({
      code: oauthCodeData.code.trim(),
      redirect_uri: 'https://developers.google.com/oauthplayground',
      account_id: oauthTargetAccount?.id || null,
      name: oauthCodeData.name || undefined,
      folder_id: oauthCodeData.folder_id || undefined,
      set_active: oauthCodeData.set_active,
    });
  };

  if (!isOpen) return null;

  const getPlaygroundAuthUrl = () => {
    const clientId = oauthTargetAccount?.client_id || data?.default_client_id || '';
    const redirectUri = encodeURIComponent('https://developers.google.com/oauthplayground');
    const scope = encodeURIComponent('https://www.googleapis.com/auth/drive email profile');
    return `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&access_type=offline&prompt=consent%20select_account&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-none shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 bg-emerald-800 dark:bg-emerald-950 text-white border-b border-emerald-700 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-emerald-700 border border-emerald-500 rounded-none shrink-0">
              <HardDrive className="w-4 h-4 text-emerald-200" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider truncate">
                Manajemen Penyimpanan & Backup Google Drive
              </h3>
              <p className="text-[10px] sm:text-[11px] text-emerald-100/90 truncate">
                Kelola multi-akun email Google Drive & ganti penyimpanan aktif 1-klik saat kuota penuh
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Tutup Modal"
            className="p-1.5 bg-emerald-900/60 hover:bg-red-600 text-white border border-emerald-600 rounded-none transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* TOP ACTION & ACTIVE STATUS BAR */}
        <div className="px-3 py-2 sm:px-4 sm:py-2.5 bg-emerald-50/70 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase">
              Drive Aktif:
            </span>
            {activeAccount ? (
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-100 dark:bg-green-950/80 border border-green-400 dark:border-green-700 text-green-900 dark:text-green-200 text-xs font-black rounded-none">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                <span>{activeAccount.email || activeAccount.name}</span>
                <span className="font-mono text-[10px] px-1 bg-white/80 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-green-300 dark:border-green-800">
                  {activeAccount.storage_used_formatted} / {activeAccount.storage_limit_formatted}
                </span>
              </div>
            ) : (
              <span className="text-xs font-bold text-red-600">Belum ada akun aktif</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {mode !== 'list' ? (
              <button
                type="button"
                onClick={() => {
                  setMode('list');
                  setEditingAccount(null);
                  setOauthTargetAccount(null);
                }}
                className="px-2.5 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 text-xs font-bold rounded-none cursor-pointer"
              >
                ← Kembali ke Daftar Drive
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleStartPopupOAuth(null)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-700 hover:bg-green-800 text-white text-xs font-bold rounded-none border border-green-800 shadow-2xs cursor-pointer"
                  title="Login akun Google baru via Popup untuk langsung menautkan penyimpanan Drive"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>+ Tautkan Email Google (OAuth)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenOAuthCodeMode(null)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-bold rounded-none border border-amber-600 shadow-2xs cursor-pointer"
                  title="Tautkan email Google menggunakan Kode Otorisasi (Cocok untuk VPS / Localhost)"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>+ Tautkan via Kode Cepat</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddForm}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-none border border-gray-300 dark:border-gray-600 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-green-600" />
                  <span>Input Manual</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* BODY CONTENT */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-3">
          {isLoading ? (
            <LoadingSpinner
              text="Memuat Daftar Penyimpanan Google Drive..."
              subtext="Mengambil informasi akun email dan kapasitas kuota"
              minHeight="min-h-[220px]"
            />
          ) : mode === 'list' ? (
            <>
              {/* BAR CADANGAN BERKAS LOKAL JIKA ADA YANG TERTUNDA */}
              <div className="p-2.5 bg-slate-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-none flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start sm:items-center gap-2">
                  <CloudUpload className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                  <div className="text-xs">
                    <span className="font-bold text-gray-900 dark:text-white">
                      Status Sinkronisasi Berkas Bukti Lokal:{' '}
                    </span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {localPendingCount} Pesanan
                    </span>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Saat Anda mengganti akun Google Drive aktif, seluruh bukti pembayaran, struk belanja, dan laporan rekap baru otomatis langsung diarahkan ke akun Drive yang aktif.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => syncPendingMutation.mutate()}
                    disabled={syncPendingMutation.isPending}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-none cursor-pointer"
                  >
                    {syncPendingMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CloudUpload className="w-3.5 h-3.5" />
                    )}
                    <span>Cadangkan Lokal ke Drive Aktif</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="p-1.5 bg-white dark:bg-gray-800 hover:bg-gray-100 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-none cursor-pointer"
                    title="Muat Ulang Data"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* TABEL / DAFTAR AKUN GOOGLE DRIVE */}
              <div className="border border-gray-200 dark:border-gray-800 rounded-none overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800 text-[11px] font-black text-gray-600 dark:text-gray-300 uppercase border-b border-gray-200 dark:border-gray-700">
                      <th className="p-2.5">Status / Pilihan</th>
                      <th className="p-2.5">Akun Email & Label Drive</th>
                      <th className="p-2.5">Folder Tujuan</th>
                      <th className="p-2.5 text-right">Kapasitas (Kuota 15 GB)</th>
                      <th className="p-2.5 text-right">Aksi Pengelolaan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-xs">
                    {accounts.map((acc) => {
                      const isExpired = acc.status === 'expired' || acc.status === 'error';
                      const isFull = acc.status === 'full' || acc.usage_percent >= 95;
                      const isConnected = acc.status === 'connected';

                      return (
                        <tr
                          key={acc.id}
                          className={
                            acc.is_active
                              ? 'bg-green-50/60 dark:bg-green-950/25'
                              : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                          }
                        >
                          {/* KOLOM 1: STATUS AKTIF / TOMBOL SWITCH */}
                          <td className="p-2.5 align-top whitespace-nowrap">
                            {acc.is_active ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-700 text-white text-[11px] font-black uppercase tracking-wider rounded-none shadow-2xs">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                <span>SEDANG AKTIF</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => activateMutation.mutate(acc.id)}
                                disabled={activateMutation.isPending}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-green-600 hover:text-white dark:bg-gray-800 dark:hover:bg-green-600 text-green-700 dark:text-green-400 border border-green-600 text-[11px] font-black uppercase rounded-none transition-colors cursor-pointer disabled:opacity-50"
                                title={`Alihkan penyimpanan utama ke ${acc.email || acc.name}`}
                              >
                                {activateMutation.isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <ArrowRightLeft className="w-3 h-3" />
                                )}
                                <span>Pakai Drive Ini</span>
                              </button>
                            )}

                            <div className="mt-1.5">
                              {isConnected && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold rounded-none">
                                  <ShieldCheck className="w-3 h-3" /> Terhubung
                                </span>
                              )}
                              {isExpired && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[10px] font-bold rounded-none">
                                  <AlertTriangle className="w-3 h-3" /> Token Kedaluwarsa
                                </span>
                              )}
                              {acc.status === 'unknown' && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 text-[10px] font-bold rounded-none">
                                  Belum Dicek
                                </span>
                              )}
                            </div>
                          </td>

                          {/* KOLOM 2: NAMA & EMAIL */}
                          <td className="p-2.5 align-top">
                            <div className="font-black text-gray-900 dark:text-white text-xs sm:text-sm">
                              {acc.name}
                            </div>
                            <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-mono font-bold text-xs mt-0.5">
                              <Mail className="w-3 h-3 shrink-0" />
                              <span>{acc.email || 'Email belum terdeteksi'}</span>
                            </div>
                            {acc.status_message && isExpired && (
                              <div className="mt-1 p-1.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[10px] text-amber-800 dark:text-amber-300 max-w-xs">
                                <strong>Info:</strong> Token otorisasi perlu diperbarui. Klik tombol <strong>"Tautkan Ulang"</strong> di kanan untuk mengaktifkan kembali.
                              </div>
                            )}
                            {acc.notes && (
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                {acc.notes}
                              </p>
                            )}
                          </td>

                          {/* KOLOM 3: FOLDER TUJUAN */}
                          <td className="p-2.5 align-top">
                            <div className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                              <FolderOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="truncate max-w-[150px]">
                                {acc.folder_name || 'Higo Pondok Storage'}
                              </span>
                            </div>
                            {acc.folder_id ? (
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                <a
                                  href={acc.folder_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold rounded-none"
                                >
                                  <span>Buka Folder</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => createFolderMutation.mutate(acc.id)}
                                  disabled={createFolderMutation.isPending}
                                  title="Buat folder baru otomatis di akun Google Drive ini"
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 text-[10px] font-bold rounded-none cursor-pointer"
                                >
                                  <FolderPlus className="w-2.5 h-2.5" />
                                  <span>Buat Folder Baru</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => createFolderMutation.mutate(acc.id)}
                                disabled={createFolderMutation.isPending}
                                className="mt-1 inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-none cursor-pointer"
                              >
                                <FolderPlus className="w-3 h-3" />
                                <span>Buat Folder Otomatis</span>
                              </button>
                            )}
                          </td>

                          {/* KOLOM 4: KAPASITAS PENYIMPANAN */}
                          <td className="p-2.5 align-top text-right font-mono whitespace-nowrap">
                            <div className="font-bold text-gray-900 dark:text-white">
                              {acc.storage_used_formatted}{' '}
                              <span className="text-gray-400 font-normal">/</span>{' '}
                              {acc.storage_limit_formatted}
                            </div>
                            <div className="w-32 ml-auto h-2 bg-gray-200 dark:bg-gray-700 rounded-none overflow-hidden my-1 border border-gray-300 dark:border-gray-600">
                              <div
                                className={`h-full ${
                                  isFull
                                    ? 'bg-red-600'
                                    : acc.usage_percent >= 80
                                    ? 'bg-amber-500'
                                    : 'bg-green-600'
                                }`}
                                style={{ width: `${Math.max(2, acc.usage_percent || 0)}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400">
                              Terpakai {acc.usage_percent}% • Sisa {acc.storage_free_formatted}
                            </div>
                          </td>

                          {/* KOLOM 5: TOMBOL AKSI */}
                          <td className="p-2.5 align-top text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1 flex-wrap">
                              <button
                                type="button"
                                onClick={() => checkMutation.mutate(acc.id)}
                                disabled={checkMutation.isPending}
                                title="Cek Koneksi & Perbarui Kuota GB"
                                className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 text-[11px] font-bold rounded-none cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw
                                  className={`w-3 h-3 text-emerald-600 ${
                                    checkMutation.isPending && checkMutation.variables === acc.id
                                      ? 'animate-spin'
                                      : ''
                                  }`}
                                />
                                <span>Cek Kuota</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenOAuthCodeMode(acc)}
                                title="Tautkan Ulang / Ganti Email Google untuk slot ini"
                                className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500 hover:bg-amber-600 text-amber-950 border border-amber-600 text-[11px] font-bold rounded-none cursor-pointer"
                              >
                                <KeyRound className="w-3 h-3" />
                                <span>Tautkan Ulang</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEditForm(acc)}
                                title="Edit Nama / Folder ID / Token"
                                className="p-1 bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-none cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {accounts.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Hapus akun penyimpanan "${acc.name}" (${acc.email}) dari daftar?`
                                      )
                                    ) {
                                      deleteMutation.mutate(acc.id);
                                    }
                                  }}
                                  disabled={deleteMutation.isPending}
                                  title="Hapus Akun Drive"
                                  className="p-1 bg-red-50 hover:bg-red-600 hover:text-white dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800 rounded-none cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : mode === 'oauth_code' ? (
            /* MODE TAUTKAN EMAIL VIA KODE OTORISASI CEPAT */
            <form onSubmit={handleOAuthCodeSubmit} className="space-y-3 border border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-gray-800/60 p-3 sm:p-4 rounded-none">
              <div className="flex items-start gap-2 border-b border-amber-200 dark:border-gray-700 pb-2.5">
                <KeyRound className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white uppercase">
                    {oauthTargetAccount
                      ? `Tautkan Ulang / Perbarui Token: ${oauthTargetAccount.name}`
                      : 'Tautkan Akun Email Google Drive Baru (2 Klik)'}
                  </h4>
                  <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5">
                    Cara paling stabil untuk menautkan email Google baru atau memperbarui token yang kedaluwarsa tanpa terkendala blokir domain:
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 space-y-2 text-xs">
                <div className="font-bold text-gray-900 dark:text-white">
                  Langkah 1: Buka halaman izin Google & pilih email yang ingin dijadikan penyimpanan Drive
                </div>
                <p className="text-[11px] text-gray-600 dark:text-gray-400">
                  Klik tombol hijau di bawah ini. Pilih akun Gmail Anda, klik <strong>Lanjutkan / Allow</strong>, lalu salin <strong>Authorization Code</strong> (kode yang diawali <code>4/0A...</code>) yang muncul di layar kiri OAuth Playground.
                </p>
                <div>
                  <a
                    href={getPlaygroundAuthUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-700 hover:bg-green-800 text-white text-xs font-black rounded-none shadow-xs"
                  >
                    <span>1. Buka Login Google & Ambil Kode Otorisasi</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-black uppercase text-gray-700 dark:text-gray-300 mb-1">
                    Langkah 2: Tempel Authorization Code dari Google *
                  </label>
                  <input
                    type="text"
                    required
                    value={oauthCodeData.code}
                    onChange={(e) => setOauthCodeData({ ...oauthCodeData, code: e.target.value })}
                    placeholder="Contoh: 4/0AeaYSHB..."
                    className="w-full px-2.5 py-2 text-xs font-mono bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-none focus:outline-none focus:border-green-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    Nama Label Penyimpanan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={oauthCodeData.name}
                    onChange={(e) => setOauthCodeData({ ...oauthCodeData, name: e.target.value })}
                    placeholder="Misal: Drive Backup 2 (Email Pondok)"
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    Link / ID Folder Google Drive (Kosongkan = Buat Otomatis)
                  </label>
                  <input
                    type="text"
                    value={oauthCodeData.folder_id}
                    onChange={(e) =>
                      setOauthCodeData({ ...oauthCodeData, folder_id: e.target.value })
                    }
                    placeholder="Kosongkan agar folder dibuat otomatis"
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={oauthCodeData.set_active}
                  onChange={(e) =>
                    setOauthCodeData({ ...oauthCodeData, set_active: e.target.checked })
                  }
                  className="rounded-none text-green-600 focus:ring-0"
                />
                <span>Langsung jadikan email ini sebagai Penyimpanan Google Drive Aktif</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-none cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={exchangeOAuthMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-xs font-black uppercase rounded-none cursor-pointer"
                >
                  {exchangeOAuthMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Simpan & Hubungkan Email Drive</span>
                </button>
              </div>
            </form>
          ) : (
            /* MODE FORM TAMBAH / EDIT MANUAL */
            <form onSubmit={handleFormSubmit} className="space-y-3 border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40 p-3 sm:p-4 rounded-none">
              <h4 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white uppercase border-b border-gray-200 dark:border-gray-700 pb-2">
                {editingAccount
                  ? `Edit Konfigurasi Google Drive: ${editingAccount.name}`
                  : 'Tambah Akun Google Drive Baru'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    Nama Label Penyimpanan *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: Drive Backup 2 (Akun Cadangan)"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    Email Akun Google (Otomatis Terdeteksi saat Konek)
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contoh@gmail.com"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    Link Folder atau Folder ID Google Drive
                  </label>
                  <input
                    type="text"
                    value={formData.folder_id}
                    onChange={(e) => setFormData({ ...formData, folder_id: e.target.value })}
                    placeholder="Tempel link https://drive.google.com/drive/folders/... atau ID"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    Nama Folder
                  </label>
                  <input
                    type="text"
                    value={formData.folder_name}
                    onChange={(e) => setFormData({ ...formData, folder_name: e.target.value })}
                    placeholder="Higo Pondok Storage"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    OAuth Refresh Token {editingAccount ? '(Kosongkan jika tidak ingin mengubah)' : ''}
                  </label>
                  <input
                    type="text"
                    value={formData.refresh_token}
                    onChange={(e) => setFormData({ ...formData, refresh_token: e.target.value })}
                    placeholder="1//0g..."
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-none font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    Catatan Tambahan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Catatan penggunaan akun penyimpanan ini..."
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-none"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded-none text-green-600"
                  />
                  <span>Jadikan sebagai Penyimpanan Google Drive Aktif</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.auto_switch_when_full}
                    onChange={(e) =>
                      setFormData({ ...formData, auto_switch_when_full: e.target.checked })
                    }
                    className="rounded-none text-green-600"
                  />
                  <span>Otomatis alihkan ke Drive cadangan lain jika kuota 15 GB penuh</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setMode('list');
                    setEditingAccount(null);
                  }}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-none cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-xs font-black uppercase rounded-none cursor-pointer"
                >
                  {saveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Simpan Konfigurasi Drive</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-3 py-2 sm:px-4 sm:py-2.5 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2 shrink-0 text-[11px] text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1.5 truncate">
            <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">
              Seluruh file bukti lama dari akun Drive sebelumnya tetap dapat dilihat meskipun Anda berganti akun Drive aktif.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-bold rounded-none cursor-pointer shrink-0"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

