'use strict';
const net = require('net');
const tls = require('tls');

function extractAddr(s) {
  const m = String(s || '').match(/<([^>]+)>/);
  return m ? m[1].trim() : String(s || '').trim();
}

function b64(s) {
  return Buffer.from(String(s), 'utf8').toString('base64');
}

function encodeHeader(s) {
  const v = String(s || '');
  if (/^[\x00-\x7F]*$/.test(v)) return v;
  return '=?UTF-8?B?' + b64(v) + '?=';
}

function makeReader(socket) {
  let buffer = '';
  let pending = null;
  function tryDeliver() {
    if (!pending) return;
    const lines = buffer.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\r$/, '');
      if (/^\d{3} /.test(line)) {
        const code = parseInt(line.slice(0, 3), 10);
        const text = lines.slice(0, i + 1).join('\n');
        buffer = lines.slice(i + 1).join('\n');
        const p = pending; pending = null;
        p.resolve({ code, text });
        return;
      }
    }
  }
  function onData(d) { buffer += d.toString('utf8'); tryDeliver(); }
  socket.on('data', onData);
  return {
    read() { return new Promise((resolve) => { pending = { resolve }; tryDeliver(); }); },
    rebind(newSocket) { newSocket.on('data', onData); },
  };
}

function smtpDialog({ host, port, user, pass, secure, sendMail, mail }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let socket;
    const timer = setTimeout(() => fail('timeout SMTP'), 25000);

    function done(err, info) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket && socket.destroy(); } catch {}
      err ? reject(err) : resolve(info || { ok: true });
    }
    function fail(msg) { done(new Error(msg)); }

    async function run() {
      let reader = makeReader(socket);
      const cmd = async (line, expect) => {
        socket.write(line + '\r\n');
        const r = await reader.read();
        if (expect && Math.floor(r.code / 100) !== expect) throw new Error(`SMTP ${r.code}: ${r.text.slice(0, 200)}`);
        return r;
      };
      const greet = await reader.read();
      if (Math.floor(greet.code / 100) !== 2) throw new Error(`SMTP saudação ${greet.code}`);

      await cmd('EHLO studio-ia', 2);

      if (!secure && parseInt(port, 10) === 587) {
        await cmd('STARTTLS', 2);
        const upgraded = await new Promise((res, rej) => {
          const t = tls.connect({ socket, servername: host, rejectUnauthorized: false }, () => res(t));
          t.on('error', rej);
        });
        socket = upgraded;
        reader = makeReader(socket);
        await cmd('EHLO studio-ia', 2);
      }

      await cmd('AUTH LOGIN', 3);
      await cmd(b64(user), 3);
      await cmd(b64(pass), 2);

      if (!sendMail) return { ok: true, info: 'Autenticação SMTP bem-sucedida.' };

      const fromAddr = extractAddr(mail.from || user);
      const toAddr = extractAddr(mail.to);
      await cmd(`MAIL FROM:<${fromAddr}>`, 2);
      await cmd(`RCPT TO:<${toAddr}>`, 2);
      await cmd('DATA', 3);

      const headers = [
        `From: ${mail.from || user}`,
        `To: ${mail.to}`,
        `Subject: ${encodeHeader(mail.subject || '')}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: base64',
      ].join('\r\n');
      const body = b64(mail.text || '').replace(/(.{76})/g, '$1\r\n');
      socket.write(headers + '\r\n\r\n' + body + '\r\n.\r\n');
      const sent = await reader.read();
      if (Math.floor(sent.code / 100) !== 2) throw new Error(`SMTP envio ${sent.code}: ${sent.text.slice(0, 200)}`);

      try { socket.write('QUIT\r\n'); } catch {}
      return { ok: true, info: 'E-mail enviado.' };
    }

    const connectOpts = { host, port: parseInt(port, 10) };
    socket = secure
      ? tls.connect({ ...connectOpts, servername: host, rejectUnauthorized: false }, start)
      : net.connect(connectOpts, start);
    socket.on('error', (e) => fail(e.message));

    function start() {
      run().then((info) => done(null, info)).catch((e) => done(e));
    }
  });
}

function smtpVerify(cfg) {
  const port = parseInt(cfg.port || 465, 10);
  const secure = cfg.secure !== undefined ? cfg.secure : port === 465;
  return smtpDialog({ host: cfg.host, port, user: cfg.user, pass: cfg.pass, secure, sendMail: false });
}

function smtpSend(cfg, mail) {
  const port = parseInt(cfg.port || 465, 10);
  const secure = cfg.secure !== undefined ? cfg.secure : port === 465;
  return smtpDialog({ host: cfg.host, port, user: cfg.user, pass: cfg.pass, secure, sendMail: true, mail });
}

module.exports = { smtpSend, smtpVerify };
