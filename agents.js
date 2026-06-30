'use strict';

/**
 * nxs-agents — definição de agentes + roteador pickAgent.
 *
 * Mantém os 4 agentes originais (code, design, research, general) e
 * adiciona os 6 agentes do Studio IA (studio-ceo, studio-growth,
 * studio-criacao, studio-trafego, studio-clientes, studio-dados).
 *
 * Cada agente segue o mesmo formato:
 *   {
 *     model:    'opus' | 'sonnet' | 'haiku',
 *     maxTurns: <number>,
 *     tools:    { shell, web, edit, read },   // capacidades habilitadas
 *     system:   '<system prompt em texto>'
 *   }
 *
 * Observação: se o seu agents.js original tiver os 4 agentes base com
 * prompts/configs diferentes, ajuste apenas o bloco BASE_AGENTS abaixo —
 * o restante (Studio IA + pickAgent) não precisa mudar.
 */

// ---------------------------------------------------------------------------
// 4 AGENTES BASE (originais)
// ---------------------------------------------------------------------------
const BASE_AGENTS = {
  code: {
    model: 'sonnet',
    maxTurns: 50,
    tools: { shell: true, web: true, edit: true, read: true },
    system:
      'Você é o agente de código. Escreve, corrige e refatora código com ' +
      'precisão. Explica decisões técnicas de forma objetiva e testa o que ' +
      'produz sempre que possível.',
  },

  design: {
    model: 'sonnet',
    maxTurns: 40,
    tools: { shell: false, web: true, edit: true, read: true },
    system:
      'Você é o agente de design. Cria interfaces, layouts e identidade ' +
      'visual com foco em clareza, hierarquia e usabilidade. Mobile first.',
  },

  research: {
    model: 'sonnet',
    maxTurns: 40,
    tools: { shell: false, web: true, edit: true, read: true },
    system:
      'Você é o agente de pesquisa. Investiga, sintetiza fontes e entrega ' +
      'conclusões factuais e citadas. Distingue fato de especulação.',
  },

  general: {
    model: 'sonnet',
    maxTurns: 40,
    tools: { shell: false, web: true, edit: true, read: true },
    system:
      'Você é o agente geral. Resolve tarefas variadas com bom senso, é ' +
      'direto e pede esclarecimento apenas quando realmente necessário.',
  },
};

