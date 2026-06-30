'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const { smtpSend, smtpVerify } = require('./smtp.js');

const MASK = '••••••';

function nowISO() { return new Date().toISOString(); }

function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length <= 11) d = '55' + d;
  return d;
}

function httpsJson(method, urlStr, headers, body) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(urlStr); } catch (e) { return resolve({ status: 0, data: { error: 'URL inválida' } }); }
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: u.hostname,
      path: u.pathname + u.search,
      port: u.port || 443,
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
      timeout: 20000,
    };
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let parsed;
        try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = { raw: data }; }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', (e) => resolve({ status: 0, data: { error: e.message } }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, data: { error: 'timeout' } }); });
    if (payload) req.write(payload);
    req.end();
  });
}

const PROVIDERS = {
  walink: {
    id: 'walink',
    label: 'WhatsApp (link wa.me)',
    canal: 'whatsapp',
    kind: 'link',
    descricao: 'Abre o WhatsApp do seu próprio número com a mensagem pronta. Funciona sempre, sem configuração e sem trava de DM frio.',
    fields: [],
    enabled: () => true,
    async test() { return { ok: true, info: 'Sempre disponível — gera o link wa.me.' }; },
    async send(cfg, { recipient, texto }) {
      const phone = normalizePhone(recipient);
      if (!phone) return { ok: false, error: 'Lead sem telefone válido.' };
      return { ok: true, mode: 'link', link: `https://wa.me/${phone}?text=${encodeURIComponent(texto)}` };
    },
  },

  email: {
    id: 'email',
    label: 'E-mail (SMTP)',
    canal: 'email',
    kind: 'api',
    descricao: 'Envio direto pelo seu e-mail via SMTP. No Gmail/Outlook use uma "Senha de app" (App Password), não a senha normal.',
    fields: [
      { key: 'host', label: 'Servidor SMTP', placeholder: 'smtp.gmail.com' },
      { key: 'port', label: 'Porta', placeholder: '465' },
      { key: 'user', label: 'Usuário (e-mail)', placeholder: 'voce@gmail.com' },
      { key: 'pass', label: 'Senha de app', secret: true },
      { key: 'from', label: 'Remetente (opcional)', placeholder: 'Seu Nome <voce@gmail.com>' },
    ],
    enabled: (c) => !!(c && c.host && c.user && c.pass),
    async test(cfg) {
      try { return await smtpVerify(cfg); }
      catch (e) { return { ok: false, error: e.message }; }
    },
    async send(cfg, { recipient, texto, assunto }) {
      const to = String(recipient || '').match(/[\w.+-]+@[\w-]+\.[\w.]+/);
      if (!to) return { ok: false, error: 'Lead sem e-mail válido.' };
      try {
        const r = await smtpSend(cfg, { to: to[0], from: cfg.from || cfg.user, subject: assunto || 'Olá', text: texto });
        return { ok: true, mode: 'email', detail: r.info };
      } catch (e) { return { ok: false, error: e.message }; }
    },
  },

  telegram: {
    id: 'telegram',
    label: 'Telegram (bot)',
    canal: 'telegram',
    kind: 'api',
    descricao: 'Crie um bot no @BotFather e cole o token. Só envia para quem já iniciou conversa com o bot (use o chat_id). Ótimo também para você receber os rascunhos.',
    fields: [
      { key: 'botToken', label: 'Token do bot', placeholder: '123456:ABC-DEF...', secret: true },
      { key: 'defaultChatId', label: 'Chat ID padrão (você)', placeholder: '123456789' },
    ],
    enabled: (c) => !!(c && c.botToken),
    async test(cfg) {
      const r = await httpsJson('GET', `https://api.telegram.org/bot${cfg.botToken}/getMe`, {});
      if (r.status === 200 && r.data && r.data.ok) return { ok: true, info: `Bot @${r.data.result.username} conectado.` };
      return { ok: false, error: (r.data && r.data.description) || `HTTP ${r.status}` };
    },
    async send(cfg, { recipient, texto }) {
      const chatId = String(recipient || '').match(/^-?\d+$/) ? recipient : cfg.defaultChatId;
      if (!chatId) return { ok: false, error: 'Sem chat_id (informe o do lead ou um chat_id padrão).' };
      const r = await httpsJson('POST', `https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {}, { chat_id: chatId, text: texto });
      if (r.status === 200 && r.data && r.data.ok) return { ok: true, mode: 'telegram' };
      return { ok: false, error: (r.data && r.data.description) || `HTTP ${r.status}` };
    },
  },

  whatsapp: {
    id: 'whatsapp',
    label: 'WhatsApp Cloud API',
    canal: 'whatsapp',
    kind: 'api',
    descricao: 'Envio oficial pela API da Meta. Precisa de número WhatsApp Business + token. Para mensagem fora da janela de 24h é necessário um template aprovado.',
    fields: [
      { key: 'phoneNumberId', label: 'Phone Number ID', placeholder: '1029384756...' },
      { key: 'token', label: 'Token de acesso', secret: true },
    ],
    enabled: (c) => !!(c && c.phoneNumberId && c.token),
    async test(cfg) {
      const r = await httpsJson('GET', `https://graph.facebook.com/v21.0/${cfg.phoneNumberId}?fields=display_phone_number,verified_name`, { Authorization: `Bearer ${cfg.token}` });
      if (r.status === 200 && r.data && !r.data.error) return { ok: true, info: `Número ${r.data.display_phone_number || ''} (${r.data.verified_name || 'ok'}).` };
      return { ok: false, error: (r.data && r.data.error && r.data.error.message) || `HTTP ${r.status}` };
    },
    async send(cfg, { recipient, texto }) {
      const to = normalizePhone(recipient);
      if (!to) return { ok: false, error: 'Lead sem telefone válido.' };
      const r = await httpsJson('POST', `https://graph.facebook.com/v21.0/${cfg.phoneNumberId}/messages`, { Authorization: `Bearer ${cfg.token}` }, { messaging_product: 'whatsapp', to, type: 'text', text: { body: texto } });
      if (r.status >= 200 && r.status < 300 && r.data && !r.data.error) return { ok: true, mode: 'whatsapp-api', detail: r.data.messages && r.data.messages[0] && r.data.messages[0].id };
      return { ok: false, error: (r.data && r.data.error && r.data.error.message) || `HTTP ${r.status}` };
    },
  },

  meta: {
    id: 'meta',
    label: 'Instagram / Facebook DM',
    canal: 'instagram',
    kind: 'api',
    descricao: 'DM via Graph API da Meta. Responde quem já te mandou mensagem (a Meta bloqueia DM frio fora da janela de 24h). Precisa de app Meta + token de página.',
    fields: [
      { key: 'igId', label: 'IG/Page ID', placeholder: '1784...' },
      { key: 'pageToken', label: 'Token da página', secret: true },
    ],
    enabled: (c) => !!(c && c.igId && c.pageToken),
    async test(cfg) {
      const r = await httpsJson('GET', `https://graph.facebook.com/v21.0/${cfg.igId}?fields=name,username`, { Authorization: `Bearer ${cfg.pageToken}` });
      if (r.status === 200 && r.data && !r.data.error) return { ok: true, info: `Conta ${r.data.username || r.data.name || 'ok'} conectada.` };
      return { ok: false, error: (r.data && r.data.error && r.data.error.message) || `HTTP ${r.status}` };
    },
    async send(cfg, { recipient, texto }) {
      const id = String(recipient || '').replace(/^@/, '').trim();
      if (!/^\d+$/.test(id)) return { ok: false, error: 'Instagram/Facebook exige o ID numérico de quem já te respondeu (não dá DM frio por @handle).' };
      const r = await httpsJson('POST', `https://graph.facebook.com/v21.0/${cfg.igId}/messages`, { Authorization: `Bearer ${cfg.pageToken}` }, { recipient: { id }, message: { text: texto } });
      if (r.status >= 200 && r.status < 300 && r.data && !r.data.error) return { ok: true, mode: 'meta' };
      return { ok: false, error: (r.data && r.data.error && r.data.error.message) || `HTTP ${r.status}` };
    },
  },
};

const CANAL_PROVIDER = { whatsapp: 'whatsapp', email: 'email', telegram: 'telegram', instagram: 'meta', facebook: 'meta' };

class SocialHub {
  constructor(workspaceDir) {
    this.dir = path.join(workspaceDir, 'social');
    this.file = path.join(this.dir, 'connections.json');
  }

  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (parsed && parsed.providers) return parsed;
    } catch {}
    return { providers: {} };
  }

  save(data) {
    try { fs.mkdirSync(this.dir, { recursive: true }); } catch {}
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  config(id) { return this.load().providers[id] || {}; }

  enabled(id) {
    const p = PROVIDERS[id];
    return !!(p && p.enabled(this.config(id)));
  }

  status() {
    const data = this.load();
    return Object.values(PROVIDERS).map((p) => {
      const cfg = data.providers[p.id] || {};
      const values = {};
      for (const f of p.fields) {
        if (f.secret) values[f.key] = cfg[f.key] ? MASK : '';
        else values[f.key] = cfg[f.key] || '';
      }
      return {
        id: p.id, label: p.label, canal: p.canal, kind: p.kind,
        descricao: p.descricao, fields: p.fields,
        connected: !!p.enabled(cfg), values,
        atualizadoEm: cfg.atualizadoEm || null,
      };
    });
  }

  connect(id, patch) {
    const p = PROVIDERS[id];
    if (!p) return null;
    const data = this.load();
    const cfg = { ...(data.providers[id] || {}) };
    for (const f of p.fields) {
      const v = patch ? patch[f.key] : undefined;
      if (v === undefined) continue;
      if (f.secret && (v === '' || v === MASK)) continue;
      cfg[f.key] = String(v);
    }
    cfg.atualizadoEm = nowISO();
    data.providers[id] = cfg;
    this.save(data);
    return this.status().find((s) => s.id === id);
  }

  disconnect(id) {
    const data = this.load();
    if (data.providers[id]) { delete data.providers[id]; this.save(data); }
    return this.status().find((s) => s.id === id);
  }

  async test(id) {
    const p = PROVIDERS[id];
    if (!p) return { ok: false, error: 'Provider desconhecido' };
    const cfg = this.config(id);
    if (!p.enabled(cfg)) return { ok: false, error: 'Preencha e salve as credenciais antes de testar.' };
    try { return await p.test(cfg); } catch (e) { return { ok: false, error: e.message }; }
  }

  providerForCanal(canal) {
    return CANAL_PROVIDER[canal] || null;
  }

  async send({ canal, recipient, texto, assunto, modo }) {
    if (modo === 'whatsapp' || modo === 'link') {
      return PROVIDERS.walink.send({}, { recipient, texto });
    }
    let id = this.providerForCanal(canal);
    if (id === 'whatsapp' && !this.enabled('whatsapp')) id = 'walink';
    if (!id) id = recipient && normalizePhone(recipient) ? 'walink' : null;
    if (!id) return { ok: false, error: `Sem canal configurado para "${canal || 'desconhecido'}".` };
    const p = PROVIDERS[id];
    if (id !== 'walink' && !this.enabled(id)) {
      return { ok: false, error: `${p.label} não está conectado. Configure em Conexões.` };
    }
    return p.send(this.config(id), { recipient, texto, assunto });
  }
}

module.exports = { SocialHub, PROVIDERS, normalizePhone };
