import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Aprovacoes from './pages/Aprovacoes'
import Relatorios from './pages/Relatorios'
import Workspace from './pages/Workspace'
import Logs from './pages/Logs'
import Login from './pages/Login'
import Aguardando from './pages/Aguardando'
import Admin from './pages/Admin'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTopColor: '#0A84FF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (!user) return <Login />
  if (!user.approved) return <Aguardando />

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="aprovacoes" element={<Aprovacoes />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="workspace" element={<Workspace />} />
        <Route path="logs" element={<Logs />} />
        {user.isAdmin && <Route path="admin" element={<Admin />} />}
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
