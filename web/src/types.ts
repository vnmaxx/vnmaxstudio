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
  icon?: string
  custom?: boolean
}

export interface CicloStep {
  id?: string
  name: string
  agente: string
  prompt?: string
  desc?: string
  timeoutMin?: number
  saveComoRelatorio?: boolean
  base?: boolean
}

export interface Ciclo {
  id: string
  nome: string
  horario?: string
  builtin: boolean
  descricao?: string
  steps: CicloStep[]
  extraSteps?: CicloStep[]
}

export interface CiclosStatus {
  builtin: Ciclo[]
  custom: Ciclo[]
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

export interface Pendencia {
  id: string
  clienteId: string | null
  chave: string | null
  titulo: string
  detalhe: string
  tipo: string
  prioridade: 'alta' | 'media' | 'baixa'
  status: 'aberto' | 'resolvido'
  criadoEm: string
}

export interface SitePublicado {
  url: string
  deployUrl?: string
  project: string
  deploymentId?: string
  estado?: string
  firebase?: { projectId: string; appId: string; config?: Record<string, string> } | null
  publicadoEm?: string
  atualizadoEm?: string
}

export interface VnmaxConfig {
  empresa: string
  dadosOficiais: string
  docsExtra: string
  atualizadoEm: string | null
  systemPrompt?: string
}

export interface LeadgenConfig {
  cidade: string
  quantidade: number
  rotacao: boolean
  nichos: string[]
  auto: boolean
  minNovos: number
  intervaloHoras: number
  ultimaCaptacao?: string | null
  captando?: boolean
  catalogo?: Record<string, string[]>
}

export interface CrmEvent {
  tipo: 'mensagem' | 'proposta' | 'resposta' | 'nota' | 'stage'
  canal?: string
  etapa?: string
  texto: string
  em: string
}

export interface CrmRascunho {
  canal?: string
  etapa?: string
  assunto?: string
  mensagem: string
  objetivo?: string
  proximo_passo?: string
  status?: string
  origem?: string
  geradoEm?: string
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
  rascunho?: CrmRascunho
}

export interface SocialField {
  key: string
  label: string
  placeholder?: string
  secret?: boolean
}

export interface SocialProvider {
  id: string
  label: string
  canal: string
  kind: 'api' | 'link'
  descricao: string
  fields: SocialField[]
  connected: boolean
  values: Record<string, string>
  atualizadoEm: string | null
}

export interface RoteiroVariation {
  hook?: string
  hook_formula?: string
  visual_hook?: string
  script?: string
  onscreen_text?: string[]
  loop_line?: string
  cta?: string
  broll_suggestions?: string[]
  keywords?: string[]
  retencao_3s?: number
  completion_estimada?: number
  estimated_retention?: number
  viral_score?: number
  title?: string
  demo?: boolean
}

export interface Roteiro extends RoteiroVariation {
  id: string
  clienteId: string | null
  theme: string
  criadoEm: string
}

export interface CalendarioItem {
  id: string
  clienteId: string | null
  date: string
  theme: string
  status: string
  roteiroId?: string | null
  criadoEm: string
}

export interface ConteudoPost {
  id: string
  clienteId: string | null
  roteiroId?: string | null
  plataforma: string
  legenda: string
  retencao: number
  viralScore?: number | null
  criadoEm: string
  metrics?: { views: number; likes: number; comments: number; shares: number }
}

export interface Blueprint {
  id?: string
  clienteId?: string | null
  tipo_recomendado: string
  justificativa?: string
  nome_projeto?: string
  objetivo_principal?: string
  publico_alvo?: string
  proposta_valor?: string
  funcionalidades?: string[]
  stack_sugerida?: string
  identidade?: string
  prompt: string
  primeiro_passo?: string
  criadoEm?: string
  demo?: boolean
}

export interface ConteudoPerfil {
  niche?: string
  tom?: string
  publico?: string
  objetivo?: string
  handle?: string
}

export interface Produto {
  id?: string
  clienteId?: string | null
  tipo: string
  titulo?: string
  formato: 'html' | 'md'
  conteudo: string
  tema?: string
  estilo?: string
  criadoEm?: string
}

export interface LandingEstilo {
  key: string
  label: string
  tagline: string
  vibe: 'dark' | 'light'
  bestFor: string[]
}

export interface VideoJob {
  id: string
  state?: 'queued' | 'running' | 'done' | 'error'
  step?: string
  error?: string
  final?: string
  size?: number
  legendas?: string
  transcricao?: string | null
  clienteId?: string | null
  titulo?: string
  criadoEm?: string
  atualizadoEm?: string
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
