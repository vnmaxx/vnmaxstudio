'use strict';
const { nicheOf, NICHE_PRESETS } = require('./viral-engine.js');
const { renderLanding } = require('./landing-template.js');
const { renderCrm } = require('./crm-template.js');
const { renderApp } = require('./app-template.js');

const PRODUTO_TIPOS = {
  landing: { label: 'Landing Page', formato: 'html' },
  app: { label: 'App de Vendas (login)', formato: 'html' },
  crm: { label: 'CRM (app)', formato: 'html' },
  ebook: { label: 'E-book / Guia', formato: 'md' },
  funil: { label: 'Funil de vendas', formato: 'md' },
  emails: { label: 'Sequência de e-mails', formato: 'md' },
  vsl: { label: 'Roteiro de VSL', formato: 'md' },
};

const RICO = `PROFUNDIDADE (obrigatório): vá FUNDO no ramo/segmento do cliente — use os termos técnicos, as dores reais, as objeções típicas, os exemplos concretos, a sazonalidade e as ofertas comuns DESSE nicho específico. Entregue material RICO, extenso e com acabamento profissional de agência. Nada raso, nada genérico, nada de placeholder onde dá pra ser específico.`;

function clienteCtx(cliente) {
  const c = cliente || {};
  const niche = (NICHE_PRESETS[nicheOf(c.segmento)] || NICHE_PRESETS.generico).label;
  return `NEGÓCIO DO CLIENTE (adapte TUDO a ele):
- Nome/Marca: ${c.nome || '(sem nome)'}
- Segmento: ${c.segmento || niche}
- Contato/canal: ${c.contato || '-'}
- Observações: ${c.observacao || '-'}
- Objetivo: ${c.objetivo || 'atrair e converter mais clientes'}
- Público: ${c.publico || 'clientes locais do segmento'}`;
}

