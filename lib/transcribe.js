'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function readEnv(name) {
  if (process.env[name]) return process.env[name];
  try {
    const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    const m = env.match(new RegExp('^' + name + '=(.*)$', 'm'));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch {}
  return '';
}

function cfg() {
  return {
    whisperBin: readEnv('WHISPER_BIN'),
    whisperModel: readEnv('WHISPER_MODEL'),
    elevenKey: readEnv('ELEVENLABS_API_KEY'),
    openaiKey: readEnv('OPENAI_API_KEY'),
    lang: readEnv('WHISPER_LANG') || 'pt',
  };
}

function available() {
  const c = cfg();
  if (c.whisperBin && c.whisperModel && fs.existsSync(c.whisperBin) && fs.existsSync(c.whisperModel)) return 'whisper.cpp';
  if (c.elevenKey) return 'elevenlabs';
  if (c.openaiKey) return 'openai';
  return null;
}

function run(bin, args, cwd, timeoutMs) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { cwd });
    let err = '';
    const timer = setTimeout(() => { try { p.kill('SIGKILL'); } catch {} reject(new Error('timeout')); }, timeoutMs || 600000);
    p.stderr.on('data', d => { err += d.toString(); if (err.length > 4000) err = err.slice(-4000); });
    p.on('error', e => { clearTimeout(timer); reject(e); });
    p.on('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(err.slice(-300) || `exit ${code}`)); });
  });
}

function parseSrt(srt) {
  const segs = [];
  for (const b of String(srt).split(/\r?\n\r?\n/)) {
    const m = b.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*([\s\S]*)/);
    if (!m) continue;
    const start = +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
    const end = +m[5] * 3600 + +m[6] * 60 + +m[7] + +m[8] / 1000;
    const text = m[9].replace(/\r?\n/g, ' ').trim();
    if (text) segs.push({ start, end, text });
  }
  return segs;
}

async function viaWhisper(audioPath, c) {
  const outBase = audioPath.replace(/\.[^.]+$/, '') + '.wsp';
  await run(c.whisperBin, ['-m', c.whisperModel, '-f', audioPath, '-osrt', '-of', outBase, '-l', c.lang || 'pt', '-np'], path.dirname(audioPath));
  const srtPath = outBase + '.srt';
  let srt = '';
  try { srt = fs.readFileSync(srtPath, 'utf8'); } catch {}
  try { fs.unlinkSync(srtPath); } catch {}
  const segments = parseSrt(srt);
  return segments.length ? { segments } : null;
}

async function viaApi(audioPath, url, headers, fields) {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(audioPath)]), 'audio.wav');
  for (const k of Object.keys(fields)) fd.append(k, fields[k]);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);
  try {
    const r = await fetch(url, { method: 'POST', headers, body: fd, signal: ctrl.signal });
    if (!r.ok) throw new Error(`STT ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}

async function transcribe(audioPath) {
  const c = cfg();
  try {
    if (c.whisperBin && c.whisperModel && fs.existsSync(c.whisperBin) && fs.existsSync(c.whisperModel)) {
      return await viaWhisper(audioPath, c);
    }
    if (c.elevenKey) {
      const data = await viaApi(audioPath, 'https://api.elevenlabs.io/v1/speech-to-text', { 'xi-api-key': c.elevenKey }, { model_id: 'scribe_v1' });
      const words = (data.words || []).filter(w => !w.type || w.type === 'word').map(w => ({ start: w.start, end: w.end, word: w.text || w.word }));
      if (words.length) return { words };
      return data.text ? { segments: [{ start: 0, end: 0, text: data.text }] } : null;
    }
    if (c.openaiKey) {
      const data = await viaApi(audioPath, 'https://api.openai.com/v1/audio/transcriptions', { Authorization: `Bearer ${c.openaiKey}` }, { model: 'whisper-1', response_format: 'verbose_json', 'timestamp_granularities[]': 'word' });
      if (Array.isArray(data.words) && data.words.length) return { words: data.words.map(w => ({ start: w.start, end: w.end, word: w.word })) };
      if (Array.isArray(data.segments) && data.segments.length) return { segments: data.segments.map(s => ({ start: s.start, end: s.end, text: s.text })) };
      return data.text ? { segments: [{ start: 0, end: 0, text: data.text }] } : null;
    }
  } catch (e) { return { error: String(e.message || e) }; }
  return null;
}

module.exports = { transcribe, available, parseSrt };
