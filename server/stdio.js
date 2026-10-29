// Spike: the generator over stdin/stdout, for a parent that holds this process as a port.
// Each message, both ways, is a 4-byte big-endian length followed by that many bytes: a 4-byte
// length of a JSON header, the header, then the body (the XML in, the PDF or HTML out).
// Request header: {format: "pdf" | "html", ksef_number?, qr_url?}. Response: {ok: true} or
// {ok: false, kind}. Requests are answered in order, one at a time. EOF on stdin ends the process.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
globalThis.FileReader = dom.window.FileReader;
globalThis.File = dom.window.File;
globalThis.Blob = dom.window.Blob;

const { generateInvoice, buildInvoiceDocDefinition } = await import('../dist/ksef-fe-invoice-converter.js');
const { renderDocDefinitionToHtml } = await import('./render-html.js');

function frame(header, body = Buffer.alloc(0)) {
  const json = Buffer.from(JSON.stringify(header));
  const head = Buffer.alloc(8);
  head.writeUInt32BE(4 + json.length + body.length, 0);
  head.writeUInt32BE(json.length, 4);

  return Buffer.concat([head, json, body]);
}

function kindOf(err) {
  const message = String(err && err.message);
  if (message.startsWith('Unknown XML Version')) {
    return 'unsupported_schema';
  }

  return 'render_error';
}

async function handle(payload) {
  const headerLength = payload.readUInt32BE(0);
  const header = JSON.parse(payload.subarray(4, 4 + headerLength).toString('utf8'));
  const xml = payload.subarray(4 + headerLength);
  const file = new File([xml], 'invoice.xml', { type: 'text/xml' });
  const data = { nrKSeF: header.ksef_number || '', qrCode: header.qr_url || undefined };

  try {
    if (header.format === 'pdf') {
      const base64 = await generateInvoice(file, data, 'base64');

      return frame({ ok: true }, Buffer.from(base64, 'base64'));
    }
    const html = await renderDocDefinitionToHtml(await buildInvoiceDocDefinition(file, data));

    return frame({ ok: true }, Buffer.from(html, 'utf8'));
  } catch (err) {
    // The kind alone: an error's message may quote the document.
    const kind = kindOf(err);
    process.stderr.write(`ksef-pdf-generator: ${header.format} failed: ${kind}\n`);

    return frame({ ok: false, kind });
  }
}

let buffer = Buffer.alloc(0);
let queue = Promise.resolve();

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (buffer.length >= 4 && buffer.length >= 4 + buffer.readUInt32BE(0)) {
    const length = buffer.readUInt32BE(0);
    const payload = buffer.subarray(4, 4 + length);
    buffer = buffer.subarray(4 + length);
    queue = queue.then(() => handle(payload)).then((out) => {
      process.stdout.write(out);
    });
  }
});
process.stdin.on('end', () => {
  queue.then(() => process.exit(0));
});
