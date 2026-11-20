/**
 * Base de datos SQLite (módulo nativo node:sqlite, sin dependencias externas).
 * Las entidades con muchos campos (producto, pedido…) se guardan como JSON en `data`
 * y las columnas que se filtran/ordenan se guardan aparte e indexadas.
 */
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { config } from './config.js'

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true })

export const db = new DatabaseSync(config.dbFile)
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT NOT NULL,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  birth_date    TEXT,
  address       TEXT,
  city          TEXT,
  role          TEXT NOT NULL DEFAULT 'cliente' CHECK (role IN ('admin','cliente')),
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

-- un celular = una cuenta (es el factor de 2FA y la base del uso único de cupones)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

CREATE TABLE IF NOT EXISTS categories (
  id       TEXT PRIMARY KEY,
  position INTEGER NOT NULL DEFAULT 0,
  data     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  category    TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  price       REAL NOT NULL,
  stock       INTEGER NOT NULL,
  featured    INTEGER NOT NULL DEFAULT 0,
  is_new      INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  data        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category, subcategory);

CREATE TABLE IF NOT EXISTS projects (
  id         TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  data       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coupons (
  code        TEXT PRIMARY KEY,
  percent     INTEGER NOT NULL CHECK (percent BETWEEN 1 AND 90),
  description TEXT NOT NULL DEFAULT '',
  active      INTEGER NOT NULL DEFAULT 1,
  first_order_only INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT UNIQUE,
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  email      TEXT NOT NULL,
  status     TEXT NOT NULL,
  total      REAL NOT NULL,
  created_at TEXT NOT NULL,
  data       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);

CREATE TABLE IF NOT EXISTS quotes (
  id         TEXT PRIMARY KEY,
  status     TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Reseñas: se publican solo cuando el admin las activa
CREATE TABLE IF NOT EXISTS reviews (
  id         TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','activa','inactiva')),
  verified   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (product_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, status);

-- Códigos de verificación (2FA por celular). Solo se guarda el hash del código.
CREATE TABLE IF NOT EXISTS otp_challenges (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose      TEXT NOT NULL CHECK (purpose IN ('login','register')),
  code_hash    TEXT NOT NULL,
  expires_at   INTEGER NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_sent_at INTEGER NOT NULL,
  consumed     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_otp_user ON otp_challenges(user_id);

CREATE TABLE IF NOT EXISTS newsletter (
  email      TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
`

export function migrate() {
  db.exec(SCHEMA)
  // migraciones de columnas añadidas después de la primera versión
  const cols = (table: string) => (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name)
  if (!cols('coupons').includes('first_order_only')) db.exec('ALTER TABLE coupons ADD COLUMN first_order_only INTEGER NOT NULL DEFAULT 0')
}

/** Ejecuta fn dentro de una transacción */
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN')
  try {
    const r = fn()
    db.exec('COMMIT')
    return r
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export const now = () => new Date().toISOString()
export const json = <T>(s: unknown) => JSON.parse(String(s)) as T
