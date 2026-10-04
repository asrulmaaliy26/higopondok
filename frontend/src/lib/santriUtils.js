import santriData from '../data/santri.json';

/**
 * Utility helper to extract and match santri details and gender from seluruh_data_santri / santri.json
 */

/**
 * Clean raw santri name by removing appended gender (Laki-laki / Perempuan)
 */
export function getCleanSantriName(rawName = '') {
  if (!rawName) return '';
  return rawName.replace(/\s+(Laki-laki|Perempuan)$/i, '').trim();
}

/**
 * Extract gender from row string or user data
 * Returns 'Laki-laki' | 'Perempuan' | ''
 */
export function extractGenderFromRow(rawName = '') {
  if (!rawName) return '';
  if (rawName.toLowerCase().endsWith('perempuan')) return 'Perempuan';
  if (rawName.toLowerCase().endsWith('laki-laki')) return 'Laki-laki';
  return '';
}

/**
 * Find matching santri record in santri.json by name
 */
export function findSantriByName(santriName = '') {
  if (!santriName || !santriData?.data) return null;
  const sName = santriName.toLowerCase().trim();

  return (
    santriData.data.find((r) => {
      if (!r || !r[1]) return false;
      const rawName = r[1].toLowerCase().replace(/\s+(laki-laki|perempuan)$/i, '').trim();
      return rawName === sName || sName.includes(rawName) || rawName.includes(sName);
    }) || null
  );
}

/**
 * Get comprehensive santri details including gender from santri.json
 */
export function getSantriInfo(santriName = '', fallbackRoom = '', fallbackClass = '', fallbackLevel = '') {
  const match = findSantriByName(santriName);

  if (!match) {
    return {
      name: santriName,
      cleanName: getCleanSantriName(santriName),
      gender: extractGenderFromRow(santriName),
      genderType: extractGenderFromRow(santriName) === 'Perempuan' ? 'putri' : (extractGenderFromRow(santriName) === 'Laki-laki' ? 'putra' : ''),
      level: fallbackLevel,
      class: fallbackClass,
      room: fallbackRoom,
      rawRow: null,
    };
  }

  const rawName = match[1] || '';
  const cleanName = getCleanSantriName(rawName);
  const gender = extractGenderFromRow(rawName);
  const genderType = gender === 'Perempuan' ? 'putri' : (gender === 'Laki-laki' ? 'putra' : '');

  const jenjang = match[4] || fallbackLevel;
  const tingkat = match[5] || '';
  const rombel = match[6] || '';
  const program = match[7] && match[7] !== '-' ? match[7] : '';
  const fullClass = [tingkat, rombel, program].filter(Boolean).join(' ') || fallbackClass;
  const room = match[10] || fallbackRoom;

  return {
    name: rawName,
    cleanName,
    gender,
    genderType,
    level: jenjang,
    class: fullClass,
    room,
    rawRow: match,
  };
}

/**
 * Determine santri gender ('putra' | 'putri') prioritizing santri.json data
 */
export function getSantriGender(santriName = '', santriRoom = '') {
  const info = getSantriInfo(santriName, santriRoom);
  if (info.genderType) {
    return info.genderType;
  }

  // Fallback to room/dormitory name heuristics if not found in santri.json
  const sRoom = (santriRoom || '').toLowerCase().trim();
  if (sRoom.includes('asmah') || sRoom.includes('aminah') || sRoom.includes('putri') || sRoom.includes('akhwat') || sRoom.includes('khadijah') || sRoom.includes('fatimah') || sRoom.includes('aisyah')) {
    return 'putri';
  }
  if (sRoom.includes('majid') || sRoom.includes('malik') || sRoom.includes('putra') || sRoom.includes('ikhwan') || sRoom.includes('mannan') || sRoom.includes('ali') || sRoom.includes('umar') || sRoom.includes('utsman')) {
    return 'putra';
  }

  // Name heuristics
  const sName = (santriName || '').toLowerCase().trim();
  if (/\b(binti|putri|siti|shofiya|nida|zahra|khadijah|aisyah|nurul|dewi|ayu|anisa|annisa|fatimah|salma|nayla)\b/i.test(sName)) {
    return 'putri';
  }

  return 'putra';
}
