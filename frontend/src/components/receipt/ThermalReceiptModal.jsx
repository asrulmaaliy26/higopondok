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

export const cleanItemNotes = (noteStr) => {
  if (!noteStr) return '';
  const noPrice = String(noteStr)
    .replace(/\s*\(\s*\+?\s*Rp?\s*[\d\.\,]+\s*\)/gi, '')
    .replace(/\s*\+\s*Rp?\s*[\d\.\,]+/gi, '')
    .trim();
  const parts = noPrice.split('•').map(s => s.trim()).filter(Boolean);
  return Array.from(new Set(parts)).join(' • ');
};

export const getSantriReceiptInfo = (user, order = null) => {
  const targetUser = user || order?.user;
  const isTeacher = Boolean(order?.order_for === 'guru' || targetUser?.is_teacher || (order?.is_priority && !targetUser?.santri_name));

  if (isTeacher) {
    return {
      isTeacher: true,
      santriName: `🎓 ${targetUser?.name || 'Guru / Staff'}`,
      santriClass: targetUser?.teacher_unit ? `Unit ${targetUser.teacher_unit}` : 'Staff Yayasan',
      santriLevel: targetUser?.niy ? `NIY: ${targetUser.niy}` : '',
      santriRoom: order?.delivery_location || `Ruang Guru ${targetUser?.teacher_unit || ''}`,
      waliName: 'Tenaga Pendidik / Staff'
    };
  }

  // Prioritas nama santri asli dari profil user atau orderan
  const rawSantriName = targetUser?.santri_name || order?.santri_name || targetUser?.name || order?.customer_name;
  const santriName = (rawSantriName && rawSantriName.trim() !== '' && rawSantriName.trim() !== '-')
    ? rawSantriName.trim()
    : (targetUser?.name || '-');
  let santriClass = targetUser?.santri_class || order?.santri_class || '';
  let santriLevel = targetUser?.santri_level || order?.santri_level || '';
  let santriRoom = targetUser?.santri_room || order?.santri_room || order?.delivery_location || '-';

  // Cocokkan ke database santri.json HANYA jika nama valid (minimal 3 huruf dan bukan tanda strip '-')
  if (santriName && santriName !== '-' && santriName.length >= 3 && santriData?.data) {
    const sName = santriName.toLowerCase().trim();
    const match = santriData.data.find(r => {
      if (!r || !r[1]) return false;
      const rawName = r[1].toLowerCase().replace(/\s+(laki-laki|perempuan)$/i, '').trim();
      return rawName === sName || (rawName.length >= 4 && sName.includes(rawName)) || (sName.length >= 4 && rawName.includes(sName));
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
    isTeacher: false,
    santriName,
    santriClass,
    santriLevel,
    santriRoom,
    waliName: targetUser?.name || order?.wali_name || '-'
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
  const [paperWidth, setPaperWidth] = useState('58mm'); // '58mm' | '80mm'
  const [a4Layout, setA4Layout] = useState('grid');
  const showPrice = false; // Struk fokus kode order, santri, kelas, asrama, menu (tanpa harga)

  React.useEffect(() => {
    if (isOpen) {
      setPaperWidth(prev => (prev === '80mm' ? '80mm' : '58mm'));
    }
  }, [isOpen]);

  // Filter batch / bundle orders: include all passed orders (except cancelled), uncompleted first
  const rawBatchOrders = Array.isArray(orders) ? orders : [];
  const filteredBatchOrders = useMemo(() => {
    if (mode !== 'batch' && mode !== 'bundle' && mode !== 'group') return [];
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

  // Deteksi otomatis apakah seluruh orders milik 1 wadah/checkout/user yang sama (Struk Gabungan 1 User)
  const isSameUserBundle = useMemo(() => {
    if (mode === 'bundle' || mode === 'group') return true;
    if (rawBatchOrders.length <= 1) return false;
    // Cek checkout_id yang sama
    const firstCheckout = rawBatchOrders[0]?.checkout_id;
    if (firstCheckout && rawBatchOrders.every(o => o.checkout_id === firstCheckout)) return true;
    // Cek user_id yang sama
    const firstUserId = rawBatchOrders[0]?.user_id || rawBatchOrders[0]?.user?.id;
    if (firstUserId && rawBatchOrders.every(o => (o.user_id || o.user?.id) === firstUserId)) return true;
    return false;
  }, [mode, rawBatchOrders]);

  const bundleUser = useMemo(() => {
    if (order?.user) return order.user;
    if (rawBatchOrders && rawBatchOrders.length > 0) {
      const found = rawBatchOrders.find(o => o?.user);
      if (found) return found.user;
      return rawBatchOrders[0]?.user;
    }
    return null;
  }, [order, rawBatchOrders]);

  // Kelompokkan seluruh order berdasarkan User / Santri (1 User = 1 Struk Utuh, Seluruh Toko Digabung)
  const groupedOrdersByUser = useMemo(() => {
    if (!filteredBatchOrders || filteredBatchOrders.length === 0) return [];
    
    const userGroups = new Map();
    
    filteredBatchOrders.forEach(o => {
      const u = o.user;
      const info = getSantriReceiptInfo(u, o);
      // Kunci unik santri: id santri/user jika ada, atau kombinasi nama dan asrama
      const userKey = u?.id || o.user_id || (info.santriName ? `${info.santriName.toLowerCase().trim()}_${(info.santriRoom || '').toLowerCase().trim()}` : `order_${o.id}`);
      
      if (!userGroups.has(userKey)) {
        userGroups.set(userKey, {
          userKey,
          user: u,
          primaryOrder: o,
          info,
          orders: []
        });
      }
      userGroups.get(userKey).orders.push(o);
    });
    
    return Array.from(userGroups.values());
  }, [filteredBatchOrders]);

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

  // Calculate consolidated bundle summary (1 Struk untuk 1 User seluruh toko)
  const bundleSummary = useMemo(() => {
    if (!isSameUserBundle) return null;
    const activeOrders = filteredBatchOrders.length > 0 ? filteredBatchOrders : rawBatchOrders;
    if (activeOrders.length === 0) return null;

    let subtotalBelanja = 0;
    let totalOngkir = 0;
    let totalAdmin = 0;
    let totalBayar = 0;
    let totalDiskon = 0;
    let totalModalHpp = 0;

    activeOrders.forEach(o => {
      const del = parseFloat(o.delivery_fee || 0);
      const adm = parseFloat(o.admin_fee || 0);
      const tot = parseFloat(o.total_price || 0);
      const disc = parseFloat(o.voucher_discount ?? (o.voucher?.discount_amount ?? 0));
      totalModalHpp += getOrderModalBelanja(o);

      let itemsSub = 0;
      if (o.items && o.items.length > 0) {
        itemsSub = o.items.reduce((s, it) => s + parseFloat(it.subtotal || (parseFloat(it.price || 0) * (it.quantity || 1))), 0);
      } else {
        itemsSub = Math.max(0, tot - del - adm);
      }

      subtotalBelanja += itemsSub;
      totalOngkir += del;
      totalAdmin += adm;
      totalBayar += tot;
      totalDiskon += disc;
    });

    const isAllPaid = activeOrders.every(o => o.payment_status === 'paid');
    const isAnyWaiting = activeOrders.some(o => o.payment_status === 'waiting_confirmation');
    const paymentStatusText = isAllPaid ? 'LUNAS' : isAnyWaiting ? 'VERIFIKASI' : 'BELUM LUNAS';

    const checkoutId = activeOrders[0]?.checkout_id || null;
    const orderIds = activeOrders.map(o => `#ORD-${o.id}`).join(', ');

    return {
      ordersCount: activeOrders.length,
      checkoutId,
      orderIds,
      subtotalBelanja,
      totalOngkir,
      totalAdmin,
      totalBayar,
      totalDiskon,
      totalModalHpp,
      isAllPaid,
      paymentStatusText,
      created_at: activeOrders[0]?.created_at
    };
  }, [isSameUserBundle, filteredBatchOrders, rawBatchOrders]);

  // Calculate batch summaries (Kurir multi-santri run-sheet)
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
            font-size: ${isA4 ? '9.5pt' : paperWidth === '58mm' ? '10pt' : '11.5pt'} !important;
            line-height: ${isA4 ? '1.35' : '1.25'} !important;
            box-shadow: none !important;
            border: none !important;
            word-break: ${isA4 ? 'normal' : 'break-word'} !important;
            overflow-wrap: break-word !important;
          }
          .thermal-header-title {
            font-size: ${paperWidth === '58mm' ? '15pt' : '18pt'} !important;
            font-weight: 900 !important;
            line-height: 1.2 !important;
          }
          .thermal-header-sub {
            font-size: ${paperWidth === '58mm' ? '10pt' : '11.5pt'} !important;
            font-weight: 700 !important;
          }
          .thermal-order-code {
            font-size: ${paperWidth === '58mm' ? '14pt' : '17pt'} !important;
            font-weight: 900 !important;
            line-height: 1.2 !important;
          }
          .thermal-santri-name {
            font-size: ${paperWidth === '58mm' ? '14pt' : '17pt'} !important;
            font-weight: 900 !important;
            line-height: 1.2 !important;
          }
          .thermal-santri-meta {
            font-size: ${paperWidth === '58mm' ? '11pt' : '13pt'} !important;
            font-weight: 800 !important;
            line-height: 1.25 !important;
          }
          .thermal-menu-header {
            font-size: ${paperWidth === '58mm' ? '11pt' : '13pt'} !important;
            font-weight: 900 !important;
          }
          .thermal-store-header {
            font-size: ${paperWidth === '58mm' ? '11.5pt' : '13.5pt'} !important;
            font-weight: 900 !important;
          }
          .thermal-menu-item {
            font-size: ${paperWidth === '58mm' ? '12pt' : '14pt'} !important;
            font-weight: 900 !important;
            line-height: 1.25 !important;
          }
          .thermal-menu-note {
            font-size: ${paperWidth === '58mm' ? '10pt' : '11.5pt'} !important;
            font-style: italic !important;
            font-weight: 700 !important;
          }
          .thermal-footer {
            font-size: ${paperWidth === '58mm' ? '10.5pt' : '12pt'} !important;
            font-weight: 700 !important;
          }
          .a4-grid-container {
            display: flex !important;
            flex-direction: column !important;
            gap: 8mm !important;
            width: 100% !important;
          }
          .a4-receipt-card {
            border: 2px dashed #000000 !important;
            border-radius: 0px !important;
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
                  {title || (isSameUserBundle ? `Struk Wadah (${bundleSummary?.ordersCount || filteredBatchOrders.length} Toko)` : mode === 'batch' ? `Rekap Pesanan (${filteredBatchOrders.length} Pesanan)` : `Struk Pesanan #ORD-${order?.id}`)}
                </h3>
                <p className="text-[10px] text-gray-500">
                  {isA4
                    ? (isSameUserBundle
                        ? 'Format Kertas A4 (PDF) • Invoice Resmi Wadah Pemesan'
                        : mode === 'batch' && a4Layout === 'grid'
                        ? 'Format Kertas A4 (PDF) • Slip Struk Kasir Siap Gunting'
                        : 'Format Dokumen / Kertas A4 (PDF)')
                    : `Format Printer Thermal (${paperWidth})`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Paper Size Selector (58mm, 80mm) */}
              <div className="flex bg-gray-200 dark:bg-gray-700 p-0.5 rounded-none text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setPaperWidth('58mm')}
                  className={`px-2.5 py-1 rounded-none transition-all cursor-pointer ${
                    paperWidth === '58mm'
                      ? 'bg-green-600 text-white shadow-xs font-black'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 font-semibold'
                  }`}
                  title="Printer Thermal 58mm (iWare / Mini POS)"
                >
                  58mm
                </button>
                <button
                  type="button"
                  onClick={() => setPaperWidth('80mm')}
                  className={`px-2.5 py-1 rounded-none transition-all cursor-pointer ${
                    paperWidth === '80mm'
                      ? 'bg-green-600 text-white shadow-xs font-black'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 font-semibold'
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
                width: isA4 ? '100%' : paperWidth === '58mm' ? '280px' : '360px',
                maxWidth: isA4 ? '900px' : undefined
              }}
              className={`thermal-receipt-printable bg-white text-black rounded-none shadow-xl border border-gray-300 box-border shrink-0 min-h-fit my-1 ${
                isA4 ? 'p-4 sm:p-6 font-sans text-xs' : 'p-3.5 font-mono text-xs leading-normal'
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
                      const info = getSantriReceiptInfo(order.user, order);
                      return (
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            {info.isTeacher ? 'DATA GURU / TENAGA PENDIDIK:' : 'DATA SANTRI / PEMESAN:'}
                          </p>
                          <p className="text-sm font-bold text-gray-900">
                            {info.santriName}
                          </p>
                          {!info.isTeacher && info.waliName && (
                            <p className="text-gray-600">
                              <span className="font-semibold">Wali:</span> {info.waliName}
                            </p>
                          )}
                          <p className="text-gray-600">
                            <span className="font-semibold">{info.isTeacher ? 'Ruang Kantor / Meja:' : 'Asrama / Kamar:'}</span> {info.santriRoom}
                          </p>
                          {(info.santriClass || info.santriLevel) && (
                            <p className="text-gray-600">
                              <span className="font-semibold">{info.isTeacher ? 'Unit / Identitas:' : 'Kelas:'}</span> {info.santriClass} {info.santriLevel ? `(${info.santriLevel})` : ''}
                            </p>
                          )}
                          {order.delivery_location && !info.isTeacher && (
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
                                  {item.notes && <span className="block text-[11px] text-gray-500 font-normal italic">Catatan: {cleanItemNotes(item.notes)}</span>}
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
              {/* 2. FORMAT A4: BUNDLE ORDER INVOICE (1 USER BANYAK TOKO / CHECKOUT GABUNGAN) */}
              {/* ========================================================================= */}
              {isA4 && isSameUserBundle && bundleSummary && (
                <div className="space-y-5 text-gray-900">
                  {/* KOP RESMI A4 */}
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
                          Invoice / Bukti Pemesanan Gabungan Wadah ({bundleSummary.ordersCount} Toko)
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-3 py-1 bg-green-700 text-white font-black text-xs rounded-none uppercase tracking-wider">
                          INVOICE WADAH
                        </span>
                        <p className="text-sm font-bold text-gray-900 mt-1 font-mono">
                          {bundleSummary.checkoutId || `WADAH (${bundleSummary.ordersCount} TOKO)`}
                        </p>
                        <p className="text-[11px] text-gray-500">{formatDateTime(bundleSummary.created_at)}</p>
                      </div>
                    </div>
                  </div>

                  {/* GRID INFORMASI: SANTRI PEMESAN & PENGANTARAN (1 KALI) */}
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-none border border-gray-200 text-xs">
                    {/* Kolom 1: Info Pemesan */}
                    {(() => {
                      const primaryOrder = filteredBatchOrders[0] || rawBatchOrders[0];
                      const targetUser = bundleUser || primaryOrder?.user;
                      const info = getSantriReceiptInfo(targetUser, primaryOrder);
                      const asrama = (info.santriRoom && info.santriRoom !== '-') ? info.santriRoom : (primaryOrder?.delivery_location || '-');
                      const kelas = info.santriClass || (info.santriLevel ? `Kelas ${info.santriLevel}` : (info.isTeacher ? 'Guru / Staff' : '-'));

                      return (
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            {info.isTeacher ? 'DATA GURU / TENAGA PENDIDIK:' : 'DATA SANTRI / PENERIMA:'}
                          </p>
                          <p className="text-sm font-black text-gray-900 uppercase">
                            👤 {info.santriName}
                          </p>
                          {!info.isTeacher && info.waliName && info.waliName !== '-' && (
                            <p className="text-gray-600">
                              <span className="font-semibold">Wali:</span> {info.waliName}
                            </p>
                          )}
                          <p className="text-gray-600">
                            <span className="font-semibold">{info.isTeacher ? 'Ruang Guru / Meja:' : 'Kamar / Asrama:'}</span> {asrama}
                          </p>
                          {(kelas && kelas !== '-') && (
                            <p className="text-gray-600">
                              <span className="font-semibold">{info.isTeacher ? 'Unit:' : 'Kelas:'}</span> {kelas}
                            </p>
                          )}
                          {primaryOrder?.delivery_location && primaryOrder.delivery_location !== asrama && (
                            <p className="text-gray-600">
                              <span className="font-semibold">Tujuan Antar:</span> {primaryOrder.delivery_location}
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Kolom 2: Info Pesanan & Status */}
                    <div className="space-y-1 text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">INFO PENGIRIMAN & PEMBAYARAN:</p>
                      <p className="text-xs font-bold text-gray-700">
                        Total: <span className="text-black font-black">{bundleSummary.ordersCount} Toko / Kantin</span>
                      </p>
                      <p className="text-[11px] text-gray-600 font-mono">
                        {bundleSummary.orderIds}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-semibold">Kurir:</span> {courierName || 'Petugas Kurir Pondok'}
                      </p>
                      <div className="pt-1 flex items-center justify-end gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-none font-bold text-[10px] uppercase border ${
                          bundleSummary.isAllPaid
                            ? 'bg-green-100 text-green-800 border-green-300'
                            : 'bg-red-100 text-red-800 border-red-300'
                        }`}>
                          {bundleSummary.isAllPaid ? '✅ Lunas' : `⚠️ ${bundleSummary.paymentStatusText}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* TABEL RINCIAN SEMUA ITEM PER TOKO */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse border border-gray-200">
                      <thead>
                        <tr className="border-b-2 border-gray-800 text-[11px] font-bold uppercase text-gray-700 bg-gray-100">
                          <th className="py-2.5 px-3 w-[40px] text-center shrink-0 border-r border-gray-200">No</th>
                          <th className="py-2.5 px-3 w-[140px] border-r border-gray-200">Toko / Kantin</th>
                          <th className="py-2.5 px-3 min-w-[180px] border-r border-gray-200">Menu / Produk</th>
                          <th className="py-2.5 px-3 text-center w-[60px] shrink-0 border-r border-gray-200">Jumlah</th>
                          <th className="py-2.5 px-3 text-right w-[120px] shrink-0 border-r border-gray-200">Harga Satuan</th>
                          <th className="py-2.5 px-3 text-right w-[120px] shrink-0">Total Harga</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 text-xs">
                        {(() => {
                          let counter = 1;
                          const rows = [];
                          filteredBatchOrders.forEach((o, oIdx) => {
                            if (o.items && o.items.length > 0) {
                              o.items.forEach((item, itemIdx) => {
                                const qty = item.quantity || 1;
                                const price = parseFloat(item.price || 0);
                                const sub = parseFloat(item.subtotal || price * qty);
                                rows.push(
                                  <tr key={`${oIdx}-${itemIdx}`} className="hover:bg-gray-50">
                                    <td className="py-2.5 px-3 text-center text-gray-500 border-r border-gray-200 font-medium">{counter++}</td>
                                    <td className="py-2.5 px-3 border-r border-gray-200 font-bold text-gray-800">
                                      🏪 {o.canteen?.name || 'Kantin'}
                                      <span className="block text-[10px] font-mono text-gray-500 font-normal">#ORD-{o.id}</span>
                                    </td>
                                    <td className="py-2.5 px-3 border-r border-gray-200 font-semibold text-gray-900">
                                      {item.product?.name || item.product_name || 'Produk'}
                                      {item.notes && <span className="block text-[11px] text-gray-500 font-normal italic">Catatan: {cleanItemNotes(item.notes)}</span>}
                                    </td>
                                    <td className="py-2.5 px-3 text-center border-r border-gray-200 font-bold">{qty}</td>
                                    <td className="py-2.5 px-3 text-right border-r border-gray-200">Rp {formatRupiah(price)}</td>
                                    <td className="py-2.5 px-3 text-right font-bold text-gray-900">Rp {formatRupiah(sub)}</td>
                                  </tr>
                                );
                              });
                            } else {
                              rows.push(
                                <tr key={`${oIdx}-custom`} className="hover:bg-gray-50">
                                  <td className="py-2.5 px-3 text-center text-gray-500 border-r border-gray-200 font-medium">{counter++}</td>
                                  <td className="py-2.5 px-3 border-r border-gray-200 font-bold text-gray-800">
                                    🏪 {o.canteen?.name || 'Kantin'}
                                    <span className="block text-[10px] font-mono text-gray-500 font-normal">#ORD-{o.id}</span>
                                  </td>
                                  <td className="py-2.5 px-3 border-r border-gray-200 font-semibold text-gray-900">
                                    {o.custom_notes || 'Pesanan Khusus / Titip Beli'}
                                  </td>
                                  <td className="py-2.5 px-3 text-center border-r border-gray-200 font-bold">1</td>
                                  <td className="py-2.5 px-3 text-right border-r border-gray-200">Rp {formatRupiah(o.total_price)}</td>
                                  <td className="py-2.5 px-3 text-right font-bold text-gray-900">Rp {formatRupiah(o.total_price)}</td>
                                </tr>
                              );
                            }
                          });
                          return rows;
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* RINGKASAN PEMBAYARAN */}
                  <div className="flex justify-end pt-2">
                    <div className="w-80 space-y-2 bg-gray-50 p-4 rounded-none border border-gray-200 text-xs">
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal Belanja:</span>
                        <span className="font-semibold text-gray-900">Rp {formatRupiah(bundleSummary.subtotalBelanja)}</span>
                      </div>
                      {bundleSummary.totalDiskon > 0 && (
                        <div className="flex justify-between text-red-600 font-semibold">
                          <span>Diskon Voucher:</span>
                          <span>-Rp {formatRupiah(bundleSummary.totalDiskon)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-gray-600">
                        <span>Ongkos Kirim Kurir:</span>
                        <span className="font-semibold text-gray-900">Rp {formatRupiah(bundleSummary.totalOngkir)}</span>
                      </div>
                      {bundleSummary.totalAdmin > 0 && (
                        <div className="flex justify-between text-gray-600">
                          <span>Biaya Layanan/Admin:</span>
                          <span className="font-semibold text-gray-900">Rp {formatRupiah(bundleSummary.totalAdmin)}</span>
                        </div>
                      )}
                      <div className="border-t border-gray-300 pt-2 flex justify-between font-black text-sm text-gray-900">
                        <span>TOTAL AKHIR:</span>
                        <span className="text-green-700">Rp {formatRupiah(bundleSummary.totalBayar)}</span>
                      </div>
                    </div>
                  </div>

                  {/* AREA TTD / PARAF PENERIMAAN */}
                  <div className="pt-4 border-t border-gray-200 grid grid-cols-2 gap-8 text-center text-xs">
                    <div>
                      <p className="text-gray-500 font-semibold mb-10">Petugas Pengantar / Kurir</p>
                      <p className="font-bold text-gray-900 underline">{courierName || '( ........................................ )'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-semibold mb-10">Penerima / Santri</p>
                      <p className="font-bold text-gray-900 underline">( ........................................ )</p>
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className="text-center pt-3 border-t border-dotted border-gray-300 text-[10px] text-gray-400">
                    Dokumen ini sah dan dicetak secara otomatis dari sistem Higo Pondok pada {formatDateTime(new Date().toISOString())}.
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* 3. FORMAT A4: BATCH RECAP / SLIP STRUK (KERTAS A4 / PDF UNTUK BANYAK SANTRI)*/}
              {/* ========================================================================= */}
              {isA4 && !isSameUserBundle && (mode === 'batch' || mode === 'bundle') && (
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
                        {groupedOrdersByUser.length === 0 ? (
                          <div className="py-12 text-center text-gray-500 font-bold font-mono text-base">
                            Tidak ada data pesanan aktif untuk filter saat ini.
                          </div>
                        ) : (
                          groupedOrdersByUser.map((group, idx) => {
                            const info = group.info;
                            const primaryOrder = group.primaryOrder;
                            const asrama = (info.santriRoom && info.santriRoom !== '-') ? info.santriRoom : (primaryOrder?.delivery_location || '-');
                            const kelas = info.santriClass || (info.santriLevel ? `Kelas ${info.santriLevel}` : (info.isTeacher ? 'Guru / Staff' : '-'));
                            const orderCodes = group.orders.map(o => `#ORD-${o.id}`).join(', ');

                            return (
                              <div 
                                key={idx} 
                                className="a4-receipt-card border-2 border-dashed border-black rounded-none p-5 sm:p-6 bg-white text-black font-mono shadow-sm relative flex flex-col space-y-3 w-full"
                              >
                                {/* HEADER STRUK */}
                                <div className="text-center pb-3 border-b-2 border-dashed border-black">
                                  <div className="flex justify-between items-center text-xs sm:text-sm font-bold text-gray-700">
                                    <span className="bg-black text-white px-2.5 py-0.5 rounded-none text-xs sm:text-sm font-black tracking-wider">
                                      {group.orders.length > 1 ? `WADAH (${group.orders.length} TOKO)` : orderCodes}
                                    </span>
                                    <span className="font-mono">{formatDateTime(primaryOrder.created_at)}</span>
                                  </div>
                                  <h3 className="font-black text-xl sm:text-2xl uppercase tracking-widest text-black mt-2">
                                    HIGO PONDOK
                                  </h3>
                                  <p className="text-xs sm:text-sm font-bold text-gray-700 tracking-wide mt-0.5">
                                    {info.isTeacher ? 'LAYANAN PESAN ANTAR GURU & STAFF' : 'LAYANAN PESAN ANTAR SANTRI'}
                                  </p>
                                </div>

                                {/* DATA SANTRI & TUJUAN ANTAR */}
                                <div className="py-2 border-b-2 border-dashed border-black space-y-1.5 text-xs sm:text-sm">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="shrink-0 text-gray-700 font-bold">
                                      {info.isTeacher ? 'Penerima / Guru :' : 'Penerima / Santri :'}
                                    </span>
                                    <span className="font-black text-right break-words text-black text-sm sm:text-base uppercase">
                                      {info.santriName}
                                    </span>
                                  </div>
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="shrink-0 text-gray-700 font-bold">
                                      {info.isTeacher ? 'Ruang / Meja      :' : 'Kamar / Asrama     :'}
                                    </span>
                                    <span className="font-black text-right break-words text-black text-sm sm:text-base">
                                      📍 {asrama}
                                    </span>
                                  </div>
                                  {(info.santriClass || info.santriLevel) && (
                                    <div className="flex items-start justify-between gap-2 text-xs text-gray-600">
                                      <span className="shrink-0">
                                        {info.isTeacher ? 'Unit / Identitas  :' : 'Kelas / Jenjang   :'}
                                      </span>
                                      <span className="text-right font-bold">{kelas}</span>
                                    </div>
                                  )}
                                  {info.waliName && info.waliName !== '-' && (
                                    <div className="flex items-start justify-between gap-2 text-xs text-gray-600">
                                      <span className="shrink-0">Wali Santri       :</span>
                                      <span className="text-right font-bold">{info.waliName}</span>
                                    </div>
                                  )}
                                  {primaryOrder?.delivery_location && primaryOrder.delivery_location !== asrama && (
                                    <div className="flex items-start justify-between gap-2 text-xs text-gray-800">
                                      <span className="shrink-0">Tujuan Antar      :</span>
                                      <span className="text-right font-bold">{primaryOrder.delivery_location}</span>
                                    </div>
                                  )}
                                </div>

                                {/* DAFTAR MENU DARI SELURUH TOKO */}
                                <div className="py-2 border-b-2 border-dashed border-black text-xs sm:text-sm space-y-3">
                                  <div className="font-black text-xs sm:text-sm text-black pb-1.5 border-b border-black tracking-wider uppercase">
                                    RINCIAN MENU ({group.orders.length} TOKO):
                                  </div>
                                  {group.orders.map((o, storeIdx) => (
                                    <div key={storeIdx} className="space-y-1">
                                      <div className="flex justify-between items-center bg-gray-100 px-2 py-1 border border-black text-xs sm:text-sm font-black">
                                        <span>🏪 {o.canteen?.name || 'Kantin'}</span>
                                        <span className="font-mono text-xs">#ORD-{o.id}</span>
                                      </div>
                                      <div className="pl-2 space-y-1 pt-1">
                                        {o.items && o.items.length > 0 ? (
                                          o.items.map((item, itIdx) => {
                                            const qty = item.quantity || 1;
                                            return (
                                              <div key={itIdx} className="space-y-0.5">
                                                <div className="flex justify-between items-start gap-2 text-sm sm:text-base font-black">
                                                  <span className="break-words leading-tight">{qty}x {item.product?.name || 'Produk'}</span>
                                                </div>
                                                {item.notes && (
                                                  <div className="text-xs italic text-gray-800 pl-2 border-l-2 border-black ml-1">
                                                    Catatan: {cleanItemNotes(item.notes)}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })
                                        ) : (
                                          <div className="text-sm sm:text-base font-black">
                                            • 1x {o.custom_notes || 'Pesanan Khusus / Titip Beli'}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
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
                <div className="space-y-2 bg-white text-black">
                  {/* HEADER */}
                  <div className="text-center pb-2 border-b-2 border-dashed border-black">
                    <h2 className="thermal-header-title text-lg sm:text-xl font-black uppercase tracking-wider">HIGO PONDOK</h2>
                    <p className="thermal-header-sub text-xs sm:text-sm font-bold text-gray-800">Layanan Pesan Antar Santri</p>
                    
                    {/* KODE ORDERAN (BESAR & TEBAL) */}
                    <div className="mt-2 py-1 px-3 border-2 border-black inline-block bg-black text-white">
                      <span className="thermal-order-code text-base sm:text-lg font-black tracking-wider">
                        #ORD-{order.id}
                      </span>
                    </div>

                    <div className="text-left text-xs sm:text-sm mt-2 space-y-0.5 pt-1.5 border-t border-dotted border-gray-400">
                      <div className="flex justify-between items-start gap-1">
                        <span className="shrink-0 text-gray-700 font-medium">Waktu:</span>
                        <span className="font-semibold text-right">{formatDateTime(order.created_at)}</span>
                      </div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="shrink-0 text-gray-700 font-medium">Toko:</span>
                        <span className="font-bold text-right break-words">{order.canteen?.name || 'Kantin Pondok'}</span>
                      </div>
                      {order.courier?.name && (
                        <div className="flex justify-between items-start gap-1">
                          <span className="shrink-0 text-gray-700 font-medium">Kurir:</span>
                          <span className="font-semibold text-right break-words">{order.courier.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* DATA SANTRI, KELAS, ASRAMA (BESAR & JELAS) */}
                  {(() => {
                    const info = getSantriReceiptInfo(order.user, order);
                    const asrama = (info.santriRoom && info.santriRoom !== '-') ? info.santriRoom : (order.delivery_location || '-');
                    const kelas = info.santriClass || (info.santriLevel ? `Kelas ${info.santriLevel}` : (info.isTeacher ? 'Guru / Staff' : '-'));

                    return (
                      <div className="py-2 border-b-2 border-dashed border-black space-y-1">
                        <div className="thermal-santri-name text-base sm:text-lg font-black text-black uppercase leading-tight">
                          👤 {info.santriName}
                        </div>
                        <div className="thermal-santri-meta text-xs sm:text-sm font-bold text-black flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-snug">
                          <span>🏫 Kelas: <strong className="font-black">{kelas}</strong></span>
                          <span>•</span>
                          <span>📍 Asrama: <strong className="font-black">{asrama}</strong></span>
                        </div>
                        {info.waliName && info.waliName !== '-' && (
                          <div className="text-xs sm:text-sm font-semibold text-gray-800">
                            Wali: {info.waliName}
                          </div>
                        )}
                        {order.delivery_location && order.delivery_location !== asrama && (
                          <div className="text-xs font-semibold text-gray-800">
                            🎯 Tujuan Antar: {order.delivery_location}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* DAFTAR MENU (BESAR, JELAS & LENGKAP - TANPA HARGA) */}
                  <div className="py-2 border-b-2 border-dashed border-black">
                    <div className="thermal-menu-header flex justify-between font-black text-xs sm:text-sm pb-1 border-b border-black tracking-wider uppercase">
                      <span>DAFTAR MENU:</span>
                    </div>
                    <div className="pt-2 space-y-2">
                      {order.items && order.items.length > 0 ? (
                        order.items.map((item, idx) => {
                          const qty = item.quantity || 1;
                          const prodName = item.product?.name || item.product_name || 'Produk';
                          return (
                            <div key={idx} className="space-y-0.5">
                              <div className="thermal-menu-item text-sm sm:text-base font-black text-black leading-tight flex items-start gap-1">
                                <span className="shrink-0 font-black">{qty}x</span>
                                <span className="break-words font-black">{prodName}</span>
                              </div>
                              {item.notes && (
                                <div className="thermal-menu-note text-xs sm:text-sm font-bold italic text-black pl-3 border-l-2 border-black ml-1">
                                  ↳ Catatan: {cleanItemNotes(item.notes)}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="thermal-menu-item text-sm sm:text-base font-black text-black leading-tight">
                          • 1x {order.custom_notes || 'Pesanan Khusus / Titip Beli'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className="text-center pt-2.5 text-xs space-y-1">
                    <p className="thermal-footer font-bold text-black text-xs sm:text-sm">Terima Kasih</p>
                    <p className="text-[11px] sm:text-xs text-gray-800">Semoga Berkah & Bermanfaat</p>
                    <p className="text-[10px] text-gray-500 pt-0.5">*** Higo Pondok ***</p>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* 4. FORMAT THERMAL: BUNDLE / GABUNGAN 1 USER (58mm / 80mm THERMAL RECEIPT) */}
              {/* ========================================================================= */}
              {!isA4 && isSameUserBundle && bundleSummary && (
                <div className="space-y-2 bg-white text-black">
                  {/* HEADER */}
                  <div className="text-center pb-2 border-b-2 border-dashed border-black">
                    <h2 className="thermal-header-title text-lg sm:text-xl font-black uppercase tracking-wider">HIGO PONDOK</h2>
                    <p className="thermal-header-sub text-xs sm:text-sm font-bold text-gray-800">Layanan Pesan Antar Santri</p>

                    {/* KODE WADAH / CHECKOUT */}
                    <div className="mt-2 py-1 px-3 border-2 border-black inline-block bg-black text-white">
                      <span className="thermal-order-code text-sm sm:text-base font-black tracking-wider block">
                        {bundleSummary.checkoutId || `WADAH (${bundleSummary.ordersCount} TOKO)`}
                      </span>
                    </div>

                    <div className="text-left text-xs sm:text-sm mt-2 space-y-0.5 pt-1.5 border-t border-dotted border-gray-400">
                      <div className="flex justify-between items-start gap-1">
                        <span className="shrink-0 text-gray-700 font-medium">Order ID:</span>
                        <span className="font-bold text-right font-mono text-xs break-words">{bundleSummary.orderIds}</span>
                      </div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="shrink-0 text-gray-700 font-medium">Waktu:</span>
                        <span className="font-semibold text-right">{formatDateTime(bundleSummary.created_at)}</span>
                      </div>
                      {courierName && (
                        <div className="flex justify-between items-start gap-1">
                          <span className="shrink-0 text-gray-700 font-medium">Kurir:</span>
                          <span className="font-semibold text-right break-words">{courierName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* DATA SANTRI, KELAS, ASRAMA (DITAMPILKAN 1 KALI SAJA) */}
                  {(() => {
                    const primaryOrder = filteredBatchOrders[0] || rawBatchOrders[0];
                    const targetUser = bundleUser || primaryOrder?.user;
                    const info = getSantriReceiptInfo(targetUser, primaryOrder);
                    const asrama = (info.santriRoom && info.santriRoom !== '-') ? info.santriRoom : (primaryOrder?.delivery_location || '-');
                    const kelas = info.santriClass || (info.santriLevel ? `Kelas ${info.santriLevel}` : (info.isTeacher ? 'Guru / Staff' : '-'));

                    return (
                      <div className="py-2 border-b-2 border-dashed border-black space-y-1">
                        <div className="thermal-santri-name text-base sm:text-lg font-black text-black uppercase leading-tight">
                          👤 {info.santriName}
                        </div>
                        <div className="thermal-santri-meta text-xs sm:text-sm font-bold text-black flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-snug">
                          <span>🏫 Kelas: <strong className="font-black">{kelas}</strong></span>
                          <span>•</span>
                          <span>📍 Asrama: <strong className="font-black">{asrama}</strong></span>
                        </div>
                        {info.waliName && info.waliName !== '-' && (
                          <div className="text-xs sm:text-sm font-semibold text-gray-800">
                            Wali: {info.waliName}
                          </div>
                        )}
                        {primaryOrder?.delivery_location && primaryOrder.delivery_location !== asrama && (
                          <div className="text-xs font-semibold text-gray-800">
                            🎯 Tujuan: {primaryOrder.delivery_location}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* DAFTAR MENU GABUNGAN SELURUH TOKO (TANPA HARGA) */}
                  <div className="py-2 border-b-2 border-dashed border-black">
                    <div className="thermal-menu-header flex justify-between font-black text-xs sm:text-sm pb-1.5 border-b border-black tracking-wider uppercase">
                      <span>RINCIAN MENU ({bundleSummary.ordersCount} TOKO):</span>
                    </div>
                    <div className="pt-2 space-y-3">
                      {filteredBatchOrders.map((o, storeIdx) => (
                        <div key={storeIdx} className="space-y-1.5">
                          {/* Header Toko */}
                          <div className="thermal-store-header flex items-center justify-between text-xs sm:text-sm font-black uppercase tracking-wider bg-gray-100 px-2 py-1 border border-black">
                            <span>🏪 {o.canteen?.name || 'Kantin'}</span>
                            <span className="font-mono text-xs">#ORD-{o.id}</span>
                          </div>

                          {/* Items Menu */}
                          <div className="pl-1 space-y-1 pt-0.5">
                            {o.items && o.items.length > 0 ? (
                              o.items.map((item, itemIdx) => {
                                const qty = item.quantity || 1;
                                const prodName = item.product?.name || item.product_name || 'Produk';
                                return (
                                  <div key={itemIdx} className="space-y-0.5">
                                    <div className="thermal-menu-item text-sm sm:text-base font-black text-black leading-tight flex items-start gap-1">
                                      <span className="shrink-0 font-black">{qty}x</span>
                                      <span className="break-words font-black">{prodName}</span>
                                    </div>
                                    {item.notes && (
                                      <div className="thermal-menu-note text-xs sm:text-sm font-bold italic text-black pl-3 border-l-2 border-black ml-1">
                                        ↳ Catatan: {cleanItemNotes(item.notes)}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="thermal-menu-item text-sm sm:text-base font-black text-black leading-tight">
                                • 1x {o.custom_notes || 'Pesanan Khusus / Titip Beli'}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className="text-center pt-2.5 text-xs space-y-1">
                    <p className="thermal-footer font-bold text-black text-xs sm:text-sm">Terima Kasih</p>
                    <p className="text-[11px] sm:text-xs text-gray-800">Semoga Berkah & Bermanfaat</p>
                    <p className="text-[10px] text-gray-500 pt-0.5">*** Higo Pondok ***</p>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* 5. FORMAT THERMAL: BATCH RECAP (58mm / 80mm THERMAL MANIFEST PER SANTRI)  */}
              {/* ========================================================================= */}
              {!isA4 && !isSameUserBundle && (mode === 'batch' || mode === 'bundle') && (
                <div className="space-y-2 bg-white text-black">
                  {/* HEADER */}
                  <div className="text-center pb-2 border-b-2 border-dashed border-black">
                    <h2 className="thermal-header-title text-base sm:text-lg font-black uppercase tracking-wider">
                      {title || 'REKAP SEMUA PESANAN'}
                    </h2>
                    <p className="thermal-header-sub text-xs sm:text-sm font-bold text-gray-800">
                      HIGO PONDOK • Layanan Pesan Antar Santri
                    </p>
                    
                    <div className="text-left text-xs sm:text-sm mt-2 space-y-0.5 pt-1.5 border-t border-dotted border-gray-400">
                      <div className="flex justify-between items-start gap-1">
                        <span className="shrink-0 text-gray-700 font-medium">Petugas/Kurir:</span>
                        <span className="font-bold text-right break-words">{courierName || 'Administrator'}</span>
                      </div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="shrink-0 text-gray-700 font-medium">Waktu:</span>
                        <span className="text-right">{formatDateTime(new Date().toISOString())}</span>
                      </div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="shrink-0 text-gray-700 font-medium">Total Santri:</span>
                        <span className="font-black text-right">{groupedOrdersByUser.length} Santri ({filteredBatchOrders.length} Pesanan)</span>
                      </div>
                    </div>
                  </div>

                  {/* DAFTAR ANTARAN PER SANTRI (FOKUS: NAMA SANTRI, KELAS, ASRAMA, TIAP TOKO & MENU - TANPA HARGA) */}
                  <div className="py-1">
                    <p className="thermal-menu-header font-black text-xs sm:text-sm pb-1.5 border-b-2 border-black tracking-wide uppercase">
                      DAFTAR PESANAN SANTRI ({groupedOrdersByUser.length} SANTRI):
                    </p>
                    <div className="pt-2 divide-y-2 divide-dashed divide-black">
                      {groupedOrdersByUser.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 font-bold text-xs">
                          Tidak ada pesanan aktif pada daftar ini.
                        </div>
                      ) : (
                        groupedOrdersByUser.map((group, grpIdx) => {
                          const info = group.info;
                          const primaryOrder = group.primaryOrder;
                          const asrama = (info.santriRoom && info.santriRoom !== '-') ? info.santriRoom : (primaryOrder?.delivery_location || '-');
                          const kelas = info.santriClass || (info.santriLevel ? `Kelas ${info.santriLevel}` : (info.isTeacher ? 'Guru / Staff' : '-'));

                          return (
                            <div key={grpIdx} className="py-3 space-y-2 break-inside-avoid">
                              {/* 1. DATA SANTRI (BESAR & TEBAL) */}
                              <div className="space-y-0.5">
                                <div className="thermal-santri-name text-base sm:text-lg font-black text-black uppercase leading-tight">
                                  👤 {info.santriName}
                                </div>
                                <div className="thermal-santri-meta text-xs sm:text-sm font-bold text-black flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-snug">
                                  <span>🏫 Kelas: <strong className="font-black">{kelas}</strong></span>
                                  <span>•</span>
                                  <span>📍 Asrama: <strong className="font-black">{asrama}</strong></span>
                                </div>
                                {info.waliName && info.waliName !== '-' && (
                                  <div className="text-xs sm:text-sm font-semibold text-gray-800">
                                    Wali: {info.waliName}
                                  </div>
                                )}
                                {primaryOrder?.delivery_location && primaryOrder.delivery_location !== asrama && (
                                  <div className="text-xs font-semibold text-gray-800">
                                    🎯 Tujuan: {primaryOrder.delivery_location}
                                  </div>
                                )}
                              </div>

                              {/* 2. RINCIAN MENU DARI SEMUA TOKO SANTRI INI */}
                              <div className="space-y-2">
                                <div className="thermal-menu-header text-xs sm:text-sm font-black uppercase tracking-wider text-black border-b border-black pb-0.5">
                                  RINCIAN MENU ({group.orders.length} TOKO):
                                </div>
                                {group.orders.map((o, storeIdx) => (
                                  <div key={storeIdx} className="space-y-1">
                                    {/* Header Toko */}
                                    <div className="thermal-store-header flex items-center justify-between text-xs sm:text-sm font-black uppercase tracking-wider bg-gray-100 px-2 py-1 border border-black">
                                      <span>🏪 {o.canteen?.name || 'Kantin'}</span>
                                      <span className="font-mono text-xs">#ORD-{o.id}</span>
                                    </div>

                                    {/* Items Menu */}
                                    <div className="pl-1 space-y-1 pt-0.5">
                                      {o.items && o.items.length > 0 ? (
                                        o.items.map((item, itIdx) => {
                                          const qty = item.quantity || 1;
                                          const prodName = item.product?.name || item.product_name || 'Produk';
                                          return (
                                            <div key={itIdx} className="space-y-0.5">
                                              <div className="thermal-menu-item text-sm sm:text-base font-black text-black leading-tight flex items-start gap-1">
                                                <span className="shrink-0 font-black">{qty}x</span>
                                                <span className="break-words font-black">{prodName}</span>
                                              </div>
                                              {item.notes && (
                                                <div className="thermal-menu-note text-xs sm:text-sm font-bold italic text-black pl-3 border-l-2 border-black ml-1">
                                                  ↳ Catatan: {cleanItemNotes(item.notes)}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <div className="thermal-menu-item text-sm sm:text-base font-black text-black leading-tight">
                                          • 1x {o.custom_notes || 'Pesanan Khusus / Titip Beli'}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className="text-center pt-2.5 text-xs space-y-1">
                    <p className="thermal-footer font-bold text-black text-xs sm:text-sm">Terima Kasih</p>
                    <p className="text-[11px] sm:text-xs text-gray-800">Semoga Berkah & Bermanfaat</p>
                    <p className="text-[10px] text-gray-500 pt-0.5">*** Higo Pondok ***</p>
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
