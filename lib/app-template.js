'use strict';
const { PALETTES } = require('./landing-template.js');

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function slug(s) { return String(s || 'app').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'app'; }

function renderApp(input) {
  const d = input || {};
  const p = PALETTES[d.paletteKey] || PALETTES.pro;
  const brand = d.brand || 'App';
  const ramo = d.ramo || '';
  const stages = (Array.isArray(d.stages) && d.stages.length ? d.stages : [
    { id: 'novo', nome: 'Novo' }, { id: 'contato', nome: 'Em contato' }, { id: 'proposta', nome: 'Proposta' }, { id: 'fechado', nome: 'Fechado' },
  ]).map((s, i) => ({ id: slug(s.id || s.nome || ('etapa' + i)), nome: s.nome || ('Etapa ' + (i + 1)) }));
  const campos = (Array.isArray(d.campos) && d.campos.length ? d.campos : [
    { key: 'nome', label: 'Nome', tipo: 'text' }, { key: 'telefone', label: 'Telefone', tipo: 'tel' }, { key: 'obs', label: 'Observação', tipo: 'textarea' },
  ]).map(c => ({ key: slug(c.key || c.label), label: c.label || c.key, tipo: c.tipo || 'text', opcoes: Array.isArray(c.opcoes) ? c.opcoes : [] }));
  const produtos = (Array.isArray(d.produtos) ? d.produtos : []).map(x => ({ nome: x.nome || x.label || 'Produto', preco: Number(String(x.preco).replace(/[^\d.,]/g, '').replace(',', '.')) || 0 }));
  const cfg = {
    brand, ramo, stages, campos, produtos,
    whatsappField: (campos.find(c => c.tipo === 'tel' || /tel|whats|fone|celular/i.test(c.key)) || {}).key || null,
    titleField: campos[0] ? campos[0].key : 'nome',
    crmCol: 'crm_' + slug(brand), vendasCol: 'vendas_' + slug(brand),
  };
  const exemplos = Array.isArray(d.leadsExemplo) ? d.leadsExemplo : [];

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(brand)} — Painel</title>
<style>
  :root{ --bg:${p.ink}; --panel:${p.panel}; --line:rgba(255,255,255,0.09); --line2:rgba(255,255,255,0.16); --bone:${p.bone}; --dim:${p.gray}; --accent:${p.accent}; --accent2:${p.accentLite}; --green:#25d366; }
  *{box-sizing:border-box;margin:0;padding:0;} body{ background:var(--bg); color:var(--bone); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  button,input,select,textarea{ font-family:inherit; }
  .btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; font-size:14px; font-weight:600; padding:11px 16px; border-radius:10px; border:1px solid var(--line2); background:var(--panel); color:var(--bone); cursor:pointer; }
  .btn.primary{ background:var(--accent); border-color:var(--accent); color:#0b0b0f; } .btn.sm{ padding:7px 11px; font-size:12px; } .btn.ghost{ background:transparent; } .btn.block{ width:100%; }
  .btn.google{ background:#fff; color:#111; border-color:#fff; }
  input,select,textarea{ width:100%; background:var(--bg); border:1px solid var(--line2); border-radius:9px; color:var(--bone); font-size:14px; padding:11px 13px; }
  .field label{ display:block; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:var(--dim); margin-bottom:5px; }
  .field{ display:flex; flex-direction:column; }
  /* auth */
  #auth{ min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
  .authbox{ width:100%; max-width:380px; background:var(--panel); border:1px solid var(--line); border-radius:18px; padding:28px; }
  .authbox h1{ font-size:22px; font-weight:800; text-align:center; } .authbox p{ text-align:center; color:var(--dim); font-size:13px; margin:6px 0 20px; }
  .authbox .field{ margin-bottom:12px; } .sep{ text-align:center; color:var(--dim); font-size:11px; margin:14px 0; }
  .link{ color:var(--accent2); cursor:pointer; text-decoration:underline; font-size:13px; }
  .err{ color:#ff6b6b; font-size:12.5px; text-align:center; margin-top:10px; min-height:16px; }
  /* app shell */
  #app{ display:none; min-height:100vh; }
  .topbar{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 20px; border-bottom:1px solid var(--line); position:sticky; top:0; background:var(--bg); z-index:5; flex-wrap:wrap; }
  .tb-l{ display:flex; align-items:center; gap:16px; }
  .logo{ font-size:16px; font-weight:800; } .logo small{ display:block; font-size:9.5px; color:var(--dim); text-transform:uppercase; letter-spacing:0.14em; }
  .tabs{ display:flex; gap:4px; background:var(--panel); padding:4px; border-radius:11px; }
  .tab{ padding:8px 14px; border-radius:8px; border:none; background:transparent; color:var(--dim); font-size:13px; font-weight:600; cursor:pointer; }
  .tab.on{ background:var(--accent); color:#0b0b0f; }
  .tb-r{ display:flex; align-items:center; gap:10px; } .who{ font-size:12px; color:var(--dim); }
  .wrap{ padding:20px; }
  .kpis{ display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:18px; }
  .kpi{ background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:15px; }
  .kpi .l{ font-size:11px; color:var(--dim); text-transform:uppercase; letter-spacing:0.08em; } .kpi .v{ font-size:26px; font-weight:800; margin-top:6px; }
  .bar{ height:7px; background:var(--bg); border-radius:5px; overflow:hidden; margin-top:5px; } .bar>i{ display:block; height:100%; background:var(--accent); }
  .card{ background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:16px; }
  h3{ font-size:14px; font-weight:700; margin-bottom:12px; }
  /* board */
  .board{ display:flex; gap:13px; overflow-x:auto; align-items:flex-start; }
  .col{ background:var(--panel); border:1px solid var(--line); border-radius:14px; min-width:260px; width:260px; flex-shrink:0; }
  .col.drag{ border-color:var(--accent); } .col-head{ display:flex; justify-content:space-between; padding:12px 14px; border-bottom:1px solid var(--line); font-size:13px; font-weight:700; }
  .col-head .n{ font-size:11px; color:var(--dim); } .cards{ padding:9px; display:flex; flex-direction:column; gap:8px; }
  .lead{ background:var(--bg); border:1px solid var(--line2); border-radius:10px; padding:11px; cursor:grab; } .lead h4{ font-size:13px; } .lead .f{ font-size:11px; color:var(--dim); margin-top:2px; } .lead .a{ display:flex; gap:5px; margin-top:8px; }
  .ic{ width:26px; height:26px; border-radius:6px; border:1px solid var(--line2); background:transparent; color:var(--dim); cursor:pointer; font-size:12px; display:inline-flex; align-items:center; justify-content:center; }
  .ic.wa{ background:var(--green); color:#fff; border-color:var(--green); }
  table{ width:100%; border-collapse:collapse; font-size:13px; } th,td{ text-align:left; padding:9px 8px; border-bottom:1px solid var(--line); } th{ color:var(--dim); font-size:11px; text-transform:uppercase; letter-spacing:0.06em; }
  .row{ display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; } .grow{ flex:1; min-width:140px; }
  .backdrop{ position:fixed; inset:0; background:rgba(0,0,0,0.6); display:none; align-items:center; justify-content:center; padding:16px; z-index:20; } .backdrop.on{ display:flex; }
  .modal{ background:var(--panel); border:1px solid var(--line2); border-radius:16px; width:100%; max-width:430px; max-height:88vh; overflow-y:auto; }
  .modal-h{ display:flex; justify-content:space-between; padding:15px 18px; border-bottom:1px solid var(--line); font-weight:700; }
  .modal-b{ padding:18px; display:flex; flex-direction:column; gap:12px; } .modal-f{ display:flex; gap:8px; justify-content:flex-end; padding:14px 18px; border-top:1px solid var(--line); }
  .notice{ max-width:520px; margin:60px auto; text-align:center; color:var(--dim); font-size:14px; line-height:1.6; padding:0 20px; }
</style>
</head>
<body>

<div id="auth">
  <div class="authbox">
    <h1>${esc(brand)}</h1>
    <p>${esc(ramo ? ramo + ' · painel de gestão' : 'Painel de gestão')}</p>
    <button class="btn google block" onclick="loginGoogle()">Entrar com Google</button>
    <div class="sep">ou com e-mail</div>
    <div class="field" style="margin-bottom:10px"><label>E-mail</label><input id="au_email" type="email" placeholder="voce@email.com"></div>
    <div class="field" style="margin-bottom:14px"><label>Senha</label><input id="au_pass" type="password" placeholder="••••••••"></div>
    <button class="btn primary block" id="au_btn" onclick="loginEmail()">Entrar</button>
    <div class="err" id="au_err"></div>
    <p style="margin-top:14px"><span id="au_toggle" class="link" onclick="toggleMode()">Não tem conta? Criar agora</span></p>
  </div>
</div>

<div id="app">
  <div class="topbar">
    <div class="tb-l">
      <div class="logo">${esc(brand)}<small>Painel</small></div>
      <div class="tabs">
        <button class="tab on" data-m="painel" onclick="go('painel')">Painel</button>
        <button class="tab" data-m="crm" onclick="go('crm')">CRM</button>
        <button class="tab" data-m="vendas" onclick="go('vendas')">Vendas</button>
      </div>
    </div>
    <div class="tb-r"><span class="who" id="who"></span><button class="btn ghost sm" onclick="sair()">Sair</button></div>
  </div>
  <div class="wrap" id="view"></div>
</div>

<div class="backdrop" id="bd"><div class="modal"><div class="modal-h"><span id="mt"></span><button class="ic" onclick="fechar()">✕</button></div><div class="modal-b" id="mb"></div><div class="modal-f"><button class="btn ghost" onclick="fechar()">Cancelar</button><button class="btn primary" id="mok" onclick="salvarModal()">Salvar</button></div></div></div>

<script>
  const CFG = ${JSON.stringify(cfg)};
  const SEED = ${JSON.stringify(exemplos)};
  const F = window.VNMAX_FB || null;
  let user=null, leads=[], vendas=[], modo='login', modId=null, modTipo=null, cur='painel';

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function brl(n){ return 'R$ ' + (Number(n)||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function waLink(t){ const dd=String(t||'').replace(/\\D/g,''); if(!dd) return ''; return 'https://wa.me/'+(dd.length>11?dd:'55'+dd); }

  if(!F || !F.auth){
    document.getElementById('auth').innerHTML='<div class="notice"><b>'+esc(CFG.brand)+'</b><br><br>Este app precisa estar publicado (com Firebase) para ativar o login e a sincronização em nuvem.<br><br>Publique pelo VNMAX Studio para liberar o acesso da equipe.</div>';
  } else {
    F.onAuthStateChanged(F.auth, u=>{ user=u; if(u){ document.getElementById('auth').style.display='none'; document.getElementById('app').style.display='block'; document.getElementById('who').textContent=u.email||u.displayName||''; conectar(); } else { document.getElementById('auth').style.display='flex'; document.getElementById('app').style.display='none'; } });
  }
  function toggleMode(){ modo = modo==='login'?'signup':'login'; document.getElementById('au_btn').textContent = modo==='login'?'Entrar':'Criar conta'; document.getElementById('au_toggle').textContent = modo==='login'?'Não tem conta? Criar agora':'Já tem conta? Entrar'; document.getElementById('au_err').textContent=''; }
  function era(e){ const m=(e&&e.code||'').replace('auth/',''); document.getElementById('au_err').textContent = m==='invalid-credential'||m==='wrong-password'?'E-mail ou senha inválidos.':m==='email-already-in-use'?'E-mail já cadastrado.':m==='weak-password'?'Senha muito curta (mín. 6).':m==='popup-closed-by-user'?'':(m||'Não foi possível.'); }
  function loginGoogle(){ F.signInWithPopup(F.auth, new F.GoogleAuthProvider()).catch(era); }
  function loginEmail(){ const e=document.getElementById('au_email').value.trim(), s=document.getElementById('au_pass').value; if(!e||!s){ document.getElementById('au_err').textContent='Preencha e-mail e senha.'; return; } (modo==='login'?F.signInWithEmailAndPassword(F.auth,e,s):F.createUserWithEmailAndPassword(F.auth,e,s)).catch(era); }
  function sair(){ F.signOut(F.auth); }

  function conectar(){
    try{
      const cCrm=F.collection(F.db, CFG.crmCol);
      F.getDocs(cCrm).then(snap=>{ if(snap.empty){ SEED.forEach((l,i)=>{ const id='l'+Date.now()+i; F.setDoc(F.doc(cCrm,id), Object.assign({stage:(l.stage||CFG.stages[0].id)}, l)); }); } }).catch(()=>{});
      F.onSnapshot(cCrm, snap=>{ leads=[]; snap.forEach(dd=>leads.push(Object.assign({id:dd.id}, dd.data()))); if(cur==='crm'||cur==='painel') go(cur); });
      F.onSnapshot(F.collection(F.db, CFG.vendasCol), snap=>{ vendas=[]; snap.forEach(dd=>vendas.push(Object.assign({id:dd.id}, dd.data()))); if(cur==='vendas'||cur==='painel') go(cur); });
    }catch(e){}
    go('painel');
  }
  function crmPut(l){ try{ F.setDoc(F.doc(F.collection(F.db,CFG.crmCol), l.id), l); }catch(e){} }
  function crmDel(id){ try{ F.deleteDoc(F.doc(F.collection(F.db,CFG.crmCol), id)); }catch(e){} }
  function vendaPut(v){ try{ F.setDoc(F.doc(F.collection(F.db,CFG.vendasCol), v.id), v); }catch(e){} }
  function vendaDel(id){ try{ F.deleteDoc(F.doc(F.collection(F.db,CFG.vendasCol), id)); }catch(e){} }

  function go(m){ cur=m; document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on', t.dataset.m===m)); const v=document.getElementById('view'); if(m==='painel') v.innerHTML=painel(); else if(m==='crm') v.innerHTML=crm(); else v.innerHTML=vendasView(); if(m==='crm') bindBoard(); }

  function painel(){
    const total=leads.length, fech=leads.filter(l=>l.stage===CFG.stages[CFG.stages.length-1].id).length;
    const conv=total?Math.round(fech/total*100):0;
    const now=new Date(), mes=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    const vMes=vendas.filter(v=>(v.data||'').slice(0,7)===mes);
    const receita=vMes.reduce((s,v)=>s+(Number(v.valor)||0),0);
    const ticket=vMes.length?receita/vMes.length:0;
    const max=Math.max(1,...CFG.stages.map(st=>leads.filter(l=>l.stage===st.id).length));
    let bars=''; for(const st of CFG.stages){ const n=leads.filter(l=>l.stage===st.id).length; bars+='<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px"><span class="l">'+esc(st.nome)+'</span><b>'+n+'</b></div><div class="bar"><i style="width:'+(n/max*100)+'%"></i></div></div>'; }
    let ult=vendas.slice().sort((a,b)=>(b.data||'').localeCompare(a.data||'')).slice(0,5).map(v=>'<tr><td>'+esc(v.cliente||'')+'</td><td>'+esc(v.produto||'')+'</td><td>'+brl(v.valor)+'</td><td class="l">'+esc(v.data||'')+'</td></tr>').join('');
    return '<div class="kpis">'
      +'<div class="kpi"><div class="l">Leads</div><div class="v">'+total+'</div></div>'
      +'<div class="kpi"><div class="l">Conversão</div><div class="v" style="color:var(--green)">'+conv+'%</div></div>'
      +'<div class="kpi"><div class="l">Vendas no mês</div><div class="v">'+brl(receita)+'</div></div>'
      +'<div class="kpi"><div class="l">Ticket médio</div><div class="v">'+brl(ticket)+'</div></div>'
      +'</div>'
      +'<div style="display:grid;grid-template-columns:1fr;gap:14px">'
      +'<div class="card"><h3>Funil de leads</h3>'+bars+'</div>'
      +'<div class="card"><h3>Últimas vendas</h3>'+(ult?'<table><tr><th>Cliente</th><th>Produto</th><th>Valor</th><th>Data</th></tr>'+ult+'</table>':'<p class="l" style="font-size:12px">Nenhuma venda registrada ainda.</p>')+'</div>'
      +'</div>';
  }

  function crm(){
    let cols='';
    for(const st of CFG.stages){
      const inSt=leads.filter(l=>l.stage===st.id);
      let cards=inSt.map(l=>{ let f=''; for(const cp of CFG.campos){ if(cp.key===CFG.titleField) continue; if(l[cp.key]) f+='<div class="f">'+esc(cp.label)+': '+esc(l[cp.key])+'</div>'; } const wa=CFG.whatsappField?waLink(l[CFG.whatsappField]):''; return '<div class="lead" draggable="true" data-id="'+l.id+'"><h4>'+esc(l[CFG.titleField]||'Sem nome')+'</h4>'+f+'<div class="a">'+(wa?'<a class="ic wa" href="'+wa+'" target="_blank">✆</a>':'')+'<button class="ic" onclick="editLead(\\''+l.id+'\\')">✎</button><button class="ic" onclick="delLead(\\''+l.id+'\\')">🗑</button></div></div>'; }).join('') || '<p class="l" style="font-size:12px;text-align:center;padding:14px">Vazio</p>';
      cols+='<div class="col" data-stage="'+st.id+'"><div class="col-head"><span>'+esc(st.nome)+'</span><span class="n">'+inSt.length+'</span></div><div class="cards" data-stage="'+st.id+'">'+cards+'</div></div>';
    }
    return '<div class="row" style="margin-bottom:14px;justify-content:flex-end"><button class="btn primary sm" onclick="editLead()">+ Novo lead</button></div><div class="board">'+cols+'</div>';
  }
  function bindBoard(){
    document.querySelectorAll('.lead').forEach(el=>el.addEventListener('dragstart',e=>e.dataTransfer.setData('id',el.dataset.id)));
    document.querySelectorAll('.cards').forEach(z=>{ const col=z.closest('.col'); z.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drag');}); z.addEventListener('dragleave',()=>col.classList.remove('drag')); z.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('drag'); const id=e.dataTransfer.getData('id'); const l=leads.find(x=>x.id===id); if(l){ l.stage=z.dataset.stage; crmPut(l); } }); });
  }
  function editLead(id){ modTipo='lead'; modId=id||null; const l=id?leads.find(x=>x.id===id):{}; document.getElementById('mt').textContent=id?'Editar lead':'Novo lead'; let h=''; for(const cp of CFG.campos){ const v=(l&&l[cp.key])||''; if(cp.tipo==='textarea') h+='<div class="field"><label>'+esc(cp.label)+'</label><textarea id="m_'+cp.key+'" rows="3">'+esc(v)+'</textarea></div>'; else if(cp.tipo==='select') h+='<div class="field"><label>'+esc(cp.label)+'</label><select id="m_'+cp.key+'">'+['',...(cp.opcoes||[])].map(o=>'<option'+(o===v?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select></div>'; else h+='<div class="field"><label>'+esc(cp.label)+'</label><input id="m_'+cp.key+'" type="'+(cp.tipo==='tel'?'tel':cp.tipo==='date'?'date':cp.tipo==='email'?'email':'text')+'" value="'+esc(v)+'"></div>'; } const st=(l&&l.stage)||CFG.stages[0].id; h+='<div class="field"><label>Etapa</label><select id="m_stage">'+CFG.stages.map(s=>'<option value="'+s.id+'"'+(s.id===st?' selected':'')+'>'+s.nome+'</option>').join('')+'</select></div>'; document.getElementById('mb').innerHTML=h; document.getElementById('bd').classList.add('on'); }
  function delLead(id){ if(confirm('Excluir lead?')){ crmDel(id); } }

  function vendasView(){
    const total=vendas.reduce((s,v)=>s+(Number(v.valor)||0),0);
    const opts=CFG.produtos.map(pr=>'<option data-preco="'+pr.preco+'">'+esc(pr.nome)+'</option>').join('');
    const linhas=vendas.slice().sort((a,b)=>(b.data||'').localeCompare(a.data||'')).map(v=>'<tr><td>'+esc(v.cliente||'')+'</td><td>'+esc(v.produto||'')+'</td><td>'+brl(v.valor)+'</td><td class="l">'+esc(v.data||'')+'</td><td><button class="ic" onclick="delVenda(\\''+v.id+'\\')">🗑</button></td></tr>').join('');
    return '<div class="kpis"><div class="kpi"><div class="l">Total em vendas</div><div class="v" style="color:var(--green)">'+brl(total)+'</div></div><div class="kpi"><div class="l">Nº de vendas</div><div class="v">'+vendas.length+'</div></div></div>'
      +'<div class="card" style="margin-bottom:14px"><h3>Registrar venda</h3><div class="row">'
      +'<div class="field grow"><label>Cliente</label><input id="v_cli" list="v_leads" placeholder="Nome do cliente"><datalist id="v_leads">'+leads.map(l=>'<option>'+esc(l[CFG.titleField]||'')+'</option>').join('')+'</datalist></div>'
      +(CFG.produtos.length?'<div class="field grow"><label>Produto/Serviço</label><select id="v_prod" onchange="preencherPreco()">'+opts+'</select></div>':'<div class="field grow"><label>Produto/Serviço</label><input id="v_prod" placeholder="O que foi vendido"></div>')
      +'<div class="field"><label>Valor (R$)</label><input id="v_val" type="number" step="0.01" style="max-width:130px"></div>'
      +'<div class="field"><label>Data</label><input id="v_data" type="date"></div>'
      +'<button class="btn primary" onclick="addVenda()">Registrar</button>'
      +'</div></div>'
      +'<div class="card"><h3>Histórico</h3>'+(linhas?'<table><tr><th>Cliente</th><th>Produto</th><th>Valor</th><th>Data</th><th></th></tr>'+linhas+'</table>':'<p class="l" style="font-size:12px">Nenhuma venda ainda.</p>')+'</div>';
  }
  function preencherPreco(){ const sel=document.getElementById('v_prod'); const o=sel.options[sel.selectedIndex]; const pr=o&&o.dataset.preco; if(pr&&!document.getElementById('v_val').value) document.getElementById('v_val').value=pr; }
  function addVenda(){ const cli=document.getElementById('v_cli').value.trim(); const pr=document.getElementById('v_prod').value; const val=Number(document.getElementById('v_val').value)||0; const data=document.getElementById('v_data').value||new Date().toISOString().slice(0,10); if(!cli&&!pr){ alert('Informe o cliente e o produto.'); return; } vendaPut({ id:'v'+Date.now(), cliente:cli, produto:pr, valor:val, data:data, criadoEm:Date.now() }); document.getElementById('v_cli').value=''; document.getElementById('v_val').value=''; }
  function delVenda(id){ if(confirm('Excluir venda?')) vendaDel(id); }

  function salvarModal(){ if(modTipo==='lead'){ const obj={ stage:document.getElementById('m_stage').value }; for(const cp of CFG.campos){ const el=document.getElementById('m_'+cp.key); obj[cp.key]=el?el.value:''; } if(modId){ const l=leads.find(x=>x.id===modId); Object.assign(l,obj); crmPut(l); } else { obj.id='l'+Date.now(); crmPut(obj); } } fechar(); }
  function fechar(){ document.getElementById('bd').classList.remove('on'); modId=null; modTipo=null; }
</script>
</body>
</html>`;
}

module.exports = { renderApp };
