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
