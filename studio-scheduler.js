#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.STUDIO_ROOT || path.join(__dirname);
process.env.STUDIO_ROOT = ROOT;

const aprovacoes = require(path.join(ROOT, 'lib', 'aprovacoes.js'));
const { LoopEngine, STATES } = require(path.join(ROOT, 'lib', 'loop-engine.js'));
const { WatcherManager } = require(path.join(ROOT, 'lib', 'watchers.js'));

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

const PIPELINES_DIR = path.join(WORKSPACE, 'pipelines');

const engine = new LoopEngine({ storageDir: PIPELINES_DIR, maxConcurrent: 1 });
engine.on('log', ({ msg }) => log(msg));

function runPipeline(def, opts) {
  return new Promise((resolve) => {
    const id = engine.submit(def, { skipDedup: true, ...opts });
    if (!id) return resolve(null);
    const onDone = (rec) => {
      if (rec.id !== id) return;
      engine.off('pipeline:done', onDone);
      resolve(rec);
    };
    engine.on('pipeline:done', onDone);
  });
}

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
  const createTries = opts.createTries || 5;
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await httpRequest('POST', '/v1/jobs', { agent, task });
      jobId = r.jobId || r.id;
      if (!jobId) throw new Error(`resposta sem jobId: ${JSON.stringify(r).slice(0, 200)}`);
      break;
    } catch (e) {
      const is429 = /HTTP 429/.test(e.message || '');
      if (is429 && attempt < createTries) {
        const wait = Math.min(30000, 4000 * attempt);
        log(`429 ao criar job (${agent}) — aguardando ${wait}ms e retentando (${attempt}/${createTries - 1})`);
        await sleep(wait);
        continue;
      }
      log(`ERRO ao criar job (${agent}): ${e.message}`);
      return { status: 'error', result: e.message };
    }
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

function ciclosStore() {
  try { return new (require(path.join(ROOT, 'lib', 'ciclos.js')).Ciclos)(WORKSPACE); } catch { return null; }
}

function interpolar(tpl, ctx) {
  return String(tpl || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
    const v = ctx && ctx[k];
    return v == null ? '' : (typeof v === 'string' ? v : JSON.stringify(v));
  });
}

function slugStep(s) {
  return String(s || 'passo').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'passo';
}

function stepFromConfig(step, data) {
  const to = (step.timeoutMin || 8) * 60 * 1000;
  return {
    id: step.id,
    name: step.name,
    maxRetries: 1,
    timeoutMs: to,
    fn: async (ctx) => {
      const prompt = interpolar(step.prompt, ctx);
      if (!prompt.trim()) { log(`passo "${step.name}": prompt vazio, pulado`); return '(prompt vazio)'; }
      const r = await runJob(step.agente || 'general', prompt, { timeoutMs: to });
      if (r.status === 'error') throw new Error(String(r.result || 'falhou'));
      if (r.result && step.saveComoRelatorio !== false) {
        const p = path.join(REPORTS, `${slugStep(step.name)}-${data}.md`);
        if (salvarResultado(p, r.result)) log(`passo "${step.name}" salvo → ${p}`);
      }
      ctx[step.name] = r.result;
      return r.result;
    },
  };
}

function extrasDoCiclo(cicloId, data) {
  const store = ciclosStore();
  if (!store) return [];
  let steps = [];
  try { steps = store.extraSteps(cicloId); } catch { steps = []; }
  return steps.map(s => stepFromConfig(s, data));
}

function ordenarSteps(cicloId, baseSteps, data) {
  const all = [...baseSteps, ...extrasDoCiclo(cicloId, data)];
  let ordem = [];
  try { const store = ciclosStore(); ordem = store ? store.ordemBuiltin(cicloId) : []; } catch { ordem = []; }
  if (!ordem.length) return all;
  const byId = new Map(all.map(s => [s.id, s]));
  const out = [];
  for (const id of ordem) { if (byId.has(id)) { out.push(byId.get(id)); byId.delete(id); } }
  for (const s of all) if (byId.has(s.id)) out.push(s);
  return out;
}

async function cicloCustom(id) {
  ensureDirs();
  const data = hojeISO();
  const store = ciclosStore();
  const ciclo = store && store.getCustom(id);
  if (!ciclo) { console.error(`Ciclo custom desconhecido: ${id}`); process.exitCode = 1; return; }
  log(`=== CICLO ${ciclo.nome} (${id}) ===`);
  const steps = (ciclo.steps || []).map(s => stepFromConfig(s, data));
  if (!steps.length) { log('ciclo sem passos.'); return; }
  await runPipeline({ name: `ciclo-${id}`, cycle: id, steps }, { priority: 6 });
  log(`=== CICLO ${ciclo.nome} concluído ===`);
}

