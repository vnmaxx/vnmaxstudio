'use strict';

const { extractJson, nicheOf, NICHE_PRESETS } = require('./viral-engine.js');

function buildBlueprintTask(cliente) {
  const c = cliente || {};
  return `Você é um arquiteto de produto e growth de uma agência. Dado um negócio, você decide qual entrega digital tem MAIOR retorno para ELE agora — entre LANDING PAGE (captura/venda), CRM (organizar e converter leads) ou APLICATIVO/WEB APP (operação ou produto recorrente) — e gera um prompt de construção pronto para colar em um builder de IA (v0, Lovable, Claude, Bolt).

NEGÓCIO:
- Nome: ${c.nome || '(não informado)'}
- Segmento: ${c.segmento || '(não informado)'}
- Canal/contato: ${c.contato || '-'}
- Observações: ${c.observacao || '-'}
- Objetivo declarado: ${c.objetivo || '(inferir pelo segmento)'}
- Público: ${c.publico || '(inferir pelo segmento)'}

COMO DECIDIR (escolha UM como recomendado, não invente demanda):
- LANDING: negócio local/serviço que precisa de presença e captar contato/agendamento rápido (a maioria dos pequenos negócios começa aqui).
- CRM: já tem fluxo de leads e perde venda por desorganização (precisa de pipeline, follow-up, histórico).
- APP/WEB APP: a operação ou o produto exige software próprio (agenda complexa, recorrência, área do cliente, marketplace).

REGRAS DO PROMPT GERADO (campo "prompt"):
- Específico para ESTE negócio (use o nome, o segmento, a proposta de valor real). Nada genérico.
- Pronto para colar e gerar: descreva páginas/telas, seções, copy-chave (headline real), CTA, integrações, identidade visual, e o que NÃO fazer.
- Mobile-first, foco em conversão, sem dados sensíveis expostos.
- Português. Tamanho: detalhado mas direto (sem encheção).

Responda EXCLUSIVAMENTE com JSON, começando em "{" e terminando em "}". Sem markdown, sem explicações fora do JSON. Formato:
{
  "tipo_recomendado": "landing" | "crm" | "app",
  "justificativa": "1-2 frases dizendo por que ESTE é o ideal para o negócio agora",
  "nome_projeto": "nome curto do projeto",
  "objetivo_principal": "a única métrica que esse entregável deve mover",
  "publico_alvo": "quem usa/quem converte",
  "proposta_valor": "headline real sugerida",
  "funcionalidades": ["lista de 5 a 9 funcionalidades/seções concretas"],
  "stack_sugerida": "ex.: Next.js + Tailwind + Firebase",
  "identidade": "tom visual + paleta sugerida para o segmento",
  "prompt": "o prompt completo de construção, pronto para colar num builder",
  "primeiro_passo": "o primeiro passo prático para executar"
}`;
}

function parseBlueprint(result) {
  try {
    const obj = extractJson(result);
    if (obj && obj.tipo_recomendado && obj.prompt) return obj;
  } catch {}
  return null;
}

function demoBlueprint(cliente) {
  const c = cliente || {};
  const nome = c.nome || 'seu cliente';
  const niche = nicheOf(c.segmento);
  const label = (NICHE_PRESETS[niche] || NICHE_PRESETS.generico).label;
  return {
    tipo_recomendado: 'landing',
    justificativa: `${label} de presença local: o maior ganho imediato é uma landing que transforme reputação em agendamento/contato.`,
    nome_projeto: `${nome} — Landing de Conversão`,
    objetivo_principal: 'Aumentar contatos/agendamentos qualificados',
    publico_alvo: c.publico || 'clientes locais buscando o serviço',
    proposta_valor: `O melhor de ${label.toLowerCase()} perto de você, com atendimento sem complicação.`,
    funcionalidades: [
      'Hero com headline + CTA de WhatsApp',
      'Prova social (avaliações reais)',
      'Lista de serviços com preços a partir de',
      'Antes/depois ou galeria',
      'Bloco de objeções respondidas (FAQ)',
      'Mapa + horário + botão de rota',
      'Formulário curto de agendamento',
    ],
    stack_sugerida: 'Next.js + Tailwind + Firebase (form) — deploy na Vercel',
    identidade: 'Visual limpo, mobile-first, cores da marca + 1 cor de destaque para CTA',
    prompt: `Crie uma landing page mobile-first de alta conversão para "${nome}" (${label}). Objetivo: gerar agendamentos via WhatsApp. Seções: (1) Hero com headline forte sobre o benefício principal + botão "Agendar no WhatsApp"; (2) prova social com avaliações reais; (3) serviços com "a partir de R$"; (4) galeria/antes-e-depois; (5) FAQ quebrando as objeções comuns do segmento; (6) localização com mapa e horário; (7) formulário curto (nome + telefone). Use as cores da marca com 1 cor de destaque no CTA, tipografia legível, carregamento rápido, sem dados sensíveis. Copy em português, direta e humana. Não invente preços nem depoimentos — deixe placeholders claros para o dono preencher.`,
    primeiro_passo: 'Coletar 3 avaliações reais + a tabela de serviços para preencher os placeholders.',
    demo: true,
  };
}

module.exports = { buildBlueprintTask, parseBlueprint, demoBlueprint };
