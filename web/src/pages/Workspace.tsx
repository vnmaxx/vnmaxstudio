import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import type { WorkspaceFile } from '../types'
import { RefreshCw, FolderOpen, FileText, ChevronRight, ArrowLeft, Home, Search, File, FileJson, FileCode } from 'lucide-react'

type BrowseResult =
  | { type: 'dir'; items: WorkspaceFile[] }
  | { type: 'file'; raw: string; isJson: boolean }

const DIR_META: Record<string, { icon: string; color: string }> = {
  leads:      { icon: '👥', color: '#0A84FF' },
  conteudo:   { icon: '✍️', color: '#BF5AF2' },
  produtos:   { icon: '📦', color: '#FF9F0A' },
  paginas:    { icon: '🌐', color: '#32ADE6' },
  campanhas:  { icon: '📣', color: '#FF375F' },
  emails:     { icon: '✉️', color: '#30D158' },
  clientes:   { icon: '🤝', color: '#FFD60A' },
  propostas:  { icon: '📋', color: '#FF6961' },
  reports:    { icon: '📊', color: '#64D2FF' },
  aprovacoes: { icon: '✅', color: '#30D158' },
  workspace:  { icon: '🗂️', color: '#0A84FF' },
}

const SP = 'America/Sao_Paulo'

