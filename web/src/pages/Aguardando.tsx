import { Clock, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Aguardando() {
  const { user, logout } = useAuth()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <div style={{ width: 400, padding: 40, background: 'var(--bg-secondary)', borderRadius: 16, border: '1px solid var(--border)', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,159,10,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <Clock size={28} color="#FF9F0A" strokeWidth={1.5} />
        </div>
        <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>Aguardando aprovação</h2>
        <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Sua conta foi criada com o email <strong style={{ color: 'var(--text-primary)' }}>{user?.email}</strong>.
        </p>
        <p style={{ margin: '0 0 32px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Um administrador precisa liberar o seu acesso. Aguarde o contato.
        </p>
        <button
          onClick={logout}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}
        >
          <LogOut size={16} strokeWidth={1.5} />
          Sair
        </button>
      </div>
    </div>
  )
}
