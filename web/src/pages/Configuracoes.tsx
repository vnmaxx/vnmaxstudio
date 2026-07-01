import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useContextMenu } from '../components/ContextMenu'
import { auth, db } from '../firebase'
import {
  updatePassword, updateProfile, EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth'
import { doc, updateDoc } from 'firebase/firestore'
import { useIsMobile } from '../hooks/useMediaQuery'
import {
  User, Palette, Bell, Check, Eye, EyeOff, Save, RefreshCw, RotateCcw, Send, Plug,
  Target, X, Plus, RotateCw
} from 'lucide-react'
import { ConexoesSection } from './Conexoes'
import { api } from '../api'
import type { LeadgenConfig } from '../types'

const ACCENT_COLORS = [
  { name: 'Azul', value: '#0A84FF' },
  { name: 'Verde', value: '#30D158' },
  { name: 'Roxo', value: '#BF5AF2' },
  { name: 'Laranja', value: '#FF9F0A' },
  { name: 'Rosa', value: '#FF375F' },
  { name: 'Ciano', value: '#32ADE6' },
]

const FONT_SIZES = [
  { label: 'Pequeno', value: '13px' },
  { label: 'Normal', value: '14px' },
  { label: 'Grande', value: '15px' },
  { label: 'Maior', value: '16px' },
]

const BG_COLORS = [
  { name: 'Preto', value: '#08080a' },
  { name: 'Grafite', value: '#0f0f12' },
  { name: 'Azul escuro', value: '#070810' },
  { name: 'Marrom', value: '#0d0a08' },
]


function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label className="label">{label}</label>
      {children}
      {hint && <p style={{ margin: '7px 0 0', fontSize: 11.5, color: 'var(--text-faint)' }}>{hint}</p>}
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder, disabled }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string; disabled?: boolean }) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        value={value}
        onChange={e => onChange(e.target.value)}
        type={isPassword && !show ? 'password' : 'text'}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          paddingRight: isPassword ? 44 : undefined,
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? 'not-allowed' : undefined,
        }}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 0, display: 'flex' }}
        >
          {show ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
        </button>
      )}
    </div>
  )
}

function SaveBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button className="btn btn--primary" onClick={onClick} disabled={loading}>
      {loading ? <RefreshCw size={14} strokeWidth={2} className="spin" /> : <Save size={14} strokeWidth={2} />}
      {loading ? 'Salvando...' : 'Salvar'}
    </button>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>{children}</h3>
  )
}

function ContaSection() {
  const { user } = useAuth()
  const [name, setName] = useState(user?.displayName || '')
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [loadingName, setLoadingName] = useState(false)
  const [loadingPwd, setLoadingPwd] = useState(false)
  const menu = useContextMenu()

  const showToast = (msg: string, type: 'ok' | 'err') => menu.toast(msg, type === 'ok' ? 'success' : 'error')

  const saveName = async () => {
    if (!auth.currentUser || !name.trim()) return
    setLoadingName(true)
    try {
      await updateProfile(auth.currentUser, { displayName: name.trim() })
      if (user) await updateDoc(doc(db, 'users', user.uid), { displayName: name.trim() })
      showToast('Nome atualizado com sucesso', 'ok')
    } catch (e: unknown) {
      showToast((e as Error).message || 'Erro ao salvar nome', 'err')
    } finally { setLoadingName(false) }
  }

  const savePwd = async () => {
    if (!auth.currentUser || !auth.currentUser.email) return
    if (newPwd.length < 6) return showToast('Senha deve ter pelo menos 6 caracteres', 'err')
    if (newPwd !== confirmPwd) return showToast('As senhas não coincidem', 'err')
    setLoadingPwd(true)
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPwd)
      await reauthenticateWithCredential(auth.currentUser, cred)
      await updatePassword(auth.currentUser, newPwd)
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
      showToast('Senha alterada com sucesso', 'ok')
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string }
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        showToast('Senha atual incorreta', 'err')
      } else {
        showToast(err.message || 'Erro ao alterar senha', 'err')
      }
    } finally { setLoadingPwd(false) }
  }

  return (
    <div className="col gap-6">
      <div className="card card--pad">
        <SectionTitle>Perfil</SectionTitle>
        <Field label="Email" hint="O email não pode ser alterado">
          <Input value={user?.email || ''} onChange={() => {}} disabled />
        </Field>
        <Field label="Nome de exibição">
          <Input value={name} onChange={setName} placeholder="Seu nome" />
        </Field>
        <div className="row wrap">
          <SaveBtn loading={loadingName} onClick={saveName} />
        </div>
      </div>

      <div className="card card--pad">
        <SectionTitle>Alterar senha</SectionTitle>
        <Field label="Senha atual">
          <Input value={currentPwd} onChange={setCurrentPwd} type="password" placeholder="••••••••" />
        </Field>
        <Field label="Nova senha" hint="Mínimo 6 caracteres">
          <Input value={newPwd} onChange={setNewPwd} type="password" placeholder="••••••••" />
        </Field>
        <Field label="Confirmar nova senha">
          <Input value={confirmPwd} onChange={setConfirmPwd} type="password" placeholder="••••••••" />
        </Field>
        <div className="row wrap">
          <SaveBtn loading={loadingPwd} onClick={savePwd} />
        </div>
      </div>
    </div>
  )
}

