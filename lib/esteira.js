'use strict';

const ETAPA_MATERIAL = {
  NOVO: null,
  CONTATADO: 'ebook',
  RESPONDEU: 'landing',
  QUALIFICADO: 'crm',
};

const MATERIAL_LABEL = {
  ebook: 'Guia/E-book',
  landing: 'Prévia do site',
  crm: 'Sistema demo (CRM)',
};

const ETAPAS_ATIVAS = Object.keys(ETAPA_MATERIAL);

function materialDaEtapa(stage) {
  return ETAPA_MATERIAL[stage] || null;
}

function anguloDasOpcoes() {
  return [
    { key: 'direto', hint: 'direta ao valor: benefício concreto pro negócio dele em 2-3 linhas' },
    { key: 'pessoal', hint: 'pessoal e curiosa: parte de algo específico do negócio dele (nota, segmento, observação) e faz uma pergunta leve' },
    { key: 'prova', hint: 'prova/autoridade: mostra o que foi preparado/feito pra ele e convida a ver' },
  ];
}

function contextoMaterial(tipo, produto) {
  if (!tipo || !produto) return '';
  const label = MATERIAL_LABEL[tipo] || tipo;
  const linhas = [`MATERIAL PRONTO PARA ESTE LEAD (cite-o na mensagem como o motivo do contato):`,
    `- Tipo: ${label}`,
    `- Título: ${produto.titulo || '(sem título)'}`];
  if (produto.url) linhas.push(`- Link público (INCLUA na mensagem): ${produto.url}`);
  else linhas.push(`- Ainda sem link público: ofereça enviar o material, não invente URL.`);
  if (tipo === 'ebook') linhas.push(`- É um guia prático feito para o segmento dele — posicione como presente de valor, sem pedir nada em troca.`);
  if (tipo === 'landing') linhas.push(`- É uma prévia REAL do site dele, já no ar — convide a abrir e dizer o que achou.`);
  if (tipo === 'crm') linhas.push(`- É um sistema de gestão demo do ramo dele, funcional no navegador — convide a testar e puxe a conversa de proposta.`);
  return linhas.join('\n');
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineMd(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function mdParaHtml(md) {
  const linhas = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let lista = null;
  const fechaLista = () => { if (lista) { out.push(`</${lista}>`); lista = null; } };
  for (const raw of linhas) {
    const l = raw.trimEnd();
    if (!l.trim()) { fechaLista(); continue; }
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) { fechaLista(); out.push(`<h${h[1].length}>${inlineMd(h[2])}</h${h[1].length}>`); continue; }
    if (/^(-{3,}|\*{3,})$/.test(l.trim())) { fechaLista(); out.push('<hr>'); continue; }
    const ul = l.match(/^\s*[-*]\s+(.*)$/);
    if (ul) { if (lista !== 'ul') { fechaLista(); out.push('<ul>'); lista = 'ul'; } out.push(`<li>${inlineMd(ul[1])}</li>`); continue; }
    const ol = l.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) { if (lista !== 'ol') { fechaLista(); out.push('<ol>'); lista = 'ol'; } out.push(`<li>${inlineMd(ol[1])}</li>`); continue; }
    const bq = l.match(/^>\s?(.*)$/);
    if (bq) { fechaLista(); out.push(`<blockquote>${inlineMd(bq[1])}</blockquote>`); continue; }
    fechaLista();
    out.push(`<p>${inlineMd(l)}</p>`);
  }
  fechaLista();
  return out.join('\n');
}

function renderDocHtml(md, opts) {
  const o = opts || {};
  const titulo = o.titulo || (String(md || '').match(/^#\s+(.+)$/m) || [])[1] || 'Guia';
  const marca = o.marca || 'VNMAX';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(titulo)} — material preparado por ${esc(marca)}.">
<style>
:root{--ink:#1a1c22;--soft:#5a5f6e;--line:#e7e8ee;--bg:#fafafc;--accent:#0a84ff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:720px;margin:0 auto;padding:56px 24px 80px}
.brand{font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin-bottom:28px}
h1{font-size:34px;line-height:1.2;letter-spacing:-.02em;margin:0 0 10px}
h2{font-size:23px;line-height:1.3;letter-spacing:-.01em;margin:44px 0 10px}
h3{font-size:18px;margin:30px 0 8px}
p{margin:0 0 16px;color:#2c2f38}
ul,ol{margin:0 0 18px;padding-left:24px}
li{margin:5px 0}
blockquote{margin:22px 0;padding:14px 18px;border-left:3px solid var(--accent);background:#fff;border-radius:0 10px 10px 0;color:var(--soft)}
hr{border:0;border-top:1px solid var(--line);margin:36px 0}
code{background:#eef0f5;padding:2px 6px;border-radius:6px;font-size:.9em}
strong{color:var(--ink)}
.foot{margin-top:56px;padding-top:22px;border-top:1px solid var(--line);font-size:13px;color:var(--soft)}
@media print{body{background:#fff}.wrap{padding:0}}
</style>
</head>
<body>
<div class="wrap">
<div class="brand">${esc(marca)}</div>
${mdParaHtml(md)}
<div class="foot">Material preparado por ${esc(marca)} — tecnologia e crescimento para negócios locais.</div>
</div>
</body>
</html>`;
}

module.exports = { ETAPA_MATERIAL, ETAPAS_ATIVAS, MATERIAL_LABEL, materialDaEtapa, anguloDasOpcoes, contextoMaterial, mdParaHtml, renderDocHtml };
