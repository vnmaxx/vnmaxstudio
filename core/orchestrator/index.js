'use strict';

/**
 * Core Orchestrator - Orquestrador de Agentes do Agency OS.
 * 
 * Responsabilidades:
 * - Receber objetivos do CEO
 * - Quebrar em tarefas
 * - Distribuir para agentes
 * - Acompanhar status
 * - Disparar próximo agente automaticamente
 * - Registrar tudo em /workspace/reports
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.STUDIO_ROOT || path.join(__dirname, '..', '..');
const REPORTS_DIR = path.join(ROOT, 'workspace', 'reports');
const LOG_FILE = path.join(ROOT, 'logs', 'orchestrator.log');

// Módulos internos
const memory = require('../memory');
const events = require('../events');

// Configuração do Agent Server
const NXS_HOST = process.env.NXS_HOST || '127.0.0.1';
const NXS_PORT = parseInt(process.env.NXS_PORT || '8006', 10);
const NXS_KEY = process.env.NXS_STUDIO_KEY || '';

// Mapeamento de agentes VNMAX Studio
const AGENTS_MAP = {
  'studio-ceo': 'studio-ceo',
  'studio-growth': 'studio-growth',
  'studio-clientes': 'studio-clientes',
  'studio-criacao': 'studio-criacao',
  'studio-trafego': 'studio-trafego',
  'studio-dados': 'studio-dados'
};

// Pipeline padrão: ordem dos agentes
const PIPELINE_ORDER = ['Growth', 'Clientes', 'Criacao', 'Trafego', 'Dados'];

// Próximo agente no pipeline
const NEXT_AGENT = {
  'Growth': 'Clientes',
  'Clientes': 'Criacao',
  'Criacao': 'Trafego',
  'Trafego': 'Dados',
  'Dados': 'CEO'
};

/**
 * Log simples.
 */
function log(msg, data = null) {
  const ts = new Date().toLocaleString('pt-BR', { hour12: false });
  const linha = `[${ts}] ${msg}${data ? ' ' + JSON.stringify(data).slice(0, 300) : ''}`;
  console.log(linha);
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, linha + '\n', 'utf8');
  } catch (_) {}
}

/**
 * Request HTTP para o Agent Server.
 */
