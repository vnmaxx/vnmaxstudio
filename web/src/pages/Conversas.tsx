import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import type { CrmLead, CrmStage } from '../types'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useContextMenu, type CtxItem } from '../components/ContextMenu'
import {
  RefreshCw, Plus, Download, Users, AtSign, Phone, Mail, Globe, X, Copy,
  Trash2, ArrowRightLeft, MessageSquarePlus, Clock, ExternalLink, MapPin, MessageCircle,
} from 'lucide-react'

const STAGE_META: Record<CrmStage, { label: string; color: string }> = {
  NOVO:        { label: 'Novo',        color: '#64D2FF' },
  CONTATADO:   { label: 'Contatado',   color: '#0A84FF' },
  RESPONDEU:   { label: 'Respondeu',   color: '#5E5CE6' },
  QUALIFICADO: { label: 'Qualificado', color: '#BF5AF2' },
  PROPOSTA:    { label: 'Proposta',    color: '#FF9F0A' },
  FECHADO:     { label: 'Fechado',     color: '#30D158' },
  PERDIDO:     { label: 'Perdido',     color: '#FF453A' },
}
const STAGE_ORDER: CrmStage[] = ['NOVO', 'CONTATADO', 'RESPONDEU', 'QUALIFICADO', 'PROPOSTA', 'FECHADO', 'PERDIDO']

function parseContato(raw?: string) {
  const parts = String(raw || '').split('/').map(s => s.trim())
  const handle = parts.find(p => p.startsWith('@')) || ''
  const phone = (String(raw || '').match(/\(?\d{2}\)?[\s-]?\d{4,5}[-\s]?\d{4}/) || [''])[0]
  const email = (String(raw || '').match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [''])[0]
  return { handle, phone, email }
}

function CanalIcon({ canal, size = 13 }: { canal: string; size?: number }) {
  if (canal === 'instagram') return <AtSign size={size} strokeWidth={2} style={{ color: 'var(--accent-purple)' }} />
  if (canal === 'whatsapp') return <MessageCircle size={size} strokeWidth={2} style={{ color: 'var(--accent-green)' }} />
  if (canal === 'email') return <Mail size={size} strokeWidth={2} style={{ color: 'var(--accent)' }} />
  return <Globe size={size} strokeWidth={2} style={{ color: 'var(--text-tertiary)' }} />
}

function timeAgo(iso?: string) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return 'agora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return `${Math.floor(diff / 86400000)}d`
}

function StageBadge({ stage }: { stage: CrmStage }) {
  const m = STAGE_META[stage]
  return (
    <span className="badge" style={{ background: `color-mix(in srgb, ${m.color} 16%, transparent)`, color: m.color }}>
      {m.label}
    </span>
  )
}

function LeadCard({ lead, onOpen, menuItems }: { lead: CrmLead; onOpen: () => void; menuItems: () => CtxItem[] }) {
  const menu = useContextMenu()
  return (
    <button className="card card--hover card--pad" onClick={onOpen} {...menu.bind(menuItems)}
      style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
        <CanalIcon canal={lead.canal} size={14} />
        <span className="truncate" style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{lead.nome}</span>
      </div>
      {lead.segmento && <span className="dim truncate" style={{ fontSize: 11.5 }}>{lead.segmento}</span>}
      <div className="row--between" style={{ marginTop: 2 }}>
        <span className="dim truncate" style={{ fontSize: 11, maxWidth: 140 }}>{lead.contato || '—'}</span>
        <span className="row dim" style={{ gap: 4, fontSize: 10.5, flexShrink: 0 }}>
          <Clock size={10} strokeWidth={1.8} /> {timeAgo(lead.atualizadoEm)}
        </span>
      </div>
    </button>
  )
}

