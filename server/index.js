import './dom.js';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { errorKind, renderInvoice } from './render.js';

const PORT = process.env.PORT !== undefined ? Number(process.env.PORT) : 3001;
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES) || 10 * 1024 * 1024; // 10 MB

const CONTENT_TYPES = {
  pdf: 'application/pdf',
  html: 'text/html; charset=utf-8',
};

function collectBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let rejected = false;

    req.on('data', (chunk) => {
      if (rejected) {
        return;
      }
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        rejected = true;
        req.resume(); // drain remaining data so the socket stays usable
        const err = new Error('Payload too large');
        err.status = 413;
        reject(err);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!rejected) {
        resolve(Buffer.concat(chunks));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const requestId = randomUUID();
  const start = Date.now();
  const format =
    req.method === 'POST' ? { '/generate/pdf': 'pdf', '/generate/html': 'html' }[req.url] : undefined;
  let status = 200;

  try {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { status: 'ok' });
    } else if (format) {
      const body = await collectBody(req);

      if (!body.length) {
        status = 400;
        sendJson(res, 400, { error: 'Empty request body' });
      } else {
        const rendered = await renderInvoice(body, {
          format,
          ksefNumber: req.headers['x-ksef-number'],
          qrUrl: req.headers['x-ksef-qrcode'],
        });

        res.writeHead(200, { 'Content-Type': CONTENT_TYPES[format], 'Content-Length': rendered.length });
        res.end(rendered);
      }
    } else {
      status = 404;
      sendJson(res, 404, { error: 'Not found' });
    }
  } catch (err) {
    if (err.status === 413) {
      status = 413;
      sendJson(res, 413, { error: 'Payload too large', requestId });
    } else {
      status = 500;
      // The kind alone: an error's message may quote the document.
      console.error(`[${requestId}] Request failed: ${errorKind(err)}`);
      sendJson(res, 500, { error: 'Internal server error', requestId });
    }
  }

  const duration = Date.now() - start;
  console.log(`[${requestId}] ${req.method} ${req.url} ${status} ${duration}ms`);
});

server.listen(PORT, () => {
  const addr = server.address();
  const actualPort = typeof addr === 'object' ? addr.port : PORT;

  console.log(`ksef-pdf-generator listening on port ${actualPort}`);
});
