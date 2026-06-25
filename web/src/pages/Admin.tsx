import { useEffect, useState } from 'react'
import { collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { CheckCircle, Clock, UserCheck } from 'lucide-react'

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

  return (
    <div style={{ padding: '32px 24px', maxWidth: 700 }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>Gerenciar Usuários</h1>
      <p style={{ margin: '0 0 32px', color: 'var(--text-secondary)', fontSize: 14 }}>{usuarios.length} conta(s) registrada(s)</p>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>
      ) : (
        <>
          {pendentes.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Clock size={16} color="#FF9F0A" strokeWidth={1.5} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#FF9F0A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aguardando aprovação ({pendentes.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendentes.map(u => (
                  <div key={u.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{u.email}</p>
                      {u.displayName && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>{u.displayName}</p>}
                    </div>
                    <button
                      onClick={() => aprovar(u.uid)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(48,209,88,0.15)', border: '1px solid rgba(48,209,88,0.3)', borderRadius: 8, color: '#30D158', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                    >
                      <UserCheck size={14} strokeWidth={1.5} />
                      Aprovar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {aprovados.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <CheckCircle size={16} color="#30D158" strokeWidth={1.5} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#30D158', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aprovados ({aprovados.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {aprovados.map(u => (
                  <div key={u.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{u.email}</p>
                      {u.displayName && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>{u.displayName}</p>}
                    </div>
                    <button
                      onClick={() => revogar(u.uid)}
                      style={{ padding: '7px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}
                    >
                      Revogar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendentes.length === 0 && aprovados.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Nenhum usuário cadastrado ainda.</p>
          )}
        </>
      )}
    </div>
  )
}
