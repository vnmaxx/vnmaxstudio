import { Clock, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Aguardando() {
  const { user, logout } = useAuth()

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(16px, 4vw, 40px)',
        background: 'var(--bg)',
      }}
    >
      <div
        className="card card--pad anim-rise"
        style={{
          width: 'min(92vw, 420px)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 'var(--radius-pill)',
            background: 'color-mix(in srgb, var(--accent-orange) 16%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-orange) 30%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <Clock size={30} color="var(--accent-orange)" strokeWidth={1.5} />
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: 'clamp(18px, 3.5vw, 21px)',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
          }}
        >
          Aguardando aprovação
        </h2>

        <p
          style={{
            margin: '12px 0 0',
            fontSize: 14,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          Sua conta foi criada com o email
          {user?.email ? (
            <>
              {' '}
              <strong
                className="truncate"
                style={{
                  display: 'inline-block',
                  maxWidth: '100%',
                  verticalAlign: 'bottom',
                  color: 'var(--accent-text)',
                  fontWeight: 600,
                }}
                title={user.email}
              >
                {user.email}
              </strong>
            </>
          ) : null}
          .
        </p>

        <p
          style={{
            margin: '8px 0 0',
            fontSize: 14,
            color: 'var(--text-tertiary)',
            lineHeight: 1.6,
          }}
        >
          Um administrador precisa liberar o seu acesso. Aguarde o contato.
        </p>

        <button onClick={logout} className="btn btn--ghost" style={{ marginTop: 28 }}>
          <LogOut size={16} strokeWidth={1.5} />
          Sair
        </button>
      </div>
    </div>
  )
}
