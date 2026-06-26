import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import type { WorkspaceFile } from '../types'
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

function LeadCard({ lead, index }: { lead: Lead; index: number }) {
  const { handle, phone } = parseContato(lead.contato)
  const rank    = extractRank(lead.observacao)
  const rating  = extractRating(lead.observacao)
  const reviews = extractReviews(lead.observacao)
  const obs     = lead.observacao?.replace(/^TOP\s*\d+\s*[–-]\s*/i, '') || ''

  const rankColor = rank === 1 ? '#FFD60A' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : 'rgba(255,255,255,0.3)'

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {rank && (
              <span style={{ fontSize: 11, fontWeight: 700, color: rankColor, background: `${rankColor}18`, border: `1px solid ${rankColor}40`, borderRadius: 6, padding: '1px 7px', flexShrink: 0 }}>
                TOP {rank}
              </span>
            )}
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lead.nome || `Lead #${index + 1}`}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {lead.segmento && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--accent)', background: 'rgba(10,132,255,0.1)', border: '1px solid rgba(10,132,255,0.2)', borderRadius: 6, padding: '2px 8px' }}>
                <Tag size={10} strokeWidth={2} /> {lead.segmento}
              </span>
            )}
            {rating && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#FFD60A', background: 'rgba(255,214,10,0.1)', border: '1px solid rgba(255,214,10,0.25)', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
                <Star size={10} strokeWidth={2.5} style={{ fill: '#FFD60A' }} /> {rating}
                {reviews && <span style={{ fontWeight: 400, color: 'rgba(255,214,10,0.7)', fontSize: 10.5 }}>({reviews} avaliações)</span>}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <a
            href={mapsUrl(lead.nome)}
            target="_blank"
            rel="noopener noreferrer"
            title="Ver no Google Maps"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: 'rgba(234,67,53,0.1)', border: '1px solid rgba(234,67,53,0.25)', color: '#EA4335', fontSize: 11.5, textDecoration: 'none', fontWeight: 500, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(234,67,53,0.18)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(234,67,53,0.1)' }}
          >
            <MapPin size={12} strokeWidth={2} /> Maps
          </a>
          <a
            href={googleUrl(lead.nome)}
            target="_blank"
            rel="noopener noreferrer"
            title="Pesquisar no Google"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: 'rgba(66,133,244,0.1)', border: '1px solid rgba(66,133,244,0.25)', color: '#4285F4', fontSize: 11.5, textDecoration: 'none', fontWeight: 500, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(66,133,244,0.18)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(66,133,244,0.1)' }}
          >
            <ExternalLink size={12} strokeWidth={2} /> Google
          </a>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {handle && (
          <a
            href={`https://instagram.com/${handle.replace('@','')}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#BF5AF2', background: 'rgba(191,90,242,0.1)', border: '1px solid rgba(191,90,242,0.2)', borderRadius: 8, padding: '5px 10px', textDecoration: 'none', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(191,90,242,0.18)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(191,90,242,0.1)' }}
          >
            <AtSign size={12} strokeWidth={2} /> {handle}
          </a>
        )}
        {phone && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#30D158', background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.2)', borderRadius: 8, padding: '5px 10px' }}>
            <Phone size={12} strokeWidth={2} /> {phone}
          </span>
        )}
        {(lead.fonte as string) && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 10px' }}>
            Fonte: {lead.fonte as string}
          </span>
        )}
      </div>

      {obs && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
          <MessageSquare size={13} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0, marginTop: 2 }} />
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
    <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <FileIconComp name={filename} isDir={false} />
        <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {filename}
        </span>
        {isLeads && (
          <span style={{ fontSize: 11, color: '#30D158', background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.2)', padding: '2px 8px', borderRadius: 6 }}>
            {leads!.length} leads
          </span>
        )}
        {isLeads && (
          <button
            onClick={() => setRawView(r => !r)}
            title={rawView ? 'Ver cards' : 'Ver JSON'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 7, background: rawView ? 'rgba(10,132,255,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${rawView ? 'rgba(10,132,255,0.3)' : 'rgba(255,255,255,0.1)'}`, color: rawView ? '#0A84FF' : 'rgba(255,255,255,0.4)', fontSize: 11.5, cursor: 'pointer' }}
          >
            <Code size={12} strokeWidth={2} /> {rawView ? 'Cards' : 'JSON'}
          </button>
        )}
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 6 }}>
          {fileExt(filename).toUpperCase() || 'TXT'}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isLeads && !rawView ? '16px 18px' : '16px 20px' }}>
        {isLeads && !rawView ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {leads!.map((lead, i) => <LeadCard key={i} lead={lead} index={i} />)}
          </div>
        ) : (
          <pre style={{ color: '#c9d1d9', fontSize: 12.5, whiteSpace: 'pre-wrap', wordBreak: 'break-words', fontFamily: "'SF Mono','Fira Code','Cascadia Code',monospace", lineHeight: 1.75, margin: 0 }}>
            {isJson ? (() => { try { const s = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```[\s\S]*$/, '').trim(); return JSON.stringify(JSON.parse(s), null, 2) } catch { return content } })() : content}
          </pre>
        )}
      </div>
    </div>
  )
}

function hexToRgb(hex: string) {
  if (!hex || hex.length < 7) return '10,132,255'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

function FileIconComp({ name, isDir }: { name?: string; isDir: boolean }) {
  if (isDir) return <FolderOpen size={18} strokeWidth={1.5} style={{ color: '#0A84FF' }} />
  const ext = fileExt(name)
  if (ext === 'json') return <Braces size={18} strokeWidth={1.5} style={{ color: '#FFD60A' }} />
  if (['js', 'ts', 'py', 'sh'].includes(ext)) return <Terminal size={18} strokeWidth={1.5} style={{ color: '#BF5AF2' }} />
  if (['md', 'txt'].includes(ext)) return <FileText size={18} strokeWidth={1.5} style={{ color: '#32ADE6' }} />
  return <File size={18} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
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
  const filtered = items.filter(f => (f.name || '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ height: '100%', padding: '20px 28px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap', flexShrink: 0 }}>
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
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          >
            <RefreshCw size={14} strokeWidth={1.5} />
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gridAutoRows: '1fr', gap: 14, flex: 1, overflow: 'hidden' }}>
          {filtered.map(d => {
            const meta = DIR_META[d.name] || { icon: <Folder size={22} strokeWidth={1.4} />, color: '#0A84FF' }
            const rgb = hexToRgb(meta.color)
            return (
              <button
                key={d.name}
                onClick={() => goTo([d.name])}
                style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 18, padding: '22px 20px', textAlign: 'left', cursor: 'pointer', height: '100%', boxSizing: 'border-box',
                  display: 'flex', flexDirection: 'column',
                  transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)', position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget
                  el.style.background = `rgba(${rgb},0.08)`
                  el.style.borderColor = `rgba(${rgb},0.3)`
                  el.style.transform = 'translateY(-3px)'
                  el.style.boxShadow = `0 8px 24px rgba(${rgb},0.15)`
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget
                  el.style.background = 'rgba(255,255,255,0.03)'
                  el.style.borderColor = 'rgba(255,255,255,0.07)'
                  el.style.transform = 'none'
                  el.style.boxShadow = 'none'
                }}
              >
                <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle, rgba(${rgb},0.12) 0%, transparent 70%)`, pointerEvents: 'none' }} />
                <div style={{ color: meta.color, marginBottom: 'auto', display: 'flex', paddingBottom: 16 }}>{meta.icon}</div>
                <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, margin: '0 0 5px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</p>
                <p style={{ margin: 0, fontSize: 11.5, fontWeight: 500, color: `rgba(${rgb},0.85)` }}>
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

          {filtered.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 130px', padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nome</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right', paddingRight: 20 }}>Tamanho</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Modificado</span>
            </div>
          )}

          {filtered.map((f, i) => (
            <button
              key={f.name}
              onClick={() => goTo([...pathStack, f.name])}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 130px',
                alignItems: 'center', width: '100%', textAlign: 'left',
                padding: '11px 16px', cursor: 'pointer', background: 'transparent',
                border: 'none', borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <FileIconComp name={f.name} isDir={f.isDir} />
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  {f.isDir && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>Pasta</span>}
                </span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'right', paddingRight: 20 }}>
                {f.isDir ? '—' : formatSize(f.size)}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)' }}>{formatDate(f.mtime)}</span>
                <ChevronRight size={13} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
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
