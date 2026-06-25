'use strict';

/**
 * Sistema de aprovação do Studio IA.
 *
 * Qualquer ação que envolva contato externo (email, mensagem, proposta) é
 * salva como PENDENTE e NUNCA é executada até o fundador aprovar.
 *
 * Estrutura em disco:
 *   workspace/aprovacoes/pendentes/<id>.json
 *   workspace/aprovacoes/aprovadas/<id>.json
 *   workspace/aprovacoes/rejeitadas/<id>.json
 *
 * Sem dependências externas — apenas módulos nativos do Node.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.env.STUDIO_ROOT || '/home/v/studio-ia';
const BASE = path.join(ROOT, 'workspace', 'aprovacoes');
const DIRS = {
  pendentes: path.join(BASE, 'pendentes'),
  aprovadas: path.join(BASE, 'aprovadas'),
  rejeitadas: path.join(BASE, 'rejeitadas'),
};

function ensureDirs() {
  for (const d of Object.values(DIRS)) {
    fs.mkdirSync(d, { recursive: true });
  }
}

function gerarId() {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const rand = crypto.randomBytes(3).toString('hex');
  return `apr_${ts}_${rand}`;
}

function resumir(conteudo) {
  try {
    const s = typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo);
    return s.replace(/\s+/g, ' ').trim().slice(0, 120);
  } catch (_) {
    return '(conteúdo não serializável)';
  }
}

function caminho(dir, id) {
  return path.join(dir, `${id}.json`);
}

function localizar(id) {
  for (const [estado, dir] of Object.entries(DIRS)) {
    const p = caminho(dir, id);
    if (fs.existsSync(p)) return { estado, dir, p };
  }
  return null;
}

/**
 * Salva uma nova aprovação pendente. Retorna o ID gerado.
 * @param {string} tipo  ex.: 'email', 'mensagem', 'proposta'
 * @param {object|string} conteudo  o que seria enviado/executado
 */
function salvar(tipo, conteudo) {
  ensureDirs();
  const id = gerarId();
  const registro = {
    id,
    tipo,
    resumo: resumir(conteudo),
    data: new Date().toISOString(),
    estado: 'pendente',
    conteudo,
  };
  fs.writeFileSync(caminho(DIRS.pendentes, id), JSON.stringify(registro, null, 2), 'utf8');
  return id;
}

/** Lista todas as aprovações pendentes (ordenadas por data). */
function listar() {
  ensureDirs();
  const arquivos = fs.readdirSync(DIRS.pendentes).filter((f) => f.endsWith('.json'));
  const itens = arquivos.map((f) => {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(DIRS.pendentes, f), 'utf8'));
      return { id: r.id, tipo: r.tipo, resumo: r.resumo, data: r.data };
    } catch (_) {
      return { id: f.replace('.json', ''), tipo: '?', resumo: '(arquivo inválido)', data: '' };
    }
  });
  itens.sort((a, b) => String(a.data).localeCompare(String(b.data)));
  return itens;
}

/**
 * Aprova um item: move para aprovadas/ e retorna o conteúdo para execução.
 * Lança erro se o item não existir ou já tiver sido processado.
 */
function aprovar(id) {
  ensureDirs();
  const p = caminho(DIRS.pendentes, id);
  if (!fs.existsSync(p)) {
    const loc = localizar(id);
    if (loc) throw new Error(`Item ${id} já está em "${loc.estado}".`);
    throw new Error(`Item ${id} não encontrado.`);
  }
  const r = JSON.parse(fs.readFileSync(p, 'utf8'));
  r.estado = 'aprovada';
  r.data_aprovacao = new Date().toISOString();
  fs.writeFileSync(caminho(DIRS.aprovadas, id), JSON.stringify(r, null, 2), 'utf8');
  fs.unlinkSync(p);
  return r.conteudo;
}

/** Rejeita um item com motivo: move para rejeitadas/ e registra o motivo. */
function rejeitar(id, motivo) {
  ensureDirs();
  const p = caminho(DIRS.pendentes, id);
  if (!fs.existsSync(p)) {
    const loc = localizar(id);
    if (loc) throw new Error(`Item ${id} já está em "${loc.estado}".`);
    throw new Error(`Item ${id} não encontrado.`);
  }
  const r = JSON.parse(fs.readFileSync(p, 'utf8'));
  r.estado = 'rejeitada';
  r.motivo = motivo || '(sem motivo informado)';
  r.data_rejeicao = new Date().toISOString();
  fs.writeFileSync(caminho(DIRS.rejeitadas, id), JSON.stringify(r, null, 2), 'utf8');
  fs.unlinkSync(p);
  return r;
}

/** Aprova todos os pendentes de uma vez. Retorna array de {id, conteudo}. */
function aprovarTodos() {
  const ids = listar().map((i) => i.id);
  return ids.map((id) => ({ id, conteudo: aprovar(id) }));
}

module.exports = {
  DIRS,
  ensureDirs,
  salvar,
  listar,
  aprovar,
  rejeitar,
  aprovarTodos,
};
