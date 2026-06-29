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

  getPipelines: () => fetchJson<{ running: import('./types').PipelineRecord[]; history: import('./types').PipelineRecord[] }>('/pipelines'),

  getPipelineMetrics: () => fetchJson<import('./types').PipelineMetrics>('/pipelines/metrics'),

  getPipeline: (id: string) => fetchJson<import('./types').PipelineRecord>(`/pipelines/${id}`),

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
