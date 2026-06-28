import { useEffect, useState } from 'react'
import { 
  TrendingUp, Users, Handshake, AlertCircle, CheckCircle, XCircle, 
  Play, Pause, RefreshCw, DollarSign, Target, Zap, Clock, ChevronRight,
  BarChart3, Activity, ArrowUpRight, ArrowDownRight
} from 'lucide-react'

interface PipelineItem {
  id: string
  nome?: string
  status: string
  proximo_agente: string
  prioridade: number
  atualizadoEm?: string
}

interface HistoricoItem {
  id: string
  agente: string
  acao: string
  timestamp: string
}

interface EventoItem {
  event: string
  data: Record<string, unknown>
  timestamp: string
}

interface CEOStats {
  receita: number
  leads: number
  leadsQualificados: number
  clientes: number
  clientesAtivos: number
  pendencias: number
  pipeline: PipelineItem[]
  historico: HistoricoItem[]
  eventos: EventoItem[]
}

export default function CEO() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<CEOStats>({
    receita: 0,
    leads: 0,
    leadsQualificados: 0,
    clientes: 0,
    clientesAtivos: 0,
    pendencias: 0,
    pipeline: [],
    historico: [],
    eventos: []
  })
  const [pipelineMode, setPipelineMode] = useState(false)

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    setLoading(true)
    try {
      // Tenta carregar do orchestrator API
      const response = await fetch('/api/orchestrator/status')
      if (response.ok) {
        const data = await response.json()
        setStats(prev => ({
          ...prev,
          pipeline: data.pipeline || [],
          historico: data.historico || [],
          eventos: data.eventos || []
        }))
      }
      
      // Carrega pendências
      const pendRes = await fetch('/api/pendentes')
      if (pendRes.ok) {
        const pendencias = await pendRes.json()
        setStats(prev => ({ ...prev, pendencias: pendencias.length || 0 }))
      }
      
      // Carrega stats gerais
      const statsRes = await fetch('/api/stats')
      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(prev => ({
          ...prev,
          leads: data.counts?.leads || 0,
          receita: 0, // Será preenchido pelos dados
          clientes: data.counts?.clientes || 0
        }))
      }
    } catch (e) {
      console.error('Erro ao carregar dados:', e)
    } finally {
      setLoading(false)
    }
  }

  async function iniciarPipeline() {
    setPipelineMode(true)
    try {
      await fetch('/api/orchestrator/run', { method: 'POST' })
      // Recarrega após executar
      setTimeout(carregarDados, 3000)
    } catch (e) {
      console.error('Erro ao iniciar pipeline:', e)
      setPipelineMode(false)
    }
  }

  const statusColors: Record<string, string> = {
    'novo': '#0A84FF',
    'qualificado': '#30D158',
    'proposta_criada': '#FFD60A',
    'landing_pronta': '#BF5AF2',
    'campanha_criada': '#FF375F',
    'cliente_fechado': '#32D74B',
    'concluido': '#64D2FF'
  }

  const agenteColors: Record<string, string> = {
    'Growth': '#0A84FF',
    'Clientes': '#FFD60A',
    'Criacao': '#BF5AF2',
    'Trafego': '#FF375F',
    'Dados': '#30D158',
    'CEO': '#64D2FF'
  }

  if (loading) {
    return (
      <div style={{ 
        height: '100%', display: 'flex', alignItems: 'center', 
        justifyContent: 'center', flexDirection: 'column', gap: 16 
      }}>
        <RefreshCw size={32} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--accent)' }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Carregando dashboard CEO...</span>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', padding: '24px 28px', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 700, margin: 0 }}>
            Dashboard CEO
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '6px 0 0 0' }}>
            Visão estratégica do Agency OS
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={carregarDados}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 10,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} /> Atualizar
          </button>
          <button
            onClick={iniciarPipeline}
            disabled={pipelineMode}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 10,
              background: pipelineMode ? 'rgba(48,209,88,0.15)' : 'rgba(48,209,88,0.1)',
              border: `1px solid ${pipelineMode ? 'rgba(48,209,88,0.3)' : 'rgba(48,209,88,0.2)'}`,
              color: '#30D158', fontSize: 13, cursor: pipelineMode ? 'default' : 'pointer'
            }}
          >
            {pipelineMode ? (
              <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Executando...</>
            ) : (
              <><Play size={14} /> Executar Pipeline</>
            )}
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {/* Receita */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '20px 22px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ 
              width: 40, height: 40, borderRadius: 10, background: 'rgba(48,209,88,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <DollarSign size={20} style={{ color: '#30D158' }} />
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>Receita</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: 'var(--text-primary)', fontSize: 28, fontWeight: 700 }}>
              R$ {stats.receita.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
            </span>
          </div>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>Este mês</span>
        </div>

        {/* Leads */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '20px 22px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ 
              width: 40, height: 40, borderRadius: 10, background: 'rgba(10,132,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Users size={20} style={{ color: '#0A84FF' }} />
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>Leads</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: 'var(--text-primary)', fontSize: 28, fontWeight: 700 }}>
              {stats.leads}
            </span>
          </div>
          <span style={{ color: '#30D158', fontSize: 11 }}>
            {stats.leadsQualificados} qualificados
          </span>
        </div>

        {/* Clientes */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '20px 22px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ 
              width: 40, height: 40, borderRadius: 10, background: 'rgba(255,214,10,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Handshake size={20} style={{ color: '#FFD60A' }} />
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>Clientes</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: 'var(--text-primary)', fontSize: 28, fontWeight: 700 }}>
              {stats.clientes}
            </span>
          </div>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
            {stats.clientesAtivos} ativos
          </span>
        </div>

        {/* Pendências */}
        <div style={{
          background: stats.pendencias > 0 ? 'rgba(255,69,58,0.05)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${stats.pendencias > 0 ? 'rgba(255,69,58,0.15)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: 16, padding: '20px 22px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ 
              width: 40, height: 40, borderRadius: 10, 
              background: stats.pendencias > 0 ? 'rgba(255,69,58,0.1)' : 'rgba(100,210,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <AlertCircle size={20} style={{ color: stats.pendencias > 0 ? '#FF453A' : '#64D2FF' }} />
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>Pendências</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ 
              color: stats.pendencias > 0 ? '#FF453A' : 'var(--text-primary)', 
              fontSize: 28, fontWeight: 700 
            }}>
              {stats.pendencias}
            </span>
          </div>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>Aprovações</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        {/* Pipeline de Leads */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16, overflow: 'hidden'
        }}>
          <div style={{ 
            padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Activity size={18} style={{ color: 'var(--accent)' }} />
              <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>
                Pipeline de Leads
              </span>
            </div>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
              {stats.pipeline.length} em andamento
            </span>
          </div>

          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {stats.pipeline.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <Target size={32} style={{ color: 'rgba(255,255,255,0.1)', marginBottom: 12 }} />
                <p style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: 0 }}>
                  Nenhum lead no pipeline ainda
                </p>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 11, margin: '8px 0 0 0' }}>
                  Execute o pipeline para gerar leads automaticamente
                </p>
              </div>
            ) : (
              stats.pipeline.map((item, i) => (
                <div
                  key={item.id}
                  style={{
                    padding: '14px 20px',
                    borderBottom: i < stats.pipeline.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    display: 'flex', alignItems: 'center', gap: 14
                  }}
                >
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: statusColors[item.status] || '#64D2FF',
                    flexShrink: 0
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.nome || item.id.slice(0, 20)}
                      </span>
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 4,
                        background: `${agenteColors[item.proximo_agente]}20`,
                        color: agenteColors[item.proximo_agente]
                      }}>
                        {item.proximo_agente}
                      </span>
                    </div>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                      {item.status.replace('_', ' ')} • Prioridade {item.prioridade}
                    </span>
                  </div>
                  <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.2)' }} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Aprovações Pendentes */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16, overflow: 'hidden'
        }}>
          <div style={{ 
            padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <AlertCircle size={18} style={{ color: '#FF453A' }} />
            <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>
              Ações Necessárias
            </span>
          </div>

          <div style={{ padding: 16 }}>
            {stats.pendencias === 0 ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <CheckCircle size={32} style={{ color: '#30D158', marginBottom: 12 }} />
                <p style={{ color: 'var(--text-primary)', fontSize: 13, margin: 0 }}>
                  Tudo approved!
                </p>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 11, margin: '6px 0 0 0' }}>
                  Nenhuma ação pendente
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{
                  background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.15)',
                  borderRadius: 12, padding: '14px 16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ 
                      width: 6, height: 6, borderRadius: '50%', background: '#FF453A'
                    }} />
                    <span style={{ color: '#FF453A', fontSize: 12, fontWeight: 600 }}>
                      Aprovar preço da oferta
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '0 0 12px 0' }}>
                    Proposta para cliente Renova Clínica
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{
                      flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12,
                      background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.2)',
                      color: '#30D158', cursor: 'pointer', fontWeight: 500
                    }}>
                      Aprovar
                    </button>
                    <button style={{
                      flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-primary)', cursor: 'pointer'
                    }}>
                      Editar
                    </button>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.15)',
                  borderRadius: 12, padding: '14px 16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ 
                      width: 6, height: 6, borderRadius: '50%', background: '#FF453A'
                    }} />
                    <span style={{ color: '#FF453A', fontSize: 12, fontWeight: 600 }}>
                      Aprovar garantia
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '0 0 12px 0' }}>
                    Termo de garantia para Dental Pro
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{
                      flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12,
                      background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.2)',
                      color: '#30D158', cursor: 'pointer', fontWeight: 500
                    }}>
                      Aprovar
                    </button>
                    <button style={{
                      flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-primary)', cursor: 'pointer'
                    }}>
                      Editar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline de Eventos Recentes */}
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16, overflow: 'hidden', marginTop: 24
      }}>
        <div style={{ 
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <Clock size={18} style={{ color: 'var(--accent)' }} />
          <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>
            Eventos Recentes
          </span>
        </div>

        <div style={{ padding: 16 }}>
          {stats.eventos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: 0 }}>
                Nenhum evento registrado ainda
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {stats.eventos.slice(0, 8).map((evento, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '10px 0',
                    borderBottom: i < 7 ? '1px solid rgba(255,255,255,0.04)' : 'none'
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#64D2FF', flexShrink: 0
                  }} />
                  <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 500, minWidth: 140 }}>
                    {evento.event}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12, flex: 1 }}>
                    {JSON.stringify(evento.data).slice(0, 60)}...
                  </span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                    {new Date(evento.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}