import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import type { PipelineRecord, PipelineStep, PipelineMetrics, PipelineState } from '../types'
import { Activity, CheckCircle, XCircle, Clock, RefreshCw, AlertCircle, ChevronDown, ChevronRight, Zap } from 'lucide-react'

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
  WAITING: 'rgba(255,255,255,0.3)',
  RUNNING: '#0A84FF',
  RETRY: '#FF9F0A',
  FAILED: '#FF453A',
  PAUSED: '#FF9F0A',
  COMPLETED: '#30D158',
  CANCELLED: 'rgba(255,255,255,0.2)',
}

const STATE_BG: Record<PipelineState, string> = {
  WAITING: 'rgba(255,255,255,0.05)',
  RUNNING: 'rgba(10,132,255,0.12)',
  RETRY: 'rgba(255,159,10,0.12)',
  FAILED: 'rgba(255,69,58,0.12)',
  PAUSED: 'rgba(255,159,10,0.08)',
  COMPLETED: 'rgba(48,209,88,0.10)',
  CANCELLED: 'rgba(255,255,255,0.04)',
}

function StateIcon({ state, size = 14 }: { state: PipelineState; size?: number }) {
  const color = STATE_COLORS[state]
  if (state === 'COMPLETED') return <CheckCircle size={size} color={color} strokeWidth={2} />
  if (state === 'FAILED') return <XCircle size={size} color={color} strokeWidth={2} />
  if (state === 'RUNNING') return <div style={{ width: size, height: size, borderRadius: '50%', border: `2px solid rgba(10,132,255,0.3)`, borderTopColor: '#0A84FF', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
  if (state === 'RETRY') return <RefreshCw size={size} color={color} strokeWidth={2} />
  if (state === 'WAITING') return <Clock size={size} color={color} strokeWidth={2} />
  if (state === 'CANCELLED') return <AlertCircle size={size} color={color} strokeWidth={2} />
  return <Clock size={size} color={color} strokeWidth={2} />
}

function StateBadge({ state }: { state: PipelineState }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em', padding: '2px 7px', borderRadius: 5, background: STATE_BG[state], color: STATE_COLORS[state], border: `1px solid ${STATE_COLORS[state]}33`, textTransform: 'uppercase' }}>
      {state}
    </span>
  )
}

function StepRow({ step, isRunning }: { step: PipelineStep; isRunning: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', background: step.state === 'RUNNING' ? 'rgba(10,132,255,0.06)' : 'transparent', borderRadius: 6 }}>
      <StateIcon state={step.state} size={13} />
      <span style={{ flex: 1, fontSize: 12.5, color: step.state === 'COMPLETED' ? 'rgba(255,255,255,0.75)' : step.state === 'FAILED' ? '#FF453A' : step.state === 'RUNNING' ? 'var(--text-primary)' : 'rgba(255,255,255,0.35)' }}>
        {step.name}
      </span>
      {step.attempt > 1 && (
        <span style={{ fontSize: 10, color: '#FF9F0A', background: 'rgba(255,159,10,0.12)', padding: '1px 5px', borderRadius: 4 }}>
          tentativa {step.attempt}
        </span>
      )}
      {step.state === 'RUNNING' && isRunning && (
        <span style={{ fontSize: 11, color: '#0A84FF' }}>{elapsed(step.startedAt)}</span>
      )}
      {step.durationMs != null && step.state !== 'RUNNING' && (
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{fmtMs(step.durationMs)}</span>
      )}
      {step.error && (
        <span style={{ fontSize: 10.5, color: '#FF453A', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={step.error}>
          {step.error.slice(0, 60)}
        </span>
      )}
    </div>
  )
}

function PipelineCard({ record, defaultOpen = false }: { record: PipelineRecord; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [showLogs, setShowLogs] = useState(false)
  const isActive = record.state === 'RUNNING' || record.state === 'RETRY' || record.state === 'WAITING'

  const doneSteps = record.steps.filter(s => s.state === 'COMPLETED').length
  const progress = record.steps.length > 0 ? doneSteps / record.steps.length : 0

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${isActive ? 'rgba(10,132,255,0.25)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: isActive ? 'rgba(10,132,255,0.04)' : 'transparent' }}
      >
        <StateIcon state={record.state} size={16} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{record.name}</span>
            <StateBadge state={record.state} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
              {doneSteps}/{record.steps.length} etapas
            </span>
            {record.startedAt && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                {isActive ? `${elapsed(record.startedAt)} rodando` : timeAgo(record.startedAt)}
              </span>
            )}
            {record.metrics.totalDurationMs > 0 && !isActive && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                {fmtMs(record.metrics.totalDurationMs)} total
              </span>
            )}
            {record.metrics.retries > 0 && (
              <span style={{ fontSize: 11, color: '#FF9F0A' }}>{record.metrics.retries} retries</span>
            )}
          </div>
        </div>
        {isActive && record.steps.length > 0 && (
          <div style={{ width: 80 }}>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 3, height: 4, overflow: 'hidden' }}>
              <div style={{ width: `${progress * 100}%`, height: '100%', background: '#0A84FF', borderRadius: 3, transition: 'width 0.5s ease' }} />
            </div>
          </div>
        )}
        {open ? <ChevronDown size={14} color="rgba(255,255,255,0.3)" /> : <ChevronRight size={14} color="rgba(255,255,255,0.3)" />}
      </div>

      {open && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '10px 8px' }}>
          {record.steps.map((step, i) => (
            <StepRow key={i} step={step} isRunning={isActive} />
          ))}
          {record.logs.length > 0 && (
            <div style={{ marginTop: 8, padding: '0 4px' }}>
              <button
                onClick={e => { e.stopPropagation(); setShowLogs(l => !l) }}
                style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
              >
                {showLogs ? '▲ ocultar logs' : `▼ ver ${record.logs.length} logs`}
              </button>
              {showLogs && (
                <pre style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', margin: '6px 0 0', maxHeight: 200, overflowY: 'auto', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{sub}</div>}
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

  const tabStyle = (active: boolean) => ({
    padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
    background: active ? 'rgba(10,132,255,0.18)' : 'transparent',
    color: active ? '#0A84FF' : 'rgba(255,255,255,0.45)',
  })

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Zap size={20} color="#0A84FF" strokeWidth={2} />
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Pipelines</h1>
        {data.running.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 600, color: '#0A84FF', background: 'rgba(10,132,255,0.15)', border: '1px solid rgba(10,132,255,0.3)', padding: '2px 8px', borderRadius: 6 }}>
            {data.running.length} ativo{data.running.length > 1 ? 's' : ''}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          <MetricCard label="Total" value={metrics.total} />
          <MetricCard label="Concluídos" value={metrics.completed} color="#30D158" sub={`${metrics.successRate}% taxa`} />
          <MetricCard label="Falhas" value={metrics.failed} color={metrics.failed > 0 ? '#FF453A' : undefined} />
          <MetricCard label="Tempo médio" value={fmtMs(metrics.avgDurationMs)} />
          <MetricCard label="Retries" value={metrics.totalRetries} color={metrics.totalRetries > 0 ? '#FF9F0A' : undefined} />
          <MetricCard label="Últimas 24h" value={metrics.last24h} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 4 }}>
        <button style={tabStyle(tab === 'ativos')} onClick={() => setTab('ativos')}>
          <Activity size={13} style={{ marginRight: 5, verticalAlign: 'text-bottom' }} />
          Ativos {data.running.length > 0 && `(${data.running.length})`}
        </button>
        <button style={tabStyle(tab === 'historico')} onClick={() => setTab('historico')}>
          <Clock size={13} style={{ marginRight: 5, verticalAlign: 'text-bottom' }} />
          Histórico {data.history.length > 0 && `(${data.history.length})`}
        </button>
        {metrics && Object.keys(metrics.stepStats).length > 0 && (
          <button style={tabStyle(tab === 'metricas')} onClick={() => setTab('metricas')}>
            Por Etapa
          </button>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          Carregando...
        </div>
      )}

      {!loading && tab === 'ativos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.running.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
              <Activity size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div>Nenhum pipeline ativo no momento.</div>
              <div style={{ marginTop: 6, fontSize: 12 }}>O próximo ciclo será iniciado automaticamente pelo scheduler.</div>
            </div>
          ) : (
            data.running.map(p => <PipelineCard key={`${p.id}-${now}`} record={p} defaultOpen={true} />)
          )}
        </div>
      )}

      {!loading && tab === 'historico' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Sem histórico ainda.</div>
          ) : (
            data.history.map(p => <PipelineCard key={p.id} record={p} defaultOpen={false} />)
          )}
        </div>
      )}

      {!loading && tab === 'metricas' && metrics && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(metrics.stepStats).map(([name, s]) => (
            <div key={name} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{name}</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{s.total} execuções</span>
                  <span style={{ fontSize: 11, color: '#30D158' }}>{s.completed} ok</span>
                  {s.failed > 0 && <span style={{ fontSize: 11, color: '#FF453A' }}>{s.failed} falhas</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {s.completed > 0 ? fmtMs(Math.round(s.totalMs / s.completed)) : '—'}
                </div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)' }}>tempo médio</div>
              </div>
              <div style={{ width: 60, textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: s.failed === 0 ? '#30D158' : '#FF9F0A' }}>
                  {s.total > 0 ? Math.round(s.completed / s.total * 100) : 0}%
                </div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)' }}>sucesso</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
