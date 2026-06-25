import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Aprovacoes from './pages/Aprovacoes'
import Relatorios from './pages/Relatorios'
import Workspace from './pages/Workspace'
import Logs from './pages/Logs'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="aprovacoes" element={<Aprovacoes />} />
          <Route path="relatorios" element={<Relatorios />} />
          <Route path="workspace" element={<Workspace />} />
          <Route path="logs" element={<Logs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
