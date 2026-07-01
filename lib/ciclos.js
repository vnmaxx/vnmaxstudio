'use strict';
const fs = require('fs');
const path = require('path');

const BUILTIN = [
  {
    id: 'segunda', nome: 'Segunda — Plano + Leads', horario: 'Seg 08:00', builtin: true,
    descricao: 'Planejamento da semana, prospecção de leads, esboço de produto e 1ª mensagem do SDR.',
    steps: [
      { id: 'seg-ceo', name: 'CEO — Plano Semanal', agente: 'studio-ceo', desc: 'Lê o workspace e escreve o plano da semana com 3 prioridades.' },
      { id: 'seg-growth', name: 'Growth — Leads', agente: 'studio-growth', desc: 'Busca negócios locais reais nos nichos configurados.' },
      { id: 'seg-criacao', name: 'Criação — Produto', agente: 'studio-criacao', desc: 'Cria o esboço de um produto/landing prioritário.' },
      { id: 'seg-sdr', name: 'SDR — Primeiras mensagens', agente: 'studio-sdr', desc: 'Gera a 1ª mensagem (voz VNMAX) para os leads novos.' },
    ],
  },
  {
    id: 'diario', nome: 'Diário — Tráfego + Clientes', horario: 'Diário 09:00', builtin: true,
    descricao: 'Otimização de campanhas e e-mails de prospecção.',
    steps: [
      { id: 'dia-trafego', name: 'Tráfego — Campanhas', agente: 'studio-trafego', desc: 'Analisa campanhas e recomenda otimizações (CTR/CPC/ROAS).' },
      { id: 'dia-clientes', name: 'Clientes — Emails', agente: 'studio-clientes', desc: 'Rascunha e-mails de prospecção personalizados.' },
    ],
  },
  {
    id: 'sexta', nome: 'Sexta — Dados + Relatório', horario: 'Sex 17:00', builtin: true,
    descricao: 'Consolidação dos dados da semana e relatório do fundador.',
    steps: [
      { id: 'sex-dados', name: 'Dados — Relatório Semanal', agente: 'studio-dados', desc: 'Compila receita, custos, resultado e inteligência da semana.' },
      { id: 'sex-ceo', name: 'CEO — Relatório do Fundador', agente: 'studio-ceo', desc: 'Relatório de 1 página com resultado e plano da próxima semana.' },
    ],
  },
];
const BUILTIN_IDS = BUILTIN.map(c => c.id);

