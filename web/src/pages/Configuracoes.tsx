import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { auth, db } from '../firebase'
import {
  updatePassword, updateProfile, EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth'
import { doc, updateDoc } from 'firebase/firestore'
import {
  User, Palette, Bell, ChevronRight,
  Check, Eye, EyeOff, Save, RefreshCw
} from 'lucide-react'

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
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</label>
      {children}
      {hint && <p style={{ margin: '6px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>{hint}</p>}
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder, disabled }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string; disabled?: boolean }) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        type={isPassword && !show ? 'password' : 'text'}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: isPassword ? '10px 44px 10px 14px' : '10px 14px',
          fontSize: 14, color: disabled ? 'rgba(255,255,255,0.3)' : 'var(--text-primary)',
          outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.18s',
        }}
        onFocus={e => { e.target.style.borderColor = 'rgba(10,132,255,0.5)' }}
        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: 0, display: 'flex' }}
        >
          {show ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
        </button>
      )}
    </div>
  )
}

function Toast({ msg, type }: { msg: string; type: 'ok' | 'err' }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: type === 'ok' ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.15)',
      border: `1px solid ${type === 'ok' ? 'rgba(48,209,88,0.35)' : 'rgba(255,69,58,0.35)'}`,
      color: type === 'ok' ? '#30D158' : '#FF453A',
      borderRadius: 12, padding: '12px 18px', fontSize: 13, fontWeight: 500,
      display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      {type === 'ok' ? <Check size={15} strokeWidth={2.5} /> : null}
      {msg}
    </div>
  )
}

function SaveBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
        background: 'rgba(10,132,255,0.9)', border: 'none', borderRadius: 10,
        color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
        opacity: loading ? 0.7 : 1, transition: 'all 0.18s',
      }}
    >
      {loading ? <RefreshCw size={14} strokeWidth={2} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Save size={14} strokeWidth={2} />}
      {loading ? 'Salvando...' : 'Salvar'}
    </button>
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
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

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
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>Perfil</h3>
        <Field label="Email" hint="O email não pode ser alterado">
          <Input value={user?.email || ''} onChange={() => {}} disabled />
        </Field>
        <Field label="Nome de exibição">
          <Input value={name} onChange={setName} placeholder="Seu nome" />
        </Field>
        <SaveBtn loading={loadingName} onClick={saveName} />
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '28px 0' }} />

      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>Alterar Senha</h3>
        <Field label="Senha atual">
          <Input value={currentPwd} onChange={setCurrentPwd} type="password" placeholder="••••••••" />
        </Field>
        <Field label="Nova senha" hint="Mínimo 6 caracteres">
          <Input value={newPwd} onChange={setNewPwd} type="password" placeholder="••••••••" />
        </Field>
        <Field label="Confirmar nova senha">
          <Input value={confirmPwd} onChange={setConfirmPwd} type="password" placeholder="••••••••" />
        </Field>
        <SaveBtn loading={loadingPwd} onClick={savePwd} />
      </div>
    </div>
  )
}

