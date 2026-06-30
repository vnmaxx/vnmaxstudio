'use strict';

function ts(sec) {
  const s = Math.max(0, sec || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const cs = Math.round((s - Math.floor(s)) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function clean(t) {
  return String(t || '')
    .replace(/[{}]/g, '')
    .replace(/\r?\n+/g, '\\N')
    .trim();
}

function captionsFrom(roteiro) {
  if (roteiro && Array.isArray(roteiro.onscreen_text) && roteiro.onscreen_text.length) {
    return roteiro.onscreen_text.map(clean).filter(Boolean);
  }
  const txt = String((roteiro && roteiro.script) || '');
  return txt.split(/(?<=[.!?])\s+/).map(s => clean(s)).filter(Boolean).slice(0, 8);
}

function assHeader(W, H) {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,DejaVu Sans,84,&H00FFFFFF,&H000000FF,&H00101010,&H64000000,-1,0,0,0,100,100,0,0,1,6,3,2,90,90,360,1
Style: Hook,DejaVu Sans,118,&H00E65C5E,&H000000FF,&H00101010,&H64000000,-1,0,0,0,100,100,0,0,1,7,3,8,80,80,300,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;
}

function roteiroToAss(roteiro, opts) {
  const o = opts || {};
  const W = o.width || 1080;
  const H = o.height || 1920;
  const intro = clean((roteiro && (roteiro.visual_hook || roteiro.hook)) || '').toUpperCase();
  const caps = captionsFrom(roteiro);
  const introDur = 2.4;
  const capDur = o.capDur || 2.6;

  const events = [];
  if (intro) events.push(`Dialogue: 0,${ts(0)},${ts(introDur)},Hook,,0,0,0,,{\\fad(200,200)}${intro}`);
  let t = introDur;
  for (const c of caps) {
    events.push(`Dialogue: 0,${ts(t)},${ts(t + capDur)},Caption,,0,0,0,,{\\fad(150,150)}${c}`);
    t += capDur;
  }

  return { ass: `${assHeader(W, H)}\n${events.join('\n')}\n`, totalSec: +(t + 0.6).toFixed(2), captions: caps.length };
}

function wordsToChunks(words, n) {
  const out = [];
  for (let i = 0; i < words.length; i += n) {
    const g = words.slice(i, i + n);
    const start = g[0].start, end = g[g.length - 1].end;
    out.push({ start, end, text: g.map(w => w.word).join(' ') });
  }
  return out;
}

function segmentsToChunks(segments, n) {
  const out = [];
  for (const s of segments) {
    const ws = String(s.text || '').split(/\s+/).filter(Boolean);
    if (!ws.length) continue;
    const groups = [];
    for (let i = 0; i < ws.length; i += n) groups.push(ws.slice(i, i + n).join(' '));
    const span = Math.max(0.4, (s.end || s.start) - s.start);
    const dur = span / groups.length;
    groups.forEach((g, i) => out.push({ start: s.start + i * dur, end: s.start + (i + 1) * dur, text: g }));
  }
  return out;
}

function transcriptToAss(transcript, roteiro, opts) {
  const o = opts || {};
  const W = o.width || 1080;
  const H = o.height || 1920;
  const intro = clean((roteiro && (roteiro.visual_hook || roteiro.hook)) || '').toUpperCase();

  let chunks = [];
  if (transcript && transcript.words && transcript.words.length) chunks = wordsToChunks(transcript.words, 2);
  else if (transcript && transcript.segments && transcript.segments.length) chunks = segmentsToChunks(transcript.segments, 2);

  const events = [];
  if (intro) events.push(`Dialogue: 0,${ts(0)},${ts(1.8)},Hook,,0,0,0,,{\\fad(150,150)}${intro}`);
  for (const c of chunks) {
    const txt = clean(c.text).toUpperCase();
    if (!txt) continue;
    const start = c.start || 0;
    const end = Math.max(start + 0.3, c.end || start + 0.6);
    events.push(`Dialogue: 0,${ts(start)},${ts(end)},Caption,,0,0,0,,{\\fad(80,80)}${txt}`);
  }

  return { ass: `${assHeader(W, H)}\n${events.join('\n')}\n`, captions: chunks.length };
}

module.exports = { roteiroToAss, transcriptToAss };
