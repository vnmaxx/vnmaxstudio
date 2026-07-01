import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../api'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, FolderOpen, Shield, LogOut, Settings,
  Menu, X, Users2, Activity,
} from 'lucide-react'
import NotificationBell from './NotificationBell'

export interface NavItem {
  to: string
  label: string
  icon: ReactNode
  primary?: boolean
  adminOnly?: boolean
  badge?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} strokeWidth={1.6} />, primary: true },
  { to: '/clientes', label: 'Clientes', icon: <Users2 size={18} strokeWidth={1.6} />, primary: true, badge: true },
  { to: '/workspace', label: 'Workspace', icon: <FolderOpen size={18} strokeWidth={1.6} />, primary: true },
  { to: '/sistema', label: 'Sistema', icon: <Activity size={18} strokeWidth={1.6} />, primary: true },
  { to: '/admin', label: 'Usuários', icon: <Shield size={18} strokeWidth={1.6} />, adminOnly: true },
  { to: '/configuracoes', label: 'Configurações', icon: <Settings size={18} strokeWidth={1.6} /> },
]

export function usePendingCount(): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let alive = true
    const load = async () => {
      try { const list = await api.getPendentes(); if (alive) setCount(list.length) }
      catch { if (alive) setCount(0) }
    }
    load()
    const iv = setInterval(load, 30000)
    return () => { alive = false; clearInterval(iv) }
  }, [])
  return count
}

export function navTitle(pathname: string): string {
  const item = NAV_ITEMS.find(i => pathname.startsWith(i.to))
  return item?.label || 'VNMAX Studio'
}

function navClass({ isActive }: { isActive: boolean }) {
  return 'nav-link' + (isActive ? ' is-active' : '')
}

function Brand() {
  return (
    <div className="row" style={{ gap: 11 }}>
      <img src="/vnmax-logo.png" alt="VNMAX Studio" style={{ width: 32, height: 32, objectFit: 'contain' }} />
      <div>
        <h1 style={{ fontWeight: 700, fontSize: 15, lineHeight: 1, margin: 0, letterSpacing: '-0.01em' }}>VNMAX Studio</h1>
        <p className="dim" style={{ fontSize: 10.5, margin: '3px 0 0' }}>Sistema Autônomo</p>
      </div>
    </div>
  )
}

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span style={{ background: 'var(--accent-red)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, lineHeight: '16px', marginLeft: 'auto' }}>
      {count}
    </span>
  )
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  const pending = usePendingCount()
  const items = NAV_ITEMS.filter(i => !i.adminOnly || user?.isAdmin)

  return (
    <aside className="sidebar only-desktop">
      <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)' }}>
        <Brand />
      </div>

      <nav className="scroll" style={{ flex: 1, padding: '12px' }}>
        {items.map(item => (
          <NavLink key={item.to} to={item.to} className={navClass}>
            {item.icon}
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge && <NavBadge count={pending} />}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
        <div className="row" style={{ gap: 8, padding: '4px 8px 10px' }}>
          <p className="muted truncate" style={{ margin: 0, fontSize: 12, flex: 1 }}>{user?.email}</p>
          <NotificationBell />
        </div>
        <button onClick={logout} className="nav-link" style={{ width: '100%', color: 'var(--text-tertiary)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-red) 12%, transparent)'; e.currentTarget.style.color = 'var(--accent-red)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}>
          <LogOut size={18} strokeWidth={1.6} />
          <span style={{ flex: 1 }}>Sair</span>
        </button>
      </div>
    </aside>
  )
}

export function MobileTopBar({ onMenu }: { onMenu: () => void }) {
  const { pathname } = useLocation()
  return (
    <header className="mobile-topbar only-mobile">
      <button className="btn-icon btn-icon--sm" onClick={onMenu} aria-label="Menu" style={{ background: 'transparent', border: 'none' }}>
        <Menu size={20} strokeWidth={1.8} />
      </button>
      <span className="mobile-topbar-title truncate">{navTitle(pathname)}</span>
      <NotificationBell />
    </header>
  )
}

export function MobileTabBar() {
  const pending = usePendingCount()
  const items = NAV_ITEMS.filter(i => i.primary)
  return (
    <nav className="mobile-tabbar only-mobile">
      {items.map(item => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => 'tab-link' + (isActive ? ' is-active' : '')}>
          <span style={{ position: 'relative', display: 'flex' }}>
            {item.icon}
            {item.badge && pending > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -6, background: 'var(--accent-red)', color: '#fff', fontSize: 8.5, fontWeight: 700, minWidth: 15, height: 15, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '1.5px solid var(--bg-deep)' }}>
                {pending}
              </span>
            )}
          </span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth()
  const pending = usePendingCount()
  const items = NAV_ITEMS.filter(i => !i.adminOnly || user?.isAdmin)
  if (!open) return null
  return (
    <>
      <div className="drawer-backdrop only-mobile" onClick={onClose} />
      <aside className="drawer only-mobile">
        <div className="row--between" style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
          <Brand />
          <button className="btn-icon btn-icon--sm" onClick={onClose} aria-label="Fechar" style={{ background: 'transparent', border: 'none' }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <nav className="scroll" style={{ flex: 1, padding: 12 }}>
          {items.map(item => (
            <NavLink key={item.to} to={item.to} onClick={onClose} className={navClass}>
              {item.icon}
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && <NavBadge count={pending} />}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
          <p className="muted truncate" style={{ margin: '0 0 10px', fontSize: 12, padding: '0 8px' }}>{user?.email}</p>
          <button onClick={() => { logout(); onClose() }} className="nav-link" style={{ width: '100%', color: 'var(--accent-red)' }}>
            <LogOut size={18} strokeWidth={1.6} />
            <span style={{ flex: 1 }}>Sair</span>
          </button>
        </div>
      </aside>
    </>
  )
}
