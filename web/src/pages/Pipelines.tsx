import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import type { PipelineRecord, PipelineStep, PipelineMetrics, PipelineState } from '../types'
import { Activity, CheckCircle, XCircle, Clock, RefreshCw, AlertCircle, ChevronDown, ChevronRight, Zap, BarChart3, Eye, Copy, Download } from 'lucide-react'
import { useContextMenu, type CtxItem } from '../components/ContextMenu'
import { downloadText } from '../lib/files'

function fmtMs(ms: number | null | undefined) {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}m ${s}s`
}

function timeAgo(iso: string | null) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return `${Math.floor(diff / 1000)}s atrás`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m atrás`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`
  return `${Math.floor(diff / 86400000)}d atrás`
}

function elapsed(startedAt: string | null) {
  if (!startedAt) return ''
  return fmtMs(Date.now() - new Date(startedAt).getTime())
}

const STATE_COLORS: Record<PipelineState, string> = {
  WAITING: 'var(--text-tertiary)',
  RUNNING: 'var(--accent)',
  RETRY: 'var(--accent-orange)',
  FAILED: 'var(--accent-red)',
  PAUSED: 'var(--accent-orange)',
  COMPLETED: 'var(--accent-green)',
  CANCELLED: 'var(--text-faint)',
}

const STATE_BG: Record<PipelineState, string> = {
  WAITING: 'rgba(255,255,255,0.05)',
  RUNNING: 'color-mix(in srgb, var(--accent) 14%, transparent)',
  RETRY: 'color-mix(in srgb, var(--accent-orange) 14%, transparent)',
  FAILED: 'color-mix(in srgb, var(--accent-red) 14%, transparent)',
  PAUSED: 'color-mix(in srgb, var(--accent-orange) 10%, transparent)',
  COMPLETED: 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
  CANCELLED: 'rgba(255,255,255,0.04)',
}

function StateIcon({ state, size = 14 }: { state: PipelineState; size?: number }) {
  const color = STATE_COLORS[state]
  if (state === 'COMPLETED') return <CheckCircle size={size} color={color} strokeWidth={2} />
  if (state === 'FAILED') return <XCircle size={size} color={color} strokeWidth={2} />
  if (state === 'RUNNING') return <div className="spin" style={{ width: size, height: size, borderRadius: '50%', border: '2px solid color-mix(in srgb, var(--accent) 28%, transparent)', borderTopColor: 'var(--accent)', flexShrink: 0 }} />
  if (state === 'RETRY') return <RefreshCw size={size} color={color} strokeWidth={2} />
  if (state === 'WAITING') return <Clock size={size} color={color} strokeWidth={2} />
  if (state === 'CANCELLED') return <AlertCircle size={size} color={color} strokeWidth={2} />
  return <Clock size={size} color={color} strokeWidth={2} />
}

function StateBadge({ state }: { state: PipelineState }) {
  return (
    <span className="badge" style={{ background: STATE_BG[state], color: STATE_COLORS[state], border: `1px solid color-mix(in srgb, ${STATE_COLORS[state]} 28%, transparent)`, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {state}
    </span>
  )
}

function StepRow({ step, isRunning }: { step: PipelineStep; isRunning: boolean }) {
  return (
    <div className="row" style={{ gap: 10, padding: '7px 12px', background: step.state === 'RUNNING' ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'transparent', borderRadius: 'var(--radius-sm)' }}>
      <StateIcon state={step.state} size={13} />
      <span className="truncate" style={{ flex: 1, fontSize: 12.5, color: step.state === 'COMPLETED' ? 'var(--text-secondary)' : step.state === 'FAILED' ? 'var(--accent-red)' : step.state === 'RUNNING' ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
        {step.name}
      </span>
      {step.attempt > 1 && (
        <span className="badge hide-xs" style={{ background: STATE_BG.RETRY, color: 'var(--accent-orange)' }}>
          tentativa {step.attempt}
        </span>
      )}
      {step.state === 'RUNNING' && isRunning && (
        <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{elapsed(step.startedAt)}</span>
      )}
      {step.durationMs != null && step.state !== 'RUNNING' && (
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmtMs(step.durationMs)}</span>
      )}
      {step.error && (
        <span className="truncate hide-xs" style={{ fontSize: 10.5, color: 'var(--accent-red)', maxWidth: 200 }} title={step.error}>
          {step.error.slice(0, 60)}
        </span>
      )}
    </div>
  )
}

function PipelineCard({ record, defaultOpen = false }: { record: PipelineRecord; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [showLogs, setShowLogs] = useState(false)
  const menu = useContextMenu()
  const isActive = record.state === 'RUNNING' || record.state === 'RETRY' || record.state === 'WAITING'

  const doneSteps = record.steps.filter(s => s.state === 'COMPLETED').length
  const progress = record.steps.length > 0 ? doneSteps / record.steps.length : 0

  const menuItems = (): CtxItem[] => {
    const items: CtxItem[] = [
      { header: record.name },
      { label: open ? 'Ocultar detalhes' : 'Ver detalhes', icon: <Eye size={15} strokeWidth={1.8} />, onClick: () => setOpen(o => !o) },
    ]
    if (record.logs.length > 0) items.push({ label: 'Ver logs', icon: <Activity size={15} strokeWidth={1.8} />, onClick: () => { setOpen(true); setShowLogs(true) } })
    items.push({ separator: true })
    items.push({ label: 'Copiar ID', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(record.id, 'ID copiado') })
    items.push({ label: 'Copiar nome', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(record.name, 'Nome copiado') })
    if (record.logs.length > 0) {
      items.push({ label: 'Copiar logs', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(record.logs.join('\n'), 'Logs copiados') })
      items.push({ label: 'Baixar logs', icon: <Download size={15} strokeWidth={1.8} />, onClick: () => downloadText(`pipeline-${record.id}.log`, record.logs.join('\n')) })
    }
    items.push({ label: 'Copiar JSON', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(JSON.stringify(record, null, 2), 'JSON copiado') })
    if (['segunda', 'diario', 'sexta'].includes(record.cycle)) {
      items.push({ separator: true })
      items.push({
        label: 'Reexecutar ciclo', icon: <RefreshCw size={15} strokeWidth={1.8} />,
        onClick: async () => {
          try { await api.runCycle(record.cycle as 'segunda' | 'diario' | 'sexta'); menu.flash('Ciclo reiniciado') }
          catch { menu.flash('Erro ao reexecutar') }
        },
      })
    }
    return items
  }

  return (
    <div className="card" style={{ borderColor: isActive ? 'var(--accent-line)' : 'var(--border)', overflow: 'hidden' }} {...menu.bind(menuItems)}>
      <div
        onClick={() => setOpen(o => !o)}
        className="row"
        style={{ gap: 12, padding: 'clamp(11px, 1.6vw, 14px) clamp(13px, 2vw, 16px)', cursor: 'pointer', background: isActive ? 'color-mix(in srgb, var(--accent) 5%, transparent)' : 'transparent' }}
      >
        <StateIcon state={record.state} size={16} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="truncate" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{record.name}</span>
            <StateBadge state={record.state} />
          </div>
          <div className="row wrap" style={{ gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {doneSteps}/{record.steps.length} etapas
            </span>
            {record.startedAt && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {isActive ? `${elapsed(record.startedAt)} rodando` : timeAgo(record.startedAt)}
              </span>
            )}
            {record.metrics.totalDurationMs > 0 && !isActive && (
              <span className="hide-xs" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {fmtMs(record.metrics.totalDurationMs)} total
              </span>
            )}
            {record.metrics.retries > 0 && (
              <span style={{ fontSize: 11, color: 'var(--accent-orange)' }}>{record.metrics.retries} retries</span>
            )}
          </div>
        </div>
        {isActive && record.steps.length > 0 && (
          <div className="hide-xs" style={{ width: 80 }}>
            <div style={{ background: 'var(--surface-3)', borderRadius: 3, height: 4, overflow: 'hidden' }}>
              <div style={{ width: `${progress * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 3, transition: 'width 0.5s ease' }} />
            </div>
          </div>
        )}
        {open ? <ChevronDown size={14} color="var(--text-tertiary)" /> : <ChevronRight size={14} color="var(--text-tertiary)" />}
      </div>

      {open && (
        <div className="anim-fade" style={{ borderTop: '1px solid var(--border)', padding: '10px 8px' }}>
          {record.steps.map((step, i) => (
            <StepRow key={i} step={step} isRunning={isActive} />
          ))}
          {record.logs.length > 0 && (
            <div style={{ marginTop: 8, padding: '0 4px' }}>
              <button
                onClick={e => { e.stopPropagation(); setShowLogs(l => !l) }}
                className="btn btn--ghost btn--sm"
                style={{ fontSize: 11, padding: '3px 8px' }}
              >
                {showLogs ? '▲ ocultar logs' : `▼ ver ${record.logs.length} logs`}
              </button>
              {showLogs && (
                <pre className="mono scroll" style={{ fontSize: 10.5, color: 'var(--text-secondary)', margin: '8px 0 0', maxHeight: 200, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                  {record.logs.slice(-50).join('\n')}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card card--pad">
      <div className="label" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

export default function Pipelines() {
  const [data, setData] = useState<{ running: PipelineRecord[]; history: PipelineRecord[] }>({ running: [], history: [] })
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'ativos' | 'historico' | 'metricas'>('ativos')
  const [now, setNow] = useState(Date.now())

  const load = useCallback(async () => {
    try {
      const [pipes, mets] = await Promise.all([api.getPipelines(), api.getPipelineMetrics()])
      setData(pipes)
      setMetrics(mets)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const hasActive = data.running.length > 0
    const interval = setInterval(load, hasActive ? 4000 : 15000)
    return () => clearInterval(interval)
  }, [load, data.running.length])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const tabBtn = (active: boolean) => ['btn', 'btn--sm', active ? 'btn--accent-soft' : 'btn--ghost'].join(' ')

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 10 }}>
            <Zap size={20} color="var(--accent)" strokeWidth={2} />
            <h1 className="page-title">Pipelines</h1>
            {data.running.length > 0 && (
              <span className="chip" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-line)', color: 'var(--accent-text)', fontWeight: 600 }}>
                <span className="dot dot--live" />
                {data.running.length} ativo{data.running.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="page-sub">Painel do Loop Engine — ciclos, etapas e métricas de execução.</p>
        </div>
        <div className="page-head-actions">
          <button onClick={load} className="btn btn--sm">
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>
      </div>

      {metrics && (
        <div className="grid grid--kpi">
          <MetricCard label="Total" value={metrics.total} />
          <MetricCard label="Concluídos" value={metrics.completed} color="var(--accent-green)" sub={`${metrics.successRate}% taxa`} />
          <MetricCard label="Falhas" value={metrics.failed} color={metrics.failed > 0 ? 'var(--accent-red)' : undefined} />
          <MetricCard label="Tempo médio" value={fmtMs(metrics.avgDurationMs)} />
          <MetricCard label="Retries" value={metrics.totalRetries} color={metrics.totalRetries > 0 ? 'var(--accent-orange)' : undefined} />
          <MetricCard label="Últimas 24h" value={metrics.last24h} />
        </div>
      )}

      <div className="row scroll" style={{ gap: 6, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 2, flexShrink: 0 }}>
        <button className={tabBtn(tab === 'ativos')} onClick={() => setTab('ativos')}>
          <Activity size={13} />
          Ativos {data.running.length > 0 && `(${data.running.length})`}
        </button>
        <button className={tabBtn(tab === 'historico')} onClick={() => setTab('historico')}>
          <Clock size={13} />
          Histórico {data.history.length > 0 && `(${data.history.length})`}
        </button>
        {metrics && Object.keys(metrics.stepStats).length > 0 && (
          <button className={tabBtn(tab === 'metricas')} onClick={() => setTab('metricas')}>
            <BarChart3 size={13} />
            Por Etapa
          </button>
        )}
      </div>

      {loading && (
        <div className="empty">
          <div className="spin" style={{ width: 26, height: 26, borderRadius: '50%', border: '2px solid var(--surface-3)', borderTopColor: 'var(--accent)' }} />
          <p>Carregando...</p>
        </div>
      )}

      {!loading && tab === 'ativos' && (
        <div className="col" style={{ gap: 10 }}>
          {data.running.length === 0 ? (
            <div className="empty">
              <Activity size={34} />
              <p>Nenhum pipeline ativo no momento.</p>
              <p className="dim" style={{ fontSize: 12, margin: 0 }}>O próximo ciclo será iniciado automaticamente pelo scheduler.</p>
            </div>
          ) : (
            data.running.map(p => <PipelineCard key={`${p.id}-${now}`} record={p} defaultOpen={true} />)
          )}
        </div>
      )}

      {!loading && tab === 'historico' && (
        <div className="col" style={{ gap: 8 }}>
          {data.history.length === 0 ? (
            <div className="empty">
              <Clock size={34} />
              <p>Sem histórico ainda.</p>
            </div>
          ) : (
            data.history.map(p => <PipelineCard key={p.id} record={p} defaultOpen={false} />)
          )}
        </div>
      )}

      {!loading && tab === 'metricas' && metrics && (
        <div className="col" style={{ gap: 8 }}>
          {Object.entries(metrics.stepStats).map(([name, s]) => (
            <div key={name} className="card card--pad row wrap" style={{ gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 5 }}>{name}</div>
                <div className="row wrap" style={{ gap: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.total} execuções</span>
                  <span style={{ fontSize: 11, color: 'var(--accent-green)' }}>{s.completed} ok</span>
                  {s.failed > 0 && <span style={{ fontSize: 11, color: 'var(--accent-red)' }}>{s.failed} falhas</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {s.completed > 0 ? fmtMs(Math.round(s.totalMs / s.completed)) : '—'}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>tempo médio</div>
              </div>
              <div style={{ width: 60, textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: s.failed === 0 ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
                  {s.total > 0 ? Math.round(s.completed / s.total * 100) : 0}%
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>sucesso</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