function agentRequest(method, pathname, body) {
  return new Promise((resolve, reject) => {
    if (!NXS_KEY) {
      return reject(new Error('NXS_STUDIO_KEY não configurado'));
    }
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      host: NXS_HOST,
      port: NXS_PORT,
      path: pathname,
      method,
      headers: {
        'Authorization': `Bearer ${NXS_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
          else reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        } catch {
          resolve({ raw: data });
        }
      });
    });
    
    req.on('error', e => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Executa um job em um agente.
 */
async function runAgentJob(agentName, task, timeoutMs = 5 * 60 * 1000) {
  log(`RUN: agent=${agentName} task="${task.slice(0, 80)}..."`);
  
  try {
    const r = await agentRequest('POST', '/v1/jobs', { agent: agentName, task });
    const jobId = r.jobId || r.id;
    
    if (!jobId) {
      throw new Error(`Sem jobId na resposta: ${JSON.stringify(r).slice(0, 100)}`);
    }
    
    // Polling até completar
    const pollMs = 8000;
    const start = Date.now();
    
    while (Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, pollMs));
      
      try {
        const status = await agentRequest('GET', `/v1/jobs/${jobId}`);
        
        if (status.status === 'done') {
          log(`DONE: job=${jobId} agent=${agentName}`);
          return { status: 'done', result: status.result };
        }
        if (status.status === 'error') {
          log(`ERROR: job=${jobId} agent=${agentName}`);
          return { status: 'error', result: status.result };
        }
      } catch (e) {
        log(`AVISO polling ${jobId}: ${e.message}`);
      }
    }
    
    log(`TIMEOUT: job=${jobId} agent=${agentName}`);
    return { status: 'error', result: 'timeout' };
    
  } catch (e) {
    log(`FALHA: agent=${agentName} erro=${e.message}`);
    return { status: 'error', result: e.message };
  }
}

/**
 * Salva resultado em arquivo de relatório.
 */
function salvarRelatorio(nome, conteudo) {
  try {
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
    const data = new Date().toISOString().slice(0, 10);
    const filename = `${nome}-${data}.md`;
    const filepath = path.join(REPORTS_DIR, filename);
    fs.writeFileSync(filepath, conteudo, 'utf8');
    log(`REPORT: salvo ${filepath}`);
    return filepath;
  } catch (e) {
    log(`ERRO salvando relatório: ${e.message}`);
    return null;
  }
}

/**
 * Salva JSON no workspace.
 */
function salvarWorkspace(dir, filename, data) {
  try {
    const dirPath = path.join(ROOT, 'workspace', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const filepath = path.join(dirPath, filename);
    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    fs.writeFileSync(filepath, content, 'utf8');
    log(`WORKSPACE: salvo ${dir}/${filename}`);
    return filepath;
  } catch (e) {
    log(`ERRO salvando workspace: ${e.message}`);
    return null;
  }
}

/**
 * Executa ciclo do CEO definindo meta.
 */
async function cicloCEO(meta) {
  log('INICIANDO CICLO CEO');
  memory.adicionarHistorico('CEO', 'inicio_ciclo', { meta });
  
  const contexto = memory.lerContexto();
  const pipeline = memory.listarPipeline();
  
  const task = `Você é o CEO do VNMAX Studio. Defina o plano de ação para hoje.

META DEFINIDA: ${meta || 'Crescimento de clientes'}

CONTEXTO ATUAL:
- Leads no pipeline: ${pipeline.length}
- Status: ${JSON.stringify(pipeline.map(l => ({ id: l.id, status: l.status, proximo: l.proximo_agente })))}

Retorne em markdown seu plano com:
1. Prioridade do dia
2. Ações para Growth
3. Ações para Clientes
4. Ações para Criação
5. Ações para Tráfego
6. Ações para Dados`;

  const r = await runAgentJob('studio-ceo', task, 8 * 60 * 1000);
  
  if (r.status === 'done') {
    salvarRelatorio('plano-ceo', r.result);
    memory.adicionarHistorico('CEO', 'plano_definido', { result: r.result.slice(0, 500) });
    events.relatorioAtualizado({ tipo: 'plano-ceo', resultado: r.result });
    return r.result;
  }
  
  return null;
}

/**
 * Growth: encontra leads.
 */
async function agenteGrowth() {
  log('AGENTE GROWTH: buscando leads');
  memory.adicionarHistorico('Growth', 'inicio_busca');
  
  const CIDADE = process.env.STUDIO_CIDADE || 'São Paulo';
  
  const task = `Você é o agente Growth do VNMAX Studio. Encontre 5 negócios locais reais em ${CIDADE}.

Pesquise em segmentos variados: nutricionistas, dentistas, personal trainers, contadores, advogados, petshops.

Para cada negócio encontrado, retorne JSON:
<<<JSON>>>
{
  "nome": "Nome Real",
  "segmento": "categoria",
  "contato": "@handle ou telefone",
  "observacao": "problema identificado no site"
}
<<<FIM_JSON>>>`;

  const r = await runAgentJob('studio-growth', task, 10 * 60 * 1000);
  
  if (r.status === 'done') {
    // Extrair JSON dos leads
    const texto = r.result;
    const match = texto.match(/<<<JSON>>>([\s\S]*?)<<<FIM_JSON>>>/);
    
    if (match) {
      try {
        const leads = JSON.parse(match[1]);
        const leadsArray = Array.isArray(leads) ? leads : [leads];
        
        // Salvar e processar cada lead
        for (const lead of leadsArray) {
          const leadId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const leadData = {
            id: leadId,
            ...lead,
            prioridade: 50,
            status: 'novo',
            proximo_agente: 'Clientes'
          };
          
          memory.atualizarPipeline(leadData);
          memory.adicionarHistorico('Growth', 'lead_encontrado', { id: leadId, nome: lead.nome });
          events.novoLead(leadData);
        }
        
        salvarWorkspace('leads', `leads-${Date.now()}.json`, leadsArray);
        log(`GROWTH: ${leadsArray.length} leads encontrados`);
        
        return leadsArray;
      } catch (e) {
        log(`ERRO parse leads: ${e.message}`);
      }
    }
  }
  
  return [];
}

/**
 * Clientes: qualification and proposals.
 */
async function agenteClientes() {
  log('AGENTE CLIENTES: processando leads');
  memory.adicionarHistorico('Clientes', 'inicio_processamento');
  
  const leads = memory.listarPipeline('novo');
  if (leads.length === 0) {
    log('CLIENTES: nenhum lead novo para processar');
    return [];
  }
  
  const propostas = [];
  
  for (const lead of leads) {
    const task = `Você é o agente Clientes do VNMAX Studio. Crie uma proposta para:

NOME: ${lead.nome}
SEGMENTO: ${lead.segmento}
CONTATO: ${lead.contato}

PACOTES DISPONÍVEIS:
- BÁSICO: R$500 + R$200/mês
- COMPLETO: R$900 + R$350/mês
- PREMIUM: R$1.500 + R$500/mês

Retorne JSON:
<<<JSON>>>
{
  "para": "email do lead",
  "assunto": "Assunto do email",
  "corpo": "Corpo do email personalizado (sem preço)",
  "pacote_recomendado": "COMPLETO"
}
<<<FIM_JSON>>>`;

    const r = await runAgentJob('studio-clientes', task, 5 * 60 * 1000);
    
    if (r.status === 'done') {
      const texto = r.result;
      const match = texto.match(/<<<JSON>>>([\s\S]*?)<<<FIM_JSON>>>/);
      
      if (match) {
        try {
          const proposta = JSON.parse(match[1]);
          proposta.leadId = lead.id;
          proposta.timestamp = new Date().toISOString();
          
          // Salvar como pendente de aprovação
          salvarWorkspace('propostas', `${lead.id}.json`, proposta);
          
          // Atualizar pipeline
          memory.atualizarPipeline({
            id: lead.id,
            status: 'proposta_criada',
            proximo_agente: 'CEO'
          });
          
          memory.adicionarHistorico('Clientes', 'proposta_criada', { leadId: lead.id });
          events.propostaCriada({ leadId: lead.id, proposta });
          
          propostas.push(proposta);
        } catch (e) {
          log(`ERRO parse proposta: ${e.message}`);
        }
      }
    }
  }
  
  log(`CLIENTES: ${propostas.length} propostas criadas`);
  return propostas;
}

/**
 * Criação: gera landing pages.
 */
async function agenteCriacao() {
  log('AGENTE CRIACAO: criando lands');
  memory.adicionarHistorico('Criacao', 'inicio_criacao');
  
  const propostas = memory.listarPipeline('proposta_criada');
  if (propostas.length === 0) {
    log('CRIACAO: nenhuma proposta para criar landing');
    return [];
  }
  
  const landings = [];
  
  for (const proposta of propostas) {
    const task = `Você é o agente Criação do VNMAX Studio. Crie o esboço de uma landing page para:

CLIENTE: ${proposta.leadId}
PACOTE: ${proposta.pacote_recomendado || 'COMPLETO'}

Retorne em markdown o conteúdo da landing com:
- Headline principal
- Subheadline
- Benefícios
- Social proof
- CTA`;

    const r = await runAgentJob('studio-criacao', task, 8 * 60 * 1000);
    
    if (r.status === 'done') {
      salvarWorkspace('paginas', `landing-${proposta.leadId}.md`, r.result);
      
      memory.atualizarPipeline({
        id: proposta.id || proposta.leadId,
        status: 'landing_pronta',
        proximo_agente: 'Tráfego'
      });
      
      memory.adicionarHistorico('Criacao', 'landing_criada', { leadId: proposta.leadId });
      events.landingPronta({ leadId: proposta.leadId });
      
      landings.push(r.result);
    }
  }
  
  log(`CRIACAO: ${landings.length} landings criadas`);
  return landings;
}

/**
 * Tráfego: prepara campanhas.
 */
async function agenteTrafego() {
  log('AGENTE TRAFEGO: preparando campanhas');
  memory.adicionarHistorico('Trafego', 'inicio_campanha');
  
  const landings = memory.listarPipeline('landing_pronta');
  if (landings.length === 0) {
    log('TRAFEGO: nenhuma landing para campanha');
    return [];
  }
  
  const campanhas = [];
  
  for (const landing of landings) {
    const task = `Você é o agente Tráfego do VNMAX Studio. Crie estratégia de campanha para:

CLIENTE: ${landing.id}

Configure:
- 10 conjuntos de anúncios
- R$6/dia por conjunto
- Público: 20-44 anos

Retorne em markdown a estratégia completa.`;

    const r = await runAgentJob('studio-trafego', task, 6 * 60 * 1000);
    
    if (r.status === 'done') {
      salvarWorkspace('campanhas', `campanha-${landing.id}.md`, r.result);
      
      memory.atualizarPipeline({
        id: landing.id,
        status: 'campanha_criada',
        proximo_agente: 'Dados'
      });
      
      memory.adicionarHistorico('Trafego', 'campanha_criada', { leadId: landing.id });
      events.campanhaCriada({ leadId: landing.id });
      
      campanhas.push(r.result);
    }
  }
  
  log(`TRAFEGO: ${campanhas.length} campanhas criadas`);
  return campanhas;
}

/**
 * Dados: atualiza métricas.
 */
async function agenteDados() {
  log('AGENTE DADOS: compilando métricas');
  memory.adicionarHistorico('Dados', 'inicio_relatorio');
  
  const pipeline = memory.listarPipeline();
  const historico = memory.lerHistorico(50);
  
  const task = `Você é o agente Dados do VNMAX Studio. Compile o relatório semanal.

PIPELINE ATUAL:
${JSON.stringify(pipeline.map(l => ({ id: l.id, status: l.status, agente: l.proximo_agente })), null, 2)}

HISTÓRICO:
${JSON.stringify(historico.slice(-10), null, 2)}

Retorne em markdown com seções:
- RECEITA (novos clientes, recorrência)
- CUSTOS (tráfego, ferramentas)
- RESULTADO (lucro, margem, CAC)
- INTELIGÊNCIA (melhor oportunidade)`;

  const r = await runAgentJob('studio-dados', task, 6 * 60 * 1000);
  
  if (r.status === 'done') {
    salvarRelatorio('relatorio-dados', r.result);
    events.relatorioAtualizado({ tipo: 'dados-semanais' });
    memory.adicionarHistorico('Dados', 'relatorio_gerado', {});
  }
  
  return r.status === 'done' ? r.result : null;
}

/**
 * Executa pipeline completo (demo/teste).
 */
async function executarPipelineCompleto() {
  log('=== INICIANDO PIPELINE COMPLETO ===');
  
  // 1. CEO define meta
  await cicloCEO('Crescimento de 3 novos clientes');
  
  // 2. Growth encontra leads
  const leads = await agenteGrowth();
  log(`Pipeline: ${leads.length} leads encontrados`);
  
  // 3. Clientes cria propostas
  const propostas = await agenteClientes();
  log(`Pipeline: ${propostas.length} propostas criadas`);
  
  // 4. Criação gera landings (se houver propostas)
  if (propostas.length > 0) {
    const landings = await agenteCriacao();
    log(`Pipeline: ${landings.length} landings criadas`);
    
    // 5. Tráfego prepara campanhas
    if (landings.length > 0) {
      const campanhas = await agenteTrafego();
      log(`Pipeline: ${campanhas.length} campanhas criadas`);
    }
  }
  
  // 6. Dados atualiza métricas
  await agenteDados();
  
  log('=== PIPELINE COMPLETO FINALIZADO ===');
  return memory.listarPipeline();
}

/**
 * Status do orchestrator.
 */
function status() {
  return {
    pipeline: memory.listarPipeline(),
    historico: memory.lerHistorico(20),
    eventos: events.lerEventosRecentes(20),
    configurado: !!NXS_KEY
  };
}

module.exports = {
  runAgentJob,
  cicloCEO,
  agenteGrowth,
  agenteClientes,
  agenteCriacao,
  agenteTrafego,
  agenteDados,
  executarPipelineCompleto,
  status,
  salvarRelatorio,
  salvarWorkspace,
  log
};