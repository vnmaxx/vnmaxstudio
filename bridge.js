'use strict';
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const SECRET = process.env.BRIDGE_SECRET || '';
const ROOT = process.env.STUDIO_ROOT || path.join(__dirname);
const AGENTS_HOST = process.env.AGENTS_HOST || 'localhost';
const AGENTS_PORT = parseInt(process.env.AGENTS_PORT || '8006');

const WORKSPACE = path.join(ROOT, 'workspace');
const REPORTS = path.join(ROOT, 'workspace', 'reports');
const LOGS_FILE = path.join(ROOT, 'logs', 'scheduler.log');
const PENDENTES = path.join(ROOT, 'workspace', 'aprovacoes', 'pendentes');
const DISABLED_FILE = path.join(ROOT, 'DISABLED');

function auth(req, res, next) {
  if (SECRET && req.headers['x-bridge-secret'] !== SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

function safeReadDir(dir) {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir);
  } catch { return []; }
}

app.use(auth);

app.get('/health', (_, res) => res.json({ ok: true }));

app.get('/logs', (req, res) => {
  try {
    if (!fs.existsSync(LOGS_FILE)) return res.json({ lines: [] });
    const lines = fs.readFileSync(LOGS_FILE, 'utf8').split('\n').filter(Boolean);
    res.json({ lines: lines.slice(-200) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/stats', (req, res) => {
  const WS_DIRS = ['leads', 'conteudo', 'produtos', 'paginas', 'campanhas', 'emails', 'clientes', 'propostas'];
  const counts = {};
  for (const dir of WS_DIRS) {
    counts[dir] = safeReadDir(path.join(WORKSPACE, dir)).filter(f => !f.startsWith('.')).length;
  }
  counts.reports = safeReadDir(REPORTS).filter(f => f.endsWith('.md')).length;
  counts.pendentes = safeReadDir(PENDENTES).filter(f => f.endsWith('.json')).length;

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

app.get('/status', (req, res) => {
  res.json({ disabled: fs.existsSync(DISABLED_FILE) });
});

app.post('/toggle-disabled', (req, res) => {
  try {
    if (fs.existsSync(DISABLED_FILE)) {
      fs.unlinkSync(DISABLED_FILE);
      res.json({ disabled: false });
    } else {
      fs.writeFileSync(DISABLED_FILE, 'disabled by web ui\n');
      res.json({ disabled: true });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/relatorios', (req, res) => {
  try {
    const files = safeReadDir(REPORTS)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const stat = fs.statSync(path.join(REPORTS, f));
        return { name: f, mtime: stat.mtime.toISOString(), size: stat.size };
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
    res.json(files);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/relatorios/:filename', (req, res) => {
  try {
    const file = path.join(REPORTS, path.basename(req.params.filename));
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
    res.json({ name: path.basename(file), content: fs.readFileSync(file, 'utf8') });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/pendentes', (req, res) => {
  try {
    const files = safeReadDir(PENDENTES).filter(f => f.endsWith('.json'));
    const list = files.map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(PENDENTES, f), 'utf8')); } catch { return null; }
    }).filter(Boolean);
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/pendentes/:id', (req, res) => {
  try {
    const file = path.join(PENDENTES, `${req.params.id}.json`);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
    res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/aprovar/:id', (req, res) => {
  try {
    const file = path.join(PENDENTES, `${req.params.id}.json`);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const aprovDir = path.join(ROOT, 'workspace', 'aprovacoes', 'aprovados');
    if (!fs.existsSync(aprovDir)) fs.mkdirSync(aprovDir, { recursive: true });
    fs.writeFileSync(path.join(aprovDir, path.basename(file)), JSON.stringify({ ...data, aprovadoEm: new Date().toISOString() }));
    fs.unlinkSync(file);
    res.json({ ok: true, conteudo: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/rejeitar/:id', (req, res) => {
  try {
    const file = path.join(PENDENTES, `${req.params.id}.json`);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
    fs.unlinkSync(file);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/aprovar-todos', (req, res) => {
  try {
    const files = safeReadDir(PENDENTES).filter(f => f.endsWith('.json'));
    const aprovDir = path.join(ROOT, 'workspace', 'aprovacoes', 'aprovados');
    if (!fs.existsSync(aprovDir)) fs.mkdirSync(aprovDir, { recursive: true });
    let count = 0;
    for (const f of files) {
      const src = path.join(PENDENTES, f);
      const data = JSON.parse(fs.readFileSync(src, 'utf8'));
      fs.writeFileSync(path.join(aprovDir, f), JSON.stringify({ ...data, aprovadoEm: new Date().toISOString() }));
      fs.unlinkSync(src);
      count++;
    }
    res.json({ ok: true, count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/workspace', (req, res) => {
  try {
    const dirs = safeReadDir(WORKSPACE)
      .filter(f => { try { return fs.statSync(path.join(WORKSPACE, f)).isDirectory(); } catch { return false; } })
      .map(name => ({ name, count: safeReadDir(path.join(WORKSPACE, name)).length }));
    res.json(dirs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/workspace/:dir', (req, res) => {
  try {
    const dir = path.join(WORKSPACE, path.basename(req.params.dir));
    const files = safeReadDir(dir).map(f => {
      try {
        const stat = fs.statSync(path.join(dir, f));
        return { name: f, isDir: stat.isDirectory(), size: stat.size, mtime: stat.mtime.toISOString() };
      } catch { return { name: f, isDir: false, size: 0, mtime: '' }; }
    });
    res.json(files);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/workspace/:dir/:file', (req, res) => {
  try {
    const file = path.join(WORKSPACE, path.basename(req.params.dir), path.basename(req.params.file));
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
    const content = fs.readFileSync(file, 'utf8');
    if (req.params.file.endsWith('.json')) {
      try { res.json({ content: JSON.parse(content), raw: content, isJson: true }); } catch { res.json({ content, raw: content, isJson: false }); }
    } else {
      res.json({ content, raw: content, isJson: false });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/cycle', (req, res) => {
  const { cycle } = req.body;
  if (!['segunda', 'diario', 'sexta'].includes(cycle)) {
    return res.status(400).json({ error: 'Ciclo inválido' });
  }
  const { spawn } = require('child_process');
  const schedulerPath = path.join(ROOT, 'studio-scheduler.js');
  const child = spawn('node', [schedulerPath, `--cycle=${cycle}`], {
    detached: true,
    stdio: 'ignore',
    cwd: ROOT,
    env: { ...process.env },
  });
  child.unref();
  res.json({ started: true, pid: child.pid, cycle });
});

app.get('/agents', (req, res) => {
  try {
    const { AGENTS } = require('/home/v/nxs-agents/lib/agents.js');
    const normalized = {};
    for (const [name, agent] of Object.entries(AGENTS)) {
      normalized[name] = { ...agent, system: agent.systemPrompt || agent.system || '' };
    }
    res.json(normalized);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/workspace-browse/*', (req, res) => {
  try {
    const segments = req.params[0].split('/').filter(s => s && s !== '..' && s !== '.');
    const target = path.join(WORKSPACE, ...segments);
    if (!target.startsWith(WORKSPACE)) return res.status(403).json({ error: 'forbidden' });
    if (!fs.existsSync(target)) return res.status(404).json({ error: 'Not found' });
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      const items = safeReadDir(target).map(f => {
        try {
          const s = fs.statSync(path.join(target, f));
          return { name: f, isDir: s.isDirectory(), size: s.size, mtime: s.mtime.toISOString() };
        } catch { return { name: f, isDir: false, size: 0, mtime: '' }; }
      });
      res.json({ type: 'dir', items });
    } else {
      const content = fs.readFileSync(target, 'utf8');
      if (target.endsWith('.json')) {
        try { res.json({ type: 'file', raw: content, isJson: true }); }
        catch { res.json({ type: 'file', raw: content, isJson: false }); }
      } else {
        res.json({ type: 'file', raw: content, isJson: false });
      }
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/agents/:name/run', (req, res) => {
  const body = JSON.stringify(req.body);
  const options = {
    hostname: AGENTS_HOST,
    port: AGENTS_PORT,
    path: `/agents/${req.params.name}/run`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  };
  const agentReq = http.request(options, agentRes => {
    let data = '';
    agentRes.on('data', chunk => data += chunk);
    agentRes.on('end', () => {
      res.status(agentRes.statusCode).set('Content-Type', 'application/json').send(data);
    });
  });
  agentReq.on('error', e => res.status(502).json({ error: e.message }));
  agentReq.write(body);
  agentReq.end();
});

const PORT = process.env.BRIDGE_PORT || 3002;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Studio IA Bridge rodando na porta ${PORT}`);
  console.log(`STUDIO_ROOT: ${ROOT}`);
  console.log(`Agents: ${AGENTS_HOST}:${AGENTS_PORT}`);
});
