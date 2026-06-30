import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import type { AprovacaoResumo, AprovacaoCompleta } from '../types'
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
} from 'lucide-react'

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

export default function Aprovacoes() {
  const [items, setItems] = useState<AprovacaoResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [aprovandoTodos, setAprovandoTodos] = useState(false)
  const isMobile = useIsMobile()
  const menu = useContextMenu()

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => menu.toast(msg, type)

  const loadItems = useCallback(async () => {
    try {
      const list = await api.getPendentes()
      setItems(list)
    } catch (e) {
      showToast('Erro ao carregar aprovações', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadItems()
    const interval = setInterval(loadItems, 5000)
    return () => clearInterval(interval)
  }, [loadItems])

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
    <div className="page page--flush">
      <div className="page-head">
        <div>
          <h1 className="page-title">Aprovações</h1>
          <p className="page-sub">
            {items.length > 0
              ? `${items.length} item${items.length > 1 ? 's' : ''} aguardando`
              : 'Nada pendente'}
          </p>
        </div>
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
      ) : items.length === 0 ? (
        <div className="empty anim-fade">
          <CheckCircle2 size={48} strokeWidth={1} />
          <p
            style={{
              color: 'var(--text-primary)',
              fontSize: 16,
              fontWeight: 600,
              margin: 0,
            }}
          >
            Tudo aprovado
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Nenhum item aguardando aprovação.
          </p>
        </div>
      ) : (
        <div className="col gap-3">
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
  )
}