function DetailModal({ lead, stages, onClose, onMove, onContato, onRemove }: {
  lead: CrmLead; stages: CrmStage[]; onClose: () => void
  onMove: (s: CrmStage) => void; onContato: () => void; onRemove: () => void
}) {
  const menu = useContextMenu()
  const { handle, phone, email } = parseContato(lead.contato)
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="row--between" style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div className="row" style={{ gap: 11, minWidth: 0 }}>
            <CanalIcon canal={lead.canal} size={18} />
            <div style={{ minWidth: 0 }}>
              <h2 className="truncate" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{lead.nome}</h2>
              <div className="row" style={{ gap: 7, marginTop: 4 }}>
                <StageBadge stage={lead.stage} />
                {lead.segmento && <span className="dim" style={{ fontSize: 12 }}>{lead.segmento}</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon btn-icon--sm" style={{ borderRadius: '50%' }}><X size={14} strokeWidth={2} /></button>
        </div>

        <div className="scroll" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            {handle && <a className="chip" href={`https://instagram.com/${handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-purple)', textDecoration: 'none' }}><AtSign size={12} /> {handle}</a>}
            {phone && (() => { const d = phone.replace(/\D/g, ''); const wa = d.length > 11 ? d : '55' + d; return <a className="chip" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-green)', textDecoration: 'none' }}><Phone size={12} /> {phone}</a> })()}
            {email && <a className="chip" href={`mailto:${email}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}><Mail size={12} /> {email}</a>}
            <a className="chip" href={`https://www.google.com/maps/search/${encodeURIComponent(lead.nome)}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}><MapPin size={12} /> Maps</a>
            <a className="chip" href={`https://www.google.com/search?q=${encodeURIComponent(lead.nome)}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}><ExternalLink size={12} /> Google</a>
          </div>

          {lead.observacao && (
            <div className="card card--pad" style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{lead.observacao}</div>
          )}

          <div>
            <label className="label">Mover para etapa</label>
            <div className="row wrap" style={{ gap: 6 }}>
              {stages.map(s => (
                <button key={s} onClick={() => onMove(s)} disabled={s === lead.stage}
                  className="btn btn--sm" style={{
                    background: s === lead.stage ? `color-mix(in srgb, ${STAGE_META[s].color} 18%, transparent)` : 'var(--surface-2)',
                    borderColor: s === lead.stage ? STAGE_META[s].color : 'var(--border)',
                    color: s === lead.stage ? STAGE_META[s].color : 'var(--text-secondary)', opacity: 1,
                  }}>
                  {STAGE_META[s].label}
                </button>
              ))}
            </div>
          </div>

          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn--accent-soft btn--sm" onClick={onContato}><MessageSquarePlus size={14} /> Registrar contato</button>
            <button className="btn btn--ghost btn--sm" onClick={() => menu.copy(lead.contato, 'Contato copiado')}><Copy size={14} /> Copiar contato</button>
            <div style={{ flex: 1 }} />
            <button className="btn btn--danger btn--sm" onClick={onRemove}><Trash2 size={14} /> Excluir</button>
          </div>

          <div>
            <label className="label">Histórico ({lead.historico?.length || 0})</label>
            {(!lead.historico || lead.historico.length === 0) ? (
              <p className="dim" style={{ fontSize: 12.5, margin: 0 }}>Nenhuma interação registrada ainda.</p>
            ) : (
              <div className="col" style={{ gap: 8 }}>
                {[...lead.historico].reverse().map((h, i) => (
                  <div key={i} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                    <span className="dot" style={{ marginTop: 5, background: h.tipo === 'proposta' ? 'var(--accent-orange)' : h.tipo === 'stage' ? 'var(--text-tertiary)' : 'var(--accent)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{h.texto}</p>
                      <span className="dim" style={{ fontSize: 10.5 }}>
                        {h.tipo}{h.canal ? ` · ${h.canal}` : ''} · {new Date(h.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AddModal({ onClose, onAdd }: { onClose: () => void; onAdd: (d: { nome: string; segmento: string; contato: string; canal: string }) => void }) {
  const [nome, setNome] = useState('')
  const [segmento, setSegmento] = useState('')
  const [contato, setContato] = useState('')
  const [canal, setCanal] = useState('')
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="row--between" style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Adicionar lead</h2>
          <button onClick={onClose} className="btn-icon btn-icon--sm" style={{ borderRadius: '50%' }}><X size={14} strokeWidth={2} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Nome</label><input className="input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do negócio" autoFocus /></div>
          <div><label className="label">Segmento</label><input className="input" value={segmento} onChange={e => setSegmento(e.target.value)} placeholder="Ex.: nutricionista" /></div>
          <div><label className="label">Contato</label><input className="input" value={contato} onChange={e => setContato(e.target.value)} placeholder="@handle / (11) 99999-9999 / email" /></div>
          <div>
            <label className="label">Canal</label>
            <select className="select" value={canal} onChange={e => setCanal(e.target.value)}>
              <option value="">Detectar automaticamente</option>
              <option value="instagram">Instagram</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">E-mail</option>
            </select>
          </div>
          <button className="btn btn--primary btn--lg" disabled={!nome.trim()} style={{ justifyContent: 'center' }}
            onClick={() => onAdd({ nome: nome.trim(), segmento: segmento.trim(), contato: contato.trim(), canal })}>
            <Plus size={15} /> Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Conversas() {
  const [leads, setLeads] = useState<CrmLead[]>([])
  const [stages, setStages] = useState<CrmStage[]>(STAGE_ORDER)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CrmLead | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [mobileStage, setMobileStage] = useState<CrmStage>('NOVO')
  const isMobile = useIsMobile()
  const menu = useContextMenu()

  const load = useCallback(async () => {
    try {
      const r = await api.getCrm()
      setLeads(r.leads)
      if (r.stages?.length) setStages(r.stages)
      setSelected(prev => prev ? (r.leads.find(l => l.id === prev.id) ?? prev) : prev)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 15000)
    return () => clearInterval(iv)
  }, [load])

  const moveStage = async (id: string, stage: CrmStage) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage } : l))
    setSelected(prev => prev && prev.id === id ? { ...prev, stage } : prev)
    try {
      const updated = await api.setCrmStage(id, stage)
      setLeads(prev => prev.map(l => l.id === id ? updated : l))
      setSelected(prev => prev && prev.id === id ? updated : prev)
      menu.toast(`Movido para ${STAGE_META[stage].label}`)
    } catch { menu.toast('Erro ao mover', 'error'); load() }
  }

  const importLeads = async () => {
    try { const r = await api.importCrm(); menu.toast(r.added > 0 ? `${r.added} lead(s) importado(s)` : 'Nenhum lead novo'); load() }
    catch { menu.toast('Erro ao importar', 'error') }
  }

  const registrarContato = async (id: string) => {
    const texto = await menu.prompt({ title: 'Registrar contato', message: 'O que foi conversado / enviado?', placeholder: 'Ex.: Enviei a primeira mensagem no Instagram', confirmLabel: 'Registrar' })
    if (!texto) return
    try { const lead = await api.addCrmContato(id, { tipo: 'mensagem', texto }); setLeads(prev => prev.map(l => l.id === id ? lead : l)); setSelected(s => s && s.id === id ? lead : s); menu.toast('Contato registrado') }
    catch { menu.toast('Erro ao registrar', 'error') }
  }

  const removeLead = async (id: string, nome: string) => {
    const ok = await menu.confirm({ title: 'Excluir lead', message: `Remover "${nome}" das conversas?`, danger: true, confirmLabel: 'Excluir' })
    if (!ok) return
    try { await api.deleteCrmLead(id); setLeads(prev => prev.filter(l => l.id !== id)); setSelected(null); menu.toast('Lead removido') }
    catch { menu.toast('Erro ao excluir', 'error') }
  }

  const addLead = async (d: { nome: string; segmento: string; contato: string; canal: string }) => {
    try { await api.addCrmLead(d); setAddOpen(false); menu.toast('Lead adicionado'); load() }
    catch { menu.toast('Erro ao adicionar', 'error') }
  }

  const cardMenu = (lead: CrmLead) => (): CtxItem[] => [
    { header: lead.nome },
    { label: 'Abrir', icon: <ExternalLink size={15} strokeWidth={1.8} />, onClick: () => setSelected(lead) },
    { label: 'Mover para', icon: <ArrowRightLeft size={15} strokeWidth={1.8} />, submenu: stages.map(s => ({ label: STAGE_META[s].label, onClick: () => moveStage(lead.id, s), disabled: s === lead.stage })) },
    { label: 'Registrar contato', icon: <MessageSquarePlus size={15} strokeWidth={1.8} />, onClick: () => registrarContato(lead.id) },
    { separator: true },
    { label: 'Copiar contato', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(lead.contato, 'Contato copiado') },
    { label: 'Excluir', icon: <Trash2 size={15} strokeWidth={1.8} />, danger: true, onClick: () => removeLead(lead.id, lead.nome) },
  ]

  const byStage = (s: CrmStage) => leads.filter(l => l.stage === s)
  const visibleStages = stages

  return (
    <div className="page page--flush page--fit">
      {selected && (
        <DetailModal lead={selected} stages={visibleStages} onClose={() => setSelected(null)}
          onMove={s => moveStage(selected.id, s)} onContato={() => registrarContato(selected.id)} onRemove={() => removeLead(selected.id, selected.nome)} />
      )}
      {addOpen && <AddModal onClose={() => setAddOpen(false)} onAdd={addLead} />}

      <div className="page-head">
        <div>
          <h1 className="page-title">Conversas</h1>
          <p className="page-sub">{leads.length} lead{leads.length === 1 ? '' : 's'} no pipeline</p>
        </div>
        <div className="page-head-actions">
          <button className="btn btn--ghost" onClick={importLeads}><Download size={14} /> Importar leads</button>
          <button className="btn btn--accent-soft" onClick={() => setAddOpen(true)}><Plus size={14} /> Adicionar</button>
          <button className="btn-icon" onClick={load} title="Atualizar"><RefreshCw size={15} strokeWidth={1.7} /></button>
        </div>
      </div>

      {loading ? (
        <div className="empty"><RefreshCw size={26} className="spin" /><p className="muted">Carregando...</p></div>
      ) : leads.length === 0 ? (
        <div className="empty anim-fade">
          <Users size={44} strokeWidth={1} />
          <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, margin: 0 }}>Nenhuma conversa ainda</p>
          <p className="muted" style={{ margin: 0 }}>Clique em “Importar leads” para puxar os leads encontrados pelo Growth.</p>
          <button className="btn btn--primary" style={{ marginTop: 6 }} onClick={importLeads}><Download size={14} /> Importar leads</button>
        </div>
      ) : isMobile ? (
        <div className="col gap-4" style={{ minHeight: 0 }}>
          <div className="row" style={{ gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {visibleStages.map(s => (
              <button key={s} onClick={() => setMobileStage(s)}
                className="btn btn--sm" style={{ flexShrink: 0, background: mobileStage === s ? `color-mix(in srgb, ${STAGE_META[s].color} 18%, transparent)` : 'transparent', borderColor: mobileStage === s ? STAGE_META[s].color : 'var(--border)', color: mobileStage === s ? STAGE_META[s].color : 'var(--text-secondary)' }}>
                {STAGE_META[s].label} <span className="dim">{byStage(s).length}</span>
              </button>
            ))}
          </div>
          <div className="col gap-3 scroll">
            {byStage(mobileStage).length === 0 ? (
              <p className="dim" style={{ fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhum lead em {STAGE_META[mobileStage].label}.</p>
            ) : byStage(mobileStage).map(lead => (
              <LeadCard key={lead.id} lead={lead} onOpen={() => setSelected(lead)} menuItems={cardMenu(lead)} />
            ))}
          </div>
        </div>
      ) : (
        <div className="row" style={{ gap: 12, alignItems: 'stretch', overflowX: 'auto', flex: 1, minHeight: 0, paddingBottom: 6 }}>
          {visibleStages.map(s => {
            const items = byStage(s)
            return (
              <div key={s} className="panel" style={{ width: 280, flexShrink: 0, background: 'rgba(255,255,255,0.015)' }}>
                <div className="panel-head" style={{ gap: 8 }}>
                  <span className="dot" style={{ background: STAGE_META[s].color }} />
                  <span className="panel-title">{STAGE_META[s].label}</span>
                  <span className="badge" style={{ marginLeft: 'auto' }}>{items.length}</span>
                </div>
                <div className="panel-body" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.length === 0 ? (
                    <p className="dim" style={{ fontSize: 12, textAlign: 'center', padding: '16px 8px' }}>—</p>
                  ) : items.map(lead => (
                    <LeadCard key={lead.id} lead={lead} onOpen={() => setSelected(lead)} menuItems={cardMenu(lead)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
