'use strict';
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SA_JSON;
  if (raw) { try { return JSON.parse(raw); } catch { throw new Error('FIREBASE_SA_JSON inválido'); } }
  const p = process.env.FIREBASE_SA_PATH;
  if (p && fs.existsSync(p)) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { throw new Error('FIREBASE_SA_PATH inválido'); } }
  return null;
}

function request(method, urlOrHost, pathname, headers, body) {
  return new Promise((resolve, reject) => {
    const opts = typeof urlOrHost === 'object' ? urlOrHost : { hostname: urlOrHost, path: pathname, method, headers };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = { raw: data }; }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
        else reject(new Error(`Firebase HTTP ${res.statusCode}: ${JSON.stringify(parsed).slice(0, 300)}`));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.setTimeout(30000);
    if (body) req.write(body);
    req.end();
  });
}

async function accessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  signer.end();
  const sig = b64url(signer.sign(sa.private_key));
  const jwt = `${header}.${claim}.${sig}`;
  const form = `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`;
  const r = await request('POST', {
    hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(form) },
    timeout: 30000,
  }, null, null, form);
  if (!r.access_token) throw new Error('sem access_token do Google');
  return r.access_token;
}

function gapi(token, method, pathname, body) {
  const payload = body ? JSON.stringify(body) : null;
  return request('', {
    hostname: 'firebase.googleapis.com', path: pathname, method,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) },
    timeout: 30000,
  }, null, null, payload);
}

async function createWebApp({ projectId, displayName }) {
  const sa = loadServiceAccount();
  if (!sa) throw new Error('service account do Firebase não configurado (FIREBASE_SA_PATH/FIREBASE_SA_JSON)');
  const pid = projectId || sa.project_id;
  if (!pid) throw new Error('projectId do Firebase ausente');
  const token = await accessToken(sa);

  const op = await gapi(token, 'POST', `/v1beta1/projects/${pid}/webApps`, { displayName: displayName || 'StudioIA App' });
  let done = op.done ? op : null;
  const started = Date.now();
  while (!done && op.name && Date.now() - started < 60000) {
    await new Promise(r => setTimeout(r, 3000));
    const st = await gapi(token, 'GET', `/v1beta1/${op.name}`);
    if (st.done) done = st;
  }
  const appId = (done && done.response && done.response.appId) || null;
  if (!appId) throw new Error('não retornou appId do Firebase');

  const config = await gapi(token, 'GET', `/v1beta1/projects/${pid}/webApps/${appId}/config`);
  return { projectId: pid, appId, config };
}

function isConfigured() {
  return !!loadServiceAccount();
}

async function checkAuth() {
  const sa = loadServiceAccount();
  if (!sa) return { ok: false, configurado: false, error: 'service account não configurado (defina FIREBASE_SA_PATH no servidor)' };
  try {
    const token = await accessToken(sa);
    const r = await gapi(token, 'GET', `/v1beta1/projects/${sa.project_id}/webApps?pageSize=100`);
    return { ok: true, configurado: true, projectId: sa.project_id, email: sa.client_email, apps: Array.isArray(r.apps) ? r.apps.length : 0 };
  } catch (e) {
    return { ok: false, configurado: true, projectId: sa.project_id, email: sa.client_email, error: e.message };
  }
}

module.exports = { createWebApp, isConfigured, checkAuth, loadServiceAccount };
