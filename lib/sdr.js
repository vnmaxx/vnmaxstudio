'use strict';

function sdrTask(lead) {
  return `Lead para abordar:
Nome: ${lead.nome}
Segmento: ${lead.segmento || '-'}
Contato: ${lead.contato || '-'}
Canal: ${lead.canal || 'instagram'}
Observação: ${lead.observacao || '-'}
Etapa atual no pipeline: ${lead.stage || 'NOVO'}

Gere a próxima mensagem de abordagem para ESTE lead, adaptada a ele e ao canal "${lead.canal || 'instagram'}". Se a etapa for NOVO, faça a PRIMEIRA mensagem (abertura). Retorne 1 a 2 blocos no seu formato <<<MSG>>>{...}<<<FIM>>>.`;
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

module.exports = { sdrTask, parseMsgBlocks, firstDraft };
