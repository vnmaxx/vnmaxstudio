'use strict';
const fs = require('fs');
const path = require('path');

function safe(s, max) {
  const v = String(s == null ? '' : s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max || 48);
  return v || 'item';
}

function slugCliente(lead) {
  const id = String((lead && lead.id) || '').trim();
  if (id) return safe(id, 56);
  return safe((lead && lead.nome) || 'cliente', 56);
}

function resetDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(file, content) {
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); } catch {}
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}

function fmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('pt-BR'); } catch { return String(iso); }
}

const STAGE_LABEL = {
  NOVO: 'Novo', CONTATADO: 'Contatado', RESPONDEU: 'Respondeu', QUALIFICADO: 'Qualificado',
  PROPOSTA: 'Proposta', FECHADO: 'Fechado', PERDIDO: 'Perdido',
};

function roteiroMd(r) {
  const l = [];
  l.push(`# ${r.hook || r.title || r.theme || 'Roteiro'}`);
  l.push('');
  if (r.theme) l.push(`**Tema:** ${r.theme}`);
  if (r.viral_score != null) l.push(`**Viral score:** ${r.viral_score}`);
  if (r.formato || r.plataforma) l.push(`**Formato:** ${r.formato || r.plataforma}`);
  if (r.criadoEm) l.push(`**Criado em:** ${fmtDate(r.criadoEm)}`);
  l.push('');
  if (r.hook) { l.push('## Gancho'); l.push(r.hook); l.push(''); }
  if (r.script) { l.push('## Roteiro'); l.push(r.script); l.push(''); }
  if (r.legenda) { l.push('## Legenda'); l.push(r.legenda); l.push(''); }
  if (Array.isArray(r.hashtags) && r.hashtags.length) { l.push('## Hashtags'); l.push(r.hashtags.join(' ')); l.push(''); }
  if (r.cta) { l.push('## CTA'); l.push(r.cta); l.push(''); }
  return l.join('\n');
}

function calendarioMd(items, nome) {
  const l = [`# Calendário — ${nome}`, ''];
  if (!items.length) { l.push('_Sem itens no calendário._'); return l.join('\n'); }
  l.push('| Data | Tema | Status |');
  l.push('| --- | --- | --- |');
  for (const c of items) l.push(`| ${c.date || ''} | ${(c.theme || '').replace(/\|/g, '/')} | ${c.status || ''} |`);
  return l.join('\n') + '\n';
}

function publicacoesMd(posts, nome) {
  const l = [`# Publicações — ${nome}`, ''];
  if (!posts.length) { l.push('_Sem publicações._'); return l.join('\n'); }
  for (const p of posts) {
    l.push(`## ${p.plataforma || 'post'} — ${fmtDate(p.criadoEm)}`);
    if (p.viralScore != null) l.push(`**Viral score:** ${p.viralScore}`);
    if (p.retencao != null) l.push(`**Retenção:** ${p.retencao}%`);
    if (p.metrics) l.push(`**Métricas:** ${p.metrics.views} views · ${p.metrics.likes} likes · ${p.metrics.comments} comentários · ${p.metrics.shares} shares`);
    l.push('');
    if (p.legenda) { l.push(p.legenda); l.push(''); }
  }
  return l.join('\n');
}

function blueprintMd(b) {
  const l = [`# ${b.nome_projeto || 'Blueprint'}`, ''];
  if (b.tipo_recomendado) l.push(`**Tipo recomendado:** ${b.tipo_recomendado}`);
  if (b.criadoEm) l.push(`**Criado em:** ${fmtDate(b.criadoEm)}`);
  l.push('');
  if (b.justificativa) { l.push('## Justificativa'); l.push(b.justificativa); l.push(''); }
  if (Array.isArray(b.funcionalidades) && b.funcionalidades.length) {
    l.push('## Funcionalidades');
    for (const f of b.funcionalidades) l.push(`- ${typeof f === 'string' ? f : (f.nome || JSON.stringify(f))}`);
    l.push('');
  }
  if (b.prompt) { l.push('## Prompt gerado'); l.push('```'); l.push(b.prompt); l.push('```'); l.push(''); }
  return l.join('\n');
}

function mensagensMd(lead) {
  const l = [`# Mensagens — ${lead.nome || lead.id}`, ''];
  const hist = Array.isArray(lead.historico) ? lead.historico : [];
  if (lead.rascunho && lead.rascunho.mensagem) {
    l.push('## Rascunho pendente');
    if (lead.rascunho.canal) l.push(`**Canal:** ${lead.rascunho.canal}`);
    if (lead.rascunho.assunto) l.push(`**Assunto:** ${lead.rascunho.assunto}`);
    l.push('');
    l.push(lead.rascunho.mensagem);
    l.push('');
  }
  if (!hist.length && !(lead.rascunho && lead.rascunho.mensagem)) { l.push('_Sem mensagens registradas._'); return l.join('\n'); }
  if (hist.length) {
    l.push('## Histórico');
    l.push('');
    for (const h of hist) {
      const cab = [fmtDate(h.em), h.tipo, h.canal, h.etapa].filter(Boolean).join(' · ');
      l.push(`### ${cab}`);
      if (h.texto) l.push(h.texto);
      l.push('');
    }
  }
  return l.join('\n');
}

