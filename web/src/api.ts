const BASE = (import.meta.env.VITE_API_URL || '') + '/api'

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  getAgents: () => fetchJson<Record<string, import('./types').Agent>>('/agents'),

  updateAgent: (name: string, patch: Partial<import('./types').Agent>) =>
    fetchJson<{ ok: boolean }>(`/agents/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),

  getPendentes: () => fetchJson<import('./types').AprovacaoResumo[]>('/pendentes'),

  getPendente: (id: string) => fetchJson<import('./types').AprovacaoCompleta>(`/pendentes/${id}`),

  aprovar: (id: string) =>
    fetchJson<{ ok: boolean; conteudo: unknown }>(`/aprovar/${id}`, { method: 'POST' }),

  rejeitar: (id: string, motivo: string) =>
    fetchJson<{ ok: boolean }>(`/rejeitar/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo }),
    }),

  aprovarTodos: () =>
    fetchJson<{ ok: boolean }>('/aprovar-todos', { method: 'POST' }),

  getRelatorios: () => fetchJson<import('./types').ReportFile[]>('/relatorios'),

  getRelatorio: (filename: string) =>
    fetchJson<{ name: string; content: string }>(`/relatorios/${encodeURIComponent(filename)}`),

  getLogs: () => fetchJson<{ lines: string[] }>('/logs'),

  getWorkspace: () => fetchJson<import('./types').WorkspaceDir[]>('/workspace'),

  browsePath: (pathSegments: string[]) => {
    const encoded = pathSegments.map(s => encodeURIComponent(s)).join('/')
    return fetchJson<{ type: 'dir'; items: import('./types').WorkspaceFile[] } | { type: 'file'; raw: string; isJson: boolean }>(`/workspace-browse/${encoded}`)
  },

  getWorkspaceDir: (dir: string) =>
    fetchJson<import('./types').WorkspaceFile[]>(`/workspace/${encodeURIComponent(dir)}`),

  getWorkspaceFile: (dir: string, file: string) =>
    fetchJson<{ content: unknown; raw: string; isJson: boolean }>(
      `/workspace/${encodeURIComponent(dir)}/${encodeURIComponent(file)}`
    ),

  deleteWorkspacePath: (pathSegments: string[]) => {
    const encoded = pathSegments.map(s => encodeURIComponent(s)).join('/')
    return fetchJson<{ ok: boolean }>(`/workspace-browse/${encoded}`, { method: 'DELETE' })
  },

  renameWorkspacePath: (from: string[], to: string) =>
    fetchJson<{ ok: boolean; name: string }>('/workspace-rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to }),
    }),

  getPipelines: () => fetchJson<{ running: import('./types').PipelineRecord[]; history: import('./types').PipelineRecord[] }>('/pipelines'),

  getPipelineMetrics: () => fetchJson<import('./types').PipelineMetrics>('/pipelines/metrics'),

  getPipeline: (id: string) => fetchJson<import('./types').PipelineRecord>(`/pipelines/${id}`),

  getCrm: () => fetchJson<{ leads: import('./types').CrmLead[]; stages: import('./types').CrmStage[] }>('/crm'),

  importCrm: () => fetchJson<{ added: number }>('/crm/import', { method: 'POST' }),

  addCrmLead: (lead: { nome: string; segmento?: string; contato?: string; canal?: string }) =>
    fetchJson<import('./types').CrmLead>('/crm/lead', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead),
    }),

  setCrmStage: (id: string, stage: import('./types').CrmStage) =>
    fetchJson<import('./types').CrmLead>(`/crm/${encodeURIComponent(id)}/stage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage }),
    }),

  addCrmContato: (id: string, contato: { tipo?: string; canal?: string; etapa?: string; texto: string }) =>
    fetchJson<import('./types').CrmLead>(`/crm/${encodeURIComponent(id)}/contato`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contato),
    }),

  deleteCrmLead: (id: string) =>
    fetchJson<{ ok: boolean }>(`/crm/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  sugerirMensagem: (id: string) =>
    fetchJson<{ jobId: string }>(`/crm/${encodeURIComponent(id)}/sugerir`, { method: 'POST' }),

  getSugestao: (jobId: string) =>
    fetchJson<{ status: string; mensagens?: Array<{ canal?: string; etapa?: string; assunto?: string; mensagem: string; objetivo?: string; proximo_passo?: string }>; error?: string }>(`/crm/sugestao/${encodeURIComponent(jobId)}`),

  enviarMensagem: (id: string, payload: { texto: string; modo?: string; recipient?: string }) =>
    fetchJson<{ ok: boolean; modo?: string; link?: string; ayrshare?: unknown; lead: import('./types').CrmLead }>(`/crm/${encodeURIComponent(id)}/enviar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }),

  descartarRascunho: (id: string) =>
    fetchJson<import('./types').CrmLead>(`/crm/${encodeURIComponent(id)}/descartar-rascunho`, { method: 'POST' }),

  sdrLote: () =>
    fetchJson<{ ok: boolean; queued: number; jaNaFila: number }>('/crm/sdr-lote', { method: 'POST' }),

  getStats: () => fetchJson<import('./types').Stats>('/stats'),

  getStatus: () => fetchJson<import('./types').SystemStatus>('/status'),

  toggleDisabled: () =>
    fetchJson<{ disabled: boolean }>('/toggle-disabled', { method: 'POST' }),

  runCycle: (cycle: 'segunda' | 'diario' | 'sexta') =>
    fetchJson<{ started: boolean; pid: number; cycle: string }>('/cycle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycle }),
    }),
}
