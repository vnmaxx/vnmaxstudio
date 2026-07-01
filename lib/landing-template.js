'use strict';

const PALETTES = {
  barber:  { ink:'#0a0e0b', ink2:'#0e1310', panel:'#131a15', bone:'#f2ecdd', boneDim:'#c9bfa8', gray:'#a9a595', accent:'#d6a24a', accentLite:'#ecc06a', deep:'#1c5a3e', deep2:'#0f3a29', leather:'#9a3f2c' },
  clinic:  { ink:'#080f14', ink2:'#0b141b', panel:'#0f1a22', bone:'#eaf4f6', boneDim:'#b6ccd2', gray:'#8fa6ad', accent:'#2dd4bf', accentLite:'#5eead4', deep:'#0e7490', deep2:'#083344', leather:'#0369a1' },
  beauty:  { ink:'#120a10', ink2:'#180d15', panel:'#1e121b', bone:'#f6ecf2', boneDim:'#d6bcc9', gray:'#ab97a2', accent:'#e879a6', accentLite:'#f5b0cd', deep:'#7c3aed', deep2:'#3b1a6b', leather:'#be185d' },
  food:    { ink:'#140c08', ink2:'#1a110b', panel:'#20150e', bone:'#f7ecdd', boneDim:'#d9c3a6', gray:'#b09a80', accent:'#f59e0b', accentLite:'#fbbf24', deep:'#b91c1c', deep2:'#7f1d1d', leather:'#c2410c' },
  fitness: { ink:'#080c10', ink2:'#0b1016', panel:'#0f151c', bone:'#eef4f2', boneDim:'#bcccc6', gray:'#8ba099', accent:'#a3e635', accentLite:'#bef264', deep:'#0891b2', deep2:'#075985', leather:'#15803d' },
  pro:     { ink:'#090c12', ink2:'#0c1119', panel:'#101725', bone:'#eef1f6', boneDim:'#c2cad9', gray:'#95a0b3', accent:'#c9a86a', accentLite:'#e0c68d', deep:'#1e3a5f', deep2:'#122437', leather:'#334e68' },
  generic: { ink:'#0a0e12', ink2:'#0d131a', panel:'#111823', bone:'#eef2f7', boneDim:'#c0ccd9', gray:'#93a1b0', accent:'#3b82f6', accentLite:'#60a5fa', deep:'#1e40af', deep2:'#152a63', leather:'#0e7490' },
};

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function nl(s) { return esc(s).replace(/\\n|\n/g, '<br>'); }
function digits(s) { const d = String(s || '').replace(/\D/g, ''); if (!d) return ''; return d.length > 11 ? d : '55' + d; }

function paletteCss(p) {
  return `--ink:${p.ink};--ink-2:${p.ink2};--panel:${p.panel};--bone:${p.bone};--bone-dim:${p.boneDim};--gray:${p.gray};--gold:${p.accent};--gold-lite:${p.accentLite};--gold-btn:${p.accent};--pitch:${p.deep};--pitch-2:${p.deep2};--leather:${p.leather};--line:rgba(242,236,221,0.12);--line-2:rgba(242,236,221,0.22);--ease:cubic-bezier(.22,.61,.36,1);`;
}

function sceneLayers(p, i, total) {
  const posA = 20 + (i * 60) % 60;
  const g0 = `radial-gradient(ellipse 130% 90% at ${posA}% ${i % 2 ? 78 : 12}%, ${p.accentLite} 0%, ${p.accent} 16%, ${p.deep} 44%, ${p.deep2} 70%, ${p.ink} 100%)`;
  const g2 = `radial-gradient(circle at ${30 + (i * 23) % 50}% ${40 + (i * 17) % 30}%, ${p.accentLite}55, transparent 34%), radial-gradient(circle at ${60 - (i * 13) % 40}% ${60 + (i * 11) % 20}%, ${p.deep}66, transparent 40%)`;
  return `
      <div class="layer" data-depth="0.2" style="background:${g0};"></div>
      <div class="layer" data-depth="0.55" style="opacity:0.5; background:repeating-linear-gradient(${45 + i * 20}deg, rgba(255,255,255,0.035) 0 1px, transparent 1px ${40 + i * 6}px), repeating-linear-gradient(0deg, rgba(0,0,0,0.10) 0 1px, transparent 1px 60px);"></div>
      <div class="layer" data-depth="0.9" style="background:${g2};"></div>
      <div class="layer" data-depth="0" style="background:linear-gradient(180deg, transparent 46%, rgba(0,0,0,0.5) 72%, rgba(0,0,0,0.92) 100%), linear-gradient(${i % 2 ? 270 : 90}deg, rgba(0,0,0,0.55) 6%, transparent 46%);"></div>`;
}

