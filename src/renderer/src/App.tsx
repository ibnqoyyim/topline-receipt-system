import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AppShell, RequireAuth } from './components/AppShell'
import { RoleGate } from './components/RoleGate'
import { LoginPage } from './pages/LoginPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { DashboardPage } from './pages/DashboardPage'
import { NewReceiptPage } from './pages/NewReceiptPage'
import { ReceiptPreviewPage } from './pages/ReceiptPreviewPage'
import { ReceiptHistoryPage } from './pages/ReceiptHistoryPage'
import { ProductsPage } from './pages/ProductsPage'
import { CustomersPage } from './pages/CustomersPage'
import { PaymentsPage } from './pages/PaymentsPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App(): React.JSX.Element {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route element={<AppShell />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/receipts/new" element={<NewReceiptPage />} />
              <Route path="/receipts/preview/:id" element={<ReceiptPreviewPage />} />
              <Route path="/receipts/preview" element={<ReceiptPreviewPage />} />
              <Route path="/receipts" element={<ReceiptHistoryPage />} />
              <Route
                path="/products"
                element={
                  <RoleGate screen="products">
                    <ProductsPage />
                  </RoleGate>
                }
              />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route
                path="/settings"
                element={
                  <RoleGate screen="settings">
                    <SettingsPage />
                  </RoleGate>
                }
              />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  )
}
