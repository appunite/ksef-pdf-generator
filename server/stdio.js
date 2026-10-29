import './dom.js';
import { errorKind, renderInvoice } from './render.js';

// The generator for a parent that holds this process as a port, with no socket of its own.
//
// Each message, both ways, is a 4-byte big-endian length followed by that many bytes: a 4-byte
// big-endian length of a JSON header, the header, then the body.
//   request:  {"format": "pdf" | "html", "ksef_number"?: string, "qr_url"?: string}, the XML
//   response: {"ok": true}, the PDF or HTML; or {"ok": false, "kind": string}, no body
// Requests are answered one at a time, in the order they came. stdout carries nothing but
// responses; stderr gets a line per failure, naming its kind and never the document. The
// process exits once stdin closes and the requests already read are answered.

function encode(header, body = Buffer.alloc(0)) {
  const json = Buffer.from(JSON.stringify(header), 'utf8');
  const lengths = Buffer.alloc(8);

  lengths.writeUInt32BE(4 + json.length + body.length, 0);
  lengths.writeUInt32BE(json.length, 4);

  return Buffer.concat([lengths, json, body]);
}

async function answer(message) {
  try {
    const headerLength = message.readUInt32BE(0);
    const header = JSON.parse(message.subarray(4, 4 + headerLength).toString('utf8'));
    const body = await renderInvoice(message.subarray(4 + headerLength), {
      format: header.format,
      ksefNumber: header.ksef_number,
      qrUrl: header.qr_url,
    });

    return encode({ ok: true }, body);
  } catch (err) {
    const kind = errorKind(err);

    process.stderr.write(`ksef-pdf-generator: request failed: ${kind}\n`);

    return encode({ ok: false, kind });
  }
}

let pending = Buffer.alloc(0);
let answered = Promise.resolve();

process.stdin.on('data', (chunk) => {
  pending = Buffer.concat([pending, chunk]);

  while (pending.length >= 4 && pending.length >= 4 + pending.readUInt32BE(0)) {
    const message = pending.subarray(4, 4 + pending.readUInt32BE(0));

    pending = pending.subarray(4 + message.length);
    answered = answered
      .then(() => answer(message))
      .then((response) => {
        process.stdout.write(response);
      });
  }
});

process.stdin.on('end', () => {
  answered.then(() => process.exit(0));
});
