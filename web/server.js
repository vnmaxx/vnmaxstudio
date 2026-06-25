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
      headers: { 'Content-Type': 'application/json', 'x-bridge-secret': BRIDGE_SECRET },
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

  app.get('/api/logs', async (req, res) => {
    const { status, data } = await bridge('GET', '/logs');
    res.status(status).json(data);
  });

  app.get('/api/stats', async (req, res) => {
    const { status, data } = await bridge('GET', '/stats');
    res.status(status).json(data);
  });

  app.get('/api/status', async (req, res) => {
    const { status, data } = await bridge('GET', '/status');
    res.status(status).json(data);
  });

  app.post('/api/toggle-disabled', async (req, res) => {
    const { status, data } = await bridge('POST', '/toggle-disabled');
    res.status(status).json(data);
  });

  app.get('/api/relatorios', async (req, res) => {
    const { status, data } = await bridge('GET', '/relatorios');
    res.status(status).json(data);
  });

  app.get('/api/relatorios/:filename', async (req, res) => {
    const { status, data } = await bridge('GET', `/relatorios/${req.params.filename}`);
    res.status(status).json(data);
  });

  app.get('/api/pendentes', async (req, res) => {
    const { status, data } = await bridge('GET', '/pendentes');
    res.status(status).json(data);
  });

  app.get('/api/pendentes/:id', async (req, res) => {
    const { status, data } = await bridge('GET', `/pendentes/${req.params.id}`);
    res.status(status).json(data);
  });

  app.post('/api/aprovar/:id', async (req, res) => {
    const { status, data } = await bridge('POST', `/aprovar/${req.params.id}`);
    res.status(status).json(data);
  });

  app.post('/api/rejeitar/:id', async (req, res) => {
    const { status, data } = await bridge('POST', `/rejeitar/${req.params.id}`, req.body);
    res.status(status).json(data);
  });

  app.post('/api/aprovar-todos', async (req, res) => {
    const { status, data } = await bridge('POST', '/aprovar-todos');
    res.status(status).json(data);
  });

  app.get('/api/workspace', async (req, res) => {
    const { status, data } = await bridge('GET', '/workspace');
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
    const { status, data } = await bridge('POST', '/cycle', req.body);
    res.status(status).json(data);
  });

  app.get('/api/agents', (req, res) => res.json({}));

} else {
  const STUDIO_ROOT = process.env.STUDIO_ROOT || path.join(__dirname, '..');

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

  function safeReadDir(dir) {
    try { if (!fs.existsSync(dir)) return []; return fs.readdirSync(dir); } catch { return []; }
  }

  app.get('/api/agents', (req, res) => {
    try { res.json(agentsModule.AGENTS || agentsModule.default || agentsModule); } catch (e) { res.status(500).json({ error: e.message }); }
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
    try { res.json({ ok: true, conteudo: await aprovacoes.aprovar(req.params.id) }); } catch (e) { res.status(500).json({ error: e.message }); }
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
