'use strict';

const { renderLanding } = require('./landing-template.js');
const { nicheOf } = require('./viral-engine.js');

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function nl(s) { return esc(s).replace(/\\n|\n/g, '<br>'); }
function digits(s) { const d = String(s || '').replace(/\D/g, ''); if (!d) return ''; return d.length > 11 ? d : '55' + d; }
function money(v) { if (v == null || v === '') return ''; const s = String(v); return /^[\d.,]+$/.test(s) ? 'R$ ' + s : esc(s); }
function accentSplit(brand, accentWord) {
  const b = String(brand || 'Sua Marca');
  if (accentWord && b.includes(accentWord)) return b.replace(accentWord, `<span class="lp-accent">${esc(accentWord)}</span>`);
  return esc(b);
}

// tom de cor por segmento (a IA já escolhe paletteKey) — cada tema o reinterpreta
const SEG = {
  barber:  { h: 38,  accent: '#c8912f', deep: '#7a5216' },
  clinic:  { h: 184, accent: '#0f9d92', deep: '#0b6b64' },
  beauty:  { h: 330, accent: '#db4f8f', deep: '#9d2b64' },
  food:    { h: 24,  accent: '#e0701a', deep: '#a34b0d' },
  fitness: { h: 92,  accent: '#5c9a1b', deep: '#3f6d10' },
  pro:     { h: 40,  accent: '#b3894e', deep: '#7c5c2f' },
  generic: { h: 218, accent: '#3b74e0', deep: '#1f4bad' },
};
function seg(d) { return SEG[d && d.paletteKey] || SEG.generic; }

function heroTitle(d) { return d.tagline || d.sub || d.brand || 'Sua Marca'; }

function scenesOf(d) { return (Array.isArray(d.scenes) ? d.scenes : []).filter(s => s && (s.title || s.body)).slice(0, 6); }
function servicesOf(d) { return (Array.isArray(d.services) ? d.services : []).filter(s => s && s.name).slice(0, 6); }

function contactBits(d) {
  const wa = digits(d.whatsapp || d.phone);
  return { wa, phone: d.phone ? esc(d.phone) : '', insta: d.instagram ? esc(String(d.instagram).replace('@', '')) : '' };
}

// formulário — os name= são lidos pela captura do Firebase (injectFirebase)
function leadForm(d, services) {
  const opts = services.map(s => `<option>${esc(s.name)}</option>`).join('');
  return `<form class="lp-form" id="leadForm">
    <div class="lp-field"><label>Nome</label><input name="nome" required placeholder="Seu nome"></div>
    <div class="lp-field"><label>WhatsApp</label><input name="telefone" required placeholder="(00) 00000-0000"></div>
    ${services.length ? `<div class="lp-field"><label>O que você quer</label><select name="servico"><option value="">Selecione…</option>${opts}</select></div>` : ''}
    <div class="lp-field"><label>Melhor dia / horário</label><input name="preferencia" placeholder="Ex.: sábado de manhã"></div>
    <button class="lp-btn lp-btn-primary" type="submit" data-noscroll>${esc(d.ctaLabel || 'Solicitar contato')}</button>
    <p class="lp-ok" id="formOk" style="display:none">Recebido! Vamos te chamar no WhatsApp. ✅</p>
  </form>`;
}

function waFloat(wa) {
  if (!wa) return '';
  return `<a class="lp-wa" href="https://wa.me/${wa}" target="_blank" rel="noopener" aria-label="WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15l-1.4 5 5.1-1.3A10 10 0 1012 2zm4.6 12c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.5 6.5 0 01-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.2 0-.4 0-.5s-.6-1.5-.8-2-.4-.4-.6-.4h-.5a1 1 0 00-.7.3A3 3 0 006 9.4c0 1.8 1.3 3.5 1.5 3.8s2.6 4 6.3 5.3c2.2.8 2.6.6 3.1.6s1.5-.6 1.7-1.2.2-1.1.1-1.2z"/></svg></a>`;
}

function baseScript(wa) {
  return `<script>
  const WA=${JSON.stringify(wa || '')};
  const hh=document.querySelector('.lp-header');
  if(hh) addEventListener('scroll',()=>hh.classList.toggle('scrolled',scrollY>24),{passive:true});
  const mt=document.getElementById('lpMenu'),mn=document.getElementById('lpNav');
  if(mt&&mn){ mt.addEventListener('click',()=>{mt.classList.toggle('open');mn.classList.toggle('open');});
    mn.querySelectorAll('a,button').forEach(a=>a.addEventListener('click',()=>{mt.classList.remove('open');mn.classList.remove('open');})); }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-action=book]');if(!b)return;e.preventDefault();const el=document.getElementById('agendar');if(el)el.scrollIntoView({behavior:'smooth'});});
  const f=document.getElementById('leadForm');
  if(f){f.addEventListener('submit',e=>{const d=new FormData(f);const msg='Olá! Quero falar sobre '+(d.get('servico')||'atendimento')+'.'+(d.get('nome')?' Nome: '+d.get('nome'):'')+(d.get('preferencia')?' · '+d.get('preferencia'):'');const ok=document.getElementById('formOk');if(ok)ok.style.display='block';if(WA)setTimeout(()=>window.open('https://wa.me/'+WA+'?text='+encodeURIComponent(msg),'_blank'),400);if(!window.__fbCapture)e.preventDefault();});}
  const io=new IntersectionObserver(es=>es.forEach(en=>{if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target);}}),{threshold:0.12});
  document.querySelectorAll('.rv').forEach(el=>io.observe(el));
  </script>`;
}

