import type { CartItem, Order, Product } from '../types'

// Configuración general de la tienda
export const STORE = {
  name: 'CECOM',
  tagline: 'Electrónica · Corte láser · Proyectos',
  currency: 'USD',
  locale: 'es-EC',
  /** Número en formato internacional sin "+" ni espacios (para wa.me y tel:) */
  whatsapp: '593963657256',
  phoneDisplay: '+593 96 365 7256',
  email: 'ventas@apps-cecom.cloud',
  city: 'Loja, Ecuador',
}

/**
 * Zonas de envío a domicilio. Desde `freeFrom` el envío es gratis;
 * por debajo, el valor se coordina por WhatsApp (no se suma al total).
 */
export const SHIPPING = {
  loja: { label: 'Loja', detail: 'Entrega a domicilio en la ciudad de Loja', freeFrom: 20 },
  nacional: { label: 'Resto del Ecuador', detail: 'Envío a domicilio a nivel nacional', freeFrom: 50 },
} as const
export type ShippingZone = keyof typeof SHIPPING

export const isFreeShipping = (zone: ShippingZone, amount: number) => amount >= SHIPPING[zone].freeFrom
export const SHIPPING_PENDING_LABEL = 'Por coordinar'

export const formatPrice = (n: number) =>
  new Intl.NumberFormat(STORE.locale, {
    style: 'currency',
    currency: STORE.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)

/** Ruta base de la tienda (p. ej. "/store/") */
// (este archivo también lo usa el backend en Node, donde import.meta.env no existe)
export const BASE: string = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'

/** Los archivos subidos se guardan como "/uploads/x"; se sirven bajo la ruta base de la tienda */
export const mediaUrl = (u?: string) => (u && u.startsWith('/uploads/') ? BASE + u.slice(1) : (u ?? ''))

/** Enlace a WhatsApp con un mensaje prellenado */
export const whatsappLink = (message = '¡Hola CECOM! Quisiera más información.') =>
  `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(message)}`

/** Mensaje para consultar/pedir un producto por WhatsApp */
export function productWhatsappMessage(product: Product, quantity = 1, note?: string) {
  const url = `${window.location.origin}${BASE}producto/${product.slug}`
  return [
    `¡Hola CECOM! 👋 Me interesa este producto:`,
    ``,
    `🛒 *${product.name}*`,
    `Cantidad: ${quantity}`,
    `Precio: ${formatPrice(product.price)} c/u`,
    note ? `Personalización: ${note}` : null,
    ``,
    url,
  ]
    .filter((l) => l !== null)
    .join('\n')
}

/** Orden de compra registrada → mensaje de WhatsApp para la tienda */
export function orderWhatsappMessage(o: Order) {
  const zone = SHIPPING[o.shippingZone ?? 'nacional']
  return [
    `🧾 *ORDEN DE COMPRA ${o.id}*`,
    `Fecha: ${new Date(o.createdAt).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}`,
    ``,
    ...o.items.map((i) => `• ${i.quantity} × ${i.name} — ${formatPrice(i.price * i.quantity)}${i.note ? `\n   ✎ ${i.note}` : ''}`),
    ``,
    `Subtotal: ${formatPrice(o.subtotal)}`,
    o.discount > 0 ? `Descuento${o.couponCode ? ` (${o.couponCode})` : ''}: -${formatPrice(o.discount)}` : null,
    `Envío a domicilio (${zone.label}): ${o.shippingPending ? 'por coordinar' : o.shipping > 0 ? formatPrice(o.shipping) : 'GRATIS'}`,
    `*TOTAL: ${formatPrice(o.total)}*${o.shippingPending ? ' + envío' : ''}`,
    ``,
    `👤 ${o.customer.name} · ${o.customer.phone}`,
    `📍 ${o.customer.address}, ${o.customer.city}`,
    ``,
    `¿Cómo puedo realizar el pago?`,
  ]
    .filter((l) => l !== null)
    .join('\n')
}

/** Mensaje con el carrito completo */
export function cartWhatsappMessage(items: CartItem[], total: number, coupon?: string) {
  const lines = items.map(
    (i) => `• ${i.quantity} × ${i.product.name} — ${formatPrice(i.product.price * i.quantity)}${i.note ? `\n   ✎ ${i.note}` : ''}`,
  )
  return [
    `¡Hola CECOM! 👋 Quiero hacer este pedido:`,
    ``,
    ...lines,
    ``,
    coupon ? `Cupón: ${coupon}` : null,
    `*Total: ${formatPrice(total)}*`,
  ]
    .filter((l) => l !== null)
    .join('\n')
}