function AparenciaSection() {
  const [accent, setAccent] = useState(() => localStorage.getItem('cfg_accent') || '#0A84FF')
  const [bg, setBg] = useState(() => localStorage.getItem('cfg_bg') || '#08080a')
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('cfg_font') || '14px')
  const [sidebarCompact, setSidebarCompact] = useState(() => localStorage.getItem('cfg_sidebar') === 'compact')
  const menu = useContextMenu()

  const applyTheme = (a: string, b: string, f: string) => {
    document.documentElement.style.setProperty('--accent', a)
    document.documentElement.style.setProperty('--bg', b)
    document.documentElement.style.setProperty('--bg-primary', b)
    document.documentElement.style.setProperty('--bg-secondary', `${b}80`)
    document.body.style.fontSize = f
  }

  useEffect(() => { applyTheme(accent, bg, fontSize) }, [accent, bg, fontSize])

  const save = () => {
    localStorage.setItem('cfg_accent', accent)
    localStorage.setItem('cfg_bg', bg)
    localStorage.setItem('cfg_font', fontSize)
    localStorage.setItem('cfg_sidebar', sidebarCompact ? 'compact' : 'full')
    applyTheme(accent, bg, fontSize)
    menu.toast('Tema aplicado em todo o projeto')
  }

  const reset = () => {
    const dA = '#0A84FF', dB = '#08080a', dF = '14px'
    setAccent(dA); setBg(dB); setFontSize(dF); setSidebarCompact(false)
    localStorage.removeItem('cfg_accent'); localStorage.removeItem('cfg_bg')
    localStorage.removeItem('cfg_font'); localStorage.removeItem('cfg_sidebar')
    applyTheme(dA, dB, dF)
    menu.toast('Tema resetado para o padrão')
  }

  const swatch: React.CSSProperties = {
    width: 42, height: 42, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
    transition: 'all 0.18s', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }

  return (
    <div className="col gap-6">
      <div className="card card--pad">
        <SectionTitle>Cor de destaque</SectionTitle>
        <div className="row wrap" style={{ gap: 10 }}>
          {ACCENT_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => setAccent(c.value)}
              title={c.name}
              style={{
                ...swatch, background: c.value, border: 'none',
                outline: accent === c.value ? `2.5px solid ${c.value}` : '2.5px solid transparent', outlineOffset: 3,
              }}
            >
              {accent === c.value && <Check size={18} strokeWidth={2.5} color="#fff" />}
            </button>
          ))}
          <div className="row gap-3" style={{ marginLeft: 4 }}>
            <span className="dim" style={{ fontSize: 12 }}>Personalizada:</span>
            <input
              type="color"
              value={accent}
              onChange={e => setAccent(e.target.value)}
              style={{ width: 42, height: 42, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', padding: 2 }}
            />
          </div>
        </div>
      </div>

      <div className="card card--pad">
        <SectionTitle>Cor de fundo</SectionTitle>
        <div className="row wrap" style={{ gap: 10 }}>
          {BG_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => setBg(c.value)}
              title={c.name}
              style={{
                ...swatch, background: c.value,
                border: bg === c.value ? `2px solid var(--accent)` : '2px solid var(--border-strong)',
              }}
            >
              {bg === c.value && <Check size={16} strokeWidth={2.5} color="rgba(255,255,255,0.7)" />}
            </button>
          ))}
          <div className="row gap-3" style={{ marginLeft: 4 }}>
            <span className="dim" style={{ fontSize: 12 }}>Personalizada:</span>
            <input
              type="color"
              value={bg}
              onChange={e => setBg(e.target.value)}
              style={{ width: 42, height: 42, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', padding: 2 }}
            />
          </div>
        </div>
      </div>

      <div className="card card--pad">
        <SectionTitle>Tamanho da fonte</SectionTitle>
        <div className="row wrap" style={{ gap: 8 }}>
          {FONT_SIZES.map(f => (
            <button
              key={f.value}
              onClick={() => setFontSize(f.value)}
              className="btn"
              style={{
                fontSize: f.value,
                background: fontSize === f.value ? 'var(--accent-soft)' : undefined,
                borderColor: fontSize === f.value ? 'var(--accent-line)' : undefined,
                color: fontSize === f.value ? 'var(--accent-text)' : 'var(--text-secondary)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card card--pad">
        <SectionTitle>Sidebar</SectionTitle>
        <div className="row--between">
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Sidebar compacta</p>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>Exibir apenas os ícones, sem rótulos</p>
          </div>
          <button
            className="toggle"
            data-on={String(sidebarCompact)}
            onClick={() => setSidebarCompact(s => !s)}
            aria-label="Alternar sidebar compacta"
          />
        </div>
      </div>

      <div className="row wrap">
        <SaveBtn loading={false} onClick={save} />
        <button className="btn" onClick={reset}>
          <RotateCcw size={14} strokeWidth={2} />
          Resetar padrão
        </button>
      </div>
    </div>
  )
}

function NotificacoesSection() {
  const [browser,   setBrowser]   = useState(() => localStorage.getItem('notif_browser')   === 'true')
  const [cycleEnd,  setCycleEnd]  = useState(() => localStorage.getItem('notif_cycle')    !== 'false')
  const [pendentes, setPendentes] = useState(() => localStorage.getItem('notif_pend')     !== 'false')
  const [erros,     setErros]     = useState(() => localStorage.getItem('notif_err')      !== 'false')
  const [aprovacoes, setAprovacoes] = useState(() => localStorage.getItem('notif_aprov')  !== 'false')
  const [perm,      setPerm]      = useState<NotificationPermission>(typeof Notification !== 'undefined' ? Notification.permission : 'denied')
  const menu = useContextMenu()

  const showToast = (msg: string, type: 'ok' | 'err') => menu.toast(msg, type === 'ok' ? 'success' : 'error')

  const requestBrowserPerm = async () => {
    if (typeof Notification === 'undefined') return showToast('Notificações não suportadas neste browser', 'err')
    const result = await Notification.requestPermission()
    setPerm(result)
    if (result === 'granted') { setBrowser(true); showToast('Notificações do browser ativadas', 'ok') }
    else showToast('Permissão negada pelo browser', 'err')
  }

  const save = () => {
    localStorage.setItem('notif_browser',   String(browser))
    localStorage.setItem('notif_cycle',     String(cycleEnd))
    localStorage.setItem('notif_pend',      String(pendentes))
    localStorage.setItem('notif_err',       String(erros))
    localStorage.setItem('notif_aprov',     String(aprovacoes))
    showToast('Preferências salvas', 'ok')
  }

  const testNotif = () => {
    import('../components/NotificationBell').then(m => {
      m.pushNotification({ type: 'info', title: 'Notificação de teste', body: 'Tudo funcionando corretamente!' })
      showToast('Notificação de teste enviada', 'ok')
    })
  }

  const Toggle = ({ val, onChange, label, desc, disabled }: { val: boolean; onChange: (v: boolean) => void; label: string; desc: string; disabled?: boolean }) => (
    <div className="row--between" style={{ padding: '14px 0', borderBottom: '1px solid var(--border)', opacity: disabled ? 0.4 : 1 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</p>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>{desc}</p>
      </div>
      <button
        className="toggle"
        data-on={String(val && !disabled)}
        onClick={() => !disabled && onChange(!val)}
        disabled={disabled}
        aria-label={label}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer', marginLeft: 16 }}
      />
    </div>
  )

  const permColor = perm === 'granted' ? 'var(--accent-green)' : perm === 'denied' ? 'var(--accent-red)' : 'var(--accent-yellow)'

  return (
    <div className="col gap-6">

      <div className="card card--pad">
        <SectionTitle>Notificações do browser</SectionTitle>

        <div className="card card--pad" style={{ marginBottom: 4 }}>
          <div className="row--between wrap" style={{ gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>
                Permissão: <span style={{ color: permColor, fontWeight: 600 }}>
                  {perm === 'granted' ? 'Concedida' : perm === 'denied' ? 'Negada' : 'Pendente'}
                </span>
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                {perm === 'granted' ? 'O browser pode enviar notificações' : perm === 'denied' ? 'Bloqueado nas configurações do browser' : 'Clique para solicitar permissão'}
              </p>
            </div>
            {perm !== 'granted' && perm !== 'denied' && (
              <button className="btn btn--accent-soft btn--sm" onClick={requestBrowserPerm}>
                Solicitar
              </button>
            )}
          </div>
        </div>

        <Toggle
          val={browser} onChange={setBrowser}
          label="Notificações push do browser"
          desc="Receba alertas mesmo com a aba em segundo plano"
          disabled={perm !== 'granted'}
        />
      </div>

      <div className="card card--pad">
        <SectionTitle>Sino de notificações</SectionTitle>
        <Toggle val={cycleEnd}   onChange={setCycleEnd}   label="Ciclos manuais"       desc="Notificar ao iniciar ou concluir um ciclo" />
        <Toggle val={erros}      onChange={setErros}      label="Erros de agente"      desc="Alerta quando um agente retornar erro" />
        <Toggle val={aprovacoes} onChange={setAprovacoes} label="Aprovações"           desc="Alerta quando houver aprovações pendentes" />
        <Toggle val={pendentes}  onChange={setPendentes}  label="Badge de pendentes"   desc="Exibir contagem na sidebar" />
      </div>

      <div className="row wrap">
        <SaveBtn loading={false} onClick={save} />
        <button className="btn" onClick={testNotif}>
          <Send size={14} strokeWidth={2} />
          Testar notificação
        </button>
      </div>
    </div>
  )
}

function LeadgenSection() {
  const menu = useContextMenu()
  const [cfg, setCfg] = useState<LeadgenConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [novoNicho, setNovoNicho] = useState('')

  useEffect(() => {
    api.getLeadgen()
      .then(c => setCfg({ ...c, nichos: c.nichos || [] }))
      .catch(() => menu.toast('Não foi possível carregar a configuração de leads', 'error'))
      .finally(() => setLoading(false))
  }, [menu])

  const patch = (p: Partial<LeadgenConfig>) => setCfg(c => (c ? { ...c, ...p } : c))

  const addNicho = (n: string) => {
    const v = n.trim().toLowerCase()
    if (!v || !cfg) return
    if (cfg.nichos.some(x => x.toLowerCase() === v)) { menu.toast('Esse tipo já está na lista'); return }
    patch({ nichos: [...cfg.nichos, v] })
    setNovoNicho('')
  }

  const removeNicho = (n: string) => cfg && patch({ nichos: cfg.nichos.filter(x => x !== n) })

  const addCategoria = (itens: string[]) => {
    if (!cfg) return
    const set = new Set(cfg.nichos.map(x => x.toLowerCase()))
    const novos = itens.filter(i => !set.has(i.toLowerCase()))
    if (!novos.length) { menu.toast('Todos dessa categoria já estão na lista'); return }
    patch({ nichos: [...cfg.nichos, ...novos] })
    menu.toast(`${novos.length} tipo(s) adicionado(s)`)
  }

  const salvar = async () => {
    if (!cfg) return
    setSaving(true)
    try {
      const salvo = await api.saveLeadgen({ cidade: cfg.cidade, quantidade: cfg.quantidade, rotacao: cfg.rotacao, nichos: cfg.nichos })
      setCfg({ ...salvo, nichos: salvo.nichos || [] })
      menu.toast('Configuração de leads salva — vale no próximo ciclo de busca')
    } catch (e: unknown) { menu.toast(e instanceof Error ? e.message : 'Erro ao salvar', 'error') }
    finally { setSaving(false) }
  }

  if (loading || !cfg) {
    return <div className="empty"><RefreshCw size={26} className="spin" /><p className="muted">Carregando...</p></div>
  }

  const catalogo = cfg.catalogo || {}

  return (
    <div className="col gap-6">
      <div className="card card--pad">
        <SectionTitle>Onde e quanto buscar</SectionTitle>
        <Field label="Cidade / região" hint="Onde o agente Growth procura os negócios locais">
          <Input value={cfg.cidade} onChange={v => patch({ cidade: v })} placeholder="Ex.: São Paulo, Zona Sul" />
        </Field>
        <Field label="Quantos leads por ciclo" hint="Quanto maior, mais leads por busca (recomendado 6–12; acima disso a busca pode demorar mais)">
          <input
            className="input" type="number" min={1} max={20} value={cfg.quantidade}
            onChange={e => patch({ quantidade: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)) })}
            style={{ maxWidth: 140 }}
          />
        </Field>
        <div className="row--between" style={{ marginTop: 4 }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Rodar os tipos de negócio</p>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>A cada ciclo prioriza tipos diferentes da sua lista, cobrindo mais nichos ao longo do tempo</p>
          </div>
          <button className="toggle" data-on={String(cfg.rotacao)} onClick={() => patch({ rotacao: !cfg.rotacao })} aria-label="Rodar tipos" />
        </div>
      </div>

      <div className="card card--pad">
        <SectionTitle>Tipos de negócio na busca ({cfg.nichos.length})</SectionTitle>
        <p className="dim" style={{ fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.5 }}>
          O Growth só procura leads dentro destes tipos. Adicione os seus para ampliar o alcance.
        </p>
        <div className="row" style={{ gap: 8, marginBottom: 14 }}>
          <input
            className="input" value={novoNicho} onChange={e => setNovoNicho(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNicho(novoNicho) } }}
            placeholder="Adicionar tipo (ex.: clínicas de estética)"
          />
          <button className="btn btn--primary" onClick={() => addNicho(novoNicho)} disabled={!novoNicho.trim()}>
            <Plus size={14} /> Adicionar
          </button>
        </div>
        <div className="row wrap" style={{ gap: 7 }}>
          {cfg.nichos.length === 0 && <p className="dim" style={{ fontSize: 12 }}>Nenhum tipo — adicione ao menos um.</p>}
          {cfg.nichos.map(n => (
            <span key={n} className="badge" style={{ gap: 6, padding: '5px 8px 5px 11px', background: 'var(--surface-2)', fontSize: 12.5 }}>
              {n}
              <button onClick={() => removeNicho(n)} title="Remover" style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', padding: 0 }}>
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      </div>

      {Object.keys(catalogo).length > 0 && (
        <div className="card card--pad">
          <SectionTitle>Catálogo — clique para adicionar</SectionTitle>
          <div className="col" style={{ gap: 16 }}>
            {Object.entries(catalogo).map(([cat, itens]) => (
              <div key={cat}>
                <div className="row--between" style={{ marginBottom: 8 }}>
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>{cat}</p>
                  <button className="btn btn--ghost btn--sm" onClick={() => addCategoria(itens)}>
                    <Plus size={12} /> Adicionar todos
                  </button>
                </div>
                <div className="row wrap" style={{ gap: 6 }}>
                  {itens.map(i => {
                    const ativo = cfg.nichos.some(x => x.toLowerCase() === i.toLowerCase())
                    return (
                      <button
                        key={i} onClick={() => !ativo && addNicho(i)} disabled={ativo}
                        className="badge"
                        style={{ gap: 5, padding: '5px 10px', fontSize: 12, cursor: ativo ? 'default' : 'pointer',
                          background: ativo ? 'color-mix(in srgb, var(--accent-green) 14%, transparent)' : 'var(--surface-2)',
                          color: ativo ? 'var(--accent-green)' : 'var(--text-secondary)', border: 'none' }}
                      >
                        {ativo ? <Check size={12} /> : <Plus size={12} />} {i}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="row wrap">
        <SaveBtn loading={saving} onClick={salvar} />
        <span className="dim row" style={{ fontSize: 11.5, gap: 6 }}><RotateCw size={12} /> Vale a partir do próximo ciclo de busca</span>
      </div>
    </div>
  )
}

type Section = 'conta' | 'aparencia' | 'notificacoes' | 'conexoes' | 'leads'

export default function Configuracoes() {
  const [section, setSection] = useState<Section>('conta')
  const isMobile = useIsMobile()
  const menu = useContextMenu()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('state') === 'meta' && params.get('code')) {
      const redirectUri = window.location.origin + window.location.pathname
      setSection('conexoes')
      api.metaExchange({ code: params.get('code') || '', redirectUri })
        .then(r => menu.toast(r.ok ? `Facebook conectado — página ${r.page}` : (r.error || 'Falha ao conectar'), r.ok ? 'success' : 'error'))
        .catch(e => menu.toast(e instanceof Error ? e.message : 'Erro ao conectar', 'error'))
        .finally(() => window.history.replaceState({}, '', window.location.pathname))
    }
  }, [menu])

  const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'conta',        label: 'Conta',        icon: <User    size={15} strokeWidth={1.6} /> },
    { id: 'conexoes',     label: 'Conexões',     icon: <Plug    size={15} strokeWidth={1.6} /> },
    { id: 'leads',        label: 'Busca de Leads', icon: <Target size={15} strokeWidth={1.6} /> },
    { id: 'aparencia',    label: 'Aparência',    icon: <Palette size={15} strokeWidth={1.6} /> },
    { id: 'notificacoes', label: 'Notificações', icon: <Bell    size={15} strokeWidth={1.6} /> },
  ]

  const content = (
    <>
      {section === 'conta'        && <ContaSection />}
      {section === 'conexoes'     && <ConexoesSection />}
      {section === 'leads'        && <LeadgenSection />}
      {section === 'aparencia'    && <AparenciaSection />}
      {section === 'notificacoes' && <NotificacoesSection />}
    </>
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-sub">Personalize o Studio IA</p>
        </div>
      </div>

      {isMobile ? (
        <div className="col gap-6">
          <div className="row scroll" style={{ gap: 8, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 2, margin: '0 -2px', WebkitOverflowScrolling: 'touch' }}>
            {sections.map(s => {
              const active = section === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={'btn btn--pill' + (active ? ' btn--accent-soft' : '')}
                  style={{ flexShrink: 0 }}
                >
                  {s.icon}
                  {s.label}
                </button>
              )
            })}
          </div>
          <div className="anim-fade" key={section}>{content}</div>
        </div>
      ) : (
        <div className="split split--narrow">
          <div className="panel" style={{ alignSelf: 'flex-start', padding: 6 }}>
            {sections.map(s => {
              const active = section === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={'nav-link' + (active ? ' is-active' : '')}
                  style={{ width: '100%', textAlign: 'left' }}
                >
                  {s.icon}
                  <span style={{ flex: 1 }}>{s.label}</span>
                </button>
              )
            })}
          </div>

          <div className="anim-fade" key={section}>{content}</div>
        </div>
      )}
    </div>
  )
}
