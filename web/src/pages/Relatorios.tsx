import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import type { ReportFile } from '../types'
import { RefreshCw, BarChart3 } from 'lucide-react'

function getReportType(name: string): string {
  if (name.startsWith('relatorio-')) return 'Relatório'
  if (name.startsWith('dados-semana')) return 'Dados Semanais'
  if (name.startsWith('plano-')) return 'Plano'
  return 'Outros'
}

function groupReports(reports: ReportFile[]): Record<string, ReportFile[]> {
  const groups: Record<string, ReportFile[]> = {}
  for (const r of reports) {
    const type = getReportType(r.name)
    if (!groups[type]) groups[type] = []
    groups[type].push(r)
  }
  return groups
}

export default function Relatorios() {
  const [reports, setReports] = useState<ReportFile[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [content, setContent] = useState<string | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadReports = useCallback(async () => {
    try {
      const list = await api.getRelatorios()
      setReports(list)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar relatórios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const selectReport = async (name: string) => {
    setSelected(name)
    setContent(null)
    setLoadingContent(true)
    try {
      const res = await api.getRelatorio(name)
      setContent(res.content)
    } catch (e: unknown) {
      setContent(`Erro ao carregar: ${e instanceof Error ? e.message : 'Unknown'}`)
    } finally {
      setLoadingContent(false)
    }
  }

  const groups = groupReports(reports)

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ padding: '20px 24px' }}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 600, margin: 0, lineHeight: 1 }}>
            Relatórios
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '4px 0 0 0' }}>
            {reports.length} arquivo{reports.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={loadReports}
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

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Sidebar list */}
        <div className="overflow-y-auto" style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Carregando...</div>
          ) : reports.length === 0 ? (
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: '20px 16px',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: 13,
              }}
            >
              Nenhum relatório encontrado
            </div>
          ) : (
            Object.entries(groups).map(([type, items]) => (
              <div key={type}>
                <h3
                  style={{
                    color: 'var(--text-tertiary)',
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    margin: '0 0 6px 4px',
                  }}
                >
                  {type}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {items.map(r => (
                    <button
                      key={r.name}
                      onClick={() => selectReport(r.name)}
                      style={{
                        textAlign: 'left',
                        padding: '8px 12px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        background: selected === r.name
                          ? 'rgba(10,132,255,0.18)'
                          : 'rgba(255,255,255,0.04)',
                        border: selected === r.name
                          ? '1px solid rgba(10,132,255,0.25)'
                          : '1px solid rgba(255,255,255,0.07)',
                        color: selected === r.name ? '#0A84FF' : 'var(--text-secondary)',
                        width: '100%',
                      }}
                    >
                      <p style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.name.replace('.md', '')}
                      </p>
                      <p
                        style={{
                          margin: '3px 0 0 0',
                          fontSize: 10,
                          color: selected === r.name ? 'rgba(10,132,255,0.7)' : 'var(--text-tertiary)',
                        }}
                      >
                        {new Date(r.mtime).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Content pane */}
        <div
          className="flex-1 overflow-hidden flex flex-col"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                  <BarChart3 size={40} strokeWidth={1} style={{ opacity: 0.3 }} />
                </div>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: 0 }}>
                  Selecione um relatório para visualizar
                </p>
              </div>
            </div>
          ) : loadingContent ? (
            <div className="flex-1 flex items-center justify-center">
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Carregando...</span>
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '16px 16px 0 0',
                }}
              >
                <h2 style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 13, margin: 0 }}>
                  {selected}
                </h2>
              </div>
              <div className="flex-1 overflow-auto" style={{ padding: 16 }}>
                <pre
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: 12.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-words',
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  {content}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