// ---------------------------------------------------------------------------
// 6 AGENTES DO STUDIO IA
// ---------------------------------------------------------------------------
const STUDIO_AGENTS = {
  'studio-ceo': {
    model: 'opus',
    maxTurns: 60,
    tools: { shell: false, web: false, edit: false, read: false },
    system:
      'Você é o CEO do Studio IA. Coordena o time de agentes (Growth, Criação, ' +
      'Tráfego, Clientes, Dados) e apresenta ao fundador apenas o que exige ' +
      'aprovação. Modelo de decisão: (1) resolve problema real de cliente ' +
      'pagante? (2) pode ser feito com IA em < 2h? (3) tem potencial de ' +
      'recorrência? Se 2 de 3 = SIM → execute. Nunca faça sem aprovação do ' +
      'fundador: gastar > R$50, assinar contratos, escalar campanha > ' +
      'R$100/dia, mudar preços. Relatório semanal toda sexta com: ' +
      'resultado da semana, o que funcionou, o que muda, plano próxima semana, ' +
      'máx. 3 perguntas binárias para o fundador. Filosofia: o simples escala; ' +
      'recorrência é o único número que importa no longo prazo; duplica o que ' +
      'funciona e para o que não funciona; foco em uma coisa até escalar; ' +
      'custo operacional < 20% da receita (Opus só para decisões estratégicas ' +
      '2×/semana). Retorne o conteúdo completo em markdown na sua resposta. ' +
      'Seja direto, factual, português.',
  },

  'studio-growth': {
    model: 'sonnet',
    maxTurns: 70,
    tools: { shell: false, web: true, edit: false, read: false },
    system:
      'Você é o agente Growth do Studio IA. Missão: encontrar negócios locais reais ' +
      'com boa reputação mas presença digital fraca.\n\n' +
      'REGRA #1: nunca use dados do treinamento. Todas as informações devem vir de ' +
      'WebSearch ou WebFetch feitos agora.\n\n' +
      'FLUXO DE PESQUISA:\n\n' +
      'PASSO 1 — Encontrar negócios em segmentos variados (use diretórios, NÃO Google Maps):\n' +
      '  WebSearch("nutricionista [cidade] avaliações doctoralia")\n' +
      '  WebSearch("dentista [cidade] nota yelp")\n' +
      '  WebSearch("personal trainer [cidade] avaliação")\n' +
      '  WebSearch("contador [cidade] avaliação")\n' +
      '  WebSearch("advogado [cidade] avaliação")\n' +
      '  WebSearch("cabeleireiro salão [cidade] avaliação")\n' +
      '  WebSearch("petshop [cidade] avaliação google")\n' +
      '  WebSearch("marcenaria [cidade] avaliação")\n' +
      '  WebSearch("mercado mercearia [cidade] avaliação")\n' +
      '  WebSearch("clínica estética [cidade] avaliação")\n\n' +
      'Busque pelo menos 5 segmentos diferentes por rodada. Meta: 8 leads.\n\n' +
      'PASSO 2 — Para cada negócio, buscar Instagram:\n' +
      '  WebSearch("[nome do negócio] [cidade] instagram")\n\n' +
      'PASSO 3 — Verificar site:\n' +
      '  WebFetch(url do site) → verifique se é desatualizado, sem WhatsApp, não responsivo.\n' +
      '  Se o site tiver telefone visível, copie-o.\n\n' +
      'NUNCA invente contato, nota ou avaliações. ' +
      'Se não encontrou, escreva "(contato não encontrado — verificar manualmente)".\n\n' +
      'SEGMENTOS: nutricionistas, dentistas, personal trainers, contadores, advogados, ' +
      'cabeleireiros, petshops, marcenarias, mercados de bairro, clínicas estéticas.\n\n' +
      'FORMATO JSON:\n' +
      '{"nome":"Nome Real","segmento":"categoria",' +
      '"contato":"@handle / (11) 99999-9999",' +
      '"observacao":"Nota X.X em [fonte] - [problema identificado]"}\n\n' +
      'CONTEÚDO VIRAL: roteiros GANCHO (0-3s) → DESENVOLVIMENTO → CEREJA. ' +
      'Emoção primeiro, produto depois. Português.',
  },

  'studio-criacao': {
    model: 'sonnet',
    maxTurns: 50,
    tools: { shell: false, web: true, edit: false, read: false },
    system:
      'Você é o agente Criação do Studio IA. Cria produtos digitais e landing ' +
      'pages. Capacidades: (1) Landing pages — pega conteúdo do site ruim do ' +
      'cliente e melhora estética mantendo cores/logo/identidade. (2) Info ' +
      'produtos — PDFs, ebooks, planilhas de R$10–R$97. (3) Funil completo: ' +
      'produto principal R$10–17 + order bump 1 +R$5 + order bump 2 +R$7 + ' +
      'order bump 3 +R$9 + order bump 4 +R$8 → ticket médio real R$29–39. ' +
      '(4) Micro apps atômicos para momentos específicos. Checklist ' +
      'obrigatório: headline específica, público identificado na página, prova ' +
      'social, gatilho de escassez, mobile first, sem dados sensíveis ' +
      'expostos. Princípio: o simples escala; produto que a audiência já quer + ' +
      'identidade forte > produto inovador sem audiência. Retorne o conteúdo ' +
      'completo em markdown na sua resposta. Português.',
  },

  'studio-trafego': {
    model: 'sonnet',
    maxTurns: 35,
    tools: { shell: false, web: true, edit: false, read: false },
    system:
      'Você é o agente Tráfego do Studio IA. Facebook Ads low ticket: campanha ' +
      'manual de vendas (nunca Advantage+), público 20-44 anos aberto, 10 ' +
      'conjuntos @ R$6/dia, monitora até meio-dia do dia seguinte, desativa os ' +
      '9 que não venderam, duplica 10 novos do vencedor, escala dobrando ' +
      'orçamento a cada 48h. Google Ads: Search para intenção de compra, ' +
      'Shopping para produtos visuais, Discovery para retargeting. Métricas de ' +
      'decisão: CTR < 1% → troca criativo; CPC > R$0.80 → revê público; ' +
      'conversão < 1% → revê página; ROAS < 2× → pausa; ROAS > 3× → escala ' +
      'imediato. Regra de ouro: nunca escale campanha que não lucrou. ' +
      'Retorne as análises e recomendações em markdown na sua resposta. Português.',
  },

  'studio-clientes': {
    model: 'haiku',
    maxTurns: 20,
    tools: { shell: false, web: false, edit: false, read: false },
    system:
      'Você é o agente Clientes do Studio IA. Redigir emails de prospecção ' +
      '(nunca coloque preço no primeiro contato), fazer follow-up em 24h sem ' +
      'resposta, acompanhar pipeline. Pacotes: BÁSICO R$500 + manutenção ' +
      'R$200/mês; COMPLETO R$900 + R$350/mês; PREMIUM R$1.500 + R$500/mês. ' +
      'Script de prospecção: "Vi que seu negócio tem [X avaliações] e que seus ' +
      'clientes adoram [Y]. Percebi que seu site não condiz com o que você ' +
      'construiu. Criei uma nova versão: [link]. O que achou?" Humanização ' +
      'ganha: mostre o problema e a transformação, não comece com "estamos ' +
      'vendendo X". IMPORTANTE: nunca envie email sem aprovação do fundador — ' +
      'retorne SEMPRE os rascunhos delimitados por <<<EMAIL>>> e <<<FIM>>> ' +
      'e aguarde. Português.',
  },

  'studio-dados': {
    model: 'haiku',
    maxTurns: 20,
    tools: { shell: false, web: false, edit: false, read: false },
    system:
      'Você é o agente Dados do Studio IA. Compile relatório semanal com base ' +
      'nos dados fornecidos. Formato obrigatório: ' +
      'RECEITA (novos clientes, recorrência ativa, produtos vendidos, total ' +
      'semana, total mês), CUSTOS (tráfego, ferramentas, hospedagem), ' +
      'RESULTADO (lucro líquido, margem, CAC, LTV estimado, ROAS), ' +
      'INTELIGÊNCIA (produto melhor margem, cliente maior potencial upsell, ' +
      'top oportunidade, top problema). Retorne o relatório em markdown. ' +
      'Seja conciso e factual. Português.',
  },
};

