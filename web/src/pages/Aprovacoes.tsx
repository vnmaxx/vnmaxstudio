import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import type { AprovacaoResumo, AprovacaoCompleta } from '../types'
import { Check, X, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react'

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 100,
        background: 'rgba(20,20,22,0.95)',
        border: `1px solid rgba(255,255,255,0.12)`,
        borderLeft: `3px solid ${type === 'success' ? '#30D158' : '#FF453A'}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 12,
        padding: '12px 16px',
        fontSize: 13,
        color: 'var(--text-primary)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        fontWeight: 500,
      }}
    >
      {msg}
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

  const loadFull = async () => {
    if (full) return
    setLoadingFull(true)
    try {
      const data = await api.getPendente(item.id)
      setFull(data)
    } catch {
      // ignore
    } finally {
      setLoadingFull(false)
    }
  }

  const handleExpand = () => {
    if (!expanded) loadFull()
    setExpanded(e => !e)
  }

  const handleAprovar = async () => {
    if (!confirm(`Aprovar "${item.resumo}"?`)) return
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

  const tipoDot = item.tipo.toLowerCase().includes('email')
    ? '#0A84FF'
    : 'rgba(255,255,255,0.3)'

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          {/* Left info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: tipoDot,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  background: 'rgba(10,132,255,0.12)',
                  color: '#0A84FF',
                  border: '1px solid rgba(10,132,255,0.2)',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: 6,
                }}
              >
                {item.tipo}
              </span>
              <span
                style={{
                  color: 'var(--text-tertiary)',
                  fontSize: 11,
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.id}
              </span>
            </div>
            <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.resumo}
            </p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 11, margin: 0 }}>
              {new Date(item.data).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              onClick={handleAprovar}
              disabled={aprovando}
              style={{
                background: 'rgba(48,209,88,0.15)',
                border: '1px solid rgba(48,209,88,0.25)',
                color: '#30D158',
                padding: '6px 12px',
                borderRadius: 980,
                fontSize: 12,
                fontWeight: 600,
                cursor: aprovando ? 'not-allowed' : 'pointer',
                opacity: aprovando ? 0.5 : 1,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {aprovando
                ? <Loader2 size={12} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
                : <><Check size={12} strokeWidth={2} /> Aprovar</>
              }
            </button>
            <button
              onClick={() => setShowRejeitar(s => !s)}
              style={{
                background: showRejeitar ? 'rgba(255,69,58,0.15)' : 'transparent',
                border: '1px solid rgba(255,69,58,0.25)',
                color: '#FF453A',
                padding: '6px 12px',
                borderRadius: 980,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <X size={12} strokeWidth={2} /> Rejeitar
            </button>
            <button
              onClick={handleExpand}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-secondary)',
                padding: '6px 10px',
                borderRadius: 8,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {expanded ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* Reject input */}
        {showRejeitar && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Motivo da rejeição..."
              onKeyDown={e => e.key === 'Enter' && handleRejeitar()}
              style={{
                flex: 1,
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                color: 'var(--text-primary)',
                padding: '8px 12px',
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
              }}
              onFocus={e => {
                (e.target as HTMLInputElement).style.borderColor = 'var(--accent)'
              }}
              onBlur={e => {
                (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.1)'
              }}
            />
            <button
              onClick={handleRejeitar}
              disabled={rejeitando || !motivo.trim()}
              style={{
                background: 'rgba(255,69,58,0.15)',
                border: '1px solid rgba(255,69,58,0.3)',
                color: '#FF453A',
                padding: '8px 16px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: rejeitando || !motivo.trim() ? 'not-allowed' : 'pointer',
                opacity: rejeitando || !motivo.trim() ? 0.5 : 1,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {rejeitando
                ? <Loader2 size={13} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
                : 'Confirmar'
              }
            </button>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(0,0,0,0.4)',
            padding: 16,
          }}
        >
          {loadingFull ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>Carregando...</p>
          ) : full ? (
            <pre
              style={{
                color: 'var(--text-secondary)',
                fontSize: 11.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-words',
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                lineHeight: 1.7,
                margin: 0,
                maxHeight: 320,
                overflow: 'auto',
              }}
            >
              {renderContent(full.conteudo)}
            </pre>
          ) : (
            <p style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: 0 }}>Sem conteúdo</p>
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
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

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
    if (!confirm(`Aprovar todos os ${items.length} itens pendentes?`)) return
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
    <div className="h-full flex flex-col overflow-hidden" style={{ padding: '20px 24px', gap: 16 }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 600, margin: 0, lineHeight: 1 }}>
            Aprovações
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '4px 0 0 0' }}>
            {items.length > 0 ? `${items.length} item${items.length > 1 ? 's' : ''} aguardando` : 'Nada pendente'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={loadItems}
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
          {items.length > 1 && (
            <button
              onClick={handleAprovarTodos}
              disabled={aprovandoTodos}
              style={{
                background: 'rgba(48,209,88,0.15)',
                border: '1px solid rgba(48,209,88,0.3)',
                color: '#30D158',
                padding: '8px 16px',
                borderRadius: 980,
                fontSize: 13,
                fontWeight: 600,
                cursor: aprovandoTodos ? 'not-allowed' : 'pointer',
                opacity: aprovandoTodos ? 0.5 : 1,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {aprovandoTodos
                ? <><Loader2 size={13} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} /> Aprovando...</>
                : <><Check size={13} strokeWidth={2} /> Aprovar Todos</>
              }
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Carregando...</span>
        </div>
      ) : items.length === 0 ? (
        <div
          className="flex-1 flex items-center justify-center"
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20,
              padding: '48px 64px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
              <CheckCircle2 size={48} strokeWidth={1} style={{ opacity: 0.3 }} />
            </div>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, margin: '0 0 8px 0' }}>
              Tudo aprovado
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
              Nenhum item aguardando aprovação.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
