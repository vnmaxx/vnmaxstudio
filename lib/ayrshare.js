'use strict';
const https = require('https');

function request(apiKey, pathname, body) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body || {});
    const opts = {
      hostname: 'api.ayrshare.com',
      path: '/api' + pathname,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 20000,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = { raw: data }; }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', (e) => resolve({ status: 0, data: { error: e.message } }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, data: { error: 'Ayrshare timeout' } }); });
    req.write(payload);
    req.end();
  });
}

const CANAL_PLATFORM = {
  instagram: 'instagram',
  whatsapp: 'whatsapp',
  email: 'email',
  facebook: 'facebook',
};

function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length <= 11) d = '55' + d;
  return d;
}

function whatsappLink(contato, texto) {
  const phone = normalizePhone(contato);
  if (!phone) return '';
  return 'https://wa.me/' + phone + (texto ? '?text=' + encodeURIComponent(texto) : '');
}

class Ayrshare {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  enabled() {
    return !!this.apiKey;
  }

  post(text, platforms) {
    const plats = (platforms && platforms.length) ? platforms : ['instagram'];
    return request(this.apiKey, '/post', { post: text, platforms: plats });
  }

  dm(platform, recipient, message) {
    return request(this.apiKey, '/messages', { platform, recipientId: recipient, message });
  }

  async sendForLead({ canal, recipient, texto, modo }) {
    if (!this.enabled()) return { ok: false, error: 'Ayrshare não configurado' };
    const platform = CANAL_PLATFORM[canal] || 'instagram';
    let r;
    if (modo === 'post') {
      r = await this.post(texto, [platform]);
    } else {
      r = await this.dm(platform, recipient || '', texto);
    }
    const ok = r.status >= 200 && r.status < 300 && r.data && r.data.status !== 'error';
    return { ok, status: r.status, ayrshare: r.data };
  }
}

module.exports = { Ayrshare, normalizePhone, whatsappLink };
