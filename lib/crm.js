'use strict';
const fs = require('fs');
const path = require('path');

const STAGES = ['NOVO', 'CONTATADO', 'RESPONDEU', 'QUALIFICADO', 'PROPOSTA', 'FECHADO', 'PERDIDO'];
const RANK = { NOVO: 0, CONTATADO: 1, RESPONDEU: 2, QUALIFICADO: 3, PROPOSTA: 4, FECHADO: 5, PERDIDO: -1 };

function nowISO() {
  return new Date().toISOString();
}

function slugBase(nome) {
  return String(nome || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function shortHash(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 6);
}

function leadId(input) {
  if (input.id) return input.id;
  const base = slugBase(input.nome) || slugBase(input.contato);
  if (!base) return '';
  const c = String(input.contato || '').trim();
  return c ? `${base}-${shortHash(c)}` : base;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectCanal(contato) {
  const c = String(contato || '').toLowerCase();
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(c)) return 'email';
  if (c.includes('@')) return 'instagram';
  if (/\d{4,5}[-\s]?\d{4}/.test(c) || c.includes('whats')) return 'whatsapp';
  return '';
}

function extractArray(raw) {
  let s = String(raw || '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  if (s[0] !== '[' && s[0] !== '{') {
    const a = s.indexOf('[');
    const b = s.lastIndexOf(']');
    if (a >= 0 && b > a) s = s.slice(a, b + 1);
  }
  return JSON.parse(s);
}

class Crm {
  constructor(workspaceDir) {
    this.workspace = workspaceDir;
    this.dir = path.join(workspaceDir, 'crm');
    this.file = path.join(this.dir, 'conversas.json');
  }

  ensureDir() {
    try { fs.mkdirSync(this.dir, { recursive: true }); } catch {}
  }

  load() {
    if (!fs.existsSync(this.file)) return { leads: {} };
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || !parsed.leads) return { leads: {} };
      return parsed;
    } catch (e) {
      try { fs.renameSync(this.file, this.file + '.corrupt'); } catch {}
      return { leads: {} };
    }
  }

  save(data) {
    this.ensureDir();
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  _advance(lead, target) {
    if (lead.stage === 'PERDIDO' || lead.stage === 'FECHADO') return lead;
    if ((RANK[target] ?? 0) > (RANK[lead.stage] ?? 0)) lead.stage = target;
    return lead;
  }

  _apply(data, input, origem) {
    const id = leadId(input);
    if (!id) return { lead: null, isNew: false, changed: false };
    const existing = data.leads[id];
    if (existing) {
      let changed = false;
      const fields = ['segmento', 'contato', 'observacao'];
      for (const f of fields) {
        if (input[f] && input[f] !== existing[f]) { existing[f] = input[f]; changed = true; }
      }
      if (!existing.canal) {
        const canal = input.canal || detectCanal(input.contato);
        if (canal) { existing.canal = canal; changed = true; }
      }
      if (changed) existing.atualizadoEm = nowISO();
      return { lead: existing, isNew: false, changed };
    }
    const lead = {
      id,
      nome: input.nome || id,
      segmento: input.segmento || '',
      contato: input.contato || '',
      canal: input.canal || detectCanal(input.contato),
      stage: STAGES.includes(input.stage) ? input.stage : 'NOVO',
      observacao: input.observacao || '',
      origem: origem || 'manual',
      criadoEm: nowISO(),
      atualizadoEm: nowISO(),
      historico: [],
    };
    data.leads[id] = lead;
    return { lead, isNew: true, changed: true };
  }

  upsertLead(input, origem) {
    if (!input || (!input.nome && !input.contato && !input.id)) return null;
    const data = this.load();
    const r = this._apply(data, input, origem);
    if (!r.lead) return null;
    if (r.changed) this.save(data);
    return r;
  }

  syncFromLeads() {
    const leadsDir = path.join(this.workspace, 'leads');
    let files = [];
    try { files = fs.readdirSync(leadsDir).filter(f => f.endsWith('.json')); } catch { return { added: 0 }; }
    const data = this.load();
    let added = 0;
    let changed = false;
    for (const f of files) {
      let arr;
      try { arr = extractArray(fs.readFileSync(path.join(leadsDir, f), 'utf8')); } catch { continue; }
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        if (!item || (!item.nome && !item.contato)) continue;
        const r = this._apply(data, item, 'growth');
        if (r.changed) changed = true;
        if (r.isNew) added++;
      }
    }
    if (changed) this.save(data);
    return { added };
  }

  recordContact(id, contact) {
    const data = this.load();
    const lead = data.leads[id];
    if (!lead) return null;
    const entry = {
      tipo: contact.tipo || 'mensagem',
      canal: contact.canal || lead.canal || '',
      etapa: contact.etapa || '',
      texto: String(contact.texto || '').slice(0, 4000),
      em: nowISO(),
    };
    lead.historico = lead.historico || [];
    lead.historico.push(entry);
    lead.atualizadoEm = nowISO();
    if (entry.tipo === 'proposta') this._advance(lead, 'PROPOSTA');
    else if (entry.tipo === 'resposta') this._advance(lead, 'RESPONDEU');
    else if (entry.tipo === 'mensagem') this._advance(lead, 'CONTATADO');
    this.save(data);
    return lead;
  }

  setRascunho(id, msg) {
    const data = this.load();
    const lead = data.leads[id];
    if (!lead) return null;
    lead.rascunho = {
      canal: msg.canal || lead.canal || '',
      etapa: msg.etapa || 'abertura',
      assunto: msg.assunto || '',
      mensagem: String(msg.mensagem || '').slice(0, 4000),
      objetivo: msg.objetivo || '',
      proximo_passo: msg.proximo_passo || '',
      status: 'pendente',
      origem: msg.origem || 'auto',
      geradoEm: nowISO(),
    };
    lead.atualizadoEm = nowISO();
    this.save(data);
    return lead;
  }

  clearRascunho(id) {
    const data = this.load();
    const lead = data.leads[id];
    if (!lead) return null;
    if (lead.rascunho) {
      delete lead.rascunho;
      lead.atualizadoEm = nowISO();
      this.save(data);
    }
    return lead;
  }

  setStage(id, stage) {
    if (!STAGES.includes(stage)) return null;
    const data = this.load();
    const lead = data.leads[id];
    if (!lead) return null;
    lead.stage = stage;
    lead.atualizadoEm = nowISO();
    lead.historico = lead.historico || [];
    lead.historico.push({ tipo: 'stage', texto: `Movido para ${stage}`, em: nowISO() });
    this.save(data);
    return lead;
  }

  remove(id) {
    const data = this.load();
    if (!data.leads[id]) return false;
    delete data.leads[id];
    this.save(data);
    return true;
  }

  list() {
    const data = this.load();
    return Object.values(data.leads).sort((a, b) => (b.atualizadoEm || '').localeCompare(a.atualizadoEm || ''));
  }

  matchAndRecord(text, contact) {
    const data = this.load();
    const hay = String(text || '').toLowerCase();
    if (!hay) return null;
    const numbers = (String(text || '').match(/\d[\d\s().-]{8,}\d/g) || []).map(n => n.replace(/\D/g, ''));
    let best = null;
    let bestScore = 0;
    for (const lead of Object.values(data.leads)) {
      let score = 0;
      const handle = String(lead.contato || '').toLowerCase().match(/@[\w.]+/);
      if (handle && handle[0].length > 3 && hay.includes(handle[0])) score = Math.max(score, 3);
      const phone = String(lead.contato || '').replace(/\D/g, '');
      if (phone.length >= 10) {
        const tail = phone.slice(-9);
        if (numbers.some(n => n.length >= 9 && (n.endsWith(tail) || tail.endsWith(n.slice(-9))))) score = Math.max(score, 2);
      }
      const nome = String(lead.nome || '').toLowerCase().trim();
      if (nome.length >= 6) {
        try {
          if (new RegExp('\\b' + escapeRegex(nome) + '\\b').test(hay)) score = Math.max(score, 1 + nome.length / 1000);
        } catch {}
      }
      if (score > bestScore) { bestScore = score; best = lead; }
    }
    if (!best || bestScore <= 0) return null;
    return this.recordContact(best.id, contact);
  }
}

module.exports = { Crm, STAGES };
