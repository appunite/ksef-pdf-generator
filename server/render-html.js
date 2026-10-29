import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PdfmakeHtmlRenderer } from 'pdfmake-html-renderer/server';
import QRCode from 'qrcode';

const require = createRequire(import.meta.url);
const cssPath = require.resolve('pdfmake-html-renderer/dist/index.css');
const baseCss = readFileSync(cssPath, 'utf-8');

// The renderer draws a QR code inside `{#await}`, which server-side rendering leaves pending, so
// every `qr` node becomes an image as a data URL before rendering.
async function inlineQrCodes(node) {
  if (Array.isArray(node)) {
    return Promise.all(node.map(inlineQrCodes));
  }
  if (node === null || typeof node !== 'object') {
    return node;
  }
  if (typeof node.qr === 'string') {
    const { qr, fit, eccLevel, ...rest } = node;
    const image = await QRCode.toDataURL(qr, { margin: 0, errorCorrectionLevel: eccLevel || 'L' });
    const size = fit || 100;

    return { ...rest, image, width: size, height: size };
  }
  const entries = await Promise.all(
    Object.entries(node).map(async ([key, value]) => [
      key,
      typeof value === 'function' ? value : await inlineQrCodes(value),
    ])
  );

  return Object.fromEntries(entries);
}

export async function renderDocDefinitionToHtml(docDefinition) {
  const { html: body, css: componentCss } = PdfmakeHtmlRenderer.render({
    document: await inlineQrCodes(docDefinition),
    pageShadow: false,
    mode: 'natural',
  });

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Faktura</title>
<style>${baseCss}\n${componentCss.code}</style>
</head>
<body>${body}</body>
</html>`;
}
