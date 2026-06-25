import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { pushNotification } from '../components/NotificationBell'
import type { Agent, SystemStatus, Stats } from '../types'
import {
  Terminal, Globe, Pencil, BookOpen,
  Play, Loader2, X, Check, Save,
  Users, FileText, Megaphone, Mail, Package,
  AlertCircle, Activity, TrendingUp, Clock,
} from 'lucide-react'

type AgentsMap = Record<string, Agent>


const AGENT_MASCOT_IMG: Record<string, string> = {
  'code':            '/mascots/1.png',
  'design':          '/mascots/2.png',
  'research':        '/mascots/3.png',
  'general':         '/mascots/4.png',
  'studio-ceo':      '/mascots/5.png',
  'studio-growth':   '/mascots/6.png',
  'studio-clientes': '/mascots/7.png',
  'studio-trafego':  '/mascots/8.png',
  'studio-dados':    '/mascots/9.png',
  'studio-criacao':  '/mascots/2.png',
}

function AgentMascot({ name, size = 48 }: { name: string; size?: number }) {
  const src = AGENT_MASCOT_IMG[name] || '/mascots/4.png'
  return <img src={src} alt={name} width={size} height={size} style={{ flexShrink: 0, objectFit: 'contain' }} />
}

const MODEL_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  opus:   { bg: 'rgba(255,159,10,0.15)',  color: '#FF9F0A', border: 'rgba(255,159,10,0.3)'  },
  sonnet: { bg: 'rgba(10,132,255,0.15)',  color: '#0A84FF', border: 'rgba(10,132,255,0.3)'  },
  haiku:  { bg: 'rgba(48,209,88,0.15)',   color: '#30D158', border: 'rgba(48,209,88,0.3)'   },
}

const TOOL_META: Record<string, { label: string }> = {
  shell: { label: 'Shell' },
  web:   { label: 'Web' },
  edit:  { label: 'Editar arquivos' },
  read:  { label: 'Ler arquivos' },
}

function classifyLog(line: string): string {
  if (line.includes('ERRO') || line.includes('error')) return '#FF453A'
  if (line.includes('AVISO') || line.includes('WARN'))  return '#FFD60A'
  if (line.includes('=== CICLO') || line.includes('CICLO ')) return '#0A84FF'
  if (line.includes('done') || line.includes('OK') || line.includes('sucesso')) return '#30D158'
  return 'rgba(255,255,255,0.75)'
}

function ModelBadge({ model }: { model: string }) {
  const c = MODEL_COLORS[model] || { bg: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', border: 'rgba(255,255,255,0.12)' }
  return (
    <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontSize: 9, padding: '1px 6px', borderRadius: 5, fontWeight: 600, letterSpacing: '0.02em' }}>
      {model}
    </span>
  )
}