function head(d, fonts) {
  return `<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(d.brand || 'Landing')}${d.brandSub ? ' — ' + esc(d.brandSub) : ''}</title>
<meta name="description" content="${esc(d.metaDescription || d.sub || d.brand || '')}">
<meta property="og:title" content="${esc(d.brand || '')}"><meta property="og:description" content="${esc(d.metaDescription || d.sub || '')}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${fonts}" rel="stylesheet">`;
}

// estrutura semântica compartilhada — cada tema veste com CSS próprio
function shell(d, theme) {
  const s = seg(d);
  const c = contactBits(d);
  const scenes = scenesOf(d);
  const services = servicesOf(d);
  const brandLine = accentSplit(d.brand, d.brandAccent);
  const mapQ = encodeURIComponent(String(d.address || d.brand || '').replace(/\\n|\n/g, ' '));
  const navLinks = `${services.length ? '<a href="#services">Serviços</a>' : ''}<a href="#sobre">Sobre</a><a href="#visit">Contato</a>`;

  const scenesHtml = scenes.map((sc, i) => `
    <article class="lp-scene rv" data-i="${i}">
      ${sc.eyebrow ? `<span class="lp-kicker">${esc(sc.eyebrow)}</span>` : `<span class="lp-num">0${i + 1}</span>`}
      <h3>${nl(sc.title)}</h3>
      ${sc.body ? `<p>${esc(sc.body)}</p>` : ''}
    </article>`).join('');

  const servicesHtml = services.map(sv => {
    const price = money(sv.price);
    return `<div class="lp-svc rv${sv.featured ? ' feat' : ''}">
      ${sv.badge ? `<span class="lp-svc-badge">${esc(sv.badge)}</span>` : ''}
      <div class="lp-svc-head"><span class="lp-svc-name">${esc(sv.name)}</span>${price ? `<span class="lp-svc-price">${price}</span>` : ''}</div>
      ${sv.desc ? `<p class="lp-svc-desc">${esc(sv.desc)}</p>` : ''}
      <button class="lp-svc-cta" data-action="book">Quero este →</button>
    </div>`;
  }).join('');

  const igSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>`;
  const waSvg = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15l-1.4 5 5.1-1.3A10 10 0 1012 2zm0 18a8 8 0 01-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1112 20z"/></svg>`;

  return `${head(d, theme.fonts)}
<style>
:root{ --accent:${theme.accent(s)}; --accent-2:${theme.accent2(s)}; }
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:${theme.bodyFont};line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:inherit;text-decoration:none}button{font-family:inherit;cursor:pointer;border:none;background:none}img,svg{display:block}
.lp-wrap{max-width:${theme.maxw || '1140px'};margin:0 auto;padding:0 24px}
@media(min-width:760px){.lp-wrap{padding:0 40px}}
.rv{opacity:0;transform:translateY(26px);transition:opacity .7s cubic-bezier(.22,.61,.36,1),transform .7s cubic-bezier(.22,.61,.36,1)}
.rv.in{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){.rv{opacity:1!important;transform:none!important}}
.lp-header{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:20px 24px;transition:.32s cubic-bezier(.22,.61,.36,1)}
@media(min-width:760px){.lp-header{padding:22px 40px}}
.lp-brand{display:flex;flex-direction:column;line-height:1.05;font-weight:800;letter-spacing:-.01em}
.lp-brand .b1{font-size:19px}.lp-brand .b2{font-size:9px;letter-spacing:.28em;text-transform:uppercase;opacity:.66;margin-top:3px;font-weight:600}
.lp-nav{display:none;align-items:center;gap:28px;font-size:13.5px;font-weight:600}
@media(min-width:900px){.lp-nav{display:flex}}
.lp-cta{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:13.5px;padding:11px 20px}
.lp-menu{display:flex;flex-direction:column;gap:5px;width:26px;padding:6px 0}
@media(min-width:900px){.lp-menu{display:none}}
.lp-menu span{height:2px;width:100%;background:currentColor;transition:.3s}
.lp-menu.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}.lp-menu.open span:nth-child(2){opacity:0}.lp-menu.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
.lp-mnav{position:fixed;inset:0;z-index:45;display:flex;flex-direction:column;justify-content:center;gap:14px;padding:36px;font-size:clamp(24px,7vw,36px);font-weight:800;opacity:0;pointer-events:none;transition:.34s}
.lp-mnav.open{opacity:1;pointer-events:auto}
.lp-hero{position:relative;min-height:100svh;display:flex;flex-direction:column;justify-content:center;padding:120px 0 70px;overflow:hidden}
.lp-eyebrow{display:inline-block;font-weight:700;letter-spacing:.26em;text-transform:uppercase;font-size:12px;color:var(--accent)}
.lp-hero h1{font-family:${theme.titleFont};font-weight:${theme.titleWeight};line-height:${theme.titleLh || '.98'};letter-spacing:${theme.titleTrack || '-.02em'};font-size:clamp(44px,8.4vw,${theme.h1max || '92px'});margin:18px 0}
.lp-hero .lp-sub{max-width:540px;font-size:clamp(16px,2.1vw,19px);opacity:.82}
.lp-rating{display:inline-flex;align-items:center;gap:8px;margin-top:20px;font-weight:700;font-size:13px}
.lp-rating .st{color:var(--accent);letter-spacing:2px}
.lp-btn-row{display:flex;flex-wrap:wrap;gap:14px;margin-top:34px}
.lp-btn{display:inline-flex;align-items:center;gap:9px;font-weight:700;font-size:14.5px;padding:15px 30px;transition:.26s cubic-bezier(.22,.61,.36,1)}
.lp-sec{position:relative;padding:88px 0}
@media(min-width:760px){.lp-sec{padding:116px 0}}
.lp-sec-head{max-width:640px;margin-bottom:52px}
.lp-sec-head h2{font-family:${theme.titleFont};font-weight:${theme.titleWeight};font-size:clamp(32px,5.6vw,${theme.h2max || '58px'});line-height:1.02;letter-spacing:${theme.titleTrack || '-.02em'};margin-top:12px}
.lp-sec-head p{margin-top:14px;opacity:.72;font-size:16px}
.lp-story{display:grid;gap:20px;grid-template-columns:1fr}
@media(min-width:720px){.lp-story{grid-template-columns:1fr 1fr}}
@media(min-width:1040px){.lp-story{grid-template-columns:repeat(${theme.storyCols || 3},1fr)}}
.lp-scene{padding:30px 26px}
.lp-scene .lp-num{font-family:${theme.titleFont};font-size:34px;font-weight:${theme.titleWeight};opacity:.28}
.lp-scene .lp-kicker{font-weight:700;letter-spacing:.2em;text-transform:uppercase;font-size:11px;color:var(--accent)}
.lp-scene h3{font-size:21px;line-height:1.2;margin:14px 0 10px;font-weight:750;letter-spacing:-.01em}
.lp-scene p{opacity:.74;font-size:15px}
.lp-svc-grid{display:grid;gap:18px;grid-template-columns:1fr}
@media(min-width:680px){.lp-svc-grid{grid-template-columns:1fr 1fr}}
@media(min-width:1000px){.lp-svc-grid{grid-template-columns:repeat(3,1fr)}}
.lp-svc{position:relative;padding:26px 24px;transition:.32s cubic-bezier(.22,.61,.36,1)}
.lp-svc-badge{position:absolute;top:-11px;left:22px;font-weight:700;font-size:10px;letter-spacing:.12em;text-transform:uppercase;padding:4px 11px;background:var(--accent);color:#fff}
.lp-svc-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:6px 14px}
.lp-svc-name{font-weight:750;font-size:18px;letter-spacing:-.01em}
.lp-svc-price{font-family:${theme.titleFont};font-weight:${theme.titleWeight};font-size:23px;color:var(--accent)}
.lp-svc-desc{margin-top:11px;opacity:.72;font-size:14px}
.lp-svc-cta{margin-top:16px;font-weight:700;font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}
.lp-visit-grid{display:grid;gap:40px;grid-template-columns:1fr}
@media(min-width:900px){.lp-visit-grid{grid-template-columns:1fr 1fr;gap:56px;align-items:center}}
.lp-info{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:26px 0}
.lp-info h4{font-weight:700;letter-spacing:.16em;text-transform:uppercase;font-size:11px;color:var(--accent);margin-bottom:10px}
.lp-info p{opacity:.82;font-size:14.5px}
.lp-contact{display:flex;flex-direction:column;gap:10px;font-size:14.5px;opacity:.86}
.lp-contact a{display:inline-flex;align-items:center;gap:9px}.lp-contact svg{width:17px;height:17px;color:var(--accent)}
.lp-map{position:relative;aspect-ratio:4/5;overflow:hidden;display:flex;align-items:center;justify-content:center}
.lp-map .grid{position:absolute;inset:0;opacity:.5;background-image:linear-gradient(currentColor 1px,transparent 1px),linear-gradient(90deg,currentColor 1px,transparent 1px);background-size:32px 32px;opacity:.09}
.lp-map .pin{width:44px;height:44px;color:var(--accent);z-index:2}
.lp-book-grid{display:grid;gap:40px;grid-template-columns:1fr}
@media(min-width:900px){.lp-book-grid{grid-template-columns:1fr 1fr;gap:56px;align-items:center}}
.lp-form{display:flex;flex-direction:column;gap:14px;padding:28px}
.lp-field{display:flex;flex-direction:column;gap:6px}
.lp-form label{font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:10.5px;color:var(--accent)}
.lp-form input,.lp-form select{width:100%;font-family:inherit;font-size:15px;padding:13px 15px;outline:none;transition:.2s}
.lp-form .lp-btn-primary{justify-content:center;margin-top:6px}
.lp-ok{font-weight:700;font-size:14px;color:var(--accent)}
.lp-footer{padding:56px 0 34px;text-align:center}
.lp-foot-nav{display:flex;flex-wrap:wrap;justify-content:center;gap:22px;margin:22px 0;font-weight:600;font-size:13px;opacity:.8}
.lp-socials{display:flex;justify-content:center;gap:16px;margin-bottom:18px}.lp-socials svg{width:19px;height:19px}
.lp-copy{opacity:.6;font-size:12.5px}
.lp-wa{position:fixed;right:18px;bottom:18px;z-index:60;width:56px;height:56px;border-radius:50%;background:#25d366;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 26px rgba(0,0,0,.28)}
.lp-wa svg{width:30px;height:30px;color:#fff}
${theme.css}
</style></head>
<body class="lp-body">
<header class="lp-header">
  <a href="#top" class="lp-brand"><span class="b1">${brandLine}</span>${d.brandSub ? `<span class="b2">${esc(d.brandSub)}</span>` : ''}</a>
  <nav class="lp-nav">${navLinks}</nav>
  <div style="display:flex;align-items:center;gap:16px">
    <button class="lp-cta" data-action="book">${esc(d.ctaLabel || 'Agendar')}</button>
    <button class="lp-menu" id="lpMenu" aria-label="Menu"><span></span><span></span><span></span></button>
  </div>
</header>
<div class="lp-mnav" id="lpNav">${navLinks}<button class="lp-cta" data-action="book">${esc(d.ctaLabel || 'Agendar')}</button></div>

<section class="lp-hero" id="top">
  ${theme.heroFx || ''}
  <div class="lp-wrap" style="position:relative;z-index:2">
    ${d.eyebrow ? `<span class="lp-eyebrow">${esc(d.eyebrow)}</span>` : ''}
    <h1>${nl(heroTitle(d))}</h1>
    ${d.sub ? `<p class="lp-sub">${esc(d.sub)}</p>` : ''}
    ${d.rating ? `<div class="lp-rating"><span class="st">★★★★★</span><span>${esc(d.rating)}</span></div>` : ''}
    <div class="lp-btn-row"><button class="lp-btn lp-btn-primary" data-action="book">${esc(d.ctaLabel || 'Agendar agora')}</button>${c.wa ? `<a class="lp-btn lp-btn-ghost" href="https://wa.me/${c.wa}" target="_blank" rel="noopener">WhatsApp</a>` : (c.phone ? `<a class="lp-btn lp-btn-ghost" href="tel:${c.phone}">Ligar</a>` : '')}</div>
  </div>
</section>

<section class="lp-sec lp-sobre" id="sobre"><div class="lp-wrap">
  <div class="lp-sec-head rv"><span class="lp-eyebrow">${esc(d.visitEyebrow || 'Por que a gente')}</span><h2>${esc(d.finalTitle ? String(d.finalTitle).replace(/\\n|\n/g, ' ') : (d.tagline || 'O que nos torna diferentes'))}</h2>${d.metaDescription ? `<p>${esc(d.metaDescription)}</p>` : ''}</div>
  ${scenes.length ? `<div class="lp-story">${scenesHtml}</div>` : ''}
</div></section>

${services.length ? `<section class="lp-sec lp-services" id="services"><div class="lp-wrap">
  <div class="lp-sec-head rv"><span class="lp-eyebrow">${esc(d.servicesEyebrow || 'O que oferecemos')}</span><h2>${esc(d.servicesTitle || 'Serviços & Preços')}</h2>${d.servicesSub ? `<p>${esc(d.servicesSub)}</p>` : ''}</div>
  <div class="lp-svc-grid">${servicesHtml}</div>
</div></section>` : ''}

<section class="lp-sec lp-visit" id="visit"><div class="lp-wrap"><div class="lp-visit-grid">
  <div class="rv">
    <span class="lp-eyebrow">${esc(d.visitEyebrow || 'Onde estamos')}</span>
    <h2 class="lp-vt">${esc(d.visitTitle || 'Venha nos visitar')}</h2>
    <div class="lp-info">
      <div><h4>Endereço</h4><p>${nl(d.address || '[TROCAR: endereço]')}</p></div>
      <div><h4>${esc(d.hoursTitle || 'Funcionamento')}</h4><p>${nl(d.hours || '[TROCAR: horários]')}</p></div>
    </div>
    <div class="lp-contact">
      ${c.phone ? `<a href="tel:${c.phone}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5c0 8 7 15 15 15l3-4-6-3-2 2c-3-1.5-5-3.5-6.5-6.5l2-2-3-6z"/></svg>${c.phone}</a>` : ''}
      ${c.insta ? `<a href="https://instagram.com/${c.insta}" target="_blank" rel="noopener">${igSvg}@${c.insta}</a>` : ''}
    </div>
    <div class="lp-btn-row"><button class="lp-btn lp-btn-primary" data-action="book">Agendar horário</button><a class="lp-btn lp-btn-ghost" href="https://www.google.com/maps/search/?api=1&query=${mapQ}" target="_blank" rel="noopener">Ver no mapa</a></div>
  </div>
  <div class="rv"><div class="lp-map"><div class="grid"></div><svg class="pin" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C7.6 2 4 5.6 4 10c0 6.4 8 12 8 12s8-5.6 8-12c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"/></svg></div></div>
</div></div></section>

<section class="lp-sec lp-book" id="agendar"><div class="lp-wrap"><div class="lp-book-grid">
  <div class="rv"><span class="lp-eyebrow">${esc(d.bookEyebrow || 'Agende agora')}</span><h2 class="lp-vt">${esc(d.bookTitle || 'Garanta seu horário')}</h2><p style="margin-top:14px;opacity:.78;max-width:420px">${esc(d.bookLead || 'Preencha e a gente te chama pra confirmar. Rápido, sem enrolação.')}</p></div>
  <div class="rv">${leadForm(d, services)}</div>
</div></div></section>

<footer class="lp-footer"><div class="lp-wrap">
  <a href="#top" class="lp-brand" style="display:inline-flex;align-items:center"><span class="b1">${brandLine}</span></a>
  <div class="lp-foot-nav">${navLinks}${c.phone ? `<a href="tel:${c.phone}">Ligar</a>` : ''}</div>
  <div class="lp-socials">${c.insta ? `<a href="https://instagram.com/${c.insta}" target="_blank" rel="noopener" aria-label="Instagram">${igSvg}</a>` : ''}${c.wa ? `<a href="https://wa.me/${c.wa}" target="_blank" rel="noopener" aria-label="WhatsApp">${waSvg}</a>` : ''}</div>
  <p class="lp-copy">${esc(d.footerNote || ('© 2026 ' + (d.brand || '')))}</p>
</div></footer>
${waFloat(c.wa)}
${baseScript(c.wa)}
</body></html>`;
}

