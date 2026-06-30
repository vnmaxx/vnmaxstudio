import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import type { ReportFile } from '../types'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useContextMenu, type CtxItem } from '../components/ContextMenu'
import { downloadText, humanName } from '../lib/files'
import { RefreshCw, BarChart3, FileText, ArrowLeft, AlertCircle, Loader2, Eye, Copy, Download, Trash2 } from 'lucide-react'

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

  const isMobile = useIsMobile()
  const menu = useContextMenu()

  const reportContent = async (name: string) => {
    const res = await api.getRelatorio(name)
    return res.content
  }

  const copyReport = async (name: string) => { try { menu.copy(await reportContent(name), 'Conteúdo copiado') } catch {} }
  const downloadReport = async (name: string) => { try { downloadText(name, await reportContent(name), 'text/markdown') } catch {} }

  const deleteReport = async (name: string) => {
    if (!confirm(`Excluir o relatório "${name}"? Esta ação não pode ser desfeita.`)) return
    try {
      await api.deleteWorkspacePath(['reports', name])
      if (selected === name) { setSelected(null); setContent(null) }
      menu.flash('Relatório excluído')
      loadReports()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir')
    }
  }

  const reportMenu = (name: string): CtxItem[] => [
    { header: name.replace('.md', '') },
    { label: 'Abrir', icon: <Eye size={15} strokeWidth={1.8} />, onClick: () => selectReport(name) },
    { separator: true },
    { label: 'Copiar nome', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(name, 'Nome copiado') },
    { label: 'Copiar conteúdo', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => copyReport(name) },
    { label: 'Baixar (.md)', icon: <Download size={15} strokeWidth={1.8} />, onClick: () => downloadReport(name) },
    { separator: true },
    { label: 'Excluir', icon: <Trash2 size={15} strokeWidth={1.8} />, danger: true, onClick: () => deleteReport(name) },
  ]

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
  const showList = !isMobile || !selected
  const showContent = !isMobile || !!selected

  const listPane = (
    <div className="col gap-6 scroll" style={{ minHeight: 0 }}>
      {loading ? (
        <div className="col gap-3">
          <div className="skeleton" style={{ height: 46, borderRadius: 'var(--radius)' }} />
          <div className="skeleton" style={{ height: 46, borderRadius: 'var(--radius)' }} />
          <div className="skeleton" style={{ height: 46, borderRadius: 'var(--radius)' }} />
        </div>
      ) : reports.length === 0 ? (
        <div className="empty">
          <FileText size={34} strokeWidth={1.4} />
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Nenhum relatório encontrado</p>
        </div>
      ) : (
        Object.entries(groups).map(([type, items]) => (
          <div key={type} className="col gap-3">
            <span className="label" style={{ margin: '0 0 0 2px' }}>{type}</span>
            <div className="col" style={{ gap: 6 }}>
              {items.map(r => {
                const active = selected === r.name
                return (
                  <button
                    key={r.name}
                    onClick={() => selectReport(r.name)}
                    className="anim-fade"
                    {...menu.bind(() => reportMenu(r.name))}
                    style={{
                      textAlign: 'left',
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer',
                      transition: 'all 0.16s var(--ease)',
                      background: active
                        ? 'color-mix(in srgb, var(--accent) 16%, transparent)'
                        : 'var(--surface)',
                      border: active
                        ? '1px solid var(--accent-line)'
                        : '1px solid var(--border)',
                    }}
                  >
                    <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                      <FileText
                        size={15}
                        strokeWidth={1.6}
                        style={{
                          flexShrink: 0,
                          marginTop: 1,
                          color: active ? 'var(--accent-text)' : 'var(--text-tertiary)',
                        }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p
                          className="truncate"
                          title={r.name}
                          style={{
                            margin: 0,
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: active ? 'var(--accent-text)' : 'var(--text-primary)',
                          }}
                        >
                          {humanName(r.name)}
                        </p>
                        <p
                          style={{
                            margin: '3px 0 0',
                            fontSize: 10.5,
                            color: active ? 'var(--accent-text)' : 'var(--text-tertiary)',
                            opacity: active ? 0.8 : 1,
                          }}
                        >
                          {new Date(r.mtime).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )

  const contentPane = (
    <div className="panel" style={{ minHeight: isMobile ? 360 : 0 }}>
      {!selected ? (
        <div className="panel-body center" style={{ padding: 0 }}>
          <div className="empty">
            <BarChart3 size={40} strokeWidth={1} />
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Selecione um relatório para visualizar
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="panel-head">
            {isMobile && (
              <button
                className="btn-icon btn-icon--sm"
                onClick={() => setSelected(null)}
                title="Voltar"
                aria-label="Voltar"
              >
                <ArrowLeft size={16} strokeWidth={1.7} />
              </button>
            )}
            <FileText size={15} strokeWidth={1.6} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <span className="panel-title truncate" title={selected}>{humanName(selected)}</span>
          </div>
          <div
            className="panel-body"
            style={{ padding: 'clamp(14px, 2.4vw, 20px)' }}
            {...(selected && content ? menu.bind((): CtxItem[] => [
              { header: selected },
              { label: 'Copiar tudo', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(content, 'Conteúdo copiado') },
              { label: 'Baixar (.md)', icon: <Download size={15} strokeWidth={1.8} />, onClick: () => downloadText(selected, content, 'text/markdown') },
              { separator: true },
              { label: 'Excluir', icon: <Trash2 size={15} strokeWidth={1.8} />, danger: true, onClick: () => deleteReport(selected) },
            ]) : {})}
          >
            {loadingContent ? (
              <div className="center" style={{ minHeight: 160, gap: 10 }}>
                <Loader2 size={18} className="spin" style={{ color: 'var(--text-tertiary)' }} />
                <span className="muted" style={{ fontSize: 13 }}>Carregando...</span>
              </div>
            ) : (
              <pre
                className="mono"
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: 12.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {content}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="page page--flush">
      <div className="page-head">
        <div className="row" style={{ gap: 10 }}>
          {isMobile && selected && (
            <button
              className="btn-icon"
              onClick={() => setSelected(null)}
              title="Voltar"
              aria-label="Voltar"
            >
              <ArrowLeft size={18} strokeWidth={1.7} />
            </button>
          )}
          <div>
            <h1 className="page-title">Relatórios</h1>
            <p className="page-sub">
              {reports.length} arquivo{reports.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="page-head-actions">
          <button
            className="btn-icon"
            onClick={loadReports}
            title="Atualizar"
            aria-label="Atualizar"
          >
            <RefreshCw size={16} strokeWidth={1.6} />
          </button>
        </div>
      </div>

      {error && (
        <div
          className="row anim-rise"
          style={{
            gap: 9,
            background: 'color-mix(in srgb, var(--accent-red) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-red) 28%, transparent)',
            color: 'var(--accent-red)',
            borderRadius: 'var(--radius)',
            padding: '11px 14px',
            fontSize: 13,
          }}
        >
          <AlertCircle size={16} strokeWidth={1.7} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="split--narrow split anim-fade">
        {showList && listPane}
        {showContent && contentPane}
      </div>
    </div>
  )
}
