import { useState } from 'react'
import { Zap, ScrollText, BarChart3 } from 'lucide-react'
import Pipelines from './Pipelines'
import Logs from './Logs'
import Relatorios from './Relatorios'

type View = 'pipelines' | 'logs' | 'relatorios'

export default function Sistema() {
  const [view, setView] = useState<View>('pipelines')

  const tabs: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: 'pipelines', label: 'Pipelines', icon: <Zap size={15} strokeWidth={1.7} /> },
    { id: 'logs', label: 'Logs', icon: <ScrollText size={15} strokeWidth={1.7} /> },
    { id: 'relatorios', label: 'Relatórios', icon: <BarChart3 size={15} strokeWidth={1.7} /> },
  ]

  return (
    <div className="page page--flush page--fit">
      <div className="page-head">
        <div>
          <h1 className="page-title">Sistema</h1>
          <p className="page-sub">Automação, logs em tempo real e relatórios do scheduler</p>
        </div>
      </div>

      <div className="row scroll" style={{ gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setView(t.id)}
            className={'btn btn--pill' + (view === t.id ? ' btn--accent-soft' : '')} style={{ flexShrink: 0 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="anim-fade" key={view} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {view === 'pipelines' && <Pipelines embedded />}
        {view === 'logs' && <Logs embedded />}
        {view === 'relatorios' && <Relatorios embedded />}
      </div>
    </div>
  )
}
