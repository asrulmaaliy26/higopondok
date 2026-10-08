import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Flame, Coffee, Utensils, Sparkles, Plus, Minus, Check } from 'lucide-react';
import { getStorageUrl } from '../../lib/axios';

const formatRupiah = (val) => {
  return 'Rp ' + Math.round(Number(val) || 0).toLocaleString('id-ID');
};

const parsePrice = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  if (typeof val === 'string') {
    const match = val.match(/\(\+Rp\s*([\d\.,]+)\)/i);
    if (match) {
      const num = match[1].replace(/[\.,]/g, '');
      return parseFloat(num) || 0;
    }
  }
  return 0;
};

const cleanOptionName = (val) => {
  if (typeof val !== 'string') return '';
  return val.replace(/\s*\(\+Rp[^\)]+\)/i, '').trim();
};

const getSpicyTier = (name, idx, total) => {
  const match = (name || '').match(/\d+/);
  if (match) {
    const lvl = parseInt(match[0], 10);
    return Math.min(5, lvl);
  }
  const lower = (name || '').toLowerCase();
  if (lower.includes('tidak') || lower.includes('ori') || lower.includes('manis')) return 0;
  if (lower.includes('sedang') || lower.includes('mild')) return 2;
  if (lower.includes('mercon') || lower.includes('ekstra') || lower.includes('super') || lower.includes('gila') || lower.includes('neraka')) return 5;
  if (lower.includes('pedas') || lower.includes('hot')) return 4;
  return Math.min(5, Math.round((idx / Math.max(1, total - 1)) * 5));
};

const getSpicyColorClasses = (opt, idx, total, isSelected) => {
  const tier = getSpicyTier(opt.name, idx, total);

  const styles = [
    // Tier 0: Hijau (Ori / Tidak Pedas / Lv 0)
    {
      unselected: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100',
      selected: 'bg-emerald-600 text-white border-emerald-600 shadow-xs font-black'
    },
    // Tier 1: Hijau Kekuningan / Lime (Lv 1)
    {
      unselected: 'bg-lime-50 text-lime-800 border-lime-300 dark:bg-lime-950/40 dark:text-lime-300 dark:border-lime-800 hover:bg-lime-100',
      selected: 'bg-lime-600 text-white border-lime-600 shadow-xs font-black'
    },
    // Tier 2: Kuning / Amber (Lv 2)
    {
      unselected: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 hover:bg-amber-100',
      selected: 'bg-amber-500 text-gray-950 border-amber-500 shadow-xs font-black'
    },
    // Tier 3: Oranye (Lv 3)
    {
      unselected: 'bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800 hover:bg-orange-100',
      selected: 'bg-orange-500 text-white border-orange-500 shadow-xs font-black'
    },
    // Tier 4: Merah-Oranye / Rose (Lv 4)
    {
      unselected: 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 hover:bg-rose-100',
      selected: 'bg-rose-600 text-white border-rose-600 shadow-xs font-black'
    },
    // Tier 5: Merah Pedas Menyala (Lv 5+)
    {
      unselected: 'bg-red-50 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 hover:bg-red-100',
      selected: 'bg-red-600 text-white border-red-600 shadow-xs font-black'
    }
  ];

  const current = styles[tier] || styles[styles.length - 1];
  return isSelected ? current.selected : current.unselected;
};

const getSpicyFlameColor = (opt, idx, total) => {
  if (!opt) return 'text-red-500';
  const tier = getSpicyTier(opt.name, idx, total);
  const flameColors = [
    'text-emerald-500', // 0
    'text-lime-500',    // 1
    'text-amber-500',   // 2
    'text-orange-500',  // 3
    'text-rose-500',    // 4
    'text-red-500'      // 5
  ];
  return flameColors[tier] || 'text-red-500';
};

