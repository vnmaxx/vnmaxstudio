'use strict';
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const BRIDGE_URL = process.env.LINUX_BRIDGE_URL || '';
const BRIDGE_SECRET = process.env.BRIDGE_SECRET || '';

async function bridge(method, route, body) {
  try {
    const { default: fetch } = await import('node-fetch');
    const url = `${BRIDGE_URL}${route}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'x-bridge-secret': BRIDGE_SECRET, 'User-Agent': 'StudioIA-Render/1.0' },
      signal: controller.signal,
    };
    if (body) opts.body = JSON.stringify(body);
    try {
      const r = await fetch(url, opts);
      clearTimeout(timer);
      const text = await r.text();
      try { return { status: r.status, data: JSON.parse(text) }; } catch { return { status: r.status, data: text }; }
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    console.error(`bridge ${method} ${route} falhou:`, e.message);
    return { status: 503, data: { error: `Bridge indisponível: ${e.message}` } };
  }
}

if (BRIDGE_URL) {
  console.log(`Modo Render — bridge: ${BRIDGE_URL}`);

  const CACHE = {};
  const TTL = {
    '/status': 30000,
    '/stats': 90000,
    '/logs': 30000,
    '/pendentes': 30000,
    '/relatorios': 120000,
    '/workspace': 120000,
  };
  const DEFAULTS = {
    '/status': { disabled: false },
    '/stats': { counts: {}, lastCycle: null, lastError: null, totalErrors: 0, totalJobs: 0 },
    '/logs': { lines: [] },
    '/pendentes': [],
    '/relatorios': [],
    '/workspace': [],
  };

  function getCache(key) {
    return CACHE[key] || null;
  }

  function setCache(key, data) {
    CACHE[key] = { data, ts: Date.now() };
  }

  function invalidate(...keys) {
    for (const k of keys) delete CACHE[k];
  }

  const lastAttempt = {};
  const RETRY_COOLDOWN = 60000;

  function refreshInBackground(route) {
    const now = Date.now();
    if (lastAttempt[route] && now - lastAttempt[route] < RETRY_COOLDOWN) return;
    lastAttempt[route] = now;
    bridge('GET', route).then(r => {
      if (r.status === 200) { setCache(route, r.data); delete lastAttempt[route]; }
    }).catch(() => {});
  }

  function bridgeCached(route) {
    const entry = getCache(route);
    const ttl = TTL[route] || 60000;
    const expired = !entry || Date.now() - entry.ts > ttl;
    if (expired) refreshInBackground(route);
    return { status: 200, data: entry ? entry.data : DEFAULTS[route] };
  }

  Object.keys(DEFAULTS).forEach(route => refreshInBackground(route));

  app.get('/api/logs', (req, res) => {
    const { status, data } = bridgeCached('/logs');
    res.status(status).json(data);
  });

  app.get('/api/stats', (req, res) => {
    const { status, data } = bridgeCached('/stats');
    res.status(status).json(data);
  });

  app.get('/api/status', (req, res) => {
    const { status, data } = bridgeCached('/status');
    res.status(status).json(data);
  });

  app.post('/api/toggle-disabled', async (req, res) => {
    invalidate('/status');
    const { status, data } = await bridge('POST', '/toggle-disabled');
    if (status === 200) setCache('/status', data);
    res.status(status).json(data);
  });

  app.get('/api/relatorios', (req, res) => {
    const { status, data } = bridgeCached('/relatorios');
    res.status(status).json(data);
  });

  app.get('/api/relatorios/:filename', async (req, res) => {
    const { status, data } = await bridge('GET', `/relatorios/${req.params.filename}`);
    res.status(status).json(data);
  });

  app.get('/api/pendentes', (req, res) => {
    const { status, data } = bridgeCached('/pendentes');
    res.status(status).json(data);
  });

  app.get('/api/pendentes/:id', async (req, res) => {
    const { status, data } = await bridge('GET', `/pendentes/${req.params.id}`);
    res.status(status).json(data);
  });

  app.post('/api/aprovar/:id', async (req, res) => {
    invalidate('/pendentes', '/stats');
    const { status, data } = await bridge('POST', `/aprovar/${req.params.id}`);
    res.status(status).json(data);
  });

  app.post('/api/rejeitar/:id', async (req, res) => {
    invalidate('/pendentes', '/stats');
    const { status, data } = await bridge('POST', `/rejeitar/${req.params.id}`, req.body);
    res.status(status).json(data);
  });

  app.post('/api/aprovar-todos', async (req, res) => {
    invalidate('/pendentes', '/stats');
    const { status, data } = await bridge('POST', '/aprovar-todos');
    res.status(status).json(data);
  });

  app.get('/api/workspace-browse/*', async (req, res) => {
    const { status, data } = await bridge('GET', `/workspace-browse/${req.params[0]}`);
    res.status(status).json(data);
  });

  app.delete('/api/workspace-browse/*', async (req, res) => {
    const { status, data } = await bridge('DELETE', `/workspace-browse/${req.params[0]}`);
    res.status(status).json(data);
  });

  app.post('/api/workspace-rename', async (req, res) => {
    const { status, data } = await bridge('POST', '/workspace-rename', req.body);
    res.status(status).json(data);
  });

  app.get('/api/workspace', (req, res) => {
    const { status, data } = bridgeCached('/workspace');
    res.status(status).json(data);
  });

  app.get('/api/workspace/:dir', async (req, res) => {
    const { status, data } = await bridge('GET', `/workspace/${req.params.dir}`);
    res.status(status).json(data);
  });

  app.get('/api/workspace/:dir/:file', async (req, res) => {
    const { status, data } = await bridge('GET', `/workspace/${req.params.dir}/${req.params.file}`);
    res.status(status).json(data);
  });

  app.post('/api/cycle', async (req, res) => {
    invalidate('/stats', '/logs');
    const { status, data } = await bridge('POST', '/cycle', req.body);
    res.status(status).json(data);
  });

  app.get('/api/pipelines', async (req, res) => {
    const { status, data } = await bridge('GET', '/pipelines');
    res.status(status).json(data);
  });

  app.get('/api/pipelines/metrics', async (req, res) => {
    const { status, data } = await bridge('GET', '/pipelines/metrics');
    res.status(status).json(data);
  });

  app.get('/api/pipelines/:id', async (req, res) => {
    const { status, data } = await bridge('GET', `/pipelines/${req.params.id}`);
    res.status(status).json(data);
  });

  app.get('/api/agents', async (req, res) => {
    const { status, data } = await bridge('GET', '/agents');
    res.status(status).json(data);
  });

  app.put('/api/agents/:name', async (req, res) => {
    const { status, data } = await bridge('PUT', `/agents/${req.params.name}`, req.body);
    res.status(status).json(data);
  });

  app.get('/api/crm', async (req, res) => {
    const { status, data } = await bridge('GET', '/crm');
    res.status(status).json(data);
  });
  app.post('/api/crm/import', async (req, res) => {
    const { status, data } = await bridge('POST', '/crm/import');
    res.status(status).json(data);
  });
  app.post('/api/crm/lead', async (req, res) => {
    const { status, data } = await bridge('POST', '/crm/lead', req.body);
    res.status(status).json(data);
  });
  app.post('/api/crm/:id/stage', async (req, res) => {
    const { status, data } = await bridge('POST', `/crm/${req.params.id}/stage`, req.body);
    res.status(status).json(data);
  });
  app.post('/api/crm/:id/contato', async (req, res) => {
    const { status, data } = await bridge('POST', `/crm/${req.params.id}/contato`, req.body);
    res.status(status).json(data);
  });
  app.delete('/api/crm/:id', async (req, res) => {
    const { status, data } = await bridge('DELETE', `/crm/${req.params.id}`);
    res.status(status).json(data);
  });
  app.post('/api/crm/:id/sugerir', async (req, res) => {
    const { status, data } = await bridge('POST', `/crm/${req.params.id}/sugerir`, req.body);
    res.status(status).json(data);
  });
  app.get('/api/crm/sugestao/:jobId', async (req, res) => {
    const { status, data } = await bridge('GET', `/crm/sugestao/${req.params.jobId}`);
    res.status(status).json(data);
  });
  app.post('/api/crm/:id/enviar', async (req, res) => {
    const { status, data } = await bridge('POST', `/crm/${req.params.id}/enviar`, req.body);
    res.status(status).json(data);
  });
  app.post('/api/crm/:id/descartar-rascunho', async (req, res) => {
    const { status, data } = await bridge('POST', `/crm/${req.params.id}/descartar-rascunho`, req.body);
    res.status(status).json(data);
  });
  app.post('/api/crm/sdr-lote', async (req, res) => {
    const { status, data } = await bridge('POST', '/crm/sdr-lote', req.body);
    res.status(status).json(data);
  });
  app.get('/api/social', async (req, res) => {
    const { status, data } = await bridge('GET', '/social');
    res.status(status).json(data);
  });
  app.post('/api/social/:id/connect', async (req, res) => {
    const { status, data } = await bridge('POST', `/social/${req.params.id}/connect`, req.body);
    res.status(status).json(data);
  });
  app.post('/api/social/:id/test', async (req, res) => {
    const { status, data } = await bridge('POST', `/social/${req.params.id}/test`, req.body);
    res.status(status).json(data);
  });
  app.post('/api/social/:id/disconnect', async (req, res) => {
    const { status, data } = await bridge('POST', `/social/${req.params.id}/disconnect`, req.body);
    res.status(status).json(data);
  });
  app.get('/api/social/meta/oauth-url', async (req, res) => {
    const { status, data } = await bridge('GET', '/social/meta/oauth-url' + (req.query.redirect ? `?redirect=${encodeURIComponent(req.query.redirect)}` : ''));
    res.status(status).json(data);
  });
  app.post('/api/social/meta/exchange', async (req, res) => {
    const { status, data } = await bridge('POST', '/social/meta/exchange', req.body);
    res.status(status).json(data);
  });

  const cq = (req) => req.query.clienteId ? `?clienteId=${encodeURIComponent(req.query.clienteId)}` : '';
  app.post('/api/conteudo/roteiros/gerar', async (req, res) => { const { status, data } = await bridge('POST', '/conteudo/roteiros/gerar', req.body); res.status(status).json(data); });
  app.get('/api/conteudo/roteiros/job/:jobId', async (req, res) => { const { status, data } = await bridge('GET', `/conteudo/roteiros/job/${req.params.jobId}`); res.status(status).json(data); });
  app.post('/api/conteudo/blueprint/gerar', async (req, res) => { const { status, data } = await bridge('POST', '/conteudo/blueprint/gerar', req.body); res.status(status).json(data); });
  app.get('/api/conteudo/blueprint/job/:jobId', async (req, res) => { const { status, data } = await bridge('GET', `/conteudo/blueprint/job/${req.params.jobId}`); res.status(status).json(data); });
  app.get('/api/conteudo/perfil/:clienteId', async (req, res) => { const { status, data } = await bridge('GET', `/conteudo/perfil/${req.params.clienteId}`); res.status(status).json(data); });
  app.post('/api/conteudo/perfil/:clienteId', async (req, res) => { const { status, data } = await bridge('POST', `/conteudo/perfil/${req.params.clienteId}`, req.body); res.status(status).json(data); });
  app.get('/api/conteudo/roteiros', async (req, res) => { const { status, data } = await bridge('GET', '/conteudo/roteiros' + cq(req)); res.status(status).json(data); });
  app.post('/api/conteudo/roteiros', async (req, res) => { const { status, data } = await bridge('POST', '/conteudo/roteiros', req.body); res.status(status).json(data); });
  app.delete('/api/conteudo/roteiros/:id', async (req, res) => { const { status, data } = await bridge('DELETE', `/conteudo/roteiros/${req.params.id}`); res.status(status).json(data); });
  app.get('/api/conteudo/calendario', async (req, res) => { const { status, data } = await bridge('GET', '/conteudo/calendario' + cq(req)); res.status(status).json(data); });
  app.post('/api/conteudo/calendario', async (req, res) => { const { status, data } = await bridge('POST', '/conteudo/calendario', req.body); res.status(status).json(data); });
  app.post('/api/conteudo/calendario/plan', async (req, res) => { const { status, data } = await bridge('POST', '/conteudo/calendario/plan', req.body); res.status(status).json(data); });
  app.put('/api/conteudo/calendario/:id', async (req, res) => { const { status, data } = await bridge('PUT', `/conteudo/calendario/${req.params.id}`, req.body); res.status(status).json(data); });
  app.delete('/api/conteudo/calendario/:id', async (req, res) => { const { status, data } = await bridge('DELETE', `/conteudo/calendario/${req.params.id}`); res.status(status).json(data); });
  app.get('/api/conteudo/posts', async (req, res) => { const { status, data } = await bridge('GET', '/conteudo/posts' + cq(req)); res.status(status).json(data); });
  app.post('/api/conteudo/posts/publicar', async (req, res) => { const { status, data } = await bridge('POST', '/conteudo/posts/publicar', req.body); res.status(status).json(data); });
  app.delete('/api/conteudo/posts/:id', async (req, res) => { const { status, data } = await bridge('DELETE', `/conteudo/posts/${req.params.id}`); res.status(status).json(data); });
  app.get('/api/conteudo/blueprints', async (req, res) => { const { status, data } = await bridge('GET', '/conteudo/blueprints' + cq(req)); res.status(status).json(data); });
  app.post('/api/conteudo/blueprints', async (req, res) => { const { status, data } = await bridge('POST', '/conteudo/blueprints', req.body); res.status(status).json(data); });
  app.delete('/api/conteudo/blueprints/:id', async (req, res) => { const { status, data } = await bridge('DELETE', `/conteudo/blueprints/${req.params.id}`); res.status(status).json(data); });
  app.post('/api/conteudo/produtos/gerar', async (req, res) => { const { status, data } = await bridge('POST', '/conteudo/produtos/gerar', req.body); res.status(status).json(data); });
  app.get('/api/conteudo/produtos/job/:jobId', async (req, res) => { const { status, data } = await bridge('GET', `/conteudo/produtos/job/${req.params.jobId}` + (req.query.tipo ? `?tipo=${encodeURIComponent(req.query.tipo)}` : '')); res.status(status).json(data); });
  app.get('/api/conteudo/produtos', async (req, res) => { const { status, data } = await bridge('GET', '/conteudo/produtos' + cq(req)); res.status(status).json(data); });
  app.post('/api/conteudo/produtos', async (req, res) => { const { status, data } = await bridge('POST', '/conteudo/produtos', req.body); res.status(status).json(data); });
  app.delete('/api/conteudo/produtos/:id', async (req, res) => { const { status, data } = await bridge('DELETE', `/conteudo/produtos/${req.params.id}`); res.status(status).json(data); });

  app.post('/api/video/jobs', async (req, res) => {
    try {
      const { default: fetch } = await import('node-fetch');
      const r = await fetch(`${BRIDGE_URL}/video/jobs`, {
        method: 'POST',
        headers: { 'content-type': req.headers['content-type'] || 'application/octet-stream', 'x-bridge-secret': BRIDGE_SECRET },
        body: req,
      });
      const text = await r.text();
      res.status(r.status).type('application/json').send(text);
    } catch (e) { res.status(502).json({ error: `Upload falhou: ${e.message}` }); }
  });
  app.get('/api/video/jobs', async (req, res) => {
    const route = '/video/jobs' + (req.query.clienteId ? `?clienteId=${encodeURIComponent(req.query.clienteId)}` : '');
    const { status, data } = await bridge('GET', route);
    res.status(status).json(data);
  });
  app.get('/api/video/jobs/:id/final.mp4', async (req, res) => {
    try {
      const { default: fetch } = await import('node-fetch');
      const r = await fetch(`${BRIDGE_URL}/video/jobs/${encodeURIComponent(req.params.id)}/final.mp4`, { headers: { 'x-bridge-secret': BRIDGE_SECRET } });
      if (!r.ok) return res.status(r.status).json({ error: 'Not found' });
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      const len = r.headers.get('content-length'); if (len) res.setHeader('Content-Length', len);
      r.body.pipe(res);
    } catch (e) { res.status(502).json({ error: e.message }); }
  });
  app.get('/api/video/jobs/:id', async (req, res) => {
    const { status, data } = await bridge('GET', `/video/jobs/${req.params.id}`);
    res.status(status).json(data);
  });
  app.delete('/api/video/jobs/:id', async (req, res) => {
    const { status, data } = await bridge('DELETE', `/video/jobs/${req.params.id}`);
    res.status(status).json(data);
  });
  app.get('/api/video/storage', async (req, res) => {
    const { status, data } = await bridge('GET', '/video/storage');
    res.status(status).json(data);
  });

} else {
  const STUDIO_ROOT = process.env.STUDIO_ROOT || path.join(__dirname, '..');
  
  // Carrega módulos do core (apenas se existirem)
  let orchestrator = null;
  try {
    orchestrator = require(path.join(STUDIO_ROOT, 'core', 'orchestrator'));
  } catch { /* orchestrator ainda não existe */ }

  let aprovacoes;
  try { aprovacoes = require('../lib/aprovacoes'); } catch {
    aprovacoes = {
      listar: async () => [],
      aprovar: async (id) => ({ conteudo: `Aprovado: ${id}` }),
      rejeitar: async (id) => ({}),
      aprovarTodos: async () => ({ count: 0 }),
    };
  }

  let agentsModule;
  try { agentsModule = require('../agents'); } catch { agentsModule = { AGENTS: {} }; }

  const PENDENTES_DIR = path.join(STUDIO_ROOT, 'workspace', 'aprovacoes', 'pendentes');
  const REPORTS_DIR = path.join(STUDIO_ROOT, 'workspace', 'reports');
  const LOGS_FILE = path.join(STUDIO_ROOT, 'logs', 'scheduler.log');
  const WORKSPACE_DIR = path.join(STUDIO_ROOT, 'workspace');
  const DISABLED_FILE = path.join(STUDIO_ROOT, 'DISABLED');
  const PIPELINES_DIR = path.join(WORKSPACE_DIR, 'pipelines');

  function readLocalPipelines() {
    try {
      if (!fs.existsSync(PIPELINES_DIR)) return [];
      return fs.readdirSync(PIPELINES_DIR)
        .filter(f => f.startsWith('pipeline-') && f.endsWith('.json'))
        .map(f => { try { return JSON.parse(fs.readFileSync(path.join(PIPELINES_DIR, f), 'utf8')); } catch { return null; } })
        .filter(Boolean)
        .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
    } catch { return []; }
  }

  app.get('/api/pipelines', (req, res) => {
    const all = readLocalPipelines();
    res.json({
      running: all.filter(p => ['RUNNING', 'WAITING', 'RETRY'].includes(p.state)),
      history: all.filter(p => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(p.state)).slice(0, 50),
    });
  });

  app.get('/api/pipelines/metrics', (req, res) => {
    const all = readLocalPipelines();
    const completed = all.filter(p => p.state === 'COMPLETED');
    const failed = all.filter(p => p.state === 'FAILED');
    const durations = completed.filter(p => p.metrics && p.metrics.totalDurationMs).map(p => p.metrics.totalDurationMs);
    const avgDurationMs = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    res.json({
      total: all.length, completed: completed.length, failed: failed.length,
      running: all.filter(p => p.state === 'RUNNING').length,
      avgDurationMs, totalRetries: all.reduce((s, p) => s + (p.metrics ? p.metrics.retries || 0 : 0), 0),
      successRate: all.length > 0 ? Math.round(completed.length / all.length * 100) : 0,
      stepStats: {},
    });
  });

  app.get('/api/pipelines/:id', (req, res) => {
    try {
      const file = path.join(PIPELINES_DIR, `pipeline-${req.params.id}.json`);
      if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
      res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  function safeReadDir(dir) {
    try { if (!fs.existsSync(dir)) return []; return fs.readdirSync(dir); } catch { return []; }
  }

  app.get('/api/agents', (req, res) => {
    try { res.json(agentsModule.AGENTS || agentsModule.default || agentsModule); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.put('/api/agents/:name', (req, res) => {
    try {
      const overridesFile = path.join(STUDIO_ROOT, 'agents-overrides.json');
      let overrides = {};
      if (fs.existsSync(overridesFile)) {
        try { overrides = JSON.parse(fs.readFileSync(overridesFile, 'utf8')); } catch {}
      }
      overrides[req.params.name] = { ...(overrides[req.params.name] || {}), ...req.body };
      fs.writeFileSync(overridesFile, JSON.stringify(overrides, null, 2));
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/pendentes', async (req, res) => {
    try { res.json(await aprovacoes.listar()); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/pendentes/:id', (req, res) => {
    try {
      const file = path.join(PENDENTES_DIR, `${req.params.id}.json`);
      if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
      res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/aprovar/:id', async (req, res) => {
    try {
      let item = null;
      try { item = JSON.parse(fs.readFileSync(path.join(PENDENTES_DIR, `${req.params.id}.json`), 'utf8')); } catch {}
      const conteudo = await aprovacoes.aprovar(req.params.id);
      try {
        if (crmLocal && item) {
          const tipo = String(item.tipo || '').toLowerCase();
          const texto = typeof item.conteudo === 'string' ? item.conteudo : JSON.stringify(item.conteudo || '');
          const isProposta = tipo.includes('proposta') || tipo.includes('pacote');
          crmLocal.matchAndRecord(texto, { tipo: isProposta ? 'proposta' : 'mensagem', canal: item.canal || '', etapa: 'aprovado', texto });
        }
      } catch (e) { console.error('CRM hook local:', e.message); }
      res.json({ ok: true, conteudo });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/rejeitar/:id', async (req, res) => {
    try { res.json({ ok: true, result: await aprovacoes.rejeitar(req.params.id, req.body.motivo || '') }); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/aprovar-todos', async (req, res) => {
    try { res.json({ ok: true, result: await aprovacoes.aprovarTodos() }); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/relatorios', (req, res) => {
    try {
      const files = safeReadDir(REPORTS_DIR).filter(f => f.endsWith('.md')).map(f => {
        const stat = fs.statSync(path.join(REPORTS_DIR, f));
        return { name: f, mtime: stat.mtime.toISOString(), size: stat.size };
      }).sort((a, b) => b.mtime.localeCompare(a.mtime));
      res.json(files);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/relatorios/:filename', (req, res) => {
    try {
      const file = path.join(REPORTS_DIR, path.basename(req.params.filename));
      if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
      res.json({ name: path.basename(file), content: fs.readFileSync(file, 'utf8') });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/logs', (req, res) => {
    try {
      if (!fs.existsSync(LOGS_FILE)) return res.json({ lines: [] });
      const lines = fs.readFileSync(LOGS_FILE, 'utf8').split('\n').filter(Boolean);
      res.json({ lines: lines.slice(-200) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/workspace', (req, res) => {
    try {
      const dirs = safeReadDir(WORKSPACE_DIR).filter(f => { try { return fs.statSync(path.join(WORKSPACE_DIR, f)).isDirectory(); } catch { return false; } }).map(name => ({ name, count: safeReadDir(path.join(WORKSPACE_DIR, name)).length }));
      res.json(dirs);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/workspace-browse/*', (req, res) => {
    try {
      const segments = req.params[0].split('/').filter(s => s && s !== '..' && s !== '.');
      const target = path.join(WORKSPACE_DIR, ...segments);
      if (!target.startsWith(WORKSPACE_DIR)) return res.status(403).json({ error: 'forbidden' });
      if (!fs.existsSync(target)) return res.status(404).json({ error: 'Not found' });
      if (fs.statSync(target).isDirectory()) return res.status(400).json({ error: 'Não é possível excluir pastas' });
      fs.unlinkSync(target);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/workspace-rename', (req, res) => {
    try {
      const { from, to } = req.body || {};
      if (!Array.isArray(from) || from.length === 0 || !to || typeof to !== 'string') return res.status(400).json({ error: 'parâmetros inválidos' });
      const safeFrom = from.filter(s => s && s !== '..' && s !== '.');
      const src = path.join(WORKSPACE_DIR, ...safeFrom);
      const newName = path.basename(to);
      const dest = path.join(path.dirname(src), newName);
      if (!src.startsWith(WORKSPACE_DIR) || !dest.startsWith(WORKSPACE_DIR)) return res.status(403).json({ error: 'forbidden' });
      if (!fs.existsSync(src)) return res.status(404).json({ error: 'Not found' });
      if (fs.existsSync(dest)) return res.status(409).json({ error: 'Já existe um arquivo com esse nome' });
      fs.renameSync(src, dest);
      res.json({ ok: true, name: newName });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  let crmLocal = null;
  let CRM_STAGES_LOCAL = ['NOVO', 'CONTATADO', 'RESPONDEU', 'QUALIFICADO', 'PROPOSTA', 'FECHADO', 'PERDIDO'];
  try { const m = require(path.join(STUDIO_ROOT, 'lib', 'crm.js')); crmLocal = new m.Crm(WORKSPACE_DIR); CRM_STAGES_LOCAL = m.STAGES; } catch (e) { console.error('CRM local indisponível:', e.message); }

  let socialLocal = null;
  try { const m = require(path.join(STUDIO_ROOT, 'lib', 'social', 'index.js')); socialLocal = new m.SocialHub(WORKSPACE_DIR); } catch (e) { console.error('Social local indisponível:', e.message); }

  app.get('/api/social', (req, res) => {
    try { res.json(socialLocal ? socialLocal.status() : []); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/social/:id/connect', (req, res) => {
    try { if (!socialLocal) return res.status(503).json({ error: 'Social indisponível' }); const s = socialLocal.connect(req.params.id, req.body || {}); if (!s) return res.status(404).json({ error: 'Provider desconhecido' }); res.json(s); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/social/:id/test', async (req, res) => {
    try { if (!socialLocal) return res.status(503).json({ error: 'Social indisponível' }); res.json(await socialLocal.test(req.params.id)); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/social/:id/disconnect', (req, res) => {
    try { if (!socialLocal) return res.status(503).json({ error: 'Social indisponível' }); res.json(socialLocal.disconnect(req.params.id)); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/social/meta/oauth-url', (req, res) => {
    try { if (!socialLocal) return res.status(503).json({ error: 'Social indisponível' }); const url = socialLocal.metaOauthUrl(req.query.redirect || '', 'meta'); if (!url) return res.status(400).json({ error: 'App ID ausente' }); res.json({ url }); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/social/meta/exchange', async (req, res) => {
    try { if (!socialLocal) return res.status(503).json({ error: 'Social indisponível' }); const { code, redirectUri } = req.body || {}; res.json(await socialLocal.metaExchange(code, redirectUri)); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  let conteudoLocal = null;
  try { const m = require(path.join(STUDIO_ROOT, 'lib', 'conteudo.js')); conteudoLocal = new m.Conteudo(WORKSPACE_DIR); } catch (e) { console.error('Conteudo local indisponível:', e.message); }
  const guard = (res) => { if (!conteudoLocal) { res.status(503).json({ error: 'Conteudo indisponível' }); return false; } return true; };

  app.post('/api/conteudo/roteiros/gerar', (req, res) => res.status(503).json({ error: 'Geração disponível apenas via bridge' }));
  app.get('/api/conteudo/roteiros/job/:jobId', (req, res) => res.status(503).json({ error: 'Geração disponível apenas via bridge' }));
  app.post('/api/conteudo/blueprint/gerar', (req, res) => res.status(503).json({ error: 'Geração disponível apenas via bridge' }));
  app.get('/api/conteudo/blueprint/job/:jobId', (req, res) => res.status(503).json({ error: 'Geração disponível apenas via bridge' }));
  app.get('/api/conteudo/perfil/:clienteId', (req, res) => { if (!guard(res)) return; res.json(conteudoLocal.getPerfil(req.params.clienteId) || {}); });
  app.post('/api/conteudo/perfil/:clienteId', (req, res) => { if (!guard(res)) return; res.json(conteudoLocal.setPerfil(req.params.clienteId, req.body || {})); });
  app.get('/api/conteudo/roteiros', (req, res) => { if (!guard(res)) return; res.json({ roteiros: conteudoLocal.listRoteiros(req.query.clienteId) }); });
  app.post('/api/conteudo/roteiros', (req, res) => { if (!guard(res)) return; const { clienteId, theme, variation } = req.body || {}; if (!variation) return res.status(400).json({ error: 'roteiro vazio' }); res.json(conteudoLocal.addRoteiro(clienteId || null, theme || '', variation)); });
  app.delete('/api/conteudo/roteiros/:id', (req, res) => { if (!guard(res)) return; res.json({ ok: conteudoLocal.removeRoteiro(req.params.id) }); });
  app.get('/api/conteudo/calendario', (req, res) => { if (!guard(res)) return; res.json({ calendario: conteudoLocal.listCalendario(req.query.clienteId) }); });
  app.post('/api/conteudo/calendario', (req, res) => { if (!guard(res)) return; res.json(conteudoLocal.addCalendario(req.body || {})); });
  app.post('/api/conteudo/calendario/plan', (req, res) => { if (!guard(res)) return; const { clienteId, count, perWeek, themes } = req.body || {}; res.json({ items: conteudoLocal.planCalendario(clienteId || null, { count, perWeek, themes }) }); });
  app.put('/api/conteudo/calendario/:id', (req, res) => { if (!guard(res)) return; const it = conteudoLocal.updateCalendario(req.params.id, req.body || {}); if (!it) return res.status(404).json({ error: 'Not found' }); res.json(it); });
  app.delete('/api/conteudo/calendario/:id', (req, res) => { if (!guard(res)) return; res.json({ ok: conteudoLocal.removeCalendario(req.params.id) }); });
  app.get('/api/conteudo/posts', (req, res) => { if (!guard(res)) return; res.json({ posts: conteudoLocal.listPosts(req.query.clienteId) }); });
  app.post('/api/conteudo/posts/publicar', (req, res) => { if (!guard(res)) return; res.json(conteudoLocal.addPost(req.body || {})); });
  app.delete('/api/conteudo/posts/:id', (req, res) => { if (!guard(res)) return; res.json({ ok: conteudoLocal.removePost(req.params.id) }); });
  app.get('/api/conteudo/blueprints', (req, res) => { if (!guard(res)) return; res.json({ blueprints: conteudoLocal.listBlueprints(req.query.clienteId) }); });
  app.post('/api/conteudo/blueprints', (req, res) => { if (!guard(res)) return; const { clienteId, blueprint } = req.body || {}; if (!blueprint) return res.status(400).json({ error: 'blueprint vazio' }); res.json(conteudoLocal.addBlueprint(clienteId || null, blueprint)); });
  app.delete('/api/conteudo/blueprints/:id', (req, res) => { if (!guard(res)) return; res.json({ ok: conteudoLocal.removeBlueprint(req.params.id) }); });
  app.post('/api/conteudo/produtos/gerar', (req, res) => res.status(503).json({ error: 'Geração disponível apenas via bridge' }));
  app.get('/api/conteudo/produtos/job/:jobId', (req, res) => res.status(503).json({ error: 'Geração disponível apenas via bridge' }));
  app.get('/api/conteudo/produtos', (req, res) => { if (!guard(res)) return; res.json({ produtos: conteudoLocal.listProdutos(req.query.clienteId) }); });
  app.post('/api/conteudo/produtos', (req, res) => { if (!guard(res)) return; const { clienteId, produto } = req.body || {}; if (!produto) return res.status(400).json({ error: 'produto vazio' }); res.json(conteudoLocal.addProduto(clienteId || null, produto)); });
  app.delete('/api/conteudo/produtos/:id', (req, res) => { if (!guard(res)) return; res.json({ ok: conteudoLocal.removeProduto(req.params.id) }); });

  app.post('/api/video/jobs', (req, res) => res.status(503).json({ error: 'Edição de vídeo disponível apenas via bridge' }));
  app.get('/api/video/jobs', (req, res) => res.json({ jobs: [] }));
  app.get('/api/video/jobs/:id', (req, res) => res.status(503).json({ error: 'Edição de vídeo disponível apenas via bridge' }));
  app.get('/api/video/jobs/:id/final.mp4', (req, res) => res.status(503).json({ error: 'indisponível' }));
  app.delete('/api/video/jobs/:id', (req, res) => res.status(503).json({ error: 'indisponível' }));
  app.get('/api/video/storage', (req, res) => res.json({ dir: '(local)', freeGB: 0, totalGB: 0 }));

  app.get('/api/crm', (req, res) => {
    try {
      if (!crmLocal) return res.json({ leads: [], stages: CRM_STAGES_LOCAL });
      crmLocal.syncFromLeads();
      res.json({ leads: crmLocal.list(), stages: CRM_STAGES_LOCAL });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/crm/import', (req, res) => {
    try { res.json(crmLocal ? crmLocal.syncFromLeads() : { added: 0 }); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/crm/lead', (req, res) => {
    try { const r = crmLocal && crmLocal.upsertLead(req.body || {}, 'manual'); if (!r) return res.status(400).json({ error: 'dados inválidos' }); res.json(r.lead); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/crm/:id/stage', (req, res) => {
    try { const lead = crmLocal && crmLocal.setStage(req.params.id, (req.body || {}).stage); if (!lead) return res.status(404).json({ error: 'Not found ou stage inválido' }); res.json(lead); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/crm/:id/contato', (req, res) => {
    try { const lead = crmLocal && crmLocal.recordContact(req.params.id, req.body || {}); if (!lead) return res.status(404).json({ error: 'Not found' }); res.json(lead); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.delete('/api/crm/:id', (req, res) => {
    try { res.json({ ok: crmLocal ? crmLocal.remove(req.params.id) : false }); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/crm/sdr-lote', (req, res) => res.status(503).json({ error: 'Geração em lote disponível apenas via bridge' }));
  app.post('/api/crm/:id/sugerir', (req, res) => res.status(503).json({ error: 'Sugestão disponível apenas via bridge' }));
  app.get('/api/crm/sugestao/:jobId', (req, res) => res.status(503).json({ error: 'Sugestão disponível apenas via bridge' }));
  app.post('/api/crm/:id/descartar-rascunho', (req, res) => {
    try { const lead = crmLocal && crmLocal.clearRascunho(req.params.id); if (!lead) return res.status(404).json({ error: 'Not found' }); res.json(lead); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/crm/:id/enviar', async (req, res) => {
    try {
      if (!crmLocal || !socialLocal) return res.status(503).json({ error: 'CRM/Social indisponível' });
      const lead = crmLocal.list().find(l => l.id === req.params.id);
      if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
      const { texto, modo, recipient, assunto } = req.body || {};
      if (!texto) return res.status(400).json({ error: 'texto obrigatório' });
      const r = await socialLocal.send({ canal: lead.canal, recipient: recipient || lead.contato, texto, assunto, modo });
      if (r.ok) { crmLocal.recordContact(lead.id, { tipo: 'mensagem', canal: r.mode === 'link' ? 'whatsapp' : lead.canal, etapa: 'enviado', texto }); crmLocal.clearRascunho(lead.id); }
      res.json({ ok: r.ok, mode: r.mode, link: r.link, detail: r.detail, error: r.error, lead: crmLocal.list().find(l => l.id === lead.id) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/workspace/:dir', (req, res) => {
    try {
      const dir = path.join(WORKSPACE_DIR, path.basename(req.params.dir));
      const files = safeReadDir(dir).map(f => {
        try { const stat = fs.statSync(path.join(dir, f)); return { name: f, isDir: stat.isDirectory(), size: stat.size, mtime: stat.mtime.toISOString() }; } catch { return { name: f, isDir: false, size: 0, mtime: '' }; }
      });
      res.json(files);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/workspace/:dir/:file', (req, res) => {
    try {
      const file = path.join(WORKSPACE_DIR, path.basename(req.params.dir), path.basename(req.params.file));
      if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
      const content = fs.readFileSync(file, 'utf8');
      if (req.params.file.endsWith('.json')) {
        try { res.json({ content: JSON.parse(content), raw: content, isJson: true }); } catch { res.json({ content, raw: content, isJson: false }); }
      } else { res.json({ content, raw: content, isJson: false }); }
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/stats', (req, res) => {
    const WS_DIRS = ['leads', 'conteudo', 'produtos', 'paginas', 'campanhas', 'emails', 'clientes', 'propostas'];
    const counts = {};
    for (const dir of WS_DIRS) counts[dir] = safeReadDir(path.join(WORKSPACE_DIR, dir)).filter(f => !f.startsWith('.')).length;
    counts.reports = safeReadDir(REPORTS_DIR).filter(f => f.endsWith('.md')).length;
    counts.pendentes = safeReadDir(PENDENTES_DIR).filter(f => f.endsWith('.json')).length;
    let lastCycle = null, lastError = null, totalErrors = 0, totalJobs = 0;
    if (fs.existsSync(LOGS_FILE)) {
      const lines = fs.readFileSync(LOGS_FILE, 'utf8').split('\n').filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lastCycle && lines[i].includes('=== CICLO')) lastCycle = lines[i];
        if (!lastError && lines[i].includes('ERRO')) lastError = lines[i];
        if (lines[i].includes('ERRO')) totalErrors++;
        if (lines[i].includes('runJob →')) totalJobs++;
      }
    }
    res.json({ counts, lastCycle, lastError, totalErrors, totalJobs });
  });

  app.get('/api/status', (req, res) => {
    res.json({ disabled: fs.existsSync(DISABLED_FILE) });
  });

  app.post('/api/toggle-disabled', (req, res) => {
    try {
      if (fs.existsSync(DISABLED_FILE)) { fs.unlinkSync(DISABLED_FILE); res.json({ disabled: false }); }
      else { fs.writeFileSync(DISABLED_FILE, 'disabled by web ui\n'); res.json({ disabled: true }); }
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/cycle', (req, res) => {
    try {
      const { cycle } = req.body;
      if (!['segunda', 'diario', 'sexta'].includes(cycle)) return res.status(400).json({ error: 'Invalid cycle' });
      const { spawn } = require('child_process');
      const schedulerPath = path.join(STUDIO_ROOT, 'studio-scheduler.js');
      const child = spawn('node', [schedulerPath, `--cycle=${cycle}`], { detached: true, stdio: 'ignore', cwd: STUDIO_ROOT });
      child.unref();
      res.json({ started: true, pid: child.pid, cycle });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // === ORCHESTRATOR API ===
  app.get('/api/orchestrator/status', (req, res) => {
    try {
      if (!orchestrator) {
        return res.json({ pipeline: [], historico: [], eventos: [], configurado: false });
      }
      res.json(orchestrator.status());
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/orchestrator/run', async (req, res) => {
    try {
      if (!orchestrator) {
        return res.status(503).json({ error: 'Orchestrator não disponível' });
      }
      const { spawn } = require('child_process');
      const orchPath = path.join(STUDIO_ROOT, 'core', 'orchestrator', 'run.js');
      if (fs.existsSync(orchPath)) {
        const child = spawn('node', [orchPath], { detached: true, stdio: 'ignore', cwd: STUDIO_ROOT });
        child.unref();
        res.json({ started: true, pid: child.pid });
      } else {
        // Executa inline (modo dev)
        const result = await orchestrator.executarPipelineCompleto();
        res.json({ ok: true, pipeline: result });
      }
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/orchestrator/pipeline', (req, res) => {
    try {
      const memory = require(path.join(STUDIO_ROOT, 'core', 'memory'));
      res.json(memory.listarPipeline());
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Studio IA API na porta ${PORT}`);
});
