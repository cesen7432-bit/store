import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { LaserActivity, LaserOverlay, PageLoader } from './components/brand/LaserLoader'
import { SeasonProvider } from './context/SeasonContext'
import { useAuth } from './store/auth'
import Home from './pages/Home'

const Shop = lazy(() => import('./pages/Shop'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const Projects = lazy(() => import('./pages/Projects'))
const Quote = lazy(() => import('./pages/Quote'))
const Checkout = lazy(() => import('./pages/Checkout'))
const Auth = lazy(() => import('./pages/Auth'))
const Account = lazy(() => import('./pages/Account'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))

// Panel de administración (se descarga solo si se visita /admin)
const AdminLayout = lazy(() => import('./admin/AdminLayout'))
const Dashboard = lazy(() => import('./admin/Dashboard'))
const AdminProducts = lazy(() => import('./admin/Products'))
const AdminOrders = lazy(() => import('./admin/Sales').then((m) => ({ default: m.Orders })))
const AdminQuotes = lazy(() => import('./admin/Sales').then((m) => ({ default: m.Quotes })))
const AdminProjects = lazy(() => import('./admin/Catalog').then((m) => ({ default: m.Projects })))
const AdminCoupons = lazy(() => import('./admin/Catalog').then((m) => ({ default: m.Coupons })))
const AdminCustomers = lazy(() => import('./admin/Catalog').then((m) => ({ default: m.Customers })))
const AdminSettings = lazy(() => import('./admin/Settings'))
const AdminReviews = lazy(() => import('./admin/Reviews'))

function NotFound() {
  return (
    <div className="py-32 text-center">
      <p className="neon font-display text-8xl font-bold">404</p>
      <p className="mt-4 text-muted">Este circuito está abierto… la página no existe.</p>
      <Link to="/" className="btn-primary mt-8 inline-block px-6 py-3">Volver al inicio</Link>
    </div>
  )
}

export default function App() {
  const refresh = useAuth((s) => s.refresh)
  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <SeasonProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <LaserOverlay />
        <LaserActivity />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="tienda" element={<Shop />} />
              <Route path="tienda/:category" element={<Shop />} />
              <Route path="producto/:slug" element={<ProductDetail />} />
              <Route path="proyectos" element={<Projects />} />
              <Route path="cotizar" element={<Quote />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="ingresar" element={<Auth mode="login" />} />
              <Route path="registro" element={<Auth mode="registro" />} />
              <Route path="cuenta" element={<Account />} />
              <Route path="cuenta/pedidos/:id" element={<OrderDetail />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="productos" element={<AdminProducts />} />
              <Route path="pedidos" element={<AdminOrders />} />
              <Route path="cotizaciones" element={<AdminQuotes />} />
              <Route path="resenas" element={<AdminReviews />} />
              <Route path="proyectos" element={<AdminProjects />} />
              <Route path="cupones" element={<AdminCoupons />} />
              <Route path="clientes" element={<AdminCustomers />} />
              <Route path="configuracion" element={<AdminSettings />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </SeasonProvider>
  )
}
