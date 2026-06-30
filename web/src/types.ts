export interface AgentTools {
  shell: boolean
  web: boolean
  edit: boolean
  read: boolean
}

export interface Agent {
  model: 'opus' | 'sonnet' | 'haiku'
  maxTurns: number
  tools: AgentTools
  system: string
}

export interface AgentsMap {
  [key: string]: Agent
}

export interface AprovacaoResumo {
  id: string
  tipo: string
  resumo: string
  data: string
}

export interface AprovacaoCompleta extends AprovacaoResumo {
  conteudo: unknown
  estado: string
}

export interface WorkspaceDir {
  name: string
  count: number
}

export interface WorkspaceFile {
  name: string
  isDir: boolean
  size: number
  mtime: string
}

export interface ReportFile {
  name: string
  mtime: string
  size: number
}

export type CrmStage = 'NOVO' | 'CONTATADO' | 'RESPONDEU' | 'QUALIFICADO' | 'PROPOSTA' | 'FECHADO' | 'PERDIDO'

export interface CrmEvent {
  tipo: 'mensagem' | 'proposta' | 'resposta' | 'nota' | 'stage'
  canal?: string
  etapa?: string
  texto: string
  em: string
}

export interface CrmLead {
  id: string
  nome: string
  segmento: string
  contato: string
  canal: string
  stage: CrmStage
  observacao: string
  origem: string
  criadoEm: string
  atualizadoEm: string
  historico: CrmEvent[]
}

export type PipelineState = 'WAITING' | 'RUNNING' | 'RETRY' | 'FAILED' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'

export interface PipelineStep {
  name: string
  state: PipelineState
  startedAt: string | null
  completedAt: string | null
  attempt: number
  maxRetries: number
  timeoutMs: number
  error: string | null
  durationMs: number | null
}

export interface PipelineRecord {
  id: string
  name: string
  cycle: string
  priority: number
  state: PipelineState
  startedAt: string | null
  completedAt: string | null
  steps: PipelineStep[]
  logs: string[]
  metrics: {
    totalDurationMs: number
    retries: number
  }
}

export interface PipelineMetrics {
  total: number
  completed: number
  failed: number
  running: number
  last24h: number
  avgDurationMs: number
  totalRetries: number
  successRate: number
  stepStats: Record<string, { total: number; completed: number; failed: number; totalMs: number }>
}

export interface SystemStatus {
  disabled: boolean
  cycle_running: boolean
}

export interface Stats {
  counts: {
    leads: number
    conteudo: number
    produtos: number
    paginas: number
    campanhas: number
    emails: number
    clientes: number
    propostas: number
    reports: number
    pendentes: number
  }
  lastCycle: string | null
  lastError: string | null
  totalErrors: number
  totalJobs: number
}
