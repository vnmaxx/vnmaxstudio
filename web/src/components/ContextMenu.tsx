import {
  createContext, useContext, useState, useRef, useEffect, useLayoutEffect, useCallback, type ReactNode,
} from 'react'
import { ChevronRight, Check, AlertTriangle, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

const TOAST_ICON: Record<ToastType, ReactNode> = {
  success: <Check size={15} strokeWidth={2.5} style={{ color: 'var(--accent-green)' }} />,
  error: <AlertCircle size={15} strokeWidth={2} style={{ color: 'var(--accent-red)' }} />,
  info: <Info size={15} strokeWidth={2} style={{ color: 'var(--accent)' }} />,
}

export interface ConfirmOptions {
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export interface PromptOptions {
  title?: string
  message?: string
  defaultValue?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
}

export interface CtxItem {
  label?: string
  icon?: ReactNode
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  separator?: boolean
  header?: string
  shortcut?: string
  submenu?: CtxItem[]
}

type ItemsArg = CtxItem[] | (() => CtxItem[])

interface ShowEvent { clientX: number; clientY: number; preventDefault: () => void; stopPropagation?: () => void }

interface Binding {
  onContextMenu: (e: React.MouseEvent) => void
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: () => void
  onTouchEnd: (e: React.TouchEvent) => void
}

interface CtxApi {
  show: (e: ShowEvent, items: CtxItem[]) => void
  close: () => void
  bind: (items: ItemsArg) => Binding
  flash: (msg: string) => void
  toast: (message: string, type?: ToastType) => void
  copy: (text: string, msg?: string) => void
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  prompt: (opts: PromptOptions) => Promise<string | null>
}

const ContextMenuCtx = createContext<CtxApi | null>(null)

export function useContextMenu(): CtxApi {
  const ctx = useContext(ContextMenuCtx)
  if (!ctx) throw new Error('useContextMenu deve ser usado dentro de ContextMenuProvider')
  return ctx
}

interface MenuState { x: number; y: number; items: CtxItem[] }

function Menu({ x, y, items, onClose, root }: { x: number; y: number; items: CtxItem[]; onClose: () => void; root?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y, ready: false })
  const [active, setActive] = useState(-1)
  const [sub, setSub] = useState<{ index: number; x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const m = 8
    let nx = x, ny = y
    if (nx + r.width > window.innerWidth - m) nx = Math.max(m, window.innerWidth - r.width - m)
    if (ny + r.height > window.innerHeight - m) ny = Math.max(m, window.innerHeight - r.height - m)
    setPos({ x: nx, y: ny, ready: true })
  }, [x, y, items])

  const selectable = items.map((it, i) => ({ it, i })).filter(({ it }) => !it.separator && !it.header && !it.disabled)

  const run = (it: CtxItem) => {
    if (it.disabled || it.submenu) return
    onClose()
    it.onClick?.()
  }

  const openSub = (index: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    setSub({ index, x: r.right - 4, y: r.top - 6 })
  }

  useEffect(() => {
    if (!root) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const order = selectable.map(s => s.i)
        if (!order.length) return
        const cur = order.indexOf(active)
        const next = e.key === 'ArrowDown'
          ? order[(cur + 1 + order.length) % order.length]
          : order[(cur - 1 + order.length) % order.length]
        setActive(next ?? order[0])
      } else if (e.key === 'Enter' && active >= 0) {
        e.preventDefault()
        run(items[active])
      } else if (e.key === 'ArrowRight' && active >= 0 && items[active]?.submenu) {
        e.preventDefault()
        const el = ref.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null
        if (el) openSub(active, el)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setSub(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [root, active, items, selectable, onClose])

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{ left: pos.x, top: pos.y, visibility: pos.ready ? 'visible' : 'hidden' }}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation() }}
    >
      {items.map((it, i) => {
        if (it.separator) return <div key={i} className="ctx-sep" />
        if (it.header) return <div key={i} className="ctx-head">{it.header}</div>
        const isActive = active === i || sub?.index === i
        return (
          <button
            key={i}
            data-idx={i}
            disabled={it.disabled}
            className={`ctx-item${it.danger ? ' ctx-item--danger' : ''}${isActive ? ' is-active' : ''}`}
            onMouseEnter={e => {
              setActive(i)
              if (it.submenu) openSub(i, e.currentTarget)
              else setSub(null)
            }}
            onClick={() => run(it)}
          >
            {it.icon && <span className="ctx-ico">{it.icon}</span>}
            <span className="ctx-text">{it.label}</span>
            {it.shortcut && <span className="ctx-shortcut">{it.shortcut}</span>}
            {it.submenu && <span className="ctx-chevron"><ChevronRight size={14} strokeWidth={2} /></span>}
          </button>
        )
      })}
      {sub && items[sub.index]?.submenu && (
        <Menu x={sub.x} y={sub.y} items={items[sub.index].submenu!} onClose={onClose} />
      )}
    </div>
  )
}

interface DialogState {
  kind: 'confirm' | 'prompt'
  opts: ConfirmOptions & PromptOptions
  resolve: (v: boolean | string | null) => void
}

