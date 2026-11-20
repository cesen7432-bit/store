# CECOM Store

Tienda online de electrónica, corte láser y proyectos (Loja, Ecuador).
**Frontend:** React + Vite + Tailwind · **Backend:** Node + Express + SQLite (`server/`).

## Configuración

Un solo `.env` en la raíz para todo (tienda, backend y Docker): `cp .env.example .env`

## Desarrollo

```bash
cd server && npm install && npm run dev   # API en :4000 (crea la base y el admin la primera vez)
npm install && npm run dev                # tienda en http://localhost:5173/store/
```

- `OTP_PROVIDER=console` → el código 2FA sale en la consola y en pantalla (sin gastar SMS).
- La base de desarrollo está en `server/data/`; bórrala para empezar de cero.

## Producción (Docker) → https://apps-cecom.cloud/store/

```bash
docker compose up -d --build   # queda en http://127.0.0.1:8850/store/ (PUBLIC_PORT, solo local)
```

En el proxy **Apache** del VPS, dentro del `<VirtualHost>` de apps-cecom.cloud (junto a `/isapi`, `/gw-sms`…):

```apache
<Location /store>
    ProxyPass http://127.0.0.1:8850
    ProxyPassReverse http://127.0.0.1:8850
    # 80 MB: videos de proyectos y adjuntos de cotizaciones
    LimitRequestBody 83886080
</Location>
```

- La tienda, la API (`/store/api`) y las fotos (`/store/uploads`) van por ese mismo bloque. El contenedor acepta las rutas con o sin el prefijo `/store`.
- El puerto `8850` es `PUBLIC_PORT` del `.env` (el 8080 lo usa `/isapi`). El contenedor solo escucha en `127.0.0.1`: el acceso público entra por Apache y su HTTPS.
- `TRUST_PROXY=2` (Apache + Nginx del contenedor) para que el límite de intentos vea la IP real del cliente.
- Los datos viven en los volúmenes `cecom-data` y `cecom-uploads`: **se conservan al reconstruir**. `docker compose down -v` los borra.
- Si `ADMIN_PASSWORD` está vacío, la contraseña del admin se genera y se muestra una vez en `docker compose logs api`.
- Respaldo: `docker compose cp api:/app/data/cecom.db ./respaldo.db`

## Dónde se configura cada cosa

| Qué | Dónde |
|---|---|
| Productos | Admin → Productos (o **Importar Excel**: SKU, Producto, Disponible, Precio Base) |
| Tema de temporada, banner, cupón de bienvenida | Admin → Configuración |
| Cupones, reseñas, pedidos, clientes | Admin → sección correspondiente |
| Envío gratis (Loja $20, Ecuador $50), WhatsApp, correo | `src/config/store.ts` |
| Temas (colores, fechas, textos, % del banner) | `src/config/seasons.ts` |
| Admin inicial, SMS Gateway, JWT | `.env` |

## Reglas del negocio

- **Pedidos:** requieren cuenta; se generan en la tienda y se envían por WhatsApp; el pago y el envío por debajo del mínimo se coordinan ahí.
- **Entrega:** cuando el admin marca *Enviado*, el cliente confirma "Sí, lo recibí" y el pedido pasa a *Entregado*.
- **Cuentas:** 2FA por SMS obligatorio; un correo y un celular por cuenta.
- **Cupones:** requieren sesión, un uso por cliente; `BIENVENIDA10` solo en la primera compra.
- **Reseñas:** solo de productos recibidos; se publican cuando el admin las aprueba.
- **Precios, descuentos y stock** se calculan siempre en el servidor.

## Mantenimiento

- Quitar productos de ejemplo de versiones antiguas: `docker compose exec api node dist/purge-demo.js` (desarrollo: `cd server && npm run purge-demo`).
- `VITE_USE_MOCK=true` hace que la tienda funcione sin backend, con datos de prueba en el navegador.
