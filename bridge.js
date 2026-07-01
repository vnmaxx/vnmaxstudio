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

let crm = null;
let CRM_STAGES = ['NOVO', 'CONTATADO', 'RESPONDEU', 'QUALIFICADO', 'PROPOSTA', 'FECHADO', 'PERDIDO'];
try {
  const mod = require(path.join(ROOT, 'lib', 'crm.js'));
  crm = new mod.Crm(WORKSPACE);
  CRM_STAGES = mod.STAGES;
} catch (e) { console.error('CRM indisponível:', e.message); }

let leadgen = null;
try {
  leadgen = new (require(path.join(ROOT, 'lib', 'leadgen.js')).Leadgen)(WORKSPACE);
} catch (e) { console.error('Leadgen indisponível:', e.message); }

let pendencias = null, sites = null, deployMod = null, fbProvision = null, publishMod = null;
try {
  pendencias = new (require(path.join(ROOT, 'lib', 'pendencias.js')).Pendencias)(WORKSPACE);
  publishMod = require(path.join(ROOT, 'lib', 'publish.js'));
  sites = new publishMod.Sites(WORKSPACE);
  deployMod = require(path.join(ROOT, 'lib', 'deploy.js'));
  fbProvision = require(path.join(ROOT, 'lib', 'firebase-provision.js'));
} catch (e) { console.error('Publish/deploy indisponível:', e.message); }

let vnmaxStore = null, vnmaxMod = null;
try { vnmaxMod = require(path.join(ROOT, 'lib', 'vnmax.js')); vnmaxStore = new vnmaxMod.VnmaxStore(WORKSPACE); } catch (e) { console.error('VNMAX indisponível:', e.message); }
function vnmaxCfg() { try { return vnmaxStore ? vnmaxStore.load() : null; } catch { return null; } }

let ciclosStore = null, ciclosMod = null;
try { ciclosMod = require(path.join(ROOT, 'lib', 'ciclos.js')); ciclosStore = new ciclosMod.Ciclos(WORKSPACE); } catch (e) { console.error('Ciclos indisponível:', e.message); }

function readEnvKey(name) {
  if (process.env[name]) return process.env[name];
  try {
    const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    const m = env.match(new RegExp('^' + name + '=(.*)$', 'm'));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch {}
  return '';
}

const NXS_KEY = readEnvKey('NXS_STUDIO_KEY');

let social = null;
try {
  const mod = require(path.join(ROOT, 'lib', 'social', 'index.js'));
  social = new mod.SocialHub(WORKSPACE);
} catch (e) { console.error('Social Hub indisponível:', e.message); }

let sdr = { sdrTask: () => '', parseMsgBlocks: () => [], firstDraft: () => null };
try { sdr = require(path.join(ROOT, 'lib', 'sdr.js')); } catch (e) { console.error('SDR helpers indisponíveis:', e.message); }

let conteudo = null;
try {
  const m = require(path.join(ROOT, 'lib', 'conteudo.js'));
  conteudo = new m.Conteudo(WORKSPACE);
} catch (e) { console.error('Conteudo indisponível:', e.message); }

let clienteWs = null;
try {
  const m = require(path.join(ROOT, 'lib', 'cliente-workspace.js'));
  clienteWs = new m.ClienteWorkspace(WORKSPACE, crm, conteudo);
} catch (e) { console.error('ClienteWorkspace indisponível:', e.message); }

let _syncTimer = null;
function scheduleClienteSync() {
  if (!clienteWs) return;
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    _syncTimer = null;
    try { clienteWs.syncAll(); } catch (e) { console.error('Falha ao materializar clientes:', e.message); }
  }, 4000);
}

app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method) && (req.path.startsWith('/conteudo') || req.path.startsWith('/crm'))) {
    res.on('finish', () => { if (res.statusCode < 400) scheduleClienteSync(); });
  }
  next();
});

let viral = null, bp = null;
try { viral = require(path.join(ROOT, 'lib', 'viral-engine.js')); } catch (e) { console.error('viral-engine indisponível:', e.message); }
try { bp = require(path.join(ROOT, 'lib', 'blueprint.js')); } catch (e) { console.error('blueprint indisponível:', e.message); }
let prod = null;
try { prod = require(path.join(ROOT, 'lib', 'produtos.js')); } catch (e) { console.error('produtos indisponível:', e.message); }

let vp = null;
try { vp = require(path.join(ROOT, 'lib', 'video-pipeline.js')); } catch (e) { console.error('video-pipeline indisponível:', e.message); }
let multerLib = null;
try { multerLib = require(path.join(ROOT, 'node_modules', 'multer')); } catch { try { multerLib = require('multer'); } catch (e) { console.error('multer indisponível (rode o setup):', e.message); } }

function autoDetectStorage() {
  const bases = ['/mnt', '/media', path.join('/media', process.env.USER || 'v'), '/srv', '/media/usb'];
  const seen = new Set();
  const cands = [];
  let rootDev = '';
  try { rootDev = String(fs.statSync('/').dev); } catch {}
  for (const base of bases) {
    let entries = [];
    try { entries = fs.readdirSync(base); } catch { continue; }
    for (const e of entries) {
      const p = path.join(base, e);
      if (seen.has(p)) continue; seen.add(p);
      try {
        const st = fs.statSync(p);
        if (!st.isDirectory()) continue;
        if (rootDev && String(st.dev) === rootDev) continue;
        const f = fs.statfsSync(p);
        const total = f.blocks * f.bsize, free = f.bavail * f.bsize;
        if (total > 1e9) cands.push({ p, free, total });
      } catch {}
    }
  }
  cands.sort((a, b) => b.free - a.free);
  for (const c of cands) { try { fs.accessSync(c.p, fs.constants.W_OK); return c.p; } catch {} }
  return null;
}

