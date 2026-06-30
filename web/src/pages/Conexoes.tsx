import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import type { SocialProvider } from '../types'
import { useContextMenu } from '../components/ContextMenu'
import {
  RefreshCw, Mail, Send, MessageCircle, AtSign, Plug, Check, X,
  Loader2, Zap, ShieldCheck, Trash2,
} from 'lucide-react'

function ProviderIcon({ id, size = 20 }: { id: string; size?: number }) {
  if (id === 'email') return <Mail size={size} style={{ color: 'var(--accent)' }} />
  if (id === 'telegram') return <Send size={size} style={{ color: '#3aa9ee' }} />
  if (id === 'whatsapp') return <MessageCircle size={size} style={{ color: 'var(--accent-green)' }} />
  if (id === 'walink') return <MessageCircle size={size} style={{ color: 'var(--accent-green)' }} />
  if (id === 'meta') return <AtSign size={size} style={{ color: 'var(--accent-purple)' }} />
  return <Plug size={size} />
}

function ProviderCard({ p, onChanged }: { p: SocialProvider; onChanged: (p: SocialProvider) => void }) {
  const menu = useContextMenu()
  const init = () => {
    const v: Record<string, string> = {}
    for (const f of p.fields) v[f.key] = f.secret ? '' : (p.values[f.key] || '')
    return v
  }
  const [form, setForm] = useState<Record<string, string>>(init)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => { setForm(init()); setResult(null) /* eslint-disable-next-line */ }, [p.atualizadoEm, p.connected])

  const salvar = async () => {
    setSaving(true); setResult(null)
    try { const np = await api.connectSocial(p.id, form); onChanged(np); menu.toast('Conexão salva') }
    catch (e: unknown) { menu.toast(e instanceof Error ? e.message : 'Erro ao salvar', 'error') }
    finally { setSaving(false) }
  }

  const testar = async () => {
    setTesting(true); setResult(null)
    try {
      const r = await api.testSocial(p.id)
      setResult({ ok: r.ok, msg: r.ok ? (r.info || 'Conexão funcionando.') : (r.error || 'Falhou.') })
    } catch (e: unknown) { setResult({ ok: false, msg: e instanceof Error ? e.message : 'Erro ao testar' }) }
    finally { setTesting(false) }
  }

  const desconectar = async () => {
    const ok = await menu.confirm({ title: 'Desconectar', message: `Remover as credenciais de ${p.label}?`, danger: true, confirmLabel: 'Desconectar' })
    if (!ok) return
    try { const np = await api.disconnectSocial(p.id); onChanged(np); setResult(null); menu.toast('Desconectado') }
    catch { menu.toast('Erro ao desconectar', 'error') }
  }

  return (
    <div className="card card--pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
        <div className="row" style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--surface-2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ProviderIcon id={p.id} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <h3 className="truncate" style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{p.label}</h3>
            {p.connected ? (
              <span className="badge" style={{ background: 'color-mix(in srgb, var(--accent-green) 16%, transparent)', color: 'var(--accent-green)' }}><Check size={11} /> Conectado</span>
            ) : p.kind === 'link' ? (
              <span className="badge" style={{ background: 'color-mix(in srgb, var(--accent-green) 16%, transparent)', color: 'var(--accent-green)' }}><Zap size={11} /> Sempre ativo</span>
            ) : (
              <span className="badge" style={{ color: 'var(--text-tertiary)' }}>Não conectado</span>
            )}
          </div>
          <p className="dim" style={{ fontSize: 12, margin: '5px 0 0', lineHeight: 1.5 }}>{p.descricao}</p>
        </div>
      </div>

      {p.fields.length > 0 && (
        <div className="col" style={{ gap: 9 }}>
          {p.fields.map(f => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <input
                className="input"
                type={f.secret ? 'password' : 'text'}
                value={form[f.key] ?? ''}
                placeholder={f.secret && p.values[f.key] ? '•••••• (deixe em branco para manter)' : (f.placeholder || '')}
                onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      )}

      {result && (
        <div className="row" style={{ gap: 7, fontSize: 12, padding: '8px 10px', borderRadius: 8, background: result.ok ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)' : 'color-mix(in srgb, var(--accent-red) 12%, transparent)', color: result.ok ? 'var(--accent-green)' : 'var(--accent-red)' }}>
          {result.ok ? <ShieldCheck size={14} /> : <X size={14} />}
          <span style={{ flex: 1, lineHeight: 1.45 }}>{result.msg}</span>
        </div>
      )}

      {p.fields.length > 0 && (
        <div className="row wrap" style={{ gap: 7, marginTop: 'auto' }}>
          <button className="btn btn--primary btn--sm" onClick={salvar} disabled={saving}>
            {saving ? <Loader2 size={13} className="spin" /> : <Check size={13} />} Salvar
          </button>
          <button className="btn btn--ghost btn--sm" onClick={testar} disabled={testing || !p.connected}>
            {testing ? <Loader2 size={13} className="spin" /> : <Zap size={13} />} Testar
          </button>
          {p.connected && (
            <button className="btn btn--ghost btn--sm" onClick={desconectar} style={{ marginLeft: 'auto', color: 'var(--accent-red)' }}>
              <Trash2 size={13} /> Desconectar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function Conexoes() {
  const [providers, setProviders] = useState<SocialProvider[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try { setProviders(await api.getSocial()) } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const onChanged = (np: SocialProvider) => setProviders(prev => prev.map(p => p.id === np.id ? np : p))
  const conectados = providers.filter(p => p.connected || p.kind === 'link').length

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Conexões</h1>
          <p className="page-sub">{conectados} canal{conectados === 1 ? '' : 'is'} pronto{conectados === 1 ? '' : 's'} para enviar mensagens</p>
        </div>
        <div className="page-head-actions">
          <button className="btn-icon" onClick={load} title="Atualizar"><RefreshCw size={15} strokeWidth={1.7} /></button>
        </div>
      </div>

      {loading ? (
        <div className="empty"><RefreshCw size={26} className="spin" /><p className="muted">Carregando...</p></div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14, alignItems: 'stretch' }}>
          {providers.map(p => <ProviderCard key={p.id} p={p} onChanged={onChanged} />)}
        </div>
      )}
    </div>
  )
}