function buildProdutoTask(cliente, tipo, opts) {
  const o = opts || {};
  const ctx = clienteCtx(cliente);
  const nome = (cliente && cliente.nome) || 'o cliente';
  const tema = o.tema ? `\nFoco específico pedido: ${o.tema}` : '';

  if (tipo === 'landing') {
    return `Você é diretor de arte e copywriter de conversão. Gere o CONTEÚDO de uma landing page cinematográfica de altíssimo padrão para "${nome}", 100% adaptado ao negócio real abaixo.${tema}

${ctx}

Responda SOMENTE com um JSON válido (sem markdown, sem comentários, sem texto fora dele), exatamente neste formato e todo preenchido/adaptado ao segmento:
{
  "brand": "nome da marca como aparece no topo",
  "brandAccent": "uma palavra do nome pra destacar em cor (ou string vazia)",
  "brandSub": "linha curta sob a marca (ex.: SEGMENTO · BAIRRO)",
  "eyebrow": "linha curta acima do título (cidade / desde / prova)",
  "tagline": "linha manuscrita curta e marcante",
  "sub": "subtítulo de 1 linha com o benefício principal",
  "rating": "prova social honesta e curta (ou string vazia se não houver)",
  "ctaLabel": "texto do botão principal (ex.: Agendar meu horário)",
  "paletteKey": "escolha 1 que combine com o segmento: barber | clinic | beauty | food | fitness | pro | generic",
  "scenes": [
    { "eyebrow": "", "title": "linha1\\nlinha2 (2 linhas CURTAS, impactantes)", "body": "1 a 2 frases envolventes", "pos": "left|right|center" }
  ],
  "servicesEyebrow": "", "servicesTitle": "", "servicesSub": "",
  "services": [
    { "name": "", "price": "número (ex 45) OU 'sob consulta'", "desc": "1 linha", "featured": false, "badge": "" }
  ],
  "visitEyebrow": "", "visitTitle": "", "address": "linha1\\nlinha2", "hoursTitle": "Funcionamento", "hours": "", "mapLabel": "bairro/cidade",
  "phone": "telefone com DDD do cliente OU vazio", "whatsapp": "whatsapp do cliente só números OU vazio", "instagram": "@handle do cliente OU vazio",
  "finalEyebrow": "", "finalTitle": "linha1\\nlinha2",
  "bookEyebrow": "Agende agora", "bookTitle": "", "bookLead": "",
  "footerNote": "© 2026 ...", "metaDescription": "descrição SEO curta"
}

REGRAS:
- "scenes": 4 a 6 cenas contando uma micro-jornada (chegar → experiência → técnica/diferencial → resultado → convite).
- "services": 3 a 6 itens; marque o principal com "featured": true e "badge": "Mais pedido".
- Copy REAL e específica do segmento, em português, sem lorem ipsum e sem clichê vazio.
- NÃO invente preços nem depoimentos falsos: se não souber, use "sob consulta" e prova social honesta ou string vazia.
- Use o contato REAL do cliente em phone/whatsapp/instagram quando existir; senão deixe vazio.
- Onde faltar dado (endereço/horário), use "[TROCAR: ...]".
${RICO}
Responda só o JSON.`;
  }

  if (tipo === 'crm') {
    return `Você é arquiteto de CRM. Gere o CONTEÚDO de um CRM funcional (pipeline Kanban) 100% adaptado ao ramo de "${nome}".${tema}

${ctx}

Responda SOMENTE com um JSON válido (sem markdown, sem texto fora), neste formato:
{
  "brand": "nome do cliente",
  "ramo": "o ramo/segmento em 1-3 palavras",
  "paletteKey": "escolha 1: barber | clinic | beauty | food | fitness | pro | generic (o que combina com o ramo)",
  "stages": [ { "id": "novo", "nome": "Nome da etapa" } ],
  "campos": [ { "key": "nome", "label": "Rótulo", "tipo": "text|tel|email|select|date|textarea", "opcoes": ["só p/ select"] } ],
  "leadsExemplo": [ { "nome": "...", "telefone": "...", "stage": "id-da-etapa" } ]
}

REGRAS (específico do ramo):
- "stages": 4 a 6 etapas do funil REAIS desse ramo (ex.: clínica → Novo · Avaliação agendada · Em tratamento · Retorno · Fidelizado). Nomes na linguagem do negócio.
- "campos": 4 a 7 campos que ESSE negócio realmente precisa por lead (ex.: podologia → nome, telefone, tratamento[select], convênio, próxima sessão[date], observação[textarea]). Inclua sempre um campo de telefone (tipo "tel") para o botão de WhatsApp. Use "select" com "opcoes" quando fizer sentido (tratamentos, serviços, origem).
- "leadsExemplo": 3 a 6 leads fictícios porém plausíveis do ramo, distribuídos entre as etapas, preenchendo os campos.
${RICO}
Responda só o JSON.`;
  }

  if (tipo === 'app') {
    return `Você é arquiteto de software de gestão. Gere o CONTEÚDO de um APLICATIVO DE VENDAS com login (painel unificado: CRM + Vendas + Painel de métricas) 100% adaptado ao ramo de "${nome}".${tema}

${ctx}

Responda SOMENTE com um JSON válido (sem markdown, sem texto fora), neste formato:
{
  "brand": "nome do cliente",
  "ramo": "o ramo/segmento em 1-3 palavras",
  "paletteKey": "escolha 1: barber | clinic | beauty | food | fitness | pro | generic",
  "stages": [ { "id": "novo", "nome": "Nome da etapa do funil" } ],
  "campos": [ { "key": "nome", "label": "Rótulo", "tipo": "text|tel|email|select|date|textarea", "opcoes": ["só p/ select"] } ],
  "produtos": [ { "nome": "Produto/serviço vendável", "preco": 120 } ],
  "leadsExemplo": [ { "nome": "...", "telefone": "...", "stage": "id-da-etapa" } ]
}

REGRAS (específico do ramo):
- "stages": 4 a 6 etapas REAIS do funil desse ramo. "campos": 4 a 7 campos que o negócio precisa por lead (inclua sempre um "tel" p/ WhatsApp; use "select" com "opcoes" quando fizer sentido).
- "produtos": 3 a 8 produtos/serviços VENDÁVEIS do negócio com preços coerentes ao ramo (usados no módulo de Vendas). Sem preço falso onde não souber: estime uma faixa plausível do ramo.
- "leadsExemplo": 3 a 6 leads plausíveis distribuídos entre as etapas.
- O app une CRM + Vendas num só lugar (o cliente não usa mil apps): as vendas registradas alimentam o Painel (receita do mês, ticket médio, conversão).
${RICO}
Responda só o JSON.`;
  }

  if (tipo === 'ebook') {
    return `Você é especialista em info-produtos. Escreva um E-BOOK/GUIA COMPLETO E PRONTO PARA ENTREGAR ao público de "${nome}", em Markdown.${tema}

${ctx}

REQUISITOS:
- Título forte + subtítulo. Introdução conectando com a dor real do público.
- 6 a 9 capítulos densos e específicos do segmento (passos numerados, exemplos concretos do ramo, checklists práticos, erros comuns, mini-estudos de caso). Cada capítulo com substância — não parágrafos soltos.
- Boxes de "Dica de especialista" e um checklist final acionável.
- Conclusão + CTA suave para procurar ${nome}.
- Português, pronto para virar PDF, com títulos em markdown (#, ##).
${RICO}
Responda SOMENTE com o Markdown do e-book, sem texto fora dele e sem cercar tudo em bloco de código.`;
  }

  if (tipo === 'funil') {
    return `Você é estrategista de ofertas. Monte um FUNIL DE VENDAS completo e pronto para usar para "${nome}", em Markdown.${tema}

${ctx}

ENTREGUE:
- Mapa do funil (topo → meio → fundo) com a isca/entrada típica do ramo.
- Produto principal (nome, promessa, o que inclui, faixa de preço sugerida coerente ao segmento e ao ticket do ramo).
- 3 a 4 order bumps / upsells (nome, oferta, +valor sugerido) coerentes com o negócio.
- Copy completa da página de oferta (headline, subhead, 5-7 bullets de benefício, quebra de objeções, garantia, CTA).
- Sequência de recuperação de carrinho (3 toques) + 2 mensagens de follow-up pós-venda.
- KPIs do funil a acompanhar.
Tudo adaptado ao negócio, sem preço/depoimento falso. Português.
${RICO}
Responda SOMENTE com o Markdown.`;
  }

  if (tipo === 'emails') {
    return `Você é copywriter de e-mail/CRM. Escreva uma SEQUÊNCIA DE 5 E-MAILS pronta para enviar, para o negócio "${nome}".${tema}

${ctx}

Para cada e-mail: assunto (+ sugestão de preview text) e corpo humano, específico do ramo, com 1 CTA claro. Sequência: (1) boas-vindas/valor, (2) prova/autoridade com exemplo do segmento, (3) oferta, (4) quebra de objeções reais do nicho, (5) última chamada. Cada e-mail com gancho de abertura forte e P.S. quando fizer sentido. Adaptado ao segmento, sem preço falso. Português.
${RICO}
Responda SOMENTE com o Markdown, cada e-mail iniciando com "## E-mail N — assunto".`;
  }

  return `Você é roteirista de VSL. Escreva um ROTEIRO DE VÍDEO DE VENDAS (VSL) pronto para gravar, para "${nome}", em Markdown.${tema}

${ctx}

Estrutura: gancho (3s), problema, agitação, virada/solução (o que ${nome} oferece), mecanismo único, prova/depoimento genérico honesto, oferta, bônus, garantia, escassez, CTA e recapitulação. Use marcações [PAUSA]/[TELA]/[B-ROLL] quando útil e indique o tom de cada bloco. ~3 a 5 min de fala, específico do ramo. Português.
${RICO}
Responda SOMENTE com o Markdown.`;
}