function ToolIcon({ label, active }: { label: string; active: boolean }) {
  const icons: Record<string, React.ReactNode> = {
    shell: <Terminal size={12} strokeWidth={1.5} />,
    web:   <Globe size={12} strokeWidth={1.5} />,
    edit:  <Pencil size={12} strokeWidth={1.5} />,
    read:  <BookOpen size={12} strokeWidth={1.5} />,
  }
  return (
    <span style={{ opacity: active ? 1 : 0.18, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center' }} title={TOOL_META[label]?.label}>
      {icons[label]}
    </span>
  )
}

function AgentModal({ name, agent, onClose, onSaved }: { name: string; agent: Agent; onClose: () => void; onSaved: (updated: Agent) => void }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [form, setForm] = useState<Agent>({ ...agent })

  const toolIcons: Record<string, React.ReactNode> = {
    shell: <Terminal size={13} strokeWidth={1.5} />,
    web:   <Globe size={13} strokeWidth={1.5} />,
    edit:  <Pencil size={13} strokeWidth={1.5} />,
    read:  <BookOpen size={13} strokeWidth={1.5} />,
  }

  const startEdit = () => { setForm({ ...agent }); setSaveErr(''); setEditing(true) }
  const cancelEdit = () => { setEditing(false); setSaveErr('') }

  const handleSave = async () => {
    setSaving(true)
    setSaveErr('')
    try {
      await api.updateAgent(name, form)
      onSaved(form)
      setEditing(false)
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const viewAgent = editing ? form : agent
  const viewTools = viewAgent.tools || {}
  const activeTools = (['shell', 'web', 'edit', 'read'] as const).filter(t => !!(viewTools as Record<string, boolean>)[t])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '100%', maxWidth: 580, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AgentMascot name={name} size={40} />
            <div>
              <h2 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, margin: '0 0 2px 0', textTransform: 'capitalize' }}>{name.replace('studio-', '')}</h2>
              <ModelBadge model={viewAgent.model} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {editing ? (
              <button
                onClick={cancelEdit}
                style={{ padding: '5px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
              >
                Cancelar
              </button>
            ) : (
              <button
                onClick={startEdit}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: 'rgba(10,132,255,0.12)', border: '1px solid rgba(10,132,255,0.25)', color: '#0A84FF', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
              >
                <Pencil size={11} strokeWidth={2} />
                Editar
              </button>
            )}
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {editing ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Modelo</label>
                  <select
                    value={form.model}
                    onChange={e => setForm(f => ({ ...f, model: e.target.value as Agent['model'] }))}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    <option value="opus">opus</option>
                    <option value="sonnet">sonnet</option>
                    <option value="haiku">haiku</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Max Turns</label>
                  <input
                    type="number" min={1} max={200}
                    value={form.maxTurns}
                    onChange={e => setForm(f => ({ ...f, maxTurns: Number(e.target.value) }))}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Capacidades</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(['shell', 'web', 'edit', 'read'] as const).map(t => {
                    const on = !!(form.tools as Record<string, boolean>)[t]
                    return (
                      <button
                        key={t}
                        onClick={() => setForm(f => ({ ...f, tools: { ...f.tools, [t]: !on } }))}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 980, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: on ? 'rgba(10,132,255,0.15)' : 'rgba(255,255,255,0.04)', border: on ? '1px solid rgba(10,132,255,0.3)' : '1px solid rgba(255,255,255,0.08)', color: on ? '#0A84FF' : 'var(--text-tertiary)', transition: 'all 0.15s' }}
                      >
                        <span style={{ display: 'flex' }}>{toolIcons[t]}</span>
                        {TOOL_META[t].label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label style={{ color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>System Prompt</label>
                <textarea
                  value={form.system}
                  onChange={e => setForm(f => ({ ...f, system: e.target.value }))}
                  style={{ width: '100%', minHeight: 220, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.7, padding: 14, fontFamily: "'SF Mono', 'Fira Code', monospace", resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {saveErr && (
                <p style={{ color: '#FF453A', fontSize: 12, margin: 0 }}>{saveErr}</p>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 11, borderRadius: 10, background: saving ? 'rgba(255,255,255,0.05)' : 'rgba(48,209,88,0.15)', border: saving ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(48,209,88,0.3)', color: saving ? 'var(--text-tertiary)' : '#30D158', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
              >
                {saving
                  ? <Loader2 size={14} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Save size={14} strokeWidth={2} />
                }
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { value: agent.maxTurns, label: 'Max Turns' },
                  { value: activeTools.length, label: 'Ferramentas' },
                  { value: agent.model, label: 'Modelo', cap: true },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', textTransform: s.cap ? 'capitalize' : undefined }}>{s.value}</div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px 0' }}>Capacidades</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(['shell', 'web', 'edit', 'read'] as const).map(t => {
                    const on = !!(viewTools as Record<string, boolean>)[t]
                    return (
                      <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 980, fontSize: 12, fontWeight: 500, background: on ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.02)', border: on ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.04)', color: on ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                        <span style={{ opacity: on ? 1 : 0.3, display: 'flex' }}>{toolIcons[t]}</span>
                        <span>{TOOL_META[t].label}</span>
                        <span style={{ color: on ? '#30D158' : 'var(--text-tertiary)', display: 'flex' }}>{on ? <Check size={10} strokeWidth={2} /> : <X size={10} strokeWidth={2} />}</span>
                      </span>
                    )
                  })}
                </div>
              </div>
              <div>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px 0' }}>System Prompt</p>
                <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
                  {agent.system || '(sem system prompt)'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AgentCard({ name, agent, onClick }: { name: string; agent: Agent; onClick: () => void }) {
  const tools = agent.tools || {}
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ background: hov ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 12px', textAlign: 'left', width: '100%', cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)', transform: hov ? 'translateY(-2px)' : 'none', boxShadow: hov ? '0 8px 24px rgba(0,0,0,0.5)' : 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <AgentMascot name={name} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 12, textTransform: 'capitalize', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name.replace('studio-', '')}</h3>
            <ModelBadge model={agent.model} />
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 10, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5 }}>
            {agent.system?.slice(0, 70) || 'Sem descrição'}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {(['shell', 'web', 'edit', 'read'] as const).map(t => (
            <ToolIcon key={t} label={t} active={!!(tools as Record<string, boolean>)[t]} />
          ))}
        </div>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{agent.maxTurns}t</span>
      </div>
    </button>
  )
}

const KPI_DEFS = [
  { key: 'leads',    label: 'Leads',      icon: <Users size={16} strokeWidth={1.5} />,      color: '#0A84FF' },
  { key: 'conteudo', label: 'Conteúdos',  icon: <FileText size={16} strokeWidth={1.5} />,   color: '#30D158' },
  { key: 'campanhas',label: 'Campanhas',  icon: <Megaphone size={16} strokeWidth={1.5} />,  color: '#FF9F0A' },
  { key: 'emails',   label: 'Emails',     icon: <Mail size={16} strokeWidth={1.5} />,        color: '#BF5AF2' },
  { key: 'produtos', label: 'Produtos',   icon: <Package size={16} strokeWidth={1.5} />,    color: '#FF453A' },
  { key: 'reports',  label: 'Relatórios', icon: <TrendingUp size={16} strokeWidth={1.5} />, color: '#64D2FF' },
]

export default function Dashboard() {
  const [agents,        setAgents]        = useState<AgentsMap>({})
  const [status,        setStatus]        = useState<SystemStatus | null>(null)
  const [stats,         setStats]         = useState<Stats | null>(null)
  const [logLines,      setLogLines]      = useState<string[]>([])
  const [loading,       setLoading]       = useState(true)
  const [cycleLoading,  setCycleLoading]  = useState<string | null>(null)
  const [toast,         setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<{ name: string; agent: Agent } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadData = useCallback(async () => {
    try {
      const [agentsData, statusData, statsData, logsData] = await Promise.all([
        api.getAgents(),
        api.getStatus(),
        api.getStats(),
        api.getLogs(),
      ])
      setAgents(agentsData)
      setStatus(statusData)
      setStats(statsData)
      setLogLines(logsData.lines.slice(-30))
    } catch {
      showToast('Erro ao carregar dados', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const iv = setInterval(loadData, 5000)
    return () => clearInterval(iv)
  }, [loadData])

  const runCycle = async (cycle: 'segunda' | 'diario' | 'sexta') => {
    setCycleLoading(cycle)
    try {
      const res = await api.runCycle(cycle)
      showToast(`Ciclo ${cycle} iniciado (PID ${res.pid})`)
      pushNotification({ type: 'success', title: `Ciclo ${cycle} iniciado`, body: `PID ${res.pid}` })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao iniciar ciclo'
      showToast(msg, 'error')
      pushNotification({ type: 'error', title: 'Erro ao iniciar ciclo', body: msg })
    } finally {
      setCycleLoading(null)
    }
  }

  const agentEntries = Object.entries(agents)
  const isOnline = !status?.disabled

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  const lastCycleLabel = stats?.lastCycle
    ? stats.lastCycle.replace(/^\[.*?\]\s*=== /, '').replace(' ===', '')
    : 'Nenhum ciclo ainda'

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ padding: '18px 20px 16px', gap: 14 }}>

      {selectedAgent && (
        <AgentModal
          name={selectedAgent.name}
          agent={selectedAgent.agent}
          onClose={() => setSelectedAgent(null)}
          onSaved={updated => {
            setAgents(prev => ({ ...prev, [selectedAgent.name]: updated }))
            setSelectedAgent(prev => prev ? { ...prev, agent: updated } : null)
            showToast('Agente atualizado com sucesso')
          }}
        />
      )}

      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 100, background: 'rgba(20,20,22,0.96)', border: `1px solid rgba(255,255,255,0.1)`, borderLeft: `3px solid ${toast.type === 'success' ? '#30D158' : '#FF453A'}`, backdropFilter: 'blur(20px)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', fontWeight: 500 }}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1 }}>Visão Geral</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 11, margin: '3px 0 0 0' }}>
            {new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {stats && stats.totalErrors > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.2)', borderRadius: 8, padding: '5px 10px' }}>
              <AlertCircle size={12} strokeWidth={1.5} style={{ color: '#FF453A' }} />
              <span style={{ fontSize: 11, color: '#FF453A', fontWeight: 600 }}>{stats.totalErrors} erros</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '5px 10px' }}>
            <Clock size={11} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{lastCycleLabel}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '5px 10px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline ? '#30D158' : '#FF453A', boxShadow: `0 0 6px ${isOnline ? '#30D158' : '#FF453A'}` }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: isOnline ? '#30D158' : '#FF453A', letterSpacing: '0.05em' }}>
              {isOnline ? 'ATIVO' : 'PAUSADO'}
            </span>
          </div>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="flex-shrink-0" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {KPI_DEFS.map(kpi => {
          const val = stats?.counts[kpi.key as keyof typeof stats.counts] ?? 0
          return (
            <div key={kpi.key} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 500 }}>{kpi.label}</span>
                <span style={{ color: kpi.color, opacity: 0.7 }}>{kpi.icon}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{val}</div>
            </div>
          )
        })}
      </div>

      {/* ── Main area: agents + activity ── */}
      <div className="flex-1 min-h-0" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12 }}>

        {/* Agents panel */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>Agentes <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>({agentEntries.length})</span></span>
            <Activity size={13} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <div className="flex-1 overflow-y-auto" style={{ padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {agentEntries.map(([name, agent]) => (
                <AgentCard key={name} name={name} agent={agent} onClick={() => setSelectedAgent({ name, agent })} />
              ))}
            </div>
          </div>
        </div>

        {/* Activity + actions panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflow: 'hidden' }}>

          {/* Live activity */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>Atividade recente</span>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#30D158', boxShadow: '0 0 5px #30D158' }} />
            </div>
            <div className="flex-1 overflow-y-auto" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {logLines.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: 12, fontFamily: "'SF Mono', monospace" }}>Sem atividade ainda</p>
              ) : (
                logLines.slice().reverse().map((line, i) => (
                  <div key={i} style={{ fontSize: 12, fontFamily: "'SF Mono', 'Fira Code', monospace", lineHeight: 1.7, color: classifyLog(line), wordBreak: 'break-all', padding: '1px 0' }}>
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cycle actions */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 14, flexShrink: 0 }}>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px 0' }}>Ciclos manuais</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {(['segunda', 'diario', 'sexta'] as const).map(cycle => {
                const labels: Record<string, string> = { segunda: 'Segunda — Plano + Leads', diario: 'Diário — Tráfego + Clientes', sexta: 'Sexta — Dados + Relatório' }
                return (
                  <button
                    key={cycle}
                    onClick={() => runCycle(cycle)}
                    disabled={cycleLoading !== null}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'var(--text-primary)', borderRadius: 10, padding: '9px 12px', fontSize: 12, fontWeight: 500, cursor: cycleLoading !== null ? 'not-allowed' : 'pointer', opacity: cycleLoading !== null && cycleLoading !== cycle ? 0.4 : 1, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    {cycleLoading === cycle
                      ? <Loader2 size={12} strokeWidth={2} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                      : <Play size={12} strokeWidth={1.5} style={{ color: '#0A84FF', flexShrink: 0 }} />
                    }
                    {labels[cycle]}
                  </button>
                )
              })}
              <Link
                to="/aprovacoes"
                style={{ background: (stats?.counts.pendentes ?? 0) > 0 ? 'rgba(255,214,10,0.1)' : 'rgba(255,255,255,0.05)', border: (stats?.counts.pendentes ?? 0) > 0 ? '1px solid rgba(255,214,10,0.22)' : '1px solid rgba(255,255,255,0.09)', color: (stats?.counts.pendentes ?? 0) > 0 ? '#FFD60A' : 'var(--text-secondary)', borderRadius: 10, padding: '9px 12px', fontSize: 12, fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}
              >
                <AlertCircle size={12} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                Aprovações pendentes
                {(stats?.counts.pendentes ?? 0) > 0 && (
                  <span style={{ background: '#FF453A', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, marginLeft: 'auto' }}>
                    {stats!.counts.pendentes}
                  </span>
                )}
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
