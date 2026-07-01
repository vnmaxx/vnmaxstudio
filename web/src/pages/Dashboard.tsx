import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { pushNotification } from '../components/NotificationBell'
import { useContextMenu, type CtxItem } from '../components/ContextMenu'
import { useAuth } from '../contexts/AuthContext'
import type { Agent, SystemStatus, Stats } from '../types'
import CEO from './CEO'
import {
  Terminal, Globe, Pencil, BookOpen,
  Play, Loader2, X, Check, Save,
  Users, FileText, Megaphone, Mail, Package,
  AlertCircle, Activity, TrendingUp, Clock, Copy, CopyPlus,
  LayoutDashboard, Briefcase,
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
  'studio-sdr':      '/mascots/3.png',
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
  if (line.includes('ERRO') || line.includes('error')) return 'var(--accent-red)'
  if (line.includes('AVISO') || line.includes('WARN'))  return 'var(--accent-yellow)'
  if (line.includes('=== CICLO') || line.includes('CICLO ')) return 'var(--accent)'
  if (line.includes('done') || line.includes('OK') || line.includes('sucesso')) return 'var(--accent-green)'
  return 'rgba(255,255,255,0.7)'
}

function ModelBadge({ model }: { model: string }) {
  const c = MODEL_COLORS[model] || { bg: 'var(--surface-3)', color: 'var(--text-secondary)', border: 'var(--border)' }
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="row--between" style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div className="row" style={{ gap: 12 }}>
            <AgentMascot name={name} size={40} />
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 2px', textTransform: 'capitalize' }}>{name.replace('studio-', '')}</h2>
              <ModelBadge model={viewAgent.model} />
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {editing ? (
              <button onClick={cancelEdit} className="btn btn--sm btn--ghost">Cancelar</button>
            ) : (
              <button onClick={startEdit} className="btn btn--sm btn--accent-soft">
                <Pencil size={11} strokeWidth={2} /> Editar
              </button>
            )}
            <button onClick={onClose} className="btn-icon btn-icon--sm" style={{ borderRadius: '50%' }}>
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {editing ? (
            <>
              <div className="grid grid--2" style={{ gap: 12 }}>
                <div>
                  <label className="label">Modelo</label>
                  <select className="select" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value as Agent['model'] }))}>
                    <option value="opus">opus</option>
                    <option value="sonnet">sonnet</option>
                    <option value="haiku">haiku</option>
                  </select>
                </div>
                <div>
                  <label className="label">Max Turns</label>
                  <input className="input" type="number" min={1} max={200} value={form.maxTurns} onChange={e => setForm(f => ({ ...f, maxTurns: Number(e.target.value) }))} />
                </div>
              </div>

              <div>
                <label className="label">Capacidades</label>
                <div className="row wrap" style={{ gap: 8 }}>
                  {(['shell', 'web', 'edit', 'read'] as const).map(t => {
                    const on = !!(form.tools as Record<string, boolean>)[t]
                    return (
                      <button key={t} onClick={() => setForm(f => ({ ...f, tools: { ...f.tools, [t]: !on } }))}
                        className="chip" style={{ cursor: 'pointer', background: on ? 'var(--accent-soft)' : 'var(--surface)', borderColor: on ? 'var(--accent-line)' : 'var(--border)', color: on ? 'var(--accent-text)' : 'var(--text-tertiary)' }}>
                        <span style={{ display: 'flex' }}>{toolIcons[t]}</span>
                        {TOOL_META[t].label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="label">System Prompt</label>
                <textarea className="textarea" value={form.system} onChange={e => setForm(f => ({ ...f, system: e.target.value }))} style={{ minHeight: 220, fontSize: 12 }} />
              </div>

              {saveErr && <p style={{ color: 'var(--accent-red)', fontSize: 12, margin: 0 }}>{saveErr}</p>}

              <button onClick={handleSave} disabled={saving} className="btn btn--success btn--lg" style={{ justifyContent: 'center' }}>
                {saving ? <Loader2 size={14} strokeWidth={2} className="spin" /> : <Save size={14} strokeWidth={2} />}
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </>
          ) : (
            <>
              <div className="grid grid--3" style={{ gap: 10 }}>
                {[
                  { value: agent.maxTurns, label: 'Max Turns' },
                  { value: activeTools.length, label: 'Ferramentas' },
                  { value: agent.model, label: 'Modelo', cap: true },
                ].map((s, i) => (
                  <div key={i} className="card card--pad" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, textTransform: s.cap ? 'capitalize' : undefined }}>{s.value}</div>
                    <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div>
                <p className="label">Capacidades</p>
                <div className="row wrap" style={{ gap: 8 }}>
                  {(['shell', 'web', 'edit', 'read'] as const).map(t => {
                    const on = !!(viewTools as Record<string, boolean>)[t]
                    return (
                      <span key={t} className="chip" style={{ background: on ? 'var(--surface-3)' : 'var(--surface)', color: on ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                        <span style={{ opacity: on ? 1 : 0.3, display: 'flex' }}>{toolIcons[t]}</span>
                        <span>{TOOL_META[t].label}</span>
                        <span style={{ color: on ? 'var(--accent-green)' : 'var(--text-tertiary)', display: 'flex' }}>{on ? <Check size={10} strokeWidth={2} /> : <X size={10} strokeWidth={2} />}</span>
                      </span>
                    )
                  })}
                </div>
              </div>
              <div>
                <p className="label">System Prompt</p>
                <div className="mono" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
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

function AgentCard({ name, agent, onClick, onChanged }: { name: string; agent: Agent; onClick: () => void; onChanged: () => void }) {
  const tools = agent.tools || {}
  const menu = useContextMenu()
  return (
    <button
      onClick={onClick}
      className="card card--hover card--pad"
      {...menu.bind((): CtxItem[] => [
        { header: name.replace('studio-', '') },
        { label: 'Editar agente', icon: <Pencil size={15} strokeWidth={1.8} />, onClick },
        { label: 'Duplicar agente', icon: <CopyPlus size={15} strokeWidth={1.8} />, onClick: async () => {
          try { await api.updateAgent(`${name}-copia`, { ...agent }); menu.flash('Agente duplicado'); onChanged() }
          catch (e: unknown) { menu.flash(e instanceof Error ? e.message : 'Erro ao duplicar') }
        } },
        { separator: true },
        { label: 'Copiar nome', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(name, 'Nome copiado') },
        { label: 'Copiar system prompt', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(agent.system || '', 'Prompt copiado'), disabled: !agent.system },
      ])}
      style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
        <AgentMascot name={name} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row--between" style={{ marginBottom: 3 }}>
            <h3 className="truncate" style={{ fontWeight: 600, fontSize: 12.5, textTransform: 'capitalize', margin: 0 }}>{name.replace('studio-', '')}</h3>
            <ModelBadge model={agent.model} />
          </div>
          <p className="muted clamp-2" style={{ fontSize: 10.5, margin: 0, lineHeight: 1.5 }}>
            {agent.system?.slice(0, 70) || 'Sem descrição'}
          </p>
        </div>
      </div>
      <div className="row--between" style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        <div className="row" style={{ gap: 6 }}>
          {(['shell', 'web', 'edit', 'read'] as const).map(t => (
            <ToolIcon key={t} label={t} active={!!(tools as Record<string, boolean>)[t]} />
          ))}
        </div>
        <span className="dim" style={{ fontSize: 10 }}>{agent.maxTurns}t</span>
      </div>
    </button>
  )
}

const KPI_DEFS = [
  { key: 'leads',    label: 'Leads',      icon: <Users size={16} strokeWidth={1.5} />,      color: '#0A84FF', to: '/workspace?p=leads' },
  { key: 'conteudo', label: 'Conteúdos',  icon: <FileText size={16} strokeWidth={1.5} />,   color: '#30D158', to: '/workspace?p=conteudo' },
  { key: 'campanhas',label: 'Campanhas',  icon: <Megaphone size={16} strokeWidth={1.5} />,  color: '#FF9F0A', to: '/workspace?p=campanhas' },
  { key: 'emails',   label: 'Emails',     icon: <Mail size={16} strokeWidth={1.5} />,        color: '#BF5AF2', to: '/workspace?p=emails' },
  { key: 'produtos', label: 'Produtos',   icon: <Package size={16} strokeWidth={1.5} />,    color: '#FF453A', to: '/workspace?p=produtos' },
  { key: 'reports',  label: 'Relatórios', icon: <TrendingUp size={16} strokeWidth={1.5} />, color: '#64D2FF', to: '/relatorios' },
]

function PendenciasCard() {
  const [itens, setItens] = useState<import('../types').Pendencia[]>([])
  const menu = useContextMenu()
  const load = useCallback(() => { api.getPendencias().then(r => setItens(r.itens)).catch(() => {}) }, [])
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv) }, [load])

  const resolver = async (id: string) => {
    try { await api.resolvePendencia(id); setItens(prev => prev.filter(i => i.id !== id)); menu.toast('Marcado como resolvido') }
    catch { menu.toast('Erro', 'error') }
  }
  if (itens.length === 0) return null
  const cor = (p: string) => p === 'alta' ? 'var(--accent-red)' : p === 'media' ? 'var(--accent-yellow)' : 'var(--text-tertiary)'

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title row" style={{ gap: 8 }}><AlertCircle size={14} style={{ color: 'var(--accent-yellow)' }} /> Ajustes pendentes <span className="dim" style={{ fontWeight: 400 }}>({itens.length})</span></span>
      </div>
      <div className="panel-body" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {itens.slice(0, 12).map(p => (
          <div key={p.id} className="card card--pad row--between" style={{ gap: 10, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 7 }}>
                <span className="dot" style={{ background: cor(p.prioridade), width: 7, height: 7, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{p.titulo}</span>
              </div>
              {p.detalhe && <p className="dim" style={{ margin: '4px 0 0 14px', fontSize: 11.5, lineHeight: 1.45 }}>{p.detalhe}</p>}
            </div>
            <button className="btn btn--ghost btn--sm" onClick={() => resolver(p.id)} style={{ flexShrink: 0 }}><Check size={12} /> Resolver</button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [agents,        setAgents]        = useState<AgentsMap>({})
  const [status,        setStatus]        = useState<SystemStatus | null>(null)
  const [stats,         setStats]         = useState<Stats | null>(null)
  const [logLines,      setLogLines]      = useState<string[]>([])
  const [loading,       setLoading]       = useState(true)
  const [cycleLoading,  setCycleLoading]  = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<{ name: string; agent: Agent } | null>(null)
  const menu = useContextMenu()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [view, setView] = useState<'op' | 'ceo'>('op')

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => menu.toast(msg, type)

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
      <div className="center" style={{ flex: 1, minHeight: '50vh' }}>
        <Loader2 size={22} strokeWidth={1.5} className="spin" style={{ color: 'var(--text-tertiary)' }} />
      </div>
    )
  }

  const lastCycleLabel = stats?.lastCycle
    ? stats.lastCycle.replace(/^\[.*?\]\s*=== /, '').replace(' ===', '')
    : 'Nenhum ciclo ainda'

  return (
    <div className="page page--flush page--fit">
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

      <div className="page-head">
        <div>
          <h1 className="page-title">Visão Geral</h1>
          <p className="page-sub">
            {new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="page-head-actions">
          {user?.isAdmin && (
            <div className="row" style={{ gap: 4, padding: 3, background: 'var(--surface-2)', borderRadius: 999 }}>
              <button className={'btn btn--pill btn--sm' + (view === 'op' ? ' btn--accent-soft' : '')} onClick={() => setView('op')} style={{ border: 'none' }}>
                <LayoutDashboard size={13} /> Operação
              </button>
              <button className={'btn btn--pill btn--sm' + (view === 'ceo' ? ' btn--accent-soft' : '')} onClick={() => setView('ceo')} style={{ border: 'none' }}>
                <Briefcase size={13} /> Executivo
              </button>
            </div>
          )}
          {stats && stats.totalErrors > 0 && (
            <span className="chip" style={{ background: 'color-mix(in srgb, var(--accent-red) 12%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-red) 24%, transparent)', color: 'var(--accent-red)' }}>
              <AlertCircle size={12} strokeWidth={1.5} /> {stats.totalErrors} erros
            </span>
          )}
          <span className="chip hide-xs">
            <Clock size={11} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} /> {lastCycleLabel}
          </span>
          <span className="chip" style={{ color: isOnline ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
            <span className="dot" style={{ background: isOnline ? 'var(--accent-green)' : 'var(--accent-red)', boxShadow: `0 0 6px ${isOnline ? 'var(--accent-green)' : 'var(--accent-red)'}` }} />
            {isOnline ? 'ATIVO' : 'PAUSADO'}
          </span>
        </div>
      </div>

      {view === 'ceo' && user?.isAdmin ? <CEO embedded /> : <>
      <div className="grid grid--kpi">
        {KPI_DEFS.map(kpi => {
          const val = stats?.counts[kpi.key as keyof typeof stats.counts] ?? 0
          return (
            <Link
              key={kpi.key}
              to={kpi.to}
              className="card card--hover card--pad"
              {...menu.bind((): CtxItem[] => [
                { header: kpi.label },
                { label: 'Abrir', icon: kpi.icon, onClick: () => navigate(kpi.to) },
                { separator: true },
                { label: 'Copiar valor', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(String(val), 'Valor copiado') },
                { label: 'Atualizar', icon: <Activity size={15} strokeWidth={1.8} />, onClick: loadData },
              ])}
              style={{ display: 'flex', flexDirection: 'column', gap: 10, textDecoration: 'none', color: 'inherit' }}
            >
              <div className="row--between">
                <span className="dim" style={{ fontSize: 11, fontWeight: 500 }}>{kpi.label}</span>
                <span style={{ color: kpi.color, opacity: 0.75 }}>{kpi.icon}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{val}</div>
            </Link>
          )
        })}
      </div>

      <PendenciasCard />

      <div className="split">
        <div className="panel" style={{ minHeight: 0 }}>
          <div className="panel-head">
            <span className="panel-title">Agentes <span className="dim" style={{ fontWeight: 400 }}>({agentEntries.length})</span></span>
            <Activity size={13} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <div className="panel-body" style={{ padding: 12 }}>
            <div className="grid grid--cards">
              {agentEntries.map(([name, agent]) => (
                <AgentCard key={name} name={name} agent={agent} onClick={() => setSelectedAgent({ name, agent })} onChanged={loadData} />
              ))}
            </div>
          </div>
        </div>

        <div className="col" style={{ gap: 12, minHeight: 0 }}>
          <div className="panel" style={{ flex: 1, minHeight: 0 }}>
            <div className="panel-head">
              <span className="panel-title">Atividade recente</span>
              <span className="dot dot--live" />
            </div>
            <div className="panel-body" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {logLines.length === 0 ? (
                <p className="dim mono" style={{ fontSize: 12 }}>Sem atividade ainda</p>
              ) : (
                logLines.slice().reverse().map((line, i) => (
                  <div
                    key={i}
                    className="mono"
                    {...menu.bind((): CtxItem[] => [
                      { label: 'Copiar linha', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(line, 'Linha copiada') },
                      { label: 'Copiar tudo', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(logLines.join('\n'), 'Logs copiados') },
                      { separator: true },
                      { label: 'Ver todos os logs', icon: <Activity size={15} strokeWidth={1.8} />, onClick: () => navigate('/logs') },
                    ])}
                    style={{ fontSize: 12, lineHeight: 1.7, color: classifyLog(line), wordBreak: 'break-word', padding: '1px 0' }}
                  >
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card card--pad" style={{ flexShrink: 0 }}>
            <p className="label">Ciclos manuais</p>
            <div className="col" style={{ gap: 7 }}>
              {(['segunda', 'diario', 'sexta'] as const).map(cycle => {
                const labels: Record<string, string> = { segunda: 'Segunda — Plano + Leads', diario: 'Diário — Tráfego + Clientes', sexta: 'Sexta — Dados + Relatório' }
                return (
                  <button key={cycle} onClick={() => runCycle(cycle)} disabled={cycleLoading !== null}
                    className="btn btn--ghost" style={{ justifyContent: 'flex-start', background: 'var(--surface-2)', border: '1px solid var(--border)', opacity: cycleLoading !== null && cycleLoading !== cycle ? 0.4 : 1 }}>
                    {cycleLoading === cycle
                      ? <Loader2 size={12} strokeWidth={2} className="spin" style={{ flexShrink: 0 }} />
                      : <Play size={12} strokeWidth={1.5} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                    {labels[cycle]}
                  </button>
                )
              })}
              <Link to="/aprovacoes" className="btn" style={{ justifyContent: 'flex-start', textDecoration: 'none', background: (stats?.counts.pendentes ?? 0) > 0 ? 'color-mix(in srgb, var(--accent-yellow) 10%, transparent)' : 'var(--surface-2)', borderColor: (stats?.counts.pendentes ?? 0) > 0 ? 'color-mix(in srgb, var(--accent-yellow) 24%, transparent)' : 'var(--border)', color: (stats?.counts.pendentes ?? 0) > 0 ? 'var(--accent-yellow)' : 'var(--text-secondary)' }}>
                <AlertCircle size={12} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                Aprovações pendentes
                {(stats?.counts.pendentes ?? 0) > 0 && (
                  <span style={{ background: 'var(--accent-red)', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, marginLeft: 'auto' }}>
                    {stats!.counts.pendentes}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </div>
      </>}
    </div>
  )
}
