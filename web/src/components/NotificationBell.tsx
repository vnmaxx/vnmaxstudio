import { useState, useEffect, useRef } from 'react'
import { Bell, X, Check, AlertCircle, Clock, CheckCircle2, Megaphone } from 'lucide-react'

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

  if (localStorage.getItem('notif_browser') === 'true' && Notification.permission === 'granted') {
    new Notification(`Studio IA — ${n.title}`, { body: n.body, icon: '/favicon.png' })
  }
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  success: <CheckCircle2 size={14} strokeWidth={2} style={{ color: '#30D158' }} />,
  error:   <AlertCircle  size={14} strokeWidth={2} style={{ color: '#FF453A' }} />,
  warning: <AlertCircle  size={14} strokeWidth={2} style={{ color: '#FFD60A' }} />,
  info:    <Megaphone    size={14} strokeWidth={2} style={{ color: '#0A84FF' }} />,
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

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) markAllRead() }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10, border: 'none',
          background: open ? 'rgba(10,132,255,0.15)' : 'rgba(255,255,255,0.05)',
          color: open ? '#0A84FF' : 'rgba(255,255,255,0.5)',
          cursor: 'pointer', position: 'relative', transition: 'all 0.18s',
        }}
        title="Notificações"
      >
        <Bell size={16} strokeWidth={1.5} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 5, right: 5, width: 8, height: 8,
            borderRadius: '50%', background: '#FF453A',
            border: '1.5px solid #0c0c0e',
          }} />
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 46, left: 0, width: 300, zIndex: 999,
          background: '#111113', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Notificações</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {notifs.length > 0 && (
                <>
                  <button onClick={markAllRead} title="Marcar todas como lidas" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                    <Check size={13} strokeWidth={2} />
                  </button>
                  <button onClick={clearAll} title="Limpar tudo" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                    <X size={13} strokeWidth={2} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {notifs.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <Bell size={22} strokeWidth={1} style={{ color: 'rgba(255,255,255,0.12)', marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>Nenhuma notificação</p>
              </div>
            ) : (
              [...notifs].reverse().map(n => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  style={{
                    display: 'flex', gap: 10, padding: '11px 14px', cursor: 'default',
                    background: n.read ? 'transparent' : 'rgba(10,132,255,0.06)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ flexShrink: 0, marginTop: 1 }}>{TYPE_ICON[n.type]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</p>
                    {n.body && <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{n.body}</p>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <Clock size={10} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{timeAgo(n.time)}</span>
                    </div>
                  </div>
                  {!n.read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0A84FF', flexShrink: 0, marginTop: 4 }} />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
