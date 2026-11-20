import clsx from 'clsx'
import { Icon } from './Icon'
import { mediaUrl } from '../../config/store'

/**
 * Imagen del producto. Si hay foto real la muestra; si no, una ilustración sobria
 * (fondo oscuro, retícula de puntos y el ícono de su tipo con un leve tono de color).
 */
export function ProductArt({
  image,
  icon,
  gradient,
  className,
  iconSize = 56,
  alt = '',
}: {
  image?: string
  icon: string
  gradient: [string, string]
  className?: string
  iconSize?: number
  alt?: string
}) {
  if (image) {
    return <img src={mediaUrl(image)} alt={alt} className={clsx('h-full w-full bg-white object-contain', className)} loading="lazy" decoding="async" />
  }
  const [a] = gradient
  return (
    <div
      className={clsx('relative flex h-full w-full items-center justify-center overflow-hidden', className)}
      style={{
        background: `radial-gradient(circle at 50% 45%, ${a}26, transparent 65%), #141418`,
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1.2px)', backgroundSize: '14px 14px' }}
      />
      <Icon name={icon} size={iconSize} strokeWidth={1.3} className="relative" color={`color-mix(in oklab, ${a} 45%, white)`} />
    </div>
  )
}
