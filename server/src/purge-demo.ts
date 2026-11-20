/**
 * Elimina los datos de EJEMPLO que versiones anteriores del seed cargaban
 * (25 productos, 6 proyectos y el cupón MAKER10). No toca usuarios, pedidos,
 * cotizaciones, reseñas ni productos importados (los que tienen SKU).
 *
 *   Desarrollo: cd server && npm run purge-demo
 *   Docker:     docker compose exec api node dist/purge-demo.js
 */
import { PRODUCTS, PROJECTS } from '../../src/data/mock.js'
import { db, migrate, tx } from './db.js'

migrate()

const result = tx(() => {
  let products = 0
  for (const p of PRODUCTS) {
    // solo si sigue siendo el de ejemplo: mismo id y sin SKU de inventario
    products += Number(db.prepare("DELETE FROM products WHERE id = ? AND json_extract(data, '$.sku') IS NULL").run(p.id).changes)
  }
  let projects = 0
  for (const p of PROJECTS) projects += Number(db.prepare('DELETE FROM projects WHERE id = ?').run(p.id).changes)
  const coupons = Number(db.prepare("DELETE FROM coupons WHERE code = 'MAKER10'").run().changes)
  return { products, projects, coupons }
})

console.log(`[purge-demo] eliminados: ${result.products} productos, ${result.projects} proyectos y ${result.coupons} cupón de ejemplo`)
