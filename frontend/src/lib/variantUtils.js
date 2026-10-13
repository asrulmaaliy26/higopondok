/**
 * Utility functions for managing and describing product variants
 */

export const hasVariants = (product) => {
  const cfg = product?.variant_config;
  if (!cfg) return false;
  return !!(
    cfg.spicy?.enabled ||
    cfg.temperature?.enabled ||
    cfg.portion?.enabled ||
    cfg.sugar?.enabled ||
    (cfg.custom?.enabled && Array.isArray(cfg.custom?.groups) && cfg.custom.groups.length > 0)
  );
};

export const getAvailableVariantPills = (product) => {
  const cfg = product?.variant_config;
  if (!cfg) return [];
  const pills = [];

  // 1. Spicy
  if (cfg.spicy?.enabled) {
    if (Array.isArray(cfg.spicy?.options) && cfg.spicy.options.length > 0) {
      const opts = cfg.spicy.options
        .map((o) => (typeof o === 'string' ? o : o.name))
        .filter(Boolean);
      pills.push({
        type: 'spicy',
        label: `Pedas: ${opts.slice(0, 3).join(', ')}${opts.length > 3 ? '...' : ''}`,
        fullLabel: `Pilihan Pedas: ${opts.join(', ')}`,
        badgeText: `Pedas (${opts.length} opsi)`
      });
    } else {
      const max = cfg.spicy?.maxLevel || 3;
      pills.push({
        type: 'spicy',
        label: `Pedas: Lv 0 - ${max}`,
        fullLabel: `Level Pedas: Level 0 sampai ${max}`,
        badgeText: `Lv 0 - ${max}`
      });
    }
  }

  // 2. Temperature / Sajian
  if (cfg.temperature?.enabled) {
    if (Array.isArray(cfg.temperature?.options) && cfg.temperature.options.length > 0) {
      const opts = cfg.temperature.options
        .map((o) => (typeof o === 'string' ? o : o.name))
        .filter(Boolean);
      pills.push({
        type: 'temperature',
        label: `Sajian: ${opts.join(' / ')}`,
        fullLabel: `Pilihan Sajian: ${opts.join(' / ')}`,
        badgeText: opts.join('/')
      });
    } else {
      const temps = [];
      if (cfg.temperature.allowIce !== false) temps.push('Es');
      if (cfg.temperature.allowHot !== false) temps.push('Hangat');
      const text = temps.join(' / ') || 'Suhu Khusus';
      pills.push({
        type: 'temperature',
        label: `Sajian: ${text}`,
        fullLabel: `Suhu / Penyajian: ${text}`,
        badgeText: text
      });
    }
  }

  // 3. Portion
  if (cfg.portion?.enabled) {
    const extra = parseFloat(cfg.portion?.jumboPrice || 0);
    pills.push({
      type: 'portion',
      label: extra > 0 ? `Porsi: Biasa / Jumbo (+Rp ${extra.toLocaleString('id-ID')})` : 'Porsi: Biasa / Jumbo',
      fullLabel: extra > 0 ? `Porsi: Biasa & Jumbo (+Rp ${extra.toLocaleString('id-ID')})` : 'Porsi: Biasa & Jumbo',
      badgeText: extra > 0 ? `Jumbo +${extra.toLocaleString('id-ID')}` : 'Biasa/Jumbo'
    });
  }

  // 4. Sugar
  if (cfg.sugar?.enabled) {
    pills.push({
      type: 'sugar',
      label: 'Gula: Normal / Sedikit / Tanpa Gula',
      fullLabel: 'Kadar Manis: Normal (100%), Sedikit Gula, Tanpa Gula',
      badgeText: 'Kadar Gula'
    });
  }

  // 5. Custom Groups
  if (cfg.custom?.enabled && Array.isArray(cfg.custom?.groups)) {
    cfg.custom.groups.forEach((g) => {
      const rawItems = g.items || g.options || [];
      const itemNames = rawItems
        .map((it) => (typeof it === 'string' ? it : it.name))
        .filter(Boolean);
      const name = g.name || 'Pilihan';
      pills.push({
        type: 'custom',
        label: itemNames.length > 0 ? `${name}: ${itemNames.slice(0, 3).join(', ')}${itemNames.length > 3 ? '...' : ''}` : name,
        fullLabel: itemNames.length > 0 ? `${name}: ${itemNames.join(', ')}` : name,
        badgeText: name
      });
    });
  }

  return pills;
};

export const getVariantSummaryText = (product) => {
  const pills = getAvailableVariantPills(product);
  if (pills.length === 0) return '';
  return pills.map((p) => p.label).join(' • ');
};
