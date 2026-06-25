'use strict';
const path = require('path');
// MUST set STUDIO_ROOT before requiring aprovacoes
process.env.STUDIO_ROOT = path.join(__dirname, '..');

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { spawn } = require('child_process');

let aprovacoes;
try {
  aprovacoes = require('../lib/aprovacoes');
} catch (e) {
  // Mock if not available
  aprovacoes = {
    listar: async () => [],
    aprovar: async (id) => ({ conteudo: `Aprovado: ${id}` }),
    rejeitar: async (id, motivo) => ({ motivo }),
    aprovarTodos: async () => ({ count: 0 }),
  };
}

let agentsModule;
try {
  agentsModule = require('../agents');
} catch (e) {
  agentsModule = { AGENTS: {} };
}

const app = express();
app.use(cors());
app.use(express.json());

const STUDIO_ROOT = process.env.STUDIO_ROOT;
const PENDENTES_DIR = path.join(STUDIO_ROOT, 'workspace', 'aprovacoes', 'pendentes');
const REPORTS_DIR = path.join(STUDIO_ROOT, 'workspace', 'reports');
const LOGS_FILE = path.join(STUDIO_ROOT, 'logs', 'scheduler.log');
const WORKSPACE_DIR = path.join(STUDIO_ROOT, 'workspace');
const DISABLED_FILE = path.join(STUDIO_ROOT, 'DISABLED');

function safeReadDir(dir) {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

// GET /api/agents
app.get('/api/agents', (req, res) => {
  try {
    const agents = agentsModule.AGENTS || agentsModule.default || agentsModule;
    res.json(agents);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/pendentes
app.get('/api/pendentes', async (req, res) => {
  try {
    const list = await aprovacoes.listar();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/pendentes/:id
app.get('/api/pendentes/:id', (req, res) => {
  try {
    const file = path.join(PENDENTES_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/aprovar/:id
app.post('/api/aprovar/:id', async (req, res) => {
  try {
    const result = await aprovacoes.aprovar(req.params.id);
    res.json({ ok: true, conteudo: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/rejeitar/:id
app.post('/api/rejeitar/:id', async (req, res) => {
  try {
    const { motivo } = req.body;
    const result = await aprovacoes.rejeitar(req.params.id, motivo || '');
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/aprovar-todos
app.post('/api/aprovar-todos', async (req, res) => {
  try {
    const result = await aprovacoes.aprovarTodos();
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/relatorios
app.get('/api/relatorios', (req, res) => {
  try {
    const files = safeReadDir(REPORTS_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const stat = fs.statSync(path.join(REPORTS_DIR, f));
        return { name: f, mtime: stat.mtime.toISOString(), size: stat.size };
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/relatorios/:filename
app.get('/api/relatorios/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const file = path.join(REPORTS_DIR, filename);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
    const content = fs.readFileSync(file, 'utf8');
    res.json({ name: filename, content });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/logs
app.get('/api/logs', (req, res) => {
  try {
    if (!fs.existsSync(LOGS_FILE)) return res.json({ lines: [] });
    const content = fs.readFileSync(LOGS_FILE, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const last200 = lines.slice(-200);
    res.json({ lines: last200 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/workspace
app.get('/api/workspace', (req, res) => {
  try {
    const dirs = safeReadDir(WORKSPACE_DIR)
      .filter(f => {
        try {
          return fs.statSync(path.join(WORKSPACE_DIR, f)).isDirectory();
        } catch { return false; }
      })
      .map(name => {
        const count = safeReadDir(path.join(WORKSPACE_DIR, name)).length;
        return { name, count };
      });
    res.json(dirs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/workspace/:dir
app.get('/api/workspace/:dir', (req, res) => {
  try {
    const dir = path.join(WORKSPACE_DIR, path.basename(req.params.dir));
    const files = safeReadDir(dir).map(f => {
      try {
        const stat = fs.statSync(path.join(dir, f));
        return { name: f, isDir: stat.isDirectory(), size: stat.size, mtime: stat.mtime.toISOString() };
      } catch {
        return { name: f, isDir: false, size: 0, mtime: '' };
      }
    });
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/workspace/:dir/:file
app.get('/api/workspace/:dir/:file', (req, res) => {
  try {
    const file = path.join(WORKSPACE_DIR, path.basename(req.params.dir), path.basename(req.params.file));
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
    const content = fs.readFileSync(file, 'utf8');
    const isJson = req.params.file.endsWith('.json');
    if (isJson) {
      try {
        res.json({ content: JSON.parse(content), raw: content, isJson: true });
      } catch {
        res.json({ content, raw: content, isJson: false });
      }
    } else {
      res.json({ content, raw: content, isJson: false });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/stats
app.get('/api/stats', (req, res) => {
  const WS_DIRS = ['leads', 'conteudo', 'produtos', 'paginas', 'campanhas', 'emails', 'clientes', 'propostas']
  const counts = {}
  for (const dir of WS_DIRS) {
    counts[dir] = safeReadDir(path.join(WORKSPACE_DIR, dir)).filter(f => !f.startsWith('.')).length
  }
  counts.reports = safeReadDir(REPORTS_DIR).filter(f => f.endsWith('.md')).length
  counts.pendentes = safeReadDir(PENDENTES_DIR).filter(f => f.endsWith('.json')).length

  let lastCycle = null
  let lastError = null
  let totalErrors = 0
  let totalJobs = 0

  if (fs.existsSync(LOGS_FILE)) {
    const lines = fs.readFileSync(LOGS_FILE, 'utf8').split('\n').filter(Boolean)
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lastCycle && lines[i].includes('=== CICLO')) lastCycle = lines[i]
      if (!lastError && lines[i].includes('ERRO')) lastError = lines[i]
      if (lines[i].includes('ERRO')) totalErrors++
      if (lines[i].includes('runJob →')) totalJobs++
    }
  }

  res.json({ counts, lastCycle, lastError, totalErrors, totalJobs })
})

// GET /api/status
app.get('/api/status', (req, res) => {
  const disabled = fs.existsSync(DISABLED_FILE);
  res.json({ disabled, cycle_running: false });
});

// POST /api/toggle-disabled
app.post('/api/toggle-disabled', (req, res) => {
  try {
    if (fs.existsSync(DISABLED_FILE)) {
      fs.unlinkSync(DISABLED_FILE);
      res.json({ disabled: false });
    } else {
      fs.writeFileSync(DISABLED_FILE, 'disabled by web ui\n');
      res.json({ disabled: true });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/cycle
app.post('/api/cycle', (req, res) => {
  try {
    const { cycle } = req.body;
    if (!['segunda', 'diario', 'sexta'].includes(cycle)) {
      return res.status(400).json({ error: 'Invalid cycle' });
    }
    const schedulerPath = path.join(STUDIO_ROOT, 'studio-scheduler.js');
    const child = spawn('node', [schedulerPath, `--cycle=${cycle}`], {
      detached: true,
      stdio: 'ignore',
      cwd: STUDIO_ROOT,
    });
    child.unref();
    res.json({ started: true, pid: child.pid, cycle });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Studio IA API server running on http://localhost:${PORT}`);
  console.log(`STUDIO_ROOT: ${STUDIO_ROOT}`);
});
