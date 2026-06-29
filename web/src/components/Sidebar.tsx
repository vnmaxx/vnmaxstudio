import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { LayoutDashboard, CheckSquare, BarChart3, FolderOpen, ScrollText, Shield, LogOut, Settings, Zap } from 'lucide-react'
import NotificationBell from './NotificationBell'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} strokeWidth={1.5} /> },
  { to: '/aprovacoes', label: 'Aprovações', icon: <CheckSquare size={16} strokeWidth={1.5} />, badge: true },
  { to: '/relatorios', label: 'Relatórios', icon: <BarChart3 size={16} strokeWidth={1.5} /> },
  { to: '/workspace', label: 'Workspace', icon: <FolderOpen size={16} strokeWidth={1.5} /> },
  { to: '/logs', label: 'Logs', icon: <ScrollText size={16} strokeWidth={1.5} /> },
  { to: '/pipelines', label: 'Pipelines', icon: <Zap size={16} strokeWidth={1.5} /> },
]

export default function Sidebar() {
  const [pendingCount, setPendingCount] = useState(0)
  const { user, logout } = useAuth()

  useEffect(() => {
    const load = async () => {
      try {
        const list = await api.getPendentes()
        setPendingCount(list.length)
      } catch {
        setPendingCount(0)
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const linkStyle = (isActive: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    padding: '8px 12px',
    margin: '2px 8px',
    borderRadius: 10,
    fontSize: 13.5,
    fontWeight: 500,
    textDecoration: 'none',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    background: isActive ? 'rgba(10,132,255,0.18)' : 'transparent',
    color: isActive ? '#0A84FF' : 'rgba(255,255,255,0.5)',
    border: isActive ? '1px solid rgba(10,132,255,0.25)' : '1px solid transparent',
  })

  return (
    <aside style={{ background: 'rgba(12,12,14,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRight: '1px solid rgba(255,255,255,0.06)', width: 220, height: '100vh', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="/logo.png" alt="Studio IA" style={{ width: 32, height: 32, objectFit: 'contain' }} />
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15, lineHeight: 1, margin: 0 }}>Studio IA</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 11, margin: '3px 0 0 0' }}>Sistema Autônomo</p>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '10px 0' }}>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => linkStyle(isActive)}
            onMouseEnter={e => { const el = e.currentTarget; if (!el.style.background.includes('0.18')) { el.style.background = 'rgba(255,255,255,0.08)'; el.style.color = 'var(--text-primary)' } }}
            onMouseLeave={e => { const el = e.currentTarget; if (!el.style.background.includes('0.18')) { el.style.background = 'transparent'; el.style.color = 'rgba(255,255,255,0.5)' } }}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge && pendingCount > 0 && (
              <span style={{ background: '#FF453A', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, lineHeight: '16px' }}>{pendingCount}</span>
            )}
          </NavLink>
        ))}

        {user?.isAdmin && (
          <NavLink
            to="/admin"
            style={({ isActive }) => linkStyle(isActive)}
            onMouseEnter={e => { const el = e.currentTarget; if (!el.style.background.includes('0.18')) { el.style.background = 'rgba(255,255,255,0.08)'; el.style.color = 'var(--text-primary)' } }}
            onMouseLeave={e => { const el = e.currentTarget; if (!el.style.background.includes('0.18')) { el.style.background = 'transparent'; el.style.color = 'rgba(255,255,255,0.5)' } }}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}><Shield size={16} strokeWidth={1.5} /></span>
            <span style={{ flex: 1 }}>Usuários</span>
          </NavLink>
        )}
      </nav>

      <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ padding: '6px 12px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{user?.email}</p>
          <NotificationBell />
        </div>
        <NavLink
          to="/configuracoes"
          style={({ isActive }) => ({ ...linkStyle(isActive), marginBottom: 2 })}
          onMouseEnter={e => { const el = e.currentTarget; if (!el.style.background.includes('0.18')) { el.style.background = 'rgba(255,255,255,0.08)'; el.style.color = 'var(--text-primary)' } }}
          onMouseLeave={e => { const el = e.currentTarget; if (!el.style.background.includes('0.18')) { el.style.background = 'transparent'; el.style.color = 'rgba(255,255,255,0.5)' } }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}><Settings size={16} strokeWidth={1.5} /></span>
          <span style={{ flex: 1 }}>Configurações</span>
        </NavLink>
        <button
          onClick={logout}
          style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 12px', background: 'transparent', border: '1px solid transparent', borderRadius: 10, color: 'rgba(255,255,255,0.4)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,69,58,0.12)'; e.currentTarget.style.color = '#FF453A' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
        >
          <LogOut size={16} strokeWidth={1.5} />
          Sair
        </button>
      </div>
    </aside>
  )
}
