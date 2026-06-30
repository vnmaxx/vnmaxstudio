import { useEffect, useState } from 'react'
import { collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { CheckCircle2, Clock, UserCheck, Users, RefreshCw, Loader2, ShieldOff, Copy } from 'lucide-react'
import { useContextMenu, type CtxItem } from '../components/ContextMenu'

interface UsuarioFirestore {
  uid: string
  email: string
  displayName: string
  approved: boolean
  createdAt: unknown
}

export default function Admin() {
  const [usuarios, setUsuarios] = useState<UsuarioFirestore[]>([])
  const [loading, setLoading] = useState(true)
  const menu = useContextMenu()

  async function carregar() {
    setLoading(true)
    const snap = await getDocs(collection(db, 'users'))
    const lista: UsuarioFirestore[] = snap.docs.map(d => ({ uid: d.id, ...(d.data() as Omit<UsuarioFirestore, 'uid'>) }))
    lista.sort((a, b) => (a.approved === b.approved ? 0 : a.approved ? 1 : -1))
    setUsuarios(lista)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function aprovar(uid: string) {
    await updateDoc(doc(db, 'users', uid), { approved: true, approvedAt: serverTimestamp() })
    setUsuarios(prev => prev.map(u => u.uid === uid ? { ...u, approved: true } : u))
  }

  async function revogar(uid: string) {
    await updateDoc(doc(db, 'users', uid), { approved: false })
    setUsuarios(prev => prev.map(u => u.uid === uid ? { ...u, approved: false } : u))
  }

  const pendentes = usuarios.filter(u => !u.approved && u.email !== 'admin@studioia.com')
  const aprovados = usuarios.filter(u => u.approved && u.email !== 'admin@studioia.com')

  function UsuarioCard({ u, acao }: { u: UsuarioFirestore; acao: 'aprovar' | 'revogar' }) {
    const inicial = (u.displayName || u.email || '?').trim().charAt(0).toUpperCase()
    const cardMenu = (): CtxItem[] => {
      const items: CtxItem[] = [{ header: u.email }]
      if (acao === 'aprovar') items.push({ label: 'Aprovar', icon: <UserCheck size={15} strokeWidth={1.8} />, onClick: () => aprovar(u.uid) })
      else items.push({ label: 'Revogar acesso', icon: <ShieldOff size={15} strokeWidth={1.8} />, danger: true, onClick: () => revogar(u.uid) })
      items.push({ separator: true })
      items.push({ label: 'Copiar email', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(u.email, 'Email copiado') })
      if (u.displayName) items.push({ label: 'Copiar nome', icon: <Copy size={15} strokeWidth={1.8} />, onClick: () => menu.copy(u.displayName, 'Nome copiado') })
      return items
    }
    return (
      <div className="card card--pad anim-rise" {...menu.bind(cardMenu)}>
        <div className="row row--between gap-3 wrap" style={{ alignItems: 'center' }}>
          <div className="row gap-3 flex-1" style={{ minWidth: 0, alignItems: 'center' }}>
            <div
              className="center"
              style={{
                width: 38,
                height: 38,
                flexShrink: 0,
                borderRadius: 'var(--radius-pill)',
                background: acao === 'aprovar'
                  ? 'color-mix(in srgb, var(--accent-orange) 16%, transparent)'
                  : 'color-mix(in srgb, var(--accent-green) 16%, transparent)',
                color: acao === 'aprovar' ? 'var(--accent-orange)' : 'var(--accent-green)',
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {inicial}
            </div>
            <div className="col" style={{ minWidth: 0, gap: 2 }}>
              <p className="truncate" style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                {u.email}
              </p>
              {u.displayName && (
                <p className="truncate" style={{ margin: 0, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                  {u.displayName}
                </p>
              )}
            </div>
          </div>

          {acao === 'aprovar' ? (
            <button className="btn btn--success btn--sm btn--pill" onClick={() => aprovar(u.uid)}>
              <UserCheck size={14} strokeWidth={1.75} />
              Aprovar
            </button>
          ) : (
            <button className="btn btn--ghost btn--sm btn--pill" onClick={() => revogar(u.uid)}>
              <ShieldOff size={14} strokeWidth={1.75} />
              Revogar
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Gerenciar Usuários</h1>
          <p className="page-sub">
            {usuarios.length} conta{usuarios.length === 1 ? '' : 's'} registrada{usuarios.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="page-head-actions">
          <button className="btn-icon" onClick={carregar} title="Atualizar" disabled={loading}>
            {loading
              ? <Loader2 size={15} strokeWidth={1.75} className="spin" />
              : <RefreshCw size={15} strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty">
          <Loader2 size={30} strokeWidth={1.5} className="spin" />
          <p className="muted">Carregando...</p>
        </div>
      ) : pendentes.length === 0 && aprovados.length === 0 ? (
        <div className="empty anim-fade">
          <Users size={48} strokeWidth={1} />
          <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, margin: 0 }}>
            Nenhum usuário cadastrado
          </p>
          <p className="muted" style={{ margin: 0 }}>
            As contas registradas aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="col gap-6">
          {pendentes.length > 0 && (
            <section className="col gap-3">
              <div className="row gap-2" style={{ alignItems: 'center' }}>
                <Clock size={15} strokeWidth={1.75} style={{ color: 'var(--accent-orange)' }} />
                <span className="label" style={{ color: 'var(--accent-orange)' }}>
                  Aguardando aprovação
                </span>
                <span className="badge" style={{
                  background: 'color-mix(in srgb, var(--accent-orange) 16%, transparent)',
                  color: 'var(--accent-orange)',
                }}>
                  {pendentes.length}
                </span>
              </div>
              <div className="col gap-2">
                {pendentes.map(u => (
                  <UsuarioCard key={u.uid} u={u} acao="aprovar" />
                ))}
              </div>
            </section>
          )}

          {aprovados.length > 0 && (
            <section className="col gap-3">
              <div className="row gap-2" style={{ alignItems: 'center' }}>
                <CheckCircle2 size={15} strokeWidth={1.75} style={{ color: 'var(--accent-green)' }} />
                <span className="label" style={{ color: 'var(--accent-green)' }}>
                  Aprovados
                </span>
                <span className="badge" style={{
                  background: 'color-mix(in srgb, var(--accent-green) 16%, transparent)',
                  color: 'var(--accent-green)',
                }}>
                  {aprovados.length}
                </span>
              </div>
              <div className="col gap-2">
                {aprovados.map(u => (
                  <UsuarioCard key={u.uid} u={u} acao="revogar" />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
