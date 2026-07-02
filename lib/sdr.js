'use strict';
let vnmax = null;
try { vnmax = require('./vnmax.js'); } catch {}
let esteira = null;
try { esteira = require('./esteira.js'); } catch {}

function sdrTask(lead, cfg, opts) {
  const o = opts || {};
  const diretrizes = vnmax ? vnmax.sdrDirectives(lead, cfg) + '\n\n' : '';
  const material = o.materialTipo && esteira ? esteira.contextoMaterial(o.materialTipo, o.produto) : '';
  const materialBloco = material ? `\n${material}\n` : '';
  const angulos = esteira ? esteira.anguloDasOpcoes() : [
    { key: 'direto', hint: 'direta ao valor' },
    { key: 'pessoal', hint: 'pessoal e curiosa' },
    { key: 'prova', hint: 'prova/autoridade' },
  ];
  const listaAngulos = angulos.map((a, i) => `${i + 1}. "${a.key}" — ${a.hint}`).join('\n');
  return `${diretrizes}Lead para abordar:
Nome: ${lead.nome}
Segmento: ${lead.segmento || '-'}
Contato: ${lead.contato || '-'}
Canal: ${lead.canal || 'instagram'}
Observação: ${lead.observacao || '-'}
Etapa atual no pipeline: ${lead.stage || 'NOVO'}
${materialBloco}
Gere EXATAMENTE 3 versões da próxima mensagem para ESTE lead, adaptadas a ele e ao canal "${lead.canal || 'instagram'}", seguindo a voz e as regras da VNMAX acima. Cada versão com um ângulo diferente:
${listaAngulos}

Se a etapa for NOVO, são 3 versões da PRIMEIRA mensagem (abertura). Nas demais etapas, 3 versões do próximo toque coerente com a etapa${material ? ' e com o material pronto acima (as 3 devem citar o material)' : ''}.

Retorne EXATAMENTE 3 blocos no formato <<<MSG>>>{"angulo":"direto|pessoal|prova","canal":"...","etapa":"...","assunto":"(se email)","mensagem":"...","objetivo":"..."}<<<FIM>>>.`;
}

function parseMsgBlocks(texto) {
  const out = [];
  const re = /<<<MSG>>>([\s\S]*?)<<<FIM>>>/g;
  let m;
  while ((m = re.exec(texto)) !== null) {
    let bloco = m[1].trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    try { out.push(JSON.parse(bloco)); } catch { out.push({ mensagem: bloco }); }
  }
  if (out.length === 0 && String(texto || '').trim()) out.push({ mensagem: String(texto).trim().slice(0, 1500) });
  return out;
}

function firstDraft(result) {
  const texto = typeof result === 'string' ? result : JSON.stringify(result);
  const msgs = parseMsgBlocks(texto);
  return msgs.find(b => b && b.mensagem && String(b.mensagem).trim()) || null;
}

function allDrafts(result, max) {
  const texto = typeof result === 'string' ? result : JSON.stringify(result);
  return parseMsgBlocks(texto)
    .filter(b => b && b.mensagem && String(b.mensagem).trim())
    .slice(0, max || 3);
}

module.exports = { sdrTask, parseMsgBlocks, firstDraft, allDrafts };
