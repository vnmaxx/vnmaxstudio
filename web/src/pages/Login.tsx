import { useState } from 'react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { Loader2, AlertCircle } from 'lucide-react'
import { auth } from '../firebase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password)
      } else {
        await createUserWithEmailAndPassword(auth, email, password)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        setError('Email ou senha incorretos.')
      } else if (msg.includes('email-already-in-use')) {
        setError('Este email já está cadastrado.')
      } else if (msg.includes('weak-password')) {
        setError('Senha muito fraca. Use ao menos 6 caracteres.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(16px, 5vw, 40px)',
        background:
          'radial-gradient(1100px 620px at 50% -12%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 62%), radial-gradient(820px 520px at 12% 112%, color-mix(in srgb, var(--accent-purple) 10%, transparent), transparent 60%), var(--bg-deep)',
      }}
    >
      <div
        className="card card--pad card--glass anim-rise"
        style={{ width: 'min(92vw, 380px)', padding: 'clamp(24px, 6vw, 36px)' }}
      >
        <div className="col" style={{ alignItems: 'center', gap: 12, marginBottom: 26 }}>
          <img
            src="/vnmax-logo.png"
            alt="VNMAX Studio"
            style={{
              width: 52,
              height: 52,
              borderRadius: 'var(--radius)',
              objectFit: 'contain',
              boxShadow: 'var(--shadow)',
            }}
          />
          <div className="col" style={{ alignItems: 'center', gap: 4, textAlign: 'center' }}>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              VNMAX Studio
            </h1>
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              {mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="col gap-4">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="voce@email.com"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="label">Senha</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {error && (
            <div
              className="row gap-2 anim-fade"
              style={{
                alignItems: 'flex-start',
                fontSize: 13,
                lineHeight: 1.4,
                color: 'var(--accent-red)',
                background: 'color-mix(in srgb, var(--accent-red) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-red) 28%, transparent)',
                padding: '10px 12px',
                borderRadius: 'var(--radius)',
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn--primary btn--lg"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spin" />
                Aguarde...
              </>
            ) : mode === 'login' ? (
              'Entrar'
            ) : (
              'Cadastrar'
            )}
          </button>
        </form>

        <p
          className="muted"
          style={{ margin: '22px 0 0', textAlign: 'center', fontSize: 13 }}
        >
          {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError('')
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-text)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              padding: 0,
            }}
          >
            {mode === 'login' ? 'Cadastrar' : 'Entrar'}
          </button>
        </p>
      </div>
    </div>
  )
}
