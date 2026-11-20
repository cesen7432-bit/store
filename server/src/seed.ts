/**
 * Datos iniciales. Se ejecuta automáticamente al arrancar el servidor (solo inserta lo que falta)
 * y también se puede correr a mano: `npm run seed`.
 *  - Categorías y cupones de temporada (estructura base)
 *  - Administrador inicial (si no existe ningún admin)
 */
import { CATEGORIES, COUPONS } from '../../src/data/mock.js'
import { hashPassword } from './auth.js'
import { config } from './config.js'
import { migrate } from './db.js'
import { categories, coupons, users } from './repo.js'
import { normalizeEcPhone } from './otp.js'

export async function seed() {
  migrate()

  // categorías: se sincronizan con src/data/mock.ts en cada arranque
  CATEGORIES.forEach((c, i) => categories.upsert(c, i))

  // cupones de las temporadas (los anuncia el banner); el admin puede desactivarlos
  if (coupons.list().length === 0) {
    COUPONS.forEach((c) => coupons.save({ ...c, active: true }))
    console.log(`[seed] ${COUPONS.length} cupones de temporada`)
  }

  // cupón de bienvenida (por crear cuenta), aunque la base ya tenga otros cupones
  const welcome = COUPONS.find((c) => c.firstOrderOnly)
  if (welcome && !coupons.list().some((c) => c.code === welcome.code)) {
    coupons.save({ ...welcome, active: true })
    console.log(`[seed] cupón de bienvenida ${welcome.code}`)
  }


  if (users.countAdmins() === 0) {
    const phone = normalizeEcPhone(config.adminPhone)
    if (!phone) throw new Error('ADMIN_PHONE no es un celular válido de Ecuador (09XXXXXXXX)')
    const existing = users.byEmail(config.adminEmail)
    if (existing) {
      users.setRole(existing.id, 'admin')
      console.log(`[seed] ${config.adminEmail} ahora es administrador`)
    } else {
      users.create({
        name: config.adminName,
        email: config.adminEmail,
        phone,
        role: 'admin',
        phoneVerified: true,
        passwordHash: await hashPassword(config.adminPassword),
      })
      console.log('──────────────────────────────────────────────')
      console.log('[seed] Administrador creado')
      console.log(`       correo:     ${config.adminEmail}`)
      if (!process.env.ADMIN_PASSWORD) console.log(`       contraseña: ${config.adminPassword}   ← guárdala, no se volverá a mostrar`)
      console.log(`       celular 2FA: ${phone}`)
      console.log('──────────────────────────────────────────────')
    }
  }
}

// `npm run seed` (solo cuando se ejecuta este archivo directamente, no cuando está empaquetado dentro de index.js)
if (/seed\.(ts|js)$/.test(process.argv[1] ?? '')) {
  seed().then(() => console.log('[seed] listo'))
}