function heroScene(d, p) {
  const brand = esc(d.brand || 'Sua Marca');
  const acc = d.brandAccent ? String(d.brand || '').replace(d.brandAccent, `<span>${esc(d.brandAccent)}</span>`) : brand;
  return `
    <div class="scene" id="top" data-label="Início">
      ${sceneLayers(p, 0, 1)}
      <div class="scene-copy pos-center">
        ${d.eyebrow ? `<span class="eyebrow">${esc(d.eyebrow)}</span>` : ''}
        <h1 class="display hero-title"><span class="l1">${acc}</span>${d.tagline ? `<span class="hero-script">${esc(d.tagline)}</span>` : ''}</h1>
        ${d.sub ? `<p class="hero-sub">${esc(d.sub)}</p>` : ''}
        ${d.rating ? `<div class="rating"><span class="stars">★★★★★</span><span>${esc(d.rating)}</span></div>` : ''}
        <div class="btn-row"><button class="cta cta-solid" data-action="book">${esc(d.ctaLabel || 'Agendar agora')}</button></div>
      </div>
      <div class="scroll-hint" id="scrollHint"><span>Role para descobrir</span><div class="bar"></div></div>
    </div>`;
}

function storyScene(s, p, i, total) {
  const pos = ['left', 'right', 'center'].includes(s.pos) ? s.pos : (i % 2 ? 'right' : 'left');
  return `
    <div class="scene" data-label="${esc(s.label || s.eyebrow || 'Cena')}">
      ${sceneLayers(p, i, total)}
      <div class="scene-copy pos-${pos}">
        ${s.eyebrow ? `<span class="eyebrow">${esc(s.eyebrow)}</span>` : ''}
        <h2>${nl(s.title)}</h2>
        ${s.body ? `<p class="body">${esc(s.body)}</p>` : ''}
      </div>
    </div>`;
}

function finalScene(d, p, total) {
  const wa = digits(d.whatsapp || d.phone);
  return `
    <div class="scene" data-label="${esc(d.finalEyebrow || 'Agende')}">
      ${sceneLayers(p, total, total)}
      <div class="scene-copy pos-center">
        ${d.finalEyebrow ? `<span class="eyebrow">${esc(d.finalEyebrow)}</span>` : ''}
        <h2>${nl(d.finalTitle || 'Garanta seu\\nHorário')}</h2>
        <div class="btn-row"><button class="cta cta-solid" data-action="book">${esc(d.ctaLabel || 'Agendar agora')}</button>${d.phone ? `<a href="tel:${esc(d.phone)}" class="cta cta-ghost">Ligar ${esc(d.phone)}</a>` : (wa ? `<a href="https://wa.me/${wa}" class="cta cta-ghost">WhatsApp</a>` : '')}</div>
      </div>
    </div>`;
}

function serviceCard(s) {
  const price = s.price ? (String(s.price).match(/^[\d.,]+$/) ? `R$ ${s.price}` : esc(s.price)) : '';
  return `<div class="svc rv${s.featured ? ' feature' : ''}">${s.badge ? `<span class="svc-badge">${esc(s.badge)}</span>` : ''}<div class="svc-top"><span class="svc-name">${esc(s.name)}</span>${price ? `<span class="svc-price">${price}</span>` : ''}</div>${s.desc ? `<p class="svc-desc">${esc(s.desc)}</p>` : ''}<button class="svc-book" data-action="book">Quero este →</button></div>`;
}

