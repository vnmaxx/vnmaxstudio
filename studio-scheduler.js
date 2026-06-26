#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.STUDIO_ROOT || path.join(__dirname);
process.env.STUDIO_ROOT = ROOT;

const aprovacoes = require(path.join(ROOT, 'lib', 'aprovacoes.js'));

const WORKSPACE = path.join(ROOT, 'workspace');
const REPORTS = path.join(WORKSPACE, 'reports');
const LOGS = path.join(ROOT, 'logs');
const LOG_FILE = path.join(LOGS, 'scheduler.log');

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (let line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    process.env[key] = val;
  }
}

loadEnv();

function ensureDirs() {
  for (const d of [WORKSPACE, REPORTS, LOGS]) fs.mkdirSync(d, { recursive: true });
  aprovacoes.ensureDirs();
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function log(msg) {
  const ts = new Date().toLocaleString('pt-BR', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const linha = `[${ts}] ${msg}`;
  try {
    fs.mkdirSync(LOGS, { recursive: true });
    fs.appendFileSync(LOG_FILE, linha + '\n', 'utf8');
  } catch (_) {}
  console.log(linha);
}

const NXS_HOST = process.env.NXS_HOST || '127.0.0.1';
const NXS_PORT = parseInt(process.env.NXS_PORT || '8006', 10);

function httpRequest(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const key = process.env.NXS_STUDIO_KEY;
    if (!key) return reject(new Error('NXS_STUDIO_KEY ausente no .env'));
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      host: NXS_HOST, port: NXS_PORT, path: pathname, method,
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : {}; } catch (_) { parsed = { raw: data }; }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
        else reject(new Error(`HTTP ${res.statusCode} em ${pathname}: ${data.slice(0, 300)}`));
      });
    });
    req.on('error', (e) => reject(new Error(`Falha de rede em ${pathname}: ${e.message}`)));
    req.on('timeout', () => { req.destroy(new Error(`Timeout em ${pathname}`)); });
    if (payload) req.write(payload);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runJob(agent, task, opts = {}) {
  const timeoutMs = opts.timeoutMs || 5 * 60 * 1000;
  const pollMs = opts.pollMs || 8000;

  log(`runJob → agent=${agent} task="${String(task).slice(0, 80)}..."`);

  let jobId;
  try {
    const r = await httpRequest('POST', '/v1/jobs', { agent, task });
    jobId = r.jobId || r.id;
    if (!jobId) throw new Error(`resposta sem jobId: ${JSON.stringify(r).slice(0, 200)}`);
  } catch (e) {
    log(`ERRO ao criar job (${agent}): ${e.message}`);
    return { status: 'error', result: e.message };
  }

  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    await sleep(pollMs);
    let r;
    try { r = await httpRequest('GET', `/v1/jobs/${jobId}`); }
    catch (e) { log(`AVISO polling ${jobId}: ${e.message} (continua)`); continue; }
    if (r.status === 'done') {
      log(`job ${jobId} (${agent}) → done`);
      return { status: 'done', result: r.result };
    }
    if (r.status === 'error') {
      log(`job ${jobId} (${agent}) → error: ${JSON.stringify(r.result).slice(0, 200)}`);
      return { status: 'error', result: r.result };
    }
  }
  log(`job ${jobId} (${agent}) → timeout após ${timeoutMs}ms`);
  return { status: 'error', result: 'timeout' };
}

function lerDiretorio(dir, opts = {}) {
  const maxArquivos = opts.maxArquivos || 15;
  const maxCharsArquivo = opts.maxCharsArquivo || 4000;
  if (!fs.existsSync(dir)) return '(diretório vazio ou inexistente)';
  const arquivos = fs.readdirSync(dir).filter(f => !f.startsWith('.')).slice(0, maxArquivos);
  if (arquivos.length === 0) return '(sem arquivos)';
  let out = '';
  for (const f of arquivos) {
    try {
      const conteudo = fs.readFileSync(path.join(dir, f), 'utf8').slice(0, maxCharsArquivo);
      out += `\n=== ${f} ===\n${conteudo}\n`;
    } catch (_) {}
  }
  return out || '(sem conteúdo legível)';
}

function salvarResultado(filePath, resultado) {
  if (!resultado) return false;
  const texto = typeof resultado === 'string' ? resultado : JSON.stringify(resultado, null, 2);
  if (!texto || texto.length < 10) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, texto, 'utf8');
  return true;
}

function resumoWorkspace() {
  const dirs = ['leads', 'conteudo', 'produtos', 'paginas', 'campanhas', 'emails', 'clientes', 'propostas', 'reports'];
  const linhas = [];
  for (const d of dirs) {
    const dir = path.join(WORKSPACE, d);
    const count = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => !f.startsWith('.')).length : 0;
    linhas.push(`${d}: ${count} arquivo(s)`);
  }
  return linhas.join('\n');
}

