#!/bin/bash
# Script para instalar o Agency OS Core Multiagente
# Execute: chmod +x install-core.sh && ./install-core.sh

echo "╔══════════════════════════════════════════════════════════╗"
echo "║         Agency OS - Instalação do Core Multiagente      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Verifica se está no diretório correto
if [ ! -f "agents.js" ]; then
    echo "❌ Execute este script no diretório do studio-ia"
    echo "   cd ~/studio-ia && ./install-core.sh"
    exit 1
fi

echo "📁 Criando estrutura de diretórios..."

# Cria diretórios
mkdir -p core/memory
mkdir -p core/events
mkdir -p core/orchestrator
mkdir -p workspace/memory
mkdir -p workspace/reports/events
mkdir -p logs

echo "✅ Diretórios criados"

# Copia arquivos do core
echo "📦 Instalando módulos..."

# Memory
cat > core/memory/index.js << 'MEMORY_EOF'
'use strict';

/**
 * Core Memory - Memória compartilhada entre agentes.
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

function ensureMemoryDir() {
  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

function salvarContexto(data) {
  ensureMemoryDir();
  const contexto = lerContexto();
  const id = data.id || gerarId();
  contexto[id] = { ...data, id, atualizadoEm: new Date().toISOString() };
  fs.writeFileSync(CONTEXTO_FILE, JSON.stringify(contexto, null, 2), 'utf8');
  return id;
}

function lerContexto() {
  ensureMemoryDir();
  if (!fs.existsSync(CONTEXTO_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(CONTEXTO_FILE, 'utf8')); } catch { return {}; }
}

function getContexto(id) {
  const contexto = lerContexto();
  return contexto[id] || null;
}

function removerContexto(id) {
  const contexto = lerContexto();
  delete contexto[id];
  fs.writeFileSync(CONTEXTO_FILE, JSON.stringify(contexto, null, 2), 'utf8');
}

function adicionarHistorico(agente, acao, dados = {}) {
  ensureMemoryDir();
  let historico = [];
  if (fs.existsSync(HISTORICO_FILE)) { try { historico = JSON.parse(fs.readFileSync(HISTORICO_FILE, 'utf8')); } catch {} }
  historico.push({ id: gerarId(), agente, acao, dados, timestamp: new Date().toISOString() });
  if (historico.length > 500) historico = historico.slice(-500);
  fs.writeFileSync(HISTORICO_FILE, JSON.stringify(historico, null, 2), 'utf8');
}

function lerHistorico(limite = 100) {
  ensureMemoryDir();
  if (!fs.existsSync(HISTORICO_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(HISTORICO_FILE, 'utf8')).slice(-limite); } catch { return []; }
}

function salvarDecisao(tipo, decisao) {
  ensureMemoryDir();
  let decisoes = [];
  if (fs.existsSync(DECISOES_FILE)) { try { decisoes = JSON.parse(fs.readFileSync(DECISOES_FILE, 'utf8')); } catch {} }
  decisoes.push({ id: `dec_${Date.now()}`, tipo, decisao, data: new Date().toISOString() });
  fs.writeFileSync(DECISOES_FILE, JSON.stringify(decisoes, null, 2), 'utf8');
}

function lerDecisoes(tipo = null) {
  ensureMemoryDir();
  if (!fs.existsSync(DECISOES_FILE)) return [];
  try {
    let decisoes = JSON.parse(fs.readFileSync(DECISOES_FILE, 'utf8'));
    if (tipo) decisoes = decisoes.filter(d => d.tipo === tipo);
    return decisoes;
  } catch { return []; }
}

function atualizarPipeline(leadData) {
  ensureMemoryDir();
  let pipeline = [];
  if (fs.existsSync(PIPELINE_FILE)) { try { pipeline = JSON.parse(fs.readFileSync(PIPELINE_FILE, 'utf8')); } catch {} }
  const index = pipeline.findIndex(l => l.id === leadData.id);
  if (index >= 0) pipeline[index] = { ...pipeline[index], ...leadData, atualizadoEm: new Date().toISOString() };
  else pipeline.push({ ...leadData, criadoEm: new Date().toISOString() });
  fs.writeFileSync(PIPELINE_FILE, JSON.stringify(pipeline, null, 2), 'utf8');
}

function listarPipeline(status = null) {
  ensureMemoryDir();
  if (!fs.existsSync(PIPELINE_FILE)) return [];
  try {
    let pipeline = JSON.parse(fs.readFileSync(PIPELINE_FILE, 'utf8'));
    if (status) pipeline = pipeline.filter(l => l.status === status);
    return pipeline;
  } catch { return []; }
}

function proximoLead(agente) {
  const pipeline = listarPipeline();
  return pipeline.find(l => l.proximo_agente === agente && l.status !== 'concluido') || null;
}

function gerarId() {
  return `mem_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

module.exports = { MEMORY_DIR, salvarContexto, lerContexto, getContexto, removerContexto, adicionarHistorico, lerHistorico, salvarDecisao, lerDecisoes, atualizarPipeline, listarPipeline, proximoLead };
MEMORY_EOF

# Events
cat > core/events/index.js << 'EVENTS_EOF'
'use strict';

/**
 * Core Events - Sistema de eventos para Agency OS.
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

const ROOT = process.env.STUDIO_ROOT || path.join(__dirname, '..', '..');
const EVENTS_DIR = path.join(ROOT, 'workspace', 'reports', 'events');
const LOG_FILE = path.join(ROOT, 'logs', 'events.log');

class AgencyEvents extends EventEmitter {
  constructor() { super(); this.setMaxListeners(50); }
  emit(eventName, data) {
    const timestamp = new Date().toISOString();
    const logEntry = { event: eventName, data, timestamp };
    salvarEvento(eventName, logEntry);
    log(`EVENTO: ${eventName}`, logEntry);
    super.emit(eventName, logEntry);
    return logEntry;
  }
  on(eventName, callback) { super.on(eventName, callback); }
  once(eventName, callback) { super.once(eventName, callback); }
}

const events = new AgencyEvents();

function salvarEvento(eventName, logEntry) {
  try {
    if (!fs.existsSync(EVENTS_DIR)) fs.mkdirSync(EVENTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(EVENTS_DIR, `${eventName.toLowerCase()}_${Date.now()}.json`), JSON.stringify(logEntry, null, 2), 'utf8');
  } catch (e) { console.error(`Erro ao salvar evento ${eventName}:`, e.message); }
}

function log(msg, data = null) {
  try {
    const ts = new Date().toLocaleString('pt-BR', { hour12: false });
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, `[${ts}] ${msg}${data ? ' ' + JSON.stringify(data).slice(0, 200) : ''}\n`, 'utf8');
  } catch (_) {}
}

function novoLead(lead) { return events.emit('NovoLead', { id: lead.id || `lead_${Date.now()}`, nome: lead.nome, segmento: lead.segmento, contato: lead.contato, prioridade: lead.prioridade || 50, status: 'novo', proximo_agente: 'Clientes' }); }
function leadQualificado(lead) { return events.emit('LeadQualificado', { ...lead, status: 'qualificado', proximo_agente: 'Criacao' }); }
function diagnosticoAgendado(diagnostico) { return events.emit('DiagnosticoAgendado', { ...diagnostico, status: 'diagnosticado', proximo_agente: 'Tráfego' }); }
function propostaCriada(proposta) { return events.emit('PropostaCriada', { ...proposta, status: 'proposta_criada', proximo_agente: 'Criacao' }); }
function landingPronta(landing) { return events.emit('LandingPronta', { ...landing, status: 'landing_pronta', proximo_agente: 'Tráfego' }); }
function campanhaCriada(campanha) { return events.emit('CampanhaCriada', { ...campanha, status: 'campanha_criada', proximo_agente: 'Dados' }); }
function clienteFechado(cliente) { return events.emit('ClienteFechado', { ...cliente, status: 'cliente_fechado', proximo_agente: 'Dados' }); }
function relatorioAtualizado(relatorio) { return events.emit('RelatorioAtualizado', { ...relatorio, timestamp: new Date().toISOString() }); }

function lerEventosRecentes(limite = 50) {
  try {
    if (!fs.existsSync(EVENTS_DIR)) return [];
    return fs.readdirSync(EVENTS_DIR).filter(f => f.endsWith('.json')).sort().reverse().slice(0, limite).map(f => { try { return JSON.parse(fs.readFileSync(path.join(EVENTS_DIR, f), 'utf8')); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

module.exports = { AgencyEvents, events, novoLead, leadQualificado, diagnosticoAgendado, propostaCriada, landingPronta, campanhaCriada, clienteFechado, relatorioAtualizado, lerEventosRecentes };
EVENTS_EOF

# Demo
cat > core/demo.js << 'DEMO_EOF'
#!/usr/bin/env node
'use strict';

/**
 * Demo - Exemplo funcional de um lead percorrendo o pipeline.
 * Execute: node core/demo.js
 */

