'use strict';
const fs = require('fs');
const path = require('path');

function nowISO() { return new Date().toISOString(); }
function uid() { return `pend-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }

class Pendencias {
  constructor(workspaceDir) {
    this.dir = path.join(workspaceDir, 'config');
    this.file = path.join(this.dir, 'pendencias.json');
  }

  load() {
    try { const p = JSON.parse(fs.readFileSync(this.file, 'utf8')); return Array.isArray(p.itens) ? p : { itens: [] }; }
    catch { return { itens: [] }; }
  }

  save(data) {
    try { fs.mkdirSync(this.dir, { recursive: true }); } catch {}
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  list(clienteId) {
    const itens = this.load().itens.sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
    return clienteId ? itens.filter(i => i.clienteId === clienteId) : itens;
  }

  add(clienteId, { chave, titulo, detalhe, tipo, prioridade }) {
    const data = this.load();
    if (chave) {
      const existente = data.itens.find(i => i.clienteId === clienteId && i.chave === chave && i.status !== 'resolvido');
      if (existente) return existente;
    }
    const item = {
      id: uid(),
      clienteId: clienteId || null,
      chave: chave || null,
      titulo: titulo || 'Ajuste pendente',
      detalhe: detalhe || '',
      tipo: tipo || 'ajuste',
      prioridade: prioridade || 'media',
      status: 'aberto',
      criadoEm: nowISO(),
    };
    data.itens.push(item);
    this.save(data);
    return item;
  }

  resolve(id) {
    const data = this.load();
    const it = data.itens.find(i => i.id === id);
    if (!it) return null;
    it.status = 'resolvido';
    it.resolvidoEm = nowISO();
    this.save(data);
    return it;
  }

  remove(id) {
    const data = this.load();
    const before = data.itens.length;
    data.itens = data.itens.filter(i => i.id !== id);
    if (data.itens.length !== before) { this.save(data); return true; }
    return false;
  }

  resolveByChave(clienteId, chave) {
    const data = this.load();
    let n = 0;
    for (const it of data.itens) {
      if (it.clienteId === clienteId && it.chave === chave && it.status !== 'resolvido') { it.status = 'resolvido'; it.resolvidoEm = nowISO(); n++; }
    }
    if (n) this.save(data);
    return n;
  }
}

module.exports = { Pendencias };
