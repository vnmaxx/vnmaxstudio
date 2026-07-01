import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { PipelineRecord, PipelineMetrics, Stats, AprovacaoResumo, PipelineState } from '../types'
import { useContextMenu, type CtxItem } from '../components/ContextMenu'
import {
  Users, AlertCircle, CheckCircle, Play, RefreshCw, Target,
  Activity, Clock, Zap, TrendingUp, Check, X, Loader2, ChevronRight, Copy, Eye,
} from 'lucide-react'

const STATE_COLOR: Record<PipelineState, string> = {
  WAITING: 'var(--text-tertiary)', RUNNING: 'var(--accent)', RETRY: 'var(--accent-orange)',
  FAILED: 'var(--accent-red)', PAUSED: 'var(--accent-orange)', COMPLETED: 'var(--accent-green)', CANCELLED: 'var(--text-faint)',
}

function fmtMs(ms?: number | null) {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function Metric({ icon, color, label, value, sub }: { icon: React.ReactNode; color: string; label: string; value: string | number; sub?: React.ReactNode }) {
  return (
    <div className="card card--pad">
      <div className="row" style={{ gap: 10, marginBottom: 12 }}>
        <div className="center" style={{ width: 40, height: 40, borderRadius: 10, background: `color-mix(in srgb, ${color} 14%, transparent)`, color, flexShrink: 0 }}>{icon}</div>
        <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

export default function CEO({ embedded }: { embedded?: boolean } = {}) {
  const [loading, setLoading] = useState(true)
  const [pipelines, setPipelines] = useState<{ running: PipelineRecord[]; history: PipelineRecord[] }>({ running: [], history: [] })
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [pendentes, setPendentes] = useState<AprovacaoResumo[]>([])
  const [cycleLoading, setCycleLoading] = useState(false)
  const [acting, setActing] = useState<string | null>(null)
  const menu = useContextMenu()
  const navigate = useNavigate()

  const carregar = useCallback(async () => {
    try {
      const [pipes, mets, st, pend] = await Promise.all([
        api.getPipelines().catch(() => ({ running: [], history: [] })),
        api.getPipelineMetrics().catch(() => null),
        api.getStats().catch(() => null),
        api.getPendentes().catch(() => []),
      ])
      setPipelines(pipes)
      setMetrics(mets)
      setStats(st)
      setPendentes(pend)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
    const iv = setInterval(carregar, 6000)
    return () => clearInterval(iv)
  }, [carregar])

  const executarPipeline = async () => {
    setCycleLoading(true)
    try {
      await api.runCycle('segunda')
      setTimeout(carregar, 2500)
    } finally {
      setTimeout(() => setCycleLoading(false), 2500)
    }
  }

  const aprovar = async (id: string) => {
    setActing(id)
    try { await api.aprovar(id); setPendentes(p => p.filter(x => x.id !== id)) }
    finally { setActing(null) }
  }

  const rejeitar = async (id: string) => {
    setActing(id)
    try { await api.rejeitar(id, 'Rejeitado pelo CEO'); setPendentes(p => p.filter(x => x.id !== id)) }
    finally { setActing(null) }
  }

  const activePipes = pipelines.running
  const recentPipes = [...pipelines.running, ...pipelines.history].slice(0, 12)

  if (loading) {
    return (
      <div className={embedded ? 'page-embed center' : 'page center'} style={{ flex: 1, minHeight: '60vh' }}>
        <div className="col center" style={{ gap: 14 }}>
          <RefreshCw size={30} className="spin" style={{ color: 'var(--accent)' }} />
          <span className="muted" style={{ fontSize: 14 }}>Carregando dashboard CEO…</span>
        </div>
      </div>
    )
  }

  return (
    <div className={embedded ? 'page-embed' : 'page'}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard CEO</h1>
          <p className="page-sub">Visão estratégica do Studio IA</p>
        </div>
        <div className="page-head-actions">
          <button onClick={carregar} className="btn btn--ghost">
            <RefreshCw size={14} /> Atualizar
          </button>
          <button onClick={executarPipeline} disabled={cycleLoading} className="btn btn--success">
            {cycleLoading ? <><RefreshCw size={14} className="spin" /> Executando…</> : <><Play size={14} /> Executar Pipeline</>}
          </button>
        </div>
      </div>

      <div className="grid grid--kpi">
        <Metric icon={<Users size={20} />} color="#0A84FF" label="Leads" value={stats?.counts.leads ?? 0}
          sub={<span style={{ color: 'var(--text-tertiary)' }}>na base</span>} />
        <Metric icon={<Zap size={20} />} color="#30D158" label="Pipelines OK" value={metrics?.completed ?? 0}
          sub={<span style={{ color: 'var(--accent-green)' }}>{metrics?.successRate ?? 0}% sucesso</span>} />
        <Metric icon={<TrendingUp size={20} />} color="#FF9F0A" label="Tempo médio" value={fmtMs(metrics?.avgDurationMs)}
          sub={<span style={{ color: 'var(--text-tertiary)' }}>{metrics?.total ?? 0} execuções</span>} />
        <Metric icon={<AlertCircle size={20} />} color={pendentes.length > 0 ? '#FF453A' : '#64D2FF'} label="Pendências"
          value={pendentes.length} sub={<span style={{ color: 'var(--text-tertiary)' }}>aprovações</span>} />
      </div>

      <div className="split">
        <div className="panel">
          <div className="panel-head">
            <span className="row" style={{ gap: 9 }}><Activity size={17} style={{ color: 'var(--accent)' }} /><span className="panel-title">Pipelines</span></span>
            <span className="dim" style={{ fontSize: 12 }}>{activePipes.length} ativo(s)</span>
          </div>
          <div className="panel-body">
            {recentPipes.length === 0 ? (
              <div className="empty">
                <Target size={32} />
                <p style={{ margin: 0, fontSize: 13 }}>Nenhum pipeline executado ainda</p>
                <p className="dim" style={{ margin: 0, fontSize: 11.5 }}>Clique em “Executar Pipeline” para iniciar o fluxo da semana</p>
              </div>
            ) : (
              recentPipes.map((p, i) => {
                const done = p.steps.filter(s => s.state === 'COMPLETED').length
                return (
                  <Link key={p.id} to="/pipelines" style={{ textDecoration: 'none' }}>
                    <div
                      className="row"
                      style={{ gap: 14, padding: '13px 16px', borderBottom: i < recentPipes.length - 1 ? '1px solid var(--border)' : 'none' }}
                      {...menu.bind((): CtxItem[] => [
                        { header: p.name },
                        { label: 'Ver no painel', icon: <Eye size={15} strokeWidth={1.8} />, onClick: () => navigate('/pipelines') },
                        { separator: true },
                        { label: 'Copiar ID', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(p.id, 'ID copiado') },
                        { label: 'Copiar nome', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(p.name, 'Nome copiado') },
                      ])}
                    >
                      <span className="dot" style={{ background: STATE_COLOR[p.state], boxShadow: p.state === 'RUNNING' ? '0 0 7px var(--accent)' : 'none' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="row" style={{ gap: 8 }}>
                          <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</span>
                          <span className="badge" style={{ background: `color-mix(in srgb, ${STATE_COLOR[p.state]} 16%, transparent)`, color: STATE_COLOR[p.state] }}>{p.state}</span>
                        </div>
                        <span className="dim" style={{ fontSize: 11 }}>{done}/{p.steps.length} etapas · {fmtMs(p.metrics?.totalDurationMs)}</span>
                      </div>
                      <ChevronRight size={14} style={{ color: 'var(--text-faint)' }} />
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="row" style={{ gap: 9 }}><AlertCircle size={17} style={{ color: pendentes.length > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }} /><span className="panel-title">Ações Necessárias</span></span>
            {pendentes.length > 0 && <span className="badge" style={{ background: 'color-mix(in srgb, var(--accent-red) 16%, transparent)', color: 'var(--accent-red)' }}>{pendentes.length}</span>}
          </div>
          <div className="panel-body" style={{ padding: 14 }}>
            {pendentes.length === 0 ? (
              <div className="empty">
                <CheckCircle size={32} style={{ color: 'var(--accent-green)', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: 13 }}>Tudo aprovado</p>
                <p className="dim" style={{ margin: 0, fontSize: 11.5 }}>Nenhuma ação pendente</p>
              </div>
            ) : (
              <div className="col" style={{ gap: 10 }}>
                {pendentes.slice(0, 8).map(item => (
                  <div
                    key={item.id}
                    className="card card--pad"
                    style={{ background: 'color-mix(in srgb, var(--accent-red) 6%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-red) 16%, transparent)' }}
                    {...menu.bind((): CtxItem[] => [
                      { header: item.resumo },
                      { label: 'Aprovar', icon: <Check size={15} strokeWidth={2} />, onClick: () => aprovar(item.id), disabled: acting === item.id },
                      { label: 'Rejeitar', icon: <X size={15} strokeWidth={2} />, danger: true, onClick: () => rejeitar(item.id), disabled: acting === item.id },
                      { separator: true },
                      { label: 'Ver em Aprovações', icon: <Eye size={15} strokeWidth={1.8} />, onClick: () => navigate('/aprovacoes') },
                      { label: 'Copiar ID', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(item.id, 'ID copiado') },
                    ])}
                  >
                    <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                      <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>{item.tipo}</span>
                      <span className="dim mono truncate" style={{ fontSize: 11 }}>{item.id}</span>
                    </div>
                    <p className="muted" style={{ fontSize: 12.5, margin: '0 0 10px', lineHeight: 1.5 }}>{item.resumo}</p>
                    <div className="row" style={{ gap: 8 }}>
                      <button onClick={() => aprovar(item.id)} disabled={acting === item.id} className="btn btn--sm btn--success" style={{ flex: 1, justifyContent: 'center' }}>
                        {acting === item.id ? <Loader2 size={12} className="spin" /> : <Check size={12} />} Aprovar
                      </button>
                      <button onClick={() => rejeitar(item.id)} disabled={acting === item.id} className="btn btn--sm btn--danger" style={{ flex: 1, justifyContent: 'center' }}>
                        <X size={12} /> Rejeitar
                      </button>
                    </div>
                  </div>
                ))}
                <Link to="/aprovacoes" className="btn btn--ghost btn--sm" style={{ justifyContent: 'center' }}>Ver todas <ChevronRight size={13} /></Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="row" style={{ gap: 9 }}><Clock size={17} style={{ color: 'var(--accent)' }} /><span className="panel-title">Atividade recente</span></span>
        </div>
        <div className="panel-body" style={{ padding: '6px 16px' }}>
          {pipelines.history.length === 0 ? (
            <div className="empty" style={{ padding: 28 }}><p className="dim" style={{ margin: 0, fontSize: 13 }}>Nenhum evento registrado ainda</p></div>
          ) : (
            pipelines.history.slice(0, 10).map((p, i, arr) => (
              <div
                key={p.id}
                className="row"
                style={{ gap: 14, padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}
                {...menu.bind((): CtxItem[] => [
                  { header: p.name },
                  { label: 'Ver no painel', icon: <Eye size={15} strokeWidth={1.8} />, onClick: () => navigate('/pipelines') },
                  { label: 'Copiar ID', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(p.id, 'ID copiado') },
                ])}
              >
                <span className="dot" style={{ background: STATE_COLOR[p.state] }} />
                <span className="truncate" style={{ fontSize: 12.5, fontWeight: 500, minWidth: 0, flex: 1 }}>{p.name}</span>
                <span className="badge hide-xs" style={{ color: STATE_COLOR[p.state] }}>{p.state}</span>
                <span className="dim" style={{ fontSize: 11, flexShrink: 0 }}>
                  {p.completedAt ? new Date(p.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
