'use strict';
const fs = require('fs');
const path = require('path');

const BUILTIN = [
  {
    id: 'segunda', nome: 'Segunda — Plano + Leads', horario: 'Seg 08:00', builtin: true,
    descricao: 'Planejamento da semana, prospecção de leads, esboço de produto e 1ª mensagem do SDR.',
    steps: [
      { name: 'CEO — Plano Semanal', agente: 'studio-ceo', desc: 'Lê o workspace e escreve o plano da semana com 3 prioridades.' },
      { name: 'Growth — Leads', agente: 'studio-growth', desc: 'Busca negócios locais reais nos nichos configurados.' },
      { name: 'Criação — Produto', agente: 'studio-criacao', desc: 'Cria o esboço de um produto/landing prioritário.' },
      { name: 'SDR — Primeiras mensagens', agente: 'studio-sdr', desc: 'Gera a 1ª mensagem (voz VNMAX) para os leads novos.' },
    ],
  },
  {
    id: 'diario', nome: 'Diário — Tráfego + Clientes', horario: 'Diário 09:00', builtin: true,
    descricao: 'Otimização de campanhas e e-mails de prospecção.',
    steps: [
      { name: 'Tráfego — Campanhas', agente: 'studio-trafego', desc: 'Analisa campanhas e recomenda otimizações (CTR/CPC/ROAS).' },
      { name: 'Clientes — Emails', agente: 'studio-clientes', desc: 'Rascunha e-mails de prospecção personalizados.' },
    ],
  },
  {
    id: 'sexta', nome: 'Sexta — Dados + Relatório', horario: 'Sex 17:00', builtin: true,
    descricao: 'Consolidação dos dados da semana e relatório do fundador.',
    steps: [
      { name: 'Dados — Relatório Semanal', agente: 'studio-dados', desc: 'Compila receita, custos, resultado e inteligência da semana.' },
      { name: 'CEO — Relatório do Fundador', agente: 'studio-ceo', desc: 'Relatório de 1 página com resultado e plano da próxima semana.' },
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
    };
  }
  save(data) {
    try { fs.mkdirSync(this.dir, { recursive: true }); } catch {}
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  status() {
    const cfg = this.load();
    const builtin = BUILTIN.map(c => ({ ...c, extraSteps: (cfg.extras[c.id] || []) }));
    return { builtin, custom: cfg.custom };
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
      if (index != null && index >= 0 && index <= arr.length) arr.splice(index, 0, s); else arr.push(s);
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
      cfg.extras[cicloId] = (cfg.extras[cicloId] || []).filter(s => s.id !== stepId);
    } else {
      const c = cfg.custom.find(x => x.id === cicloId);
      if (!c) return false;
      c.steps = c.steps.filter(s => s.id !== stepId);
    }
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
