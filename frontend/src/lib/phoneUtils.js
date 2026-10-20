/**
 * Utility for sanitizing and formatting WhatsApp phone numbers
 */

export const formatWaNumber = (phone) => {
  if (!phone) return '';
  let p = phone.toString().replace(/\D/g, '');
  if (p.startsWith('08')) {
    p = '628' + p.substring(2);
  } else if (p.startsWith('8')) {
    p = '628' + p.substring(1);
  } else if (p.startsWith('0')) {
    p = '62' + p.substring(1);
  }
  return p;
};

export const getWaUrl = (phone, text = '') => {
  const number = formatWaNumber(phone);
  if (!number) return null;
  const encodedText = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${number}${encodedText}`;
};

/**
 * Standar template pesan salam WhatsApp untuk Santri & Wali saat menghubungi Admin / Toko / Kurir
 * Format yang dipersyaratkan:
 * - Salam
 * - Nama santri, kelas, jenjang, dll
 * - Nama pengguna
 * @param {Object} options
 * @param {Object} [options.user] - Auth user object (store)
 * @param {string} [options.recipientTitle] - Misal "Admin HiGO Pondok", "Toko Berkah", "Kurir Pondok"
 * @param {Object} [options.extraInfo] - { santriName, santriRoom, santriClass, santriLevel, isTeacher, userName }
 * @returns {string} Text template WhatsApp yang terstruktur rapi dan ringkas
 */
export const buildDefaultGreetingWaText = ({
  user = null,
  recipientTitle = 'Admin HiGO Pondok',
  extraInfo = {}
}) => {
  const isTeacher = user?.is_teacher || extraInfo.isTeacher;
  const userName = user?.name || extraInfo.userName || extraInfo.waliName || 'Pengguna HiGO';
  const santriName = extraInfo.santriName || user?.santri_name || user?.name || '';
  const jenjang = extraInfo.santriLevel || user?.santri_level || '';
  const kelas = extraInfo.santriClass || user?.santri_class || '';
  const kamar = extraInfo.santriRoom || user?.santri_room || extraInfo.deliveryLocation || '';

  const titlePart = recipientTitle ? `, ${recipientTitle}` : '';
  let text = `Assalamu'alaikum Warahmatullahi Wabarakatuh${titlePart}.\n\n`;

  if (isTeacher) {
    const unit = user?.teacher_unit || extraInfo.teacherUnit;
    text += `Guru / Staff: ${userName}${unit ? ` (Unit: ${unit})` : ''}\n`;
    text += `Nama Pengguna: ${userName}`;
  } else {
    const details = [];
    if (kelas) details.push(`Kelas: ${kelas}`);
    if (jenjang) details.push(`Jenjang: ${jenjang}`);
    if (kamar) details.push(`Kamar: ${kamar}`);

    const detailStr = details.length > 0 ? ` (${details.join(', ')})` : '';
    text += `Nama Santri: ${santriName || userName}${detailStr}\n`;
    text += `Nama Pengguna: ${userName}`;
  }

  return text;
};


