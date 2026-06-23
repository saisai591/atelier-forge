import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Stock from './pages/Stock'
import Orders from './pages/Orders'
import Invoices from './pages/Invoices'
import WhatsApp from './pages/WhatsApp'
import Settings from './pages/Settings'
import HomeLauncher from './pages/HomeLauncher'
import PxeControl from './pages/PxeControl'
import MobileScanner from './pages/MobileScanner'
import Erp from './pages/Erp'
import Layout from './components/Layout'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<HomeLauncher />} />
        <Route path="/pxe" element={<PxeControl />} />
        <Route path="/mobile" element={<MobileScanner />} />
        <Route path="/erp" element={<Erp />} />
        <Route
          path="/app"
          element={<Layout />}
        >
          <Route index element={<Dashboard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="stock" element={<Stock />} />
          <Route path="orders" element={<Orders />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="whatsapp" element={<WhatsApp />} />
          <Route path="pxe" element={<PxeControl />} />
          <Route path="erp" element={<Erp />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
