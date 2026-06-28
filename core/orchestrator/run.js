#!/usr/bin/env node
'use strict';

/**
 * Script de execução do pipeline multiagente.
 * Pode ser executado standalone ou via API.
 */

const path = require('path');

// Carrega módulos do core
const ROOT = path.join(__dirname, '..', '..');
process.env.STUDIO_ROOT = ROOT;

async function main() {
  console.log('=== Agency OS - Pipeline Multiagente ===');
  console.log('Iniciando execução...\n');
  
  const orchestrator = require('../orchestrator');
  
  try {
    const resultado = await orchestrator.executarPipelineCompleto();
    console.log('\n=== Pipeline Finalizado ===');
    console.log(`Total de leads processados: ${resultado.length}`);
    console.log('\nStatus do Pipeline:');
    for (const lead of resultado) {
      console.log(`  - ${lead.nome || lead.id}: ${lead.status} → ${lead.proximo_agente}`);
    }
    console.log('\nLogs salvos em: workspace/reports/');
    console.log('Pipeline completo!');
  } catch (e) {
    console.error('Erro ao executar pipeline:', e.message);
    process.exit(1);
  }
}

main();