async function cicloSegunda() {
  ensureDirs();
  const data = hojeISO();
  log('=== CICLO SEGUNDA 08:00 ===');

  const contextoWorkspace = resumoWorkspace();
  const leadsExistentes = lerDiretorio(path.join(WORKSPACE, 'leads'), { maxArquivos: 5 });
  const produtosExistentes = lerDiretorio(path.join(WORKSPACE, 'produtos'), { maxArquivos: 5 });

  const rCeo = await runJob('studio-ceo',
    `Você é o CEO de uma agência de marketing digital. Com base no estado atual do workspace abaixo, escreva o plano da semana com 3 prioridades + instruções claras para cada agente (Growth, Criação, Tráfego, Clientes, Dados). Retorne SOMENTE o texto do plano em markdown.\n\nESTADO DO WORKSPACE:\n${contextoWorkspace}\n\nSAMPLE DE LEADS:\n${leadsExistentes}\n\nPRODUTOS EXISTENTES:\n${produtosExistentes}`,
    { timeoutMs: 8 * 60 * 1000 });

  if (rCeo.status === 'done' && rCeo.result) {
    const planoPath = path.join(REPORTS, `plano-${data}.md`);
    if (salvarResultado(planoPath, rCeo.result)) log(`plano da semana salvo → ${planoPath}`);
  }

  const planoAtual = fs.existsSync(path.join(REPORTS, `plano-${data}.md`))
    ? fs.readFileSync(path.join(REPORTS, `plano-${data}.md`), 'utf8').slice(0, 3000)
    : '(plano ainda não gerado)';

  const CIDADE = process.env.STUDIO_CIDADE || 'São Paulo';
  const planoResumo = planoAtual.slice(0, 800);

  const rGrowth = await runJob('studio-growth',
    `Pesquise negócios locais reais em ${CIDADE} (nota 4.7+, site ruim). Gere 5 leads + 1 roteiro viral.\n\n<<<LEADS>>>\n[{"nome":"...","segmento":"...","contato":"@handle / tel","observacao":"Nota X.X - N avaliações - problema no site"}]\n<<<FIM_LEADS>>>\n<<<ROTEIROS>>>\n[roteiro]\n<<<FIM_ROTEIROS>>>\n\nPRIORIDADE DA SEMANA:\n${planoResumo}`,
    { timeoutMs: 12 * 60 * 1000 });

  if (rGrowth.status === 'done' && rGrowth.result) {
    const texto = typeof rGrowth.result === 'string' ? rGrowth.result : JSON.stringify(rGrowth.result);
    const leadsBloco = extrairBloco(texto, '<<<LEADS>>>', '<<<FIM_LEADS>>>');
    const roteirosBloco = extrairBloco(texto, '<<<ROTEIROS>>>', '<<<FIM_ROTEIROS>>>');
    if (leadsBloco) {
      const leadsPath = path.join(WORKSPACE, 'leads', `leads-${data}.json`);
      if (salvarResultado(leadsPath, leadsBloco)) log(`leads salvos → ${leadsPath}`);
    }
    if (roteirosBloco) {
      const rotPath = path.join(WORKSPACE, 'conteudo', `roteiros-${data}.md`);
      if (salvarResultado(rotPath, roteirosBloco)) log(`roteiros salvos → ${rotPath}`);
    }
  }

  const rCriacao = await runJob('studio-criacao',
    `Você é o agente de Criação de uma agência de marketing digital. Com base no plano da semana, crie o esboço de um produto digital ou landing page prioritária. Retorne o conteúdo completo em markdown.\n\nPLANO DA SEMANA:\n${planoAtual}`,
    { timeoutMs: 8 * 60 * 1000 });

  if (rCriacao.status === 'done' && rCriacao.result) {
    const criacaoPath = path.join(WORKSPACE, 'produtos', `criacao-${data}.md`);
    if (salvarResultado(criacaoPath, rCriacao.result)) log(`criação salva → ${criacaoPath}`);
  }

  log('=== CICLO SEGUNDA concluído ===');
}

