import React from 'react';

/**
 * Cek apakah sebuah pesanan merupakan pindahan dari tanggal lain berdasarkan perbandingan checkout_id dengan created_at
 * @param {Object} orderOrGroup
 * @returns {boolean}
 */
export const isOrderPindahan = (orderOrGroup) => {
  if (!orderOrGroup) return false;
  const createdAt = orderOrGroup.created_at;
  if (!createdAt) return false;

  const dateObj = new Date(createdAt);
  const checkoutId = orderOrGroup.checkout_id || (Array.isArray(orderOrGroup.orders) && orderOrGroup.orders[0]?.checkout_id);
  if (!checkoutId) return false;

  const match = checkoutId.match(/CHK-(\d{4})(\d{2})(\d{2})/);
  if (!match) return false;

  const [_, origY, origM, origD] = match;
  const curY = String(dateObj.getFullYear());
  const curM = String(dateObj.getMonth() + 1).padStart(2, '0');
  const curD = String(dateObj.getDate()).padStart(2, '0');
  const origDateStr = `${origY}-${origM}-${origD}`;
  const curDateStr = `${curY}-${curM}-${curD}`;

  return origDateStr !== curDateStr;
};

/**
 * Dapatkan tanggal asal pesanan pindahan (contoh: '12 Okt')
 * @param {Object} orderOrGroup
 * @returns {string|null}
 */
export const getOrderOrigDate = (orderOrGroup) => {
  if (!orderOrGroup) return null;
  const checkoutId = orderOrGroup.checkout_id || (Array.isArray(orderOrGroup.orders) && orderOrGroup.orders[0]?.checkout_id);
  if (!checkoutId) return null;

  const match = checkoutId.match(/CHK-(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;

  const [_, origY, origM, origD] = match;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const origDObj = new Date(Number(origY), Number(origM) - 1, Number(origD));
  return `${origDObj.getDate()} ${monthNames[origDObj.getMonth()]}`;
};

/**
 * Helper untuk memformat waktu & mendeteksi pesanan pindahan dari tanggal lain (misal kemarin).
 * 
 * Aturan:
 * 1. Jika dibuat hari ini & bukan pindahan: cukup jam saja (contoh: • 18.08).
 * 2. Jika dibuat hari ini TAPI pindahan dari kemarin/sebelumnya: tampilkan jam + badge tanggal asal (contoh: • 17.28 [📅 Pindahan (12 Okt)]).
 * 3. Jika tanggal pesanan bukan hari ini (pesanan kemarin/lampau): tampilkan tanggal & jam (contoh: • 12 Okt • 22.43).
 *
 * @param {Object} orderOrGroup
 * @returns {React.ReactNode}
 */
export const renderOrderDateTime = (orderOrGroup) => {
  if (!orderOrGroup) return null;
  const createdAt = orderOrGroup.created_at;
  if (!createdAt) return null;

  const dateObj = new Date(createdAt);
  const now = new Date();

  const isToday =
    dateObj.getDate() === now.getDate() &&
    dateObj.getMonth() === now.getMonth() &&
    dateObj.getFullYear() === now.getFullYear();

  const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  // Cek apakah pesanan merupakan pindahan / perubahan dari tanggal lain berdasarkan checkout_id
  const hasRescheduled = isOrderPindahan(orderOrGroup);
  let rescheduleBadge = null;

  if (hasRescheduled) {
    const origFormatted = getOrderOrigDate(orderOrGroup);
    rescheduleBadge = (
      <span 
        className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-none text-[9px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-2xs shrink-0"
        title={`Pesanan ini merupakan pindahan/perubahan dari checkout tanggal sebelumnya (${origFormatted})`}
      >
        <span>📅 Pindahan ({origFormatted})</span>
      </span>
    );
  }

  // 1. Jika pesanan hari ini dan BUKAN pindahan: cukup jam saja
  if (isToday && !rescheduleBadge) {
    return (
      <span className="text-[10px] sm:text-xs text-gray-400">
        • {timeStr}
      </span>
    );
  }

  // 2. Jika pesanan hari ini TAPI pindahan dari kemarin/sebelumnya: tampilkan jam & badge tanggal asal
  if (isToday && rescheduleBadge) {
    return (
      <span className="inline-flex items-center gap-1 flex-wrap text-[10px] sm:text-xs text-gray-400">
        <span>• {timeStr}</span>
        {rescheduleBadge}
      </span>
    );
  }

  // 3. Jika tanggal pesanan BUKAN hari ini (pesanan kemarin/lampau): tampilkan tanggal & jam
  const dateFormatted = `${dateObj.getDate()} ${monthNames[dateObj.getMonth()]}`;
  return (
    <span className="inline-flex items-center gap-1 flex-wrap text-[10px] sm:text-xs text-gray-400">
      <span>• {dateFormatted} • {timeStr}</span>
      {rescheduleBadge}
    </span>
  );
};
