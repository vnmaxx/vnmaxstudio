import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../api'
import { Bot, LayoutDashboard, CheckSquare, BarChart3, FolderOpen, ScrollText } from 'lucide-react'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} strokeWidth={1.5} /> },
  { to: '/aprovacoes', label: 'Aprovações', icon: <CheckSquare size={16} strokeWidth={1.5} />, badge: true },
  { to: '/relatorios', label: 'Relatórios', icon: <BarChart3 size={16} strokeWidth={1.5} /> },
  { to: '/workspace', label: 'Workspace', icon: <FolderOpen size={16} strokeWidth={1.5} /> },
  { to: '/logs', label: 'Logs', icon: <ScrollText size={16} strokeWidth={1.5} /> },
]

export default function Sidebar() {
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const list = await api.getPendentes()
        setPendingCount(list.length)
      } catch {
        // ignore
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <aside
      style={{
        background: 'rgba(12,12,14,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        width: 220,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '20px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Bot size={22} strokeWidth={1.5} style={{ color: '#0A84FF' }} />
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15, lineHeight: 1, margin: 0 }}>
            Studio IA
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 11, margin: '3px 0 0 0' }}>
            Sistema Autônomo
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 0' }}>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
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
            })}
            onMouseEnter={e => {
              const el = e.currentTarget
              if (!el.style.background.includes('0.18')) {
                el.style.background = 'rgba(255,255,255,0.08)'
                el.style.color = 'var(--text-primary)'
              }
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              if (!el.style.background.includes('0.18')) {
                el.style.background = 'transparent'
                el.style.color = 'rgba(255,255,255,0.5)'
              }
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge && pendingCount > 0 && (
              <span
                style={{
                  background: '#FF453A',
                  color: 'white',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 10,
                  lineHeight: '16px',
                }}
              >
                {pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Version */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 11, margin: 0 }}>v1.0.0</p>
      </div>
    </aside>
  )
}
