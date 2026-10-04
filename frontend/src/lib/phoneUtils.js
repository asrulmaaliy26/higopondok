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