function renderLanding(input) {
  const d = input || {};
  const p = PALETTES[d.paletteKey] || PALETTES.generic;
  const scenes = (Array.isArray(d.scenes) ? d.scenes : []).slice(0, 6);
  const services = (Array.isArray(d.services) ? d.services : []).slice(0, 6);
  const wa = digits(d.whatsapp || d.phone);
  const brandLine = d.brandAccent ? String(d.brand || '').replace(d.brandAccent, `<span>${esc(d.brandAccent)}</span>`) : esc(d.brand || 'Sua Marca');
  const totalJourney = 1 + scenes.length + 1;
  const mapQ = encodeURIComponent(String(d.address || d.brand || '').replace(/\\n|\n/g, ' '));

  const storyHtml = scenes.map((s, i) => storyScene(s, p, i + 1, totalJourney)).join('\n');
  const servicesHtml = services.map(serviceCard).join('\n');
  const serviceOptions = services.map(s => `<option>${esc(s.name)}</option>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(d.brand || 'Landing')}${d.metaSuffix ? ' — ' + esc(d.metaSuffix) : ''}</title>
<meta name="description" content="${esc(d.metaDescription || d.sub || d.brand || '')}">
<meta property="og:title" content="${esc(d.brand || '')}">
<meta property="og:description" content="${esc(d.metaDescription || d.sub || '')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow:wght@300;400;500;600&family=Barlow+Semi+Condensed:wght@500;600&family=Dancing+Script:wght@600;700&display=swap" rel="stylesheet">
<style>
  :root{ ${paletteCss(p)} }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{ background:var(--ink); color:var(--bone); font-family:'Barlow',sans-serif; line-height:1.5; overflow-x:hidden; -webkit-font-smoothing:antialiased; }
  a{ color:inherit; text-decoration:none; } ul{ list-style:none; } button{ font-family:inherit; cursor:pointer; } svg{ display:block; }
  .display{ font-family:'Anton',sans-serif; font-weight:400; letter-spacing:0.01em; line-height:0.9; text-transform:uppercase; }
  .eyebrow{ font-family:'Barlow Semi Condensed',sans-serif; font-weight:600; text-transform:uppercase; letter-spacing:0.32em; font-size:12px; color:var(--gold); }
  #progress{ position:fixed; top:0; left:0; height:3px; width:0%; z-index:90; background:linear-gradient(90deg,var(--pitch),var(--gold-lite)); box-shadow:0 0 12px rgba(214,162,74,0.5); }
  header{ position:fixed; top:0; left:0; right:0; z-index:80; display:flex; align-items:center; justify-content:space-between; padding:18px 22px; transition:background .3s var(--ease),padding .3s var(--ease); }
  @media(min-width:720px){ header{ padding:20px 44px; } }
  header.scrolled{ background:color-mix(in srgb, var(--ink) 86%, transparent); backdrop-filter:blur(12px); padding:11px 22px; border-bottom:1px solid var(--line); }
  .brand{ display:flex; align-items:center; gap:10px; }
  .brand .crest{ width:34px; height:34px; flex-shrink:0; }
  .brand .btxt{ display:flex; flex-direction:column; line-height:1; }
  .brand .b1{ font-family:'Anton',sans-serif; font-size:19px; letter-spacing:0.02em; color:var(--bone); text-transform:uppercase; }
  .brand .b1 span{ color:var(--gold-lite); }
  .brand .b2{ font-family:'Barlow Semi Condensed',sans-serif; font-weight:600; font-size:9px; letter-spacing:0.30em; color:var(--gray); margin-top:3px; }
  nav.pnav{ display:none; align-items:center; gap:30px; } @media(min-width:900px){ nav.pnav{ display:flex; } }
  nav.pnav a{ font-family:'Barlow Semi Condensed',sans-serif; font-weight:600; font-size:13px; text-transform:uppercase; letter-spacing:0.16em; color:var(--bone-dim); transition:color .25s; }
  nav.pnav a:hover{ color:var(--bone); }
  .book-btn{ display:inline-flex; align-items:center; font-family:'Barlow Semi Condensed',sans-serif; font-weight:600; font-size:13px; text-transform:uppercase; letter-spacing:0.14em; padding:11px 22px; background:var(--gold-btn); color:#111; border:none; border-radius:3px; transition:background .25s,transform .25s; }
  .book-btn:hover{ background:var(--gold-lite); transform:translateY(-1px); }
  .hdr-right{ display:flex; align-items:center; gap:18px; }
  .menu-toggle{ display:flex; flex-direction:column; gap:5px; width:26px; padding:6px 0; background:none; border:none; } @media(min-width:900px){ .menu-toggle{ display:none; } }
  .menu-toggle span{ display:block; height:2px; width:100%; background:var(--bone); transition:.3s var(--ease); }
  .menu-toggle.open span:nth-child(1){ transform:translateY(7px) rotate(45deg); }
  .menu-toggle.open span:nth-child(2){ opacity:0; }
  .menu-toggle.open span:nth-child(3){ transform:translateY(-7px) rotate(-45deg); }
  .mnav{ position:fixed; inset:0; z-index:85; background:var(--ink); display:flex; flex-direction:column; justify-content:center; gap:8px; padding:32px; opacity:0; pointer-events:none; transition:opacity .35s var(--ease); }
  .mnav.open{ opacity:1; pointer-events:auto; }
  .mnav a{ font-family:'Anton',sans-serif; font-size:34px; text-transform:uppercase; padding:8px 0; }
  .mnav .book-btn{ margin-top:20px; align-self:flex-start; font-size:15px; padding:14px 28px; }
  .dotnav{ position:fixed; right:20px; top:50%; transform:translateY(-50%); z-index:75; display:none; flex-direction:column; gap:13px; } @media(min-width:820px){ .dotnav{ display:flex; } }
  .dotnav button{ width:9px; height:9px; border-radius:50%; background:transparent; border:1.5px solid rgba(242,236,221,0.4); padding:0; transition:all .3s var(--ease); }
  .dotnav button:hover{ border-color:var(--gold); }
  .dotnav button.active{ background:var(--gold); border-color:var(--gold); transform:scale(1.25); box-shadow:0 0 10px rgba(214,162,74,0.55); }
  .vignette{ position:fixed; inset:0; z-index:12; pointer-events:none; box-shadow:inset 0 0 220px 60px rgba(0,0,0,0.7); }
  .journey{ position:relative; }
  .stage{ position:sticky; top:0; height:100svh; overflow:hidden; background:var(--ink); perspective:1200px; }
  .scene{ position:absolute; inset:0; will-change:transform,opacity; transform-origin:center center; backface-visibility:hidden; }
  .layer{ position:absolute; inset:-6%; will-change:transform; }
  .scene-copy{ position:absolute; z-index:6; padding:0 26px; max-width:640px; will-change:transform,opacity; }
  @media(min-width:720px){ .scene-copy{ padding:0 64px; max-width:720px; } }
  .scene-copy.pos-left{ left:0; top:50%; transform:translateY(-50%); text-align:left; }
  .scene-copy.pos-right{ right:0; top:50%; text-align:right; }
  .scene-copy.pos-center{ left:50%; top:50%; transform:translate(-50%,-50%); text-align:center; max-width:860px; }
  .scene-copy .eyebrow{ display:inline-block; margin-bottom:18px; }
  .scene-copy h2{ font-family:'Anton',sans-serif; text-transform:uppercase; line-height:0.9; font-size:clamp(48px,11vw,128px); color:var(--bone); text-shadow:0 3px 0 rgba(0,0,0,0.3), 0 22px 60px rgba(0,0,0,0.7); }
  .scene-copy .body{ margin-top:20px; max-width:440px; color:var(--bone-dim); font-weight:300; font-size:16px; line-height:1.6; text-shadow:0 2px 22px rgba(0,0,0,0.9); }
  .pos-right .body{ margin-left:auto; } .pos-center .body{ margin:20px auto 0; }
  .hero-title .l1{ display:block; font-size:clamp(52px,14vw,150px); } .hero-title .l1 span{ color:var(--gold-lite); }
  .hero-script{ font-family:'Dancing Script',cursive; font-weight:700; font-size:clamp(30px,6vw,64px); color:var(--gold-lite); display:block; margin-top:4px; }
  .hero-sub{ margin-top:22px; font-family:'Barlow Semi Condensed',sans-serif; font-weight:500; letter-spacing:0.06em; font-size:clamp(15px,2vw,19px); color:var(--bone-dim); }
  .rating{ display:inline-flex; align-items:center; gap:8px; margin-top:18px; font-family:'Barlow Semi Condensed',sans-serif; font-weight:600; font-size:13px; letter-spacing:0.08em; color:var(--gold-lite); }
  .rating .stars{ letter-spacing:2px; }
  .btn-row{ display:flex; flex-wrap:wrap; gap:14px; margin-top:30px; } .pos-center .btn-row{ justify-content:center; }
  .cta{ display:inline-flex; align-items:center; gap:9px; font-family:'Barlow Semi Condensed',sans-serif; font-weight:600; font-size:14px; text-transform:uppercase; letter-spacing:0.14em; padding:15px 30px; border-radius:3px; transition:all .28s var(--ease); }
  .cta-solid{ background:var(--gold-btn); color:#111; border:1px solid var(--gold-btn); } .cta-solid:hover{ background:var(--gold-lite); border-color:var(--gold-lite); transform:translateY(-2px); }
  .cta-ghost{ background:rgba(0,0,0,0.28); color:var(--bone); border:1px solid var(--line-2); backdrop-filter:blur(4px); } .cta-ghost:hover{ border-color:var(--gold); color:var(--gold-lite); }
  .scroll-hint{ position:absolute; bottom:26px; left:50%; transform:translateX(-50%); z-index:14; display:flex; align-items:center; gap:12px; font-family:'Barlow Semi Condensed',sans-serif; font-weight:600; font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color:rgba(242,236,221,0.55); transition:opacity .4s; }
  .scroll-hint .bar{ width:44px; height:1px; background:rgba(242,236,221,0.4); position:relative; overflow:hidden; }
  .scroll-hint .bar::after{ content:''; position:absolute; left:-100%; top:0; width:100%; height:100%; background:var(--gold-lite); animation:slideHint 2.2s ease-in-out infinite; }
  @keyframes slideHint{ 0%{left:-100%;} 60%{left:100%;} 100%{left:100%;} }
  .wrap{ max-width:1160px; margin:0 auto; padding:0 26px; } @media(min-width:720px){ .wrap{ padding:0 44px; } }
  section.vsec{ position:relative; z-index:14; padding:92px 0; background:var(--ink); } @media(min-width:720px){ section.vsec{ padding:120px 0; } }
  .sec-head{ text-align:center; max-width:640px; margin:0 auto 52px; }
  .sec-head h2{ font-size:clamp(38px,7vw,72px); color:var(--bone); margin-top:14px; }
  .sec-head p{ margin-top:14px; color:var(--gray); font-weight:300; font-size:15.5px; }
  .rv{ opacity:0; transform:translateY(28px); transition:opacity .8s var(--ease),transform .8s var(--ease); }
  .rv.in{ opacity:1; transform:translateY(0); }
  @media (prefers-reduced-motion: reduce){ .rv{ opacity:1 !important; transform:none !important; } html{scroll-behavior:auto;} }
  .menu-grid{ display:grid; grid-template-columns:1fr; gap:16px; } @media(min-width:680px){ .menu-grid{ grid-template-columns:1fr 1fr; } } @media(min-width:1000px){ .menu-grid{ grid-template-columns:1fr 1fr 1fr; } }
  .svc{ position:relative; background:var(--panel); border:1px solid var(--line); padding:24px 22px; transition:transform .35s var(--ease),border-color .35s; }
  .svc:hover{ transform:translateY(-5px); border-color:var(--line-2); }
  .svc.feature{ border-color:var(--gold); background:linear-gradient(180deg, color-mix(in srgb, var(--gold) 10%, transparent), transparent); }
  .svc-top{ display:flex; justify-content:space-between; align-items:baseline; gap:14px; }
  .svc-name{ font-family:'Barlow Semi Condensed',sans-serif; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; font-size:18px; }
  .svc-price{ font-family:'Anton',sans-serif; font-size:22px; color:var(--gold-lite); line-height:1; white-space:nowrap; }
  .svc-desc{ margin-top:11px; color:var(--gray); font-weight:300; font-size:13.5px; line-height:1.55; }
  .svc-book{ margin-top:16px; display:inline-flex; align-items:center; gap:6px; font-family:'Barlow Semi Condensed',sans-serif; font-weight:600; font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:var(--gold-lite); background:none; border:none; padding:0; }
  .svc-book:hover{ color:var(--gold); }
  .svc-badge{ position:absolute; top:-10px; left:22px; background:var(--gold); color:#111; font-family:'Barlow Semi Condensed',sans-serif; font-weight:600; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; padding:3px 10px; border-radius:2px; }
  .visit{ background:var(--ink-2); border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
  .visit-grid{ display:grid; grid-template-columns:1fr; gap:44px; align-items:center; } @media(min-width:900px){ .visit-grid{ grid-template-columns:1fr 1fr; gap:60px; } }
  .visit h2{ font-family:'Anton',sans-serif; text-transform:uppercase; font-size:clamp(44px,9vw,90px); line-height:0.9; margin-top:12px; color:var(--bone); }
  .info-cols{ display:grid; grid-template-columns:1fr 1fr; gap:26px; margin-top:30px; }
  .info-cols h4{ font-family:'Barlow Semi Condensed',sans-serif; font-weight:600; text-transform:uppercase; letter-spacing:0.2em; font-size:11px; color:var(--gold); margin-bottom:14px; }
  .info-cols p{ font-size:14px; color:var(--bone-dim); font-weight:300; }
  .contact-line{ display:flex; align-items:flex-start; gap:11px; font-size:14px; color:var(--bone-dim); margin-top:12px; }
  .contact-line svg{ width:16px; height:16px; margin-top:2px; color:var(--gold-lite); flex-shrink:0; }
  .visit-cta{ margin-top:28px; display:flex; flex-wrap:wrap; gap:12px; }
  .map-frame{ position:relative; border:1px solid var(--line); background:var(--panel); aspect-ratio:1/1; overflow:hidden; } @media(min-width:900px){ .map-frame{ aspect-ratio:4/5; } }
  .map-grid{ position:absolute; inset:0; opacity:0.4; background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px); background-size:34px 34px; }
  .map-road{ position:absolute; background:color-mix(in srgb, var(--gold) 14%, transparent); }
  .map-pin{ position:absolute; top:50%; left:50%; transform:translate(-50%,-100%); z-index:2; }
  .map-pin svg{ width:36px; height:36px; color:var(--leather); filter:drop-shadow(0 4px 10px rgba(0,0,0,0.6)); }
  .map-label{ position:absolute; bottom:16px; left:16px; z-index:2; font-family:'Barlow Semi Condensed',sans-serif; font-weight:600; font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:var(--gray); }
  .book{ background:var(--ink); }
  .book-grid{ display:grid; grid-template-columns:1fr; gap:40px; } @media(min-width:900px){ .book-grid{ grid-template-columns:1fr 1fr; gap:56px; align-items:center; } }
  .book h2{ font-family:'Anton',sans-serif; text-transform:uppercase; font-size:clamp(40px,8vw,84px); line-height:0.9; margin-top:12px; color:var(--bone); }
  .book p.lead{ margin-top:16px; color:var(--bone-dim); font-weight:300; font-size:15.5px; max-width:420px; }
  form.lead-form{ display:flex; flex-direction:column; gap:13px; background:var(--panel); border:1px solid var(--line); padding:26px; border-radius:6px; }
  form.lead-form label{ font-family:'Barlow Semi Condensed',sans-serif; font-weight:600; text-transform:uppercase; letter-spacing:0.1em; font-size:10.5px; color:var(--gold); }
  form.lead-form input, form.lead-form select, form.lead-form textarea{ width:100%; background:rgba(0,0,0,0.35); border:1px solid var(--line-2); border-radius:4px; color:var(--bone); font-family:inherit; font-size:15px; padding:12px 14px; outline:none; transition:border-color .2s; }
  form.lead-form input:focus, form.lead-form select:focus, form.lead-form textarea:focus{ border-color:var(--gold); }
  form.lead-form .field{ display:flex; flex-direction:column; gap:6px; }
  form.lead-form button{ margin-top:6px; justify-content:center; }
  .form-ok{ color:var(--gold-lite); font-weight:600; font-size:14px; margin-top:10px; }
  footer{ background:var(--ink); padding:60px 0 34px; text-align:center; position:relative; z-index:14; border-top:1px solid var(--line); }
  .foot-brand .b1{ font-family:'Anton',sans-serif; font-size:28px; color:var(--bone); text-transform:uppercase; } .foot-brand .b1 span{ color:var(--gold-lite); }
  .foot-brand .b2{ font-family:'Barlow Semi Condensed',sans-serif; font-weight:600; font-size:11px; letter-spacing:0.30em; color:var(--gray); margin-top:5px; }
  .foot-nav{ display:flex; flex-wrap:wrap; justify-content:center; gap:22px; margin:26px 0; }
  .foot-nav a{ font-family:'Barlow Semi Condensed',sans-serif; font-weight:600; font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:var(--bone-dim); transition:color .25s; }
  .foot-nav a:hover{ color:var(--gold-lite); }
  .foot-socials{ display:flex; justify-content:center; gap:18px; margin-bottom:22px; }
  .foot-socials a{ color:var(--gray); transition:color .25s; } .foot-socials a:hover{ color:var(--gold-lite); } .foot-socials svg{ width:18px; height:18px; }
  .foot-copy{ font-size:12px; color:var(--gray); }
  .wa-float{ position:fixed; right:18px; bottom:18px; z-index:88; width:56px; height:56px; border-radius:50%; background:#25d366; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 22px rgba(0,0,0,0.4); }
  .wa-float svg{ width:30px; height:30px; color:#fff; }
</style>
</head>
<body>
<div id="progress"></div>
<header id="siteHeader">
  <a href="#top" class="brand">
    <svg class="crest" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="18" stroke="var(--gold)" stroke-width="1.5"/><path d="M20 8 L23 15 L30 15 L24.5 19.5 L26.5 27 L20 22.5 L13.5 27 L15.5 19.5 L10 15 L17 15 Z" fill="var(--gold)" opacity="0.9"/></svg>
    <span class="btxt"><span class="b1">${brandLine}</span><span class="b2">${esc(d.brandSub || d.mapLabel || '')}</span></span>
  </a>
  <div class="hdr-right">
    <nav class="pnav"><a href="#services">Serviços</a><a href="#visit">Visite</a><a href="#agendar">Agendar</a></nav>
    <button class="book-btn" data-action="book">Agendar</button>
    <button class="menu-toggle" id="menuToggle" aria-label="Menu"><span></span><span></span><span></span></button>
  </div>
</header>
<div class="mnav" id="mnav"><a href="#services">Serviços</a><a href="#visit">Visite</a><a href="#agendar">Agendar</a><button class="book-btn" data-action="book">Agendar</button></div>
<div class="dotnav" id="dotnav"></div>

<div class="journey" id="journey" style="height:${totalJourney * 100}vh;">
  <div class="stage" id="stage">
${heroScene(d, p)}
${storyHtml}
${finalScene(d, p, totalJourney - 1)}
    <div class="vignette"></div>
  </div>
</div>

${services.length ? `<section class="vsec" id="services"><div class="wrap">
  <div class="sec-head rv"><span class="eyebrow">${esc(d.servicesEyebrow || 'O que oferecemos')}</span><h2 class="display">${esc(d.servicesTitle || 'Serviços & Preços')}</h2>${d.servicesSub ? `<p>${esc(d.servicesSub)}</p>` : ''}</div>
  <div class="menu-grid">${servicesHtml}</div>
</div></section>` : ''}

<section class="vsec visit" id="visit"><div class="wrap"><div class="visit-grid">
  <div class="rv">
    <span class="eyebrow">${esc(d.visitEyebrow || 'Onde estamos')}</span>
    <h2 class="display">${esc(d.visitTitle || 'Venha nos visitar')}</h2>
    <div class="info-cols">
      <div><h4>Endereço</h4><p>${nl(d.address || '[TROCAR: endereço]')}</p></div>
      <div><h4>${esc(d.hoursTitle || 'Funcionamento')}</h4><p>${nl(d.hours || '[TROCAR: horários]')}</p></div>
    </div>
    ${d.phone ? `<div class="contact-line"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 5c0 8 7 15 15 15l3-4-6-3-2 2c-3-1.5-5-3.5-6.5-6.5l2-2-3-6z"/></svg><span>${esc(d.phone)}</span></div>` : ''}
    ${d.instagram ? `<div class="contact-line"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg><span>${esc(d.instagram)}</span></div>` : ''}
    <div class="visit-cta"><button class="cta cta-solid" data-action="book">Agendar horário</button><a class="cta cta-ghost" href="https://www.google.com/maps/search/?api=1&query=${mapQ}" target="_blank" rel="noopener">Ver no mapa</a></div>
  </div>
  <div class="rv"><div class="map-frame"><div class="map-grid"></div><div class="map-road" style="top:40%;left:0;right:0;height:8px;"></div><div class="map-road" style="top:0;bottom:0;left:56%;width:8px;"></div><div class="map-pin"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C7.6 2 4 5.6 4 10c0 6.4 8 12 8 12s8-5.6 8-12c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"/></svg></div><div class="map-label">${esc(d.mapLabel || '')}</div></div></div>
</div></div></section>

<section class="vsec book" id="agendar"><div class="wrap"><div class="book-grid">
  <div class="rv"><span class="eyebrow">${esc(d.bookEyebrow || 'Agende agora')}</span><h2 class="display">${esc(d.bookTitle || 'Garanta seu horário')}</h2><p class="lead">${esc(d.bookLead || 'Preencha e a gente te chama pra confirmar. Rápido, sem enrolação.')}</p></div>
  <div class="rv"><form class="lead-form" id="leadForm">
    <div class="field"><label>Nome</label><input name="nome" required placeholder="Seu nome"></div>
    <div class="field"><label>WhatsApp</label><input name="telefone" required placeholder="(00) 00000-0000"></div>
    ${services.length ? `<div class="field"><label>O que você quer</label><select name="servico"><option value="">Selecione…</option>${serviceOptions}</select></div>` : ''}
    <div class="field"><label>Melhor dia / horário</label><input name="preferencia" placeholder="Ex.: sábado de manhã"></div>
    <button class="cta cta-solid" type="submit">Solicitar horário</button>
    <div class="form-ok" id="formOk" style="display:none">Recebido! Vamos te chamar no WhatsApp. ✅</div>
  </form></div>
</div></div></section>

<footer><div class="wrap">
  <a href="#top" class="foot-brand" style="display:inline-block;"><div class="b1">${brandLine}</div><div class="b2">${esc(d.brandSub || d.mapLabel || '')}</div></a>
  <div class="foot-nav"><a href="#services">Serviços</a><a href="#visit">Visite</a><a href="#agendar">Agendar</a>${d.phone ? `<a href="tel:${esc(d.phone)}">Ligar</a>` : ''}</div>
  <div class="foot-socials">${d.instagram ? `<a href="https://instagram.com/${esc(String(d.instagram).replace('@', ''))}" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg></a>` : ''}${wa ? `<a href="https://wa.me/${wa}" target="_blank" rel="noopener" aria-label="WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15l-1.4 5 5.1-1.3A10 10 0 1012 2zm0 18a8 8 0 01-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1112 20zm4.6-6c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.5 6.5 0 01-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.2 0-.4 0-.5s-.6-1.5-.8-2-.4-.4-.6-.4h-.5a1 1 0 00-.7.3A3 3 0 006 9.4c0 1.8 1.3 3.5 1.5 3.8s2.6 4 6.3 5.3c2.2.8 2.6.6 3.1.6s1.5-.6 1.7-1.2.2-1.1.1-1.2-.2-.2-.5-.3z"/></svg></a>` : ''}</div>
  <p class="foot-copy">${esc(d.footerNote || '')}</p>
</div></footer>

${wa ? `<a class="wa-float" href="https://wa.me/${wa}" target="_blank" rel="noopener" aria-label="WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15l-1.4 5 5.1-1.3A10 10 0 1012 2zm4.6 12c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.5 6.5 0 01-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.2 0-.4 0-.5s-.6-1.5-.8-2-.4-.4-.6-.4h-.5a1 1 0 00-.7.3A3 3 0 006 9.4c0 1.8 1.3 3.5 1.5 3.8s2.6 4 6.3 5.3c2.2.8 2.6.6 3.1.6s1.5-.6 1.7-1.2.2-1.1.1-1.2z"/></svg></a>` : ''}

<script>
  const WA = ${JSON.stringify(wa)};
  const header = document.getElementById('siteHeader');
  addEventListener('scroll', () => header.classList.toggle('scrolled', scrollY > 30), { passive:true });
  const mt = document.getElementById('menuToggle'), mn = document.getElementById('mnav');
  mt.addEventListener('click', () => { mt.classList.toggle('open'); mn.classList.toggle('open'); });
  mn.querySelectorAll('a, .book-btn').forEach(a => a.addEventListener('click', () => { mt.classList.remove('open'); mn.classList.remove('open'); }));
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-action=book]'); if(!b) return; e.preventDefault(); const el=document.getElementById('agendar'); if(el) el.scrollIntoView({behavior:'smooth'}); });

  const form = document.getElementById('leadForm');
  if(form){ form.addEventListener('submit', (e) => {
    const d = new FormData(form);
    const msg = 'Olá! Quero agendar.' + (d.get('nome')?' Nome: '+d.get('nome'):'') + (d.get('servico')?' · '+d.get('servico'):'') + (d.get('preferencia')?' · '+d.get('preferencia'):'');
    const ok = document.getElementById('formOk'); if(ok) ok.style.display='block';
    if(WA){ setTimeout(()=>window.open('https://wa.me/'+WA+'?text='+encodeURIComponent(msg),'_blank'), 400); }
    if(!window.__fbCapture){ e.preventDefault(); }
  }); }

  const io = new IntersectionObserver((es)=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold:0.14 });
  document.querySelectorAll('.rv').forEach(el => io.observe(el));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const journey = document.getElementById('journey'), stage = document.getElementById('stage');
  const scenes = Array.from(stage.querySelectorAll('.scene')); const nScenes = scenes.length;
  const progressEl = document.getElementById('progress'), scrollHint = document.getElementById('scrollHint');
  let mx=0,my=0,tmx=0,tmy=0;
  addEventListener('mousemove', e=>{ tmx=(e.clientX/innerWidth-0.5); tmy=(e.clientY/innerHeight-0.5); }, {passive:true});
  const OUT = reduceMotion?1.2:1.9, BACK = reduceMotion?0.10:0.16;
  function jm(){ return { top:journey.offsetTop, scrollable:journey.offsetHeight-innerHeight }; }
  let curF=0;
  function render(){
    mx+=(tmx-mx)*0.06; my+=(tmy-my)*0.06;
    const docH=document.documentElement.scrollHeight-innerHeight;
    progressEl.style.width=(Math.min(scrollY/docH,1)*100)+'%';
    const {top,scrollable}=jm(); let p=(scrollY-top)/scrollable; p=Math.min(Math.max(p,0),1);
    const f=p*(nScenes-1); curF=f;
    if(scrollHint) scrollHint.style.opacity=f>0.15?'0':'0.6';
    scenes.forEach((sc,k)=>{
      const dd=k-f, ad=Math.abs(dd);
      if(ad>1.15){ sc.style.opacity='0'; sc.style.visibility='hidden'; return; }
      sc.style.visibility='visible'; let scale,opacity;
      if(dd>=0){ scale=1-dd*BACK; opacity=1-Math.max(0,dd-0.10)/1.02; } else { scale=1+(-dd)*OUT; opacity=1-(-dd)/0.9; }
      opacity=Math.min(Math.max(opacity,0),1);
      sc.style.opacity=opacity.toFixed(3); sc.style.transform='scale('+scale.toFixed(4)+')'; sc.style.zIndex=String(Math.round(100-dd*20));
      const copy=sc.querySelector('.scene-copy'); if(copy){ const cv=1-ad/0.6; copy.style.opacity=Math.min(Math.max(cv,0),1).toFixed(3); }
      sc.querySelectorAll('.layer').forEach(l=>{ const dep=parseFloat(l.dataset.depth||'0'); l.style.transform='translate('+(mx*dep*18).toFixed(1)+'px, '+(my*dep*12).toFixed(1)+'px) scale('+(1+ad*0.05*dep).toFixed(3)+')'; });
    });
  }
  addEventListener('scroll', ()=>render(), {passive:true}); addEventListener('resize', ()=>render());
  (function loop(){ render(); requestAnimationFrame(loop); })();
  const dotnav=document.getElementById('dotnav'); const targets=[];
  scenes.forEach((s,i)=>targets.push({type:'scene',i,label:s.dataset.label}));
  ['services','visit','agendar'].forEach(id=>{ const el=document.getElementById(id); if(el) targets.push({type:'sec',el,label:id}); });
  targets.forEach(t=>{ const b=document.createElement('button'); b.setAttribute('aria-label',t.label||'');
    b.onclick=()=>{ if(t.type==='scene'){ const {top,scrollable}=jm(); scrollTo({top:top+(t.i/(nScenes-1))*scrollable+2, behavior:'smooth'}); } else t.el.scrollIntoView({behavior:'smooth'}); };
    dotnav.appendChild(b); });
  const dotBtns=Array.from(dotnav.children);
  function updateDots(){ let cur=Math.round(curF); const secs=['services','visit','agendar']; secs.forEach((id,idx)=>{ const el=document.getElementById(id); if(el && scrollY+innerHeight*0.5>=el.offsetTop) cur=nScenes+idx; }); dotBtns.forEach((b,i)=>b.classList.toggle('active',i===cur)); }
  addEventListener('scroll', updateDots, {passive:true});
  requestAnimationFrame(()=>{ render(); updateDots(); });
</script>
</body>
</html>`;
}

module.exports = { renderLanding, PALETTES };
