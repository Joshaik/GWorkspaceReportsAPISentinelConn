/* Lightweight joshaik shim for tests */
/* jshint esversion: 8, node: true */
const dgram = require('dgram');

function udpEchoDemo(host = '127.0.0.1', port = 4210, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const sock = dgram.createSocket('udp4');
    const message = Buffer.from(new Date().toISOString());

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { sock.close(); } catch (e) { /* eslint-disable-next-line no-console */ console.warn('udpEchoDemo timer socket close error', e && e.message ? e.message : e); }
        resolve({ ok: false, reason: 'timeout' });
      }
    }, timeoutMs);

    sock.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        try { sock.close(); } catch (e) { /* eslint-disable-next-line no-console */ console.warn('udpEchoDemo error socket close error', e && e.message ? e.message : e); }
        resolve({ ok: false, reason: err && err.message ? err.message : String(err) });
      }
    });

    sock.on('message', (msg, rinfo) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { sock.close(); } catch (e) { /* eslint-disable-next-line no-console */ console.warn('udpEchoDemo message socket close error', e && e.message ? e.message : e); }
      resolve({ ok: true, message: msg.toString(), from: rinfo });
    });

    sock.send(message, port, host, (err) => {
      if (err && !settled) {
        settled = true;
        clearTimeout(timer);
        try { sock.close(); } catch (e) { /* eslint-disable-next-line no-console */ console.warn('udpEchoDemo send socket close error', e && e.message ? e.message : e); }
        resolve({ ok: false, reason: err && err.message ? err.message : String(err) });
      }
    });
  });
}

module.exports = { udpEchoDemo };
