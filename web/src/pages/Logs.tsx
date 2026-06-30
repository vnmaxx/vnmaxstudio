import { useEffect, useState, useRef, useCallback } from 'react'
import { api } from '../api'
import { RefreshCw, Terminal, AlertTriangle } from 'lucide-react'

function classifyLine(line: string): string {
  if (line.includes('ERROR') || line.includes('Erro') || line.includes('ERRO')) return 'var(--accent-red)'
  if (line.includes('AVISO') || line.includes('WARN') || line.includes('warn')) return 'var(--accent-yellow)'
  if (line.includes('=== CICLO') || line.includes('CICLO ') || line.startsWith('====')) return 'var(--accent)'
  if (line.includes('OK') || line.includes('sucesso')) return 'var(--accent-green)'
  return 'var(--text-tertiary)'
}

export default function Logs() {
  const [lines, setLines] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadLogs = useCallback(async () => {
    try {
      const data = await api.getLogs()
      setLines(data.lines)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar logs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLogs()
    const interval = setInterval(loadLogs, 5000)
    return () => clearInterval(interval)
  }, [loadLogs])

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [lines, autoScroll])

  return (
    <div className="page page--flush page--full">
      <div className="page-head">
        <div>
          <h1 className="page-title">Logs</h1>
          <p className="page-sub">
            <span className="row gap-2" style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
              <span className="dot dot--live" />
              {lines.length} linhas em tempo real
            </span>
          </p>
        </div>
        <div className="page-head-actions">
          <button
            className="toggle"
            data-on={String(autoScroll)}
            onClick={() => setAutoScroll(s => !s)}
            title="Auto-scroll"
            aria-label="Alternar auto-scroll"
          />
          <span className="muted hide-xs" style={{ fontSize: 13, fontWeight: 500 }}>
            Auto-scroll
          </span>
          <button className="btn-icon btn-icon--sm" onClick={loadLogs} title="Atualizar">
            <RefreshCw size={15} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {error && (
        <div
          className="card card--pad anim-fade"
          style={{
            background: 'color-mix(in srgb, var(--accent-red) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-red) 30%, transparent)',
            color: 'var(--accent-red)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
          }}
        >
          <AlertTriangle size={16} strokeWidth={1.75} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13 }}>{error}</span>
        </div>
      )}

      <div
        className="panel flex-1 anim-rise"
        style={{ minHeight: 'min(560px, 62vh)' }}
      >
        <div
          className="panel-head"
          style={{ background: 'var(--bg-deep)', justifyContent: 'flex-start', gap: 8 }}
        >
          <div className="row gap-2" style={{ flexShrink: 0 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--accent-red)' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--accent-yellow)' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--accent-green)' }} />
          </div>
          <span
            className="mono truncate"
            style={{ color: 'var(--text-tertiary)', fontSize: 11.5, marginLeft: 8 }}
          >
            logs/scheduler.log
          </span>
        </div>

        <div className="panel-body scroll" style={{ padding: '14px 16px' }}>
          {loading ? (
            <p className="mono" style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
              Carregando logs...
            </p>
          ) : lines.length === 0 ? (
            <div className="empty">
              <Terminal size={34} strokeWidth={1.5} />
              <p>Nenhum log disponível</p>
            </div>
          ) : (
            lines.map((line, i) => (
              <div
                key={i}
                className="mono"
                style={{
                  display: 'flex',
                  lineHeight: 1.75,
                  fontSize: 11.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                <span
                  style={{
                    color: 'var(--text-faint)',
                    userSelect: 'none',
                    marginRight: 14,
                    textAlign: 'right',
                    width: 34,
                    flexShrink: 0,
                    fontSize: 10.5,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ color: classifyLine(line), flex: 1, minWidth: 0 }}>{line}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