function Dialog({ state, onClose }: { state: DialogState; onClose: () => void }) {
  const { kind, opts } = state
  const [value, setValue] = useState(opts.defaultValue || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (kind === 'prompt') {
      const el = inputRef.current
      if (el) { el.focus(); el.select() }
    }
  }, [kind])

  const doConfirm = () => { state.resolve(kind === 'prompt' ? value.trim() : true); onClose() }
  const doCancel = () => { state.resolve(kind === 'prompt' ? null : false); onClose() }
  const blocked = kind === 'prompt' && !value.trim()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); doCancel() }
      else if (e.key === 'Enter' && kind === 'confirm') { e.preventDefault(); doConfirm() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="modal-backdrop" onClick={doCancel}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: 'clamp(18px, 3vw, 24px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
            {opts.danger && (
              <div className="center" style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: 'color-mix(in srgb, var(--accent-red) 14%, transparent)', color: 'var(--accent-red)' }}>
                <AlertTriangle size={19} strokeWidth={2} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {opts.title && <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{opts.title}</h2>}
              {opts.message && <p className="muted" style={{ margin: opts.title ? '6px 0 0' : 0, fontSize: 13.5, lineHeight: 1.55 }}>{opts.message}</p>}
            </div>
          </div>

          {kind === 'prompt' && (
            <input
              ref={inputRef}
              className="input"
              value={value}
              placeholder={opts.placeholder}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !blocked) { e.preventDefault(); doConfirm() } }}
            />
          )}

          <div className="row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
            <button className="btn btn--ghost" onClick={doCancel}>{opts.cancelLabel || 'Cancelar'}</button>
            <button className={'btn ' + (opts.danger ? 'btn--danger' : 'btn--primary')} onClick={doConfirm} disabled={blocked}>
              {opts.confirmLabel || 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MenuState | null>(null)
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string; type: ToastType }>>([])
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const lpTimer = useRef<number | null>(null)
  const lpFired = useRef(false)
  const toastSeq = useRef(0)

  const close = useCallback(() => setState(null), [])

  const show = useCallback((e: ShowEvent, items: CtxItem[]) => {
    e.preventDefault()
    e.stopPropagation?.()
    if (!items || items.length === 0) return
    setState({ x: e.clientX, y: e.clientY, items })
  }, [])

  const dismiss = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), [])

  const toast = useCallback((msg: string, type: ToastType = 'success') => {
    const id = ++toastSeq.current
    setToasts(t => [...t.slice(-3), { id, msg, type }])
    window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3400)
  }, [])

  const flash = useCallback((msg: string) => toast(msg, 'success'), [toast])

  const copy = useCallback((text: string, msg = 'Copiado') => {
    try {
      navigator.clipboard?.writeText(text)
      flash(msg)
    } catch {
      flash('Não foi possível copiar')
    }
  }, [flash])

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>(resolve => {
    setDialog({ kind: 'confirm', opts, resolve: resolve as (v: boolean | string | null) => void })
  }), [])

  const prompt = useCallback((opts: PromptOptions) => new Promise<string | null>(resolve => {
    setDialog({ kind: 'prompt', opts, resolve: resolve as (v: boolean | string | null) => void })
  }), [])

  const bind = useCallback((items: ItemsArg): Binding => {
    const get = typeof items === 'function' ? items : () => items
    return {
      onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); show(e, get()) },
      onTouchStart: (e: React.TouchEvent) => {
        e.stopPropagation()
        lpFired.current = false
        const t = e.touches[0]
        if (!t) return
        const cx = t.clientX, cy = t.clientY
        lpTimer.current = window.setTimeout(() => {
          lpFired.current = true
          if (navigator.vibrate) navigator.vibrate(8)
          show({ clientX: cx, clientY: cy, preventDefault() {} }, get())
        }, 450)
      },
      onTouchMove: () => { if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null } },
      onTouchEnd: (e: React.TouchEvent) => {
        if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null }
        if (lpFired.current) e.preventDefault()
      },
    }
  }, [show])

  useEffect(() => {
    if (!state) return
    const onDown = (e: MouseEvent) => {
      const el = e.target as Node
      if (!(el instanceof Element) || !el.closest('.ctx-menu')) close()
    }
    const onScroll = () => close()
    const onBlur = () => close()
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('blur', onBlur)
    }
  }, [state, close])

  const api: CtxApi = { show, close, bind, flash, toast, copy, confirm, prompt }

  return (
    <ContextMenuCtx.Provider value={api}>
      {children}
      {state && <Menu x={state.x} y={state.y} items={state.items} onClose={close} root />}
      {dialog && <Dialog state={dialog} onClose={() => setDialog(null)} />}
      {toasts.length > 0 && (
        <div className="toast-wrap">
          {toasts.map(t => (
            <div key={t.id} className={`toast toast--${t.type}`} onClick={() => dismiss(t.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9 }}>
              {TOAST_ICON[t.type]}
              <span style={{ flex: 1 }}>{t.msg}</span>
            </div>
          ))}
        </div>
      )}
    </ContextMenuCtx.Provider>
  )
}
