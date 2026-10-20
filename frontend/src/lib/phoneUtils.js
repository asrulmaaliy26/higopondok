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
 * @param {Object} options
 * @param {Object} [options.user] - Auth user object (store)
 * @param {string} [options.recipientTitle] - Misal "Admin HiGO Pondok", "Toko Berkah", "Kurir Pondok"
 * @param {string} [options.intentMessage] - Tujuan pesan
 * @param {Object} [options.extraInfo] - { santriName, santriRoom, santriClass, orderId, checkoutId, isTeacher }
 * @returns {string} Text template WhatsApp yang terstruktur rapi
 */
export const buildDefaultGreetingWaText = ({
  user = null,
  recipientTitle = 'Admin / Toko',
  intentMessage = 'saya ingin bertanya / konfirmasi.',
  extraInfo = {}
}) => {
  const isTeacher = user?.is_teacher || extraInfo.isTeacher;
  const waliName = user?.name || extraInfo.waliName || '';
  const santriName = extraInfo.santriName || user?.santri_name || '';
  const room = extraInfo.santriRoom || user?.santri_room || extraInfo.deliveryLocation || '';
  const kelas = extraInfo.santriClass || user?.santri_class || '';

  let text = `Assalamu'alaikum Warahmatullahi Wabarakatuh, ${recipientTitle}.\n\n`;
  text += `Perkenalkan saya:\n`;

  if (isTeacher) {
    text += `👨‍🏫 *Guru / Staff*: ${user?.name || '-'}\n`;
    if (user?.teacher_unit) text += `🏢 Unit / Tugas: ${user.teacher_unit}\n`;
  } else {
    if (waliName) {
      text += `👤 *Nama Wali*: ${waliName}\n`;
    }
    if (santriName) {
      text += `🎓 *Nama Santri*: ${santriName}\n`;
    }
    const locInfo = [kelas, room].filter(Boolean).join(' | ');
    if (locInfo) {
      text += `🏠 *Kamar / Kelas*: ${locInfo}\n`;
    }
  }

  if (extraInfo.orderId) {
    text += `📦 *No. Pesanan*: #${extraInfo.orderId}\n`;
  }
  if (extraInfo.checkoutId) {
    text += `🛒 *ID Checkout*: #${extraInfo.checkoutId}\n`;
  }

  if (intentMessage) {
    text += `\nMaksud saya: ${intentMessage}\n\n`;
  }

  text += `Terima kasih, Syukron Jazakumullah Khairan. 🙏`;

  return text;
};