function formatSize(bytes: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(mtime: string) {
  if (!mtime) return '—'
  return new Date(mtime).toLocaleString('pt-BR', { timeZone: SP, day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fileExt(name: string) {
  return name.split('.').pop()?.toLowerCase() || ''
}

function FileIcon({ name, isDir }: { name: string; isDir: boolean }) {
  if (isDir) return <FolderOpen size={18} strokeWidth={1.5} style={{ color: '#0A84FF' }} />
  const ext = fileExt(name)
  if (ext === 'json') return <FileJson size={18} strokeWidth={1.5} style={{ color: '#FFD60A' }} />
  if (['js','ts','py','sh'].includes(ext)) return <FileCode size={18} strokeWidth={1.5} style={{ color: '#BF5AF2' }} />
  if (['md','txt'].includes(ext)) return <File size={18} strokeWidth={1.5} style={{ color: '#32ADE6' }} />
  return <FileText size={18} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
}

export default function Workspace() {
  const [pathStack, setPathStack] = useState<string[]>([])
  const [result, setResult] = useState<BrowseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const navigate = useCallback(async (segments: string[]) => {
    setLoading(true)
    setError(null)
    setSearch('')
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
  const isRoot = pathStack.length === 0

  const filtered = items.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ minHeight: '100%', padding: '20px 24px', maxWidth: 1000, margin: '0 auto', boxSizing: 'border-box' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {pathStack.length > 0 && (
            <button
              onClick={goBack}
              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            >
              <ArrowLeft size={15} strokeWidth={2} />
            </button>
          )}
          <div>
            <h1 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 700, margin: 0, lineHeight: 1 }}>
              {isRoot ? 'Workspace' : pathStack[pathStack.length - 1]}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 5 }}>
              <button onClick={goHome} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Home size={10} strokeWidth={2} /> workspace
              </button>
              {pathStack.map((seg, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <ChevronRight size={10} style={{ color: 'rgba(255,255,255,0.2)' }} />
                  <button
                    onClick={() => goTo(pathStack.slice(0, i + 1))}
                    style={{ background: 'none', border: 'none', color: i === pathStack.length - 1 ? 'rgba(255,255,255,0.4)' : 'var(--accent)', fontSize: 11, cursor: i === pathStack.length - 1 ? 'default' : 'pointer', padding: 0 }}
                  >
                    {seg}
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!fileContent && items.length > 4 && (
            <div style={{ position: 'relative' }}>
              <Search size={13} strokeWidth={1.5} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filtrar..."
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 12px 7px 30px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', width: 160 }}
              />
            </div>
          )}
          <button
            onClick={() => navigate(pathStack)}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget.firstElementChild as HTMLElement).style.transform = 'rotate(90deg)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget.firstElementChild as HTMLElement).style.transform = 'none' }}
          >
            <RefreshCw size={14} strokeWidth={1.5} style={{ transition: 'transform 0.3s' }} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)', color: '#FF453A', borderRadius: 12, padding: '12px 16px', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12 }}>
          <RefreshCw size={20} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.2)', animation: 'spin 0.9s linear infinite' }} />
          <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Carregando...</span>
        </div>
      )}

      {!loading && isRoot && result?.type === 'dir' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {filtered.map(d => {
            const meta = DIR_META[d.name] || { icon: '📁', color: '#0A84FF' }
            return (
              <button
                key={d.name}
                onClick={() => goTo([d.name])}
                style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 16, padding: '20px 16px', textAlign: 'left', cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)', position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget
                  el.style.background = `rgba(${hexToRgb(meta.color)},0.08)`
                  el.style.borderColor = `rgba(${hexToRgb(meta.color)},0.3)`
                  el.style.transform = 'translateY(-3px)'
                  el.style.boxShadow = `0 8px 24px rgba(${hexToRgb(meta.color)},0.15)`
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget
                  el.style.background = 'rgba(255,255,255,0.03)'
                  el.style.borderColor = 'rgba(255,255,255,0.07)'
                  el.style.transform = 'none'
                  el.style.boxShadow = 'none'
                }}
              >
                <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle, rgba(${hexToRgb(meta.color)},0.08) 0%, transparent 70%)`, pointerEvents: 'none' }} />
                <div style={{ fontSize: 28, marginBottom: 12, lineHeight: 1 }}>{meta.icon}</div>
                <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, margin: '0 0 5px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</p>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: meta.color }}>
                  {(d as WorkspaceFile & { count?: number }).count ?? 0} {((d as WorkspaceFile & { count?: number }).count ?? 0) === 1 ? 'item' : 'itens'}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {!loading && !isRoot && result?.type === 'dir' && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <FolderOpen size={28} strokeWidth={1} style={{ color: 'rgba(255,255,255,0.1)', marginBottom: 10 }} />
              <p style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: 0 }}>{search ? 'Nenhum resultado' : 'Diretório vazio'}</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nome</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right', paddingRight: 24, width: 80 }}>Tamanho</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right', width: 130 }}>Modificado</span>
          </div>

          {filtered.map((f, i) => (
            <button
              key={f.name}
              onClick={() => goTo([...pathStack, f.name])}
              style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto',
                alignItems: 'center', width: '100%', textAlign: 'left',
                padding: '11px 16px', cursor: 'pointer', background: 'transparent',
                border: 'none', borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                transition: 'background 0.12s', gap: 0,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <FileIcon name={f.name} isDir={f.isDir} />
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  {f.isDir && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>Pasta</span>}
                </span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'right', paddingRight: 24, width: 80 }}>
                {f.isDir ? '—' : formatSize(f.size)}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, width: 130 }}>
                <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)' }}>{formatDate(f.mtime)}</span>
                <ChevronRight size={13} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
              </span>
            </button>
          ))}
        </div>
      )}

      {!loading && fileContent && (
        <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileIcon name={pathStack[pathStack.length - 1] || ''} isDir={false} />
            <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pathStack[pathStack.length - 1]}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 6 }}>
              {fileExt(pathStack[pathStack.length - 1] || '').toUpperCase() || 'TXT'}
            </span>
          </div>
          <div style={{ padding: '16px 20px', overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
            <pre style={{ color: '#c9d1d9', fontSize: 12.5, whiteSpace: 'pre-wrap', wordBreak: 'break-words', fontFamily: "'SF Mono','Fira Code','Cascadia Code',monospace", lineHeight: 1.75, margin: 0 }}>
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

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}
