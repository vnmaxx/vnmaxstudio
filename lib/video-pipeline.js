'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { roteiroToAss } = require('./video-ass.js');

const VIDEO_EXT = ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi'];

function ffmpegBin() {
  try { const p = require('ffmpeg-static'); if (p && fs.existsSync(p)) return p; } catch {}
  return 'ffmpeg';
}

function freeBytes(dir) {
  try { const s = fs.statfsSync(dir); return s.bavail * s.bsize; } catch { return Infinity; }
}

function listClips(srcDir) {
  try {
    return fs.readdirSync(srcDir)
      .filter(f => VIDEO_EXT.includes(path.extname(f).toLowerCase()))
      .sort()
      .map(f => path.join(srcDir, f));
  } catch { return []; }
}

function readStatus(jobDir) {
  try { return JSON.parse(fs.readFileSync(path.join(jobDir, 'status.json'), 'utf8')); } catch { return null; }
}

function pruneOldJobs(videoDir, keep) {
  try {
    const dirs = fs.readdirSync(videoDir)
      .map(d => { const p = path.join(videoDir, d); let t = 0, dir = false; try { const s = fs.statSync(p); dir = s.isDirectory(); t = s.mtimeMs; } catch {} return { p, t, dir }; })
      .filter(x => x.dir)
      .sort((a, b) => b.t - a.t);
    for (const x of dirs.slice(keep || 40)) { try { fs.rmSync(x.p, { recursive: true, force: true }); } catch {} }
  } catch {}
}

function writeStatus(jobDir, patch) {
  const cur = readStatus(jobDir) || {};
  const next = { ...cur, ...patch, atualizadoEm: new Date().toISOString() };
  try { fs.writeFileSync(path.join(jobDir, 'status.json'), JSON.stringify(next, null, 2)); } catch {}
  return next;
}

function run(bin, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { cwd });
    let err = '';
    p.stderr.on('data', d => { err += d.toString(); if (err.length > 8000) err = err.slice(-8000); });
    p.on('error', e => reject(new Error(`spawn falhou: ${e.message}`)));
    p.on('close', code => code === 0 ? resolve() : reject(new Error(err.slice(-600) || `ffmpeg saiu com codigo ${code}`)));
  });
}

const NORM_VF = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30";

async function normalizeOne(bin, src, out, cwd) {
  await run(bin, ['-y', '-i', src, '-vf', `${NORM_VF},format=yuv420p`, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11',
    '-c:v', 'libx264', '-crf', '21', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out], cwd);
}

const queue = [];
let running = false;

function enqueue(jobDir, roteiro) {
  writeStatus(jobDir, { state: 'queued', step: 'na fila' });
  queue.push({ jobDir, roteiro });
  processNext();
}

function processNext() {
  if (running || queue.length === 0) return;
  running = true;
  const { jobDir, roteiro } = queue.shift();
  processJob(jobDir, roteiro).catch(e => writeStatus(jobDir, { state: 'error', error: String(e.message || e) }))
    .finally(() => { running = false; processNext(); });
}

async function processJob(jobDir, roteiro) {
  const bin = ffmpegBin();
  const srcDir = path.join(jobDir, 'src');
  const clips = listClips(srcDir);
  if (clips.length === 0) { writeStatus(jobDir, { state: 'error', error: 'Nenhum vídeo enviado.' }); return; }

  writeStatus(jobDir, { state: 'running', step: 'preparando legendas' });
  const { ass } = roteiroToAss(roteiro || {});
  fs.writeFileSync(path.join(jobDir, 'subs.ass'), ass, 'utf8');

  const tmp = [];
  let base;
  try {
    if (clips.length === 1) {
      base = clips[0];
    } else {
      writeStatus(jobDir, { state: 'running', step: `normalizando ${clips.length} clipes` });
      const norm = [];
      for (let i = 0; i < clips.length; i++) {
        const out = path.join(jobDir, `n${i}.mp4`);
        await normalizeOne(bin, clips[i], out, jobDir);
        norm.push(out); tmp.push(out);
      }
      const listFile = path.join(jobDir, 'concat.txt');
      fs.writeFileSync(listFile, norm.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
      tmp.push(listFile);
      base = path.join(jobDir, 'joined.mp4');
      await run(bin, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', base], jobDir);
      tmp.push(base);
    }

    writeStatus(jobDir, { state: 'running', step: 'editando (9:16, áudio, legendas)' });
    const final = path.join(jobDir, 'final.mp4');
    const vf = clips.length === 1
      ? `${NORM_VF},subtitles=subs.ass,format=yuv420p`
      : `subtitles=subs.ass,format=yuv420p`;
    const af = clips.length === 1 ? ['-af', 'loudnorm=I=-14:TP=-1.5:LRA=11'] : [];
    await run(bin, ['-y', '-i', base, '-vf', vf, ...af,
      '-c:v', 'libx264', '-crf', '21', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', final], jobDir);

    for (const f of tmp) { try { fs.unlinkSync(f); } catch {} }
    try { for (const c of clips) fs.unlinkSync(c); } catch {}
    let size = 0; try { size = fs.statSync(final).size; } catch {}
    writeStatus(jobDir, { state: 'done', step: 'pronto', final: 'final.mp4', size, finishedAt: new Date().toISOString() });
  } catch (e) {
    for (const f of tmp) { try { fs.unlinkSync(f); } catch {} }
    writeStatus(jobDir, { state: 'error', error: String(e.message || e).slice(-600) });
  }
  try { pruneOldJobs(path.dirname(jobDir), 40); } catch {}
}

module.exports = { enqueue, readStatus, listClips, freeBytes, ffmpegBin, pruneOldJobs, VIDEO_EXT };
