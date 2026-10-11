import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Store, Flame, Coffee, Utensils, Sparkles, Plus, Trash2, CheckSquare, Square, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { getStorageUrl } from '../../lib/axios';

const CATEGORY_PRESETS = [
  { id: 'Makanan', label: '🍜 Makanan' },
  { id: 'Minuman', label: '🥤 Minuman' },
  { id: 'Snack', label: '🍿 Snack / Camilan' },
  { id: 'Lainnya', label: '📦 Lainnya' }
];

const DEFAULT_VARIANT_CONFIG = {
  spicy: { enabled: false, maxLevel: 3 },
  temperature: { enabled: false, allowIce: true, allowHot: true },
  portion: { enabled: false, jumboPrice: 3000 },
  sugar: { enabled: false },
  custom: { enabled: false, groups: [] }
};

export const ProductFormModal = ({
  isOpen,
  onClose,
  editingProduct,
  onSave,
  isPending
}) => {
  const [productData, setProductData] = useState({
    name: '',
    category: 'Makanan',
    description: '',
    hpp: '',
    price: '',
    stock: '',
    is_available: true
  });

  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [variantConfig, setVariantConfig] = useState(DEFAULT_VARIANT_CONFIG);
  
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [autoSync, setAutoSync] = useState(true);
  const [lastModified, setLastModified] = useState(null); // 'hpp' | 'price'

  // Sync props when modal opens or editing product changes
  useEffect(() => {
    if (isOpen) {
      if (editingProduct) {
        const hpjVal = (editingProduct.price || editingProduct.hpj || '').toString();
        const rawHpp = editingProduct.hpp;
        const hppVal = (rawHpp !== undefined && rawHpp !== null && parseFloat(rawHpp) > 0)
          ? rawHpp.toString()
          : (hpjVal ? Math.max(0, parseInt(hpjVal, 10) - 1000).toString() : '');

        const existingCategory = editingProduct.category || 'Makanan';
        const isPreset = CATEGORY_PRESETS.some(c => c.id.toLowerCase() === existingCategory.toLowerCase());

        setProductData({
          name: editingProduct.name || '',
          category: isPreset ? existingCategory : 'Lainnya',
          description: editingProduct.description || '',
          hpp: hppVal,
          price: hpjVal,
          stock: (editingProduct.stock || 0).toString(),
          is_available: editingProduct.is_available ?? true
        });

        setCustomCategoryInput(isPreset ? '' : existingCategory);

        // Load variant config
        const rawConfig = editingProduct.variant_config;
        if (rawConfig && typeof rawConfig === 'object') {
          const rawGroups = (rawConfig.custom && Array.isArray(rawConfig.custom.groups))
            ? rawConfig.custom.groups
            : [];

          const normalizedGroups = rawGroups.map((g, gIdx) => {
            const rawItems = g.items || g.options || [];
            const items = rawItems.map((it, itIdx) => {
              if (typeof it === 'string') {
                const match = it.match(/\(\+Rp\s*([\d\.,]+)\)/i);
                const price = match ? (parseFloat(match[1].replace(/[\.,]/g, '')) || 0) : 0;
                const name = it.replace(/\s*\(\+Rp[^\)]+\)/i, '').trim();
                return {
                  id: itIdx + 1,
                  name: name || it,
                  price: price
                };
              }
              return {
                id: it.id || (itIdx + 1),
                name: it.name || '',
                price: it.price !== undefined ? parseFloat(it.price) : 0
              };
            });

            const isCheckbox = g.type === 'checkbox' || (!g.type && g.name && (g.name.toLowerCase().includes('topping') || g.name.toLowerCase().includes('tambahan')));
            const groupType = isCheckbox ? 'checkbox' : 'radio';

            return {
              id: g.id || (Date.now() + gIdx),
              name: g.name || '',
              type: groupType,
              required: g.required ?? (groupType === 'radio'),
              items: items.length > 0 ? items : [{ id: 1, name: '', price: 0 }]
            };
          });

          setVariantConfig({
            spicy: {
              enabled: Boolean(rawConfig.spicy?.enabled),
              maxLevel: rawConfig.spicy?.maxLevel || 3,
              label: rawConfig.spicy?.label,
              options: rawConfig.spicy?.options,
              ...rawConfig.spicy
            },
            temperature: {
              enabled: Boolean(rawConfig.temperature?.enabled),
              allowIce: rawConfig.temperature?.allowIce ?? true,
              allowHot: rawConfig.temperature?.allowHot ?? true,
              label: rawConfig.temperature?.label,
              options: rawConfig.temperature?.options,
              ...rawConfig.temperature
            },
            portion: {
              enabled: Boolean(rawConfig.portion?.enabled),
              jumboPrice: rawConfig.portion?.jumboPrice || 3000,
              label: rawConfig.portion?.label,
              options: rawConfig.portion?.options,
              ...rawConfig.portion
            },
            sugar: {
              enabled: Boolean(rawConfig.sugar?.enabled),
              label: rawConfig.sugar?.label,
              options: rawConfig.sugar?.options,
              ...rawConfig.sugar
            },
            custom: {
              enabled: Boolean(rawConfig.custom?.enabled),
              groups: normalizedGroups
            }
          });
        } else {
          setVariantConfig(DEFAULT_VARIANT_CONFIG);
        }

        // Check if current margin is exactly 1000
        const diff = parseInt(hpjVal || 0, 10) - parseInt(hppVal || 0, 10);
        setAutoSync(diff === 1000 || !hpjVal);
        setLastModified(diff === 1000 ? 'hpp' : null);
        setImagePreview(editingProduct.image ? getStorageUrl(editingProduct.image) : null);
        setImageFile(null);
      } else {
        setProductData({
          name: '',
          category: 'Makanan',
          description: '',
          hpp: '',
          price: '',
          stock: '',
          is_available: true
        });
        setCustomCategoryInput('');
        setVariantConfig(DEFAULT_VARIANT_CONFIG);
        setAutoSync(true);
        setLastModified(null);
        setImagePreview(null);
        setImageFile(null);
      }
    }
  }, [isOpen, editingProduct]);

  if (!isOpen) return null;

  const handleHppChange = (e) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, '');
    if (autoSync) {
      if (lastModified === 'price') {
        setAutoSync(false);
        setProductData(prev => ({ ...prev, hpp: rawVal }));
      } else {
        setLastModified('hpp');
        const numHpp = parseInt(rawVal, 10) || 0;
        setProductData(prev => ({
          ...prev,
          hpp: rawVal,
          price: rawVal ? (numHpp + 1000).toString() : ''
        }));
      }
    } else {
      setProductData(prev => ({ ...prev, hpp: rawVal }));
    }
  };

  const handlePriceChange = (e) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, '');
    if (autoSync) {
      if (lastModified === 'hpp') {
        setAutoSync(false);
        setProductData(prev => ({ ...prev, price: rawVal }));
      } else {
        setLastModified('price');
        const numPrice = parseInt(rawVal, 10) || 0;
        setProductData(prev => ({
          ...prev,
          price: rawVal,
          hpp: rawVal ? Math.max(0, numPrice - 1000).toString() : ''
        }));
      }
    } else {
      setProductData(prev => ({ ...prev, price: rawVal }));
    }
  };

  const toggleAutoSync = () => {
    const nextState = !autoSync;
    setAutoSync(nextState);
    if (nextState) {
      setLastModified('hpp');
      if (productData.hpp) {
        const h = parseInt(productData.hpp, 10);
        setProductData(prev => ({ ...prev, price: (h + 1000).toString() }));
      } else if (productData.price) {
        const p = parseInt(productData.price, 10);
        setProductData(prev => ({ ...prev, hpp: Math.max(0, p - 1000).toString() }));
      }
    }
  };

  // Custom Groups Helpers
  const addCustomGroup = () => {
    setVariantConfig(prev => ({
      ...prev,
      custom: {
        ...prev.custom,
        enabled: true,
        groups: [
          ...(prev.custom?.groups || []),
          {
            id: Date.now(),
            name: '',
            type: 'radio', // 'radio' (pilih 1) | 'checkbox' (bisa banyak)
            required: true,
            items: [
              { id: Date.now() + 1, name: '', price: 0 }
            ]
          }
        ]
      }
    }));
  };

  const removeCustomGroup = (groupId) => {
    setVariantConfig(prev => {
      const updated = (prev.custom?.groups || []).filter(g => g.id !== groupId);
      return {
        ...prev,
        custom: {
          ...prev.custom,
          enabled: updated.length > 0,
          groups: updated
        }
      };
    });
  };

  const updateCustomGroup = (groupId, field, value) => {
    setVariantConfig(prev => ({
      ...prev,
      custom: {
        ...prev.custom,
        groups: (prev.custom?.groups || []).map(g => g.id === groupId ? { ...g, [field]: value } : g)
      }
    }));
  };

  const addCustomGroupItem = (groupId) => {
    setVariantConfig(prev => ({
      ...prev,
      custom: {
        ...prev.custom,
        groups: (prev.custom?.groups || []).map(g => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            items: [...(g.items || []), { id: Date.now(), name: '', price: 0 }]
          };
        })
      }
    }));
  };

  const removeCustomGroupItem = (groupId, itemId) => {
    setVariantConfig(prev => ({
      ...prev,
      custom: {
        ...prev.custom,
        groups: (prev.custom?.groups || []).map(g => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            items: (g.items || []).filter(it => it.id !== itemId)
          };
        })
      }
    }));
  };

  const updateCustomGroupItem = (groupId, itemId, field, value) => {
    setVariantConfig(prev => ({
      ...prev,
      custom: {
        ...prev.custom,
        groups: (prev.custom?.groups || []).map(g => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            items: (g.items || []).map(it => it.id === itemId ? { ...it, [field]: value } : it)
          };
        })
      }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalPrice = productData.price || (parseInt(productData.hpp || 0, 10) + 1000).toString();
    const finalHpp = productData.hpp || Math.max(0, parseInt(finalPrice, 10) - 1000).toString();

    const resolvedCategory = productData.category === 'Lainnya' 
      ? (customCategoryInput.trim() || 'Lainnya')
      : productData.category;

    // Clean up empty custom groups/items
    const cleanedVariantConfig = {
      ...variantConfig,
      custom: {
        ...variantConfig.custom,
        groups: (variantConfig.custom?.groups || [])
          .filter(g => g.name && g.name.trim())
          .map(g => {
            const validItems = (g.items || [])
              .filter(it => it.name && it.name.trim())
              .map(it => ({
                id: it.id,
                name: it.name.trim(),
                price: parseFloat(it.price || 0)
              }));
            return {
              id: g.id,
              name: g.name.trim(),
              type: g.type || 'radio',
              required: g.required ?? (g.type === 'radio'),
              items: validItems,
              options: validItems
            };
          })
          .filter(g => g.items.length > 0)
      }
    };

    onSave({
      ...productData,
      category: resolvedCategory,
      variant_config: cleanedVariantConfig,
      hpp: finalHpp,
      hpj: finalPrice,
      price: finalPrice
    }, imageFile);
  };

  const formatRupiah = (value) => {
    if (!value && value !== 0) return '';
    return 'Rp ' + parseInt(value, 10).toLocaleString('id-ID');
  };

  const hppNum = parseInt(productData.hpp || 0, 10);
  const hpjNum = parseInt(productData.price || 0, 10);
  const profit = hpjNum - hppNum;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 w-full sm:max-w-lg rounded-none border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 flex items-center justify-center rounded-none font-bold">
              <Utensils className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
              {editingProduct ? 'Edit Menu & Opsi Produk' : 'Tambah Menu Baru'}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3">
          {/* Foto Produk */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Foto Produk</label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-none bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden flex items-center justify-center shrink-0">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    if (file.size > 2 * 1024 * 1024) {
                      toast.error('Ukuran foto produk maksimal 2 MB');
                      e.target.value = '';
                      return;
                    }
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                  }
                }}
                className="block w-full text-xs text-gray-500 dark:text-gray-400 file:mr-2.5 file:py-1 file:px-2.5 file:rounded-none file:border-0 file:text-[11px] file:font-bold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 dark:file:bg-green-950/60 dark:file:text-green-300 border border-gray-200 dark:border-gray-700 p-1 rounded-none" 
              />
            </div>
          </div>

          {/* Nama Produk */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Nama Produk <span className="text-red-500">*</span>
            </label>
            <input 
              required 
              type="text" 
              placeholder="Misal: Nasi Ayam Geprek / Es Teh Manis" 
              value={productData.name} 
              onChange={e => setProductData({...productData, name: e.target.value})} 
              className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-2 text-xs font-semibold focus:border-green-600 focus:outline-hidden transition-colors" 
            />
          </div>

          {/* Kategori Produk (Pilihan Standar) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Kategori Produk <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {CATEGORY_PRESETS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setProductData({ ...productData, category: cat.id })}
                  className={`py-1.5 px-2 text-xs font-bold rounded-none border transition-colors cursor-pointer text-center ${
                    productData.category === cat.id
                      ? 'bg-green-600 text-white border-green-600 shadow-2xs'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {productData.category === 'Lainnya' && (
              <div className="mt-1.5">
                <input
                  type="text"
                  placeholder="Ketik kategori khusus (misal: Sembako, Alat Tulis)..."
                  value={customCategoryInput}
                  onChange={(e) => setCustomCategoryInput(e.target.value)}
                  className="w-full rounded-none border border-amber-300 dark:border-amber-700 dark:bg-gray-800 dark:text-white p-2 text-xs focus:border-amber-600 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {/* Catatan / Deskripsi Produk Toko */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Catatan / Deskripsi Produk <span className="text-gray-400 font-normal">(Opsional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Misal: Sudah termasuk sambal dan lalapan / Menggunakan gula asli..."
              value={productData.description}
              onChange={e => setProductData({ ...productData, description: e.target.value })}
              className="w-full rounded-none border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-2 text-xs focus:border-green-600 focus:outline-hidden transition-colors"
            />
          </div>

          {/* ============================================================== */}
          {/* SEKSI PILIHAN & VARIAN PRODUK (CENTANG SESUAI KEBUTUHAN) */}
          {/* ============================================================== */}
          <div className="border border-green-200 dark:border-green-900/60 bg-green-50/30 dark:bg-green-950/20 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-green-900 dark:text-green-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                Pilihan Varian Produk
              </span>
              <span className="text-[10px] text-green-700 dark:text-green-400 font-medium">
                Centang yang ingin digunakan
              </span>
            </div>

            <div className="space-y-2">
              {/* 1. LEVEL PEDAS */}
              <div className="bg-white dark:bg-gray-800/80 p-2.5 border border-gray-200 dark:border-gray-700 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={variantConfig.spicy.enabled}
                    onChange={(e) => setVariantConfig(prev => ({
                      ...prev,
                      spicy: { ...prev.spicy, enabled: e.target.checked }
                    }))}
                    className="w-3.5 h-3.5 text-green-600 focus:ring-green-500 rounded-none cursor-pointer"
                  />
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-red-500" />
                    Level Kepedasan
                  </span>
                </label>

                {variantConfig.spicy.enabled && (
                  <div className="pl-5 pt-1 space-y-1.5 border-t border-gray-100 dark:border-gray-700/60">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400 text-[11px]">Tingkat Pedas Maksimal:</span>
                      <select
                        value={variantConfig.spicy.maxLevel}
                        onChange={(e) => setVariantConfig(prev => ({
                          ...prev,
                          spicy: { ...prev.spicy, maxLevel: parseInt(e.target.value, 10) }
                        }))}
                        className="px-2 py-1 rounded-none border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-xs font-bold text-gray-800 dark:text-white"
                      >
                        <option value={3}>Level 0 s/d Level 3 (Standar)</option>
                        <option value={5}>Level 0 s/d Level 5 (Pedas Ekstra)</option>
                        <option value={10}>Level 0 s/d Level 10 (Maksimal)</option>
                      </select>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      💡 Pembeli dapat memilih Level 0 (Tidak Pedas), Level 1, dst. saat memasukkan ke keranjang.
                    </p>
                  </div>
                )}
              </div>

              {/* 2. PILIHAN SUHU (ES / PANAS) */}
              <div className="bg-white dark:bg-gray-800/80 p-2.5 border border-gray-200 dark:border-gray-700 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={variantConfig.temperature.enabled}
                    onChange={(e) => setVariantConfig(prev => ({
                      ...prev,
                      temperature: { ...prev.temperature, enabled: e.target.checked }
                    }))}
                    className="w-3.5 h-3.5 text-green-600 focus:ring-green-500 rounded-none cursor-pointer"
                  />
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                    <Coffee className="w-3.5 h-3.5 text-blue-500" />
                    Pilihan Suhu (Es / Hangat)
                  </span>
                </label>

                {variantConfig.temperature.enabled && (
                  <div className="pl-5 pt-1 space-y-1 border-t border-gray-100 dark:border-gray-700/60">
                    <div className="flex gap-4 text-xs font-semibold text-gray-700 dark:text-gray-300">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span> 🧊 Dingin / Es (Ice)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span> ☕ Hangat / Panas (Hot)
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      💡 Pembeli akan diminta memilih suhu es atau hangat saat memesan.
                    </p>
                  </div>
                )}
              </div>

              {/* 3. UKURAN PORSI (BIASA / JUMBO) */}
              <div className="bg-white dark:bg-gray-800/80 p-2.5 border border-gray-200 dark:border-gray-700 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={variantConfig.portion.enabled}
                    onChange={(e) => setVariantConfig(prev => ({
                      ...prev,
                      portion: { ...prev.portion, enabled: e.target.checked }
                    }))}
                    className="w-3.5 h-3.5 text-green-600 focus:ring-green-500 rounded-none cursor-pointer"
                  />
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                    <Utensils className="w-3.5 h-3.5 text-emerald-600" />
                    Ukuran Porsi (Biasa / Jumbo)
                  </span>
                </label>

                {variantConfig.portion.enabled && (
                  <div className="pl-5 pt-1 space-y-1.5 border-t border-gray-100 dark:border-gray-700/60">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400 text-[11px]">Tambahan Biaya Porsi Jumbo:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400 font-mono">+Rp</span>
                        <input
                          type="number"
                          min={0}
                          step={500}
                          placeholder="3000"
                          value={variantConfig.portion.jumboPrice}
                          onChange={(e) => setVariantConfig(prev => ({
                            ...prev,
                            portion: { ...prev.portion, jumboPrice: parseInt(e.target.value, 10) || 0 }
                          }))}
                          className="w-24 px-2 py-1 text-xs font-mono font-bold rounded-none border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      💡 Porsi Biasa = Harga Normal. Porsi Jumbo = Harga Normal + Rp {parseInt(variantConfig.portion.jumboPrice || 0, 10).toLocaleString('id-ID')}.
                    </p>
                  </div>
                )}
              </div>

              {/* 4. TINGKAT MANIS / GULA */}
              <div className="bg-white dark:bg-gray-800/80 p-2.5 border border-gray-200 dark:border-gray-700 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={variantConfig.sugar.enabled}
                    onChange={(e) => setVariantConfig(prev => ({
                      ...prev,
                      sugar: { ...prev.sugar, enabled: e.target.checked }
                    }))}
                    className="w-3.5 h-3.5 text-green-600 focus:ring-green-500 rounded-none cursor-pointer"
                  />
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                    <Coffee className="w-3.5 h-3.5 text-amber-600" />
                    Tingkat Manis / Kadar Gula
                  </span>
                </label>

                {variantConfig.sugar.enabled && (
                  <div className="pl-5 pt-1 space-y-1 border-t border-gray-100 dark:border-gray-700/60">
                    <p className="text-[11px] text-gray-700 dark:text-gray-300 font-semibold">
                      Opsi: Normal (100%), Sedikit Gula (Less Sugar), Tanpa Gula (Tawar).
                    </p>
                  </div>
                )}
              </div>

              {/* 5. LAINNYA: GRUP OPSI TAMBAHAN KUSTOM (DINAMIS) */}
              <div className="bg-white dark:bg-gray-800/80 p-2.5 border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={variantConfig.custom.enabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setVariantConfig(prev => ({
                          ...prev,
                          custom: {
                            ...prev.custom,
                            enabled: checked,
                            groups: checked && (!prev.custom?.groups || prev.custom.groups.length === 0)
                              ? [{
                                  id: Date.now(),
                                  name: '',
                                  type: 'radio',
                                  required: true,
                                  items: [{ id: Date.now() + 1, name: '', price: 0 }]
                                }]
                              : (prev.custom?.groups || [])
                          }
                        }));
                      }}
                      className="w-3.5 h-3.5 text-green-600 focus:ring-green-500 rounded-none cursor-pointer"
                    />
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      Lainnya: Buat Pilihan Tambahan Kustom
                    </span>
                  </label>
                  
                  {variantConfig.custom.enabled && (
                    <button
                      type="button"
                      onClick={addCustomGroup}
                      className="px-2 py-0.5 bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-300 dark:border-green-800 text-[10px] font-bold rounded-none flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Tambah Grup
                    </button>
                  )}
                </div>

                {variantConfig.custom.enabled && (
                  <div className="pl-1 sm:pl-3 pt-2 space-y-3 border-t border-gray-100 dark:border-gray-700/60">
                    <p className="text-[10.5px] text-gray-500 dark:text-gray-400">
                      💡 Tambahkan pilihan bebas untuk menu ini (Contoh: <strong>Pilihan Sambal</strong>, <strong>Bagian Ayam</strong>, <strong>Topping Seblak</strong>).
                    </p>

                    {(variantConfig.custom?.groups || []).map((group, gIdx) => (
                      <div key={group.id} className="p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            placeholder="Nama Grup Opsi (Cth: Pilihan Sambal / Bagian Ayam)"
                            value={group.name}
                            onChange={(e) => updateCustomGroup(group.id, 'name', e.target.value)}
                            className="flex-1 px-2 py-1 text-xs font-bold rounded-none border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => removeCustomGroup(group.id)}
                            className="p-1 text-red-500 hover:text-red-700 cursor-pointer"
                            title="Hapus Grup Opsi Ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Aturan Pilih: Radio (Wajib 1) / Checkbox (Bisa Banyak) */}
                        <div className="flex items-center gap-3 text-[11px] text-gray-600 dark:text-gray-300">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`group_type_${group.id}`}
                              checked={group.type === 'radio'}
                              onChange={() => updateCustomGroup(group.id, 'type', 'radio')}
                              className="text-green-600"
                            />
                            <span>Pilih 1 Saja (Wajib)</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`group_type_${group.id}`}
                              checked={group.type === 'checkbox'}
                              onChange={() => updateCustomGroup(group.id, 'type', 'checkbox')}
                              className="text-green-600"
                            />
                            <span>Bisa Pilih Banyak (Opsional)</span>
                          </label>
                        </div>

                        {/* Daftar Pilihan dalam Grup */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                              Daftar Pilihan:
                            </span>
                            {group.type === 'radio' && (
                              <span className="text-[9.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                                ★ Opsi paling atas = Pilihan Default
                              </span>
                            )}
                          </div>
                          {(group.items || []).map((it, itIdx) => (
                            <div key={it.id} className="flex items-center gap-1.5">
                              {group.type === 'radio' && itIdx === 0 && (
                                <span className="px-1.5 py-1 text-[8.5px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-none shrink-0" title="Pilihan urutan teratas ini otomatis terpilih sebagai default">
                                  DEFAULT
                                </span>
                              )}
                              <input
                                type="text"
                                placeholder={
                                  group.type === 'radio' && itIdx === 0 
                                    ? "Opsi 1 (Default Terpilih, Cth: Normal / Paha Atas)" 
                                    : `Opsi ${itIdx + 1} (Cth: Sambal Matah / Strong)`
                                }
                                value={it.name}
                                onChange={(e) => updateCustomGroupItem(group.id, it.id, 'name', e.target.value)}
                                className="flex-1 px-2 py-1 text-xs rounded-none border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              />
                              <div className="flex items-center gap-0.5">
                                <span className="text-[9.5px] text-gray-400 font-mono">+Rp</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={500}
                                  placeholder="0"
                                  value={it.price === 0 ? '' : it.price}
                                  onChange={(e) => updateCustomGroupItem(group.id, it.id, 'price', parseInt(e.target.value, 10) || 0)}
                                  className="w-16 px-1.5 py-1 text-xs font-mono font-bold rounded-none border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                  title="Tambahan harga (0 jika gratis)"
                                />
                              </div>
                              {(group.items || []).length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeCustomGroupItem(group.id, it.id)}
                                  className="text-gray-400 hover:text-red-500 p-1 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => addCustomGroupItem(group.id)}
                            className="mt-1 text-[10.5px] font-bold text-green-600 hover:text-green-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Tambah Pilihan Opsi
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* HARGA & MARGIN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  HPP (Harga Pokok) <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold px-1.5 py-0.2 rounded-none border border-amber-200 dark:border-amber-800">
                  Modal Toko
                </span>
              </div>
              <input 
                required 
                type="text" 
                placeholder="Cth: 23.000" 
                value={formatRupiah(productData.hpp)} 
                onChange={handleHppChange} 
                className="w-full rounded-none font-mono border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-2 text-xs focus:border-green-600 focus:outline-hidden transition-colors" 
              />
              <p className="text-[10px] text-gray-400 mt-0.5">Biaya modal pokok</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  HPJ (Harga Jual) <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 font-bold px-1.5 py-0.2 rounded-none border border-green-200 dark:border-green-800">
                  Harga Santri
                </span>
              </div>
              <input 
                required 
                type="text" 
                placeholder="Cth: 24.000" 
                value={formatRupiah(productData.price)} 
                onChange={handlePriceChange} 
                className="w-full rounded-none font-mono border border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-green-700 dark:text-green-400 p-2 text-xs font-bold focus:border-green-600 focus:outline-hidden transition-colors" 
              />
              <p className="text-[10px] text-gray-400 mt-0.5">Harga jual santri</p>
            </div>
          </div>

          {/* SYNC INDICATOR / MODE TOGGLE */}
          <div className="flex items-center justify-between px-3 py-2 rounded-none bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-xs">
            <span className="text-[11px] text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
              {autoSync ? (
                <>
                  <span className="w-2 h-2 rounded-none bg-green-500 animate-pulse"></span>
                  <span>Sinkronisasi otomatis (+Rp 1.000)</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-none bg-amber-500"></span>
                  <span>Mode manual bebas</span>
                </>
              )}
            </span>
            <button
              type="button"
              onClick={toggleAutoSync}
              className={`text-[10px] font-bold px-2 py-1 rounded-none transition-all cursor-pointer ${
                autoSync
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
                  : 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 hover:bg-green-200'
              }`}
            >
              {autoSync ? 'Bebaskan Manual' : '⚡ Sinkronkan (+Rp 1.000)'}
            </button>
          </div>

          {/* LIVE MARGIN & PROFIT PREVIEW */}
          {hpjNum > 0 && (
            <div className="p-2.5 bg-gray-50 dark:bg-gray-800/80 rounded-none border border-gray-200 dark:border-gray-700 text-xs space-y-1">
              <div className="flex justify-between items-center text-gray-600 dark:text-gray-400 text-[11px]">
                <span>Modal Pokok (HPP):</span>
                <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{formatRupiah(hppNum)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600 dark:text-gray-400 text-[11px]">
                <span>Harga Jual Santri (HPJ):</span>
                <span className="font-mono font-semibold text-gray-900 dark:text-white">{formatRupiah(hpjNum)}</span>
              </div>
              <div className="pt-1.5 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center font-bold">
                <span className="text-gray-700 dark:text-gray-300">Estimasi Keuntungan / Porsi:</span>
                <span className={`text-xs px-2 py-0.5 rounded-none font-bold font-mono ${
                  profit > 0 
                    ? 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300 border border-green-200 dark:border-green-800' 
                    : profit === 0 
                      ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' 
                      : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800'
                }`}>
                  {profit > 0 ? `+${formatRupiah(profit)}` : formatRupiah(profit)}
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Status Ketersediaan</label>
            <div className="flex gap-2 mt-1">
              <label className={`flex items-center gap-2 cursor-pointer p-2 border rounded-none flex-1 transition-colors ${
                productData.is_available 
                  ? 'border-green-600 bg-green-50/50 dark:bg-green-950/30' 
                  : 'border-gray-200 dark:border-gray-700 bg-transparent'
              }`}>
                <input type="radio" name="is_available" checked={productData.is_available} onChange={() => setProductData({...productData, is_available: true})} className="text-green-600 focus:ring-green-500 w-3.5 h-3.5" />
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Tersedia</span>
              </label>
              <label className={`flex items-center gap-2 cursor-pointer p-2 border rounded-none flex-1 transition-colors ${
                !productData.is_available 
                  ? 'border-red-600 bg-red-50/50 dark:bg-red-950/30' 
                  : 'border-gray-200 dark:border-gray-700 bg-transparent'
              }`}>
                <input type="radio" name="is_available" checked={!productData.is_available} onChange={() => setProductData({...productData, is_available: false})} className="text-red-600 focus:ring-red-500 w-3.5 h-3.5" />
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Habis</span>
              </label>
            </div>
          </div>

          <div className="pt-2 mt-1 flex gap-2 border-t border-gray-100 dark:border-gray-800">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-2 text-xs font-bold text-gray-700 bg-gray-100 rounded-none hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700 cursor-pointer"
            >
              Batal
            </button>
            <button 
              type="submit" 
              disabled={isPending} 
              className="flex-[2] py-2 text-xs font-bold text-white bg-green-600 rounded-none hover:bg-green-700 disabled:opacity-70 flex items-center justify-center shadow-xs transition-colors cursor-pointer"
            >
              {isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Simpan Menu'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
