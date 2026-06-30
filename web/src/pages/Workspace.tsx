import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import type { WorkspaceFile } from '../types'
import { useIsMobile } from '../hooks/useMediaQuery'
import {
  RefreshCw, FolderOpen, FileText, ChevronRight, ArrowLeft, Home, Search,
  Users, PenLine, Package, Globe, Megaphone, Mail, Handshake, ClipboardList,
  BarChart3, CheckSquare, Folder, File, Braces, Terminal, LayoutGrid,
  Phone, AtSign, Tag, MessageSquare, Star, Code, MapPin, ExternalLink,
} from 'lucide-react'

type BrowseResult =
  | { type: 'dir'; items: WorkspaceFile[] }
  | { type: 'file'; raw: string; isJson: boolean }

const DIR_META: Record<string, { icon: React.ReactNode; color: string }> = {
  leads:      { icon: <Users        size={22} strokeWidth={1.4} />, color: '#0A84FF' },
  conteudo:   { icon: <PenLine      size={22} strokeWidth={1.4} />, color: '#BF5AF2' },
  produtos:   { icon: <Package      size={22} strokeWidth={1.4} />, color: '#FF9F0A' },
  paginas:    { icon: <Globe        size={22} strokeWidth={1.4} />, color: '#32ADE6' },
  campanhas:  { icon: <Megaphone    size={22} strokeWidth={1.4} />, color: '#FF375F' },
  emails:     { icon: <Mail         size={22} strokeWidth={1.4} />, color: '#30D158' },
  clientes:   { icon: <Handshake    size={22} strokeWidth={1.4} />, color: '#FFD60A' },
  propostas:  { icon: <ClipboardList size={22} strokeWidth={1.4} />, color: '#FF6961' },
  reports:    { icon: <BarChart3    size={22} strokeWidth={1.4} />, color: '#64D2FF' },
  aprovacoes: { icon: <CheckSquare  size={22} strokeWidth={1.4} />, color: '#30D158' },
  workspace:  { icon: <LayoutGrid   size={22} strokeWidth={1.4} />, color: '#0A84FF' },
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

function fileExt(name?: string) {
  if (!name) return ''
  return name.split('.').pop()?.toLowerCase() || ''
}

interface Lead {
  nome?: string
  segmento?: string
  contato?: string
  observacao?: string
  fonte?: string
  [key: string]: unknown
}

function parseContato(raw?: string) {
  if (!raw) return { handle: '', phone: '' }
  const parts = raw.split('/').map(s => s.trim())
  const handle = parts.find(p => p.startsWith('@')) || ''
  const phone  = parts.find(p => /\(?\d{2}\)?[\s-]?\d{4,5}/.test(p)) || ''
  return { handle, phone }
}

function extractRank(obs?: string) {
  const m = obs?.match(/TOP\s*(\d+)/i)
  return m ? parseInt(m[1]) : null
}

function extractRating(obs?: string) {
  const m = obs?.match(/[Nn]ota\s+([\d,.]+)/)
  return m ? m[1].replace(',', '.') : null
}

function extractReviews(obs?: string) {
  const m = obs?.match(/([\d.,]+\+?)\s*avalia[çc][õo]es?/i)
  return m ? m[1] : null
}

function mapsUrl(nome?: string) {
  return `https://www.google.com/maps/search/${encodeURIComponent(nome || '')}`
}

function googleUrl(nome?: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(nome || '')}`
}

function hexToRgb(hex: string) {
  if (!hex || hex.length < 7) return '10,132,255'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

function LeadCard({ lead, index }: { lead: Lead; index: number }) {
  const { handle, phone } = parseContato(lead.contato)
  const rank    = extractRank(lead.observacao)
  const rating  = extractRating(lead.observacao)
  const reviews = extractReviews(lead.observacao)
  const obs     = lead.observacao?.replace(/^TOP\s*\d+\s*[–-]\s*/i, '') || ''

  const rankColor = rank === 1 ? '#FFD60A' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : 'rgba(255,255,255,0.3)'

  return (
    <div className="card card--pad col gap-3" style={{ gap: 12 }}>
      <div className="row row--between" style={{ alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div className="flex-1 col" style={{ minWidth: 0, gap: 6 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {rank && (
              <span style={{ fontSize: 11, fontWeight: 700, color: rankColor, background: `${rankColor}18`, border: `1px solid ${rankColor}40`, borderRadius: 'var(--radius-sm)', padding: '1px 7px', flexShrink: 0 }}>
                TOP {rank}
              </span>
            )}
            <span className="truncate" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {lead.nome || `Lead #${index + 1}`}
            </span>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            {lead.segmento && (
              <span className="chip" style={{ color: 'var(--accent-text)', background: 'var(--accent-softer)', borderColor: 'var(--accent-line)' }}>
                <Tag size={11} strokeWidth={2} /> {lead.segmento}
              </span>
            )}
            {rating && (
              <span className="chip" style={{ color: 'var(--accent-yellow)', background: 'color-mix(in srgb, var(--accent-yellow) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-yellow) 25%, transparent)', fontWeight: 600 }}>
                <Star size={11} strokeWidth={2.5} style={{ fill: 'var(--accent-yellow)' }} /> {rating}
                {reviews && <span style={{ fontWeight: 400, opacity: 0.7, fontSize: 10.5 }}>({reviews} avaliações)</span>}
              </span>
            )}
          </div>
        </div>

        <div className="row wrap" style={{ gap: 6, flexShrink: 0 }}>
          <a
            className="btn btn--sm btn--pill"
            href={mapsUrl(lead.nome)}
            target="_blank"
            rel="noopener noreferrer"
            title="Ver no Google Maps"
            style={{ background: 'color-mix(in srgb, #EA4335 12%, transparent)', borderColor: 'color-mix(in srgb, #EA4335 28%, transparent)', color: '#EA4335' }}
          >
            <MapPin size={13} strokeWidth={2} /> Maps
          </a>
          <a
            className="btn btn--sm btn--pill"
            href={googleUrl(lead.nome)}
            target="_blank"
            rel="noopener noreferrer"
            title="Pesquisar no Google"
            style={{ background: 'color-mix(in srgb, #4285F4 12%, transparent)', borderColor: 'color-mix(in srgb, #4285F4 28%, transparent)', color: '#4285F4' }}
          >
            <ExternalLink size={13} strokeWidth={2} /> Google
          </a>
        </div>
      </div>

      <div className="row wrap" style={{ gap: 8 }}>
        {handle && (
          <a
            className="chip"
            href={`https://instagram.com/${handle.replace('@', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-purple)', background: 'color-mix(in srgb, var(--accent-purple) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-purple) 22%, transparent)', textDecoration: 'none' }}
          >
            <AtSign size={12} strokeWidth={2} /> {handle}
          </a>
        )}
        {phone && (
          <span className="chip" style={{ color: 'var(--accent-green)', background: 'color-mix(in srgb, var(--accent-green) 9%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-green) 22%, transparent)' }}>
            <Phone size={12} strokeWidth={2} /> {phone}
          </span>
        )}
        {(lead.fonte as string) && (
          <span className="chip muted">
            Fonte: {lead.fonte as string}
          </span>
        )}
      </div>

      {obs && (
        <div className="row" style={{ gap: 8, alignItems: 'flex-start', padding: '10px 12px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <MessageSquare size={14} strokeWidth={1.5} style={{ color: 'var(--text-faint)', flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{obs}</p>
        </div>
      )}
    </div>
  )
}

function FileViewer({ filename, content, isJson }: { filename: string; content: string; isJson: boolean }) {
  const [rawView, setRawView] = useState(false)

  let leads: Lead[] | null = null
  if (isJson) {
    try {
      const stripped = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```[\s\S]*$/, '').trim()
      const parsed = JSON.parse(stripped)
      if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0].nome || parsed[0].contato || parsed[0].segmento)) {
        leads = parsed as Lead[]
      }
    } catch { /* not parseable */ }
  }

  const isLeads = leads !== null

  return (
    <div className="panel anim-fade">
      <div className="panel-head" style={{ gap: 10, flexWrap: 'wrap' }}>
        <FileIconComp name={filename} isDir={false} />
        <span className="panel-title truncate flex-1">{filename}</span>
        {isLeads && (
          <span className="badge" style={{ color: 'var(--accent-green)', background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-green) 22%, transparent)' }}>
            {leads!.length} leads
          </span>
        )}
        {isLeads && (
          <button
            className={'btn btn--sm' + (rawView ? ' btn--accent-soft' : ' btn--ghost')}
            onClick={() => setRawView(r => !r)}
            title={rawView ? 'Ver cards' : 'Ver JSON'}
          >
            <Code size={13} strokeWidth={2} /> {rawView ? 'Cards' : 'JSON'}
          </button>
        )}
        <span className="badge mono">{fileExt(filename).toUpperCase() || 'TXT'}</span>
      </div>

      <div className="panel-body" style={{ padding: 'clamp(14px, 3vw, 18px)' }}>
        {isLeads && !rawView ? (
          <div className="col" style={{ gap: 12 }}>
            {leads!.map((lead, i) => <LeadCard key={i} lead={lead} index={i} />)}
          </div>
        ) : (
          <pre className="mono" style={{ color: '#c9d1d9', fontSize: 12.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.75, margin: 0 }}>
            {isJson ? (() => { try { const s = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```[\s\S]*$/, '').trim(); return JSON.stringify(JSON.parse(s), null, 2) } catch { return content } })() : content}
          </pre>
        )}
      </div>
    </div>
  )
}

function FileIconComp({ name, isDir }: { name?: string; isDir: boolean }) {
  if (isDir) return <FolderOpen size={18} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
  const ext = fileExt(name)
  if (ext === 'json') return <Braces size={18} strokeWidth={1.5} style={{ color: 'var(--accent-yellow)' }} />
  if (['js', 'ts', 'py', 'sh'].includes(ext)) return <Terminal size={18} strokeWidth={1.5} style={{ color: 'var(--accent-purple)' }} />
  if (['md', 'txt'].includes(ext)) return <FileText size={18} strokeWidth={1.5} style={{ color: 'var(--accent-cyan)' }} />
  return <File size={18} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
}

export default function Workspace() {
  const [pathStack, setPathStack] = useState<string[]>([])
  const [result, setResult] = useState<BrowseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const isMobile = useIsMobile()

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
  const filtered = items.filter(f => (f.name || '').toLowerCase().includes(search.toLowerCase()))

  const listCols = isMobile ? '1fr auto' : '1fr 90px 140px'

  return (
    <div className="page page--flush">

      <div className="page-head">
        <div className="row" style={{ gap: 12, minWidth: 0 }}>
          {pathStack.length > 0 && (
            <button className="btn-icon" onClick={goBack} title="Voltar">
              <ArrowLeft size={16} strokeWidth={2} />
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 className="page-title truncate">
              {isRoot ? 'Workspace' : pathStack[pathStack.length - 1]}
            </h1>
            <div className="row wrap" style={{ gap: 3, marginTop: 4 }}>
              <button onClick={goHome} className="btn btn--ghost btn--sm" style={{ padding: '2px 6px', color: 'var(--accent-text)' }}>
                <Home size={11} strokeWidth={2} /> workspace
              </button>
              {pathStack.map((seg, i) => (
                <span key={i} className="row" style={{ gap: 3 }}>
                  <ChevronRight size={11} style={{ color: 'var(--text-faint)' }} />
                  <button
                    onClick={() => goTo(pathStack.slice(0, i + 1))}
                    className="btn btn--ghost btn--sm"
                    style={{ padding: '2px 6px', color: i === pathStack.length - 1 ? 'var(--text-tertiary)' : 'var(--accent-text)', cursor: i === pathStack.length - 1 ? 'default' : 'pointer' }}
                  >
                    {seg}
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="page-head-actions">
          {!fileContent && items.length > 4 && (
            <div style={{ position: 'relative' }}>
              <Search size={14} strokeWidth={1.5} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
              <input
                className="input input--search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filtrar..."
                style={{ width: 'min(200px, 46vw)' }}
              />
            </div>
          )}
          <button className="btn-icon" onClick={() => navigate(pathStack)} title="Atualizar">
            <RefreshCw size={15} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {error && (
        <div className="card card--pad anim-fade" style={{ background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-red) 25%, transparent)', color: 'var(--accent-red)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && (
        <div className="empty">
          <RefreshCw size={22} strokeWidth={1.5} className="spin" />
          <p>Carregando...</p>
        </div>
      )}

      {!loading && isRoot && result?.type === 'dir' && (
        <div className="grid grid--auto anim-rise">
          {filtered.map(d => {
            const meta = DIR_META[d.name] || { icon: <Folder size={22} strokeWidth={1.4} />, color: '#0A84FF' }
            const rgb = hexToRgb(meta.color)
            return (
              <button
                key={d.name}
                className="card card--hover"
                onClick={() => goTo([d.name])}
                style={{
                  padding: '22px 20px', textAlign: 'left',
                  display: 'flex', flexDirection: 'column', gap: 4,
                  position: 'relative', overflow: 'hidden', minHeight: 140,
                }}
              >
                <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle, rgba(${rgb},0.14) 0%, transparent 70%)`, pointerEvents: 'none' }} />
                <div style={{ color: meta.color, marginBottom: 'auto', display: 'flex', paddingBottom: 16 }}>{meta.icon}</div>
                <p className="truncate" style={{ color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600, margin: 0 }}>{d.name}</p>
                <p style={{ margin: 0, fontSize: 11.5, fontWeight: 500, color: `rgba(${rgb},0.85)` }}>
                  {(d as WorkspaceFile & { count?: number }).count ?? 0} {((d as WorkspaceFile & { count?: number }).count ?? 0) === 1 ? 'item' : 'itens'}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {!loading && !isRoot && result?.type === 'dir' && (
        <div className="card anim-fade" style={{ overflow: 'hidden', padding: 0 }}>
          {filtered.length === 0 && (
            <div className="empty">
              <FolderOpen size={30} strokeWidth={1} />
              <p>{search ? 'Nenhum resultado' : 'Diretório vazio'}</p>
            </div>
          )}

          {filtered.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: listCols, padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nome</span>
              {!isMobile && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Tamanho</span>}
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>{isMobile ? '' : 'Modificado'}</span>
            </div>
          )}

          {filtered.map((f, i) => (
            <button
              key={f.name}
              onClick={() => goTo([...pathStack, f.name])}
              className="ws-row"
              style={{
                display: 'grid', gridTemplateColumns: listCols, gap: 12,
                alignItems: 'center', width: '100%', textAlign: 'left',
                padding: '12px 16px', cursor: 'pointer', background: 'transparent',
                border: 'none', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <span className="row" style={{ gap: 10, minWidth: 0 }}>
                <FileIconComp name={f.name} isDir={f.isDir} />
                <span className="col" style={{ minWidth: 0 }}>
                  <span className="truncate" style={{ color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 500 }}>{f.name}</span>
                  {f.isDir && <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>Pasta</span>}
                </span>
              </span>
              {!isMobile && (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'right' }}>
                  {f.isDir ? '—' : formatSize(f.size)}
                </span>
              )}
              <span className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                {!isMobile && <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{formatDate(f.mtime)}</span>}
                <ChevronRight size={14} strokeWidth={1.5} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
              </span>
            </button>
          ))}
        </div>
      )}

      {!loading && fileContent && (
        <FileViewer
          filename={pathStack[pathStack.length - 1] || ''}
          content={fileContent.raw}
          isJson={fileContent.isJson}
        />
      )}
    </div>
  )
}
