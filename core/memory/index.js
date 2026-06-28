'use strict';

/**
 * Core Memory - Memória compartilhada entre agentes.
 * 
 * Responsabilidade: persistir contexto, histórico e decisões
 * entre os agentes do Agency OS.
 * 
 * Estrutura em disco:
 *   workspace/memory/
 *     contexto.json      - contexto atual do pipeline
 *     historico.json     - todas as ações dos agentes
 *     decisoes.json      - decisões do CEO
 *     pipeline.json      - estado do pipeline de leads
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.env.STUDIO_ROOT || path.join(__dirname, '..', '..');
const MEMORY_DIR = path.join(ROOT, 'workspace', 'memory');
const CONTEXTO_FILE = path.join(MEMORY_DIR, 'contexto.json');
const HISTORICO_FILE = path.join(MEMORY_DIR, 'historico.json');
const DECISOES_FILE = path.join(MEMORY_DIR, 'decisoes.json');
const PIPELINE_FILE = path.join(MEMORY_DIR, 'pipeline.json');

/** Garante que o diretório de memória existe */
function ensureMemoryDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

/**
 * Salva contexto de um lead ou cliente no pipeline.
 * @param {object} data - dados do contexto
 */
function salvarContexto(data) {
  ensureMemoryDir();
  const contexto = lerContexto();
  const id = data.id || gerarId();
  contexto[id] = {
    ...data,
    id,
    atualizadoEm: new Date().toISOString()
  };
  fs.writeFileSync(CONTEXTO_FILE, JSON.stringify(contexto, null, 2), 'utf8');
  return id;
}

/**
 * Lê todo o contexto de memória.
 */
function lerContexto() {
  ensureMemoryDir();
  if (!fs.existsSync(CONTEXTO_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONTEXTO_FILE, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Recupera contexto específico por ID.
 */
function getContexto(id) {
  const contexto = lerContexto();
  return contexto[id] || null;
}

/**
 * Remove um contexto por ID.
 */
function removerContexto(id) {
  const contexto = lerContexto();
  delete contexto[id];
  fs.writeFileSync(CONTEXTO_FILE, JSON.stringify(contexto, null, 2), 'utf8');
}

/**
 * Adiciona entrada no histórico de ações.
 * @param {string} agente - nome do agente
 * @param {string} acao - ação realizada
 * @param {object} dados - dados adicionais
 */
function adicionarHistorico(agente, acao, dados = {}) {
  ensureMemoryDir();
  let historico = [];
  if (fs.existsSync(HISTORICO_FILE)) {
    try {
      historico = JSON.parse(fs.readFileSync(HISTORICO_FILE, 'utf8'));
    } catch {}
  }
  historico.push({
    id: gerarId(),
    agente,
    acao,
    dados,
    timestamp: new Date().toISOString()
  });
  // Mantém apenas últimos 500 registros
  if (historico.length > 500) {
    historico = historico.slice(-500);
  }
  fs.writeFileSync(HISTORICO_FILE, JSON.stringify(historico, null, 2), 'utf8');
}

/**
 * Lê histórico de ações.
 * @param {number} limite - número máximo de entradas
 */
function lerHistorico(limite = 100) {
  ensureMemoryDir();
  if (!fs.existsSync(HISTORICO_FILE)) return [];
  try {
    const historico = JSON.parse(fs.readFileSync(HISTORICO_FILE, 'utf8'));
    return historico.slice(-limite);
  } catch {
    return [];
  }
}

/**
 * Salva decisão do CEO.
 * @param {string} tipo - tipo de decisão
 * @param {object} decisao - conteúdo da decisão
 */
function salvarDecisao(tipo, decisao) {
  ensureMemoryDir();
  let decisoes = [];
  if (fs.existsSync(DECISOES_FILE)) {
    try {
      decisoes = JSON.parse(fs.readFileSync(DECISOES_FILE, 'utf8'));
    } catch {}
  }
  const id = `dec_${Date.now()}`;
  decisoes.push({
    id,
    tipo,
    decisao,
    data: new Date().toISOString()
  });
  fs.writeFileSync(DECISOES_FILE, JSON.stringify(decisoes, null, 2), 'utf8');
  return id;
}

/**
 * Lê decisões do CEO.
 * @param {string} tipo - filtro por tipo (opcional)
 */
function lerDecisoes(tipo = null) {
  ensureMemoryDir();
  if (!fs.existsSync(DECISOES_FILE)) return [];
  try {
    let decisoes = JSON.parse(fs.readFileSync(DECISOES_FILE, 'utf8'));
    if (tipo) {
      decisoes = decisoes.filter(d => d.tipo === tipo);
    }
    return decisoes;
  } catch {
    return [];
  }
}

/**
 * Atualiza estado de um lead no pipeline.
 * @param {object} leadData - dados do lead
 */
function atualizarPipeline(leadData) {
  ensureMemoryDir();
  let pipeline = [];
  if (fs.existsSync(PIPELINE_FILE)) {
    try {
      pipeline = JSON.parse(fs.readFileSync(PIPELINE_FILE, 'utf8'));
    } catch {}
  }
  const index = pipeline.findIndex(l => l.id === leadData.id);
  if (index >= 0) {
    pipeline[index] = { ...pipeline[index], ...leadData, atualizadoEm: new Date().toISOString() };
  } else {
    pipeline.push({ ...leadData, criadoEm: new Date().toISOString() });
  }
  fs.writeFileSync(PIPELINE_FILE, JSON.stringify(pipeline, null, 2), 'utf8');
}

/**
 * Lista leads no pipeline.
 * @param {string} status - filtro por status (opcional)
 */
function listarPipeline(status = null) {
  ensureMemoryDir();
  if (!fs.existsSync(PIPELINE_FILE)) return [];
  try {
    let pipeline = JSON.parse(fs.readFileSync(PIPELINE_FILE, 'utf8'));
    if (status) {
      pipeline = pipeline.filter(l => l.status === status);
    }
    return pipeline;
  } catch {
    return [];
  }
}

/**
 * Pega próximo lead pendente de processamento.
 * @param {string} agente - nome do agente que está pedindo
 */
function proximoLead(agente) {
  const pipeline = listarPipeline();
  return pipeline.find(l => l.proximo_agente === agente && l.status !== 'concluido') || null;
}

/**
 * Gera ID único.
 */
function gerarId() {
  return `mem_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

module.exports = {
  MEMORY_DIR,
  salvarContexto,
  lerContexto,
  getContexto,
  removerContexto,
  adicionarHistorico,
  lerHistorico,
  salvarDecisao,
  lerDecisoes,
  atualizarPipeline,
  listarPipeline,
  proximoLead
};