async function cicloSegunda() {
  ensureDirs();
  const data = hojeISO();
  log('=== CICLO SEGUNDA 08:00 ===');

  const contextoWorkspace = resumoWorkspace();
  const leadsExistentes = lerDiretorio(path.join(WORKSPACE, 'leads'), { maxArquivos: 5 });
  const produtosExistentes = lerDiretorio(path.join(WORKSPACE, 'produtos'), { maxArquivos: 5 });

  let leadgenCfg = { cidade: '', quantidade: 8, nichos: [] };
  try { leadgenCfg = new (require(path.join(ROOT, 'lib', 'leadgen.js')).Leadgen)(WORKSPACE).load(); } catch {}
  const CIDADE = leadgenCfg.cidade || process.env.STUDIO_CIDADE || 'São Paulo';
  const QTD_LEADS = leadgenCfg.quantidade || 8;
  let nichosDisponiveis = [];
  try { nichosDisponiveis = new (require(path.join(ROOT, 'lib', 'leadgen.js')).Leadgen)(WORKSPACE).pickNichos(Math.min(14, Math.max(6, QTD_LEADS + 4))); } catch {}
  if (!nichosDisponiveis.length) nichosDisponiveis = ['nutricionistas', 'dentistas', 'personal trainers', 'contadores', 'advogados', 'cabeleireiros', 'petshops', 'marcenarias', 'mercados de bairro'];
  const NICHOS_STR = nichosDisponiveis.join(', ');
  const NUM_SEGMENTOS = Math.min(nichosDisponiveis.length, Math.max(3, Math.ceil(QTD_LEADS / 2)));

  await runPipeline({
    name: 'ciclo-segunda',
    cycle: 'segunda',
    steps: ordenarSteps('segunda', [
      {
        id: 'seg-ceo',
        name: 'CEO — Plano Semanal',
        maxRetries: 1,
        timeoutMs: 9 * 60 * 1000,
        fn: async (ctx) => {
          const r = await runJob('studio-ceo',
            `Você é o CEO de uma agência de marketing digital. Com base no estado atual do workspace abaixo, escreva o plano da semana com 3 prioridades + instruções claras para cada agente (Growth, Criação, Tráfego, Clientes, Dados). Retorne SOMENTE o texto do plano em markdown.\n\nESTADO DO WORKSPACE:\n${contextoWorkspace}\n\nSAMPLE DE LEADS:\n${leadsExistentes}\n\nPRODUTOS EXISTENTES:\n${produtosExistentes}`,
            { timeoutMs: 8 * 60 * 1000 });
          if (r.status === 'error') throw new Error(String(r.result || 'CEO falhou'));
          if (r.result) {
            const planoPath = path.join(REPORTS, `plano-${data}.md`);
            if (salvarResultado(planoPath, r.result)) log(`plano da semana salvo → ${planoPath}`);
            ctx.plano = r.result;
          }
          return r.result;
        },
      },
      {
        id: 'seg-growth',
        name: 'Growth — Leads',
        maxRetries: 2,
        timeoutMs: 13 * 60 * 1000,
        fn: async (ctx) => {
          const planoResumo = (ctx.plano || '').slice(0, 600);
          const r = await runJob('studio-growth',
            `Use APENAS WebSearch (NÃO use WebFetch — é lento) para encontrar ${QTD_LEADS} negócios locais reais em ${CIDADE} com boa reputação mas presença digital fraca.\n\nVarie os segmentos (escolha ${NUM_SEGMENTOS} entre: ${NICHOS_STR}). Não repita o mesmo segmento em mais de 2 negócios. No máximo 2 buscas por negócio (1 para achar, 1 para o Instagram). Pare depois de encontrar os ${QTD_LEADS} e retorne o JSON imediatamente.\n\nRetorne:\n<<<LEADS>>>\n[{"nome":"...","segmento":"...","contato":"@handle / tel","observacao":"Nota X.X em [fonte] - [observação]"}]\n<<<FIM_LEADS>>>\n<<<ROTEIROS>>>\n[2 roteiros virais]\n<<<FIM_ROTEIROS>>>\n\nPRIORIDADE:\n${planoResumo}`,
            { timeoutMs: 12 * 60 * 1000 });
          if (r.status === 'error') throw new Error(String(r.result || 'Growth falhou'));
          if (r.result) {
            const texto = typeof r.result === 'string' ? r.result : JSON.stringify(r.result);
            const leadsBloco = extrairBloco(texto, '<<<LEADS>>>', '<<<FIM_LEADS>>>');
            const roteirosBloco = extrairBloco(texto, '<<<ROTEIROS>>>', '<<<FIM_ROTEIROS>>>');
            if (leadsBloco) {
              const leadsPath = path.join(WORKSPACE, 'leads', `leads-${data}.json`);
              const cleanLeads = leadsBloco.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```[\s\S]*$/, '').trim();
              if (salvarResultado(leadsPath, cleanLeads)) log(`leads salvos → ${leadsPath}`);
            }
            if (roteirosBloco) {
              const rotPath = path.join(WORKSPACE, 'conteudo', `roteiros-${data}.md`);
              if (salvarResultado(rotPath, roteirosBloco)) log(`roteiros salvos → ${rotPath}`);
            }
          }
          return r.result;
        },
      },
      {
        id: 'seg-criacao',
        name: 'Criação — Produto',
        maxRetries: 1,
        timeoutMs: 9 * 60 * 1000,
        fn: async (ctx) => {
          const planoAtual = ctx.plano || '(sem plano)';
          const r = await runJob('studio-criacao',
            `Você é o agente de Criação de uma agência de marketing digital. Com base no plano da semana, crie o esboço de um produto digital ou landing page prioritária. Retorne o conteúdo completo em markdown.\n\nPLANO DA SEMANA:\n${planoAtual}`,
            { timeoutMs: 8 * 60 * 1000 });
          if (r.status === 'error') throw new Error(String(r.result || 'Criação falhou'));
          if (r.result) {
            const criacaoPath = path.join(WORKSPACE, 'produtos', `criacao-${data}.md`);
            if (salvarResultado(criacaoPath, r.result)) log(`criação salva → ${criacaoPath}`);
          }
          return r.result;
        },
      },
      {
        id: 'seg-sdr',
        name: 'SDR — Primeiras mensagens',
        maxRetries: 1,
        timeoutMs: 14 * 60 * 1000,
        fn: async () => {
          let crm, sdr, vnmaxCfg = null;
          try {
            crm = new (require(path.join(ROOT, 'lib', 'crm.js')).Crm)(WORKSPACE);
            sdr = require(path.join(ROOT, 'lib', 'sdr.js'));
            try { vnmaxCfg = new (require(path.join(ROOT, 'lib', 'vnmax.js')).VnmaxStore)(WORKSPACE).load(); } catch {}
          } catch (e) { log(`SDR indisponível: ${e.message}`); return '(SDR indisponível)'; }
          crm.syncFromLeads();
          const novos = crm.list().filter(l => l.stage === 'NOVO' && !l.rascunho && (!l.historico || l.historico.length === 0)).slice(0, 8);
          if (novos.length === 0) { log('SDR: nenhum lead novo sem mensagem.'); return 'sem novos'; }
          let n = 0;
          for (const lead of novos) {
            const r = await runJob('studio-sdr', sdr.sdrTask(lead, vnmaxCfg), { timeoutMs: 3 * 60 * 1000 });
            if (r.status === 'done') {
              const msg = sdr.firstDraft(r.result);
              if (msg && msg.mensagem) { crm.setRascunho(lead.id, { ...msg, origem: 'ciclo' }); n++; }
            }
          }
          log(`SDR: ${n} primeira(s) mensagem(ns) gerada(s) — rascunhos prontos em Conversas.`);
          return `${n} rascunhos gerados`;
        },
      },
    ], data),
  }, { priority: 7 });

  log('=== CICLO SEGUNDA concluído ===');
}

async function cicloDiario() {
  ensureDirs();
  const data = hojeISO();
  log('=== CICLO DIÁRIO 09:00 ===');

  const campanhas = lerDiretorio(path.join(WORKSPACE, 'campanhas'));
  const leads = lerDiretorio(path.join(WORKSPACE, 'leads'), { maxArquivos: 10 });

  await runPipeline({
    name: 'ciclo-diario',
    cycle: 'diario',
    steps: ordenarSteps('diario', [
      {
        id: 'dia-trafego',
        name: 'Tráfego — Campanhas',
        maxRetries: 1,
        timeoutMs: 7 * 60 * 1000,
        fn: async (ctx) => {
          const r = await runJob('studio-trafego',
            `Você é o agente de Tráfego de uma agência de marketing digital. Analise as campanhas abaixo e gere recomendações de otimização (CTR/CPC/ROAS) seguindo as regras de decisão. Retorne as recomendações em markdown.\n\nCAMPANHAS:\n${campanhas}`,
            { timeoutMs: 6 * 60 * 1000 });
          if (r.status === 'error') throw new Error(String(r.result || 'Tráfego falhou'));
          if (r.result) {
            const trafPath = path.join(REPORTS, `trafego-${data}.md`);
            if (salvarResultado(trafPath, r.result)) log(`recomendações de tráfego salvas → ${trafPath}`);
          }
          return r.result;
        },
      },
      {
        id: 'dia-clientes',
        name: 'Clientes — Emails',
        maxRetries: 1,
        timeoutMs: 7 * 60 * 1000,
        fn: async (ctx) => {
          const r = await runJob('studio-clientes',
            `Você é o agente de Clientes de uma agência de marketing digital. Com base nos leads abaixo, rascunhe emails de prospecção personalizados (sem mencionar preço no primeiro contato) para os 5 primeiros leads. Para CADA email, retorne um bloco delimitado por <<<EMAIL>>> e <<<FIM>>> com JSON {para, assunto, corpo}. NÃO invente dados. Use apenas os leads fornecidos.\n\nLEADS:\n${leads}`,
            { timeoutMs: 6 * 60 * 1000 });
          if (r.status === 'error') throw new Error(String(r.result || 'Clientes falhou'));
          if (r.result) {
            const texto = typeof r.result === 'string' ? r.result : JSON.stringify(r.result);
            const blocos = extrairBlocos(texto, '<<<EMAIL>>>', '<<<FIM>>>');
            let n = 0;
            for (const bloco of blocos) {
              let conteudo;
              try { conteudo = JSON.parse(bloco); } catch (_) { conteudo = { corpo: bloco }; }
              aprovacoes.salvar('email', conteudo);
              n++;
            }
            if (n > 0) log(`${n} email(s) salvos como PENDENTES de aprovação.`);
            else log('studio-clientes não retornou rascunhos utilizáveis.');
          }
          return r.result;
        },
      },
    ], data),
  }, { priority: 5 });

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

  await runPipeline({
    name: 'ciclo-sexta',
    cycle: 'sexta',
    steps: ordenarSteps('sexta', [
      {
        id: 'sex-dados',
        name: 'Dados — Relatório Semanal',
        maxRetries: 1,
        timeoutMs: 9 * 60 * 1000,
        fn: async (ctx) => {
          const r = await runJob('studio-dados',
            `Você é o agente de Dados de uma agência de marketing. Compile o relatório de dados da semana com base nas informações abaixo. Retorne no formato markdown com seções: RECEITA, CUSTOS, RESULTADO, INTELIGÊNCIA.\n\nWORKSPACE:\n${ws}\n\nLEADS:\n${leadsData}\n\nCAMPANHAS:\n${campanhasData}\n\nRELATÓRIOS ANTERIORES:\n${reportsData}`,
            { timeoutMs: 8 * 60 * 1000 });
          if (r.status === 'error') throw new Error(String(r.result || 'Dados falhou'));
          if (r.result) {
            const dadosPath = path.join(REPORTS, `dados-semana-${data}.md`);
            const dadosSemana = typeof r.result === 'string' ? r.result : JSON.stringify(r.result);
            if (salvarResultado(dadosPath, dadosSemana)) log(`dados da semana salvos → ${dadosPath}`);
            ctx.dadosSemana = dadosSemana.slice(0, 4000);
          }
          return r.result;
        },
      },
      {
        id: 'sex-ceo',
        name: 'CEO — Relatório do Fundador',
        maxRetries: 1,
        timeoutMs: 9 * 60 * 1000,
        fn: async (ctx) => {
          const dadosSemana = ctx.dadosSemana || '(sem dados compilados)';
          const r = await runJob('studio-ceo',
            `Você é o CEO de uma agência de marketing digital. Com base nos dados da semana abaixo, escreva o relatório final do fundador (máx. 1 página) com: resultado da semana, o que funcionou, o que muda, plano próxima semana e no máximo 3 perguntas binárias. Retorne somente o markdown do relatório.\n\nDADOS DA SEMANA:\n${dadosSemana}`,
            { timeoutMs: 8 * 60 * 1000 });
          if (r.status === 'error') throw new Error(String(r.result || 'CEO falhou'));
          if (r.result) {
            const relPath = path.join(REPORTS, `relatorio-${data}.md`);
            if (salvarResultado(relPath, r.result)) {
              log(`relatório do fundador salvo → ${relPath}`);
              mostrarRelatorio(relPath);
            }
          }
          return r.result;
        },
      },
    ], data),
  }, { priority: 8 });

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

function iniciarDaemon() {
  ensureDirs();
  log('=== DAEMON (watchers + event-driven) iniciado ===');

  const watchers = new WatcherManager();
  engine.dedupWindowMs = 10 * 60 * 1000;

  watchers.on('error', ({ error }) => log(`AVISO watcher: ${error}`));

  watchers.watchFileCount(path.join(WORKSPACE, 'leads'), {
    intervalMs: 30000,
    label: 'leads',
    onIncrease: ({ added }) => {
      if (fs.existsSync(path.join(ROOT, 'DISABLED'))) return;
      log(`watcher: ${added} novo(s) lead(s) detectado(s) → disparando pipeline de prospecção`);
      const leads = lerDiretorio(path.join(WORKSPACE, 'leads'), { maxArquivos: 10 });
      runPipeline({
        name: 'evento-novos-leads',
        cycle: 'evento',
        steps: [{
          name: 'Clientes — Prospecção automática',
          maxRetries: 1,
          timeoutMs: 7 * 60 * 1000,
          fn: async () => {
            const r = await runJob('studio-clientes',
              `Novos leads chegaram. Rascunhe emails de prospecção (sem preço no primeiro contato) para os leads abaixo. Para CADA email retorne bloco <<<EMAIL>>>{"para","assunto","corpo"}<<<FIM>>>. Use apenas os dados fornecidos.\n\nLEADS:\n${leads}`,
              { timeoutMs: 6 * 60 * 1000 });
            if (r.status === 'error') throw new Error(String(r.result || 'Clientes falhou'));
            if (r.result) {
              const texto = typeof r.result === 'string' ? r.result : JSON.stringify(r.result);
              const blocos = extrairBlocos(texto, '<<<EMAIL>>>', '<<<FIM>>>');
              let n = 0;
              for (const bloco of blocos) {
                let conteudo;
                try { conteudo = JSON.parse(bloco); } catch (_) { conteudo = { corpo: bloco }; }
                aprovacoes.salvar('email', conteudo);
                n++;
              }
              if (n > 0) log(`${n} email(s) gerado(s) por evento → pendentes de aprovação.`);
            }
            return r.result;
          },
        }],
      }, { dedupKey: 'evento-novos-leads', priority: 6 });
    },
  });

  watchers.watchDir(path.join(WORKSPACE, 'campanhas'), {
    label: 'campanhas',
    debounceMs: 3000,
    onChange: () => {
      if (fs.existsSync(path.join(ROOT, 'DISABLED'))) return;
      log('watcher: mudança em campanhas detectada → reanálise de tráfego');
      const campanhas = lerDiretorio(path.join(WORKSPACE, 'campanhas'));
      runPipeline({
        name: 'evento-campanhas',
        cycle: 'evento',
        steps: [{
          name: 'Tráfego — Reanálise automática',
          maxRetries: 1,
          timeoutMs: 7 * 60 * 1000,
          fn: async () => {
            const r = await runJob('studio-trafego',
              `As campanhas mudaram. Reanalise (CTR/CPC/ROAS) e gere recomendações em markdown.\n\nCAMPANHAS:\n${campanhas}`,
              { timeoutMs: 6 * 60 * 1000 });
            if (r.status === 'error') throw new Error(String(r.result || 'Tráfego falhou'));
            if (r.result) {
              const trafPath = path.join(REPORTS, `trafego-evento-${hojeISO()}.md`);
              salvarResultado(trafPath, r.result);
            }
            return r.result;
          },
        }],
      }, { dedupKey: 'evento-campanhas', priority: 6 });
    },
  });

  log(`watchers ativos: ${JSON.stringify(watchers.snapshot())}`);

  process.on('SIGTERM', () => { watchers.stopAll(); process.exit(0); });
  process.on('SIGINT', () => { watchers.stopAll(); process.exit(0); });

  setInterval(() => {}, 1 << 30);
}

async function main() {
  ensureDirs();
  const disabled = fs.existsSync(path.join(ROOT, 'DISABLED'));
  const args = parseArgs(process.argv);

  if (args.daemon) return iniciarDaemon();

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
    return cicloCustom(args.cycle);
  }

  if (args.agent && args.task) {
    const r = await runJob(args.agent, args.task);
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  console.log(`VNMAX Studio — scheduler
Uso:
  --cycle=segunda|diario|sexta     roda um ciclo (via Loop Engine)
  --daemon                         modo contínuo: watchers + pipelines por evento
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
