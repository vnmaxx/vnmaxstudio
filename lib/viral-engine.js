'use strict';

const NICHE_PRESETS = {
  medico: { label: 'Saúde / Médico', tone: 'autoridade acessível, sem jargão', cta: 'salvar para não esquecer' },
  advogado: { label: 'Direito / Advogado', tone: 'didático, revela o que ninguém conta', cta: 'comentar a dúvida' },
  dentista: { label: 'Odontologia', tone: 'prático, quebra mitos', cta: 'marcar quem precisa ver' },
  imoveis: { label: 'Imóveis / Corretor', tone: 'urgência informada, dados de mercado', cta: 'seguir para mais' },
  financas: { label: 'Finanças / Investimentos', tone: 'direto, contra-intuitivo', cta: 'salvar o passo a passo' },
  fitness: { label: 'Fitness / Nutrição', tone: 'mito vs verdade, prático', cta: 'salvar o treino/dica' },
  beleza: { label: 'Beleza / Estética', tone: 'antes-depois, alerta de erro comum', cta: 'marcar uma amiga' },
  petshop: { label: 'Petshop / Veterinária', tone: 'cuidado prático, alerta de erro comum', cta: 'marcar quem tem pet' },
  gastronomia: { label: 'Restaurante / Gastronomia', tone: 'desejo visual, bastidor', cta: 'salvar para ir' },
  infoproduto: { label: 'Infoproduto / Mentor', tone: 'história + framework, prova', cta: "comentar 'EU' para receber" },
  ecommerce: { label: 'E-commerce / Produto', tone: 'demonstração de benefício, objeção quebrada', cta: 'link na bio' },
  generico: { label: 'Genérico / Empresa', tone: 'claro, útil, humano', cta: 'seguir para mais conteúdo' },
};

const HOOK_FORMULAS = [
  'Contradição: "Todo mundo acha que X, mas a verdade é Y."',
  'Erro caro: "Pare de fazer X — isso está te custando Y."',
  'Segredo de bastidor: "O que ninguém te conta sobre X."',
  'Número específico: "X coisas que mudam Y em Z dias."',
  'Pergunta de tensão: "Você sabia que X pode causar Y?"',
  'Promessa rápida: "Em 30 segundos eu te mostro como X."',
  'Autoridade + alerta: "Como [profissional], eu nunca faria X."',
  'História curta: "Um cliente meu fez X e o resultado foi Y."',
  'Resultado-primeiro: "Cresci de 0 a 50k em 90 dias — e aqui está o que ninguém mostra."',
];

const PLATFORM_DURATIONS = { shorts: 25, tiktok: 25, reels: 22 };

function nicheOf(segmento) {
  const s = String(segmento || '').toLowerCase();
  for (const key of Object.keys(NICHE_PRESETS)) {
    if (s.includes(key)) return key;
  }
  if (/nutri|academia|treino|personal/.test(s)) return 'fitness';
  if (/odonto|dent/.test(s)) return 'dentista';
  if (/advoc|jurid|direito/.test(s)) return 'advogado';
  if (/clinic|saude|medic/.test(s)) return 'medico';
  if (/imovel|corretor|imobili/.test(s)) return 'imoveis';
  if (/salao|estetic|beleza|cabelo/.test(s)) return 'beleza';
  if (/pet|veterin/.test(s)) return 'petshop';
  if (/restaurante|comida|food|gastr|lanche/.test(s)) return 'gastronomia';
  if (/loja|ecommerce|produto/.test(s)) return 'ecommerce';
  return 'generico';
}

function buildRoteiristaTask(cliente, opts) {
  const o = opts || {};
  const count = o.count || 3;
  const niche = NICHE_PRESETS[cliente && cliente.niche] || NICHE_PRESETS[nicheOf(cliente && cliente.segmento)] || NICHE_PRESETS.generico;

  let target = o.durationSec;
  if (target == null) {
    if (o.storytelling) target = 45;
    else target = PLATFORM_DURATIONS[o.platform] || 25;
  }
  if (o.storytelling && target < 40) target = 40;

  const guideline = o.storytelling
    ? `Duração alvo: ~${target}s (modo storytelling para fidelizar seguidores). Conte uma história com início, tensão e virada, mas mantenha cada frase pagando o tempo do espectador.`
    : `Duração alvo: ~${target}s (corte agressivo: o vídeo tem que ser falado em <=30s para maximizar completion).`;

  return `Você é um roteirista especialista em VÍDEOS CURTOS ORGÂNICOS (TikTok, Reels, YouTube Shorts) que viralizam SEM trends e SEM dancinha — apenas conteúdo técnico que agrega valor real e constrói autoridade.

CLIENTE:
- Nome/Marca: ${(cliente && cliente.nome) || '(não informado)'}
- Nicho: ${niche.label}
- Tom de voz desejado: ${(cliente && cliente.tom) || niche.tone}
- Público: ${(cliente && cliente.publico) || 'público geral interessado no tema'}
- Objetivo do conteúdo: ${(cliente && cliente.objetivo) || 'ganhar autoridade e atrair clientes'}

REGRAS DE OURO (siga TODAS):
1. HOOK nos primeiros 3 segundos: tensão, curiosidade ou contradição do senso comum. Nada de "Oi, hoje eu vou falar sobre...".
2. Densidade de valor: cada frase paga o tempo do espectador. Corte qualquer enrolação.
3. Frases curtas, linguagem FALADA (será lido em voz alta).
4. Especificidade: números, exemplos concretos, nomes de situações reais.
5. Abra um LOOP no início e só feche no fim (retenção até o último segundo).
6. Pattern interrupt: mude o ritmo/ângulo a cada ~6 segundos.
7. CTA final suave alinhado ao objetivo (ex.: ${niche.cta}).
8. PROIBIDO: clickbait que não entrega, promessa falsa, jargão sem explicação, emojis no roteiro.
9. ${guideline}

BENCHMARK DE RETENÇÃO (auto-correção, não negociável):
- Retenção nos primeiros 3s abaixo de 60% = vídeo morto. Alvo: 70 a 85%.
- Reescreva qualquer hook cuja retencao_3s estimada seja <70% antes de devolver.

TAREFA: gere ${count} variações de roteiro para um vídeo sobre: "${o.theme || 'tema livre do nicho'}".

Para CADA variação retorne um objeto com os campos:
- "hook": a primeira frase (gancho de 3s)
- "hook_formula": qual fórmula de gancho usou
- "visual_hook": 3 a 6 palavras em CAIXA ALTA que comunicam o valor SEM áudio
- "script": o roteiro completo pronto para ler em voz alta (texto corrido). Termine no PAYOFF.
- "onscreen_text": 3 a 5 textos curtos que aparecem na tela
- "loop_line": frase final curtíssima que conecta de volta ao hook
- "cta": chamada para ação CURTA e opcional
- "broll_suggestions": 3 sugestões de imagem/vídeo de fundo
- "keywords": 2 a 4 palavras de impacto que existem no script
- "retencao_3s": % (0 a 100) que NÃO desliza nos primeiros 3s, com 1 frase justificando. Alvo 70-85%.
- "completion_estimada": % (0 a 100) que assiste até o fim, com 1 frase justificando
- "estimated_retention": média de retencao_3s e completion_estimada (0 a 100)
- "viral_score": nota 0 a 100 de potencial viral, com 1 frase justificando
- "title": título/legenda do post com no máximo 1 hashtag estratégica

Responda EXCLUSIVAMENTE com o JSON pedido, começando em "{" e terminando em "}". Não crie arquivos, não escreva explicações, não use blocos de código markdown. Formato:
{ "variations": [ { ...campos acima... } ] }`;
}