async function cicloDiario() {
  ensureDirs();
  log('=== CICLO DIÁRIO 09:00 ===');

  const campanhas = lerDiretorio(path.join(WORKSPACE, 'campanhas'));
  const leads = lerDiretorio(path.join(WORKSPACE, 'leads'), { maxArquivos: 10 });

  const rTrafego = await runJob('studio-trafego',
    `Você é o agente de Tráfego de uma agência de marketing digital. Analise as campanhas abaixo e gere recomendações de otimização (CTR/CPC/ROAS) seguindo as regras de decisão. Retorne as recomendações em markdown.\n\nCAMPANHAS:\n${campanhas}`,
    { timeoutMs: 6 * 60 * 1000 });

  if (rTrafego.status === 'done' && rTrafego.result) {
    const data = hojeISO();
    const trafPath = path.join(REPORTS, `trafego-${data}.md`);
    if (salvarResultado(trafPath, rTrafego.result)) log(`recomendações de tráfego salvas → ${trafPath}`);
  }

  const r = await runJob('studio-clientes',
    `Você é o agente de Clientes de uma agência de marketing digital. Com base nos leads abaixo, rascunhe emails de prospecção personalizados (sem mencionar preço no primeiro contato) para os 5 primeiros leads. Para CADA email, retorne um bloco delimitado por <<<EMAIL>>> e <<<FIM>>> com JSON {para, assunto, corpo}. NÃO invente dados. Use apenas os leads fornecidos.\n\nLEADS:\n${leads}`,
    { timeoutMs: 6 * 60 * 1000 });

  if (r.status === 'done' && r.result) {
    const texto = typeof r.result === 'string' ? r.result : JSON.stringify(r.result);
    const blocos = extrairBlocos(texto, '<<<EMAIL>>>', '<<<FIM>>>');
    let n = 0;
    for (const bloco of blocos) {
      let conteudo;
      try { conteudo = JSON.parse(bloco); } catch (_) { conteudo = { corpo: bloco }; }
      const id = aprovacoes.salvar('email', conteudo);
      n++;
      log(`email rascunhado → aprovação pendente ${id}`);
    }
    if (n > 0) log(`${n} email(s) salvos como PENDENTES de aprovação.`);
    else log('studio-clientes não retornou rascunhos utilizáveis.');
  } else {
    log('studio-clientes não retornou rascunhos utilizáveis.');
  }

  log('=== CICLO DIÁRIO concluído ===');
}

async function cicloSexta() {
  ensureDirs();
  const data = hojeISO();
  log('=== CICLO SEXTA 17:00 ===');

  const ws = resumoWorkspace();
  const leadsData = lerDiretorio(path.join(WORKSPACE, 'leads'), { maxArquivos: 5 });
  const campanhasData = lerDiretorio(path.join(WORKSPACE, 'campanhas'), { maxArquivos: 5 });
  const reportsData = lerDiretorio(REPORTS, { maxArquivos: 3, maxCharsArquivo: 2000 });

  const rDados = await runJob('studio-dados',
    `Você é o agente de Dados de uma agência de marketing. Compile o relatório de dados da semana com base nas informações abaixo. Retorne no formato markdown com seções: RECEITA, CUSTOS, RESULTADO, INTELIGÊNCIA.\n\nWORKSPACE:\n${ws}\n\nLEADS:\n${leadsData}\n\nCAMPANHAS:\n${campanhasData}\n\nRELATÓRIOS ANTERIORES:\n${reportsData}`,
    { timeoutMs: 8 * 60 * 1000 });

  let dadosSemana = '(sem dados compilados)';
  if (rDados.status === 'done' && rDados.result) {
    const dadosPath = path.join(REPORTS, `dados-semana-${data}.md`);
    dadosSemana = typeof rDados.result === 'string' ? rDados.result : JSON.stringify(rDados.result);
    if (salvarResultado(dadosPath, dadosSemana)) log(`dados da semana salvos → ${dadosPath}`);
    dadosSemana = dadosSemana.slice(0, 4000);
  }

  const rCeo = await runJob('studio-ceo',
    `Você é o CEO de uma agência de marketing digital. Com base nos dados da semana abaixo, escreva o relatório final do fundador (máx. 1 página) com: resultado da semana, o que funcionou, o que muda, plano próxima semana e no máximo 3 perguntas binárias. Retorne somente o markdown do relatório.\n\nDADOS DA SEMANA:\n${dadosSemana}`,
    { timeoutMs: 8 * 60 * 1000 });

  if (rCeo.status === 'done' && rCeo.result) {
    const relPath = path.join(REPORTS, `relatorio-${data}.md`);
    if (salvarResultado(relPath, rCeo.result)) {
      log(`relatório do fundador salvo → ${relPath}`);
      mostrarRelatorio(relPath);
    }
  }

  log('=== CICLO SEXTA concluído ===');
}

function extrairBloco(texto, abre, fecha) {
  const a = texto.indexOf(abre);
  if (a === -1) return null;
  const b = texto.indexOf(fecha, a + abre.length);
  if (b === -1) return null;
  return texto.slice(a + abre.length, b).trim();
}

