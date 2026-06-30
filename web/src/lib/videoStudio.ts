import type { RoteiroVariation } from '../types'

function esc(s: string) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

function slug(s: string) {
  return String(s || 'comp').toLowerCase().normalize('NFD').replace(/[0300-036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'comp'
}

function captionsFrom(v: RoteiroVariation): string[] {
  if (v.onscreen_text && v.onscreen_text.length) return v.onscreen_text.map(s => String(s)).filter(Boolean)
  const txt = String(v.script || '')
  const parts = txt.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
  return parts.slice(0, 6)
}

export function hyperframesComposition(v: RoteiroVariation, opts?: { width?: number; height?: number; cliente?: string }): { html: string; filename: string } {
  const width = opts?.width || 1080
  const height = opts?.height || 1920
  const id = slug(v.title || v.hook || 'roteiro')
  const intro = (v.visual_hook || v.hook || '').toString().toUpperCase()
  const caps = captionsFrom(v)
  const introDur = 2.4
  const capDur = 2.6
  const total = +(introDur + caps.length * capDur + 1).toFixed(1)

  const capEls = caps.map((c, i) => {
    const start = +(introDur + i * capDur).toFixed(2)
    return `    <div id="cap${i}" class="clip cap" data-start="${start}" data-duration="${capDur}" data-track-index="${2 + i}">${esc(c)}</div>`
  }).join('\n')

  const capTl = caps.map((c, i) => {
    const start = +(introDur + i * capDur).toFixed(2)
    return `      tl.fromTo("#cap${i}", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.4 }, ${start})\n        .to("#cap${i}", { opacity: 0, duration: 0.3 }, ${+(start + capDur - 0.35).toFixed(2)});`
  }).join('\n')

  const html = `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<title>${esc(id)}</title>
<style>
  * { margin: 0; box-sizing: border-box; }
  #stage { position: relative; width: ${width}px; height: ${height}px; overflow: hidden;
    background: radial-gradient(120% 80% at 50% 0%, #1a1530 0%, #08080a 60%);
    font-family: Inter, "Segoe UI", system-ui, sans-serif; color: #fff; }
  #intro { position: absolute; top: 12%; left: 8%; right: 8%; font-size: 96px; font-weight: 900;
    line-height: 1.05; letter-spacing: -0.02em; text-transform: uppercase; text-align: left; }
  .cap { position: absolute; left: 7%; right: 7%; bottom: 22%; font-size: 76px; font-weight: 800;
    line-height: 1.12; text-align: center; text-shadow: 0 4px 24px rgba(0,0,0,.6); }
  .brand { position: absolute; bottom: 6%; left: 0; right: 0; text-align: center;
    font-size: 34px; font-weight: 700; opacity: .85; letter-spacing: .04em; }
  .accent { color: #5E5CE6; }
</style>
</head>
<body>
<div id="stage" data-composition-id="${id}" data-start="0" data-width="${width}" data-height="${height}" data-fps="30" data-duration="${total}">
    <div id="intro" class="clip" data-start="0" data-duration="${introDur}" data-track-index="1"><span class="accent">${esc(intro)}</span></div>
${capEls}
    <div class="brand clip" data-start="0" data-duration="${total}" data-track-index="99">${esc(opts?.cliente || v.cta || '')}</div>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
  <script>
    (function () {
      const tl = gsap.timeline({ paused: true });
      tl.fromTo("#intro", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.6 }, 0)
        .to("#intro", { opacity: 0, duration: 0.4 }, ${+(introDur - 0.4).toFixed(2)});
${capTl}
      window.__timelines = window.__timelines || {};
      window.__timelines["${id}"] = tl;
    })();
  </script>
</div>
</body>
</html>
`
  return { html, filename: `${id}.html` }
}

export function videoUseBrief(v: RoteiroVariation, cliente?: string): { projectMd: string; comandos: string } {
  const caps = captionsFrom(v)
  const dur = Math.max(18, Math.min(35, Math.round((v.script || '').split(/\s+/).length / 2.6)))
  const projectMd = `# Briefing de edição — ${cliente || 'cliente'}

## Objetivo
Editar o material bruto num **short viral vertical (9:16)** de ~${dur}s, alta retenção, estilo TikTok/Reels.

## Roteiro de referência (use o transcript pra casar os cortes)
HOOK: ${v.hook || ''}

${v.script || ''}

## Diretrizes de edição
- Corte TODO silêncio, "é...", "ãã", falsos começos e respiros longos (jump cuts firmes).
- Comece no HOOK — os 3 primeiros segundos têm que prender. Sem intro lenta.
- Color grade consistente e levemente saturado (punchy), nada estourado.
- Crossfade de áudio de 30ms em cada corte (sem clique).
- Legendas queimadas: blocos de 2 palavras em CAIXA ALTA, sincronizadas ao áudio (ElevenLabs Scribe).
- Destaque as palavras-chave: ${(v.keywords || []).join(', ') || '(as de maior impacto)'}.
- Termine no PAYOFF; CTA curto no fim${v.cta ? `: "${v.cta}"` : ''}.

## Overlays / grafismo
- Use o arquivo HyperFrames gerado (intro + textos de tela) como camada de overlay:
  legendas de destaque: ${caps.join(' · ') || '(textos de tela do roteiro)'}.

## Entrega
- final.mp4 vertical 1080x1920, 30fps, áudio normalizado ~-14 LUFS.
`
  const comandos = `# 1) Instalar o video-use uma vez (mac/Linux):
brew install ffmpeg            # ou: sudo apt install ffmpeg
git clone https://github.com/browser-use/video-use ~/Developer/video-use
cd ~/Developer/video-use && uv sync
cp .env.example .env           # coloque ELEVENLABS_API_KEY=...
ln -sfn ~/Developer/video-use ~/.claude/skills/video-use   # registra o skill no Claude Code

# 2) Editar (na pasta com os vídeos brutos):
#   - salve o project.md acima nessa pasta
cd /caminho/para/seus/videos
claude
#   peça: "edite estes vídeos num short viral seguindo o project.md"
#   saída: edit/final.mp4`
  return { projectMd, comandos }
}

export function downloadText(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
