import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Flame, Coffee, Utensils, Sparkles, Plus, Minus, Check } from 'lucide-react';
import { getStorageUrl } from '../../lib/axios';

export const ProductOptionModal = ({
  isOpen,
  onClose,
  product,
  canteen,
  onAddToCart
}) => {
  if (!isOpen || !product) return null;

  const config = product.variant_config || {};
  const hasSpicy = Boolean(config.spicy?.enabled);
  const maxSpicy = config.spicy?.maxLevel || 3;
  const hasTemp = Boolean(config.temperature?.enabled);
  const hasPortion = Boolean(config.portion?.enabled);
  const jumboExtra = parseFloat(config.portion?.jumboPrice || 0);
  const hasSugar = Boolean(config.sugar?.enabled);
  const customGroups = (config.custom?.enabled && Array.isArray(config.custom?.groups)) ? config.custom.groups : [];

  // Local state for selected options
  const [selectedSpicy, setSelectedSpicy] = useState(0);
  const [selectedTemp, setSelectedTemp] = useState('ice'); // 'ice' | 'hot'
  const [selectedPortion, setSelectedPortion] = useState('regular'); // 'regular' | 'jumbo'
  const [selectedSugar, setSelectedSugar] = useState('normal'); // 'normal' | 'less' | 'none'
  
  // Custom groups state: { [groupId]: singleItemId (for radio) OR [itemId, itemId] (for checkbox) }
  const [selectedCustom, setSelectedCustom] = useState(() => {
    const initial = {};
    customGroups.forEach(g => {
      if (g.type === 'radio') {
        initial[g.id] = g.items && g.items.length > 0 ? g.items[0].id : null;
      } else {
        initial[g.id] = [];
      }
    });
    return initial;
  });

  const [quantity, setQuantity] = useState(1);
  const [customNotes, setCustomNotes] = useState('');

  // Calculate extra price
  const extraPrice = useMemo(() => {
    let extra = 0;
    if (hasPortion && selectedPortion === 'jumbo') {
      extra += jumboExtra;
    }

    customGroups.forEach(g => {
      const sel = selectedCustom[g.id];
      if (g.type === 'radio' && sel) {
        const item = g.items.find(it => it.id === sel);
        if (item && item.price) extra += parseFloat(item.price);
      } else if (g.type === 'checkbox' && Array.isArray(sel)) {
        sel.forEach(itemId => {
          const item = g.items.find(it => it.id === itemId);
          if (item && item.price) extra += parseFloat(item.price);
        });
      }
    });

    return extra;
  }, [hasPortion, selectedPortion, jumboExtra, customGroups, selectedCustom]);

  const basePrice = parseFloat(product.discount_price || product.price || 0);
  const unitPrice = basePrice + extraPrice;
  const totalPrice = unitPrice * quantity;

  const formatRupiah = (val) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

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
    // Build human-readable option labels
    const labels = [];
    const keyParts = [];

    if (hasSpicy) {
      const spicyLabel = selectedSpicy === 0 ? 'Lv 0 (Tidak Pedas)' : `Level ${selectedSpicy}`;
      labels.push(spicyLabel);
      keyParts.push(`spicy_${selectedSpicy}`);
    }

    if (hasTemp) {
      const tempLabel = selectedTemp === 'ice' ? '🧊 Dingin (Es)' : '☕ Hangat / Panas';
      labels.push(tempLabel);
      keyParts.push(`temp_${selectedTemp}`);
    }

    if (hasPortion) {
      const portionLabel = selectedPortion === 'jumbo' ? `Porsi Jumbo (+${formatRupiah(jumboExtra)})` : 'Porsi Biasa';
      labels.push(portionLabel);
      keyParts.push(`portion_${selectedPortion}`);
    }

    if (hasSugar) {
      const sugarLabel = selectedSugar === 'normal' ? 'Gula Normal' : (selectedSugar === 'less' ? 'Sedikit Gula' : 'Tanpa Gula');
      labels.push(sugarLabel);
      keyParts.push(`sugar_${selectedSugar}`);
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

    // Combined notes string for kitchen / receipts
    const prefix = labels.length > 0 ? `[${labels.join(' | ')}]` : '';
    const finalNotes = customNotes.trim() ? `${prefix} • ${customNotes.trim()}` : prefix;

    const variantKey = keyParts.join('_') || 'default';

    onAddToCart(
      canteen,
      product,
      quantity,
      {
        variantKey,
        labels,
        extraPrice,
        unitPrice
      },
      finalNotes
    );

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
          {hasSpicy && (
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-red-500" />
                <span>Pilih Level Pedas:</span>
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedSpicy(0)}
                  className={`py-1.5 px-1 text-xs font-bold rounded-none border transition-colors cursor-pointer ${
                    selectedSpicy === 0
                      ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900 border-gray-800'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Lv 0 (Ori)
                </button>
                {Array.from({ length: maxSpicy }, (_, i) => i + 1).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSelectedSpicy(lvl)}
                    className={`py-1.5 px-1 text-xs font-bold rounded-none border transition-colors cursor-pointer ${
                      selectedSpicy === lvl
                        ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                        : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-900 hover:bg-red-100'
                    }`}
                  >
                    Level {lvl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. Suhu (Es / Hangat) */}
          {hasTemp && (
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <Coffee className="w-3.5 h-3.5 text-blue-500" />
                <span>Pilihan Suhu:</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTemp('ice')}
                  className={`py-2 px-3 text-xs font-bold rounded-none border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    selectedTemp === 'ice'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900 hover:bg-blue-100'
                  }`}
                >
                  <span>🧊 Dingin / Es (Ice)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTemp('hot')}
                  className={`py-2 px-3 text-xs font-bold rounded-none border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    selectedTemp === 'hot'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900 hover:bg-amber-100'
                  }`}
                >
                  <span>☕ Hangat / Panas (Hot)</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. Ukuran Porsi */}
          {hasPortion && (
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ukuran Porsi:</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPortion('regular')}
                  className={`py-2 px-3 text-xs font-bold rounded-none border transition-colors flex flex-col items-center justify-center cursor-pointer ${
                    selectedPortion === 'regular'
                      ? 'bg-green-600 text-white border-green-600 shadow-2xs'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>Porsi Biasa</span>
                  <span className="text-[10px] font-normal opacity-90">Harga Normal</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPortion('jumbo')}
                  className={`py-2 px-3 text-xs font-bold rounded-none border transition-colors flex flex-col items-center justify-center cursor-pointer ${
                    selectedPortion === 'jumbo'
                      ? 'bg-green-600 text-white border-green-600 shadow-2xs'
                      : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900 hover:bg-emerald-100'
                  }`}
                >
                  <span>Porsi Jumbo</span>
                  <span className="text-[10px] font-normal font-mono opacity-90">
                    +{formatRupiah(jumboExtra)}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* 4. Tingkat Manis */}
          {hasSugar && (
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <Coffee className="w-3.5 h-3.5 text-amber-600" />
                <span>Kadar Manis / Gula:</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'normal', label: 'Normal (100%)' },
                  { id: 'less', label: 'Sedikit Gula' },
                  { id: 'none', label: 'Tanpa Gula' }
                ].map(sug => (
                  <button
                    key={sug.id}
                    type="button"
                    onClick={() => setSelectedSugar(sug.id)}
                    className={`py-1.5 px-1.5 text-[11px] font-bold rounded-none border transition-colors cursor-pointer text-center ${
                      selectedSugar === sug.id
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {sug.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 5. Custom Groups (Pilihan Sambal, Potongan Daging, Topping, dll.) */}
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
                  {group.items.map((item) => {
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
