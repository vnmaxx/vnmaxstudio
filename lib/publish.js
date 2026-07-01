'use strict';
const fs = require('fs');
const path = require('path');

function nowISO() { return new Date().toISOString(); }

function safeCol(s) {
  return String(s || 'lead').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'lead';
}

function injectFirebase(html, config, clienteId) {
  if (!html || !config || !config.apiKey) return html;
  const col = `leads_${safeCol(clienteId)}`;
  const snippet = `
<script>window.__fbCapture = true;</script>
<script type="module">
  import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
  import { getFirestore, collection, addDoc, getDocs, onSnapshot, doc, setDoc, deleteDoc, query, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
  import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
  const app = initializeApp(${JSON.stringify(config)});
  const db = getFirestore(app);
  const auth = getAuth(app);
  window.VNMAX_FB = { db, auth, collection, addDoc, getDocs, onSnapshot, doc, setDoc, deleteDoc, query, where, serverTimestamp, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, clienteId: ${JSON.stringify(safeCol(clienteId))} };
  window.dispatchEvent(new Event('vnmax-fb-ready'));
  document.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(form).entries());
    const btn = form.querySelector('[type=submit],button');
    if (btn) btn.disabled = true;
    try {
      await addDoc(collection(db, '${col}'), { ...dados, criadoEm: serverTimestamp(), origem: location.href });
      form.reset();
      form.insertAdjacentHTML('afterend', '<p style="color:#16a34a;font-weight:600;margin-top:12px">Recebido! Entraremos em contato em breve. ✅</p>');
    } catch (err) {
      console.error(err);
      alert('Não foi possível enviar agora. Tente novamente em instantes.');
    } finally { if (btn) btn.disabled = false; }
  });
</script>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${snippet}\n</body>`);
  return html + snippet;
}

class Sites {
  constructor(workspaceDir) {
    this.dir = path.join(workspaceDir, 'config');
    this.file = path.join(this.dir, 'sites.json');
  }
  load() {
    try { const p = JSON.parse(fs.readFileSync(this.file, 'utf8')); return (p && typeof p === 'object') ? p : {}; }
    catch { return {}; }
  }
  save(data) {
    try { fs.mkdirSync(this.dir, { recursive: true }); } catch {}
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }
  get(clienteId) { return this.load()[clienteId] || null; }
  set(clienteId, info) {
    const data = this.load();
    data[clienteId] = { ...(data[clienteId] || {}), ...info, atualizadoEm: nowISO() };
    this.save(data);
    return data[clienteId];
  }
  all() { return this.load(); }
}

module.exports = { injectFirebase, Sites };
