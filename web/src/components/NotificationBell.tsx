import { useState, useEffect, useRef } from 'react'
import { Bell, X, Check, AlertCircle, Clock, CheckCircle2, Megaphone } from 'lucide-react'
import { useIsMobile } from '../hooks/useMediaQuery'

export interface AppNotification {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  body?: string
  time: number
  read: boolean
}

const STORAGE_KEY = 'studio_notifications'

function loadNotifs(): AppNotification[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function saveNotifs(n: AppNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(n.slice(-50)))
}

export function pushNotification(n: Omit<AppNotification, 'id' | 'time' | 'read'>) {
  const all = loadNotifs()
  const notif: AppNotification = { ...n, id: Date.now().toString(), time: Date.now(), read: false }
  const updated = [...all, notif]
  saveNotifs(updated)
  window.dispatchEvent(new CustomEvent('studio-notif', { detail: notif }))

  if (localStorage.getItem('notif_browser') === 'true' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(`Studio IA — ${n.title}`, { body: n.body, icon: '/favicon.png' })
  }
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  success: <CheckCircle2 size={14} strokeWidth={2} style={{ color: 'var(--accent-green)' }} />,
  error:   <AlertCircle  size={14} strokeWidth={2} style={{ color: 'var(--accent-red)' }} />,
  warning: <AlertCircle  size={14} strokeWidth={2} style={{ color: 'var(--accent-yellow)' }} />,
  info:    <Megaphone    size={14} strokeWidth={2} style={{ color: 'var(--accent)' }} />,
}

function timeAgo(ms: number) {
  const diff = Date.now() - ms
  if (diff < 60000) return 'agora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return `${Math.floor(diff / 86400000)}d`
}

export default function NotificationBell() {
  const [notifs, setNotifs] = useState<AppNotification[]>(loadNotifs)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  const refresh = () => setNotifs(loadNotifs())

  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener('studio-notif', handler)
    const iv = setInterval(refresh, 10000)
    return () => { window.removeEventListener('studio-notif', handler); clearInterval(iv) }
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const unread = notifs.filter(n => !n.read).length

  const markAllRead = () => {
    const updated = notifs.map(n => ({ ...n, read: true }))
    setNotifs(updated)
    saveNotifs(updated)
  }

  const clearAll = () => { setNotifs([]); saveNotifs([]) }

  const markRead = (id: string) => {
    const updated = notifs.map(n => n.id === id ? { ...n, read: true } : n)
    setNotifs(updated)
    saveNotifs(updated)
  }

  const panelPos: React.CSSProperties = isMobile
    ? { top: 'calc(100% + 10px)', right: 0 }
    : { bottom: 'calc(100% + 10px)', left: 0 }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) markAllRead() }}
        className="btn-icon btn-icon--sm"
        style={{ background: open ? 'var(--accent-soft)' : 'transparent', border: 'none', color: open ? 'var(--accent)' : 'var(--text-secondary)', position: 'relative' }}
        title="Notificações"
      >
        <Bell size={17} strokeWidth={1.6} />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-red)', border: '1.5px solid var(--bg-deep)' }} />
        )}
      </button>

      {open && (
        <div
          className="card--glass anim-pop"
          style={{ position: 'absolute', ...panelPos, width: 'min(86vw, 320px)', zIndex: 120, border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}
        >
          <div className="row--between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Notificações</span>
            <div className="row" style={{ gap: 4 }}>
              {notifs.length > 0 && (
                <>
                  <button onClick={markAllRead} title="Marcar todas como lidas" style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                    <Check size={14} strokeWidth={2} />
                  </button>
                  <button onClick={clearAll} title="Limpar tudo" style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                    <X size={14} strokeWidth={2} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="scroll" style={{ maxHeight: 340 }}>
            {notifs.length === 0 ? (
              <div className="empty" style={{ padding: '32px 16px' }}>
                <Bell size={22} strokeWidth={1} />
                <p className="dim" style={{ margin: 0, fontSize: 12 }}>Nenhuma notificação</p>
              </div>
            ) : (
              [...notifs].reverse().map(n => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  style={{ display: 'flex', gap: 10, padding: '11px 14px', background: n.read ? 'transparent' : 'var(--accent-softer)', borderBottom: '1px solid var(--border)' }}
                >
                  <div style={{ flexShrink: 0, marginTop: 1 }}>{TYPE_ICON[n.type]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600 }}>{n.title}</p>
                    {n.body && <p className="muted" style={{ margin: '2px 0 0', fontSize: 11.5, lineHeight: 1.5 }}>{n.body}</p>}
                    <div className="row" style={{ gap: 4, marginTop: 4 }}>
                      <Clock size={10} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
                      <span className="dim" style={{ fontSize: 10 }}>{timeAgo(n.time)}</span>
                    </div>
                  </div>
                  {!n.read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 4 }} />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
