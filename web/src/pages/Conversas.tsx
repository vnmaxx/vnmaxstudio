import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import type { CrmLead, CrmStage } from '../types'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useContextMenu, type CtxItem } from '../components/ContextMenu'
import {
  RefreshCw, Plus, Download, Users, AtSign, Phone, Mail, Globe, X, Copy,
  Trash2, ArrowRightLeft, MessageSquarePlus, Clock, ExternalLink, MapPin, MessageCircle,
  Sparkles, Send, Loader2, Check,
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

function waLink(contato?: string, texto?: string) {
  const d = String(contato || '').replace(/\D/g, '')
  if (!d) return ''
  const phone = d.length > 11 ? d : '55' + d
  return `https://wa.me/${phone}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
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
        {lead.rascunho?.mensagem && (
          <span className="row" title="Mensagem pronta para enviar" style={{ gap: 3, flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--accent-text)', background: 'var(--accent-soft)', padding: '1px 6px', borderRadius: 999 }}>
            <Sparkles size={10} /> pronta
          </span>
        )}
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

interface Sugestao { canal?: string; etapa?: string; assunto?: string; mensagem: string; objetivo?: string; proximo_passo?: string }

function DetailModal({ lead, stages, onClose, onMove, onContato, onRemove, onLeadUpdate }: {
  lead: CrmLead; stages: CrmStage[]; onClose: () => void
  onMove: (s: CrmStage) => void; onContato: () => void; onRemove: () => void
  onLeadUpdate: (lead: CrmLead) => void
}) {
  const menu = useContextMenu()
  const { handle, phone, email } = parseContato(lead.contato)
  const [suggesting, setSuggesting] = useState(false)
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([])
  const [sendingIdx, setSendingIdx] = useState<number | null>(null)

  const sugerir = async () => {
    setSuggesting(true)
    setSugestoes([])
    try {
      const { jobId } = await api.sugerirMensagem(lead.id)
      for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 2500))
        const r = await api.getSugestao(jobId)
        if (r.status === 'done') { setSugestoes(r.mensagens || []); break }
        if (r.status === 'error') { menu.toast(r.error || 'Erro ao gerar', 'error'); break }
      }
    } catch (e: unknown) {
      menu.toast(e instanceof Error ? e.message : 'Erro ao sugerir', 'error')
    } finally {
      setSuggesting(false)
    }
  }

  const registrar = async (texto: string) => {
    try { const l = await api.addCrmContato(lead.id, { tipo: 'mensagem', canal: lead.canal, texto }); onLeadUpdate(l); menu.toast('Registrada como enviada') }
    catch { menu.toast('Erro ao registrar', 'error') }
  }

  const enviar = async (texto: string, idx: number) => {
    setSendingIdx(idx)
    try {
      const r = await api.enviarMensagem(lead.id, { texto })
      if (r.lead) onLeadUpdate(r.lead)
      if (r.ok) menu.toast('Mensagem enviada')
      else menu.toast(r.error || 'Não foi possível enviar — confira em Conexões', 'error')
    } catch (e: unknown) {
      menu.toast(e instanceof Error ? e.message : 'Erro ao enviar', 'error')
    } finally {
      setSendingIdx(null)
    }
  }

  const podeEnviarApi = ['email', 'instagram', 'facebook', 'telegram'].includes(lead.canal)

  const temTelefone = !!waLink(lead.contato)

  const enviarWhatsApp = (texto: string) => {
    const link = waLink(lead.contato, texto)
    if (!link) { menu.toast('Lead sem telefone para WhatsApp', 'error'); return }
    window.open(link, '_blank', 'noopener')
    api.enviarMensagem(lead.id, { texto, modo: 'whatsapp' })
      .then(r => { if (r.lead) onLeadUpdate(r.lead) })
      .catch(() => {})
    menu.toast('Abrindo no WhatsApp e registrando…')
  }

  const registrarRascunho = async (texto: string) => {
    try {
      await api.addCrmContato(lead.id, { tipo: 'mensagem', canal: lead.canal, texto })
      const l = await api.descartarRascunho(lead.id)
      onLeadUpdate(l); menu.toast('Registrada como enviada')
    } catch { menu.toast('Erro ao registrar', 'error') }
  }

  const descartarRascunho = async () => {
    try { const l = await api.descartarRascunho(lead.id); onLeadUpdate(l); menu.toast('Rascunho descartado') }
    catch { menu.toast('Erro ao descartar', 'error') }
  }
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
          {lead.rascunho?.mensagem && (
            <div className="card card--pad anim-fade" style={{ background: 'var(--accent-softer)', borderColor: 'var(--accent-line)' }}>
              <div className="row--between" style={{ marginBottom: 8 }}>
                <span className="row" style={{ gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--accent-text)' }}>
                  <Sparkles size={14} /> Mensagem pronta {lead.rascunho.origem === 'auto' ? '· gerada automaticamente' : '· IA'}
                </span>
                <button className="btn-icon btn-icon--sm" title="Descartar rascunho" onClick={descartarRascunho}><X size={13} strokeWidth={2} /></button>
              </div>
              <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
                {lead.rascunho.etapa && <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>{lead.rascunho.etapa}</span>}
                {lead.rascunho.canal && <span className="chip" style={{ fontSize: 10.5, padding: '2px 7px' }}>{lead.rascunho.canal}</span>}
              </div>
              {lead.rascunho.assunto && <p style={{ margin: '0 0 6px', fontSize: 12.5, fontWeight: 600 }}>Assunto: {lead.rascunho.assunto}</p>}
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{lead.rascunho.mensagem}</p>
              {lead.rascunho.objetivo && <p className="dim" style={{ fontSize: 11, margin: '8px 0 0' }}>🎯 {lead.rascunho.objetivo}</p>}
              <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                {temTelefone && (
                  <button className="btn btn--sm" style={{ background: 'color-mix(in srgb, var(--accent-green) 16%, transparent)', borderColor: 'var(--accent-green)', color: 'var(--accent-green)' }} onClick={() => enviarWhatsApp(lead.rascunho!.mensagem)}>
                    <MessageCircle size={12} /> Enviar no WhatsApp
                  </button>
                )}
                {podeEnviarApi && (
                  <button className="btn btn--primary btn--sm" onClick={() => enviar(lead.rascunho!.mensagem, -1)} disabled={sendingIdx === -1}>
                    {sendingIdx === -1 ? <Loader2 size={12} className="spin" /> : <Send size={12} />} Enviar
                  </button>
                )}
                <button className="btn btn--ghost btn--sm" onClick={() => menu.copy(lead.rascunho!.mensagem, 'Mensagem copiada')}><Copy size={12} /> Copiar</button>
                <button className="btn btn--ghost btn--sm" onClick={() => registrarRascunho(lead.rascunho!.mensagem)}><Check size={12} /> Registrar como enviada</button>
              </div>
            </div>
          )}
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
            <div className="row--between" style={{ marginBottom: 8 }}>
              <label className="label" style={{ margin: 0 }}>Mensagens sugeridas (IA)</label>
              <button className="btn btn--accent-soft btn--sm" onClick={sugerir} disabled={suggesting}>
                {suggesting ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
                {suggesting ? 'Gerando…' : 'Sugerir mensagem'}
              </button>
            </div>
            {suggesting && sugestoes.length === 0 && (
              <p className="dim" style={{ fontSize: 12.5, margin: 0 }}>O agente SDR está escrevendo a mensagem ideal para este lead… (~10-30s)</p>
            )}
            {sugestoes.length > 0 && (
              <div className="col" style={{ gap: 10 }}>
                {sugestoes.map((s, i) => (
                  <div key={i} className="card card--pad" style={{ background: 'var(--accent-softer)', borderColor: 'var(--accent-line)' }}>
                    <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
                      {s.etapa && <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>{s.etapa}</span>}
                      {s.canal && <span className="chip" style={{ fontSize: 10.5, padding: '2px 7px' }}>{s.canal}</span>}
                    </div>
                    {s.assunto && <p style={{ margin: '0 0 6px', fontSize: 12.5, fontWeight: 600 }}>Assunto: {s.assunto}</p>}
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{s.mensagem}</p>
                    {s.objetivo && <p className="dim" style={{ fontSize: 11, margin: '8px 0 0' }}>🎯 {s.objetivo}</p>}
                    <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                      {temTelefone && (
                        <button className="btn btn--sm" style={{ background: 'color-mix(in srgb, var(--accent-green) 16%, transparent)', borderColor: 'var(--accent-green)', color: 'var(--accent-green)' }} onClick={() => enviarWhatsApp(s.mensagem)}>
                          <MessageCircle size={12} /> WhatsApp
                        </button>
                      )}
                      <button className="btn btn--ghost btn--sm" onClick={() => menu.copy(s.mensagem, 'Mensagem copiada')}><Copy size={12} /> Copiar</button>
                      <button className="btn btn--ghost btn--sm" onClick={() => registrar(s.mensagem)}><Check size={12} /> Registrar como enviada</button>
                      {podeEnviarApi && (
                        <button className="btn btn--primary btn--sm" onClick={() => enviar(s.mensagem, i)} disabled={sendingIdx === i}>
                          {sendingIdx === i ? <Loader2 size={12} className="spin" /> : <Send size={12} />} Enviar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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

export default function Conversas({ embedded }: { embedded?: boolean } = {}) {
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
    try {
      const r = await api.importCrm()
      const partes = []
      if (r.added > 0) partes.push(`${r.added} novo(s)`)
      if (r.merged && r.merged > 0) partes.push(`${r.merged} duplicado(s) mesclado(s)`)
      menu.toast(partes.length ? partes.join(' · ') : 'Nenhum lead novo'); load()
    } catch { menu.toast('Erro ao importar', 'error') }
  }

  const removerDuplicados = async () => {
    try {
      const r = await api.dedupeCrm()
      menu.toast(r.removed > 0 ? `${r.removed} lead(s) duplicado(s) mesclado(s)` : 'Nenhum duplicado encontrado'); load()
    } catch { menu.toast('Erro ao remover duplicados', 'error') }
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

  const gerarLote = async () => {
    try {
      const r = await api.sdrLote()
      if (r.queued > 0) menu.toast(`${r.queued} mensagem(ns) sendo gerada(s) — aparecem em instantes`)
      else menu.toast(r.jaNaFila > 0 ? 'Os novos já estão na fila de geração' : 'Nenhum lead novo sem mensagem')
    } catch (e: unknown) { menu.toast(e instanceof Error ? e.message : 'Erro ao gerar em lote', 'error') }
  }

  const novosSemRascunho = leads.filter(l => l.stage === 'NOVO' && !l.rascunho).length

  const onLeadUpdate = (lead: CrmLead) => {
    setLeads(prev => prev.map(l => l.id === lead.id ? lead : l))
    setSelected(s => s && s.id === lead.id ? lead : s)
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
    <div className={embedded ? 'page-embed' : 'page page--flush page--fit'}>
      {selected && (
        <DetailModal lead={selected} stages={visibleStages} onClose={() => setSelected(null)}
          onMove={s => moveStage(selected.id, s)} onContato={() => registrarContato(selected.id)} onRemove={() => removeLead(selected.id, selected.nome)} onLeadUpdate={onLeadUpdate} />
      )}
      {addOpen && <AddModal onClose={() => setAddOpen(false)} onAdd={addLead} />}

      <div className="page-head">
        <div>
          <h1 className="page-title">Conversas</h1>
          <p className="page-sub">{leads.length} lead{leads.length === 1 ? '' : 's'} no pipeline</p>
        </div>
        <div className="page-head-actions">
          <button className="btn btn--ghost" onClick={importLeads}><Download size={14} /> Importar leads</button>
          <button className="btn btn--ghost" onClick={removerDuplicados} title="Mescla leads repetidos (mesmo telefone, e-mail ou @, em qualquer formato)"><Copy size={14} /> Remover duplicados</button>
          {novosSemRascunho > 0 && (
            <button className="btn btn--accent-soft" onClick={gerarLote} title="Gera a 1ª mensagem do SDR para todos os leads novos">
              <Sparkles size={14} /> Gerar 1ª msg ({novosSemRascunho})
            </button>
          )}
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
