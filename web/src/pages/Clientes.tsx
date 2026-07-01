import { useState } from 'react'
import { MessagesSquare, Film, CheckSquare, FolderSync, Loader2 } from 'lucide-react'
import Conversas from './Conversas'
import Conteudo from './Conteudo'
import Aprovacoes from './Aprovacoes'
import { usePendingCount } from '../components/Sidebar'
import { useContextMenu } from '../components/ContextMenu'
import { api } from '../api'

type View = 'pipeline' | 'producao' | 'aprovacoes'

export default function Clientes() {
  const [view, setView] = useState<View>('pipeline')
  const [clienteId, setClienteId] = useState('')
  const [syncing, setSyncing] = useState(false)
  const pending = usePendingCount()
  const menu = useContextMenu()

  const sincronizar = async () => {
    setSyncing(true)
    try {
      const r = await api.syncClientes()
      menu.toast(`${r.clientes} cliente(s) organizados em pastas no Workspace`)
    } catch (e: unknown) { menu.toast(e instanceof Error ? e.message : 'Erro ao sincronizar', 'error') }
    finally { setSyncing(false) }
  }

  const tabs: { id: View; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'pipeline', label: 'Pipeline', icon: <MessagesSquare size={15} strokeWidth={1.7} /> },
    { id: 'producao', label: 'Produção', icon: <Film size={15} strokeWidth={1.7} /> },
    { id: 'aprovacoes', label: 'Aprovações', icon: <CheckSquare size={15} strokeWidth={1.7} />, badge: pending },
  ]

  return (
    <div className="page page--flush page--fit">
      <div className="page-head">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-sub">Pipeline, produção de conteúdo e aprovações — tudo por cliente</p>
        </div>
        <div className="page-head-actions">
          <button className="btn btn--ghost" onClick={sincronizar} disabled={syncing} title="Grava os materiais e mensagens de cada cliente em pastas no Workspace">
            {syncing ? <Loader2 size={14} className="spin" /> : <FolderSync size={14} />} Sincronizar Workspace
          </button>
        </div>
      </div>

      <div className="row scroll" style={{ gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setView(t.id)}
            className={'btn btn--pill' + (view === t.id ? ' btn--accent-soft' : '')} style={{ flexShrink: 0 }}>
            {t.icon} {t.label}
            {t.badge ? <span className="badge" style={{ background: 'var(--accent-red)', color: '#fff', marginLeft: 4 }}>{t.badge}</span> : null}
          </button>
        ))}
      </div>

      <div className="anim-fade" key={view} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {view === 'pipeline' && <Conversas embedded />}
        {view === 'producao' && <Conteudo embedded clienteId={clienteId} onClienteChange={setClienteId} />}
        {view === 'aprovacoes' && <Aprovacoes embedded />}
      </div>
    </div>
  )
}
