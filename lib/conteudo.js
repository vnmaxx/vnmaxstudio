'use strict';
const fs = require('fs');
const path = require('path');

function nowISO() { return new Date().toISOString(); }
function uid(prefix) { return `${prefix || 'c'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
function seedFrom(s) { let h = 0; const str = String(s || 'x'); for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); }

const BASE_THEMES = [
  'erro mais comum no seu nicho',
  'mito que todo mundo acredita',
  'passo a passo rápido',
  'o que ninguém te conta',
  'antes e depois / caso real',
  '3 sinais de que você precisa de ajuda',
  'pergunta que todo cliente faz',
  'bastidor do seu trabalho',
];

function computeMetrics(post, now) {
  const t = now || Date.now();
  const created = post.criadoEm ? new Date(post.criadoEm).getTime() : t;
  const ageH = Math.max(0, (t - created) / 3.6e6);
  const retention = Math.min(1, Math.max(0.4, (post.retencao || 70) / 100));
  const seed = seedFrom(post.id);
  const ceiling = Math.round((1500 + (seed % 9000)) * (0.5 + retention));
  const growth = 1 - Math.exp(-ageH / 30);
  const views = Math.round(ceiling * growth);
  const likes = Math.round(views * (0.03 + retention * 0.05));
  const comments = Math.round(views * 0.006);
  const shares = Math.round(views * (0.004 + retention * 0.012));
  return { views, likes, comments, shares };
}

class Conteudo {
  constructor(workspaceDir) {
    this.dir = path.join(workspaceDir, 'conteudo-db');
    this.file = path.join(this.dir, 'conteudo.json');
  }

  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        return { perfis: parsed.perfis || {}, roteiros: parsed.roteiros || [], calendario: parsed.calendario || [], posts: parsed.posts || [], blueprints: parsed.blueprints || [], produtos: parsed.produtos || [] };
      }
    } catch {}
    return { perfis: {}, roteiros: [], calendario: [], posts: [], blueprints: [], produtos: [] };
  }

  save(data) {
    try { fs.mkdirSync(this.dir, { recursive: true }); } catch {}
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  getPerfil(clienteId) {
    return this.load().perfis[clienteId] || null;
  }

  setPerfil(clienteId, patch) {
    const data = this.load();
    const cur = data.perfis[clienteId] || {};
    data.perfis[clienteId] = { ...cur, ...(patch || {}), atualizadoEm: nowISO() };
    this.save(data);
    return data.perfis[clienteId];
  }

  listRoteiros(clienteId) {
    const all = this.load().roteiros.sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
    return clienteId ? all.filter(r => r.clienteId === clienteId) : all;
  }

  addRoteiro(clienteId, theme, variation) {
    const data = this.load();
    const r = { id: uid('rot'), clienteId: clienteId || null, theme: theme || '', ...(variation || {}), criadoEm: nowISO() };
    data.roteiros.push(r);
    this.save(data);
    return r;
  }

  removeRoteiro(id) {
    const data = this.load();
    const before = data.roteiros.length;
    data.roteiros = data.roteiros.filter(r => r.id !== id);
    if (data.roteiros.length !== before) { this.save(data); return true; }
    return false;
  }

  listCalendario(clienteId) {
    const all = this.load().calendario.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return clienteId ? all.filter(c => c.clienteId === clienteId) : all;
  }

  addCalendario(item) {
    const data = this.load();
    const it = { id: uid('cal'), clienteId: (item && item.clienteId) || null, date: (item && item.date) || nowISO().slice(0, 10), theme: (item && item.theme) || '', status: (item && item.status) || 'planejado', roteiroId: (item && item.roteiroId) || null, criadoEm: nowISO() };
    data.calendario.push(it);
    this.save(data);
    return it;
  }

  updateCalendario(id, patch) {
    const data = this.load();
    const it = data.calendario.find(c => c.id === id);
    if (!it) return null;
    Object.assign(it, patch || {});
    this.save(data);
    return it;
  }

  removeCalendario(id) {
    const data = this.load();
    const before = data.calendario.length;
    data.calendario = data.calendario.filter(c => c.id !== id);
    if (data.calendario.length !== before) { this.save(data); return true; }
    return false;
  }

  planCalendario(clienteId, opts) {
    const o = opts || {};
    const count = Math.min(120, o.count || 20);
    const perWeek = o.perWeek || 5;
    const themes = (o.themes && o.themes.length) ? o.themes : BASE_THEMES;
    const data = this.load();
    const items = [];
    const d = new Date();
    for (let i = 0; i < count; i++) {
      if (perWeek <= 5) { while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); }
      const it = { id: uid('cal'), clienteId: clienteId || null, date: d.toISOString().slice(0, 10), theme: `${themes[i % themes.length]} (#${i + 1})`, status: 'planejado', roteiroId: null, criadoEm: nowISO() };
      data.calendario.push(it);
      items.push(it);
      d.setDate(d.getDate() + 1);
    }
    this.save(data);
    return items;
  }

  listPosts(clienteId, now) {
    const t = now || Date.now();
    const all = this.load().posts.sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
    const filtered = clienteId ? all.filter(p => p.clienteId === clienteId) : all;
    return filtered.map(p => ({ ...p, metrics: computeMetrics(p, t) }));
  }

  addPost(post) {
    const data = this.load();
    const p = {
      id: uid('post'),
      clienteId: (post && post.clienteId) || null,
      roteiroId: (post && post.roteiroId) || null,
      plataforma: (post && post.plataforma) || 'instagram',
      legenda: (post && post.legenda) || '',
      retencao: Number(post && post.retencao) || 70,
      viralScore: Number(post && post.viralScore) || null,
      enviado: Boolean(post && post.enviado),
      criadoEm: nowISO(),
    };
    data.posts.push(p);
    this.save(data);
    return { ...p, metrics: computeMetrics(p, Date.now()) };
  }

  removePost(id) {
    const data = this.load();
    const before = data.posts.length;
    data.posts = data.posts.filter(p => p.id !== id);
    if (data.posts.length !== before) { this.save(data); return true; }
    return false;
  }

  listBlueprints(clienteId) {
    const all = this.load().blueprints.sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
    return clienteId ? all.filter(b => b.clienteId === clienteId) : all;
  }

  addBlueprint(clienteId, blueprint) {
    const data = this.load();
    const b = { id: uid('bp'), clienteId: clienteId || null, ...(blueprint || {}), criadoEm: nowISO() };
    data.blueprints.push(b);
    this.save(data);
    return b;
  }

  removeBlueprint(id) {
    const data = this.load();
    const before = data.blueprints.length;
    data.blueprints = data.blueprints.filter(b => b.id !== id);
    if (data.blueprints.length !== before) { this.save(data); return true; }
    return false;
  }

  listProdutos(clienteId) {
    const all = this.load().produtos.sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
    return clienteId ? all.filter(p => p.clienteId === clienteId) : all;
  }

  addProduto(clienteId, produto) {
    const data = this.load();
    const p = { id: uid('prod'), clienteId: clienteId || null, ...(produto || {}), criadoEm: nowISO() };
    data.produtos.push(p);
    this.save(data);
    return p;
  }

  removeProduto(id) {
    const data = this.load();
    const before = data.produtos.length;
    data.produtos = data.produtos.filter(p => p.id !== id);
    if (data.produtos.length !== before) { this.save(data); return true; }
    return false;
  }
}

module.exports = { Conteudo, computeMetrics };
