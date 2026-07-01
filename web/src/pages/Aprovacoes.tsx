import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import type { AprovacaoResumo, AprovacaoCompleta, CrmLead, SocialProvider } from '../types'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useContextMenu, type CtxItem } from '../components/ContextMenu'
import {
  Check,
  X,
  RefreshCw,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Eye,
  Copy,
  MessageCircle,
  Mail,
  Send,
  AtSign,
  Trash2,
  Sparkles,
  ExternalLink,
} from 'lucide-react'

function waLink(contato?: string, texto?: string) {
  const d = String(contato || '').replace(/\D/g, '')
  if (!d) return ''
  const phone = d.length > 11 ? d : '55' + d
  return `https://wa.me/${phone}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}

const CANAL_META: Record<string, { label: string; icon: typeof Mail; color: string }> = {
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, color: 'var(--accent-green)' },
  email: { label: 'E-mail', icon: Mail, color: 'var(--accent)' },
  telegram: { label: 'Telegram', icon: Send, color: '#3aa9ee' },
  instagram: { label: 'Instagram', icon: AtSign, color: 'var(--accent-purple)' },
}

function MensagemPendente({ lead, providers, onDone }: { lead: CrmLead; providers: SocialProvider[]; onDone: (l: CrmLead) => void }) {
  const menu = useContextMenu()
  const r = lead.rascunho!
  const [texto, setTexto] = useState(r.mensagem)
  const [recipient, setRecipient] = useState(lead.contato)
  const [enviando, setEnviando] = useState(false)

  const temFone = !!waLink(lead.contato)
  const conectados = new Set(providers.filter(p => p.connected).map(p => p.canal))
  const canais: string[] = []
  if (temFone || conectados.has('whatsapp')) canais.push('whatsapp')
  if (conectados.has('email') || /@[\w.-]+\.\w+/.test(lead.contato)) canais.push('email')
  if (conectados.has('telegram')) canais.push('telegram')
  if (conectados.has('instagram') || conectados.has('facebook')) canais.push('instagram')
  if (!canais.length) canais.push(lead.canal || 'whatsapp')
  const inicial = canais.includes(lead.canal) ? lead.canal : canais[0]
  const [canal, setCanal] = useState(inicial)

  const apiPronta = (c: string) => c === 'whatsapp' ? temFone : conectados.has(c) || (c === 'instagram' && conectados.has('facebook'))

  const enviar = async () => {
    if (!texto.trim()) { menu.toast('Mensagem vazia', 'error'); return }
    setEnviando(true)
    try {
      if (canal === 'whatsapp' && !conectados.has('whatsapp')) {
        const link = waLink(recipient, texto)
        if (!link) { menu.toast('Sem telefone para WhatsApp', 'error'); setEnviando(false); return }
        window.open(link, '_blank', 'noopener')
        const res = await api.enviarMensagem(lead.id, { texto, modo: 'whatsapp', canal: 'whatsapp', recipient })
        if (res.lead) onDone(res.lead)
        menu.toast('WhatsApp aberto — mensagem registrada como enviada')
      } else {
        const res = await api.enviarMensagem(lead.id, { texto, canal, recipient, assunto: r.assunto })
        if (res.ok) { if (res.lead) onDone(res.lead); menu.toast('Mensagem enviada ao cliente') }
        else menu.toast(res.error || 'Falhou — confira a conexão desse canal em Configurações', 'error')
      }
    } catch (e: unknown) { menu.toast(e instanceof Error ? e.message : 'Erro ao enviar', 'error') }
    finally { setEnviando(false) }
  }

  const marcarEnviada = async () => {
    try {
      await api.addCrmContato(lead.id, { tipo: 'mensagem', canal, texto })
      const l = await api.descartarRascunho(lead.id)
      onDone(l); menu.toast('Marcada como enviada')
    } catch { menu.toast('Erro ao registrar', 'error') }
  }

  const descartar = async () => {
    const ok = await menu.confirm({ title: 'Descartar mensagem', message: `Descartar a mensagem de ${lead.nome}?`, danger: true, confirmLabel: 'Descartar' })
    if (!ok) return
    try { const l = await api.descartarRascunho(lead.id); onDone(l); menu.toast('Descartada') }
    catch { menu.toast('Erro ao descartar', 'error') }
  }

  const preview = canal === 'whatsapp'
    ? (conectados.has('whatsapp') ? 'Envio automático via WhatsApp Cloud' : `Abre a conversa em wa.me/${(waLink(recipient) || '').split('/').pop()}`)
    : canal === 'email' ? `E-mail para ${recipient}`
    : canal === 'telegram' ? `Telegram via bot para ${recipient}`
    : `DM no Instagram para ${recipient} (só responde quem já te chamou)`

  return (
    <div className="card card--pad col" style={{ gap: 12 }}>
      <div className="row--between" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 9, minWidth: 0 }}>
          <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}><Sparkles size={11} /> 1ª mensagem</span>
          <span className="truncate" style={{ fontSize: 14, fontWeight: 700 }}>{lead.nome}</span>
          {lead.segmento && <span className="dim truncate" style={{ fontSize: 12 }}>· {lead.segmento}</span>}
        </div>
        <button className="btn-icon btn-icon--sm" title="Descartar" onClick={descartar} style={{ color: 'var(--accent-red)', flexShrink: 0 }}><Trash2 size={13} /></button>
      </div>

      {r.assunto && <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600 }}>Assunto: {r.assunto}</p>}
      <textarea className="textarea" value={texto} onChange={e => setTexto(e.target.value)} rows={4} style={{ resize: 'vertical', fontSize: 13, lineHeight: 1.55 }} />

      <div>
        <label className="label">Como enviar (escolha o canal)</label>
        <div className="row wrap" style={{ gap: 6 }}>
          {canais.map(c => {
            const m = CANAL_META[c] || CANAL_META.whatsapp
            const Ico = m.icon
            const ativo = canal === c
            const pronto = apiPronta(c) || (c === 'whatsapp')
            return (
              <button key={c} onClick={() => setCanal(c)}
                className={'btn btn--pill btn--sm' + (ativo ? ' btn--accent-soft' : '')}
                style={{ opacity: pronto ? 1 : 0.6 }}
                title={pronto ? '' : 'Canal não conectado — conecte em Configurações › Conexões'}>
                <Ico size={13} style={{ color: m.color }} /> {m.label}{!pronto ? ' (off)' : ''}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="label">Destino</label>
        <input className="input" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="telefone / e-mail / @handle" />
        <p className="dim row" style={{ fontSize: 11.5, gap: 6, margin: '6px 0 0' }}><ExternalLink size={12} /> {preview}</p>
      </div>

      <div className="row wrap" style={{ gap: 7 }}>
        <button className="btn btn--primary btn--sm" onClick={enviar} disabled={enviando}>
          {enviando ? <Loader2 size={13} className="spin" /> : <Check size={13} />} Aprovar e enviar
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => menu.copy(texto, 'Mensagem copiada')}><Copy size={13} /> Copiar</button>
        <button className="btn btn--ghost btn--sm" onClick={marcarEnviada}><Check size={13} /> Já enviei manualmente</button>
      </div>
    </div>
  )
}

function AprovacaoItem({
  item,
  onAprovar,
  onRejeitar,
}: {
  item: AprovacaoResumo
  onAprovar: (id: string) => Promise<void>
  onRejeitar: (id: string, motivo: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [full, setFull] = useState<AprovacaoCompleta | null>(null)
  const [loadingFull, setLoadingFull] = useState(false)
  const [aprovando, setAprovando] = useState(false)
  const [rejeitando, setRejeitando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [showRejeitar, setShowRejeitar] = useState(false)
  const menu = useContextMenu()

  const loadFull = async () => {
    if (full) return
    setLoadingFull(true)
    try {
      const data = await api.getPendente(item.id)
      setFull(data)
    } catch {
      setFull(null)
    } finally {
      setLoadingFull(false)
    }
  }

  const handleExpand = () => {
    if (!expanded) loadFull()
    setExpanded(e => !e)
  }

  const handleAprovar = async () => {
    const ok = await menu.confirm({ title: 'Aprovar', message: `Aprovar "${item.resumo}"?`, confirmLabel: 'Aprovar' })
    if (!ok) return
    setAprovando(true)
    try {
      await onAprovar(item.id)
    } finally {
      setAprovando(false)
    }
  }

  const handleRejeitar = async () => {
    if (!motivo.trim()) return
    setRejeitando(true)
    try {
      await onRejeitar(item.id, motivo)
    } finally {
      setRejeitando(false)
      setShowRejeitar(false)
    }
  }

  const renderContent = (content: unknown) => {
    if (content === null || content === undefined) return 'null'
    if (typeof content === 'string') return content
    return JSON.stringify(content, null, 2)
  }

  const isEmail = item.tipo.toLowerCase().includes('email')

  const menuItems = (): CtxItem[] => [
    { header: item.resumo },
    { label: 'Aprovar', icon: <Check size={15} strokeWidth={2} />, onClick: handleAprovar, disabled: aprovando },
    { label: 'Rejeitar', icon: <X size={15} strokeWidth={2} />, danger: true, onClick: () => setShowRejeitar(true) },
    { separator: true },
    { label: expanded ? 'Ocultar detalhes' : 'Ver detalhes', icon: <Eye size={15} strokeWidth={1.8} />, onClick: handleExpand },
    { label: 'Copiar ID', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(item.id, 'ID copiado') },
  ]

  return (
    <div className="card anim-rise" style={{ overflow: 'hidden' }} {...menu.bind(menuItems)}>
      <div style={{ padding: 'clamp(13px, 1.8vw, 16px)' }}>
        <div
          className="row gap-3"
          style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}
        >
          <div className="flex-1" style={{ minWidth: 0 }}>
            <div
              className="row gap-2"
              style={{ marginBottom: 7, flexWrap: 'wrap' }}
            >
              <span
                className="dot"
                style={{
                  background: isEmail
                    ? 'var(--accent)'
                    : 'var(--text-faint)',
                  boxShadow: isEmail
                    ? '0 0 7px color-mix(in srgb, var(--accent) 60%, transparent)'
                    : 'none',
                }}
              />
              <span
                className="badge"
                style={{
                  background: isEmail
                    ? 'color-mix(in srgb, var(--accent) 14%, transparent)'
                    : undefined,
                  color: isEmail ? 'var(--accent-text)' : undefined,
                }}
              >
                {item.tipo}
              </span>
              <span
                className="mono truncate hide-xs"
                style={{
                  color: 'var(--text-faint)',
                  fontSize: 11,
                  maxWidth: 180,
                }}
              >
                {item.id}
              </span>
            </div>
            <p
              className="truncate"
              style={{
                color: 'var(--text-primary)',
                fontSize: 13.5,
                fontWeight: 500,
                margin: '0 0 4px 0',
              }}
            >
              {item.resumo}
            </p>
            <p
              style={{
                color: 'var(--text-tertiary)',
                fontSize: 11.5,
                margin: 0,
              }}
            >
              {new Date(item.data).toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
              })}
            </p>
          </div>

          <div
            className="row gap-2 wrap"
            style={{ flexShrink: 0, justifyContent: 'flex-end' }}
          >
            <button
              className="btn btn--success btn--sm btn--pill"
              onClick={handleAprovar}
              disabled={aprovando}
              style={aprovando ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            >
              {aprovando ? (
                <Loader2 size={13} strokeWidth={2} className="spin" />
              ) : (
                <>
                  <Check size={13} strokeWidth={2} /> Aprovar
                </>
              )}
            </button>
            <button
              className={
                'btn btn--sm btn--pill ' +
                (showRejeitar ? 'btn--danger' : 'btn--ghost')
              }
              onClick={() => setShowRejeitar(s => !s)}
              style={
                showRejeitar
                  ? undefined
                  : {
                      color: 'var(--accent-red)',
                      borderColor:
                        'color-mix(in srgb, var(--accent-red) 30%, transparent)',
                    }
              }
            >
              <X size={13} strokeWidth={2} /> Rejeitar
            </button>
            <button
              className="btn-icon btn-icon--sm"
              onClick={handleExpand}
              title={expanded ? 'Recolher' : 'Expandir'}
            >
              {expanded ? (
                <ChevronUp size={15} strokeWidth={2} />
              ) : (
                <ChevronDown size={15} strokeWidth={2} />
              )}
            </button>
          </div>
        </div>

        {showRejeitar && (
          <div
            className="row gap-2 wrap anim-fade"
            style={{ marginTop: 11 }}
          >
            <input
              className="input flex-1"
              type="text"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Motivo da rejeição..."
              onKeyDown={e => e.key === 'Enter' && handleRejeitar()}
              style={{ minWidth: 180 }}
            />
            <button
              className="btn btn--danger"
              onClick={handleRejeitar}
              disabled={rejeitando || !motivo.trim()}
              style={
                rejeitando || !motivo.trim()
                  ? { opacity: 0.5, cursor: 'not-allowed' }
                  : undefined
              }
            >
              {rejeitando ? (
                <Loader2 size={14} strokeWidth={2} className="spin" />
              ) : (
                'Confirmar'
              )}
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div
          className="anim-fade"
          style={{
            borderTop: '1px solid var(--border)',
            background: 'rgba(0,0,0,0.32)',
            padding: 'clamp(13px, 1.8vw, 16px)',
          }}
        >
          {loadingFull ? (
            <p
              className="row gap-2"
              style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}
            >
              <Loader2 size={14} strokeWidth={2} className="spin" /> Carregando...
            </p>
          ) : full ? (
            <pre
              className="mono scroll"
              style={{
                color: 'var(--text-secondary)',
                fontSize: 11.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.7,
                margin: 0,
                maxHeight: 320,
                overflow: 'auto',
              }}
            >
              {renderContent(full.conteudo)}
            </pre>
          ) : (
            <p
              style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: 0 }}
            >
              Sem conteúdo
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function Aprovacoes({ embedded }: { embedded?: boolean } = {}) {
  const [items, setItems] = useState<AprovacaoResumo[]>([])
  const [mensagens, setMensagens] = useState<CrmLead[]>([])
  const [providers, setProviders] = useState<SocialProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [aprovandoTodos, setAprovandoTodos] = useState(false)
  const isMobile = useIsMobile()
  const menu = useContextMenu()

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => menu.toast(msg, type)

  const loadItems = useCallback(async () => {
    try {
      const [list, crm] = await Promise.all([api.getPendentes(), api.getCrm().catch(() => ({ leads: [] }))])
      setItems(list)
      setMensagens((crm.leads || []).filter(l => l.rascunho && l.rascunho.mensagem))
    } catch (e) {
      showToast('Erro ao carregar aprovações', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadItems()
    api.getSocial().then(setProviders).catch(() => {})
    const interval = setInterval(loadItems, 5000)
    return () => clearInterval(interval)
  }, [loadItems])

  const onMensagemDone = (l: CrmLead) => {
    setMensagens(prev => l.rascunho && l.rascunho.mensagem ? prev.map(m => m.id === l.id ? l : m) : prev.filter(m => m.id !== l.id))
  }

  const handleAprovar = async (id: string) => {
    try {
      await api.aprovar(id)
      setItems(prev => prev.filter(i => i.id !== id))
      showToast('Item aprovado com sucesso')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Erro ao aprovar', 'error')
    }
  }

  const handleRejeitar = async (id: string, motivo: string) => {
    try {
      await api.rejeitar(id, motivo)
      setItems(prev => prev.filter(i => i.id !== id))
      showToast('Item rejeitado')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Erro ao rejeitar', 'error')
    }
  }

  const handleAprovarTodos = async () => {
    const ok = await menu.confirm({ title: 'Aprovar todos', message: `Aprovar todos os ${items.length} itens pendentes?`, confirmLabel: 'Aprovar todos' })
    if (!ok) return
    setAprovandoTodos(true)
    try {
      await api.aprovarTodos()
      setItems([])
      showToast('Todos os itens foram aprovados')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Erro ao aprovar todos', 'error')
    } finally {
      setAprovandoTodos(false)
    }
  }

  return (
    <div className={embedded ? 'page-embed' : 'page page--flush'}>
      <div className="page-head">
        {!embedded && (
          <div>
            <h1 className="page-title">Aprovações</h1>
            <p className="page-sub">
              {items.length + mensagens.length > 0
                ? `${items.length + mensagens.length} pendente${items.length + mensagens.length > 1 ? 's' : ''}${mensagens.length > 0 ? ` · ${mensagens.length} mensagem(ns) para enviar` : ''}`
                : 'Nada pendente'}
            </p>
          </div>
        )}
        <div className="page-head-actions">
          <button
            className="btn-icon"
            onClick={loadItems}
            title="Atualizar"
          >
            <RefreshCw size={15} strokeWidth={1.75} />
          </button>
          {items.length > 1 && (
            <button
              className="btn btn--success btn--pill"
              onClick={handleAprovarTodos}
              disabled={aprovandoTodos}
              style={
                aprovandoTodos
                  ? { opacity: 0.5, cursor: 'not-allowed' }
                  : undefined
              }
            >
              {aprovandoTodos ? (
                <>
                  <Loader2 size={14} strokeWidth={2} className="spin" />
                  {isMobile ? 'Aprovando...' : 'Aprovando...'}
                </>
              ) : (
                <>
                  <Check size={14} strokeWidth={2} />
                  {isMobile ? 'Aprovar todos' : 'Aprovar Todos'}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="empty">
          <Loader2 size={30} strokeWidth={1.5} className="spin" />
          <p className="muted">Carregando...</p>
        </div>
      ) : items.length === 0 && mensagens.length === 0 ? (
        <div className="empty anim-fade">
          <CheckCircle2 size={48} strokeWidth={1} />
          <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, margin: 0 }}>
            Tudo em dia
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Nenhuma mensagem para enviar nem item aguardando aprovação.
          </p>
        </div>
      ) : (
        <div className="col gap-6">
          {mensagens.length > 0 && (
            <div className="col gap-3">
              <label className="label" style={{ margin: 0 }}>Mensagens aguardando envio ao cliente ({mensagens.length})</label>
              {mensagens.map(l => (
                <MensagemPendente key={l.id} lead={l} providers={providers} onDone={onMensagemDone} />
              ))}
            </div>
          )}
          {items.length > 0 && (
            <div className="col gap-3">
              {mensagens.length > 0 && <label className="label" style={{ margin: 0 }}>Conteúdos aguardando aprovação ({items.length})</label>}
              {items.map(item => (
                <AprovacaoItem
                  key={item.id}
                  item={item}
                  onAprovar={handleAprovar}
                  onRejeitar={handleRejeitar}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
