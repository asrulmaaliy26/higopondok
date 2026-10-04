import React, { useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, CheckCircle, FileText, ShoppingBag, Store, User, MapPin, Building2, Calendar, Phone, CheckSquare } from 'lucide-react';
import santriData from '../../data/santri.json';

const formatRupiah = (num) => {
  return Math.round(Number(num) || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return new Date().toLocaleString('id-ID');
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

const formatDateOnly = (dateStr) => {
  if (!dateStr) return new Date().toLocaleDateString('id-ID');
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

export const getSantriReceiptInfo = (user) => {
  const santriName = user?.santri_name || user?.name || '-';
  let santriClass = user?.santri_class || '';
  let santriLevel = user?.santri_level || '';
  let santriRoom = user?.santri_room || '-';

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
      if ((!santriRoom || santriRoom === '-') && match[10]) {
        santriRoom = match[10];
      }
    }
  }

  return {
    santriName,
    santriClass,
    santriLevel,
    santriRoom,
    waliName: user?.name || '-'
  };
};

export const getItemModalHpp = (item) => {
  if (item?.hpp !== undefined && item?.hpp !== null && parseFloat(item.hpp) > 0) {
    return parseFloat(item.hpp);
  }
  const rawProductHpp = item?.product?.hpp;
  if (rawProductHpp !== undefined && rawProductHpp !== null && parseFloat(rawProductHpp) > 0) {
    return parseFloat(rawProductHpp);
  }
  const price = parseFloat(item?.price || 0);
  return price > 1000 ? (price - 1000) : price;
};

export const getItemModalTotalHpp = (item) => {
  if (item?.total_hpp !== undefined && item?.total_hpp !== null && parseFloat(item.total_hpp) > 0) {
    return parseFloat(item.total_hpp);
  }
  const qty = parseInt(item?.quantity || 1, 10);
  return getItemModalHpp(item) * qty;
};

export const getOrderModalBelanja = (order) => {
  if (!order) return 0;
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

export default function ThermalReceiptModal({
  isOpen,
  onClose,
  mode = 'single', // 'single' | 'batch'
  order = null,
  orders = [],
  courierName = '',
  title = ''
}) {
  const receiptRef = useRef(null);
  const [paperWidth, setPaperWidth] = useState(mode === 'batch' ? 'A4' : '58mm'); // '58mm' | '80mm' | 'A4'
  const [a4Layout, setA4Layout] = useState('grid'); // 'grid' (4 struk per hal) | 'table' (manifes tabel)

  React.useEffect(() => {
    if (isOpen) {
      if (mode === 'batch') {
        setPaperWidth('A4');
        setA4Layout('grid');
      } else {
        setPaperWidth('58mm');
      }
    }
  }, [isOpen, mode]);

  // Filter batch orders: include all passed orders (except cancelled), uncompleted first
  const rawBatchOrders = Array.isArray(orders) ? orders : [];
  const filteredBatchOrders = useMemo(() => {
    if (mode !== 'batch') return [];
    const valid = rawBatchOrders.filter(o => o.status !== 'cancelled');
    return valid.sort((a, b) => {
      const getPriority = (status) => {
        if (status === 'processing') return 1;
        if (status === 'pending') return 2;
        if (status === 'completed') return 3;
        return 4;
      };
      const pA = getPriority(a.status);
      const pB = getPriority(b.status);
      if (pA !== pB) return pA - pB;
      return (b.id || 0) - (a.id || 0);
    });
  }, [rawBatchOrders, mode]);

  // Calculate single order summary
  const singleSummary = useMemo(() => {
    if (!order) return null;
    const deliveryFee = parseFloat(order.delivery_fee || 0);
    const adminFee = parseFloat(order.admin_fee || 0);
    const totalPrice = parseFloat(order.total_price || 0);
    const modalBelanja = getOrderModalBelanja(order);
    let hpjSubtotal = 0;
    if (order.items && order.items.length > 0) {
      hpjSubtotal = order.items.reduce((s, i) => s + parseFloat(i.subtotal || (parseFloat(i.price || 0) * (i.quantity || 1))), 0);
    } else {
      hpjSubtotal = Math.max(0, totalPrice - deliveryFee - adminFee);
    }

    const voucherDiscount = parseFloat(order.voucher_discount ?? (order.voucher?.discount_amount ?? 0));

    return {
      hpjSubtotal,
      modalBelanja,
      deliveryFee,
      adminFee,
      totalPrice,
      voucherDiscount,
      totalModalPlusOngkir: modalBelanja + deliveryFee,
    };
  }, [order]);

  // Calculate batch summaries
  const batchSummary = useMemo(() => {
    let products = 0;
    let hpp = 0;
    let delivery = 0;
    let admin = 0;

    filteredBatchOrders.forEach(o => {
      const deliveryFee = parseFloat(o.delivery_fee || 0);
      const adminFee = parseFloat(o.admin_fee || 0);
      delivery += deliveryFee;
      admin += adminFee;
      hpp += getOrderModalBelanja(o);

      if (o.items && o.items.length > 0) {
        o.items.forEach(i => {
          const qty = parseInt(i.quantity || 1, 10);
          const price = parseFloat(i.price || 0);
          const sub = parseFloat(i.subtotal || (price * qty));
          products += sub;
        });
      } else {
        const custom = Math.max(0, parseFloat(o.total_price || 0) - deliveryFee - adminFee);
        products += custom;
      }
    });

    return {
      products,
      hpp,
      profit: products - hpp,
      delivery,
      admin,
      totalModalPlusOngkir: hpp + delivery,
      grandTotal: products + delivery + admin
    };
  }, [filteredBatchOrders]);

  const handlePrint = () => {
    window.print();
  };

  // Early return only after all hooks are declared
  if (!isOpen) return null;

  const isA4 = paperWidth === 'A4';

  return createPortal(
    <>
      {/* CSS PRINT RULES (OPTIMIZED FOR THERMAL 58mm/80mm AND DESKTOP A4 PRINTERS) */}
      <style>{`
        @media print {
          @page {
            size: ${isA4 ? 'A4 portrait' : `${paperWidth} auto`};
            margin: ${isA4 ? (a4Layout === 'grid' && mode === 'batch' ? '5mm 5mm' : '8mm 10mm') : '0mm !important'};
          }
          #root {
            display: none !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: ${isA4 ? '100%' : paperWidth} !important;
            min-height: auto !important;
          }
          .no-print {
            display: none !important;
          }
          .receipt-modal-backdrop,
          .receipt-modal-card,
          .receipt-modal-scroll {
            position: static !important;
            display: block !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .thermal-receipt-printable {
            display: block !important;
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            margin: ${isA4 ? '0 auto' : '0 !important'};
            padding: ${isA4 ? '0' : '2mm 1.5mm 6mm 1.5mm'} !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: ${isA4 ? '100%' : paperWidth === '58mm' ? '58mm' : '80mm'} !important;
            max-width: ${isA4 ? '100%' : paperWidth === '58mm' ? '58mm' : '80mm'} !important;
            font-family: ${isA4 ? "'Inter', 'Segoe UI', Arial, sans-serif" : "'Consolas', 'Courier New', Courier, monospace"} !important;
            font-size: ${isA4 ? '9.5pt' : paperWidth === '58mm' ? '9pt' : '10.5pt'} !important;
            line-height: ${isA4 ? '1.35' : '1.2'} !important;
            box-shadow: none !important;
            border: none !important;
            word-break: ${isA4 ? 'normal' : 'break-word'} !important;
            overflow-wrap: break-word !important;
          }
          .a4-grid-container {
            display: flex !important;
            flex-direction: column !important;
            gap: 8mm !important;
            width: 100% !important;
          }
          .a4-receipt-card {
            border: 2px dashed #000000 !important;
            border-radius: 6px !important;
            padding: 5mm 7mm !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Consolas', 'Courier New', Courier, monospace !important;
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            display: flex !important;
            flex-direction: column !important;
            margin-bottom: 6mm !important;
          }
          .thermal-receipt-printable table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          .thermal-receipt-printable th, .thermal-receipt-printable td {
            word-break: normal !important;
            overflow-wrap: break-word !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="receipt-modal-backdrop fixed inset-0 z-[120] bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
        <div className={`receipt-modal-card bg-white dark:bg-gray-900 w-full ${isA4 ? 'max-w-5xl' : 'max-w-md'} rounded-none overflow-hidden shadow-2xl flex flex-col max-h-[94vh] border border-gray-200 dark:border-gray-800 transition-all duration-200`}>
          {/* MODAL HEADER */}
          <div className="p-3 sm:p-3.5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/80 dark:bg-gray-800/80 no-print flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-none bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 flex items-center justify-center shrink-0 border border-green-300 dark:border-green-800">
                <Printer className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">
                  {title || (mode === 'batch' ? `Rekap Pesanan (${filteredBatchOrders.length} Pesanan)` : `Struk Pesanan #ORD-${order?.id}`)}
                </h3>
                <p className="text-[10px] text-gray-500">
                  {isA4
                    ? (mode === 'batch' && a4Layout === 'grid'
                        ? 'Format Kertas A4 (PDF) • Slip Struk Kasir Siap Gunting'
                        : 'Format Dokumen / Kertas A4 (PDF)')
                    : `Format Printer Thermal (${paperWidth})`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Paper Size Selector (58mm, 80mm, A4) */}
              <div className="flex bg-gray-200 dark:bg-gray-700 p-0.5 rounded-none text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setPaperWidth('A4')}
                  className={`px-2 py-1 rounded-none transition-all flex items-center gap-1 cursor-pointer ${
                    paperWidth === 'A4'
                      ? 'bg-green-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                  }`}
                  title="Kertas A4 / Dokumen & Invoice Siap Simpan PDF"
                >
                  <FileText className="w-3 h-3" />
                  <span>A4</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaperWidth('58mm')}
                  className={`px-2 py-1 rounded-none transition-all cursor-pointer ${
                    paperWidth === '58mm'
                      ? 'bg-white dark:bg-gray-900 text-green-700 dark:text-green-400 shadow-xs'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                  }`}
                  title="Printer Thermal 58mm (iWare / Mini POS)"
                >
                  58mm
                </button>
                <button
                  type="button"
                  onClick={() => setPaperWidth('80mm')}
                  className={`px-2 py-1 rounded-none transition-all cursor-pointer ${
                    paperWidth === '80mm'
                      ? 'bg-white dark:bg-gray-900 text-green-700 dark:text-green-400 shadow-xs'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                  }`}
                  title="Printer Thermal 80mm (Kasir Standar)"
                >
                  80mm
                </button>
              </div>

              <button 
                onClick={onClose} 
                className="w-7 h-7 rounded-none bg-gray-200/70 dark:bg-gray-700 hover:bg-gray-300 text-gray-600 dark:text-gray-300 flex items-center justify-center transition-colors border border-gray-300 dark:border-gray-600 cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* TOGGLE SUB-FORMAT KHUSUS A4 BATCH (SLIP STRUK GRID VS TABEL MANIFES) */}
          {isA4 && mode === 'batch' && (
            <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between no-print gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Tata Letak PDF:</span>
                <div className="flex bg-gray-200 dark:bg-gray-700 p-0.5 rounded-none text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setA4Layout('grid')}
                    className={`px-2.5 py-0.5 rounded-none transition-all flex items-center gap-1.5 cursor-pointer ${
                      a4Layout === 'grid'
                        ? 'bg-green-600 text-white shadow-xs'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                    }`}
                  >
                    <span>✂️ Slip Struk Penuh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setA4Layout('table')}
                    className={`px-2.5 py-0.5 rounded-none transition-all flex items-center gap-1.5 cursor-pointer ${
                      a4Layout === 'table'
                        ? 'bg-green-600 text-white shadow-xs'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                    }`}
                  >
                    <span>📋 Tabel Manifes</span>
                  </button>
                </div>
              </div>
              <span className="text-[10px] text-green-700 dark:text-green-400 font-semibold hidden sm:inline">
                {a4Layout === 'grid' ? '✓ Format 1 struk per ruang penuh' : '✓ Ringkasan tabel daftar pengantaran'}
              </span>
            </div>
          )}

          {/* NOTICE / PANDUAN PENGATURAN CETAK THERMAL */}
          {!isA4 && (
            <div className="mx-3 mt-2 p-2 rounded-none bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[10px] text-amber-900 dark:text-amber-200 no-print flex items-start gap-1.5">
              <div className="text-sm shrink-0 leading-none">💡</div>
              <div className="space-y-0.5">
                <p className="font-bold">Panduan Cetak Pas di Printer Thermal ({paperWidth}):</p>
                <p className="text-[10px] leading-relaxed text-amber-800 dark:text-amber-300">
                  Jika pratinjau tampak selebar kertas A4: Pada jendela print browser, pastikan <strong>Tujuan (Destination)</strong> dipilih printer thermal Anda. Di bagian <em>Setelan lainnya</em>, ubah <strong>Ukuran Kertas</strong> ke <strong>{paperWidth} / Roll Paper</strong> dan <strong>Margin</strong> ke <strong>Tidak ada (None)</strong>.
                </p>
              </div>
            </div>
          )}

          {/* RECEIPT PREVIEW (SCROLLABLE) */}
          <div className="receipt-modal-scroll flex-1 overflow-y-auto p-4 bg-gray-200 dark:bg-gray-950 flex justify-center items-start">
            <div 
              ref={receiptRef}
              style={{
                width: isA4 ? '100%' : paperWidth === '58mm' ? '250px' : '320px',
                maxWidth: isA4 ? '900px' : undefined
              }}
              className={`thermal-receipt-printable bg-white text-black rounded-xl shadow-xl border border-gray-300 box-border shrink-0 min-h-fit my-1 ${
                isA4 ? 'p-4 sm:p-6 font-sans text-xs' : 'p-3.5 font-mono text-[11px] leading-tight'
              }`}
            >
              {/* ========================================================================= */}
              {/* 1. FORMAT A4: SINGLE ORDER INVOICE (STRUK BESAR KERTAS A4)                 */}
              {/* ========================================================================= */}
              {isA4 && mode === 'single' && order && (
                <div className="space-y-5 text-gray-900">
                  {/* KOP SURAT / HEADER RESMI A4 */}
                  <div className="border-b-2 border-gray-900 pb-4">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h1 className="text-xl font-black tracking-tight text-gray-900 uppercase">
                          HIGO PONDOK
                        </h1>
                        <p className="text-xs font-semibold text-gray-600">
                          Sistem Layanan Pesan Antar Santri • Pondok Pesantren
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Invoice / Bukti Pembelian & Pengantaran Resmi
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-3 py-1 bg-gray-900 text-white font-black text-xs rounded-md uppercase tracking-wider">
                          INVOICE PESANAN
                        </span>
                        <p className="text-sm font-bold text-gray-900 mt-1">#ORD-{order.id}</p>
                        <p className="text-[11px] text-gray-500">{formatDateTime(order.created_at)}</p>
                      </div>
                    </div>
                  </div>

                  {/* GRID INFORMASI: PESANAN & SANTRI PEMESAN */}
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
                    {/* Kolom 1: Info Pemesan */}
                    {(() => {
                      const info = getSantriReceiptInfo(order.user);
                      return (
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">DATA SANTRI / PEMESAN:</p>
                          <p className="text-sm font-bold text-gray-900">
                            {info.santriName}
                          </p>
                          <p className="text-gray-600">
                            <span className="font-semibold">Wali:</span> {info.waliName}
                          </p>
                          <p className="text-gray-600">
                            <span className="font-semibold">Asrama / Kamar:</span> {info.santriRoom}
                          </p>
                          {(info.santriClass || info.santriLevel) && (
                            <p className="text-gray-600">
                              <span className="font-semibold">Kelas:</span> {info.santriClass} {info.santriLevel ? `(${info.santriLevel})` : ''}
                            </p>
                          )}
                          {order.delivery_location && (
                            <p className="text-gray-600">
                              <span className="font-semibold">Tujuan Antar:</span> {order.delivery_location}
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Kolom 2: Info Toko, Kurir & Status */}
                    <div className="space-y-1 text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">INFO TOKO & PENGANTARAN:</p>
                      <p className="text-sm font-bold text-gray-900">
                        🏪 {order.canteen?.name || 'Kantin Pondok'}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-semibold">Kurir:</span> {order.courier?.name || courierName || 'Petugas Kurir'}
                      </p>
                      <div className="pt-1 flex items-center justify-end gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                          order.payment_status === 'paid'
                            ? 'bg-green-100 text-green-800 border border-green-300'
                            : order.payment_status === 'waiting_confirmation'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-red-100 text-red-800 border border-red-300'
                        }`}>
                          {order.payment_status === 'paid' ? '✅ Lunas' : order.payment_status === 'waiting_confirmation' ? '⏳ Verifikasi' : '⚠️ Belum Lunas'}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase bg-gray-200 text-gray-800 border border-gray-300">
                          Status: {order.status === 'completed' ? 'Selesai' : order.status === 'processing' ? 'Sedang Diproses' : order.status === 'cancelled' ? 'Dibatalkan' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* TABEL ITEM / MENU PESANAN */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse border border-gray-200">
                      <thead>
                        <tr className="border-b-2 border-gray-800 text-[11px] font-bold uppercase text-gray-700 bg-gray-100">
                          <th className="py-2.5 px-3 w-[40px] text-center shrink-0 border-r border-gray-200">No</th>
                          <th className="py-2.5 px-3 min-w-[180px] border-r border-gray-200">Nama Menu / Produk</th>
                          <th className="py-2.5 px-3 text-center w-[60px] shrink-0 border-r border-gray-200">Jumlah</th>
                          <th className="py-2.5 px-3 text-right w-[120px] shrink-0 border-r border-gray-200">Harga Satuan</th>
                          <th className="py-2.5 px-3 text-right w-[120px] shrink-0">Total Harga</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 text-xs">
                        {order.items && order.items.length > 0 ? (
                          order.items.map((item, idx) => {
                            const qty = item.quantity || 1;
                            const price = parseFloat(item.price || 0);
                            const sub = parseFloat(item.subtotal || price * qty);
                            return (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="py-2.5 px-3 text-center text-gray-500 border-r border-gray-200 font-medium">{idx + 1}</td>
                                <td className="py-2.5 px-3 border-r border-gray-200 font-semibold text-gray-900">
                                  {item.product?.name || 'Produk'}
                                  {item.notes && <span className="block text-[11px] text-gray-500 font-normal italic">Catatan: {item.notes}</span>}
                                </td>
                                <td className="py-2.5 px-3 text-center border-r border-gray-200 font-bold">{qty}</td>
                                <td className="py-2.5 px-3 text-right border-r border-gray-200">Rp {formatRupiah(price)}</td>
                                <td className="py-2.5 px-3 text-right font-bold text-gray-900">Rp {formatRupiah(sub)}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td className="py-2.5 px-3 text-center text-gray-500 border-r border-gray-200 font-medium">1</td>
                            <td className="py-2.5 px-3 border-r border-gray-200 font-semibold text-gray-900">
                              {order.custom_notes || 'Pesanan Khusus / Titip Beli'}
                            </td>
                            <td className="py-2.5 px-3 text-center border-r border-gray-200 font-bold">1</td>
                            <td className="py-2.5 px-3 text-right border-r border-gray-200">Rp {formatRupiah(singleSummary?.hpjSubtotal || 0)}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-gray-900">Rp {formatRupiah(singleSummary?.hpjSubtotal || 0)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* RINGKASAN PEMBAYARAN */}
                  <div className="flex justify-end pt-2">
                    <div className="w-72 space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal Belanja:</span>
                        <span className="font-semibold text-gray-900">Rp {formatRupiah(singleSummary?.hpjSubtotal || 0)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Ongkos Kirim Kurir:</span>
                        <span className="font-semibold text-gray-900">Rp {formatRupiah(singleSummary?.deliveryFee || 0)}</span>
                      </div>
                      {parseFloat(singleSummary?.adminFee || 0) > 0 && (
                        <div className="flex justify-between text-gray-600">
                          <span>Biaya Layanan/Admin:</span>
                          <span className="font-semibold text-gray-900">Rp {formatRupiah(singleSummary?.adminFee || 0)}</span>
                        </div>
                      )}
                      <div className="border-t border-gray-300 pt-2 flex justify-between font-black text-sm text-gray-900">
                        <span>TOTAL AKHIR:</span>
                        <span className="text-green-700">Rp {formatRupiah(singleSummary?.totalPrice || 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* FOOTER NOTULENSI */}
                  <div className="text-center pt-3 border-t border-dotted border-gray-300 text-[10px] text-gray-400">
                    Dokumen ini sah dan dicetak secara otomatis dari sistem Higo Pondok pada {formatDateTime(new Date().toISOString())}.
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* 2. FORMAT A4: BATCH RECAP / SLIP STRUK (KERTAS A4 / PDF)                  */}
              {/* ========================================================================= */}
              {isA4 && mode === 'batch' && (
                <div className="space-y-4 text-gray-900">
                  {/* OPSI A: SLIP STRUK GRID (STRUK KASIR KOMPAK FONT MONOSPACE SIAP GUNTING) */}
                  {a4Layout === 'grid' && (
                    <div className="space-y-4">
                      {/* HEADER SUMMARY SINGKAT */}
                      <div className="border-b-2 border-gray-900 pb-2.5 flex justify-between items-center flex-wrap gap-2 font-mono">
                        <div>
                          <div className="flex items-center gap-2">
                            <h1 className="text-base font-black tracking-tight text-gray-900 uppercase">HIGO PONDOK</h1>
                            <span className="px-2 py-0.5 bg-black text-white font-bold text-[10px] rounded uppercase">
                              REKAP STRUK ANTARAN
                            </span>
                          </div>
                          <p className="text-[10.5px] text-gray-600">
                            {title || 'Rekap Daftar Struk'} • Petugas: <strong>{courierName || 'Petugas'}</strong> • {formatDateTime(new Date().toISOString())}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-300">
                          <div>
                            <span className="text-[9.5px] text-gray-500 block">Total Struk</span>
                            <span className="font-black text-gray-900">{filteredBatchOrders.length} Pesanan</span>
                          </div>
                          <div className="border-l border-gray-300 pl-3">
                            <span className="text-[9.5px] text-gray-500 block">Total Tagihan Santri</span>
                            <span className="font-black text-green-700">Rp {formatRupiah(batchSummary.grandTotal)}</span>
                          </div>
                        </div>
                      </div>

                      {/* STRUK PENUH 1 KOLOM (FULL WIDTH, FONT BESAR, SEPERTI STRUK KASIR ASLI MAKSIMAL) */}
                      <div className="a4-grid-container flex flex-col gap-6 w-full">
                        {filteredBatchOrders.length === 0 ? (
                          <div className="py-12 text-center text-gray-500 font-bold font-mono text-base">
                            Tidak ada data pesanan aktif untuk filter saat ini.
                          </div>
                        ) : (
                          filteredBatchOrders.map((o, idx) => {
                            const info = getSantriReceiptInfo(o.user);
                            return (
                              <div 
                                key={idx} 
                                className="a4-receipt-card border-2 border-dashed border-black rounded-xl p-5 sm:p-6 bg-white text-black font-mono shadow-sm relative flex flex-col space-y-3 w-full"
                              >
                                {/* HEADER STRUK */}
                                <div className="text-center pb-3 border-b-2 border-dashed border-black">
                                  <div className="flex justify-between items-center text-xs sm:text-sm font-bold text-gray-700">
                                    <span className="bg-black text-white px-2.5 py-0.5 rounded text-xs sm:text-sm font-black tracking-wider">
                                      #ORD-{o.id}
                                    </span>
                                    <span className="font-mono">{formatDateTime(o.created_at)}</span>
                                  </div>
                                  <h3 className="font-black text-xl sm:text-2xl uppercase tracking-widest text-black mt-2">
                                    HIGO PONDOK
                                  </h3>
                                  <p className="text-xs sm:text-sm font-bold text-gray-700 tracking-wide mt-0.5">
                                    LAYANAN PESAN ANTAR SANTRI
                                  </p>
                                </div>

                                {/* DATA SANTRI & TUJUAN ANTAR */}
                                <div className="py-2 border-b-2 border-dashed border-black space-y-1.5 text-xs sm:text-sm">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="shrink-0 text-gray-700 font-bold">Penerima / Santri :</span>
                                    <span className="font-black text-right break-words text-black text-sm sm:text-base uppercase">
                                      {info.santriName}
                                    </span>
                                  </div>
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="shrink-0 text-gray-700 font-bold">Kamar / Asrama     :</span>
                                    <span className="font-black text-right break-words text-black text-sm sm:text-base">
                                      📍 {info.santriRoom !== '-' ? info.santriRoom : (o.delivery_location || '-')}
                                    </span>
                                  </div>
                                  {(info.santriClass || info.santriLevel) && (
                                    <div className="flex items-start justify-between gap-2 text-xs text-gray-600">
                                      <span className="shrink-0">Kelas / Jenjang   :</span>
                                      <span className="text-right font-bold">{info.santriClass} {info.santriLevel ? `(${info.santriLevel})` : ''}</span>
                                    </div>
                                  )}
                                  <div className="flex items-start justify-between gap-2 pt-1 border-t border-dotted border-gray-400">
                                    <span className="shrink-0 text-gray-700 font-bold">Toko Pengirim     :</span>
                                    <span className="font-black text-right break-words text-black text-xs sm:text-sm">
                                      🏪 {o.canteen?.name || 'Kantin'}
                                    </span>
                                  </div>
                                </div>

                                {/* DAFTAR MENU / ITEM */}
                                <div className="py-2 border-b-2 border-dashed border-black text-xs sm:text-sm">
                                  <div className="flex justify-between font-black text-xs text-gray-600 pb-1.5 border-b border-dotted border-gray-400 tracking-wider">
                                    <span>RINCIAN MENU / PESANAN</span>
                                    <span>SUBTOTAL</span>
                                  </div>
                                  <div className="pt-2 space-y-2">
                                    {o.items && o.items.length > 0 ? (
                                      o.items.map((item, itIdx) => {
                                        const qty = item.quantity || 1;
                                        const price = parseFloat(item.price || 0);
                                        const sub = parseFloat(item.subtotal || price * qty);
                                        return (
                                          <div key={itIdx} className="space-y-0.5">
                                            <div className="flex justify-between items-start gap-2 text-sm sm:text-base font-black">
                                              <span className="break-words leading-tight">{qty}x {item.product?.name || 'Produk'}</span>
                                              <span className="shrink-0 whitespace-nowrap">Rp {formatRupiah(sub)}</span>
                                            </div>
                                            <div className="text-xs text-gray-600 flex justify-between items-center pl-2">
                                              <span>@{formatRupiah(price)}</span>
                                              {item.notes && <span className="italic">Catatan: {item.notes}</span>}
                                            </div>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <div className="flex justify-between items-start gap-2 text-sm sm:text-base font-black">
                                        <span className="break-words">{o.custom_notes || 'Pesanan Khusus / Titip Beli'}</span>
                                        <span className="shrink-0 whitespace-nowrap">Rp {formatRupiah(o.total_price)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* BOTTOM: RINCIAN TOTAL & STATUS BAYAR */}
                                <div className="pt-2 space-y-1.5 text-xs sm:text-sm">
                                  <div className="flex justify-between items-center text-gray-700">
                                    <span className="font-medium">Subtotal Belanja :</span>
                                    <span className="font-bold whitespace-nowrap">
                                      Rp {formatRupiah(o.items?.length > 0 ? o.items.reduce((s, i) => s + parseFloat(i.subtotal || (parseFloat(i.price || 0) * (i.quantity || 1))), 0) : Math.max(0, parseFloat(o.total_price || 0) - parseFloat(o.delivery_fee || 0) - parseFloat(o.admin_fee || 0)))}
                                    </span>
                                  </div>
                                  {parseFloat(o.voucher_discount ?? (o.voucher?.discount_amount ?? 0)) > 0 && (
                                    <div className="flex justify-between items-center text-red-600 font-bold">
                                      <span className="font-medium">Diskon Voucher :</span>
                                      <span className="whitespace-nowrap">-Rp {formatRupiah(o.voucher_discount ?? o.voucher?.discount_amount)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between items-center text-gray-700">
                                    <span className="font-medium">Ongkos Kirim     :</span>
                                    <span className="font-bold whitespace-nowrap">
                                      {parseFloat(o.delivery_fee || 0) === 0 && o.voucher_id ? 'Rp 0 (Voucher)' : `Rp ${formatRupiah(o.delivery_fee || 0)}`}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center font-black pt-2 pb-1 border-t-2 border-dotted border-black text-black">
                                    <span className="text-base sm:text-lg uppercase">TOTAL BAYAR :</span>
                                    <span className="text-xl sm:text-2xl whitespace-nowrap">Rp {formatRupiah(o.total_price)}</span>
                                  </div>
                                  <div className="pt-1 flex justify-between items-center font-black">
                                    <span className="text-xs sm:text-sm uppercase text-gray-700">STATUS PEMBAYARAN :</span>
                                    <span className={`px-2 py-0.5 rounded text-xs sm:text-sm uppercase whitespace-nowrap border ${
                                      o.payment_status === 'paid' 
                                        ? 'border-black bg-gray-100 text-black font-black' 
                                        : 'border-black bg-black text-white font-black'
                                    }`}>
                                      {o.payment_status === 'paid' ? '[ LUNAS / SALDO ]' : '[ COD / TAGIHAN TUNAI ]'}
                                    </span>
                                  </div>
                                </div>

                                {/* FOOTER CUT MARK */}
                                <div className="pt-3 border-t-2 border-dashed border-black text-center space-y-0.5">
                                  <div className="text-xs sm:text-sm font-black tracking-widest text-black">
                                    ✂️ ------------------ GUNTING / POTONG DI SINI ------------------ ✂️
                                  </div>
                                  <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                                    TEMPEL DI KANTONG / BUNGKUSAN SANTRI
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* OPSI B: TABEL MANIFES RESMI (FORMAT REKAPITULASI TABEL) */}
                  {a4Layout === 'table' && (
                    <div className="space-y-4">
                      {/* KOP MANIFES A4 */}
                      <div className="border-b-2 border-gray-900 pb-4">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <h1 className="text-xl font-black tracking-tight text-gray-900 uppercase">
                              HIGO PONDOK
                            </h1>
                            <p className="text-xs font-bold text-gray-700 uppercase">
                              {title || 'LEMBAR REKAPITULASI & MANIFES DAFTAR ANTARAN PESANAN'}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              Pondok Pesantren • Dicetak pada: {formatDateTime(new Date().toISOString())}
                            </p>
                          </div>
                          <div className="text-right space-y-1">
                            <span className="inline-block px-3 py-1 bg-green-700 text-white font-black text-xs rounded-md uppercase tracking-wider">
                              REKAP TERPADU
                            </span>
                            <p className="text-xs font-bold text-gray-800">
                              Petugas: {courierName || 'Petugas / Kurir'}
                            </p>
                            <p className="text-xs font-bold text-gray-800">
                              Total: {filteredBatchOrders.length} Pesanan
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* SUMMARY CARDS KEUANGAN */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs">
                        <div className="p-2 bg-white rounded-lg border border-gray-200 text-center">
                          <span className="text-[10px] font-bold text-gray-400 block uppercase">Total Pesanan</span>
                          <span className="text-sm sm:text-base font-black text-gray-900">{filteredBatchOrders.length}</span>
                        </div>
                        <div className="p-2 bg-green-50/80 rounded-lg border border-green-200 text-center">
                          <span className="text-[10px] font-bold text-green-800 block uppercase">Modal Belanja (HPP)</span>
                          <span className="text-xs sm:text-sm font-black text-green-800">Rp {formatRupiah(batchSummary.hpp)}</span>
                        </div>
                        <div className="p-2 bg-blue-50/80 rounded-lg border border-blue-200 text-center">
                          <span className="text-[10px] font-bold text-blue-700 block uppercase">Total Ongkir Kurir</span>
                          <span className="text-xs sm:text-sm font-black text-blue-700">Rp {formatRupiah(batchSummary.delivery)}</span>
                        </div>
                        <div className="p-2 bg-emerald-100/70 rounded-lg border border-emerald-300 text-center">
                          <span className="text-[10px] font-bold text-emerald-900 block uppercase">Total Modal + Ongkir</span>
                          <span className="text-xs sm:text-sm font-black text-emerald-900">Rp {formatRupiah(batchSummary.totalModalPlusOngkir)}</span>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-gray-200 text-center">
                          <span className="text-[10px] font-bold text-gray-500 block uppercase">Omzet Tagihan Santri</span>
                          <span className="text-xs sm:text-sm font-bold text-gray-800">Rp {formatRupiah(batchSummary.grandTotal)}</span>
                        </div>
                      </div>

                      {/* TABEL MANIFES DETAIL SEMUA PESANAN */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse border border-gray-300 text-xs">
                          <thead>
                            <tr className="bg-gray-100 border-b border-gray-300 text-[10px] font-bold uppercase text-gray-700">
                              <th className="py-2.5 px-2 border-r border-gray-300 text-center w-[35px] shrink-0">No</th>
                              <th className="py-2.5 px-2 border-r border-gray-300 w-[85px] shrink-0 whitespace-nowrap">Order ID</th>
                              <th className="py-2.5 px-2.5 border-r border-gray-300 min-w-[150px] w-[26%]">Santri & Asrama</th>
                              <th className="py-2.5 px-2 border-r border-gray-300 w-[110px] min-w-[100px]">Toko / Kantin</th>
                              <th className="py-2.5 px-2.5 border-r border-gray-300 min-w-[150px] w-[28%]">Detail Menu</th>
                              <th className="py-2.5 px-2 border-r border-gray-300 text-right w-[95px] shrink-0 whitespace-nowrap">Modal / Tagihan</th>
                              <th className="py-2.5 px-2 border-r border-gray-300 text-center w-[55px] shrink-0 whitespace-nowrap">Bayar</th>
                              <th className="py-2.5 px-2 text-center w-[65px] shrink-0">Paraf</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-300 text-[11px]">
                            {filteredBatchOrders.length === 0 ? (
                              <tr>
                                <td colSpan="8" className="py-6 text-center text-gray-500 font-semibold">
                                  Tidak ada data pesanan aktif untuk filter saat ini.
                                </td>
                              </tr>
                            ) : (
                              filteredBatchOrders.map((o, idx) => {
                                const itemsSummary = o.items && o.items.length > 0
                                  ? o.items.map(i => `${i.quantity}x ${i.product?.name || 'Produk'}`).join(', ')
                                  : (o.custom_notes ? `Titip Beli: ${o.custom_notes}` : 'Pesanan Khusus / Titip Beli');

                                return (
                                  <tr key={idx} className="hover:bg-gray-50">
                                    <td className="py-2 px-2 text-center border-r border-gray-300 text-gray-500 font-bold">{idx + 1}</td>
                                    <td className="py-2 px-2 border-r border-gray-300 font-bold whitespace-nowrap">
                                      #ORD-{o.id}
                                      <span className="block text-[9px] text-gray-500 font-normal">
                                        {formatDateTime(o.created_at).split(' ')[1] || ''}
                                      </span>
                                    </td>
                                    <td className="py-2 px-2.5 border-r border-gray-300">
                                      <span className="font-bold block text-gray-900 leading-tight">
                                        {o.user?.santri_name || o.user?.name || '-'}
                                      </span>
                                      <span className="text-[9.5px] text-gray-600 block mt-0.5 leading-tight">
                                        📍 {o.user?.santri_room || o.delivery_location || '-'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-2 border-r border-gray-300 font-semibold text-[10.5px] leading-tight">
                                      {o.canteen?.name || 'Kantin'}
                                    </td>
                                    <td className="py-2 px-2.5 border-r border-gray-300 text-[10.5px] text-gray-700 leading-tight">
                                      {itemsSummary}
                                    </td>
                                    <td className="py-2 px-2 border-r border-gray-300 text-right font-bold text-gray-900 whitespace-nowrap">
                                      <span className="block text-green-800 font-extrabold">Rp {formatRupiah(getOrderModalBelanja(o))}</span>
                                      <span className="block text-[9px] text-gray-400 font-normal">Santri: Rp {formatRupiah(o.total_price)}</span>
                                    </td>
                                    <td className="py-2 px-2 border-r border-gray-300 text-center whitespace-nowrap">
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                        o.payment_status === 'paid'
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}>
                                        {o.payment_status === 'paid' ? 'LUNAS' : 'COD'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-2 text-center text-gray-400">
                                      <div className="w-10 h-5 border border-dashed border-gray-400 rounded mx-auto"></div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* AREA TTD MANIFES RESMI */}
                      <div className="pt-6 border-t border-gray-200 grid grid-cols-2 gap-8 text-center text-xs">
                        <div>
                          <p className="text-gray-500 font-semibold mb-12">Petugas Kurir / Pengantar</p>
                          <p className="font-bold text-gray-900 underline">{courierName || '( ........................................ )'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 font-semibold mb-12">Pengurus / Admin Higo Pondok</p>
                          <p className="font-bold text-gray-900 underline">( ........................................ )</p>
                        </div>
                      </div>

                      {/* FOOTER */}
                      <div className="text-center pt-3 border-t border-dotted border-gray-300 text-[10px] text-gray-400">
                        Dokumen Rekapitulasi Manifes Resmi • Higo Pondok POS System
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================================= */}
              {/* 3. FORMAT THERMAL: SINGLE ORDER (58mm / 80mm THERMAL RECEIPT)             */}
              {/* ========================================================================= */}
              {!isA4 && mode === 'single' && order && (
                <div className="space-y-1.5 bg-white text-black">
                  {/* HEADER */}
                  <div className="text-center pb-1.5 border-b border-dashed border-black">
                    <h2 className="text-sm font-black uppercase tracking-wider">HIGO PONDOK</h2>
                    <p className="text-[9px] text-gray-600">Layanan Pesan Antar Santri</p>
                    
                    <div className="text-left text-[10px] mt-1.5 space-y-0.5 pt-1 border-t border-dotted border-gray-400">
                      <div className="flex justify-between items-start gap-1">
                        <span className="shrink-0 text-gray-700">No. Order:</span>
                        <span className="font-bold text-right">#ORD-{order.id}</span>
                      </div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="shrink-0 text-gray-700">Waktu:</span>
                        <span className="text-right">{formatDateTime(order.created_at)}</span>
                      </div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="shrink-0 text-gray-700">Toko:</span>
                        <span className="font-bold text-right break-words">{order.canteen?.name || 'Kantin Pondok'}</span>
                      </div>
                      {order.courier?.name && (
                        <div className="flex justify-between items-start gap-1">
                          <span className="shrink-0 text-gray-700">Kurir:</span>
                          <span className="text-right break-words">{order.courier.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* DATA SANTRI / PEMESAN */}
                  {(() => {
                    const info = getSantriReceiptInfo(order.user);
                    return (
                      <div className="py-1 border-b border-dashed border-black text-[10px] space-y-0.5">
                        <div className="flex justify-between items-start gap-1">
                          <span className="shrink-0 text-gray-700">Santri:</span>
                          <span className="font-bold text-right break-words">{info.santriName}</span>
                        </div>
                        <div className="flex justify-between items-start gap-1">
                          <span className="shrink-0 text-gray-700">Asrama:</span>
                          <span className="font-bold text-right break-words">{info.santriRoom}</span>
                        </div>
                        {(info.santriClass || info.santriLevel) && (
                          <div className="flex justify-between items-start gap-1">
                            <span className="shrink-0 text-gray-700">Kelas:</span>
                            <span className="text-right">{info.santriClass} {info.santriLevel ? `(${info.santriLevel})` : ''}</span>
                          </div>
                        )}
                        {order.delivery_location && (
                          <div className="flex justify-between items-start gap-1">
                            <span className="shrink-0 text-gray-700">Antar:</span>
                            <span className="text-right break-words">{order.delivery_location}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ITEM LIST */}
                  <div className="py-1 border-b border-dashed border-black">
                    <div className="flex justify-between font-bold text-[10px] pb-1 border-b border-dotted border-gray-400">
                      <span>MENU</span>
                      <span className="shrink-0">TOTAL</span>
                    </div>
                    <div className="pt-1 space-y-1 text-[10px]">
                      {order.items && order.items.length > 0 ? (
                        order.items.map((item, idx) => {
                          const qty = item.quantity || 1;
                          const price = parseFloat(item.price || 0);
                          const sub = parseFloat(item.subtotal || price * qty);
                          return (
                            <div key={idx} className="space-y-0.5">
                              <div className="flex justify-between items-start gap-1 font-bold">
                                <span className="break-words">{item.product?.name || 'Produk'}</span>
                                <span className="shrink-0 font-black">Rp {formatRupiah(sub)}</span>
                              </div>
                              <div className="text-[9px] text-gray-600 flex justify-between items-center">
                                <span>{qty} x Rp {formatRupiah(price)}</span>
                              </div>
                              {item.notes && (
                                <div className="text-[8.5px] font-semibold text-gray-800 italic break-words pl-1 border-l-2 border-gray-400">
                                  {item.notes}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="space-y-0.5">
                          <div className="flex justify-between items-start gap-1 font-bold">
                            <span className="break-words">{order.custom_notes || 'Pesanan Khusus / Titip Beli'}</span>
                            <span className="shrink-0 font-black">Rp {formatRupiah(singleSummary?.hpjSubtotal || 0)}</span>
                          </div>
                          <div className="text-[9px] text-gray-600">
                            1 x Rp {formatRupiah(singleSummary?.hpjSubtotal || 0)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* FINANCIAL TOTALS */}
                  <div className="py-1 border-b border-dashed border-black text-[10px] space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Subtotal:</span>
                      <span className="font-semibold whitespace-nowrap">Rp {formatRupiah(singleSummary?.hpjSubtotal || 0)}</span>
                    </div>
                    {singleSummary?.voucherDiscount > 0 && (
                      <div className="flex justify-between items-center text-red-600 font-bold">
                        <span>Diskon Voucher:</span>
                        <span className="whitespace-nowrap">-Rp {formatRupiah(singleSummary.voucherDiscount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Ongkir:</span>
                      <span className="font-semibold whitespace-nowrap">
                        {parseFloat(singleSummary?.deliveryFee || 0) === 0 && order.voucher_id ? 'Rp 0 (Voucher)' : `Rp ${formatRupiah(singleSummary?.deliveryFee || 0)}`}
                      </span>
                    </div>
                    {parseFloat(singleSummary?.adminFee || 0) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">Biaya Layanan:</span>
                        <span className="font-semibold whitespace-nowrap">Rp {formatRupiah(singleSummary?.adminFee || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center font-black text-[11px] pt-1 border-t border-dotted border-black">
                      <span>TOTAL:</span>
                      <span className="whitespace-nowrap">Rp {formatRupiah(singleSummary?.totalPrice || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center font-bold text-[9.5px] pt-0.5">
                      <span>STATUS:</span>
                      <span className="uppercase text-right whitespace-nowrap">
                        {order.payment_status === 'paid' ? '[ LUNAS ]' : order.payment_status === 'waiting_confirmation' ? '[ VERIFIKASI ]' : '[ BELUM LUNAS ]'}
                      </span>
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className="text-center pt-1.5 text-[9px] space-y-0.5">
                    <p className="font-bold">Terima Kasih</p>
                    <p>Semoga Berkah & Bermanfaat</p>
                    <p className="text-[8px] text-gray-500 pt-0.5">*** Higo Pondok POS ***</p>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* 4. FORMAT THERMAL: BATCH RECAP (58mm / 80mm THERMAL MANIFEST)             */}
              {/* ========================================================================= */}
              {!isA4 && mode === 'batch' && (
                <div className="space-y-1.5 bg-white text-black">
                  {/* HEADER */}
                  <div className="text-center pb-1.5 border-b border-dashed border-black">
                    <h2 className="text-xs font-black uppercase tracking-wider">{title || 'REKAP DAFTAR PESANAN'}</h2>
                    <p className="text-[9px] font-bold">HIGO PONDOK</p>
                    
                    <div className="text-left text-[10px] mt-1.5 space-y-0.5 pt-1 border-t border-dotted border-gray-400">
                      <div className="flex justify-between items-start gap-1">
                        <span className="shrink-0 text-gray-700">Petugas/Kurir:</span>
                        <span className="font-bold text-right break-words">{courierName || 'Petugas'}</span>
                      </div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="shrink-0 text-gray-700">Waktu:</span>
                        <span className="text-right">{formatDateTime(new Date().toISOString())}</span>
                      </div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="shrink-0 text-gray-700">Total Pesanan:</span>
                        <span className="font-bold text-right">{filteredBatchOrders.length} Pesanan</span>
                      </div>
                    </div>
                  </div>

                  {/* RINGKASAN KEUANGAN */}
                  <div className="py-1 border-b border-dashed border-black text-[10px] space-y-1">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-gray-800">Modal Belanja (HPP):</span>
                      <span className="font-black whitespace-nowrap">Rp {formatRupiah(batchSummary.hpp)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Total Ongkir Kurir:</span>
                      <span className="whitespace-nowrap">Rp {formatRupiah(batchSummary.delivery)}</span>
                    </div>
                    <div className="flex justify-between items-center font-bold text-[10px]">
                      <span>Total Modal + Ongkir:</span>
                      <span className="font-black whitespace-nowrap">Rp {formatRupiah(batchSummary.totalModalPlusOngkir)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-gray-600 pt-0.5 border-t border-dotted border-gray-300">
                      <span>Total Tagihan Santri:</span>
                      <span className="font-bold text-black whitespace-nowrap">Rp {formatRupiah(batchSummary.grandTotal)}</span>
                    </div>
                  </div>

                  {/* DAFTAR ANTARAN DETAIL */}
                  <div className="py-1 border-b border-dashed border-black">
                    <p className="font-bold text-[10px] pb-1 border-b border-dotted border-gray-400">
                      DAFTAR PESANAN SANTRI:
                    </p>
                    <div className="pt-1.5 space-y-2 text-[10px]">
                      {filteredBatchOrders.length === 0 ? (
                        <div className="text-center py-2 text-gray-500 text-[10px]">
                          Tidak ada pesanan aktif pada daftar ini.
                        </div>
                      ) : (
                        filteredBatchOrders.map((o, idx) => {
                          const statusLabel = o.status === 'pending' ? 'Menunggu' : o.status === 'processing' ? 'Sedang Diantar' : o.status === 'completed' ? 'Selesai' : o.status;
                          const modalBelanja = getOrderModalBelanja(o);
                          return (
                            <div key={idx} className="border-b border-dotted border-gray-300 pb-1.5 space-y-0.5">
                              <div className="flex items-start justify-between gap-1 font-bold">
                                <span className="break-words leading-tight">[ ] #ORD-{o.id} {o.user?.santri_name || o.user?.name}</span>
                                <span className="shrink-0 text-right whitespace-nowrap">
                                  <span className="block font-black text-[10.5px]">Rp {formatRupiah(modalBelanja)}</span>
                                </span>
                              </div>
                              <div className="text-[9px] text-gray-700 pl-1.5 space-y-0.5">
                                <div className="flex justify-between items-center text-gray-500 text-[8.5px]">
                                  <span className="whitespace-nowrap">HPP: Rp {formatRupiah(modalBelanja)}</span>
                                  <span className="whitespace-nowrap">Santri: Rp {formatRupiah(o.total_price)}</span>
                                </div>
                                <div className="break-words">📍 {o.user?.santri_room || o.delivery_location || '-'}</div>
                                <div className="break-words">🏪 {o.canteen?.name || 'Kantin'}</div>
                                <div className="flex justify-between items-center pt-0.5 text-[8.5px]">
                                  <span className="font-semibold">{o.payment_status === 'paid' ? 'LUNAS' : 'COD / TUNAI'}</span>
                                  <span className="font-semibold text-gray-800">({statusLabel})</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className="text-center pt-1.5 text-[9px] space-y-0.5">
                    <p className="font-bold">Selamat Bertugas</p>
                    <p>Pastikan Pesanan Diterima Santri</p>
                    <p className="text-[8px] text-gray-500 pt-0.5">*** Higo Pondok System ***</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* MODAL FOOTER ACTION BUTTONS */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-800 flex gap-2 bg-white dark:bg-gray-900 no-print flex-wrap">
            <button
              onClick={onClose}
              className="flex-1 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-none font-bold text-xs transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
            >
              Tutup
            </button>
            <button
              onClick={handlePrint}
              disabled={filteredBatchOrders.length === 0 && mode === 'batch'}
              className="flex-[2] py-2 bg-green-600 hover:bg-green-700 active:scale-98 text-white rounded-none font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              {isA4
                ? (mode === 'batch' && a4Layout === 'grid'
                    ? '🖨️ Cetak / Simpan PDF (Grid 4 Struk A4)'
                    : '🖨️ Cetak / Simpan PDF (Kertas A4)')
                : `🖨️ Cetak ke Printer Thermal (${paperWidth})`}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