const path = require('path');
const ROOT = process.env.STUDIO_ROOT || path.join(__dirname);
process.env.STUDIO_ROOT = ROOT;

const memory = require('./memory');
const events = require('./events');

const LEAD_EXEMPLO = {
  id: 'lead_demo_001',
  cliente: 'Renova Clínica',
  dor: 'Perde dinheiro sem landing',
  prioridade: 95,
  status: 'novo',
  segmento: 'clínica estética',
  contato: '@renovaclinica',
  proximo_agente: 'Clientes'
};

async function demoPipeline() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║         Agency OS - Demo Pipeline Multiagente           ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  console.log('📋 LEAD DE ENTRADA:');
  console.log(JSON.stringify(LEAD_EXEMPLO, null, 2));
  console.log('');

  console.log('━'.repeat(60));
  console.log('🔵 ETAPA 1: GROWTH encontra lead');
  console.log('━'.repeat(60));
  memory.atualizarPipeline(LEAD_EXEMPLO);
  memory.adicionarHistorico('Growth', 'lead_encontrado', { id: LEAD_EXEMPLO.id, nome: LEAD_EXEMPLO.cliente });
  events.novoLead({ id: LEAD_EXEMPLO.id, nome: LEAD_EXEMPLO.cliente, segmento: LEAD_EXEMPLO.segmento });
  console.log('✅ Lead salvo no pipeline');
  console.log('');

  console.log('━'.repeat(60));
  console.log('🟡 ETAPA 2: CLIENTES qualifica e cria proposta');
  console.log('━'.repeat(60));
  memory.atualizarPipeline({ id: LEAD_EXEMPLO.id, status: 'qualificado', proximo_agente: 'Criacao' });
  memory.adicionarHistorico('Clientes', 'lead_qualificado', { id: LEAD_EXEMPLO.id, interesse: 'alto', pacote_recomendado: 'COMPLETO' });
  events.propostaCriada({ leadId: LEAD_EXEMPLO.id, proposta: { pacote: 'COMPLETO', valor: 900, recorrente: 350 } });
  console.log('✅ Lead qualificado: ALTO INTERESSE');
  console.log('✅ Proposta criada: R$900 + R$350/mês');
  console.log('');

  console.log('━'.repeat(60));
  console.log('🟣 ETAPA 3: CRIAÇÃO gera landing page');
  console.log('━'.repeat(60));
  memory.atualizarPipeline({ id: LEAD_EXEMPLO.id, status: 'landing_pronta', proximo_agente: 'Tráfego' });
  memory.adicionarHistorico('Criacao', 'landing_criada', { id: LEAD_EXEMPLO.id, titulo: 'Transforme Visits em Clientes' });
  events.landingPronta({ leadId: LEAD_EXEMPLO.id, landingUrl: `/paginas/landing-${LEAD_EXEMPLO.id}.html` });
  console.log('✅ Landing page criada');
  console.log('');

  console.log('━'.repeat(60));
  console.log('🔴 ETAPA 4: TRÁFEGO prepara campanha');
  console.log('━'.repeat(60));
  memory.atualizarPipeline({ id: LEAD_EXEMPLO.id, status: 'campanha_criada', proximo_agente: 'Dados' });
  memory.adicionarHistorico('Trafego', 'campanha_criada', { id: LEAD_EXEMPLO.id, conjuntos: 10, investimento_diario: 60 });
  events.campanhaCriada({ leadId: LEAD_EXEMPLO.id, campanha: 'campanha-renova-clinica-001' });
  console.log('✅ Campanha criada com 10 conjuntos @ R$6/dia');
  console.log('');

  console.log('━'.repeat(60));
  console.log('🟢 ETAPA 5: DADOS atualiza métricas');
  console.log('━'.repeat(60));
  memory.adicionarHistorico('Dados', 'metricas_atualizadas', { leads_pipeline: 1, propostas_pendentes: 1, campanhas_ativas: 1 });
  events.relatorioAtualizado({ tipo: 'pipeline-atualizado', pipeline: memory.listarPipeline() });
  console.log('✅ Métricas atualizadas');
  console.log('');

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║              ✅ PIPELINE CONCLUÍDO                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('📊 RESUMO DO PIPELINE:');
  const pipeline = memory.listarPipeline();
  for (const item of pipeline) {
    console.log(`  - ${item.cliente}: ${item.status} → ${item.proximo_agente}`);
  }
  console.log('');

  console.log('📜 HISTÓRICO:');
  for (const h of memory.lerHistorico(10)) {
    console.log(`  [${new Date(h.timestamp).toLocaleTimeString('pt-BR')}] ${h.agente}: ${h.acao}`);
  }
  console.log('');
  console.log('✨ Demo concluída!');
}

demoPipeline().catch(console.error);
DEMO_EOF

chmod +x core/demo.js

echo ""
echo "✅ Installation complete!"
echo ""
echo "📁 Estrutura criada:"
echo "   workspace/memory/     - contexto compartilhado"
echo "   workspace/reports/events/ - eventos"
echo "   core/memory/           - módulo memory"
echo "   core/events/           - módulo events"
echo "   core/demo.js           - demo do pipeline"
echo ""
echo "🚀 Para testar a demo:"
echo "   node core/demo.js"
echo ""