// ---- TEMAS ---------------------------------------------------------------

const THEMES = {
  // Editorial de luxo: claro, serifada, muito respiro, filetes finos
  editorial: {
    fonts: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Jost:wght@300;400;500;600&display=swap',
    bodyFont: "'Jost',sans-serif", titleFont: "'Cormorant Garamond',serif", titleWeight: 600, titleLh: '1.02', titleTrack: '-.01em', h1max: '104px', h2max: '64px', storyCols: 3, maxw: '1180px',
    accent: s => s.deep, accent2: s => s.accent,
    heroFx: '<div class="ed-rule"></div>',
    css: `
.lp-body{background:#f6f2ea;color:#20180f}
.lp-header.scrolled{background:rgba(246,242,234,.88);backdrop-filter:blur(10px);border-bottom:1px solid rgba(32,24,15,.1)}
.lp-brand .b1{font-family:'Cormorant Garamond',serif;font-weight:700;font-size:24px;letter-spacing:.01em}
.lp-accent{font-style:italic;color:var(--accent)}
.lp-nav a{position:relative;font-weight:500;opacity:.75}.lp-nav a:hover{opacity:1}
.lp-cta{border:1px solid #20180f;border-radius:0;letter-spacing:.04em}.lp-cta:hover{background:#20180f;color:#f6f2ea}
.lp-mnav{background:#f6f2ea}
.lp-hero h1{font-style:normal}.lp-hero .lp-sub{font-weight:300;font-size:clamp(17px,2.2vw,21px)}
.ed-rule{position:absolute;top:0;left:50%;width:1px;height:100%;background:linear-gradient(180deg,transparent,rgba(32,24,15,.12) 30%,rgba(32,24,15,.12) 70%,transparent);z-index:1}
.lp-btn-primary{background:#20180f;color:#f6f2ea;border-radius:0}.lp-btn-primary:hover{background:var(--accent)}
.lp-btn-ghost{border:1px solid rgba(32,24,15,.35);border-radius:0}.lp-btn-ghost:hover{border-color:#20180f}
.lp-eyebrow{color:var(--accent)}
.lp-sobre{border-top:1px solid rgba(32,24,15,.1)}
.lp-scene{border-top:2px solid #20180f;padding:26px 0 8px}
.lp-scene h3{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:27px}
.lp-svc{border:1px solid rgba(32,24,15,.16);background:#fffdf8}.lp-svc.feat{border-color:var(--accent);box-shadow:0 20px 50px -30px rgba(32,24,15,.5)}
.lp-svc-price{font-family:'Cormorant Garamond',serif}
.lp-visit{background:#efe8dc}
.lp-map{border:1px solid rgba(32,24,15,.16);background:#fffdf8;color:#20180f}
.lp-form{background:#fffdf8;border:1px solid rgba(32,24,15,.16)}
.lp-form input,.lp-form select{background:#fff;border:1px solid rgba(32,24,15,.22);border-radius:0}
.lp-form input:focus,.lp-form select:focus{border-color:var(--accent)}
.lp-footer{background:#20180f;color:#f6f2ea}.lp-footer .lp-eyebrow,.lp-footer .lp-copy{color:#cfc3b0}
`,
  },

  // Bold / neo-brutalist: contraste alto, bordas grossas, sombra dura
  bold: {
    fonts: 'https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=Archivo+Narrow:wght@500;600;700&display=swap',
    bodyFont: "'Archivo Narrow',sans-serif", titleFont: "'Archivo',sans-serif", titleWeight: 900, titleLh: '.92', titleTrack: '-.03em', h1max: '104px', h2max: '66px', storyCols: 3, maxw: '1160px',
    accent: s => s.accent, accent2: s => s.deep,
    css: `
.lp-body{background:#f5f1e8;color:#141210}
.lp-header.scrolled{background:#f5f1e8;border-bottom:3px solid #141210}
.lp-brand .b1{font-family:'Archivo',sans-serif;font-weight:900;text-transform:uppercase;letter-spacing:-.02em}
.lp-accent{background:var(--accent);color:#141210;padding:0 .12em}
.lp-cta{background:var(--accent);color:#141210;border:2.5px solid #141210;font-weight:800;text-transform:uppercase;box-shadow:4px 4px 0 #141210;transition:.12s}
.lp-cta:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 #141210}
.lp-mnav{background:var(--accent);color:#141210}
.lp-hero{border-bottom:3px solid #141210}
.lp-hero h1{text-transform:uppercase}
.lp-hero h1 .lp-accent{display:inline-block}
.lp-btn{border:2.5px solid #141210;font-weight:800;text-transform:uppercase;box-shadow:5px 5px 0 #141210;transition:.12s}
.lp-btn:hover{transform:translate(-2px,-2px);box-shadow:7px 7px 0 #141210}
.lp-btn-primary{background:#141210;color:var(--accent)}
.lp-btn-ghost{background:#f5f1e8;color:#141210}
.lp-eyebrow{background:#141210;color:var(--accent);padding:5px 12px;letter-spacing:.14em}
.lp-sec{border-bottom:3px solid #141210}
.lp-sec-head h2{text-transform:uppercase}
.lp-scene{border:2.5px solid #141210;background:#fff;box-shadow:6px 6px 0 #141210}
.lp-scene .lp-num{color:var(--accent);-webkit-text-stroke:2px #141210;opacity:1}
.lp-scene h3{text-transform:uppercase;font-family:'Archivo',sans-serif;font-weight:800}
.lp-services{background:var(--accent)}
.lp-services .lp-eyebrow{background:#141210;color:var(--accent)}
.lp-svc{border:2.5px solid #141210;background:#f5f1e8;box-shadow:6px 6px 0 #141210}
.lp-svc.feat{background:#141210;color:#f5f1e8}.lp-svc.feat .lp-svc-price,.lp-svc.feat .lp-svc-cta{color:var(--accent)}
.lp-svc-badge{border:2px solid #141210;color:#141210;background:#fff}
.lp-svc-name{text-transform:uppercase;font-family:'Archivo',sans-serif;font-weight:800}
.lp-map{border:2.5px solid #141210;background:#fff;color:#141210;box-shadow:6px 6px 0 #141210}
.lp-form{background:#fff;border:2.5px solid #141210;box-shadow:8px 8px 0 #141210}
.lp-form input,.lp-form select{background:#f5f1e8;border:2px solid #141210;border-radius:0}
.lp-footer{background:#141210;color:#f5f1e8}.lp-footer .lp-brand .b1{color:#f5f1e8}
`,
  },

  // Glass / aurora: escuro, vidro, gradientes neon — cara de SaaS
  glass: {
    fonts: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap',
    bodyFont: "'Inter',sans-serif", titleFont: "'Space Grotesk',sans-serif", titleWeight: 700, titleLh: '1', titleTrack: '-.03em', h1max: '92px', h2max: '58px', storyCols: 3, maxw: '1160px',
    accent: s => s.accent, accent2: s => s.deep,
    heroFx: '<div class="gl-blob b1"></div><div class="gl-blob b2"></div><div class="gl-grid"></div>',
    css: `
.lp-body{background:#070912;color:#e8ecf6}
.lp-header.scrolled{background:rgba(7,9,18,.7);backdrop-filter:blur(14px);border-bottom:1px solid rgba(255,255,255,.08)}
.lp-brand .b1{color:#fff}.lp-accent{background:linear-gradient(90deg,var(--accent),var(--accent-2));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.lp-nav a{opacity:.7}.lp-nav a:hover{opacity:1}
.lp-cta{border-radius:11px;background:linear-gradient(120deg,var(--accent),var(--accent-2));color:#fff;box-shadow:0 8px 26px -8px var(--accent)}
.lp-mnav{background:rgba(7,9,18,.96);backdrop-filter:blur(14px)}
.lp-hero{background:radial-gradient(120% 90% at 80% -10%,color-mix(in srgb,var(--accent) 26%,transparent),transparent 55%),#070912}
.gl-blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:.5;z-index:0}
.gl-blob.b1{width:520px;height:520px;background:var(--accent);top:-120px;right:-80px}
.gl-blob.b2{width:460px;height:460px;background:var(--accent-2);bottom:-140px;left:-100px;opacity:.4}
.gl-grid{position:absolute;inset:0;z-index:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:52px 52px;mask-image:radial-gradient(circle at 50% 40%,#000,transparent 75%)}
.lp-hero .lp-sub{color:#aeb7cc}
.lp-btn{border-radius:11px}
.lp-btn-primary{background:linear-gradient(120deg,var(--accent),var(--accent-2));color:#fff;box-shadow:0 10px 30px -10px var(--accent)}
.lp-btn-primary:hover{transform:translateY(-2px)}
.lp-btn-ghost{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.04);backdrop-filter:blur(8px);color:#e8ecf6}
.lp-btn-ghost:hover{border-color:var(--accent)}
.lp-eyebrow{color:var(--accent)}
.lp-sec-head p{color:#aeb7cc}
.lp-scene{border-radius:18px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);backdrop-filter:blur(10px)}
.lp-scene:hover{border-color:color-mix(in srgb,var(--accent) 55%,transparent)}
.lp-scene p{color:#aeb7cc}
.lp-svc{border-radius:18px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);backdrop-filter:blur(10px)}
.lp-svc.feat{border-color:var(--accent);background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 14%,transparent),rgba(255,255,255,.03))}
.lp-svc-desc{color:#aeb7cc}
.lp-visit{background:linear-gradient(180deg,#070912,#0b0f1c)}
.lp-map{border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:#e8ecf6}
.lp-info p,.lp-contact{color:#aeb7cc}
.lp-form{border-radius:18px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(12px)}
.lp-form input,.lp-form select{border-radius:10px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.14);color:#e8ecf6}
.lp-form input:focus,.lp-form select:focus{border-color:var(--accent)}
.lp-footer{background:#05070e;border-top:1px solid rgba(255,255,255,.07)}
`,
  },

  // Boutique quente: tons terrosos, cantos suaves, aconchego artesanal
  boutique: {
    fonts: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Nunito+Sans:wght@300;400;600;700&display=swap',
    bodyFont: "'Nunito Sans',sans-serif", titleFont: "'Fraunces',serif", titleWeight: 600, titleLh: '1', titleTrack: '-.015em', h1max: '92px', h2max: '58px', storyCols: 3, maxw: '1140px',
    accent: s => s.deep, accent2: s => s.accent,
    heroFx: '<div class="bt-blob"></div>',
    css: `
.lp-body{background:#f4ebdd;color:#3b2d22}
.lp-header.scrolled{background:rgba(244,235,221,.9);backdrop-filter:blur(10px)}
.lp-brand .b1{font-family:'Fraunces',serif;font-weight:700}
.lp-accent{color:var(--accent-2);font-style:italic}
.lp-cta{background:var(--accent);color:#fff;border-radius:999px}.lp-cta:hover{filter:brightness(1.08)}
.lp-mnav{background:#f4ebdd}
.lp-hero{background:radial-gradient(120% 100% at 90% 0%,color-mix(in srgb,var(--accent-2) 18%,transparent),transparent 60%)}
.bt-blob{position:absolute;width:480px;height:480px;border-radius:47% 53% 60% 40%/45% 55% 45% 55%;background:color-mix(in srgb,var(--accent-2) 20%,transparent);top:-120px;right:-120px;filter:blur(20px);z-index:0}
.lp-hero .lp-sub{color:#6a5443}
.lp-btn{border-radius:999px}
.lp-btn-primary{background:var(--accent);color:#fff}.lp-btn-primary:hover{filter:brightness(1.08)}
.lp-btn-ghost{border:1.5px solid color-mix(in srgb,var(--accent) 40%,transparent);color:#3b2d22}.lp-btn-ghost:hover{border-color:var(--accent)}
.lp-eyebrow{color:var(--accent-2)}
.lp-scene{background:#fbf5ea;border-radius:22px;border:1px solid rgba(59,45,34,.1);box-shadow:0 24px 50px -34px rgba(59,45,34,.5)}
.lp-scene h3{font-family:'Fraunces',serif;font-weight:600;font-size:24px}
.lp-scene .lp-num{font-family:'Fraunces',serif;color:var(--accent-2);opacity:.5}
.lp-services{background:#efe3d1}
.lp-svc{background:#fbf5ea;border-radius:22px;border:1px solid rgba(59,45,34,.1)}
.lp-svc.feat{border-color:var(--accent);box-shadow:0 26px 54px -34px rgba(59,45,34,.6)}
.lp-svc-badge{border-radius:999px}
.lp-svc-price{font-family:'Fraunces',serif}
.lp-map{border-radius:26px;background:#fbf5ea;border:1px solid rgba(59,45,34,.12);color:#3b2d22}
.lp-form{background:#fbf5ea;border-radius:26px;border:1px solid rgba(59,45,34,.12)}
.lp-form input,.lp-form select{background:#fff;border:1px solid rgba(59,45,34,.18);border-radius:12px}
.lp-form input:focus,.lp-form select:focus{border-color:var(--accent)}
.lp-footer{background:#2f241b;color:#f4ebdd}.lp-footer .lp-copy{color:#c9b7a3}
`,
  },

  // Corporate clean: claro, azul confiável, grid, sombras sutis
  corporate: {
    fonts: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
    bodyFont: "'Plus Jakarta Sans',sans-serif", titleFont: "'Plus Jakarta Sans',sans-serif", titleWeight: 800, titleLh: '1.04', titleTrack: '-.03em', h1max: '80px', h2max: '52px', storyCols: 3, maxw: '1180px',
    accent: s => s.accent, accent2: s => s.deep,
    heroFx: '<div class="co-mesh"></div>',
    css: `
.lp-body{background:#f7f9fc;color:#0f1b2d}
.lp-header.scrolled{background:rgba(247,249,252,.9);backdrop-filter:blur(10px);border-bottom:1px solid #e3e9f2}
.lp-brand .b1{color:#0f1b2d}.lp-accent{color:var(--accent)}
.lp-nav a{opacity:.7}.lp-nav a:hover{opacity:1;color:var(--accent)}
.lp-cta{background:var(--accent);color:#fff;border-radius:9px;box-shadow:0 8px 20px -8px var(--accent)}
.lp-mnav{background:#f7f9fc}
.lp-hero{background:linear-gradient(180deg,#fff,#f7f9fc)}
.co-mesh{position:absolute;inset:0;z-index:0;background:radial-gradient(60% 50% at 85% 0%,color-mix(in srgb,var(--accent) 12%,transparent),transparent 70%)}
.lp-hero .lp-sub{color:#4a5b70}
.lp-btn{border-radius:9px}
.lp-btn-primary{background:var(--accent);color:#fff;box-shadow:0 10px 26px -10px var(--accent)}.lp-btn-primary:hover{transform:translateY(-2px)}
.lp-btn-ghost{border:1px solid #d4deec;background:#fff;color:#0f1b2d}.lp-btn-ghost:hover{border-color:var(--accent);color:var(--accent)}
.lp-eyebrow{color:var(--accent)}
.lp-sec-head p{color:#4a5b70}
.lp-scene{background:#fff;border-radius:16px;border:1px solid #e3e9f2;box-shadow:0 16px 40px -30px rgba(15,27,45,.4)}
.lp-scene:hover{border-color:color-mix(in srgb,var(--accent) 45%,transparent);transform:translateY(-3px)}
.lp-scene .lp-num{color:var(--accent);opacity:.32}
.lp-scene p{color:#4a5b70}
.lp-svc{background:#fff;border-radius:16px;border:1px solid #e3e9f2;box-shadow:0 16px 40px -30px rgba(15,27,45,.4)}
.lp-svc.feat{border-color:var(--accent);box-shadow:0 22px 48px -26px color-mix(in srgb,var(--accent) 60%,transparent)}
.lp-svc-desc{color:#4a5b70}
.lp-svc-badge{border-radius:6px}
.lp-visit{background:#eef3f9}
.lp-map{border-radius:16px;background:#fff;border:1px solid #e3e9f2;color:#0f1b2d}
.lp-info p,.lp-contact{color:#4a5b70}
.lp-form{background:#fff;border-radius:16px;border:1px solid #e3e9f2;box-shadow:0 24px 60px -40px rgba(15,27,45,.5)}
.lp-form input,.lp-form select{background:#f7f9fc;border:1px solid #d4deec;border-radius:9px}
.lp-form input:focus,.lp-form select:focus{border-color:var(--accent);background:#fff}
.lp-footer{background:#0f1b2d;color:#e8eef7}.lp-footer .lp-brand .b1{color:#fff}.lp-footer .lp-copy{color:#93a4bd}
`,
  },
};

