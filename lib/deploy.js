'use strict';
const https = require('https');

function api(token, method, pathname, body, host) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: host || 'api.vercel.com',
      path: pathname,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
      timeout: 60000,
    }, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = { raw: data }; }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
        else reject(new Error(`Vercel HTTP ${res.statusCode}: ${(parsed && (parsed.error?.message || parsed.error || data)) || data}`.slice(0, 400)));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Vercel timeout')));
    if (payload) req.write(payload);
    req.end();
  });
}

function slugProject(nome, maxLen = 40) {
  const s = String(nome || 'site').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, maxLen).replace(/-+$/g, '');
  return s || 'site';
}

function buildProjectName(project, suffix) {
  const suf = suffix ? slugProject(suffix, 8) : '';
  if (!suf) return slugProject(project, 52);
  const base = slugProject(project, Math.max(1, 52 - suf.length - 1));
  return `${base}-${suf}`;
}

function pickCleanHost(list, name) {
  const hosts = (Array.isArray(list) ? list : []).filter(a => typeof a === 'string' && a);
  const vercel = hosts.filter(a => a.endsWith('.vercel.app'));
  if (!vercel.length) return hosts[0] || null;
  const exact = vercel.find(a => a === `${name}.vercel.app`);
  return exact || vercel.slice().sort((a, b) => a.length - b.length)[0];
}

async function resolveProdUrl(token, name, teamQS, id, dep) {
  // 1) alias já presente na resposta do deployment
  let host = pickCleanHost(dep && dep.alias, name);

  // 2) o aliasing acontece logo após READY — dá um curto polling buscando o
  //    domínio de produção real que a Vercel atribuiu (deployment e projeto).
  for (let i = 0; !host && i < 5; i++) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      if (id) {
        const d = await api(token, 'GET', `/v13/deployments/${id}${teamQS}`);
        host = pickCleanHost(d && d.alias, name);
        if (host) break;
      }
    } catch { /* tenta o projeto abaixo */ }
    try {
      const proj = await api(token, 'GET', `/v9/projects/${encodeURIComponent(name)}${teamQS}`);
      const prodAlias = (proj && proj.targets && proj.targets.production && proj.targets.production.alias) || (proj && proj.alias) || [];
      host = pickCleanHost(prodAlias, name);
    } catch { /* segue */ }
  }

  // 3) fallback EXATO: a URL imutável do deployment sempre resolve pra este site.
  //    Nunca chutar `${name}.vercel.app`, que pode não existir/estar colidido.
  if (!host) return dep && dep.url ? `https://${dep.url}` : `https://${name}.vercel.app`;
  return `https://${host}`;
}

async function ensureProject(token, name, teamQS) {
  try {
    return await api(token, 'POST', `/v10/projects${teamQS}`, { name, framework: null });
  } catch (e) {
    if (/HTTP 409/.test(e.message)) {
      return await api(token, 'GET', `/v9/projects/${encodeURIComponent(name)}${teamQS}`);
    }
    throw e;
  }
}

async function publishLanding({ token, teamId, project, suffix, html, files }) {
  if (!token) throw new Error('VERCEL_TOKEN ausente');
  const name = buildProjectName(project, suffix);
  const teamQS = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';

  await ensureProject(token, name, teamQS);

  const deployFiles = [];
  if (html) deployFiles.push({ file: 'index.html', data: html });
  for (const f of (files || [])) deployFiles.push({ file: f.file, data: f.data });
  if (!deployFiles.length) throw new Error('nada para publicar (html vazio)');

  const dep = await api(token, 'POST', `/v13/deployments${teamQS}`, {
    name,
    files: deployFiles,
    projectSettings: { framework: null },
    target: 'production',
  });

  const id = dep.id || dep.uid;
  const started = Date.now();
  let state = dep.readyState || dep.status || 'QUEUED';
  let last = dep;
  while (state !== 'READY' && state !== 'ERROR' && Date.now() - started < 120000) {
    await new Promise(r => setTimeout(r, 3000));
    try { last = await api(token, 'GET', `/v13/deployments/${id}${teamQS}`); }
    catch { continue; }
    state = last.readyState || last.status || state;
  }
  if (state === 'ERROR') throw new Error('deploy falhou no Vercel (build error)');

  const prod = await resolveProdUrl(token, name, teamQS, id, last);
  const depUrl = last.url ? `https://${last.url}` : prod;
  return {
    ok: state === 'READY',
    state,
    project: name,
    url: prod,
    deployUrl: depUrl,
    inspector: id ? `https://vercel.com/deployments/${id}` : null,
    deploymentId: id,
  };
}

module.exports = { publishLanding, slugProject, buildProjectName };