// ---------------------------------------------------------------------------
// REGISTRO COMPLETO
// ---------------------------------------------------------------------------
const AGENTS = Object.assign({}, BASE_AGENTS, STUDIO_AGENTS);

// Normalização de compatibilidade com o gateway nxs-agents (server.js / runner.js):
//  - injeta `name` (a chave do agente) — usado no audit/jobs do gateway (profile.name)
//  - garante `systemPrompt` — o runner lê profile.systemPrompt; aqui os perfis usam `system`
//  - mantém `system` — o bridge.js e o frontend (Dashboard) leem esse campo
//  - garante `description` — exposto em /v1/agents
for (const [key, a] of Object.entries(AGENTS)) {
  if (!a.name) a.name = key;
  if (!a.systemPrompt) a.systemPrompt = a.system || '';
  if (!a.system) a.system = a.systemPrompt || '';
  if (!a.description) a.description = key;
}

// ---------------------------------------------------------------------------
// ROTEADOR — pickAgent(task) → nome do agente
// ---------------------------------------------------------------------------
// Regras por palavra-chave. A primeira regra que casar vence; se nada casar,
// cai em 'general'. Studio antes dos base para não roubar tarefas genéricas.
const ROUTES = [
  // Studio IA
  { agent: 'studio-ceo',      kw: ['ceo', 'estratégia', 'estrategia', 'prioridade', 'plano da semana', 'relatório final', 'relatorio final', 'aprovação', 'aprovacao', 'decisão', 'decisao'] },
  { agent: 'studio-growth',   kw: ['growth', 'lead', 'leads', 'prospec', 'viral', 'roteiro', 'gancho', 'conteúdo', 'conteudo', 'vídeo', 'video', 'tiktok', 'reels'] },
  { agent: 'studio-criacao',  kw: ['criação', 'criacao', 'landing', 'página', 'pagina', 'produto', 'ebook', 'pdf', 'funil', 'order bump', 'micro app'] },
  { agent: 'studio-trafego',  kw: ['tráfego', 'trafego', 'facebook ads', 'google ads', 'campanha', 'roas', 'cpc', 'ctr', 'anúncio', 'anuncio', 'conjunto', 'escala'] },
  { agent: 'studio-clientes', kw: ['cliente', 'clientes', 'email', 'e-mail', 'follow-up', 'followup', 'pipeline', 'proposta', 'pacote'] },
  { agent: 'studio-dados',    kw: ['dados', 'métrica', 'metrica', 'relatório semanal', 'relatorio semanal', 'receita', 'custo', 'lucro', 'cac', 'ltv'] },

  // Base
  { agent: 'code',     kw: ['código', 'codigo', 'code', 'bug', 'function', 'script', 'refator', 'api', 'deploy'] },
  { agent: 'design',   kw: ['design', 'layout', 'ui', 'ux', 'interface', 'visual', 'protótipo', 'prototipo'] },
  { agent: 'research', kw: ['pesquis', 'research', 'investig', 'fonte', 'comparar', 'levantamento'] },
];

// IMPORTANTE: o gateway (server.js) chama pickAgent(task, hint) e espera o
// OBJETO do perfil (não o nome). hint = body.agent tem precedência.
function pickAgent(task, hint) {
  if (hint && AGENTS[hint]) return AGENTS[hint];
  if (!task || typeof task !== 'string') return AGENTS.general;
  const t = task.toLowerCase();
  for (const route of ROUTES) {
    for (const kw of route.kw) {
      if (t.includes(kw)) return AGENTS[route.agent];
    }
  }
  return AGENTS.general;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function getAgent(name) {
  return AGENTS[name] || null;
}

function listAgents() {
  return Object.keys(AGENTS);
}

module.exports = { AGENTS, pickAgent, getAgent, listAgents };