function AparenciaSection() {
  const [accent, setAccent] = useState(() => localStorage.getItem('cfg_accent') || '#0A84FF')
  const [bg, setBg] = useState(() => localStorage.getItem('cfg_bg') || '#08080a')
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('cfg_font') || '14px')
  const [sidebarCompact, setSidebarCompact] = useState(() => localStorage.getItem('cfg_sidebar') === 'compact')
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

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
    setToast({ msg: 'Tema aplicado em todo o projeto', type: 'ok' })
    setTimeout(() => setToast(null), 3000)
  }

  const reset = () => {
    const dA = '#0A84FF', dB = '#08080a', dF = '14px'
    setAccent(dA); setBg(dB); setFontSize(dF); setSidebarCompact(false)
    localStorage.removeItem('cfg_accent'); localStorage.removeItem('cfg_bg')
    localStorage.removeItem('cfg_font'); localStorage.removeItem('cfg_sidebar')
    applyTheme(dA, dB, dF)
    setToast({ msg: 'Tema resetado para o padrão', type: 'ok' })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>Cor de destaque</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {ACCENT_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => setAccent(c.value)}
              title={c.name}
              style={{
                width: 40, height: 40, borderRadius: 10, background: c.value, border: 'none',
                cursor: 'pointer', outline: accent === c.value ? `3px solid ${c.value}` : '3px solid transparent',
                outlineOffset: 3, transition: 'all 0.18s', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {accent === c.value && <Check size={18} strokeWidth={2.5} color="#fff" />}
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Personalizada:</label>
            <input
              type="color"
              value={accent}
              onChange={e => setAccent(e.target.value)}
              style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', background: 'transparent', padding: 2 }}
            />
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '20px 0' }} />

      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>Cor de fundo</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {BG_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => setBg(c.value)}
              title={c.name}
              style={{
                width: 40, height: 40, borderRadius: 10, background: c.value,
                border: bg === c.value ? `2px solid ${accent}` : '2px solid rgba(255,255,255,0.15)',
                cursor: 'pointer', transition: 'all 0.18s', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {bg === c.value && <Check size={16} strokeWidth={2.5} color="rgba(255,255,255,0.7)" />}
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Personalizada:</label>
            <input
              type="color"
              value={bg}
              onChange={e => setBg(e.target.value)}
              style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', background: 'transparent', padding: 2 }}
            />
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '20px 0' }} />

      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>Tamanho da fonte</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {FONT_SIZES.map(f => (
            <button
              key={f.value}
              onClick={() => setFontSize(f.value)}
              style={{
                padding: '8px 16px', borderRadius: 10, fontSize: f.value,
                background: fontSize === f.value ? `rgba(10,132,255,0.15)` : 'rgba(255,255,255,0.05)',
                border: fontSize === f.value ? `1px solid ${accent}55` : '1px solid rgba(255,255,255,0.1)',
                color: fontSize === f.value ? accent : 'var(--text-secondary)',
                cursor: 'pointer', fontWeight: 500, transition: 'all 0.18s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '20px 0' }} />

      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>Sidebar</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <div
            onClick={() => setSidebarCompact(s => !s)}
            style={{
              width: 44, height: 26, borderRadius: 13, transition: 'background 0.2s',
              background: sidebarCompact ? accent : 'rgba(255,255,255,0.12)',
              position: 'relative', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: 3, left: sidebarCompact ? 21 : 3,
              width: 20, height: 20, borderRadius: 10, background: '#fff',
              transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
            }} />
          </div>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Sidebar compacta (sem labels)</span>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <SaveBtn loading={false} onClick={save} />
        <button
          onClick={reset}
          style={{
            padding: '10px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)',
            fontSize: 13.5, cursor: 'pointer', fontWeight: 500,
          }}
        >
          Resetar padrão
        </button>
      </div>
    </div>
  )
}

function NotificacoesSection() {
  const acc = () => document.documentElement.style.getPropertyValue('--accent') || '#0A84FF'

  const [browser,   setBrowser]   = useState(() => localStorage.getItem('notif_browser')   === 'true')
  const [cycleEnd,  setCycleEnd]  = useState(() => localStorage.getItem('notif_cycle')    !== 'false')
  const [pendentes, setPendentes] = useState(() => localStorage.getItem('notif_pend')     !== 'false')
  const [erros,     setErros]     = useState(() => localStorage.getItem('notif_err')      !== 'false')
  const [aprovacoes, setAprovacoes] = useState(() => localStorage.getItem('notif_aprov')  !== 'false')
  const [perm,      setPerm]      = useState<NotificationPermission>(typeof Notification !== 'undefined' ? Notification.permission : 'denied')
  const [toast,     setToast]     = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const showToast = (msg: string, type: 'ok' | 'err') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', opacity: disabled ? 0.4 : 1 }}>
      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</p>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>{desc}</p>
      </div>
      <div
        onClick={() => !disabled && onChange(!val)}
        style={{
          width: 44, height: 26, borderRadius: 13, transition: 'background 0.2s',
          background: val && !disabled ? acc() : 'rgba(255,255,255,0.12)',
          position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0, marginLeft: 16,
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: val && !disabled ? 21 : 3,
          width: 20, height: 20, borderRadius: 10, background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }} />
      </div>
    </div>
  )

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>Notificações do browser</h3>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>
                Permissão: <span style={{ color: perm === 'granted' ? '#30D158' : perm === 'denied' ? '#FF453A' : '#FFD60A', fontWeight: 600 }}>
                  {perm === 'granted' ? 'Concedida' : perm === 'denied' ? 'Negada' : 'Pendente'}
                </span>
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                {perm === 'granted' ? 'O browser pode enviar notificações' : perm === 'denied' ? 'Bloqueado nas configurações do browser' : 'Clique para solicitar permissão'}
              </p>
            </div>
            {perm !== 'granted' && perm !== 'denied' && (
              <button
                onClick={requestBrowserPerm}
                style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(10,132,255,0.15)', border: '1px solid rgba(10,132,255,0.3)', color: '#0A84FF', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
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

      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 0 20px' }} />

      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>Sino de notificações</h3>
        <Toggle val={cycleEnd}   onChange={setCycleEnd}   label="Ciclos manuais"       desc="Notificar ao iniciar ou concluir um ciclo" />
        <Toggle val={erros}      onChange={setErros}      label="Erros de agente"      desc="Alerta quando um agente retornar erro" />
        <Toggle val={aprovacoes} onChange={setAprovacoes} label="Aprovações"           desc="Alerta quando houver aprovações pendentes" />
        <Toggle val={pendentes}  onChange={setPendentes}  label="Badge de pendentes"   desc="Exibir contagem na sidebar" />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <SaveBtn loading={false} onClick={save} />
        <button
          onClick={testNotif}
          style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontSize: 13.5, cursor: 'pointer', fontWeight: 500 }}
        >
          Testar notificação
        </button>
      </div>
    </div>
  )
}

type Section = 'conta' | 'aparencia' | 'notificacoes'

export default function Configuracoes() {
  const [section, setSection] = useState<Section>('conta')

  const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'conta',        label: 'Conta',        icon: <User    size={15} strokeWidth={1.5} /> },
    { id: 'aparencia',    label: 'Aparência',    icon: <Palette size={15} strokeWidth={1.5} /> },
    { id: 'notificacoes', label: 'Notificações', icon: <Bell    size={15} strokeWidth={1.5} /> },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '20px 28px', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ marginBottom: 18, flexShrink: 0 }}>
        <h1 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 700, margin: 0 }}>Configurações</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: '4px 0 0' }}>Personalize o Studio IA</p>
      </div>

      <div style={{ display: 'flex', gap: 18, flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <div style={{ width: 196, flexShrink: 0, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 8, alignSelf: 'flex-start' }}>
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 12px', borderRadius: 10,
                background: section === s.id ? 'rgba(10,132,255,0.14)' : 'transparent',
                border: section === s.id ? '1px solid rgba(10,132,255,0.28)' : '1px solid transparent',
                color: section === s.id ? '#0A84FF' : 'rgba(255,255,255,0.5)',
                fontSize: 13.5, fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (section !== s.id) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
              onMouseLeave={e => { if (section !== s.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' } }}
            >
              {s.icon}
              <span style={{ flex: 1 }}>{s.label}</span>
              <ChevronRight size={13} strokeWidth={1.5} style={{ opacity: 0.35 }} />
            </button>
          ))}
        </div>

        <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            {sections.find(s => s.id === section)?.icon}
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {sections.find(s => s.id === section)?.label}
            </h2>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
            {section === 'conta'        && <ContaSection />}
            {section === 'aparencia'    && <AparenciaSection />}
            {section === 'notificacoes' && <NotificacoesSection />}
          </div>
        </div>
      </div>
    </div>
  )
}
