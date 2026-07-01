'use strict';
const { PALETTES } = require('./landing-template.js');

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function slug(s) {
  return String(s || 'crm').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'crm';
}

function renderCrm(input) {
  const d = input || {};
  const p = PALETTES[d.paletteKey] || PALETTES.pro;
  const brand = d.brand || 'CRM';
  const ramo = d.ramo || '';
  const stages = (Array.isArray(d.stages) && d.stages.length ? d.stages : [
    { id: 'novo', nome: 'Novo' }, { id: 'contato', nome: 'Em contato' }, { id: 'agendado', nome: 'Agendado' }, { id: 'fechado', nome: 'Fechado' },
  ]).map((s, i) => ({ id: slug(s.id || s.nome || ('etapa' + i)), nome: s.nome || s.id || ('Etapa ' + (i + 1)) }));
  const campos = (Array.isArray(d.campos) && d.campos.length ? d.campos : [
    { key: 'nome', label: 'Nome', tipo: 'text' }, { key: 'telefone', label: 'Telefone', tipo: 'tel' }, { key: 'obs', label: 'Observação', tipo: 'textarea' },
  ]).map(c => ({ key: slug(c.key || c.label), label: c.label || c.key, tipo: c.tipo || 'text', opcoes: Array.isArray(c.opcoes) ? c.opcoes : [] }));
  const storageKey = 'vnmax_crm_' + slug(brand);
  const cfg = { stages, campos, storageKey, whatsappField: (campos.find(c => c.tipo === 'tel' || /tel|whats|fone|celular/i.test(c.key)) || {}).key || null, titleField: campos[0] ? campos[0].key : 'nome' };
  const exemplos = Array.isArray(d.leadsExemplo) ? d.leadsExemplo : [];

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(brand)} — CRM</title>
<style>
  :root{ --bg:${p.ink}; --panel:${p.panel}; --line:rgba(255,255,255,0.09); --line2:rgba(255,255,255,0.16); --bone:${p.bone}; --dim:${p.gray}; --accent:${p.accent}; --accent2:${p.accentLite}; --green:#25d366; }
  *{box-sizing:border-box;margin:0;padding:0;} body{ background:var(--bg); color:var(--bone); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  header{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 22px; border-bottom:1px solid var(--line); position:sticky; top:0; background:var(--bg); z-index:5; flex-wrap:wrap; }
  .brand{ display:flex; flex-direction:column; }
  .brand b{ font-size:18px; font-weight:800; letter-spacing:-0.01em; } .brand span{ font-size:11px; color:var(--dim); text-transform:uppercase; letter-spacing:0.14em; }
  .btn{ display:inline-flex; align-items:center; gap:7px; font-size:13px; font-weight:600; padding:10px 16px; border-radius:9px; border:1px solid var(--line2); background:var(--panel); color:var(--bone); cursor:pointer; }
  .btn.primary{ background:var(--accent); border-color:var(--accent); color:#0b0b0f; }
  .btn.sm{ padding:6px 10px; font-size:12px; }
  .btn.ghost{ background:transparent; }
  .toolbar{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .search{ background:var(--panel); border:1px solid var(--line); border-radius:9px; color:var(--bone); font-size:13px; padding:9px 12px; min-width:180px; }
  .board{ display:flex; gap:14px; padding:18px 22px; overflow-x:auto; align-items:flex-start; min-height:calc(100vh - 70px); }
  .col{ background:var(--panel); border:1px solid var(--line); border-radius:14px; min-width:270px; width:270px; flex-shrink:0; display:flex; flex-direction:column; max-height:calc(100vh - 110px); }
  .col.drag{ border-color:var(--accent); box-shadow:0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent); }
  .col-head{ display:flex; align-items:center; justify-content:space-between; padding:13px 15px; border-bottom:1px solid var(--line); }
  .col-head b{ font-size:13px; font-weight:700; } .col-head .n{ font-size:11px; color:var(--dim); background:var(--bg); padding:1px 8px; border-radius:20px; }
  .cards{ padding:10px; display:flex; flex-direction:column; gap:9px; overflow-y:auto; flex:1; }
  .card{ background:var(--bg); border:1px solid var(--line2); border-radius:11px; padding:12px; cursor:grab; }
  .card:active{ cursor:grabbing; } .card h4{ font-size:13.5px; font-weight:700; margin-bottom:5px; }
  .card .f{ font-size:11.5px; color:var(--dim); margin-top:2px; word-break:break-word; }
  .card .acts{ display:flex; gap:6px; margin-top:10px; }
  .icona{ display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:7px; border:1px solid var(--line2); background:transparent; color:var(--dim); cursor:pointer; font-size:13px; }
  .icona.wa{ color:#fff; background:var(--green); border-color:var(--green); }
  .empty{ color:var(--dim); font-size:12px; text-align:center; padding:18px 8px; }
  .backdrop{ position:fixed; inset:0; background:rgba(0,0,0,0.6); display:none; align-items:center; justify-content:center; padding:16px; z-index:20; }
  .backdrop.on{ display:flex; }
  .modal{ background:var(--panel); border:1px solid var(--line2); border-radius:16px; width:100%; max-width:440px; max-height:88vh; overflow-y:auto; }
  .modal-h{ display:flex; align-items:center; justify-content:space-between; padding:16px 18px; border-bottom:1px solid var(--line); }
  .modal-b{ padding:18px; display:flex; flex-direction:column; gap:12px; }
  .field label{ display:block; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:var(--dim); margin-bottom:5px; }
  .field input,.field select,.field textarea{ width:100%; background:var(--bg); border:1px solid var(--line2); border-radius:8px; color:var(--bone); font-size:14px; padding:10px 12px; font-family:inherit; }
  .modal-f{ display:flex; gap:8px; justify-content:flex-end; padding:14px 18px; border-top:1px solid var(--line); }
</style>
</head>
<body>
<header>
  <div class="brand"><b>${esc(brand)}</b><span>CRM${ramo ? ' · ' + esc(ramo) : ''}</span></div>
  <div class="toolbar">
    <input class="search" id="q" placeholder="Buscar lead…" oninput="render()">
    <button class="btn ghost sm" onclick="exportar()">Exportar</button>
    <button class="btn primary" onclick="abrir()">+ Novo lead</button>
  </div>
</header>
<div class="board" id="board"></div>

<div class="backdrop" id="bd">
  <div class="modal">
    <div class="modal-h"><b id="mt">Novo lead</b><button class="icona" onclick="fechar()">✕</button></div>
    <div class="modal-b" id="mb"></div>
    <div class="modal-f"><button class="btn ghost" onclick="fechar()">Cancelar</button><button class="btn primary" onclick="salvar()">Salvar</button></div>
  </div>
</div>

<script>
  const CFG = ${JSON.stringify(cfg)};
  const SEED = ${JSON.stringify(exemplos)};
  const KEY = CFG.storageKey;
  function load(){ try{ const r=localStorage.getItem(KEY); if(r) return JSON.parse(r); }catch(e){} const s=SEED.map((l,i)=>({ id:'l'+Date.now()+i, stage:(l.stage||CFG.stages[0].id), ...l })); save(s); return s; }
  function save(a){ localStorage.setItem(KEY, JSON.stringify(a)); }
  let leads = load();
  let editId = null;

  function waLink(tel){ const dd=String(tel||'').replace(/\\D/g,''); if(!dd) return ''; const ph=dd.length>11?dd:'55'+dd; return 'https://wa.me/'+ph; }

  function render(){
    const q=(document.getElementById('q').value||'').toLowerCase();
    const board=document.getElementById('board'); board.innerHTML='';
    for(const st of CFG.stages){
      const col=document.createElement('div'); col.className='col'; col.dataset.stage=st.id;
      const inSt=leads.filter(l=>l.stage===st.id && (!q || Object.values(l).join(' ').toLowerCase().includes(q)));
      col.innerHTML='<div class="col-head"><b>'+st.nome+'</b><span class="n">'+inSt.length+'</span></div>';
      const cards=document.createElement('div'); cards.className='cards'; cards.dataset.stage=st.id;
      cards.addEventListener('dragover',e=>{e.preventDefault(); col.classList.add('drag');});
      cards.addEventListener('dragleave',()=>col.classList.remove('drag'));
      cards.addEventListener('drop',e=>{e.preventDefault(); col.classList.remove('drag'); const id=e.dataTransfer.getData('id'); const l=leads.find(x=>x.id===id); if(l){ l.stage=st.id; save(leads); render(); }});
      if(!inSt.length) cards.innerHTML='<div class="empty">Sem leads</div>';
      for(const l of inSt){
        const c=document.createElement('div'); c.className='card'; c.draggable=true;
        c.addEventListener('dragstart',e=>e.dataTransfer.setData('id',l.id));
        const title=esc(l[CFG.titleField]||'Sem nome');
        let fields='';
        for(const cp of CFG.campos){ if(cp.key===CFG.titleField) continue; const v=l[cp.key]; if(v) fields+='<div class="f">'+esc(cp.label)+': '+esc(v)+'</div>'; }
        const wa=CFG.whatsappField ? waLink(l[CFG.whatsappField]) : '';
        c.innerHTML='<h4>'+title+'</h4>'+fields+'<div class="acts">'+(wa?'<a class="icona wa" href="'+wa+'" target="_blank" title="WhatsApp">✆</a>':'')+'<button class="icona" title="Editar" onclick="abrir(\\''+l.id+'\\')">✎</button><button class="icona" title="Excluir" onclick="excluir(\\''+l.id+'\\')">🗑</button></div>';
        cards.appendChild(c);
      }
      col.appendChild(cards); board.appendChild(col);
    }
  }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function abrir(id){
    editId=id||null; const l=id?leads.find(x=>x.id===id):{};
    document.getElementById('mt').textContent=id?'Editar lead':'Novo lead';
    const mb=document.getElementById('mb'); mb.innerHTML='';
    for(const cp of CFG.campos){
      const val=(l&&l[cp.key])||'';
      let inp;
      if(cp.tipo==='textarea') inp='<textarea id="f_'+cp.key+'" rows="3">'+esc(val)+'</textarea>';
      else if(cp.tipo==='select') inp='<select id="f_'+cp.key+'">'+['',...(cp.opcoes||[])].map(o=>'<option'+(o===val?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select>';
      else inp='<input id="f_'+cp.key+'" type="'+(cp.tipo==='tel'?'tel':cp.tipo==='email'?'email':cp.tipo==='date'?'date':'text')+'" value="'+esc(val)+'">';
      mb.innerHTML+='<div class="field"><label>'+esc(cp.label)+'</label>'+inp+'</div>';
    }
    const st=(l&&l.stage)||CFG.stages[0].id;
    mb.innerHTML+='<div class="field"><label>Etapa</label><select id="f_stage">'+CFG.stages.map(s=>'<option value="'+s.id+'"'+(s.id===st?' selected':'')+'>'+s.nome+'</option>').join('')+'</select></div>';
    document.getElementById('bd').classList.add('on');
  }
  function fechar(){ document.getElementById('bd').classList.remove('on'); editId=null; }
  function salvar(){
    const obj={ stage:document.getElementById('f_stage').value };
    for(const cp of CFG.campos){ const el=document.getElementById('f_'+cp.key); obj[cp.key]=el?el.value:''; }
    if(editId){ const l=leads.find(x=>x.id===editId); Object.assign(l,obj); }
    else { obj.id='l'+Date.now(); leads.push(obj); }
    save(leads); fechar(); render();
  }
  function excluir(id){ if(!confirm('Excluir este lead?')) return; leads=leads.filter(x=>x.id!==id); save(leads); render(); }
  function exportar(){ const rows=[CFG.campos.map(c=>c.label).concat('Etapa')]; for(const l of leads){ rows.push(CFG.campos.map(c=>(l[c.key]||'').toString().replace(/[\\n;]/g,' ')).concat((CFG.stages.find(s=>s.id===l.stage)||{}).nome||'')); } const csv=rows.map(r=>r.join(';')).join('\\n'); const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download='leads.csv'; a.click(); }
  render();
</script>
</body>
</html>`;
}

module.exports = { renderCrm };