function renderStyled(styleKey, data) {
  const d = data || {};
  if (styleKey === 'cinema' || !styleKey) return renderLanding(d);
  const theme = THEMES[styleKey];
  if (!theme) return renderLanding(d);
  return shell(d, theme);
}

// ---- catálogo + recomendação --------------------------------------------

const LANDING_STYLES = [
  { key: 'cinema',    label: 'Cinema',          tagline: 'Scroll imersivo, dark e cinematográfico — impacto máximo.',         vibe: 'dark',  bestFor: ['Gastronomia', 'Barbearia', 'Estética premium', 'Fitness'] },
  { key: 'editorial', label: 'Editorial Luxo',  tagline: 'Serifada, muito respiro, ar de revista sofisticada.',              vibe: 'light', bestFor: ['Advocacia', 'Imóveis alto padrão', 'Clínica estética', 'Arquitetura'] },
  { key: 'bold',      label: 'Bold',            tagline: 'Cores fortes, blocos e sombra dura — energia jovem.',              vibe: 'light', bestFor: ['Academia', 'E-commerce', 'Hamburgueria', 'Infoproduto'] },
  { key: 'glass',     label: 'Glass / Aurora',  tagline: 'Vidro, gradientes e neon — cara de tech / SaaS.',                  vibe: 'dark',  bestFor: ['Finanças', 'Apps', 'Tecnologia', 'Serviços digitais'] },
  { key: 'boutique',  label: 'Boutique Quente', tagline: 'Tons terrosos, cantos suaves e aconchego artesanal.',             vibe: 'light', bestFor: ['Cafeteria', 'Pet', 'Floricultura', 'Moda / Slow'] },
  { key: 'corporate', label: 'Corporate Clean', tagline: 'Clean, azul confiável e direto — B2B e saúde.',                    vibe: 'light', bestFor: ['Odontologia', 'Contabilidade', 'Consultório', 'Imobiliária'] },
];

