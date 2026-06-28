#!/usr/bin/env node
'use strict';

/**
 * Demo - Exemplo funcional de um lead percorrendo o pipeline.
 * Execute: node core/demo.js
 */

const path = require('path');
const ROOT = path.join(__dirname);
process.env.STUDIO_ROOT = ROOT;

const memory = require('./memory');
const events = require('./events');

// Lead de exemplo
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

// Simula o pipeline completo
async function demoPipeline() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║         Agency OS - Demo Pipeline Multiagente           ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  console.log('📋 LEAD DE ENTRADA:');
  console.log(JSON.stringify(LEAD_EXEMPLO, null, 2));
  console.log('');

  // ========== ETAPA 1: GROWTH ==========
  console.log('━'.repeat(60));
  console.log('🔵 ETAPA 1: GROWTH encontra lead');
  console.log('━'.repeat(60));
  
  memory.atualizarPipeline(LEAD_EXEMPLO);
  memory.adicionarHistorico('Growth', 'lead_encontrado', {
    id: LEAD_EXEMPLO.id,
    nome: LEAD_EXEMPLO.cliente
  });
  
  const leadData = events.novoLead({
    id: LEAD_EXEMPLO.id,
    nome: LEAD_EXEMPLO.cliente,
    segmento: LEAD_EXEMPLO.segmento
  });
  
  console.log('✅ Lead salvo no pipeline com status: novo');
  console.log('✅ Evento NovoLead disparado');
  console.log('');

  // ========== ETAPA 2: CLIENTES ==========
  console.log('━'.repeat(60));
  console.log('🟡 ETAPA 2: CLIENTES qualifica e cria proposta');
  console.log('━'.repeat(60));
  
  memory.atualizarPipeline({
    id: LEAD_EXEMPLO.id,
    status: 'qualificado',
    proximo_agente: 'Criacao'
  });
  
  memory.adicionarHistorico('Clientes', 'lead_qualificado', {
    id: LEAD_EXEMPLO.id,
    interesse: 'alto',
    pacote_recomendado: 'COMPLETO'
  });
  
  const proposta = {
    id: `prop_${Date.now()}`,
    leadId: LEAD_EXEMPLO.id,
    cliente: LEAD_EXEMPLO.cliente,
    pacote: 'COMPLETO',
    valor: 900,
    recorrente: 350
  };
  
  events.propostaCriada({
    leadId: LEAD_EXEMPLO.id,
    proposta
  });
  
  console.log('✅ Lead qualificado como: ALTO INTERESSE');
  console.log('✅ Proposta criada: Pacote COMPLETO (R$900 + R$350/mês)');
  console.log('✅ Evento PropostaCriada disparado');
  console.log('');

  // ========== ETAPA 3: CRIAÇÃO ==========
  console.log('━'.repeat(60));
  console.log('🟣 ETAPA 3: CRIAÇÃO gera landing page');
  console.log('━'.repeat(60));
  
  memory.atualizarPipeline({
    id: LEAD_EXEMPLO.id,
    status: 'landing_pronta',
    proximo_agente: 'Tráfego'
  });
  
  memory.adicionarHistorico('Criacao', 'landing_criada', {
    id: LEAD_EXEMPLO.id,
    titulo: 'Transforme Visits em Clientes',
    cta: 'Quero Minha Landing'
  });
  
  events.landingPronta({
    leadId: LEAD_EXEMPLO.id,
    landingUrl: `/paginas/landing-${LEAD_EXEMPLO.id}.html`
  });
  
  console.log('✅ Landing page criada');
  console.log('✅ Headline: "Transforme Visits em Clientes"');
  console.log('✅ CTA: "Quero Minha Landing"');
  console.log('✅ Evento LandingPronta disparado');
  console.log('');

  // ========== ETAPA 4: TRÁFEGO ==========
  console.log('━'.repeat(60));
  console.log('🔴 ETAPA 4: TRÁFEGO prepara campanha');
  console.log('━'.repeat(60));
  
  memory.atualizarPipeline({
    id: LEAD_EXEMPLO.id,
    status: 'campanha_criada',
    proximo_agente: 'Dados'
  });
  
  memory.adicionarHistorico('Trafego', 'campanha_criada', {
    id: LEAD_EXEMPLO.id,
    conjuntos: 10,
    investimento_diario: 60
  });
  
  events.campanhaCriada({
    leadId: LEAD_EXEMPLO.id,
    campanha: 'campanha-renova-clinica-001'
  });
  
  console.log('✅ Campanha criada com 10 conjuntos');
  console.log('✅ Investimento: R$60/dia');
  console.log('✅ Público: 20-44 anos');
  console.log('✅ Evento CampanhaCriada disparado');
  console.log('');

  // ========== ETAPA 5: DADOS ==========
  console.log('━'.repeat(60));
  console.log('🟢 ETAPA 5: DADOS atualiza métricas');
  console.log('━'.repeat(60));
  
  memory.adicionarHistorico('Dados', 'metricas_atualizadas', {
    leads_pipeline: 1,
    propostas_pendentes: 1,
    campanhas_ativas: 1
  });
  
  events.relatorioAtualizado({
    tipo: 'pipeline-atualizado',
    pipeline: memory.listarPipeline()
  });
  
  console.log('✅ Métricas atualizadas');
  console.log('✅ Relatório gerado');
  console.log('✅ Evento RelatorioAtualizado disparado');
  console.log('');

  // ========== RESULTADO FINAL ==========
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║              ✅ PIPELINE CONCLUÍDO                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  console.log('📊 RESUMO DO PIPELINE:');
  const pipeline = memory.listarPipeline();
  for (const item of pipeline) {
    console.log(`  ${item.id}`);
    console.log(`    Nome: ${item.cliente}`);
    console.log(`    Status: ${item.status}`);
    console.log(`    Próximo: ${item.proximo_agente}`);
    console.log(`    Prioridade: ${item.prioridade}`);
    console.log('');
  }

  console.log('📜 HISTÓRICO DE EVENTOS:');
  const historico = memory.lerHistorico(10);
  for (const h of historico) {
    console.log(`  [${new Date(h.timestamp).toLocaleTimeString('pt-BR')}] ${h.agente}: ${h.acao}`);
  }
  console.log('');

  console.log('📁 ESTRUTURA CRIADA:');
  console.log('  workspace/');
  console.log('  ├── leads/         ← leads encontrados');
  console.log('  ├── clientes/     ← clientes cadastrados');
  console.log('  ├── campanhas/     ← campanhas criadas');
  console.log('  ├── conteudo/     ← conteúdo gerado');
  console.log('  ├── paginas/      ← landing pages');
  console.log('  ├── propostas/    ← propostas criadas');
  console.log('  ├── emails/        ← emails de prospecção');
  console.log('  ├── aprovacoes/   ← itens pendentes');
  console.log('  ├── reports/      ← relatórios');
  console.log('  └── memory/       ← contexto compartilhado');
  console.log('');

  console.log('🎯 FORMATO JSON PADRÃO ENTRE AGENTES:');
  console.log(JSON.stringify({
    id: LEAD_EXEMPLO.id,
    cliente: LEAD_EXEMPLO.cliente,
    dor: LEAD_EXEMPLO.dor,
    prioridade: LEAD_EXEMPLO.prioridade,
    status: 'pipeline_concluido',
    proximo_agente: 'CEO'
  }, null, 2));
  console.log('');
  
  console.log('✨ Demo concluída com sucesso!');
}

demoPipeline().catch(console.error);