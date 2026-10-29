// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const invoice = readFileSync(join(__dirname, '..', 'assets', 'invoice.xml'));
const ksefNumber = '5265877635-20260201-0100A0B1C2D3-4E';
const qrUrl = 'https://qr-test.ksef.mf.gov.pl/invoice/5265877635/01-02-2026/UtQp9Gabc';

interface Response {
  header: { ok: boolean; kind?: string };
  body: Buffer;
}

interface Generator {
  process: ChildProcessWithoutNullStreams;
  stderr: () => string;
  next: () => Promise<Response>;
}

let generator: Generator | undefined;

function start(): Generator {
  const child = spawn('node', [join(__dirname, 'stdio.js')]);
  const waiting: ((response: Response) => void)[] = [];
  const received: Response[] = [];
  let pending = Buffer.alloc(0);
  let stderr = '';

  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  child.stdout.on('data', (chunk: Buffer) => {
    pending = Buffer.concat([pending, chunk]);
    while (pending.length >= 4 && pending.length >= 4 + pending.readUInt32BE(0)) {
      const message = pending.subarray(4, 4 + pending.readUInt32BE(0));
      const headerLength = message.readUInt32BE(0);
      const response = {
        header: JSON.parse(message.subarray(4, 4 + headerLength).toString('utf8')),
        body: message.subarray(4 + headerLength),
      };

      pending = pending.subarray(4 + message.length);
      const resolve = waiting.shift();

      if (resolve) {
        resolve(response);
      } else {
        received.push(response);
      }
    }
  });

  return {
    process: child,
    stderr: (): string => stderr,
    next: (): Promise<Response> => {
      const response = received.shift();

      return response ? Promise.resolve(response) : new Promise((resolve) => waiting.push(resolve));
    },
  };
}

function message(header: object, body: Buffer): Buffer {
  const json = Buffer.from(JSON.stringify(header), 'utf8');
  const lengths = Buffer.alloc(8);

  lengths.writeUInt32BE(4 + json.length + body.length, 0);
  lengths.writeUInt32BE(json.length, 4);

  return Buffer.concat([lengths, json, body]);
}

function ask(header: object, body: Buffer): Promise<Response> {
  generator ??= start();
  generator.process.stdin.write(message(header, body));

  return generator.next();
}

afterEach(() => {
  generator?.process.kill('SIGKILL');
  generator = undefined;
});

describe('ksef-pdf stdio process', () => {
  it('answers a PDF of the invoice', async () => {
    const { header, body } = await ask({ format: 'pdf', ksef_number: ksefNumber, qr_url: qrUrl }, invoice);

    expect(header).toEqual({ ok: true });
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
  }, 20000);

  it('answers HTML with the KSeF number and the QR code as a data image', async () => {
    const { header, body } = await ask({ format: 'html', ksef_number: ksefNumber, qr_url: qrUrl }, invoice);
    const html = body.toString('utf8');

    expect(header).toEqual({ ok: true });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain(ksefNumber);
    expect(html).toMatch(/<img[^>]+src="data:image\/png;base64,/);
    expect(html).not.toContain('<script');
  }, 20000);

  it('answers requests written at once, in order', async () => {
    generator = start();
    generator.process.stdin.write(
      Buffer.concat([message({ format: 'html' }, invoice), message({ format: 'pdf' }, invoice)])
    );

    const first = await generator.next();
    const second = await generator.next();

    expect(first.body.toString('utf8', 0, 15)).toBe('<!DOCTYPE html>');
    expect(second.body.subarray(0, 5).toString()).toBe('%PDF-');
  }, 20000);

  it('names a malformed document parse_error, and logs nothing of it', async () => {
    const secret = 'SECRET-TAX-ID-12345';
    const { header, body } = await ask({ format: 'pdf' }, Buffer.from(`<a><b>${secret}</a>`));

    expect(header).toEqual({ ok: false, kind: 'parse_error' });
    expect(body.length).toBe(0);
    expect(generator!.stderr()).toContain('parse_error');
    expect(generator!.stderr()).not.toContain(secret);
  }, 20000);

  it('names a document of another schema unsupported_schema', async () => {
    const xml = Buffer.from('<Faktura><Naglowek><KodFormularza kodSystemowy="FA (9)"/></Naglowek></Faktura>');

    expect((await ask({ format: 'html' }, xml)).header).toEqual({ ok: false, kind: 'unsupported_schema' });
  }, 20000);

  it('names an unknown format unknown_format', async () => {
    expect((await ask({ format: 'docx' }, invoice)).header).toEqual({ ok: false, kind: 'unknown_format' });
  }, 20000);

  it('keeps answering after a failure', async () => {
    await ask({ format: 'pdf' }, Buffer.from('<a><b></a>'));

    expect((await ask({ format: 'pdf' }, invoice)).header).toEqual({ ok: true });
  }, 20000);

  it('exits 0 once stdin closes', async () => {
    generator = start();
    const exited = new Promise<number | null>((resolve) => generator!.process.on('exit', resolve));

    generator.process.stdin.end();

    expect(await exited).toBe(0);
  }, 20000);
});
