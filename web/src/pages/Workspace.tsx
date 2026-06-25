import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import type { WorkspaceFile } from '../types'
import { RefreshCw, FolderOpen, FileText, ChevronRight, ArrowLeft, Home } from 'lucide-react'

type BrowseResult =
  | { type: 'dir'; items: WorkspaceFile[] }
  | { type: 'file'; raw: string; isJson: boolean }

const DIR_ICONS: Record<string, string> = {
  leads: '👥', conteudo: '✍️', produtos: '📦', paginas: '🌐',
  campanhas: '📣', emails: '✉️', clientes: '🤝', propostas: '📋',
  reports: '📊', aprovacoes: '✅', workspace: '🗂️',
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function formatDate(mtime: string) {
  if (!mtime) return '—'
  return new Date(mtime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function Workspace() {
  const [pathStack, setPathStack] = useState<string[]>([])
  const [result, setResult] = useState<BrowseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigate = useCallback(async (segments: string[]) => {
    setLoading(true)
    setError(null)
    try {
      if (segments.length === 0) {
        const dirs = await api.getWorkspace()
        setResult({ type: 'dir', items: dirs.map(d => ({ name: d.name, isDir: true, size: 0, mtime: '', count: d.count })) })
      } else {
        const res = await api.browsePath(segments)
        setResult(res)
      }
      setPathStack(segments)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { navigate([]) }, [navigate])

  const goTo = (segments: string[]) => navigate(segments)
  const goBack = () => goTo(pathStack.slice(0, -1))
  const goHome = () => goTo([])

  const items = result?.type === 'dir' ? result.items : []
  const fileContent = result?.type === 'file' ? result : null

  return (
    <div style={{ minHeight: '100%', padding: '16px', maxWidth: 900, margin: '0 auto', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {pathStack.length > 0 && (
            <button
              onClick={goBack}
              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <ArrowLeft size={16} strokeWidth={2} />
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
              {pathStack.length === 0 ? 'Workspace' : pathStack[pathStack.length - 1]}
            </h1>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 4, flexWrap: 'wrap' }}>
              <button onClick={goHome} style={{ background: 'none', border: 'none', color: '#0A84FF', fontSize: 11, cursor: 'pointer', padding: '0 2px', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Home size={10} /> workspace
              </button>
              {pathStack.map((seg, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <ChevronRight size={10} style={{ color: 'var(--text-tertiary)' }} />
                  <button
                    onClick={() => goTo(pathStack.slice(0, i + 1))}
                    style={{ background: 'none', border: 'none', color: i === pathStack.length - 1 ? 'var(--text-secondary)' : '#0A84FF', fontSize: 11, cursor: i === pathStack.length - 1 ? 'default' : 'pointer', padding: '0 2px' }}
                  >
                    {seg}
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate(pathStack)}
          style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <RefreshCw size={14} strokeWidth={1.5} />
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.25)', color: '#FF453A', borderRadius: 12, padding: '12px 16px', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Carregando...</span>
        </div>
      )}

      {/* Directory root — grid de cards */}
      {!loading && result?.type === 'dir' && pathStack.length === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {items.map(d => (
            <button
              key={d.name}
              onClick={() => goTo([d.name])}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '18px 14px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.18s', minHeight: 90 }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background = 'rgba(255,255,255,0.08)'; el.style.borderColor = 'rgba(10,132,255,0.35)'; el.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background = 'rgba(255,255,255,0.04)'; el.style.borderColor = 'rgba(255,255,255,0.08)'; el.style.transform = 'none' }}
            >
              <div style={{ fontSize: 26, marginBottom: 8 }}>{DIR_ICONS[d.name] || '📁'}</div>
              <p style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, margin: '0 0 3px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</p>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 10, margin: 0 }}>
                {(d as WorkspaceFile & { count?: number }).count ?? '—'} itens
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Listing de subpasta — lista vertical */}
      {!loading && result?.type === 'dir' && pathStack.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
          {items.length === 0 && (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Diretório vazio</div>
          )}
          {items.map((f, i) => (
            <button
              key={f.name}
              onClick={() => goTo([...pathStack, f.name])}
              style={{
                display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left',
                padding: '14px 16px', cursor: 'pointer', background: 'transparent',
                border: 'none', borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                transition: 'background 0.15s', gap: 12,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <span style={{ display: 'flex', flexShrink: 0, color: f.isDir ? '#0A84FF' : 'var(--text-secondary)' }}>
                {f.isDir
                  ? <FolderOpen size={18} strokeWidth={1.5} />
                  : <FileText size={18} strokeWidth={1.5} />
                }
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                {!f.isDir && (
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 11, display: 'block', marginTop: 1 }}>
                    {formatSize(f.size)} · {formatDate(f.mtime)}
                  </span>
                )}
              </span>
              <ChevronRight size={14} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}

      {/* Conteúdo de arquivo */}
      {!loading && fileContent && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={14} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pathStack[pathStack.length - 1]}
            </span>
          </div>
          <div style={{ padding: 16, overflowX: 'auto' }}>
            <pre style={{ color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-words', fontFamily: "'SF Mono', 'Fira Code', monospace", lineHeight: 1.7, margin: 0 }}>
              {fileContent.isJson
                ? (() => { try { return JSON.stringify(JSON.parse(fileContent.raw), null, 2) } catch { return fileContent.raw } })()
                : fileContent.raw}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
