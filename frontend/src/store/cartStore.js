import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Global Cart Store
 * 
 * Structure:
 * {
 *   [canteen_id]: {
 *     canteen: { id, name, whatsapp_number, delivery_fee, is_open, ... },
 *     items: {
 *       [product_id]: { product: {...}, quantity: N }
 *     }
 *   }
 * }
 */
export const useCartStore = create(
  persist(
    (set, get) => ({
      cart: {}, // keyed by canteen_id

      // Add item to cart from a specific canteen (supports variants & options)
      addItem: (canteen, product, quantityToAdd = 1, options = null, notes = '') => {
        set((state) => {
          const canteenId = String(canteen.id);
          const baseProductId = String(product.id);
          const itemKey = options?.variantKey ? `${baseProductId}_${options.variantKey}` : baseProductId;
          
          const prevCanteenCart = state.cart[canteenId] || { canteen, items: {} };
          const prevItem = prevCanteenCart.items[itemKey];
          const newQuantity = prevItem ? prevItem.quantity + quantityToAdd : quantityToAdd;

          if (newQuantity > 99) return state; // guard max qty

          const extraPrice = options?.extraPrice ? parseFloat(options.extraPrice) : 0;
          const basePrice = parseFloat(product.discount_price || product.price || 0);
          const effectivePrice = basePrice + extraPrice;

          const itemProduct = {
            ...product,
            price: effectivePrice,
            base_price: basePrice
          };

          return {
            cart: {
              ...state.cart,
              [canteenId]: {
                canteen,
                items: {
                  ...prevCanteenCart.items,
                  [itemKey]: {
                    product: itemProduct,
                    quantity: newQuantity,
                    options: options?.labels || [],
                    extraPrice: extraPrice,
                    notes: notes || prevItem?.notes || ''
                  }
                }
              }
            }
          };
        });
      },

      // Update item note (e.g. pedas level 2, es sedikit)
      updateItemNote: (canteenId, itemKeyOrProductId, notes) => {
        set((state) => {
          const cid = String(canteenId);
          const key = String(itemKeyOrProductId);
          const prevCanteenCart = state.cart[cid];
          if (!prevCanteenCart) return state;

          const targetKey = prevCanteenCart.items[key]
            ? key
            : Object.keys(prevCanteenCart.items).find(k => String(prevCanteenCart.items[k]?.product?.id) === key);

          if (!targetKey) return state;

          return {
            cart: {
              ...state.cart,
              [cid]: {
                ...prevCanteenCart,
                items: {
                  ...prevCanteenCart.items,
                  [targetKey]: { ...prevCanteenCart.items[targetKey], notes }
                }
              }
            }
          };
        });
      },

      // Increment quantity of a specific item key
      incrementItem: (canteenId, itemKeyOrProductId) => {
        set((state) => {
          const cid = String(canteenId);
          const key = String(itemKeyOrProductId);
          const prevCanteenCart = state.cart[cid];
          if (!prevCanteenCart) return state;

          const targetKey = prevCanteenCart.items[key]
            ? key
            : Object.keys(prevCanteenCart.items).find(k => String(prevCanteenCart.items[k]?.product?.id) === key);

          if (!targetKey) return state;
          const prevItem = prevCanteenCart.items[targetKey];
          if (prevItem.quantity >= 99) return state;

          return {
            cart: {
              ...state.cart,
              [cid]: {
                ...prevCanteenCart,
                items: {
                  ...prevCanteenCart.items,
                  [targetKey]: { ...prevItem, quantity: prevItem.quantity + 1 }
                }
              }
            }
          };
        });
      },

      // Remove one unit; if 0, remove item from canteen; if canteen empty, remove canteen
      removeItem: (canteenId, itemKeyOrProductId) => {
        set((state) => {
          const cid = String(canteenId);
          const key = String(itemKeyOrProductId);
          const prevCanteenCart = state.cart[cid];
          if (!prevCanteenCart) return state;

          const targetKey = prevCanteenCart.items[key]
            ? key
            : Object.keys(prevCanteenCart.items).find(k => String(prevCanteenCart.items[k]?.product?.id) === key);

          if (!targetKey) return state;
          const prevItem = prevCanteenCart.items[targetKey];

          let newItems;
          if (prevItem.quantity > 1) {
            newItems = {
              ...prevCanteenCart.items,
              [targetKey]: { ...prevItem, quantity: prevItem.quantity - 1 }
            };
          } else {
            newItems = { ...prevCanteenCart.items };
            delete newItems[targetKey];
          }

          // If canteen has no more items, remove it
          if (Object.keys(newItems).length === 0) {
            const newCart = { ...state.cart };
            delete newCart[cid];
            return { cart: newCart };
          }

          return {
            cart: {
              ...state.cart,
              [cid]: { ...prevCanteenCart, items: newItems }
            }
          };
        });
      },

      // Remove all items from a specific canteen
      clearCanteen: (canteenId) => {
        set((state) => {
          const newCart = { ...state.cart };
          delete newCart[String(canteenId)];
          return { cart: newCart };
        });
      },

      // Clear all
      clearAll: () => set({ cart: {} }),

      // Getters
      getTotalItems: () => {
        const { cart } = get();
        return Object.values(cart).reduce((sum, c) =>
          sum + Object.values(c.items).reduce((s, i) => s + i.quantity, 0), 0
        );
      },

      getCanteenItems: (canteenId) => {
        const { cart } = get();
        return cart[String(canteenId)]?.items || {};
      },
    }),
    {
      name: 'higo-cart',
    }
  )
);