function resolveVideoDir() {
  const env = readEnvKey('VIDEO_STORAGE_DIR');
  if (env) return env;
  const sd = autoDetectStorage();
  if (sd) return path.join(sd, 'studio-video');
  return path.join(WORKSPACE, 'video');
}

const VIDEO_DIR = resolveVideoDir();
try { fs.mkdirSync(VIDEO_DIR, { recursive: true }); } catch (e) { console.error('VIDEO_DIR mkdir:', e.message); }
console.log('Video storage:', VIDEO_DIR);
try { if (vp && vp.pruneOldJobs) vp.pruneOldJobs(VIDEO_DIR, 40); } catch {}

let videoUpload = null;
if (multerLib) {
  const storage = multerLib.diskStorage({
    destination: (req, file, cb) => {
      if (!req._vjid) req._vjid = 'vid-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
      const dir = path.join(VIDEO_DIR, req._vjid, 'src');
      try { fs.mkdirSync(dir, { recursive: true }); } catch {}
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + String(file.originalname || 'clip').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-50)),
  });
  videoUpload = multerLib({ storage, limits: { fileSize: 200 * 1024 * 1024, files: 8 } });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function nxsRequest(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: AGENTS_HOST, port: AGENTS_PORT, path: pathname, method,
      headers: { 'Authorization': `Bearer ${NXS_KEY}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);
    const r = http.request(options, (resp) => {
      let data = '';
      resp.on('data', c => (data += c));
      resp.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = { raw: data }; }
        if (resp.statusCode >= 200 && resp.statusCode < 300) resolve(parsed);
        else reject(new Error(`nxs HTTP ${resp.statusCode}: ${data.slice(0, 200)}`));
      });
    });
    r.on('error', reject);
    r.on('timeout', () => r.destroy(new Error('nxs timeout')));
    if (payload) r.write(payload);
    r.end();
  });
}

async function criarJob(agent, task, tries = 5) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await nxsRequest('POST', '/v1/jobs', { agent, task });
      const jobId = r.jobId || r.id;
      if (!jobId) throw new Error(`resposta sem jobId: ${JSON.stringify(r).slice(0, 160)}`);
      return jobId;
    } catch (e) {
      const is429 = /HTTP 429/.test(e.message || '');
      if (is429 && attempt < tries) {
        const wait = Math.min(30000, 4000 * attempt);
        console.log(`429 ao criar job (${agent}) — retry em ${wait}ms (${attempt}/${tries - 1})`);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
}

const AUTO_DRAFT_ENABLED = readEnvKey('AUTO_DRAFT') !== '0';
const draftQueue = [];
const draftAttempts = new Map();
const DRAFT_COOLDOWN_MS = 15 * 60 * 1000;
const DRAFT_TICK_MS = 20 * 1000;
let draftBusy = false;

async function generateDraftFor(lead) {
  const jobId = await criarJob('studio-sdr', sdr.sdrTask(lead, vnmaxCfg()));
  const started = Date.now();
  while (Date.now() - started < 150000) {
    await sleep(5000);
    let s;
    try { s = await nxsRequest('GET', `/v1/jobs/${jobId}`); } catch { continue; }
    if (s.status === 'done') return sdr.firstDraft(s.result);
    if (s.status === 'error') throw new Error(String(s.result || 'erro no job'));
  }
  throw new Error('timeout');
}

function nextDraftCandidate() {
  if (!crm) return null;
  let leads;
  try { leads = crm.list(); } catch { return null; }
  while (draftQueue.length) {
    const id = draftQueue.shift();
    const lead = leads.find(l => l.id === id);
    if (lead && lead.stage === 'NOVO' && !lead.rascunho) return lead;
  }
  const now = Date.now();
  return leads.find(l =>
    l.stage === 'NOVO' && !l.rascunho && (!l.historico || l.historico.length === 0) &&
    (!draftAttempts.has(l.id) || now - draftAttempts.get(l.id) > DRAFT_COOLDOWN_MS)
  ) || null;
}

async function draftTick() {
  if (draftBusy || !AUTO_DRAFT_ENABLED || !crm || !NXS_KEY) return;
  const lead = nextDraftCandidate();
  if (!lead) return;
  draftBusy = true;
  draftAttempts.set(lead.id, Date.now());
  try {
    const msg = await generateDraftFor(lead);
    if (msg && msg.mensagem) {
      crm.setRascunho(lead.id, { ...msg, origem: 'auto' });
      console.log(`auto-draft: rascunho gerado para ${lead.id}`);
    }
  } catch (e) {
    console.error(`auto-draft ${lead.id}: ${e.message}`);
  } finally {
    draftBusy = false;
  }
}

if (AUTO_DRAFT_ENABLED) {
  setInterval(() => { draftTick().catch(() => {}); }, DRAFT_TICK_MS);
}

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
    try {
      if (crm) {
        const tipo = String(data.tipo || '').toLowerCase();
        const texto = typeof data.conteudo === 'string' ? data.conteudo : JSON.stringify(data.conteudo || '');
        const isProposta = tipo.includes('proposta') || tipo.includes('pacote');
        crm.matchAndRecord(texto, { tipo: isProposta ? 'proposta' : 'mensagem', canal: data.canal || '', etapa: 'aprovado', texto });
      }
    } catch (e) { console.error('CRM hook aprovar:', e.message); }
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

app.get('/leadgen', (req, res) => {
  try {
    if (!leadgen) return res.status(503).json({ error: 'Leadgen indisponível' });
    res.json(leadgen.status());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/leadgen', (req, res) => {
  try {
    if (!leadgen) return res.status(503).json({ error: 'Leadgen indisponível' });
    res.json(leadgen.save(req.body || {}));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/vnmax', (req, res) => {
  try {
    if (!vnmaxStore) return res.status(503).json({ error: 'VNMAX indisponível' });
    res.json(vnmaxStore.status());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/vnmax', (req, res) => {
  try {
    if (!vnmaxStore) return res.status(503).json({ error: 'VNMAX indisponível' });
    vnmaxStore.save(req.body || {});
    res.json(vnmaxStore.status());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/clientes/sync', (req, res) => {
  try {
    if (!clienteWs) return res.status(503).json({ error: 'Materialização indisponível' });
    res.json(clienteWs.syncAll());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/clientes/:id/sync', (req, res) => {
  try {
    if (!clienteWs) return res.status(503).json({ error: 'Materialização indisponível' });
    const r = clienteWs.syncOne(req.params.id);
    if (!r) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/pendencias', (req, res) => {
  try {
    if (!pendencias) return res.json({ itens: [] });
    const itens = pendencias.list(req.query.clienteId).filter(i => req.query.todas === '1' || i.status !== 'resolvido');
    res.json({ itens });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/pendencias/:id/resolve', (req, res) => {
  try {
    if (!pendencias) return res.status(503).json({ error: 'indisponível' });
    const it = pendencias.resolve(req.params.id);
    if (!it) return res.status(404).json({ error: 'Not found' });
    res.json(it);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/pendencias/:id', (req, res) => {
  try {
    if (!pendencias) return res.status(503).json({ error: 'indisponível' });
    res.json({ ok: pendencias.remove(req.params.id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/firebase/status', async (req, res) => {
  try {
    if (!fbProvision) return res.json({ ok: false, configurado: false, error: 'módulo indisponível' });
    res.json(await fbProvision.checkAuth());
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.get('/publicar/:clienteId', (req, res) => {
  try {
    if (!sites) return res.status(503).json({ error: 'indisponível' });
    res.json({ site: sites.get(req.params.clienteId), pendencias: pendencias ? pendencias.list(req.params.clienteId).filter(i => i.status !== 'resolvido') : [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/publicar/:clienteId', async (req, res) => {
  try {
    if (!deployMod || !sites || !pendencias || !publishMod) return res.status(503).json({ error: 'Publicação indisponível' });
    const clienteId = req.params.clienteId;
    const lead = crm ? crm.list().find(l => l.id === clienteId) : null;
    const nome = (lead && lead.nome) || (req.body && req.body.nome) || clienteId;

    let html = req.body && req.body.html;
    if (!html && conteudo) {
      const prods = conteudo.listProdutos(clienteId).filter(p => p.formato === 'html' || /<(!doctype|html)/i.test(String(p.conteudo || '')));
      if (prods[0]) html = prods[0].conteudo;
    }
    if (!html) {
      pendencias.add(clienteId, { chave: 'gerar-landing', titulo: 'Gerar a landing do cliente', detalhe: 'Nenhuma landing HTML encontrada — gere em Clientes › Produção › Produtos › Landing Page.', tipo: 'bloqueio', prioridade: 'alta' });
      return res.status(400).json({ error: 'Nenhuma landing HTML encontrada. Gere a landing primeiro.' });
    }

    const token = readEnvKey('VERCEL_TOKEN');
    if (!token) return res.status(503).json({ error: 'VERCEL_TOKEN não configurado no servidor' });
    const teamId = readEnvKey('VERCEL_TEAM_ID') || null;

    let firebase = null;
    const querFirebase = !(req.body && req.body.firebase === false);
    if (querFirebase && fbProvision && fbProvision.isConfigured()) {
      try {
        const existente = sites.get(clienteId);
        if (existente && existente.firebase && existente.firebase.appId) firebase = existente.firebase;
        else {
          const r = await fbProvision.createWebApp({ displayName: `VNMAX Studio — ${nome}` });
          firebase = { projectId: r.projectId, appId: r.appId, config: r.config };
        }
        html = publishMod.injectFirebase(html, firebase.config, clienteId);
        pendencias.add(clienteId, { chave: 'firebase-rules', titulo: 'Liberar captura de leads no Firestore', detalhe: `No projeto ${firebase.projectId}, permita create na coleção leads_${String(clienteId).toLowerCase().replace(/[^a-z0-9_]+/g, '_')} nas regras do Firestore.`, tipo: 'firebase', prioridade: 'media' });
      } catch (e) {
        pendencias.add(clienteId, { chave: 'firebase-app', titulo: 'Conectar Firebase', detalhe: `Falha ao criar app no Firebase: ${e.message}`, tipo: 'firebase', prioridade: 'media' });
      }
    } else if (querFirebase) {
      pendencias.add(clienteId, { chave: 'firebase-sa', titulo: 'Configurar service account do Firebase', detalhe: 'Defina FIREBASE_SA_PATH no servidor para criar apps e captar leads automaticamente.', tipo: 'firebase', prioridade: 'baixa' });
    }

    const nomeProj = `${deployMod.slugProject(nome)}-${String(clienteId).slice(-4)}`;
    const dep = await deployMod.publishLanding({ token, teamId, project: nomeProj, html });

    const info = sites.set(clienteId, { url: dep.url, deployUrl: dep.deployUrl, project: dep.project, deploymentId: dep.deploymentId, firebase, estado: dep.state, publicadoEm: new Date().toISOString() });

    pendencias.add(clienteId, { chave: 'dominio', titulo: 'Apontar domínio próprio (opcional)', detalhe: `Conecte um domínio do cliente ao projeto ${dep.project} no Vercel.`, tipo: 'dominio', prioridade: 'baixa' });
    pendencias.add(clienteId, { chave: 'revisar-copy', titulo: 'Revisar textos e contatos da landing', detalhe: 'Confira telefone/WhatsApp, endereço e ofertas antes de divulgar.', tipo: 'revisao', prioridade: 'media' });

    let mensagem = null;
    try {
      if (dep.ok && crm && lead && vnmaxMod) {
        mensagem = vnmaxMod.mensagemEntrega(lead, dep.url, vnmaxCfg());
        crm.setRascunho(clienteId, { canal: lead.canal || 'whatsapp', etapa: 'entrega', mensagem, objetivo: 'Enviar o site pronto ao cliente', origem: 'publicacao' });
      }
    } catch {}

    try { if (clienteWs) clienteWs.syncOne(clienteId); } catch {}

    res.json({ ok: dep.ok, url: dep.url, deployUrl: dep.deployUrl, project: dep.project, firebase: firebase ? { projectId: firebase.projectId, appId: firebase.appId } : null, mensagem, pendencias: pendencias.list(clienteId).filter(i => i.status !== 'resolvido'), site: info });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/ciclos', (req, res) => {
  try {
    if (!ciclosStore) return res.status(503).json({ error: 'Ciclos indisponível' });
    res.json(ciclosStore.status());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/ciclos', (req, res) => {
  try {
    if (!ciclosStore) return res.status(503).json({ error: 'Ciclos indisponível' });
    res.json(ciclosStore.addCustom(req.body || {}));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/ciclos/:id', (req, res) => {
  try {
    if (!ciclosStore) return res.status(503).json({ error: 'Ciclos indisponível' });
    res.json({ ok: ciclosStore.removeCustom(req.params.id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/ciclos/:id/steps', (req, res) => {
  try {
    if (!ciclosStore) return res.status(503).json({ error: 'Ciclos indisponível' });
    const b = req.body || {};
    const s = ciclosStore.addStep(req.params.id, b, b.index);
    if (!s) return res.status(404).json({ error: 'Ciclo não encontrado' });
    res.json(s);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/ciclos/:id/steps/:stepId', (req, res) => {
  try {
    if (!ciclosStore) return res.status(503).json({ error: 'Ciclos indisponível' });
    res.json({ ok: ciclosStore.removeStep(req.params.id, req.params.stepId) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/cycle', (req, res) => {
  const { cycle } = req.body;
  const valido = ['segunda', 'diario', 'sexta'].includes(cycle) || (ciclosStore && ciclosStore.getCustom(cycle));
  if (!valido) {
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

const AGENTS_OVERRIDES_FILE = '/home/v/nxs-agents/lib/agents-overrides.json';

function loadAgentOverrides() {
  try { return JSON.parse(fs.readFileSync(AGENTS_OVERRIDES_FILE, 'utf8')); } catch { return {}; }
}

app.get('/agents', (req, res) => {
  try {
    const { AGENTS } = require('/home/v/nxs-agents/lib/agents.js');
    const overrides = loadAgentOverrides();
    const normalized = {};
    const names = new Set([...Object.keys(AGENTS), ...Object.keys(overrides)]);
    for (const name of names) {
      const base = AGENTS[name] || {};
      const over = overrides[name] || {};
      const merged = { ...base, ...over };
      normalized[name] = {
        model: merged.model || 'sonnet',
        maxTurns: merged.maxTurns || 40,
        tools: merged.tools || { shell: false, web: false, edit: false, read: false },
        system: merged.system || merged.systemPrompt || '',
        icon: merged.icon || '',
        custom: !AGENTS[name],
      };
    }
    res.json(normalized);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/agents/:name', (req, res) => {
  try {
    const { name } = req.params;
    const patch = req.body || {};
    const overrides = loadAgentOverrides();
    overrides[name] = { ...(overrides[name] || {}), ...patch };
    fs.writeFileSync(AGENTS_OVERRIDES_FILE, JSON.stringify(overrides, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get(/^\/workspace-browse\/(.*)$/, (req, res) => {
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

const PIPELINES_DIR = path.join(WORKSPACE, 'pipelines');

function readPipelineFiles(limit) {
  try {
    if (!fs.existsSync(PIPELINES_DIR)) return [];
    return fs.readdirSync(PIPELINES_DIR)
      .filter(f => f.startsWith('pipeline-') && f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(PIPELINES_DIR, f), 'utf8')); } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const ta = a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const tb = b.startedAt ? new Date(b.startedAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, limit || 200);
  } catch { return []; }
}

app.get('/pipelines', (req, res) => {
  const all = readPipelineFiles(200);
  res.json({
    running: all.filter(p => p.state === 'RUNNING' || p.state === 'WAITING' || p.state === 'RETRY'),
    history: all.filter(p => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(p.state)).slice(0, 50),
  });
});

app.get('/pipelines/metrics', (req, res) => {
  const all = readPipelineFiles(200);
  const completed = all.filter(p => p.state === 'COMPLETED');
  const failed = all.filter(p => p.state === 'FAILED');
  const durations = completed.filter(p => p.metrics && p.metrics.totalDurationMs).map(p => p.metrics.totalDurationMs);
  const avgDurationMs = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const totalRetries = all.reduce((s, p) => s + (p.metrics ? p.metrics.retries || 0 : 0), 0);
  const last24h = all.filter(p => p.startedAt && Date.now() - new Date(p.startedAt).getTime() < 86400000);
  const stepStats = {};
  for (const p of all) {
    for (const s of (p.steps || [])) {
      if (!stepStats[s.name]) stepStats[s.name] = { total: 0, completed: 0, failed: 0, totalMs: 0 };
      stepStats[s.name].total++;
      if (s.state === 'COMPLETED') { stepStats[s.name].completed++; stepStats[s.name].totalMs += s.durationMs || 0; }
      if (s.state === 'FAILED') stepStats[s.name].failed++;
    }
  }
  res.json({
    total: all.length, completed: completed.length, failed: failed.length,
    running: all.filter(p => p.state === 'RUNNING').length,
    last24h: last24h.length, avgDurationMs, totalRetries,
    successRate: all.length > 0 ? Math.round(completed.length / all.length * 100) : 0,
    stepStats,
  });
});

app.get('/pipelines/:id', (req, res) => {
  try {
    const file = path.join(PIPELINES_DIR, `pipeline-${req.params.id}.json`);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
    res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/crm', (req, res) => {
  try {
    if (!crm) return res.json({ leads: [], stages: CRM_STAGES });
    crm.syncFromLeads();
    res.json({ leads: crm.list(), stages: CRM_STAGES });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/crm/import', (req, res) => {
  try {
    if (!crm) return res.status(503).json({ error: 'CRM indisponível' });
    res.json(crm.syncFromLeads());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/crm/dedupe', (req, res) => {
  try {
    if (!crm) return res.status(503).json({ error: 'CRM indisponível' });
    res.json(crm.dedupe());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/crm/lead', (req, res) => {
  try {
    if (!crm) return res.status(503).json({ error: 'CRM indisponível' });
    const r = crm.upsertLead(req.body || {}, 'manual');
    if (!r) return res.status(400).json({ error: 'dados inválidos' });
    res.json(r.lead);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/crm/:id/stage', (req, res) => {
  try {
    if (!crm) return res.status(503).json({ error: 'CRM indisponível' });
    const lead = crm.setStage(req.params.id, (req.body || {}).stage);
    if (!lead) return res.status(404).json({ error: 'Not found ou stage inválido' });
    res.json(lead);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/crm/:id/contato', (req, res) => {
  try {
    if (!crm) return res.status(503).json({ error: 'CRM indisponível' });
    const lead = crm.recordContact(req.params.id, req.body || {});
    if (!lead) return res.status(404).json({ error: 'Not found' });
    res.json(lead);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/crm/:id', (req, res) => {
  try {
    if (!crm) return res.status(503).json({ error: 'CRM indisponível' });
    res.json({ ok: crm.remove(req.params.id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/crm/:id/sugerir', async (req, res) => {
  try {
    if (!crm) return res.status(503).json({ error: 'CRM indisponível' });
    if (!NXS_KEY) return res.status(503).json({ error: 'NXS_STUDIO_KEY ausente' });
    const lead = crm.list().find(l => l.id === req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
    const jobId = await criarJob('studio-sdr', sdr.sdrTask(lead, vnmaxCfg()));
    res.json({ jobId });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/crm/sugestao/:jobId', async (req, res) => {
  try {
    if (!NXS_KEY) return res.status(503).json({ error: 'NXS_STUDIO_KEY ausente' });
    const r = await nxsRequest('GET', `/v1/jobs/${req.params.jobId}`);
    if (r.status === 'done') {
      const texto = typeof r.result === 'string' ? r.result : JSON.stringify(r.result);
      return res.json({ status: 'done', mensagens: sdr.parseMsgBlocks(texto) });
    }
    if (r.status === 'error') return res.json({ status: 'error', error: String(r.result || 'erro') });
    res.json({ status: r.status || 'pending' });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.post('/crm/:id/enviar', async (req, res) => {
  try {
    if (!crm) return res.status(503).json({ error: 'CRM indisponível' });
    if (!social) return res.status(503).json({ error: 'Social Hub indisponível' });
    const lead = crm.list().find(l => l.id === req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
    const { texto, modo, canal, recipient, assunto } = req.body || {};
    if (!texto) return res.status(400).json({ error: 'texto obrigatório' });
    const alvo = recipient || lead.contato;
    const canalUsar = canal || lead.canal;

    const r = await social.send({ canal: canalUsar, recipient: alvo, texto, assunto, modo });
    if (r.ok) {
      crm.recordContact(lead.id, { tipo: 'mensagem', canal: r.mode === 'link' ? 'whatsapp' : canalUsar, etapa: 'enviado', texto });
      crm.clearRascunho(lead.id);
    }
    const atualizado = crm.list().find(l => l.id === lead.id);
    res.json({ ok: r.ok, mode: r.mode, link: r.link, detail: r.detail, error: r.error, lead: atualizado });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/social', (req, res) => {
  if (!social) return res.json([]);
  res.json(social.status());
});

app.post('/social/:id/connect', (req, res) => {
  if (!social) return res.status(503).json({ error: 'Social Hub indisponível' });
  const s = social.connect(req.params.id, req.body || {});
  if (!s) return res.status(404).json({ error: 'Provider desconhecido' });
  res.json(s);
});

app.post('/social/:id/test', async (req, res) => {
  if (!social) return res.status(503).json({ error: 'Social Hub indisponível' });
  res.json(await social.test(req.params.id));
});

app.post('/social/:id/disconnect', (req, res) => {
  if (!social) return res.status(503).json({ error: 'Social Hub indisponível' });
  res.json(social.disconnect(req.params.id));
});

app.get('/social/meta/oauth-url', (req, res) => {
  if (!social) return res.status(503).json({ error: 'Social Hub indisponível' });
  const url = social.metaOauthUrl(req.query.redirect || '', 'meta');
  if (!url) return res.status(400).json({ error: 'Preencha o App ID do Meta e salve primeiro.' });
  res.json({ url });
});

app.post('/social/meta/exchange', async (req, res) => {
  if (!social) return res.status(503).json({ error: 'Social Hub indisponível' });
  const { code, redirectUri } = req.body || {};
  if (!code || !redirectUri) return res.status(400).json({ error: 'code/redirectUri ausentes' });
  res.json(await social.metaExchange(code, redirectUri));
});

app.post('/conteudo/roteiros/gerar', async (req, res) => {
  try {
    if (!viral) return res.status(503).json({ error: 'viral-engine indisponível' });
    if (!NXS_KEY) return res.status(503).json({ error: 'NXS_STUDIO_KEY ausente' });
    const { cliente, theme, count, durationSec, platform, storytelling } = req.body || {};
    const task = viral.buildRoteiristaTask(cliente || {}, { theme, count, durationSec, platform, storytelling });
    const jobId = await criarJob('general', task);
    res.json({ jobId });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/conteudo/roteiros/job/:jobId', async (req, res) => {
  try {
    if (!NXS_KEY) return res.status(503).json({ error: 'NXS_STUDIO_KEY ausente' });
    const r = await nxsRequest('GET', `/v1/jobs/${req.params.jobId}`);
    if (r.status === 'done') {
      const variations = viral ? viral.parseVariations(r.result) : null;
      return res.json({ status: 'done', variations: variations || [], parseError: !variations });
    }
    if (r.status === 'error') return res.json({ status: 'error', error: String(r.result || 'erro') });
    res.json({ status: r.status || 'pending' });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.post('/conteudo/blueprint/gerar', async (req, res) => {
  try {
    if (!bp) return res.status(503).json({ error: 'blueprint indisponível' });
    if (!NXS_KEY) return res.status(503).json({ error: 'NXS_STUDIO_KEY ausente' });
    const task = bp.buildBlueprintTask(req.body && req.body.cliente || {});
    const jobId = await criarJob('general', task);
    res.json({ jobId });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/conteudo/blueprint/job/:jobId', async (req, res) => {
  try {
    if (!NXS_KEY) return res.status(503).json({ error: 'NXS_STUDIO_KEY ausente' });
    const r = await nxsRequest('GET', `/v1/jobs/${req.params.jobId}`);
    if (r.status === 'done') {
      const blueprint = bp ? bp.parseBlueprint(r.result) : null;
      return res.json({ status: 'done', blueprint: blueprint || null, parseError: !blueprint });
    }
    if (r.status === 'error') return res.json({ status: 'error', error: String(r.result || 'erro') });
    res.json({ status: r.status || 'pending' });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/conteudo/perfil/:clienteId', (req, res) => {
  if (!conteudo) return res.status(503).json({ error: 'Conteudo indisponível' });
  res.json(conteudo.getPerfil(req.params.clienteId) || {});
});

app.post('/conteudo/perfil/:clienteId', (req, res) => {
  if (!conteudo) return res.status(503).json({ error: 'Conteudo indisponível' });
  res.json(conteudo.setPerfil(req.params.clienteId, req.body || {}));
});

app.get('/conteudo/roteiros', (req, res) => {
  if (!conteudo) return res.status(503).json({ error: 'Conteudo indisponível' });
  res.json({ roteiros: conteudo.listRoteiros(req.query.clienteId) });
});

app.post('/conteudo/roteiros', (req, res) => {
  if (!conteudo) return res.status(503).json({ error: 'Conteudo indisponível' });
  const { clienteId, theme, variation } = req.body || {};
  if (!variation) return res.status(400).json({ error: 'roteiro vazio' });
  res.json(conteudo.addRoteiro(clienteId || null, theme || '', variation));
});

app.delete('/conteudo/roteiros/:id', (req, res) => {
  if (!conteudo) return res.status(503).json({ error: 'Conteudo indisponível' });
  res.json({ ok: conteudo.removeRoteiro(req.params.id) });
});

app.get('/conteudo/calendario', (req, res) => {
  if (!conteudo) return res.status(503).json({ error: 'Conteudo indisponível' });
  res.json({ calendario: conteudo.listCalendario(req.query.clienteId) });
});

app.post('/conteudo/calendario', (req, res) => {
  if (!conteudo) return res.status(503).json({ error: 'Conteudo indisponível' });
  res.json(conteudo.addCalendario(req.body || {}));
});

app.post('/conteudo/calendario/plan', (req, res) => {
  if (!conteudo) return res.status(503).json({ error: 'Conteudo indisponível' });
  const { clienteId, count, perWeek, themes } = req.body || {};
  res.json({ items: conteudo.planCalendario(clienteId || null, { count, perWeek, themes }) });
});

app.put('/conteudo/calendario/:id', (req, res) => {
  if (!conteudo) return res.status(503).json({ error: 'Conteudo indisponível' });
  const it = conteudo.updateCalendario(req.params.id, req.body || {});
  if (!it) return res.status(404).json({ error: 'Not found' });
  res.json(it);
});

app.delete('/conteudo/calendario/:id', (req, res) => {
  if (!conteudo) return res.status(503).json({ error: 'Conteudo indisponível' });
  res.json({ ok: conteudo.removeCalendario(req.params.id) });
});

app.get('/conteudo/posts', (req, res) => {
  if (!conteudo) return res.status(503).json({ error: 'Conteudo indisponível' });
  res.json({ posts: conteudo.listPosts(req.query.clienteId) });
});

app.post('/conteudo/posts/publicar', (req, res) => {
  if (!conteudo) return res.status(503).json({ error: 'Conteudo indisponível' });
  res.json(conteudo.addPost(req.body || {}));
});

app.delete('/conteudo/posts/:id', (req, res) => {
  if (!conteudo) return res.status(503).json({ error: 'Conteudo indisponível' });
  res.json({ ok: conteudo.removePost(req.params.id) });
});

app.get('/conteudo/blueprints', (req, res) => {
  if (!conteudo) return res.status(503).json({ error: 'Conteudo indisponível' });
  res.json({ blueprints: conteudo.listBlueprints(req.query.clienteId) });
});

app.post('/conteudo/blueprints', (req, res) => {
  if (!conteudo) return res.status(503).json({ error: 'Conteudo indisponível' });
  const { clienteId, blueprint } = req.body || {};
  if (!blueprint) return res.status(400).json({ error: 'blueprint vazio' });
  res.json(conteudo.addBlueprint(clienteId || null, blueprint));
});

app.delete('/conteudo/blueprints/:id', (req, res) => {
  if (!conteudo) return res.status(503).json({ error: 'Conteudo indisponível' });
  res.json({ ok: conteudo.removeBlueprint(req.params.id) });
});

app.post('/conteudo/produtos/gerar', async (req, res) => {
  try {
    if (!prod) return res.status(503).json({ error: 'produtos indisponível' });
    if (!NXS_KEY) return res.status(503).json({ error: 'NXS_STUDIO_KEY ausente' });
    const { cliente, tipo, tema } = req.body || {};
    const task = prod.buildProdutoTask(cliente || {}, tipo || 'landing', { tema });
    const jobId = await criarJob('general', task);
    res.json({ jobId });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/conteudo/produtos/job/:jobId', async (req, res) => {
  try {
    if (!NXS_KEY) return res.status(503).json({ error: 'NXS_STUDIO_KEY ausente' });
    const r = await nxsRequest('GET', `/v1/jobs/${req.params.jobId}`);
    if (r.status === 'done') {
      const produto = prod ? prod.parseProduto(r.result, req.query.tipo) : null;
      return res.json({ status: 'done', produto: produto || null, parseError: !produto });
    }
    if (r.status === 'error') return res.json({ status: 'error', error: String(r.result || 'erro') });
    res.json({ status: r.status || 'pending' });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/conteudo/produtos', (req, res) => {
  if (!conteudo) return res.status(503).json({ error: 'Conteudo indisponível' });
  res.json({ produtos: conteudo.listProdutos(req.query.clienteId) });
});

app.post('/conteudo/produtos', (req, res) => {
  if (!conteudo) return res.status(503).json({ error: 'Conteudo indisponível' });
  const { clienteId, produto } = req.body || {};
  if (!produto) return res.status(400).json({ error: 'produto vazio' });
  res.json(conteudo.addProduto(clienteId || null, produto));
});

app.delete('/conteudo/produtos/:id', (req, res) => {
  if (!conteudo) return res.status(503).json({ error: 'Conteudo indisponível' });
  res.json({ ok: conteudo.removeProduto(req.params.id) });
});

app.post('/video/jobs', (req, res) => {
  if (!videoUpload || !vp) return res.status(503).json({ error: 'Edição de vídeo indisponível — rode o setup (npm i multer ffmpeg-static)' });
  if (vp.freeBytes(VIDEO_DIR) < 800 * 1024 * 1024) return res.status(507).json({ error: 'Pouco espaço em disco no armazenamento de vídeo' });
  videoUpload.array('clips', 8)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const jid = req._vjid;
    if (!jid) return res.status(400).json({ error: 'Nenhum vídeo enviado' });
    let roteiro = {};
    try { roteiro = req.body && req.body.roteiro ? JSON.parse(req.body.roteiro) : {}; } catch {}
    const meta = { id: jid, clienteId: (req.body && req.body.clienteId) || null, titulo: roteiro.title || roteiro.hook || '', criadoEm: new Date().toISOString() };
    try { fs.writeFileSync(path.join(VIDEO_DIR, jid, 'meta.json'), JSON.stringify(meta, null, 2)); } catch {}
    vp.enqueue(path.join(VIDEO_DIR, jid), roteiro);
    res.json({ jobId: jid });
  });
});

app.get('/video/jobs', (req, res) => {
  if (!vp) return res.json({ jobs: [] });
  try {
    const ids = safeReadDir(VIDEO_DIR).filter(d => { try { return fs.statSync(path.join(VIDEO_DIR, d)).isDirectory(); } catch { return false; } });
    const jobs = ids.map(id => {
      const st = vp.readStatus(path.join(VIDEO_DIR, id)) || {};
      let meta = {}; try { meta = JSON.parse(fs.readFileSync(path.join(VIDEO_DIR, id, 'meta.json'), 'utf8')); } catch {}
      return { id, ...meta, ...st };
    }).filter(j => !req.query.clienteId || j.clienteId === req.query.clienteId)
      .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
    res.json({ jobs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/video/jobs/:id', (req, res) => {
  if (!vp) return res.status(503).json({ error: 'indisponível' });
  const st = vp.readStatus(path.join(VIDEO_DIR, path.basename(req.params.id)));
  if (!st) return res.status(404).json({ error: 'Not found' });
  res.json(st);
});

app.get('/video/jobs/:id/final.mp4', (req, res) => {
  const f = path.join(VIDEO_DIR, path.basename(req.params.id), 'final.mp4');
  if (!fs.existsSync(f)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(f);
});

app.delete('/video/jobs/:id', (req, res) => {
  try { fs.rmSync(path.join(VIDEO_DIR, path.basename(req.params.id)), { recursive: true, force: true }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/video/storage', (req, res) => {
  let free = 0, total = 0;
  try { const f = fs.statfsSync(VIDEO_DIR); free = f.bavail * f.bsize; total = f.blocks * f.bsize; } catch {}
  res.json({ dir: VIDEO_DIR, freeGB: +(free / 1e9).toFixed(1), totalGB: +(total / 1e9).toFixed(1) });
});

app.post('/crm/:id/descartar-rascunho', (req, res) => {
  try {
    if (!crm) return res.status(503).json({ error: 'CRM indisponível' });
    const lead = crm.clearRascunho(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Not found' });
    res.json(lead);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/crm/sdr-lote', (req, res) => {
  try {
    if (!crm) return res.status(503).json({ error: 'CRM indisponível' });
    if (!NXS_KEY) return res.status(503).json({ error: 'NXS_STUDIO_KEY ausente' });
    const eligiveis = crm.list().filter(l => l.stage === 'NOVO' && !l.rascunho && (!l.historico || l.historico.length === 0));
    let queued = 0;
    for (const lead of eligiveis) {
      if (!draftQueue.includes(lead.id)) { draftQueue.push(lead.id); queued++; }
    }
    res.json({ ok: true, queued, jaNaFila: eligiveis.length - queued });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/workspace-rename', (req, res) => {
  try {
    const { from, to } = req.body || {};
    if (!Array.isArray(from) || from.length === 0 || !to || typeof to !== 'string') {
      return res.status(400).json({ error: 'parâmetros inválidos' });
    }
    const safeFrom = from.filter(s => s && s !== '..' && s !== '.');
    const src = path.join(WORKSPACE, ...safeFrom);
    const newName = path.basename(to);
    const dest = path.join(path.dirname(src), newName);
    if (!src.startsWith(WORKSPACE) || !dest.startsWith(WORKSPACE)) return res.status(403).json({ error: 'forbidden' });
    if (!fs.existsSync(src)) return res.status(404).json({ error: 'Not found' });
    if (fs.existsSync(dest)) return res.status(409).json({ error: 'Já existe um arquivo com esse nome' });
    fs.renameSync(src, dest);
    res.json({ ok: true, name: newName });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete(/^\/workspace-browse\/(.*)$/, (req, res) => {
  try {
    const segments = req.params[0].split('/').filter(s => s && s !== '..' && s !== '.');
    const target = path.join(WORKSPACE, ...segments);
    if (!target.startsWith(WORKSPACE)) return res.status(403).json({ error: 'forbidden' });
    if (!fs.existsSync(target)) return res.status(404).json({ error: 'Not found' });
    if (fs.statSync(target).isDirectory()) return res.status(400).json({ error: 'Não é possível excluir pastas' });
    fs.unlinkSync(target);
    res.json({ ok: true });
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
  console.log(`VNMAX Studio Bridge rodando na porta ${PORT}`);
  console.log(`STUDIO_ROOT: ${ROOT}`);
  console.log(`Agents: ${AGENTS_HOST}:${AGENTS_PORT}`);
});
