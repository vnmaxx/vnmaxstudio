'use strict';

/**
 * Core Events - Sistema de eventos para Agency OS.
 * 
 * Responsabilidade: disparar eventos quando ações acontecem
 * e notificar o orquestrador para acionar o próximo agente.
 * 
 * Eventos disponíveis:
 *   - NovoLead           → Growth encontrou novo lead
 *   - LeadQualificado    → Clientes qualificou lead
 *   - DiagnosticoAgendado→ Tráfego fez diagnóstico
 *   - PropostaCriada     → Clientes criou proposta
 *   - LandingPronta      → Criação finalizou landing
 *   - CampanhaCriada     → Tráfego criou campanha
 *   - ClienteFechado     → Cliente fechou contrato
 *   - RelatorioAtualizado→ Dados gerou relatório
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

const ROOT = process.env.STUDIO_ROOT || path.join(__dirname, '..', '..');
const EVENTS_DIR = path.join(ROOT, 'workspace', 'reports', 'events');
const LOG_FILE = path.join(ROOT, 'logs', 'events.log');

class AgencyEvents extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Dispara um evento e registra no log.
   * @param {string} eventName - nome do evento
   * @param {object} data - dados do evento
   */
  emit(eventName, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      event: eventName,
      data,
      timestamp
    };
    
    // Salva evento em arquivo para persistência
    salvarEvento(eventName, logEntry);
    
    // Log no arquivo de eventos
    log(`EVENTO: ${eventName}`, logEntry);
    
    // Notifica listeners
    super.emit(eventName, logEntry);
    
    return logEntry;
  }

  /**
   * Escuta um evento.
   * @param {string} eventName - nome do evento
   * @param {function} callback - função de callback
   */
  on(eventName, callback) {
    super.on(eventName, callback);
  }

  /**
   * Escuta evento apenas uma vez.
   * @param {string} eventName - nome do evento
   * @param {function} callback - função de callback
   */
  once(eventName, callback) {
    super.once(eventName, callback);
  }
}

// Instância singleton
const events = new AgencyEvents();

/**
 * Salva evento em arquivo JSON.
 */
function salvarEvento(eventName, logEntry) {
  try {
    if (!fs.existsSync(EVENTS_DIR)) {
      fs.mkdirSync(EVENTS_DIR, { recursive: true });
    }
    const filename = `${eventName.toLowerCase()}_${Date.now()}.json`;
    fs.writeFileSync(
      path.join(EVENTS_DIR, filename),
      JSON.stringify(logEntry, null, 2),
      'utf8'
    );
  } catch (e) {
    console.error(`Erro ao salvar evento ${eventName}:`, e.message);
  }
}

/**
 * Log simples em arquivo.
 */
function log(msg, data = null) {
  try {
    const ts = new Date().toLocaleString('pt-BR', { hour12: false });
    const linha = `[${ts}] ${msg}${data ? ' ' + JSON.stringify(data).slice(0, 200) : ''}`;
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, linha + '\n', 'utf8');
  } catch (_) {}
}

/**
 * Dispara evento de novo lead encontrado.
 * @param {object} lead - dados do lead
 */
function novoLead(lead) {
  return events.emit('NovoLead', {
    id: lead.id || `lead_${Date.now()}`,
    nome: lead.nome,
    segmento: lead.segmento,
    contato: lead.contato,
    prioridade: lead.prioridade || 50,
    status: 'novo',
    proximo_agente: 'Clientes'
  });
}

/**
 * Dispara evento de lead qualificado.
 * @param {object} lead - lead qualificado
 */
function leadQualificado(lead) {
  return events.emit('LeadQualificado', {
    ...lead,
    status: 'qualificado',
    proximo_agente: 'Criacao'
  });
}

/**
 * Dispara evento de diagnóstico agendado.
 * @param {object} diagnostico - dados do diagnóstico
 */
function diagnosticoAgendado(diagnostico) {
  return events.emit('DiagnosticoAgendado', {
    ...diagnostico,
    status: 'diagnosticado',
    proximo_agente: 'Tráfego'
  });
}

/**
 * Dispara evento de proposta criada.
 * @param {object} proposta - dados da proposta
 */
function propostaCriada(proposta) {
  return events.emit('PropostaCriada', {
    ...proposta,
    status: 'proposta_criada',
    proximo_agente: 'Criacao'
  });
}

/**
 * Dispara evento de landing page pronta.
 * @param {object} landing - dados da landing
 */
function landingPronta(landing) {
  return events.emit('LandingPronta', {
    ...landing,
    status: 'landing_pronta',
    proximo_agente: 'Tráfego'
  });
}

/**
 * Dispara evento de campanha criada.
 * @param {object} campanha - dados da campanha
 */
function campanhaCriada(campanha) {
  return events.emit('CampanhaCriada', {
    ...campanha,
    status: 'campanha_criada',
    proximo_agente: 'Dados'
  });
}

/**
 * Dispara evento de cliente fechado.
 * @param {object} cliente - dados do cliente fechado
 */
function clienteFechado(cliente) {
  return events.emit('ClienteFechado', {
    ...cliente,
    status: 'cliente_fechado',
    proximo_agente: 'Dados'
  });
}

/**
 * Dispara evento de relatório atualizado.
 * @param {object} relatorio - dados do relatório
 */
function relatorioAtualizado(relatorio) {
  return events.emit('RelatorioAtualizado', {
    ...relatorio,
    timestamp: new Date().toISOString()
  });
}

/**
 * Lê eventos recentes.
 * @param {number} limite - número de eventos
 */
function lerEventosRecentes(limite = 50) {
  try {
    if (!fs.existsSync(EVENTS_DIR)) return [];
    const files = fs.readdirSync(EVENTS_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limite);
    
    return files.map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(EVENTS_DIR, f), 'utf8'));
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

module.exports = {
  AgencyEvents,
  events,
  novoLead,
  leadQualificado,
  diagnosticoAgendado,
  propostaCriada,
  landingPronta,
  campanhaCriada,
  clienteFechado,
  relatorioAtualizado,
  lerEventosRecentes
};