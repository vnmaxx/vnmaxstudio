'use strict';
const { nicheOf, NICHE_PRESETS } = require('./viral-engine.js');

const PRODUTO_TIPOS = {
  landing: { label: 'Landing Page', formato: 'html' },
  ebook: { label: 'E-book / Guia', formato: 'md' },
  funil: { label: 'Funil de vendas', formato: 'md' },
  emails: { label: 'Sequência de e-mails', formato: 'md' },
  vsl: { label: 'Roteiro de VSL', formato: 'md' },
};

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
    return `Você é designer e copywriter de conversão. Crie uma LANDING PAGE COMPLETA E PRONTA PARA USAR para "${nome}", em UM ÚNICO arquivo HTML autossuficiente (HTML5 + CSS dentro de <style>, sem frameworks, sem dependências externas). Tudo ADAPTADO ao negócio real abaixo.${tema}

${ctx}

REQUISITOS (acabamento final, entregável ao cliente):
- Mobile-first e responsiva, visual moderno e limpo, 1 cor de destaque coerente ao segmento, bom contraste.
- Copy REAL e específica: headline com o benefício principal, subheadline, seção de serviços/benefícios, prova social, FAQ quebrando as objeções do segmento, e CTA claro.
- Todos os CTAs em botão apontando pra WhatsApp: href="https://wa.me/SEUNUMERO" (SEUNUMERO é placeholder óbvio pro dono trocar).
- Onde faltar dado real (fotos, depoimentos, preços), use placeholders CLARAMENTE marcados, ex.: [TROCAR: foto da fachada]. NÃO invente preços nem depoimentos falsos.
- Português, sem lorem ipsum.

Responda SOMENTE com o HTML completo, começando em <!DOCTYPE html> e terminando em </html>. Nada antes nem depois, sem blocos de código markdown.`;
  }

  if (tipo === 'ebook') {
    return `Você é especialista em info-produtos. Escreva um E-BOOK/GUIA COMPLETO E PRONTO PARA ENTREGAR ao público de "${nome}", em Markdown.${tema}

${ctx}

REQUISITOS:
- Título forte + subtítulo. Introdução conectando com a dor real do público.
- 5 a 8 capítulos com conteúdo REAL, prático e específico do segmento (passos, exemplos concretos, checklists). Nada raso ou genérico.
- Conclusão + CTA suave para procurar ${nome}.
- Português, pronto para virar PDF.

Responda SOMENTE com o Markdown do e-book, sem texto fora dele e sem cercar tudo em bloco de código.`;
  }

  if (tipo === 'funil') {
    return `Você é estrategista de ofertas. Monte um FUNIL DE VENDAS completo e pronto para usar para "${nome}", em Markdown.${tema}

${ctx}

ENTREGUE:
- Produto principal (nome, promessa, o que inclui, faixa de preço sugerida coerente ao segmento).
- 3 a 4 order bumps / upsells (nome, oferta, +valor sugerido).
- Copy da página de oferta (headline, bullets de benefício, garantia, CTA).
- Sequência curta de mensagens de recuperação de carrinho (3 toques).
Tudo adaptado ao negócio, sem preço/depoimento falso. Português. Responda SOMENTE com o Markdown.`;
  }

  if (tipo === 'emails') {
    return `Você é copywriter de e-mail/CRM. Escreva uma SEQUÊNCIA DE 5 E-MAILS pronta para enviar, para o negócio "${nome}".${tema}

${ctx}

Para cada e-mail: assunto + corpo curto e humano com 1 CTA. Sequência: (1) boas-vindas/valor, (2) prova/autoridade, (3) oferta, (4) objeções, (5) última chamada. Adaptado ao segmento, sem preço falso. Português. Responda SOMENTE com o Markdown, cada e-mail iniciando com "## E-mail N — assunto".`;
  }

  return `Você é roteirista de VSL. Escreva um ROTEIRO DE VÍDEO DE VENDAS (VSL) pronto para gravar, para "${nome}", em Markdown.${tema}

${ctx}

Estrutura: gancho, problema, agitação, virada/solução (o que ${nome} oferece), prova, oferta, CTA. Use marcações [PAUSA]/[TELA] quando útil. ~2 a 4 min de fala. Português. Responda SOMENTE com o Markdown.`;
}

function stripFence(s) {
  let t = String(s || '').trim();
  const m = t.match(/^```[a-z]*\s*\n([\s\S]*?)\n```\s*$/i);
  if (m) return m[1].trim();
  return t;
}

function parseProduto(result, tipo) {
  const formato = (PRODUTO_TIPOS[tipo] || {}).formato || 'md';
  let texto = typeof result === 'string' ? result : JSON.stringify(result);
  texto = stripFence(texto);
  if (formato === 'html') {
    const a = texto.search(/<!doctype html|<html[\s>]/i);
    if (a >= 0) {
      const end = texto.lastIndexOf('</html>');
      texto = end >= 0 ? texto.slice(a, end + 7) : texto.slice(a);
    }
  }
  return texto && texto.length > 40 ? { formato, conteudo: texto } : null;
}

module.exports = { PRODUTO_TIPOS, buildProdutoTask, parseProduto };