function extractJson(raw) {
  let s = String(raw || '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  if (s[0] !== '{' && s[0] !== '[') {
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a >= 0 && b > a) s = s.slice(a, b + 1);
  }
  return JSON.parse(s);
}

function parseVariations(result) {
  try {
    const obj = extractJson(result);
    if (obj && Array.isArray(obj.variations)) return obj.variations;
    if (Array.isArray(obj)) return obj;
  } catch {}
  return null;
}

function demoScripts(opts) {
  const o = opts || {};
  const theme = o.theme || 'seu tema';
  const niche = o.niche || nicheOf(o.segmento) || 'generico';
  const count = o.count || 3;
  const presets = NICHE_PRESETS[niche] || NICHE_PRESETS.generico;
  const angles = [
    { hf: 'Contradição', hook: `A maioria das pessoas erra feio em "${theme}" — e nem percebe.`, body: `E o pior: parece certo. O resultado em ${theme} não vem do esforço, vem da ordem certa. Primeiro ajusta a base, depois acelera. Quem inverte trava.`, keywords: ['erra', 'ordem', 'base', 'trava'] },
    { hf: 'Erro caro', hook: `Pare de fazer isso com "${theme}" — está te custando tempo e dinheiro.`, body: `Não é sorte, é método. Identifique o gargalo, corrija UMA coisa por vez e meça. É isso que separa quem cresce de quem fica parado em ${theme}.`, keywords: ['método', 'gargalo', 'cresce', 'parado'] },
    { hf: 'Segredo de bastidor', hook: `O que ninguém te conta sobre "${theme}".`, body: `80% do resultado vem de 20% das ações. O resto é barulho. Foca no que importa em ${theme} e você passa a maioria. Começa pequeno, mas consistente.`, keywords: ['resultado', 'barulho', 'foca', 'consistente'] },
    { hf: 'Número específico', hook: `3 verdades sobre "${theme}" que mudam o jogo em 30 dias.`, body: `Uma: o básico bem feito ganha do avançado mal feito. Duas: medir vence adivinhar. Três: quem começa hoje passa quem espera. Aplica em ${theme}.`, keywords: ['básico', 'medir', 'começa', 'passa'] },
  ];
  const visualHooks = ['O ERRO QUE PARECE CERTO', 'PARE DE PERDER TEMPO', 'NINGUÉM TE CONTA ISSO', '3 VERDADES EM 30 DIAS'];
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = angles[i % angles.length];
    const retencao3s = 74 + ((i * 5) % 12);
    const completionEst = 60 + ((i * 7) % 18);
    const estimated = Math.round((retencao3s + completionEst) / 2);
    out.push({
      hook: a.hook,
      hook_formula: a.hf,
      visual_hook: visualHooks[i % visualHooks.length],
      script: `${a.hook} ${a.body}`,
      onscreen_text: [a.hf.toUpperCase(), 'o erro que parece certo', 'faça na ordem certa', 'consistência > intensidade'],
      loop_line: `Por isso ${theme} trava — e como destravar.`,
      cta: presets.cta,
      broll_suggestions: [`pessoa trabalhando em ${theme}`, 'gráfico de crescimento simples', 'close no rosto falando'],
      retencao_3s: retencao3s,
      completion_estimada: completionEst,
      estimated_retention: estimated,
      viral_score: Math.min(98, estimated + 8),
      title: `A verdade sobre ${theme}`,
      keywords: a.keywords,
      demo: true,
    });
  }
  return { variations: out, demo: true };
}

module.exports = { NICHE_PRESETS, HOOK_FORMULAS, nicheOf, buildRoteiristaTask, parseVariations, demoScripts, extractJson };
