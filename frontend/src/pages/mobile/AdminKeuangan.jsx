import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import {
  Wallet,
  ChevronLeft,
  Plus,
  Search,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Store,
  Bike,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Edit3,
  Trash2,
  X,
  Upload,
  Eye,
  Filter,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  Layers,
  Tag,
  User,
  FileText
} from 'lucide-react';
import api from '../../lib/axios';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AppImage from '../../components/common/AppImage';

const formatRp = (num) => {
  const val = Math.round(Number(num) || 0);
  const abs = Math.abs(val).toLocaleString('id-ID');
  return val < 0 ? `-Rp ${abs}` : `Rp ${abs}`;
};

const getTodayStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function AdminKeuangan() {
  const queryClient = useQueryClient();

  // Filter States
  const [period, setPeriod] = useState('month'); // 'day' | 'week' | 'month' | 'year' | 'all' | 'custom'
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [selectedCanteen, setSelectedCanteen] = useState('all');
  const [selectedCourier, setSelectedCourier] = useState('all');
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('daily'); // 'daily' | 'rekap_laba_admin_ongkir' | 'expenses'
  const [expandedDates, setExpandedDates] = useState({});
  const [expandAllDays, setExpandAllDays] = useState(false);

  const toggleExpandDate = (dateStr) => {
    setExpandedDates((prev) => ({
      ...prev,
      [dateStr]: !prev[dateStr],
    }));
  };

  // Modal Tambah/Edit Pengeluaran States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formDate, setFormDate] = useState(getTodayStr());
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('operasional');
  const [formAmount, setFormAmount] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState('cash');
  const [formRecipient, setFormRecipient] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formProofFile, setFormProofFile] = useState(null);
  const [formRemoveProof, setFormRemoveProof] = useState(false);

  // Modal Hapus & Preview Bukti
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [previewProofExpense, setPreviewProofExpense] = useState(null);

  // Query Daftar Toko & Kurir untuk Filter Dropdown
  const { data: canteensList = [] } = useQuery({
    queryKey: ['admin_canteens_list'],
    queryFn: async () => {
      const res = await api.get('/admin/canteens');
      return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    },
  });

  const { data: couriersList = [] } = useQuery({
    queryKey: ['admin_couriers_list'],
    queryFn: async () => {
      const res = await api.get('/admin/couriers-list');
      return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    },
  });

  // Parameter Query Keuangan
  const queryParams = useMemo(() => {
    const params = {
      period: period === 'custom' ? 'day' : period,
      canteen_id: selectedCanteen,
      courier_id: selectedCourier,
      expense_category: selectedExpenseCategory,
      search: searchQuery.trim() || undefined,
    };
    if (period === 'day') {
      params.start_date = startDate;
      params.end_date = startDate;
    } else if (period === 'custom' || period === 'all') {
      if (startDate && endDate) {
        params.start_date = startDate;
        params.end_date = endDate;
      }
    }
    return params;
  }, [period, startDate, endDate, selectedCanteen, selectedCourier, selectedExpenseCategory, searchQuery]);

  const {
    data: financeData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['admin_finance_summary', queryParams],
    queryFn: async () => {
      const res = await api.get('/admin/finance/summary', { params: queryParams });
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  const summary = financeData?.financial_summary || {};
  const expenses = financeData?.expenses || [];
  const dateBounds = financeData?.date_bounds || {};
  const earliestAvailableDate = dateBounds.earliest_date || '2026-08-31';
  const latestAvailableDate = dateBounds.latest_date || getTodayStr();
  const categoriesMap = financeData?.expense_categories || {
    operasional: 'Operasional Harian',
    server_it: 'Server, Hosting & Domain',
    insentif_kurir: 'Bonus / Insentif Kurir & Tim',
    perlengkapan: 'Kertas Struk, Plastik & ATK',
    promosi_marketing: 'Promosi, Banner & Subsidi',
    sosial_pondok: 'Kontribusi / Kas Pondok',
    lainnya: 'Pengeluaran Lain-lain',
  };
  const categoryBreakdown = financeData?.expense_category_breakdown || [];
  const canteenRecap = financeData?.canteen_recap || [];
  const courierRecap = financeData?.courier_recap || [];
  const dailyRecap = financeData?.daily_recap || [];

  const courier1Total = useMemo(() => {
    return courierRecap.find((c) => c.courier_id === 12 || c.courier_name?.toLowerCase().includes('faris'));
  }, [courierRecap]);

  const courier2Total = useMemo(() => {
    return courierRecap.find((c) => c.courier_id === 794 || c.courier_name?.toLowerCase().includes('feri'));
  }, [courierRecap]);

  // Buka Modal Tambah / Edit
  const handleOpenAddModal = () => {
    setEditingExpense(null);
    setFormDate(getTodayStr());
    setFormTitle('');
    setFormCategory('operasional');
    setFormAmount('');
    setFormPaymentMethod('cash');
    setFormRecipient('');
    setFormNotes('');
    setFormProofFile(null);
    setFormRemoveProof(false);
    setIsFormOpen(true);
  };

  const handleOpenEditModal = (exp) => {
    setEditingExpense(exp);
    setFormDate(exp.expense_date || getTodayStr());
    setFormTitle(exp.title || '');
    setFormCategory(exp.category || 'operasional');
    setFormAmount(String(Math.round(exp.amount || 0)));
    setFormPaymentMethod(exp.payment_method || 'cash');
    setFormRecipient(exp.recipient || '');
    setFormNotes(exp.notes || '');
    setFormProofFile(null);
    setFormRemoveProof(false);
    setIsFormOpen(true);
  };

  // Mutation Simpan / Update Pengeluaran
  const saveExpenseMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('expense_date', formDate);
      fd.append('title', formTitle.trim());
      fd.append('category', formCategory);
      fd.append('amount', String(Number(String(formAmount).replace(/[^0-9]/g, '')) || 0));
      fd.append('payment_method', formPaymentMethod);
      fd.append('recipient', formRecipient.trim());
      fd.append('notes', formNotes.trim());
      if (formProofFile) {
        fd.append('proof_image', formProofFile);
      }
      if (editingExpense && formRemoveProof) {
        fd.append('remove_proof', '1');
      }

      if (editingExpense) {
        const res = await api.post(`/admin/finance/expenses/${editingExpense.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data;
      } else {
        const res = await api.post('/admin/finance/expenses', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data;
      }
    },
    onSuccess: (res) => {
      toast.success(res.message || 'Data pengeluaran berhasil disimpan!');
      setIsFormOpen(false);
      setEditingExpense(null);
      queryClient.invalidateQueries({ queryKey: ['admin_finance_summary'] });
      queryClient.invalidateQueries({ queryKey: ['admin_activity_logs'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Gagal menyimpan pengeluaran kas.');
    },
  });

  // Mutation Hapus Pengeluaran (dengan Optimistic Update sesuai aturan proyek)
  const deleteExpenseMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/admin/finance/expenses/${id}`);
      return res.data;
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ['admin_finance_summary', queryParams] });
      const previousData = queryClient.getQueryData(['admin_finance_summary', queryParams]);
      if (previousData && Array.isArray(previousData.expenses)) {
        const removedItem = previousData.expenses.find((item) => item.id === deletedId);
        const removedAmount = removedItem ? Number(removedItem.amount || 0) : 0;
        queryClient.setQueryData(['admin_finance_summary', queryParams], {
          ...previousData,
          expenses: previousData.expenses.filter((item) => item.id !== deletedId),
          financial_summary: {
            ...previousData.financial_summary,
            total_expenses: Math.max(0, (previousData.financial_summary?.total_expenses || 0) - removedAmount),
            net_higo_cash_balance: (previousData.financial_summary?.net_higo_cash_balance || 0) + removedAmount,
          },
        });
      }
      return { previousData };
    },
    onError: (err, _deletedId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['admin_finance_summary', queryParams], context.previousData);
      }
      toast.error(err.response?.data?.message || 'Gagal menghapus pengeluaran kas.');
    },
    onSuccess: (res) => {
      toast.success(res.message || 'Catatan pengeluaran dihapus.');
      setExpenseToDelete(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_finance_summary'] });
      queryClient.invalidateQueries({ queryKey: ['admin_activity_logs'] });
    },
  });

  const handleSubmitExpense = (e) => {
    e.preventDefault();
    const numericAmount = Number(String(formAmount).replace(/[^0-9]/g, '')) || 0;
    if (!formTitle.trim()) {
      toast.error('Nama / judul keperluan pengeluaran wajib diisi.');
      return;
    }
    if (numericAmount <= 0) {
      toast.error('Nominal pengeluaran harus lebih dari Rp 0.');
      return;
    }
    saveExpenseMutation.mutate();
  };

  // Export CSV Lokal (Laba, Biaya Admin, Ongkir, & Pengeluaran Kas)
  const handleDownloadCsv = () => {
    const lines = [
      ['LAPORAN KEUANGAN & PENGELUARAN KAS HIGO PONDOK'],
      ['Periode Filter', period.toUpperCase(), startDate, endDate],
      [],
      ['--- RINGKASAN KEUANGAN PERIODE INI ---'],
      ['Komponen Keuangan', 'Nominal (Rp)'],
      ['Total Pesanan Dihitung', summary.total_orders || 0],
      ['Total Omzet Produk (HPJ Toko)', summary.total_products_omzet || 0],
      ['Total Modal Pokok (HPP Toko)', summary.total_hpp || 0],
      ['Total Laba Toko (Hak Mitra Kantin)', summary.total_canteen_profit || 0],
      ['Total Ongkir Kotor', summary.gross_delivery_fee || 0],
      ['Total Ongkir Bersih Diterima Kurir', summary.courier_net_delivery_fee || 0],
      ['Pindahan Ongkir Kurir Masuk Kas Admin', summary.courier_cut_to_admin || 0],
      ['Biaya Admin Pokok Murni', summary.base_admin_fee || 0],
      ['Total Kas Admin Kotor (Pokok + Pindahan Ongkir)', summary.gross_admin_income || 0],
      ['Subsidi Voucher Ditanggung Admin', -(summary.voucher_subsidy || 0)],
      ['Pendapatan Kas Admin Bersih (Laba Kotor Higo)', summary.net_admin_income || 0],
      ['Total Pengeluaran Kas Higo (Operasional & Lainnya)', -(summary.total_expenses || 0)],
      ['SALDO / LABA BERSIH KAS HIGO PERIODE INI', summary.net_higo_cash_balance || 0],
      [],
      ['--- DAFTAR PENGELUARAN KAS HIGO ---'],
      ['Tanggal', 'Keperluan / Judul Pengeluaran', 'Kategori', 'Penerima / Toko', 'Metode', 'Nominal (Rp)', 'Catatan', 'Dicatat Oleh'],
      ...expenses.map((ex) => [
        ex.expense_date,
        ex.title,
        ex.category_label || ex.category,
        ex.recipient || '-',
        (ex.payment_method || 'cash').toUpperCase(),
        ex.amount,
        ex.notes || '-',
        ex.admin_name || 'Admin',
      ]),
    ];

    const csvString =
      '\uFEFF' +
      lines
        .map((row) =>
          row
            .map((cell) => {
              const str = String(cell ?? '').replace(/"/g, '""');
              return `"${str}"`;
            })
            .join(',')
        )
        .join('\n');

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keuangan_kas_higo_${period}_${getTodayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Laporan CSV Keuangan & Pengeluaran Kas berhasil diunduh!');
  };

  const handleSelectPeriod = (pId) => {
    setPeriod(pId);
    if (pId === 'all') {
      // Otomatis rentang penuh dari data paling awal hingga hari ini
      setStartDate(earliestAvailableDate);
      setEndDate(latestAvailableDate);
    } else if (pId === 'day') {
      setStartDate(getTodayStr());
      setEndDate(getTodayStr());
    } else if (pId === 'custom') {
      if (!startDate) setStartDate(earliestAvailableDate);
      if (!endDate) setEndDate(latestAvailableDate);
    }
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'day':
        return `Harian (${startDate})`;
      case 'week':
        return 'Minggu Ini';
      case 'month':
        return 'Bulan Ini';
      case 'year':
        return 'Tahun Ini';
      case 'custom':
        return `${startDate} s/d ${endDate}`;
      case 'all':
        return `Sepanjang Waktu (${startDate || earliestAvailableDate} s/d ${endDate || latestAvailableDate})`;
      default:
        return 'Bulan Ini';
    }
  };

  return (
    <div className="pb-24 bg-gray-50 dark:bg-gray-950 min-h-screen">
      {/* HEADER STICKY FLAT SHARP */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-3 sm:px-6 py-2.5 sticky top-0 z-30 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Link
              to="/dashboard"
              className="p-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-none text-gray-700 dark:text-gray-200 transition-colors cursor-pointer border border-gray-200 dark:border-gray-700"
              title="Kembali ke Dashboard"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-sm sm:text-base font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span>Keuangan &amp; Pengeluaran Kas Higo</span>
              </h1>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                Rekapitulasi Laba Toko, Biaya Admin, Ongkir Kurir, serta buku kas pengeluaran operasional Higo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 text-xs font-bold rounded-none cursor-pointer transition-colors"
              title="Segarkan Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-green-600' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 text-xs font-bold rounded-none cursor-pointer transition-colors"
              title="Unduh Laporan Excel / CSV"
            >
              <Download className="w-3.5 h-3.5 text-green-600" />
              <span>Unduh CSV</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white border border-green-700 text-xs font-black rounded-none shadow-2xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Catat Pengeluaran Higo</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-2.5 sm:p-4 max-w-6xl mx-auto space-y-3">
        {/* 1. BAR FILTER TERPADU (Periode Waktu, Toko, Kurir) */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2.5 rounded-none shadow-2xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:pb-0">
              <span className="text-[10px] font-bold uppercase text-gray-400 flex items-center gap-1 mr-1">
                <Calendar className="w-3 h-3" />
                <span>Periode:</span>
              </span>
              {[
                { id: 'day', label: 'Hari Ini / Tanggal' },
                { id: 'week', label: 'Minggu Ini' },
                { id: 'month', label: 'Bulan Ini' },
                { id: 'year', label: 'Tahun Ini' },
                { id: 'custom', label: 'Rentang Tanggal' },
                { id: 'all', label: 'Sepanjang Waktu (Semua)' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPeriod(p.id)}
                  className={`px-2 py-1 text-[10.5px] font-bold rounded-none border transition-colors cursor-pointer whitespace-nowrap ${
                    period === p.id
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Input Rentang Tanggal interaktif (untuk mode 'custom', 'all', atau 'day') */}
            {(period === 'custom' || period === 'all') && (
              <div className="flex items-center gap-1.5 flex-wrap bg-gray-50 dark:bg-gray-800/80 p-1.5 border border-gray-200 dark:border-gray-700">
                <span className="text-[10.5px] text-gray-600 dark:text-gray-300 font-bold flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-green-600" />
                  <span>Rentang:</span>
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (period === 'all') setPeriod('custom');
                  }}
                  className="px-2 py-1 text-xs font-mono font-bold bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-none focus:outline-none focus:border-green-600"
                />
                <span className="text-xs font-bold text-gray-400">s/d</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    if (period === 'all') setPeriod('custom');
                  }}
                  className="px-2 py-1 text-xs font-mono font-bold bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-none focus:outline-none focus:border-green-600"
                />
                {period === 'custom' && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate(earliestAvailableDate);
                      setEndDate(latestAvailableDate);
                      setPeriod('all');
                    }}
                    className="text-[10px] font-bold text-green-600 dark:text-green-400 hover:underline px-1 cursor-pointer"
                    title="Pilih seluruh rentang dari data paling awal hingga hari ini"
                  >
                    Set Awal-Akhir
                  </button>
                )}
              </div>
            )}

            {period === 'day' && (
              <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/80 p-1.5 border border-gray-200 dark:border-gray-700">
                <span className="text-[10.5px] text-gray-600 dark:text-gray-300 font-bold flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-green-600" />
                  <span>Pilih Tanggal:</span>
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setEndDate(e.target.value);
                  }}
                  className="px-2 py-1 text-xs font-mono font-bold bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-none focus:outline-none focus:border-green-600"
                />
              </div>
            )}
          </div>

          {/* Baris Filter Kedua: Filter Toko, Filter Kurir, & Info Saldo Buku Besar All-Time */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-green-600" />
                <span className="text-[10px] font-bold text-gray-500 uppercase">Toko:</span>
                <select
                  value={selectedCanteen}
                  onChange={(e) => setSelectedCanteen(e.target.value)}
                  className="px-2 py-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-none cursor-pointer focus:outline-none"
                >
                  <option value="all">Semua Toko ({canteensList.length})</option>
                  {canteensList.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <Bike className="w-3.5 h-3.5 text-green-600" />
                <span className="text-[10px] font-bold text-gray-500 uppercase">Kurir:</span>
                <select
                  value={selectedCourier}
                  onChange={(e) => setSelectedCourier(e.target.value)}
                  className="px-2 py-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-none cursor-pointer focus:outline-none"
                >
                  <option value="all">Semua Kurir</option>
                  <option value="none">Tanpa Kurir (Ambil Sendiri)</option>
                  {couriersList.map((cr) => (
                    <option key={cr.id} value={String(cr.id)}>
                      {cr.name}
                    </option>
                  ))}
                </select>
              </div>

              {(selectedCanteen !== 'all' || selectedCourier !== 'all' || period !== 'month') && (
                <button
                  type="button"
                  onClick={() => {
                    setPeriod('month');
                    setSelectedCanteen('all');
                    setSelectedCourier('all');
                    setSelectedExpenseCategory('all');
                    setSearchQuery('');
                  }}
                  className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer px-1"
                >
                  Reset Filter
                </button>
              )}
            </div>

            {/* Ringkasan Saldo Kas Higo Sepanjang Waktu */}
            <div className="flex items-center gap-2 text-[11px] font-mono bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 border border-emerald-200 dark:border-emerald-800 rounded-none">
              <span className="text-gray-600 dark:text-gray-300 font-sans font-bold">Total Saldo Kas Higo (All-Time):</span>
              <span className={`font-black ${Number(summary.all_time_cash_balance || 0) >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatRp(summary.all_time_cash_balance || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* 2. KARTU UTAMA REKAPITULASI: LABA TOKO, BIAYA ADMIN, ONGKIR, PENGELUARAN HIGO, & SALDO BERSIH */}
        {isLoading ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-none">
            <LoadingSpinner text="Memuat Rekapitulasi Keuangan & Kas Higo..." minHeight="min-h-[120px]" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {/* Card 1: Rekap Laba Toko & Omzet Produk */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2.5 rounded-none shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      1. Rekap Laba Toko
                    </span>
                    <Store className="w-3.5 h-3.5 text-green-600" />
                  </div>
                  <div className="text-base sm:text-lg font-black font-mono text-gray-900 dark:text-white mt-1">
                    {formatRp(summary.total_canteen_profit)}
                  </div>
                </div>
                <div className="mt-2 pt-1.5 border-t border-gray-100 dark:border-gray-800 text-[10px] space-y-0.5 font-mono text-gray-500 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Omzet (HPJ):</span>
                    <span className="font-bold text-gray-700 dark:text-gray-300">{formatRp(summary.total_products_omzet)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Modal (HPP):</span>
                    <span>{formatRp(summary.total_hpp)}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Rekap Biaya Admin (Pendapatan Kas Higo) */}
              <div className="bg-white dark:bg-gray-900 border border-green-300 dark:border-green-800 p-2.5 rounded-none shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-green-700 dark:text-green-400">
                      2. Biaya Admin (Kas Masuk)
                    </span>
                    <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                  </div>
                  <div className="text-base sm:text-lg font-black font-mono text-green-700 dark:text-green-400 mt-1">
                    {formatRp(summary.net_admin_income)}
                  </div>
                </div>
                <div className="mt-2 pt-1.5 border-t border-gray-100 dark:border-gray-800 text-[10px] space-y-0.5 font-mono text-gray-500 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Admin Pokok:</span>
                    <span className="font-bold text-gray-700 dark:text-gray-300">{formatRp(summary.base_admin_fee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>+ Pindahan Ongkir:</span>
                    <span className="text-green-600 dark:text-green-400 font-bold">+{formatRp(summary.courier_cut_to_admin)}</span>
                  </div>
                  {(summary.voucher_subsidy || 0) > 0 && (
                    <div className="flex justify-between text-red-600 dark:text-red-400">
                      <span>- Subsidi Voucher:</span>
                      <span>-{formatRp(summary.voucher_subsidy)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 3: Rekap Ongkir Kurir */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2.5 rounded-none shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      3. Rekap Ongkir Kurir
                    </span>
                    <Bike className="w-3.5 h-3.5 text-green-600" />
                  </div>
                  <div className="text-base sm:text-lg font-black font-mono text-gray-900 dark:text-white mt-1">
                    {formatRp(summary.courier_net_delivery_fee)}
                  </div>
                </div>
                <div className="mt-2 pt-1.5 border-t border-gray-100 dark:border-gray-800 text-[10px] space-y-0.5 font-mono text-gray-500 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Ongkir Kotor:</span>
                    <span className="font-bold text-gray-700 dark:text-gray-300">{formatRp(summary.gross_delivery_fee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dialihkan ke Admin:</span>
                    <span className="text-amber-600 dark:text-amber-400">-{formatRp(summary.courier_cut_to_admin)}</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Total Pengeluaran Kas Higo */}
              <div className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/60 p-2.5 rounded-none shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                      4. Pengeluaran Kas Higo
                    </span>
                    <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                  </div>
                  <div className="text-base sm:text-lg font-black font-mono text-red-600 dark:text-red-400 mt-1">
                    {formatRp(summary.total_expenses)}
                  </div>
                </div>
                <div className="mt-2 pt-1.5 border-t border-gray-100 dark:border-gray-800 text-[10px] space-y-0.5 font-mono text-gray-500 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Jumlah Catatan:</span>
                    <span className="font-bold text-gray-700 dark:text-gray-300">{summary.expenses_count || 0} transaksi</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Periode:</span>
                    <span className="truncate max-w-[110px]">{getPeriodLabel()}</span>
                  </div>
                </div>
              </div>

              {/* Card 5: Laba / Sisa Kas Bersih Higo (Biaya Admin Bersih - Pengeluaran Higo) */}
              <div className="bg-gradient-to-br from-emerald-900 via-green-800 to-teal-900 text-white border border-green-700 p-2.5 rounded-none shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-green-200">
                      5. Sisa Kas Bersih Higo
                    </span>
                    <Wallet className="w-3.5 h-3.5 text-amber-300" />
                  </div>
                  <div className={`text-base sm:text-lg font-black font-mono mt-1 ${Number(summary.net_higo_cash_balance || 0) >= 0 ? 'text-white' : 'text-red-300'}`}>
                    {formatRp(summary.net_higo_cash_balance)}
                  </div>
                </div>
                <div className="mt-2 pt-1.5 border-t border-white/15 text-[10px] space-y-0.5 font-mono text-green-100/90">
                  <div className="flex justify-between">
                    <span>Rumus:</span>
                    <span>Kas Admin - Pengeluaran</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Pesanan:</span>
                    <span className="font-bold text-white">{summary.total_orders || 0} pesanan</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. SUB-TAB NAVIGASI: REKAP HARIAN vs RINCIAN PER TOKO & KURIR vs PENGELUARAN HIGO */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none shadow-2xs">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-2.5 pt-2 gap-2 flex-wrap">
                <div className="flex items-center gap-2 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('daily')}
                    className={`pb-2 px-2 text-xs font-black border-b-2 rounded-none cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                      activeSubTab === 'daily'
                        ? 'border-green-600 text-green-700 dark:text-green-400'
                        : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Rekap Harian per Tanggal ({dailyRecap.length} Hari)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSubTab('rekap_laba_admin_ongkir')}
                    className={`pb-2 px-2 text-xs font-black border-b-2 rounded-none cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                      activeSubTab === 'rekap_laba_admin_ongkir'
                        ? 'border-green-600 text-green-700 dark:text-green-400'
                        : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Rekap per Toko &amp; Kurir ({canteenRecap.length} Toko)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSubTab('expenses')}
                    className={`pb-2 px-2 text-xs font-black border-b-2 rounded-none cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                      activeSubTab === 'expenses'
                        ? 'border-green-600 text-green-700 dark:text-green-400'
                        : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Daftar Pengeluaran Kas Higo ({expenses.length})</span>
                  </button>
                </div>

                <div className="pb-1.5 text-[10.5px] font-mono text-gray-500 dark:text-gray-400">
                  Grand Total Perputaran Transaksi: <strong className="text-gray-900 dark:text-white">{formatRp(summary.grand_total_transactions)}</strong>
                </div>
              </div>

              {/* ================= SUB-TAB 0: REKAP HARIAN PER TANGGAL (HPP, ONGKIR, OMZET & LABA) ================= */}
              {activeSubTab === 'daily' && (
                <div className="p-2.5 sm:p-3 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-green-600" />
                        <span>Tabel Rekapitulasi HPP, Ongkir &amp; Omzet Per Tanggal</span>
                      </h3>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        Daftar rincian modal toko (HPP) dan ongkir kurir untuk setiap hari transaksi di periode <span className="font-bold text-gray-700 dark:text-gray-300">{getPeriodLabel()}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {dailyRecap.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (expandAllDays) {
                              setExpandedDates({});
                              setExpandAllDays(false);
                            } else {
                              const all = {};
                              dailyRecap.forEach((d) => { all[d.date] = true; });
                              setExpandedDates(all);
                              setExpandAllDays(true);
                            }
                          }}
                          className="px-2 py-1 text-[10.5px] font-bold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-none cursor-pointer flex items-center gap-1"
                        >
                          {expandAllDays ? (
                            <>
                              <ChevronUp className="w-3 h-3 text-green-600" />
                              <span>Tutup Semua Rincian Toko</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3 text-gray-500" />
                              <span>Buka Semua Rincian Toko</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-none">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-100 dark:bg-gray-800 text-[10px] font-bold uppercase text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                          <th rowSpan="2" className="py-2 px-2 text-center w-8 align-middle">No</th>
                          <th rowSpan="2" className="py-2 px-2.5 align-middle">Tanggal Transaksi</th>
                          <th rowSpan="2" className="py-2 px-2 text-right align-middle">Order</th>
                          <th rowSpan="2" className="py-2 px-2.5 text-right align-middle">Omzet (HPJ)</th>
                          <th rowSpan="2" className="py-2 px-2.5 text-right bg-amber-50/60 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 border-x border-amber-200/50 dark:border-amber-900/40 align-middle">
                            Modal Toko (HPP)
                          </th>
                          <th rowSpan="2" className="py-2 px-2.5 text-right align-middle">Laba Toko</th>
                          <th colSpan="3" className="py-1 px-2 text-center bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-300 border-x border-sky-200 dark:border-sky-800 font-black">
                            ONGKIR PENGANTARAN KURIR
                          </th>
                          <th rowSpan="2" className="py-2 px-2.5 text-right align-middle">Biaya Admin</th>
                          <th rowSpan="2" className="py-2 px-2.5 text-right align-middle">Grand Total</th>
                          <th rowSpan="2" className="py-2 px-2 text-center w-28 align-middle">Rincian</th>
                        </tr>
                        <tr className="bg-sky-50/70 dark:bg-sky-950/30 text-[9.5px] font-bold uppercase text-sky-900 dark:text-sky-300 border-b border-gray-200 dark:border-gray-700">
                          <th className="py-1 px-2 text-right border-l border-sky-200/50 dark:border-sky-900/40">
                            🛵 Kurir 1 (Faris)
                          </th>
                          <th className="py-1 px-2 text-right border-x border-sky-200/50 dark:border-sky-900/40">
                            🛵 Kurir 2 (Feri)
                          </th>
                          <th className="py-1 px-2 text-right border-r border-sky-200/50 dark:border-sky-900/40 font-black">
                            Total Ongkir
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800 font-mono text-[11px]">
                        {dailyRecap.length === 0 ? (
                          <tr>
                            <td colSpan="12" className="py-8 text-center font-sans text-gray-500">
                              Tidak ada riwayat transaksi pada periode tanggal ini.
                            </td>
                          </tr>
                        ) : (
                          dailyRecap.map((d, idx) => {
                            const isExpanded = !!expandedDates[d.date];
                            return (
                              <React.Fragment key={d.date || idx}>
                                <tr className={`hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors ${isExpanded ? 'bg-emerald-50/20 dark:bg-emerald-950/20' : ''}`}>
                                  <td className="py-2 px-2 text-center text-gray-400">{idx + 1}</td>
                                  <td className="py-2 px-2.5 font-sans">
                                    <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                      <span>{d.date_formatted}</span>
                                    </div>
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                      {d.day_name} • {d.date}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 text-right font-bold text-gray-800 dark:text-gray-200">
                                    {d.order_count}x
                                  </td>
                                  <td className="py-2 px-2.5 text-right text-gray-800 dark:text-gray-200">
                                    {formatRp(d.total_products)}
                                  </td>
                                  <td className="py-2 px-2.5 text-right font-bold text-amber-700 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-950/10 border-x border-amber-200/40 dark:border-amber-900/30">
                                    {formatRp(d.total_hpp)}
                                  </td>
                                  <td className="py-2 px-2.5 text-right font-bold text-emerald-700 dark:text-emerald-400">
                                    {formatRp(d.total_profit)}
                                  </td>

                                  {/* Kurir 1 (Pak Faris) */}
                                  <td className="py-2 px-2 text-right font-bold text-sky-800 dark:text-sky-300 bg-sky-50/20 dark:bg-sky-950/10 border-l border-sky-200/40 dark:border-sky-900/30">
                                    <div>{formatRp(d.courier_1?.delivery_fee || 0)}</div>
                                    <span className="text-[9.5px] font-normal text-gray-400">
                                      {d.courier_1?.order_count || 0}x
                                    </span>
                                  </td>

                                  {/* Kurir 2 (Pak Feri) */}
                                  <td className="py-2 px-2 text-right font-bold text-sky-800 dark:text-sky-300 bg-sky-50/20 dark:bg-sky-950/10 border-x border-sky-200/40 dark:border-sky-900/30">
                                    <div>{formatRp(d.courier_2?.delivery_fee || 0)}</div>
                                    <span className="text-[9.5px] font-normal text-gray-400">
                                      {d.courier_2?.order_count || 0}x
                                    </span>
                                  </td>

                                  {/* Total Ongkir Kurir */}
                                  <td className="py-2 px-2.5 text-right font-black text-sky-900 dark:text-sky-200 bg-sky-50/30 dark:bg-sky-950/20 border-r border-sky-200/40 dark:border-sky-900/30">
                                    <div>{formatRp(d.total_delivery_fee)}</div>
                                    {Number(d.total_courier_cut_to_admin || 0) > 0 && (
                                      <span className="block text-[9px] font-normal text-amber-600 dark:text-amber-400">
                                        +{formatRp(d.total_courier_cut_to_admin)} adm
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-2 px-2.5 text-right font-bold text-green-700 dark:text-green-400">
                                    {formatRp(d.total_admin_fee)}
                                  </td>
                                  <td className="py-2 px-2.5 text-right font-black text-gray-900 dark:text-white">
                                    {formatRp(d.grand_total)}
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandDate(d.date)}
                                      className="px-1.5 py-1 text-[10px] font-sans font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-none cursor-pointer flex items-center justify-center gap-1 mx-auto"
                                      title="Lihat rincian HPP toko dan tugas kurir di tanggal ini"
                                    >
                                      <span>{d.canteens?.length || 0} Toko</span>
                                      {isExpanded ? <ChevronUp className="w-3 h-3 text-green-600" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                                    </button>
                                  </td>
                                </tr>

                                {/* Expanded sub-row: Detail Toko & Kurir pada tanggal ini */}
                                {isExpanded && (
                                  <tr className="bg-gray-50/60 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-800">
                                    <td colSpan="12" className="p-2 sm:p-3">
                                      <div className="border border-green-200 dark:border-green-900/60 bg-white dark:bg-gray-900 rounded-none p-2 sm:p-2.5 shadow-2xs space-y-2.5">
                                        
                                        {/* Kartu Ringkasan Pembagian Ongkir Kurir 1 & 2 */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-sans">
                                          <div className="bg-sky-50/60 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 p-2 rounded-none flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <div className="w-7 h-7 bg-sky-600 text-white rounded-none flex items-center justify-center">
                                                <Bike className="w-4 h-4" />
                                              </div>
                                              <div>
                                                <div className="text-[9.5px] font-black uppercase text-sky-800 dark:text-sky-300 tracking-wider">
                                                  Kurir 1 (Pak Faris)
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-mono">
                                                  {d.courier_1?.order_count || 0} pesanan diantar
                                                </div>
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              <div className="text-xs font-black font-mono text-sky-900 dark:text-sky-200">
                                                {formatRp(d.courier_1?.delivery_fee || 0)}
                                              </div>
                                              <span className="text-[9px] text-gray-400">Ongkir Bersih</span>
                                            </div>
                                          </div>

                                          <div className="bg-sky-50/60 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 p-2 rounded-none flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <div className="w-7 h-7 bg-sky-700 text-white rounded-none flex items-center justify-center">
                                                <Bike className="w-4 h-4" />
                                              </div>
                                              <div>
                                                <div className="text-[9.5px] font-black uppercase text-sky-800 dark:text-sky-300 tracking-wider">
                                                  Kurir 2 (Pak Feri)
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-mono">
                                                  {d.courier_2?.order_count || 0} pesanan diantar
                                                </div>
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              <div className="text-xs font-black font-mono text-sky-900 dark:text-sky-200">
                                                {formatRp(d.courier_2?.delivery_fee || 0)}
                                              </div>
                                              <span className="text-[9px] text-gray-400">Ongkir Bersih</span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Tabel Rincian Toko */}
                                        <div>
                                          <div className="flex items-center justify-between pb-1 mb-1 border-b border-gray-100 dark:border-gray-800">
                                            <div className="flex items-center gap-1.5 font-sans">
                                              <Store className="w-3.5 h-3.5 text-green-600" />
                                              <span className="text-[11px] font-black uppercase text-gray-900 dark:text-white">
                                                Rincian HPP, Omzet &amp; Laba Per Toko • {d.date_formatted} ({d.day_name})
                                              </span>
                                            </div>
                                            <span className="text-[10px] font-mono text-gray-500">
                                              Total: {d.order_count} pesanan
                                            </span>
                                          </div>

                                          <div className="overflow-x-auto">
                                            <table className="w-full text-left text-[10.5px] border-collapse font-mono">
                                              <thead>
                                                <tr className="bg-gray-100/80 dark:bg-gray-800/80 text-[9.5px] font-bold uppercase text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                                                  <th className="py-1.5 px-2 text-center w-6 font-sans">#</th>
                                                  <th className="py-1.5 px-2 font-sans">Nama Toko / Kantin</th>
                                                  <th className="py-1.5 px-2 text-right">Order</th>
                                                  <th className="py-1.5 px-2 text-right">Omzet Produk</th>
                                                  <th className="py-1.5 px-2 text-right text-amber-700 dark:text-amber-400 font-bold">
                                                    Modal Toko (HPP)
                                                  </th>
                                                  <th className="py-1.5 px-2 text-right text-emerald-700 dark:text-emerald-400 font-bold">
                                                    Laba Toko
                                                  </th>
                                                  <th className="py-1.5 px-2 text-right text-sky-700 dark:text-sky-400 font-bold">
                                                    Ongkir
                                                  </th>
                                                  <th className="py-1.5 px-2 text-right text-green-700 dark:text-green-400 font-bold">
                                                    Biaya Admin
                                                  </th>
                                                  <th className="py-1.5 px-2 text-right font-black">
                                                    Subtotal Nilai
                                                  </th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                {(d.canteens || []).map((c, cIdx) => (
                                                  <tr key={c.canteen_id || cIdx} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                                                    <td className="py-1.5 px-2 text-center text-gray-400 font-sans">{cIdx + 1}</td>
                                                    <td className="py-1.5 px-2 font-sans font-bold text-gray-800 dark:text-gray-200">
                                                      {c.canteen_name}
                                                    </td>
                                                    <td className="py-1.5 px-2 text-right text-gray-700 dark:text-gray-300">
                                                      {c.order_count}x
                                                    </td>
                                                    <td className="py-1.5 px-2 text-right text-gray-700 dark:text-gray-300">
                                                      {formatRp(c.total_products)}
                                                    </td>
                                                    <td className="py-1.5 px-2 text-right font-bold text-amber-700 dark:text-amber-400">
                                                      {formatRp(c.total_hpp)}
                                                    </td>
                                                    <td className="py-1.5 px-2 text-right font-bold text-emerald-700 dark:text-emerald-400">
                                                      {formatRp(c.total_profit)}
                                                    </td>
                                                    <td className="py-1.5 px-2 text-right font-bold text-sky-700 dark:text-sky-400">
                                                      {formatRp(c.total_delivery_fee)}
                                                    </td>
                                                    <td className="py-1.5 px-2 text-right font-bold text-green-700 dark:text-green-400">
                                                      {formatRp(c.total_admin_fee)}
                                                    </td>
                                                    <td className="py-1.5 px-2 text-right font-black text-gray-900 dark:text-white">
                                                      {formatRp(c.grand_total)}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </tbody>
                      {dailyRecap.length > 0 && (
                        <tfoot>
                          <tr className="bg-gray-50 dark:bg-gray-800/90 border-t-2 border-gray-300 dark:border-gray-700 font-mono font-black text-[11px]">
                            <td colSpan="2" className="py-2.5 px-2.5 font-sans uppercase text-right text-gray-700 dark:text-gray-300">
                              TOTAL PERIODE ({dailyRecap.length} HARI):
                            </td>
                            <td className="py-2.5 px-2 text-right">{summary.total_orders || 0}x</td>
                            <td className="py-2.5 px-2.5 text-right">{formatRp(summary.total_products_omzet)}</td>
                            <td className="py-2.5 px-2.5 text-right text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 border-x border-amber-200/50 dark:border-amber-900/40">
                              {formatRp(summary.total_hpp)}
                            </td>
                            <td className="py-2.5 px-2.5 text-right text-emerald-700 dark:text-emerald-400">
                              {formatRp(summary.total_canteen_profit)}
                            </td>

                            {/* Total Kurir 1 (Faris) */}
                            <td className="py-2.5 px-2 text-right text-sky-800 dark:text-sky-300 bg-sky-50/40 dark:bg-sky-950/20 border-l border-sky-200/50 dark:border-sky-900/40">
                              <div>{formatRp(courier1Total?.net_delivery_fee || 0)}</div>
                              <span className="text-[9.5px] font-normal text-gray-400">{courier1Total?.order_count || 0}x</span>
                            </td>

                            {/* Total Kurir 2 (Feri) */}
                            <td className="py-2.5 px-2 text-right text-sky-800 dark:text-sky-300 bg-sky-50/40 dark:bg-sky-950/20 border-x border-sky-200/50 dark:border-sky-900/40">
                              <div>{formatRp(courier2Total?.net_delivery_fee || 0)}</div>
                              <span className="text-[9.5px] font-normal text-gray-400">{courier2Total?.order_count || 0}x</span>
                            </td>

                            {/* Total Ongkir Kurir */}
                            <td className="py-2.5 px-2.5 text-right text-sky-900 dark:text-sky-200 bg-sky-50/60 dark:bg-sky-950/30 border-r border-sky-200/50 dark:border-sky-900/40 font-black">
                              {formatRp(summary.courier_net_delivery_fee)}
                            </td>

                            <td className="py-2.5 px-2.5 text-right text-green-700 dark:text-green-400">
                              {formatRp(summary.gross_admin_income)}
                            </td>
                            <td className="py-2.5 px-2.5 text-right text-gray-900 dark:text-white">
                              {formatRp(summary.grand_total_transactions)}
                            </td>
                            <td className="py-2.5 px-2 text-center text-[10px] font-sans text-gray-400">
                              -
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* ================= SUB-TAB 1: DAFTAR & KELOLA PENGELUARAN HIGO ================= */}
              {activeSubTab === 'expenses' && (
                <div className="p-2.5 sm:p-3 space-y-3">
                  {/* Ringkasan Kategori Pengeluaran (Klik untuk Filter Cepat) */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setSelectedExpenseCategory('all')}
                      className={`px-2.5 py-1 text-[10.5px] font-bold rounded-none border cursor-pointer whitespace-nowrap transition-colors ${
                        selectedExpenseCategory === 'all'
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Semua Kategori ({formatRp(summary.total_expenses)})
                    </button>
                    {categoryBreakdown.map((cat) => (
                      <button
                        key={cat.category}
                        type="button"
                        onClick={() =>
                          setSelectedExpenseCategory(selectedExpenseCategory === cat.category ? 'all' : cat.category)
                        }
                        className={`px-2 py-1 text-[10.5px] font-bold rounded-none border cursor-pointer whitespace-nowrap transition-colors flex items-center gap-1 ${
                          selectedExpenseCategory === cat.category
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span>{cat.label}:</span>
                        <span className="font-mono">{formatRp(cat.total_amount)}</span>
                      </button>
                    ))}
                  </div>

                  {/* Bar Pencarian Pengeluaran & Tombol Tambah */}
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cari pengeluaran Higo: nama keperluan, penerima, catatan..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-gray-100 rounded-none focus:outline-none focus:border-green-600"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenAddModal}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-none cursor-pointer transition-colors shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Pengeluaran Baru</span>
                    </button>
                  </div>

                  {/* Tabel Daftar Pengeluaran Kas Higo */}
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-none">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-100 dark:bg-gray-800 text-[10px] font-bold uppercase text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                          <th className="py-2 px-2.5 w-24">Tanggal</th>
                          <th className="py-2 px-2.5">Keperluan / Deskripsi Pengeluaran</th>
                          <th className="py-2 px-2.5">Kategori</th>
                          <th className="py-2 px-2.5 hidden md:table-cell">Penerima / Metode</th>
                          <th className="py-2 px-2.5 text-center w-20">Nota/Bukti</th>
                          <th className="py-2 px-2.5 text-right w-32">Nominal Keluar</th>
                          <th className="py-2 px-2.5 text-center w-24">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {expenses.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="py-8 text-center text-gray-500 dark:text-gray-400">
                              <Receipt className="w-7 h-7 mx-auto mb-1.5 opacity-50" />
                              <p className="font-bold text-xs">Belum ada catatan pengeluaran kas Higo pada filter ini.</p>
                              <p className="text-[10.5px] text-gray-400 mt-0.5">
                                Klik tombol <strong>+ Catat Pengeluaran Higo</strong> di kanan atas untuk mencatat pengeluaran apapun.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          expenses.map((exp) => (
                            <tr key={exp.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                              <td className="py-2 px-2.5 font-mono text-[11px] text-gray-700 dark:text-gray-300 whitespace-nowrap align-top">
                                {exp.expense_date}
                              </td>
                              <td className="py-2 px-2.5 align-top">
                                <div className="font-bold text-gray-900 dark:text-white text-xs">
                                  {exp.title}
                                </div>
                                {exp.notes && (
                                  <div className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                                    Catatan: {exp.notes}
                                  </div>
                                )}
                                <div className="text-[9.5px] text-gray-400 mt-0.5 md:hidden">
                                  {exp.recipient ? `Penerima: ${exp.recipient} • ` : ''}
                                  Metode: {(exp.payment_method || 'cash').toUpperCase()}
                                </div>
                              </td>
                              <td className="py-2 px-2.5 align-top whitespace-nowrap">
                                <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-none">
                                  {exp.category_label}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 align-top hidden md:table-cell">
                                <div className="font-semibold text-gray-800 dark:text-gray-200 text-[11px]">
                                  {exp.recipient || '-'}
                                </div>
                                <div className="text-[10px] text-gray-400 uppercase font-mono">
                                  {exp.payment_method || 'cash'} • oleh {exp.admin_name}
                                </div>
                              </td>
                              <td className="py-2 px-2.5 text-center align-top">
                                {exp.proof_url ? (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewProofExpense(exp)}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-50 dark:bg-green-950/60 hover:bg-green-100 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-800 text-[10px] font-bold rounded-none cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Bukti</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-gray-400">-</span>
                                )}
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono font-black text-red-600 dark:text-red-400 whitespace-nowrap align-top">
                                -{formatRp(exp.amount)}
                              </td>
                              <td className="py-2 px-2.5 text-center align-top whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditModal(exp)}
                                    className="p-1 bg-gray-100 hover:bg-green-600 hover:text-white dark:bg-gray-800 dark:hover:bg-green-600 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-none cursor-pointer transition-colors"
                                    title="Edit Pengeluaran"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setExpenseToDelete(exp)}
                                    className="p-1 bg-red-50 hover:bg-red-600 hover:text-white dark:bg-red-950/50 dark:hover:bg-red-600 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-none cursor-pointer transition-colors"
                                    title="Hapus Pengeluaran"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {expenses.length > 0 && (
                        <tfoot>
                          <tr className="bg-gray-50 dark:bg-gray-800/80 border-t-2 border-gray-300 dark:border-gray-700 font-bold text-xs">
                            <td colSpan="5" className="py-2 px-2.5 text-right uppercase text-[10.5px] text-gray-600 dark:text-gray-300">
                              Total Pengeluaran Ditampilkan ({expenses.length} item):
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono font-black text-red-600 dark:text-red-400 whitespace-nowrap">
                              -{formatRp(expenses.reduce((acc, item) => acc + Number(item.amount || 0), 0))}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* ================= SUB-TAB 2: TABEL REKAP LABA TOKO, BIAYA ADMIN, & ONGKIR KURIR ================= */}
              {activeSubTab === 'rekap_laba_admin_ongkir' && (
                <div className="p-2.5 sm:p-3 space-y-4">
                  {/* A. Tabel Rekapitulasi Per Toko / Kantin */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-green-600" />
                        <span>Tabel Rekapitulasi Laba Toko, Biaya Admin &amp; Ongkir Per Kantin</span>
                      </h3>
                      <span className="text-[10px] text-gray-500 font-mono">
                        Periode: {getPeriodLabel()}
                      </span>
                    </div>

                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-none">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-800 text-[10px] font-bold uppercase text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                            <th className="py-2 px-2.5 w-10 text-center">No</th>
                            <th className="py-2 px-2.5">Nama Toko / Kantin</th>
                            <th className="py-2 px-2.5 text-right">Order</th>
                            <th className="py-2 px-2.5 text-right">Omzet Produk (HPJ)</th>
                            <th className="py-2 px-2.5 text-right">Modal (HPP)</th>
                            <th className="py-2 px-2.5 text-right">Laba Toko</th>
                            <th className="py-2 px-2.5 text-right">Ongkir Kurir</th>
                            <th className="py-2 px-2.5 text-right">Biaya Admin (Higo)</th>
                            <th className="py-2 px-2.5 text-right">Grand Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800 font-mono text-[11px]">
                          {canteenRecap.length === 0 ? (
                            <tr>
                              <td colSpan="9" className="py-6 text-center font-sans text-gray-500">
                                Tidak ada transaksi toko pada periode ini.
                              </td>
                            </tr>
                          ) : (
                            canteenRecap.map((c, idx) => (
                              <tr key={c.canteen_id || idx} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                                <td className="py-2 px-2.5 text-center text-gray-400">{idx + 1}</td>
                                <td className="py-2 px-2.5 font-sans font-bold text-gray-900 dark:text-white">
                                  {c.canteen_name}
                                </td>
                                <td className="py-2 px-2.5 text-right font-bold text-gray-800 dark:text-gray-200">
                                  {c.order_count}x
                                </td>
                                <td className="py-2 px-2.5 text-right text-gray-800 dark:text-gray-200">
                                  {formatRp(c.total_products)}
                                </td>
                                <td className="py-2 px-2.5 text-right text-gray-500 dark:text-gray-400">
                                  {formatRp(c.total_hpp)}
                                </td>
                                <td className="py-2 px-2.5 text-right font-bold text-emerald-700 dark:text-emerald-400">
                                  {formatRp(c.total_profit)}
                                </td>
                                <td className="py-2 px-2.5 text-right text-gray-700 dark:text-gray-300">
                                  {formatRp(c.total_delivery_fee)}
                                </td>
                                <td className="py-2 px-2.5 text-right font-bold text-green-700 dark:text-green-400">
                                  {formatRp(c.total_admin_fee)}
                                </td>
                                <td className="py-2 px-2.5 text-right font-black text-gray-900 dark:text-white">
                                  {formatRp(c.grand_total)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {canteenRecap.length > 0 && (
                          <tfoot>
                            <tr className="bg-gray-50 dark:bg-gray-800/90 border-t-2 border-gray-300 dark:border-gray-700 font-mono font-black text-[11px]">
                              <td colSpan="2" className="py-2 px-2.5 font-sans uppercase text-right text-gray-700 dark:text-gray-300">
                                TOTAL KESELURUHAN:
                              </td>
                              <td className="py-2 px-2.5 text-right">{summary.total_orders || 0}x</td>
                              <td className="py-2 px-2.5 text-right">{formatRp(summary.total_products_omzet)}</td>
                              <td className="py-2 px-2.5 text-right text-gray-500">{formatRp(summary.total_hpp)}</td>
                              <td className="py-2 px-2.5 text-right text-emerald-700 dark:text-emerald-400">
                                {formatRp(summary.total_canteen_profit)}
                              </td>
                              <td className="py-2 px-2.5 text-right">{formatRp(summary.courier_net_delivery_fee)}</td>
                              <td className="py-2 px-2.5 text-right text-green-700 dark:text-green-400">
                                {formatRp(summary.gross_admin_income)}
                              </td>
                              <td className="py-2 px-2.5 text-right">{formatRp(summary.grand_total_transactions)}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>

                  {/* B. Tabel Rekapitulasi Ongkir & Potongan Per Kurir */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                        <Bike className="w-3.5 h-3.5 text-green-600" />
                        <span>Tabel Rekapitulasi Ongkir Kurir &amp; Pindahan Ongkir ke Kas Admin</span>
                      </h3>
                    </div>

                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-none">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-800 text-[10px] font-bold uppercase text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                            <th className="py-2 px-2.5 w-10 text-center">No</th>
                            <th className="py-2 px-2.5">Nama Kurir Pengantar</th>
                            <th className="py-2 px-2.5 text-right">Jumlah Pesanan</th>
                            <th className="py-2 px-2.5 text-right">Ongkir Bersih Kurir</th>
                            <th className="py-2 px-2.5 text-right">Pindahan ke Kas Admin</th>
                            <th className="py-2 px-2.5 text-right">Total Nilai Pesanan Diantar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800 font-mono text-[11px]">
                          {courierRecap.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="py-6 text-center font-sans text-gray-500">
                                Tidak ada data pengantaran kurir pada periode ini.
                              </td>
                            </tr>
                          ) : (
                            courierRecap.map((cr, idx) => (
                              <tr key={cr.courier_id || idx} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                                <td className="py-2 px-2.5 text-center text-gray-400">{idx + 1}</td>
                                <td className="py-2 px-2.5 font-sans font-bold text-gray-900 dark:text-white">
                                  {cr.courier_name}
                                </td>
                                <td className="py-2 px-2.5 text-right font-bold text-gray-800 dark:text-gray-200">
                                  {cr.order_count}x
                                </td>
                                <td className="py-2 px-2.5 text-right font-bold text-green-700 dark:text-green-400">
                                  {formatRp(cr.net_delivery_fee)}
                                </td>
                                <td className="py-2 px-2.5 text-right text-amber-600 dark:text-amber-400 font-bold">
                                  +{formatRp(cr.total_courier_cut_to_admin)}
                                </td>
                                <td className="py-2 px-2.5 text-right font-black text-gray-900 dark:text-white">
                                  {formatRp(cr.grand_total)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ================= MODAL TAMBAH / EDIT PENGELUARAN KAS HIGO ================= */}
      {isFormOpen &&
        createPortal(
          <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none w-full max-w-lg shadow-2xl overflow-hidden my-auto">
              {/* Header Modal */}
              <div className="px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-green-600 text-white flex items-center justify-center rounded-none">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black uppercase text-gray-900 dark:text-white">
                      {editingExpense ? 'Edit Pengeluaran Kas Higo' : 'Catat Pengeluaran Kas Higo Baru'}
                    </h3>
                    <p className="text-[10px] text-gray-500">
                      Catat pengeluaran operasional, perlengkapan, server, insentif, atau keperluan apapun
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-none cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitExpense} className="p-3.5 space-y-2.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10.5px] font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                      Tanggal Pengeluaran *
                    </label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-none font-mono text-xs text-gray-900 dark:text-white focus:outline-none focus:border-green-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                      Kategori Pengeluaran *
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-none text-xs text-gray-900 dark:text-white focus:outline-none focus:border-green-600 cursor-pointer"
                    >
                      {Object.entries(categoriesMap).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    Nama Keperluan / Judul Pengeluaran *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Beli Kertas Struk Thermal, Bayar VPS Server, Bonus Kurir, dll."
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-none text-xs text-gray-900 dark:text-white focus:outline-none focus:border-green-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10.5px] font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                      Nominal Pengeluaran (Rp) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="Contoh: 50000"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-none font-mono font-bold text-xs text-gray-900 dark:text-white focus:outline-none focus:border-green-600"
                    />
                    {Number(formAmount) > 0 && (
                      <span className="text-[10px] font-mono text-green-600 dark:text-green-400 block mt-0.5">
                        Terbaca: {formatRp(formAmount)}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                      Metode Pembayaran
                    </label>
                    <select
                      value={formPaymentMethod}
                      onChange={(e) => setFormPaymentMethod(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-none text-xs text-gray-900 dark:text-white focus:outline-none focus:border-green-600 cursor-pointer"
                    >
                      <option value="cash">Tunai / Kas Cash</option>
                      <option value="transfer">Transfer Bank / QRIS</option>
                      <option value="ewallet">E-Wallet (Dana/OVO/GoPay/ShopeePay)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    Penerima / Toko / Vendor (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Toko ATK Barokah, Kurir Pak Feri, Hostinger, dll."
                    value={formRecipient}
                    onChange={(e) => setFormRecipient(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-none text-xs text-gray-900 dark:text-white focus:outline-none focus:border-green-600"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    Keterangan / Catatan Rinci (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Tulis rincian barang atau catatan tambahan..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-none text-xs text-gray-900 dark:text-white focus:outline-none focus:border-green-600"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                    Foto Nota / Bukti Kwitansi (Opsional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFormProofFile(e.target.files?.[0] || null)}
                    className="w-full text-xs file:mr-2 file:py-1 file:px-2.5 file:border-0 file:bg-green-600 file:text-white file:font-bold file:rounded-none file:cursor-pointer bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-1 rounded-none"
                  />
                  {editingExpense?.proof_url && !formRemoveProof && !formProofFile && (
                    <div className="flex items-center justify-between mt-1 p-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <span className="text-[10px] text-green-700 dark:text-green-400 font-bold">
                        ✓ Sudah ada bukti nota tersimpan
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormRemoveProof(true)}
                        className="text-[10px] text-red-600 font-bold hover:underline cursor-pointer"
                      >
                        Hapus Bukti Lama
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    disabled={saveExpenseMutation.isPending}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-none border border-gray-300 dark:border-gray-700 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saveExpenseMutation.isPending}
                    className="px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-black text-xs rounded-none cursor-pointer flex items-center gap-1.5"
                  >
                    {saveExpenseMutation.isPending ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <span>{editingExpense ? 'Simpan Perubahan' : 'Simpan Pengeluaran'}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ================= MODAL KONFIRMASI HAPUS PENGELUARAN ================= */}
      {expenseToDelete &&
        createPortal(
          <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none w-full max-w-sm p-4 shadow-2xl space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800 flex items-center justify-center shrink-0 rounded-none">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white uppercase">
                    Hapus Catatan Pengeluaran?
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                    Anda yakin ingin menghapus pengeluaran <strong>{expenseToDelete.title}</strong> sebesar{' '}
                    <strong className="font-mono text-red-600">{formatRp(expenseToDelete.amount)}</strong>?
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setExpenseToDelete(null)}
                  disabled={deleteExpenseMutation.isPending}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-none border border-gray-300 dark:border-gray-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => deleteExpenseMutation.mutate(expenseToDelete.id)}
                  disabled={deleteExpenseMutation.isPending}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-black rounded-none cursor-pointer"
                >
                  {deleteExpenseMutation.isPending ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ================= MODAL PREVIEW BUKTI NOTA PENGELUARAN ================= */}
      {previewProofExpense &&
        createPortal(
          <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none w-full max-w-md overflow-hidden shadow-2xl">
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">{previewProofExpense.title}</h4>
                  <p className="text-[10px] font-mono text-gray-500">
                    {previewProofExpense.expense_date} • {formatRp(previewProofExpense.amount)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewProofExpense(null)}
                  className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-700 rounded-none cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 bg-gray-950 flex items-center justify-center max-h-[75vh] overflow-auto">
                <AppImage
                  src={previewProofExpense.proof_url}
                  alt={previewProofExpense.title}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

