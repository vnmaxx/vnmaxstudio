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

  importCrm: () => fetchJson<{ added: number; merged?: number }>('/crm/import', { method: 'POST' }),

  dedupeCrm: () => fetchJson<{ removed: number }>('/crm/dedupe', { method: 'POST' }),

  getLeadgen: () => fetchJson<import('./types').LeadgenConfig>('/leadgen'),
  saveLeadgen: (cfg: { cidade?: string; quantidade?: number; rotacao?: boolean; nichos?: string[] }) =>
    fetchJson<import('./types').LeadgenConfig>('/leadgen', { method: 'POST', body: JSON.stringify(cfg) }),

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

  enviarMensagem: (id: string, payload: { texto: string; modo?: string; recipient?: string; assunto?: string }) =>
    fetchJson<{ ok: boolean; mode?: string; link?: string; detail?: string; error?: string; lead: import('./types').CrmLead }>(`/crm/${encodeURIComponent(id)}/enviar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }),

  descartarRascunho: (id: string) =>
    fetchJson<import('./types').CrmLead>(`/crm/${encodeURIComponent(id)}/descartar-rascunho`, { method: 'POST' }),

  sdrLote: () =>
    fetchJson<{ ok: boolean; queued: number; jaNaFila: number }>('/crm/sdr-lote', { method: 'POST' }),

  getSocial: () => fetchJson<import('./types').SocialProvider[]>('/social'),

  connectSocial: (id: string, values: Record<string, string>) =>
    fetchJson<import('./types').SocialProvider>(`/social/${encodeURIComponent(id)}/connect`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
    }),

  testSocial: (id: string) =>
    fetchJson<{ ok: boolean; info?: string; error?: string }>(`/social/${encodeURIComponent(id)}/test`, { method: 'POST' }),

  disconnectSocial: (id: string) =>
    fetchJson<import('./types').SocialProvider>(`/social/${encodeURIComponent(id)}/disconnect`, { method: 'POST' }),

  metaOauthUrl: (redirect: string) =>
    fetchJson<{ url: string }>(`/social/meta/oauth-url?redirect=${encodeURIComponent(redirect)}`),
  metaExchange: (payload: { code: string; redirectUri: string }) =>
    fetchJson<{ ok: boolean; page?: string; error?: string }>('/social/meta/exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),

  gerarRoteiros: (payload: { cliente: { nome?: string; segmento?: string; tom?: string; publico?: string; objetivo?: string }; theme: string; count?: number; durationSec?: number; platform?: string; storytelling?: boolean }) =>
    fetchJson<{ jobId: string }>('/conteudo/roteiros/gerar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  getRoteiroJob: (jobId: string) =>
    fetchJson<{ status: string; variations?: import('./types').RoteiroVariation[]; error?: string; parseError?: boolean }>(`/conteudo/roteiros/job/${encodeURIComponent(jobId)}`),
  gerarBlueprint: (cliente: { nome?: string; segmento?: string; contato?: string; observacao?: string; objetivo?: string; publico?: string }) =>
    fetchJson<{ jobId: string }>('/conteudo/blueprint/gerar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cliente }) }),
  getBlueprintJob: (jobId: string) =>
    fetchJson<{ status: string; blueprint?: import('./types').Blueprint; error?: string; parseError?: boolean }>(`/conteudo/blueprint/job/${encodeURIComponent(jobId)}`),

  getPerfilConteudo: (clienteId: string) => fetchJson<import('./types').ConteudoPerfil>(`/conteudo/perfil/${encodeURIComponent(clienteId)}`),
  setPerfilConteudo: (clienteId: string, patch: import('./types').ConteudoPerfil) =>
    fetchJson<import('./types').ConteudoPerfil>(`/conteudo/perfil/${encodeURIComponent(clienteId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }),

  getRoteiros: (clienteId?: string) => fetchJson<{ roteiros: import('./types').Roteiro[] }>('/conteudo/roteiros' + (clienteId ? `?clienteId=${encodeURIComponent(clienteId)}` : '')),
  saveRoteiro: (clienteId: string | null, theme: string, variation: import('./types').RoteiroVariation) =>
    fetchJson<import('./types').Roteiro>('/conteudo/roteiros', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId, theme, variation }) }),
  deleteRoteiro: (id: string) => fetchJson<{ ok: boolean }>(`/conteudo/roteiros/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getCalendario: (clienteId?: string) => fetchJson<{ calendario: import('./types').CalendarioItem[] }>('/conteudo/calendario' + (clienteId ? `?clienteId=${encodeURIComponent(clienteId)}` : '')),
  addCalendario: (item: { clienteId?: string | null; date?: string; theme?: string; status?: string; roteiroId?: string | null }) =>
    fetchJson<import('./types').CalendarioItem>('/conteudo/calendario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) }),
  planCalendario: (clienteId: string | null, opts: { count?: number; perWeek?: number; themes?: string[] }) =>
    fetchJson<{ items: import('./types').CalendarioItem[] }>('/conteudo/calendario/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId, ...opts }) }),
  updateCalendario: (id: string, patch: Partial<import('./types').CalendarioItem>) =>
    fetchJson<import('./types').CalendarioItem>(`/conteudo/calendario/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }),
  deleteCalendario: (id: string) => fetchJson<{ ok: boolean }>(`/conteudo/calendario/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getPosts: (clienteId?: string) => fetchJson<{ posts: import('./types').ConteudoPost[] }>('/conteudo/posts' + (clienteId ? `?clienteId=${encodeURIComponent(clienteId)}` : '')),
  publicarPost: (post: { clienteId?: string | null; roteiroId?: string | null; plataforma: string; legenda: string; retencao?: number; viralScore?: number | null }) =>
    fetchJson<import('./types').ConteudoPost>('/conteudo/posts/publicar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(post) }),
  deletePost: (id: string) => fetchJson<{ ok: boolean }>(`/conteudo/posts/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getBlueprints: (clienteId?: string) => fetchJson<{ blueprints: import('./types').Blueprint[] }>('/conteudo/blueprints' + (clienteId ? `?clienteId=${encodeURIComponent(clienteId)}` : '')),
  saveBlueprint: (clienteId: string | null, blueprint: import('./types').Blueprint) =>
    fetchJson<import('./types').Blueprint>('/conteudo/blueprints', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId, blueprint }) }),
  deleteBlueprint: (id: string) => fetchJson<{ ok: boolean }>(`/conteudo/blueprints/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  gerarProduto: (payload: { cliente: { nome?: string; segmento?: string; contato?: string; observacao?: string; objetivo?: string; publico?: string }; tipo: string; tema?: string }) =>
    fetchJson<{ jobId: string }>('/conteudo/produtos/gerar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  getProdutoJob: (jobId: string, tipo: string) =>
    fetchJson<{ status: string; produto?: { formato: 'html' | 'md'; conteudo: string }; error?: string; parseError?: boolean }>(`/conteudo/produtos/job/${encodeURIComponent(jobId)}?tipo=${encodeURIComponent(tipo)}`),
  getProdutos: (clienteId?: string) => fetchJson<{ produtos: import('./types').Produto[] }>('/conteudo/produtos' + (clienteId ? `?clienteId=${encodeURIComponent(clienteId)}` : '')),
  saveProduto: (clienteId: string | null, produto: import('./types').Produto) =>
    fetchJson<import('./types').Produto>('/conteudo/produtos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId, produto }) }),
  deleteProduto: (id: string) => fetchJson<{ ok: boolean }>(`/conteudo/produtos/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  uploadVideoJob: async (files: File[], roteiro: unknown, clienteId?: string) => {
    const fd = new FormData()
    files.forEach(f => fd.append('clips', f))
    fd.append('roteiro', JSON.stringify(roteiro || {}))
    if (clienteId) fd.append('clienteId', clienteId)
    const res = await fetch(BASE + '/video/jobs', { method: 'POST', body: fd })
    if (!res.ok) { const e = await res.json().catch(() => ({ error: res.statusText })); throw new Error(e.error || `HTTP ${res.status}`) }
    return res.json() as Promise<{ jobId: string }>
  },
  getVideoJob: (id: string) => fetchJson<import('./types').VideoJob>(`/video/jobs/${encodeURIComponent(id)}`),
  getVideoJobs: (clienteId?: string) => fetchJson<{ jobs: import('./types').VideoJob[] }>('/video/jobs' + (clienteId ? `?clienteId=${encodeURIComponent(clienteId)}` : '')),
  deleteVideoJob: (id: string) => fetchJson<{ ok: boolean }>(`/video/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  videoFinalUrl: (id: string) => BASE + `/video/jobs/${encodeURIComponent(id)}/final.mp4`,
  getVideoStorage: () => fetchJson<{ dir: string; freeGB: number; totalGB: number }>('/video/storage'),

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
