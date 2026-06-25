import { useEffect, useState, useRef, useCallback } from 'react'
import { api } from '../api'
import { RefreshCw } from 'lucide-react'

function classifyLine(line: string): string {
  if (line.includes('ERROR') || line.includes('Erro') || line.includes('ERRO')) return '#FF453A'
  if (line.includes('AVISO') || line.includes('WARN') || line.includes('warn')) return '#FFD60A'
  if (line.includes('=== CICLO') || line.includes('CICLO ') || line.startsWith('====')) return '#0A84FF'
  if (line.includes('OK') || line.includes('sucesso')) return '#30D158'
  return 'rgba(255,255,255,0.45)'
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
    <div className="h-full flex flex-col overflow-hidden" style={{ padding: '20px 24px' }}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 600, margin: 0, lineHeight: 1 }}>
            Logs
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '4px 0 0 0' }}>
            {lines.length} linhas
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Auto-scroll toggle */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <div
              onClick={() => setAutoScroll(s => !s)}
              style={{
                position: 'relative',
                width: 36,
                height: 20,
                borderRadius: 980,
                background: autoScroll ? 'rgba(10,132,255,0.5)' : 'rgba(255,255,255,0.1)',
                border: autoScroll ? '1px solid rgba(10,132,255,0.6)' : '1px solid rgba(255,255,255,0.15)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 2,
                  left: autoScroll ? 18 : 2,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: autoScroll ? '#0A84FF' : 'rgba(255,255,255,0.4)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: autoScroll ? '0 0 6px rgba(10,132,255,0.6)' : 'none',
                }}
              />
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>
              Auto-scroll
            </span>
          </label>
          <button
            onClick={loadLogs}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-secondary)',
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            title="Atualizar"
          >
            <RefreshCw size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {error && (
        <div
          className="flex-shrink-0"
          style={{
            background: 'rgba(255,69,58,0.1)',
            border: '1px solid rgba(255,69,58,0.25)',
            color: '#FF453A',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Terminal window */}
      <div
        className="flex-1 overflow-hidden flex flex-col"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* macOS title bar */}
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(0,0,0,0.6)',
            borderRadius: '16px 16px 0 0',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF453A' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFD60A' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#30D158' }} />
          <span
            style={{
              color: 'var(--text-tertiary)',
              fontSize: 11,
              marginLeft: 8,
              fontFamily: "'SF Mono', 'Fira Code', monospace",
            }}
          >
            logs/scheduler.log
          </span>
        </div>

        {/* Log lines */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ padding: '12px 16px' }}
        >
          {loading ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: 12, fontFamily: "'SF Mono', monospace" }}>
              Carregando logs...
            </p>
          ) : lines.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: 12, fontFamily: "'SF Mono', monospace" }}>
              Nenhum log disponível
            </p>
          ) : (
            lines.map((line, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  lineHeight: 1.7,
                  fontSize: 11.5,
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                }}
              >
                <span
                  style={{
                    color: 'var(--text-tertiary)',
                    userSelect: 'none',
                    marginRight: 16,
                    textAlign: 'right',
                    width: 36,
                    flexShrink: 0,
                    fontSize: 10.5,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ color: classifyLine(line) }}>{line}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