function perfilMd(lead, perfil, content) {
  const l = [`# ${lead.nome || lead.id}`, ''];
  l.push('## Dados do cliente');
  l.push(`- **Segmento:** ${lead.segmento || '—'}`);
  l.push(`- **Contato:** ${lead.contato || '—'}`);
  l.push(`- **Canal:** ${lead.canal || '—'}`);
  l.push(`- **Etapa:** ${STAGE_LABEL[lead.stage] || lead.stage || '—'}`);
  if (lead.observacao) l.push(`- **Observação:** ${lead.observacao}`);
  if (lead.origem) l.push(`- **Origem:** ${lead.origem}`);
  l.push(`- **Criado em:** ${fmtDate(lead.criadoEm)}`);
  l.push(`- **Atualizado em:** ${fmtDate(lead.atualizadoEm)}`);
  l.push('');
  if (perfil && (perfil.tom || perfil.publico || perfil.objetivo)) {
    l.push('## Perfil de conteúdo');
    if (perfil.objetivo) l.push(`- **Objetivo:** ${perfil.objetivo}`);
    if (perfil.publico) l.push(`- **Público:** ${perfil.publico}`);
    if (perfil.tom) l.push(`- **Tom:** ${perfil.tom}`);
    l.push('');
  }
  l.push('## Materiais');
  l.push(`- Roteiros: ${content.roteiros.length}`);
  l.push(`- Produtos: ${content.produtos.length}`);
  l.push(`- Calendário: ${content.calendario.length}`);
  l.push(`- Publicações: ${content.posts.length}`);
  l.push(`- Blueprints: ${content.blueprints.length}`);
  l.push(`- Mensagens: ${(lead.historico || []).length}`);
  l.push('');
  return l.join('\n');
}

function writeCliente(baseDir, lead, perfil, content) {
  const slug = slugCliente(lead);
  const dir = path.join(baseDir, slug);
  resetDir(dir);

  const resumo = {
    id: lead.id,
    nome: lead.nome,
    segmento: lead.segmento || '',
    contato: lead.contato || '',
    canal: lead.canal || '',
    stage: lead.stage || '',
    observacao: lead.observacao || '',
    origem: lead.origem || '',
    criadoEm: lead.criadoEm || '',
    atualizadoEm: lead.atualizadoEm || '',
    perfil: perfil || null,
    totais: {
      roteiros: content.roteiros.length,
      produtos: content.produtos.length,
      calendario: content.calendario.length,
      publicacoes: content.posts.length,
      blueprints: content.blueprints.length,
      mensagens: (lead.historico || []).length,
    },
    materializadoEm: new Date().toISOString(),
  };
  writeFile(path.join(dir, 'perfil.json'), JSON.stringify(resumo, null, 2));
  writeFile(path.join(dir, 'perfil.md'), perfilMd(lead, perfil, content));

  writeFile(path.join(dir, 'mensagens', 'mensagens.md'), mensagensMd(lead));

  content.roteiros.forEach((r, i) => {
    const nome = `${String(i + 1).padStart(2, '0')}-${safe(r.hook || r.theme || r.title, 40)}.md`;
    writeFile(path.join(dir, 'roteiros', nome), roteiroMd(r));
  });

  content.produtos.forEach((p, i) => {
    const ext = (p.formato === 'html' || /^\s*<(!doctype|html)/i.test(String(p.conteudo || ''))) ? 'html' : 'md';
    const nome = `${String(i + 1).padStart(2, '0')}-${safe(p.titulo || p.tipo, 40)}.${ext}`;
    writeFile(path.join(dir, 'produtos', nome), String(p.conteudo || ''));
  });

  if (content.calendario.length) writeFile(path.join(dir, 'calendario', 'calendario.md'), calendarioMd(content.calendario, lead.nome || lead.id));
  if (content.posts.length) writeFile(path.join(dir, 'publicacoes', 'publicacoes.md'), publicacoesMd(content.posts, lead.nome || lead.id));
  content.blueprints.forEach((b, i) => {
    const nome = `${String(i + 1).padStart(2, '0')}-${safe(b.nome_projeto || b.tipo_recomendado, 40)}.md`;
    writeFile(path.join(dir, 'blueprints', nome), blueprintMd(b));
  });

  return { slug, dir, totais: resumo.totais };
}

function gather(conteudoStore, clienteId) {
  return {
    perfil: conteudoStore.getPerfil(clienteId),
    roteiros: conteudoStore.listRoteiros(clienteId),
    produtos: conteudoStore.listProdutos(clienteId),
    calendario: conteudoStore.listCalendario(clienteId),
    posts: conteudoStore.listPosts(clienteId),
    blueprints: conteudoStore.listBlueprints(clienteId),
  };
}

class ClienteWorkspace {
  constructor(workspaceDir, crm, conteudo) {
    this.baseDir = path.join(workspaceDir, 'clientes');
    this.crm = crm;
    this.conteudo = conteudo;
  }

  syncOne(clienteId) {
    if (!clienteId || !this.crm || !this.conteudo) return null;
    const lead = this.crm.list().find(l => l.id === clienteId);
    if (!lead) return null;
    const content = gather(this.conteudo, clienteId);
    return writeCliente(this.baseDir, lead, content.perfil, content);
  }

  syncAll() {
    if (!this.crm || !this.conteudo) return { clientes: 0 };
    const leads = this.crm.list();
    let n = 0;
    const index = [];
    for (const lead of leads) {
      const content = gather(this.conteudo, lead.id);
      const r = writeCliente(this.baseDir, lead, content.perfil, content);
      index.push({ id: lead.id, nome: lead.nome, slug: r.slug, stage: lead.stage, totais: r.totais });
      n++;
    }
    try {
      fs.mkdirSync(this.baseDir, { recursive: true });
      writeFile(path.join(this.baseDir, '_index.json'), JSON.stringify({ atualizadoEm: new Date().toISOString(), clientes: index }, null, 2));
    } catch {}
    return { clientes: n };
  }
}

module.exports = { ClienteWorkspace, slugCliente, writeCliente, gather };