export const ProductOptionModal = ({
  isOpen,
  onClose,
  product,
  canteen,
  onAddToCart,
  onConfirm
}) => {
  if (!isOpen || !product) return null;

  const config = product.variant_config || {};

  // 1. SPICY CONFIG
  const hasSpicy = Boolean(config.spicy?.enabled);
  const spicyLabel = config.spicy?.label || 'Pilih Level Pedas:';
  const spicyOptions = useMemo(() => {
    if (!hasSpicy) return [];
    if (Array.isArray(config.spicy?.options) && config.spicy.options.length > 0) {
      return config.spicy.options.map((opt, idx) => ({
        id: `spicy_${idx}`,
        name: typeof opt === 'string' ? opt : opt.name,
        value: typeof opt === 'string' ? opt : opt.name
      }));
    }
    const max = config.spicy?.maxLevel || 3;
    const list = [{ id: 'spicy_0', name: 'Lv 0 (Ori)', value: 'Lv 0 (Tidak Pedas)' }];
    for (let i = 1; i <= max; i++) {
      list.push({ id: `spicy_${i}`, name: `Level ${i}`, value: `Level ${i}` });
    }
    return list;
  }, [hasSpicy, config.spicy]);

  // 2. TEMPERATURE / SAJIAN CONFIG
  const hasTemp = Boolean(config.temperature?.enabled);
  const tempLabel = config.temperature?.label || 'Pilihan Sajian:';
  const tempOptions = useMemo(() => {
    if (!hasTemp) return [];
    if (Array.isArray(config.temperature?.options) && config.temperature.options.length > 0) {
      return config.temperature.options.map((opt, idx) => ({
        id: `temp_${idx}`,
        name: typeof opt === 'string' ? opt : opt.name,
        value: typeof opt === 'string' ? opt : opt.name
      }));
    }
    const list = [];
    if (config.temperature?.allowIce !== false) {
      list.push({ id: 'ice', name: '🧊 Dingin / Es', value: '🧊 Dingin (Es)' });
    }
    if (config.temperature?.allowHot !== false) {
      list.push({ id: 'hot', name: '☕ Hangat / Panas', value: '☕ Hangat / Panas' });
    }
    return list.length > 0 ? list : [
      { id: 'ice', name: '🧊 Dingin / Es', value: '🧊 Dingin (Es)' },
      { id: 'hot', name: '☕ Hangat / Panas', value: '☕ Hangat / Panas' }
    ];
  }, [hasTemp, config.temperature]);

  // 3. PORTION CONFIG
  const hasPortion = Boolean(config.portion?.enabled);
  const portionLabel = config.portion?.label || 'Ukuran Porsi:';
  const portionOptions = useMemo(() => {
    if (!hasPortion) return [];
    if (Array.isArray(config.portion?.options) && config.portion.options.length > 0) {
      return config.portion.options.map((opt, idx) => {
        const isStr = typeof opt === 'string';
        const rawName = isStr ? opt : opt.name;
        const price = isStr ? parsePrice(opt) : parseFloat(opt.price || 0);
        return {
          id: `portion_${idx}`,
          name: cleanOptionName(rawName) || rawName,
          fullName: rawName,
          price,
          value: rawName
        };
      });
    }
    const extra = parseFloat(config.portion?.jumboPrice || 0);
    return [
      { id: 'regular', name: 'Porsi Biasa', fullName: 'Porsi Biasa', price: 0, value: 'Porsi Biasa' },
      { id: 'jumbo', name: 'Porsi Jumbo', fullName: `Porsi Jumbo (+${formatRupiah(extra)})`, price: extra, value: 'Porsi Jumbo' }
    ];
  }, [hasPortion, config.portion]);

  // 4. SUGAR CONFIG
  const hasSugar = Boolean(config.sugar?.enabled);
  const sugarLabel = config.sugar?.label || 'Kadar Manis / Gula:';
  const sugarOptions = useMemo(() => {
    if (!hasSugar) return [];
    if (Array.isArray(config.sugar?.options) && config.sugar.options.length > 0) {
      return config.sugar.options.map((opt, idx) => ({
        id: `sugar_${idx}`,
        name: typeof opt === 'string' ? opt : opt.name,
        value: typeof opt === 'string' ? opt : opt.name
      }));
    }
    return [
      { id: 'normal', name: 'Normal (100%)', value: 'Gula Normal' },
      { id: 'less', name: 'Sedikit Gula', value: 'Sedikit Gula' },
      { id: 'none', name: 'Tanpa Gula', value: 'Tanpa Gula' }
    ];
  }, [hasSugar, config.sugar]);

  // 5. CUSTOM GROUPS (Saus, Topping, Potongan, dll.)
  const hasCustom = Boolean(config.custom?.enabled);
  const customGroups = useMemo(() => {
    if (!hasCustom || !Array.isArray(config.custom?.groups)) return [];
    return config.custom.groups.map((g, gIdx) => {
      const rawItems = g.items || g.options || [];
      const items = rawItems.map((it, itIdx) => {
        const isStr = typeof it === 'string';
        const rawName = isStr ? it : it.name;
        const price = isStr ? parsePrice(it) : parseFloat(it.price || 0);
        return {
          id: it.id || `g_${gIdx}_opt_${itIdx}`,
          name: cleanOptionName(rawName) || rawName,
          fullName: rawName,
          price
        };
      });

      const isCheckbox = g.type === 'checkbox' || (!g.type && g.name && (g.name.toLowerCase().includes('topping') || g.name.toLowerCase().includes('tambahan')));
      const type = isCheckbox ? 'checkbox' : 'radio';

      return {
        id: g.id || `group_${gIdx}`,
        name: g.name || `Pilihan ${gIdx + 1}`,
        type,
        required: g.required ?? (type === 'radio'),
        items
      };
    });
  }, [hasCustom, config.custom]);

  // Local state for user selections
  const [selectedSpicy, setSelectedSpicy] = useState('');
  const [selectedTemp, setSelectedTemp] = useState('');
  const [selectedPortion, setSelectedPortion] = useState('');
  const [selectedSugar, setSelectedSugar] = useState('');
  const [selectedCustom, setSelectedCustom] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [customNotes, setCustomNotes] = useState('');

  // Reset/Initialize state when modal opens or product changes
  useEffect(() => {
    if (!isOpen || !product) return;

    setSelectedSpicy(spicyOptions[0]?.id || '');
    setSelectedTemp(tempOptions[0]?.id || '');
    setSelectedPortion(portionOptions[0]?.id || '');
    setSelectedSugar(sugarOptions[0]?.id || '');

    const initialCustom = {};
    customGroups.forEach(g => {
      if (g.type === 'radio') {
        initialCustom[g.id] = g.items && g.items.length > 0 ? g.items[0].id : null;
      } else {
        initialCustom[g.id] = [];
      }
    });
    setSelectedCustom(initialCustom);
    setQuantity(1);
    setCustomNotes('');
  }, [isOpen, product?.id, spicyOptions, tempOptions, portionOptions, sugarOptions, customGroups]);

  // Extra price calculation
  const portionExtra = useMemo(() => {
    if (!hasPortion) return 0;
    const found = portionOptions.find(p => p.id === selectedPortion);
    return found ? (found.price || 0) : 0;
  }, [hasPortion, portionOptions, selectedPortion]);

  const customExtra = useMemo(() => {
    let sum = 0;
    customGroups.forEach(g => {
      const sel = selectedCustom[g.id];
      if (g.type === 'radio' && sel) {
        const it = g.items.find(i => i.id === sel);
        if (it && it.price) sum += it.price;
      } else if (g.type === 'checkbox' && Array.isArray(sel)) {
        sel.forEach(id => {
          const it = g.items.find(i => i.id === id);
          if (it && it.price) sum += it.price;
        });
      }
    });
    return sum;
  }, [customGroups, selectedCustom]);

  const extraPrice = portionExtra + customExtra;
  const basePrice = parseFloat(product.discount_price || product.price || 0);
  const unitPrice = basePrice + extraPrice;
  const totalPrice = unitPrice * quantity;

  const handleCustomToggle = (groupId, item, type) => {
    if (type === 'radio') {
      setSelectedCustom(prev => ({ ...prev, [groupId]: item.id }));
    } else {
      setSelectedCustom(prev => {
        const current = prev[groupId] || [];
        const exists = current.includes(item.id);
        return {
          ...prev,
          [groupId]: exists ? current.filter(id => id !== item.id) : [...current, item.id]
        };
      });
    }
  };

  const handleConfirm = () => {
    const labels = [];
    const keyParts = [];

    if (hasSpicy) {
      const found = spicyOptions.find(o => o.id === selectedSpicy);
      if (found) {
        labels.push(found.value || found.name);
        keyParts.push(`spicy_${found.id}`);
      }
    }

    if (hasTemp) {
      const found = tempOptions.find(o => o.id === selectedTemp);
      if (found) {
        labels.push(found.value || found.name);
        keyParts.push(`temp_${found.id}`);
      }
    }

    if (hasPortion) {
      const found = portionOptions.find(o => o.id === selectedPortion);
      if (found) {
        labels.push(found.fullName || found.name);
        keyParts.push(`portion_${found.id}`);
      }
    }

    if (hasSugar) {
      const found = sugarOptions.find(o => o.id === selectedSugar);
      if (found) {
        labels.push(found.value || found.name);
        keyParts.push(`sugar_${found.id}`);
      }
    }

    customGroups.forEach(g => {
      const sel = selectedCustom[g.id];
      if (g.type === 'radio' && sel) {
        const it = g.items.find(i => i.id === sel);
        if (it) {
          labels.push(it.name + (it.price > 0 ? ` (+${formatRupiah(it.price)})` : ''));
          keyParts.push(`g${g.id}_${it.id}`);
        }
      } else if (g.type === 'checkbox' && Array.isArray(sel) && sel.length > 0) {
        const itemNames = sel.map(id => {
          const it = g.items.find(i => i.id === id);
          return it ? it.name + (it.price > 0 ? ` (+${formatRupiah(it.price)})` : '') : '';
        }).filter(Boolean);
        if (itemNames.length > 0) {
          labels.push(`${g.name}: ${itemNames.join(', ')}`);
          keyParts.push(`g${g.id}_${sel.join('-')}`);
        }
      }
    });

    const prefix = labels.length > 0 ? `[${labels.join(' | ')}]` : '';
    const finalNotes = customNotes.trim() ? `${prefix} • ${customNotes.trim()}` : prefix;
    const variantKey = keyParts.join('_') || 'default';

    const payload = {
      canteen,
      product,
      quantity,
      options: labels,
      labels,
      notes: finalNotes,
      extraPrice,
      unitPrice,
      variantKey
    };

    if (onConfirm) {
      onConfirm(payload);
    } else if (onAddToCart) {
      onAddToCart(canteen, product, quantity, { variantKey, labels, extraPrice, unitPrice }, finalNotes);
    }

    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-fade-in p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 w-full sm:max-w-md rounded-none border-t sm:border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[90vh] my-0 sm:my-auto animate-in slide-in-from-bottom-5 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Pilih Opsi & Varian</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* Product Summary */}
          <div className="flex gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
            {product.image ? (
              <img
                src={getStorageUrl(product.image)}
                alt={product.name}
                className="w-16 h-16 rounded-none object-cover border border-gray-200 dark:border-gray-700 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-none bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 text-gray-400">
                <Utensils className="w-6 h-6" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                {product.name}
              </h4>
              <p className="text-xs font-bold text-green-600 dark:text-green-400 font-mono mt-0.5">
                {formatRupiah(basePrice)}
              </p>
              {product.description && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-1 leading-snug">
                  {product.description}
                </p>
              )}
            </div>
          </div>

          {/* 1. Level Pedas */}
          {hasSpicy && spicyOptions.length > 0 && (
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <Flame className={`w-3.5 h-3.5 transition-colors ${getSpicyFlameColor(spicyOptions.find(o => o.id === selectedSpicy), spicyOptions.findIndex(o => o.id === selectedSpicy), spicyOptions.length)}`} />
                  <span>{spicyLabel}</span>
                </label>
                {selectedSpicy && (
                  <span className="text-[10.5px] font-bold text-gray-500 dark:text-gray-400">
                    {spicyOptions.find(o => o.id === selectedSpicy)?.name}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {spicyOptions.map((opt, idx) => {
                  const isSelected = selectedSpicy === opt.id;
                  const colorClasses = getSpicyColorClasses(opt, idx, spicyOptions.length, isSelected);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedSpicy(opt.id)}
                      className={`py-1.5 px-2.5 text-xs font-bold rounded-none border transition-all cursor-pointer ${colorClasses}`}
                    >
                      {opt.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Suhu / Sajian (Es / Hangat / Kukus / Goreng Crispy) */}
          {hasTemp && tempOptions.length > 0 && (
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <Coffee className="w-3.5 h-3.5 text-blue-500" />
                <span>{tempLabel}</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {tempOptions.map((opt) => {
                  const isSelected = selectedTemp === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedTemp(opt.id)}
                      className={`py-2 px-3 text-xs font-bold rounded-none border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-green-600 text-white border-green-600 shadow-2xs'
                          : 'bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span>{opt.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Ukuran Porsi / Isi (Isi 4 Pcs, Isi 6 Pcs, Biasa, Jumbo) */}
          {hasPortion && portionOptions.length > 0 && (
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-emerald-600" />
                <span>{portionLabel}</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {portionOptions.map((opt) => {
                  const isSelected = selectedPortion === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedPortion(opt.id)}
                      className={`py-2 px-3 text-xs font-bold rounded-none border transition-colors flex flex-col items-center justify-center cursor-pointer ${
                        isSelected
                          ? 'bg-green-600 text-white border-green-600 shadow-2xs'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span>{opt.name}</span>
                      {opt.price > 0 ? (
                        <span className={`text-[10px] font-normal font-mono mt-0.5 ${isSelected ? 'text-green-100' : 'text-green-600 dark:text-green-400'}`}>
                          +{formatRupiah(opt.price)}
                        </span>
                      ) : (
                        <span className="text-[10px] font-normal opacity-80 mt-0.5">Harga Normal</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Tingkat Manis */}
          {hasSugar && sugarOptions.length > 0 && (
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <Coffee className="w-3.5 h-3.5 text-amber-600" />
                <span>{sugarLabel}</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {sugarOptions.map((sug) => (
                  <button
                    key={sug.id}
                    type="button"
                    onClick={() => setSelectedSugar(sug.id)}
                    className={`py-1.5 px-1.5 text-[11px] font-bold rounded-none border transition-colors cursor-pointer text-center ${
                      selectedSugar === sug.id
                        ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {sug.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 5. Custom Groups (Pilihan Saus, Potongan Daging, Topping, dll.) */}
          {customGroups.map((group) => {
            const isRadio = group.type === 'radio';
            const selectedVal = selectedCustom[group.id];

            return (
              <div key={group.id} className="space-y-1.5 text-left p-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-green-600 dark:text-green-400" />
                    {group.name}
                  </span>
                  <span className="text-[10px] text-gray-500 font-semibold uppercase">
                    {isRadio ? 'Wajib Pilih 1' : 'Bisa Pilih Banyak'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                  {(group.items || []).map((item) => {
                    const isChecked = isRadio ? selectedVal === item.id : Array.isArray(selectedVal) && selectedVal.includes(item.id);
                    const itemPrice = parseFloat(item.price || 0);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleCustomToggle(group.id, item, group.type)}
                        className={`p-2 text-xs font-semibold rounded-none border transition-all flex items-center justify-between cursor-pointer text-left ${
                          isChecked
                            ? 'bg-green-600 text-white border-green-600 shadow-2xs font-bold'
                            : 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span className="truncate pr-1">{item.name}</span>
                        {itemPrice > 0 && (
                          <span className={`text-[10.5px] font-mono shrink-0 ${isChecked ? 'text-green-100' : 'text-green-600 dark:text-green-400'}`}>
                            +{formatRupiah(itemPrice)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* 6. Catatan Khusus untuk Dapur */}
          <div className="space-y-1 text-left pt-1">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
              Catatan untuk Toko / Dapur <span className="text-gray-400 font-normal">(Opsional)</span>
            </label>
            <input
              type="text"
              placeholder="Cth: Sambal dipisah, jangan pakai bawang goreng..."
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-none border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-green-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Footer Actions: Quantity & Add to Cart */}
        <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/60 flex items-center gap-3 shrink-0">
          {/* Quantity Counter */}
          <div className="flex items-center border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-none shrink-0">
            <button
              type="button"
              disabled={quantity <= 1}
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center text-xs font-bold font-mono text-gray-900 dark:text-white">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(q => q + 1)}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add to Cart Submit Button */}
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-700 text-white rounded-none text-xs font-bold transition-all shadow-xs flex items-center justify-between cursor-pointer"
          >
            <span>+ Masukkan Keranjang</span>
            <span className="font-mono">{formatRupiah(totalPrice)}</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};