function stripFence(s) {
  let t = String(s || '').trim();
  const m = t.match(/^```[a-z]*\s*\n([\s\S]*?)\n```\s*$/i);
  if (m) return m[1].trim();
  return t;
}

function extractJson(raw) {
  let s = stripFence(raw);
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

function extractHtml(texto) {
  const a = texto.search(/<!doctype html|<html[\s>]/i);
  if (a < 0) return null;
  const end = texto.lastIndexOf('</html>');
  return end >= 0 ? texto.slice(a, end + 7) : texto.slice(a);
}

function parseProduto(result, tipo) {
  const formato = (PRODUTO_TIPOS[tipo] || {}).formato || 'md';
  let texto = typeof result === 'string' ? result : JSON.stringify(result);

  if (tipo === 'landing') {
    const data = extractJson(texto);
    if (data && (data.brand || Array.isArray(data.scenes))) {
      try { const html = renderLanding(data); if (html && html.length > 200) return { formato: 'html', conteudo: html }; } catch {}
    }
    const html = extractHtml(stripFence(texto));
    return html && html.length > 200 ? { formato: 'html', conteudo: html } : null;
  }

  if (tipo === 'crm') {
    const data = extractJson(texto);
    if (data && (data.brand || Array.isArray(data.stages) || Array.isArray(data.campos))) {
      try { const html = renderCrm(data); if (html && html.length > 200) return { formato: 'html', conteudo: html }; } catch {}
    }
    const html = extractHtml(stripFence(texto));
    return html && html.length > 200 ? { formato: 'html', conteudo: html } : null;
  }

  if (tipo === 'app') {
    const data = extractJson(texto);
    if (data && (data.brand || Array.isArray(data.stages) || Array.isArray(data.produtos))) {
      try { const html = renderApp(data); if (html && html.length > 200) return { formato: 'html', conteudo: html }; } catch {}
    }
    const html = extractHtml(stripFence(texto));
    return html && html.length > 200 ? { formato: 'html', conteudo: html } : null;
  }

  texto = stripFence(texto);
  if (formato === 'html') {
    const html = extractHtml(texto);
    if (html) texto = html;
  }
  return texto && texto.length > 40 ? { formato, conteudo: texto } : null;
}

module.exports = { PRODUTO_TIPOS, buildProdutoTask, parseProduto };
