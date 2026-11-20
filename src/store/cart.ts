import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, Coupon, Product } from '../types'
import { isFreeShipping, SHIPPING, type ShippingZone } from '../config/store'

interface CartState {
  items: CartItem[]
  coupon: Coupon | null
  isOpen: boolean
  favorites: string[]
  shippingZone: ShippingZone
  setShippingZone: (z: ShippingZone) => void
  add: (product: Product, quantity?: number, note?: string) => void
  remove: (id: string) => void
  setQuantity: (id: string, quantity: number) => void
  clear: () => void
  setCoupon: (c: Coupon | null) => void
  open: () => void
  close: () => void
  toggleFavorite: (id: string) => void
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      coupon: null,
      isOpen: false,
      favorites: [],
      shippingZone: 'loja',
      setShippingZone: (shippingZone) => set({ shippingZone }),
      add: (product, quantity = 1, note) =>
        set((s) => {
          const existing = s.items.find((i) => i.product.id === product.id)
          const items = existing
            ? s.items.map((i) =>
                i.product.id === product.id ? { ...i, quantity: Math.min(i.quantity + quantity, product.stock) } : i,
              )
            : [...s.items, { product, quantity, note }]
          return { items }
        }),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.product.id !== id) })),
      setQuantity: (id, quantity) =>
        set((s) => ({
          items: s.items
            .map((i) => (i.product.id === id ? { ...i, quantity: Math.min(quantity, i.product.stock) } : i))
            .filter((i) => i.quantity > 0),
        })),
      clear: () => set({ items: [], coupon: null }),
      setCoupon: (coupon) => set({ coupon }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [...s.favorites, id],
        })),
    }),
    {
      name: 'cecom-cart',
      partialize: (s) => ({ items: s.items, coupon: s.coupon, favorites: s.favorites, shippingZone: s.shippingZone }),
    },
  ),
)

/** Totales derivados del carrito */
export function useCartTotals() {
  const items = useCart((s) => s.items)
  const coupon = useCart((s) => s.coupon)
  const count = items.reduce((n, i) => n + i.quantity, 0)
  const subtotal = items.reduce((n, i) => n + i.product.price * i.quantity, 0)
  const discount = coupon ? Math.round(subtotal * coupon.percent) / 100 : 0
  const zone = useCart((s) => s.shippingZone)
  const net = subtotal - discount
  const shipping = 0 // si no es gratis, se coordina por WhatsApp
  const shippingPending = subtotal > 0 && !isFreeShipping(zone, net)
  const total = net
  const freeFrom = SHIPPING[zone].freeFrom
  const toFreeShipping = Math.max(0, freeFrom - net)
  return { count, subtotal, discount, shipping, shippingPending, total, toFreeShipping, zone, freeFrom }
}