function extrairBlocos(texto, abre, fecha) {
  const out = [];
  let i = 0;
  while (true) {
    const a = texto.indexOf(abre, i);
    if (a === -1) break;
    const b = texto.indexOf(fecha, a + abre.length);
    if (b === -1) break;
    out.push(texto.slice(a + abre.length, b).trim());
    i = b + fecha.length;
  }
  return out;
}

function cmdPendentes() {
  const itens = aprovacoes.listar();
  if (itens.length === 0) { console.log('Nada pendente de aprovação. ✅'); return; }
  console.log(`\n${itens.length} item(ns) aguardando sua aprovação:\n`);
  for (const i of itens) {
    console.log(`  ID:   ${i.id}`);
    console.log(`  Tipo: ${i.tipo}`);
    console.log(`  Data: ${i.data}`);
    console.log(`  Resumo: ${i.resumo}`);
    console.log('  ' + '-'.repeat(50));
  }
  console.log('\nAprovar:  node studio-scheduler.js --aprovar=<id>');
  console.log('Rejeitar: node studio-scheduler.js --rejeitar=<id> --motivo="..."\n');
}

function executarAprovado(id, conteudo) {
  console.log(`\n✅ Item ${id} APROVADO. Conteúdo para uso:\n`);
  console.log(typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo, null, 2));
  console.log('');
}

function cmdAprovar(id) {
  try {
    const conteudo = aprovacoes.aprovar(id);
    log(`aprovação ${id} → aprovada`);
    executarAprovado(id, conteudo);
  } catch (e) {
    console.error(`Erro: ${e.message}`);
    process.exitCode = 1;
  }
}

function cmdRejeitar(id, motivo) {
  try {
    aprovacoes.rejeitar(id, motivo);
    log(`aprovação ${id} → rejeitada (${motivo || 'sem motivo'})`);
    console.log(`Item ${id} rejeitado.`);
  } catch (e) {
    console.error(`Erro: ${e.message}`);
    process.exitCode = 1;
  }
}

function cmdAprovarTodos() {
  const aprovados = aprovacoes.aprovarTodos();
  if (aprovados.length === 0) { console.log('Nada pendente.'); return; }
  for (const a of aprovados) executarAprovado(a.id, a.conteudo);
  log(`aprovar-todos → ${aprovados.length} item(ns)`);
}

function mostrarRelatorio(p) {
  if (p && fs.existsSync(p)) {
    console.log('\n' + '='.repeat(60));
    console.log(fs.readFileSync(p, 'utf8'));
    console.log('='.repeat(60) + '\n');
    return;
  }
  console.log('Relatório ainda não disponível.');
}

function cmdRelatorio() {
  if (!fs.existsSync(REPORTS)) { console.log('Sem relatórios ainda.'); return; }
  const arquivos = fs.readdirSync(REPORTS).filter((f) => f.startsWith('relatorio-') && f.endsWith('.md')).sort();
  if (arquivos.length === 0) { console.log('Sem relatórios ainda.'); return; }
  mostrarRelatorio(path.join(REPORTS, arquivos[arquivos.length - 1]));
}

function parseArgs(argv) {
  const args = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] === undefined ? true : m[2];
  }
  return args;
}

async function main() {
  ensureDirs();
  const disabled = fs.existsSync(path.join(ROOT, 'DISABLED'));
  const args = parseArgs(process.argv);

  if (args.pendentes) return cmdPendentes();
  if (args.relatorio) return cmdRelatorio();
  if (args.aprovar) return cmdAprovar(args.aprovar);
  if (args['aprovar-todos']) return cmdAprovarTodos();
  if (args.rejeitar) return cmdRejeitar(args.rejeitar, args.motivo || '');

  if (args.cycle) {
    if (disabled) { log('DISABLED presente — ciclo abortado.'); return; }
    if (args.cycle === 'segunda') return cicloSegunda();
    if (args.cycle === 'diario') return cicloDiario();
    if (args.cycle === 'sexta') return cicloSexta();
    console.error(`Ciclo desconhecido: ${args.cycle}`);
    process.exitCode = 1;
    return;
  }

  if (args.agent && args.task) {
    const r = await runJob(args.agent, args.task);
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  console.log(`Studio IA — scheduler
Uso:
  --cycle=segunda|diario|sexta     roda um ciclo
  --agent=<nome> --task="..."      tarefa ad-hoc
  --pendentes                      lista fila de aprovação
  --aprovar=<id>                   aprova e exibe o conteúdo
  --rejeitar=<id> --motivo="..."   rejeita com motivo
  --aprovar-todos                  aprova tudo (cuidado)
  --relatorio                      mostra o relatório mais recente`);
}

main().catch((e) => {
  log(`ERRO FATAL: ${e.stack || e.message}`);
  process.exitCode = 1;
});
