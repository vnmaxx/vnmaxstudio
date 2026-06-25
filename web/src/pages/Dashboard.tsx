import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { Agent, SystemStatus, Stats } from '../types'
import {
  Terminal, Globe, Pencil, BookOpen,
  Play, Pause, Loader2, X, Check,
  Users, FileText, Megaphone, Mail, Package,
  AlertCircle, Activity, TrendingUp, Clock,
} from 'lucide-react'

type AgentsMap = Record<string, Agent>

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
  return 'rgba(255,255,255,0.4)'
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

function AgentModal({ name, agent, onClose }: { name: string; agent: Agent; onClose: () => void }) {
  const tools = agent.tools || {}
  const activeTools = (['shell', 'web', 'edit', 'read'] as const).filter(t => !!(tools as Record<string, boolean>)[t])
  const toolIcons: Record<string, React.ReactNode> = {
    shell: <Terminal size={13} strokeWidth={1.5} />,
    web:   <Globe size={13} strokeWidth={1.5} />,
    edit:  <Pencil size={13} strokeWidth={1.5} />,
    read:  <BookOpen size={13} strokeWidth={1.5} />,
  }
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, margin: 0, textTransform: 'capitalize' }}>{name}</h2>
            <ModelBadge model={agent.model} />
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="overflow-y-auto" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                const on = !!(tools as Record<string, boolean>)[t]
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
      style={{ background: hov ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px', textAlign: 'left', width: '100%', cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)', transform: hov ? 'translateY(-1px)' : 'none', boxShadow: hov ? '0 4px 20px rgba(0,0,0,0.4)' : 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 12, textTransform: 'capitalize', margin: 0 }}>{name.replace('studio-', '')}</h3>
        <ModelBadge model={agent.model} />
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 10.5, margin: '0 0 8px 0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5 }}>
        {agent.system?.slice(0, 80) || 'Sem descrição'}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

  const toggleDisabled = async () => {
    try {
      const res = await api.toggleDisabled()
      setStatus(s => s ? { ...s, disabled: res.disabled } : null)
      showToast(res.disabled ? 'Sistema pausado' : 'Sistema ativado')
    } catch {
      showToast('Erro ao alterar status', 'error')
    }
  }

  const runCycle = async (cycle: 'segunda' | 'diario' | 'sexta') => {
    setCycleLoading(cycle)
    try {
      const res = await api.runCycle(cycle)
      showToast(`Ciclo ${cycle} iniciado (PID ${res.pid})`)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Erro ao iniciar ciclo', 'error')
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
        <AgentModal name={selectedAgent.name} agent={selectedAgent.agent} onClose={() => setSelectedAgent(null)} />
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
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline ? '#30D158' : '#FF453A', boxShadow: `0 0 6px ${isOnline ? '#30D158' : '#FF453A'}` }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: isOnline ? '#30D158' : '#FF453A', letterSpacing: '0.05em' }}>
              {isOnline ? 'ATIVO' : 'PAUSADO'}
            </span>
          </div>
          <button
            onClick={toggleDisabled}
            style={{ padding: '6px 14px', borderRadius: 980, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', background: isOnline ? 'rgba(255,69,58,0.15)' : 'rgba(48,209,88,0.15)', border: isOnline ? '1px solid rgba(255,69,58,0.3)' : '1px solid rgba(48,209,88,0.3)', color: isOnline ? '#FF453A' : '#30D158', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            {isOnline ? <><Pause size={11} strokeWidth={1.5} /> Pausar</> : <><Play size={11} strokeWidth={1.5} /> Ativar</>}
          </button>
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
            <div className="flex-1 overflow-y-auto" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 1 }}>
              {logLines.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: 11, fontFamily: "'SF Mono', monospace" }}>Sem atividade ainda</p>
              ) : (
                logLines.slice().reverse().map((line, i) => (
                  <div key={i} style={{ fontSize: 10.5, fontFamily: "'SF Mono', 'Fira Code', monospace", lineHeight: 1.6, color: classifyLog(line), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