const NICHE_TO_STYLE = {
  medico: 'corporate', advogado: 'editorial', dentista: 'corporate', imoveis: 'editorial',
  financas: 'glass', fitness: 'bold', beleza: 'cinema', petshop: 'boutique',
  gastronomia: 'cinema', infoproduto: 'glass', ecommerce: 'bold', generico: 'corporate',
};

// atalhos diretos p/ segmentos que o nicheOf não cobre (checados antes do nicho)
const KEYWORD_STYLE = [
  [/cafe|cafeteria|padaria|confeitaria|floricultura|floral|artesanal|brecho|decor|ceramic|moda\b|slow|boutique/, 'boutique'],
  [/hamburgueria|burger|lanche|pizzaria|pizza|acai|sorveteria|doceria|hortifruti/, 'bold'],
  [/tech|software|startup|saas|app\b|aplicativo|sistema|digital|dev|automacao|marketing digital|agencia/, 'glass'],
  [/financ|contabil|contador|seguros|investimento|consultoria|corporativ|juridic|advoc/, 'corporate'],
  [/joalheria|joias|arquitet|interiores|luxo|premium|alto padrao|griffe|atelier/, 'editorial'],
];

function recommendStyle(cliente) {
  const c = cliente || {};
  const txt = `${c.segmento || ''} ${c.observacao || ''} ${c.publico || ''}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const n = nicheOf(txt);
  if (n !== 'generico') return { estilo: NICHE_TO_STYLE[n] || 'corporate', niche: n };
  for (const [re, estilo] of KEYWORD_STYLE) { if (re.test(txt)) return { estilo, niche: n }; }
  return { estilo: 'corporate', niche: n };
}

module.exports = { renderStyled, LANDING_STYLES, recommendStyle, THEMES };
