import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar, { MobileTopBar, MobileTabBar, Drawer } from './Sidebar'
import { useContextMenu, type CtxItem } from './ContextMenu'
import { api } from '../api'
import { RefreshCw, Play, Compass } from 'lucide-react'

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const menu = useContextMenu()

  useEffect(() => { setDrawerOpen(false) }, [pathname])

  const runCycle = async (cycle: 'segunda' | 'diario' | 'sexta') => {
    const labels: Record<string, string> = { segunda: 'Segunda', diario: 'Diário', sexta: 'Sexta' }
    try {
      await api.runCycle(cycle)
      menu.flash(`Ciclo ${labels[cycle]} iniciado`)
    } catch {
      menu.flash('Erro ao iniciar ciclo')
    }
  }

  const bgMenu = (): CtxItem[] => [
    { header: 'Studio IA' },
    { label: 'Atualizar página', icon: <RefreshCw size={15} strokeWidth={1.8} />, onClick: () => window.location.reload() },
    { separator: true },
    {
      label: 'Novo ciclo', icon: <Play size={15} strokeWidth={1.8} />, submenu: [
        { label: 'Segunda — Plano + Leads', onClick: () => runCycle('segunda') },
        { label: 'Diário — Tráfego + Clientes', onClick: () => runCycle('diario') },
        { label: 'Sexta — Dados + Relatório', onClick: () => runCycle('sexta') },
      ],
    },
    { separator: true },
    {
      label: 'Ir para', icon: <Compass size={15} strokeWidth={1.8} />, submenu: [
        { label: 'Dashboard', onClick: () => navigate('/dashboard') },
        { label: 'Pipelines', onClick: () => navigate('/pipelines') },
        { label: 'Aprovações', onClick: () => navigate('/aprovacoes') },
        { label: 'Workspace', onClick: () => navigate('/workspace') },
        { label: 'Relatórios', onClick: () => navigate('/relatorios') },
        { label: 'Logs', onClick: () => navigate('/logs') },
      ],
    },
  ]

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content" {...menu.bind(bgMenu)}>
        <MobileTopBar onMenu={() => setDrawerOpen(true)} />
        <Outlet />
      </div>
      <MobileTabBar />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