function uid(p) { return `${p || 'x'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; }
function slug(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32); }

function normStep(s) {
  return {
    id: s.id || uid('step'),
    name: String(s.name || 'Passo').slice(0, 80),
    agente: String(s.agente || 'general'),
    prompt: String(s.prompt || '').slice(0, 8000),
    timeoutMin: Math.max(1, Math.min(20, parseInt(s.timeoutMin, 10) || 8)),
    saveComoRelatorio: s.saveComoRelatorio !== false,
  };
}

class Ciclos {
  constructor(workspaceDir) {
    this.dir = path.join(workspaceDir, 'config');
    this.file = path.join(this.dir, 'ciclos.json');
  }
  load() {
    let cfg = {};
    try { cfg = JSON.parse(fs.readFileSync(this.file, 'utf8')) || {}; } catch { cfg = {}; }
    return {
      extras: { segunda: [], diario: [], sexta: [], ...(cfg.extras || {}) },
      custom: Array.isArray(cfg.custom) ? cfg.custom : [],
      ordem: cfg.ordem && typeof cfg.ordem === 'object' ? cfg.ordem : {},
    };
  }
  save(data) {
    try { fs.mkdirSync(this.dir, { recursive: true }); } catch {}
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  _aplicarOrdem(all, ordem) {
    if (!Array.isArray(ordem) || !ordem.length) return all;
    const byId = new Map(all.map(s => [s.id, s]));
    const out = [];
    for (const id of ordem) { if (byId.has(id)) { out.push(byId.get(id)); byId.delete(id); } }
    for (const s of all) if (byId.has(s.id)) out.push(s);
    return out;
  }

  status() {
    const cfg = this.load();
    const builtin = BUILTIN.map(c => {
      const base = c.steps.map(s => ({ id: s.id, name: s.name, agente: s.agente, desc: s.desc, base: true }));
      const ex = (cfg.extras[c.id] || []).map(s => ({ ...normStep(s), base: false }));
      const steps = this._aplicarOrdem([...base, ...ex], cfg.ordem[c.id]);
      return { ...c, steps };
    });
    const custom = cfg.custom.map(c => ({ ...c, steps: (c.steps || []).map(s => ({ ...normStep(s), base: false })) }));
    return { builtin, custom };
  }

  // ordem completa (ids) de um ciclo built-in, na sequência salva, para o scheduler
  ordemBuiltin(cicloId) {
    const c = BUILTIN.find(x => x.id === cicloId);
    if (!c) return [];
    const cfg = this.load();
    const base = c.steps.map(s => ({ id: s.id }));
    const ex = (cfg.extras[cicloId] || []).map(s => ({ id: normStep(s).id }));
    return this._aplicarOrdem([...base, ...ex], cfg.ordem[cicloId]).map(s => s.id);
  }

  reorder(cicloId, orderedIds) {
    const cfg = this.load();
    const ids = Array.isArray(orderedIds) ? orderedIds.filter(Boolean) : [];
    if (BUILTIN_IDS.includes(cicloId)) {
      cfg.ordem[cicloId] = ids;
    } else {
      const c = cfg.custom.find(x => x.id === cicloId);
      if (!c) return false;
      const byId = new Map((c.steps || []).map(s => [normStep(s).id, s]));
      const out = [];
      for (const id of ids) if (byId.has(id)) { out.push(byId.get(id)); byId.delete(id); }
      for (const s of (c.steps || [])) if (byId.has(normStep(s).id)) out.push(s);
      c.steps = out;
    }
    this.save(cfg);
    return true;
  }

  addCustom({ nome, horario, steps }) {
    const cfg = this.load();
    const base = slug(nome) || 'ciclo';
    let id = base; let n = 2;
    while (BUILTIN_IDS.includes(id) || cfg.custom.some(c => c.id === id)) id = `${base}-${n++}`;
    const ciclo = { id, nome: String(nome || 'Novo ciclo').slice(0, 60), horario: horario || '', builtin: false, steps: (Array.isArray(steps) ? steps : []).map(normStep) };
    cfg.custom.push(ciclo);
    this.save(cfg);
    return ciclo;
  }
  removeCustom(id) {
    const cfg = this.load();
    const before = cfg.custom.length;
    cfg.custom = cfg.custom.filter(c => c.id !== id);
    if (cfg.custom.length !== before) { this.save(cfg); return true; }
    return false;
  }
  addStep(cicloId, step, index) {
    const cfg = this.load();
    const s = normStep(step);
    if (BUILTIN_IDS.includes(cicloId)) {
      const arr = cfg.extras[cicloId] || (cfg.extras[cicloId] = []);
      arr.push(s);
      if (Array.isArray(cfg.ordem[cicloId]) && cfg.ordem[cicloId].length) cfg.ordem[cicloId].push(s.id);
    } else {
      const c = cfg.custom.find(x => x.id === cicloId);
      if (!c) return null;
      if (index != null && index >= 0 && index <= c.steps.length) c.steps.splice(index, 0, s); else c.steps.push(s);
    }
    this.save(cfg);
    return s;
  }
  removeStep(cicloId, stepId) {
    const cfg = this.load();
    if (BUILTIN_IDS.includes(cicloId)) {
      if (BUILTIN.find(c => c.id === cicloId).steps.some(s => s.id === stepId)) return false;
      cfg.extras[cicloId] = (cfg.extras[cicloId] || []).filter(s => normStep(s).id !== stepId);
    } else {
      const c = cfg.custom.find(x => x.id === cicloId);
      if (!c) return false;
      c.steps = c.steps.filter(s => normStep(s).id !== stepId);
    }
    if (Array.isArray(cfg.ordem[cicloId])) cfg.ordem[cicloId] = cfg.ordem[cicloId].filter(id => id !== stepId);
    this.save(cfg);
    return true;
  }

  extraSteps(cicloId) {
    return (this.load().extras[cicloId] || []).map(normStep);
  }
  getCustom(id) {
    return this.load().custom.find(c => c.id === id) || null;
  }
  isBuiltin(id) { return BUILTIN_IDS.includes(id); }
}

module.exports = { Ciclos, BUILTIN, BUILTIN_IDS };
