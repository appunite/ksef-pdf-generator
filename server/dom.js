import { JSDOM } from 'jsdom';

// Intentional global pollution: the library reads XML through the browser's File and FileReader.
// Each entry point imports this module first and runs as a dedicated process.
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });

globalThis.window = dom.window;
globalThis.document = dom.window.document;
// navigator is read-only on globalThis in Node 20+; override via property descriptor
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  writable: true,
  configurable: true,
});
globalThis.FileReader = dom.window.FileReader;
// Use jsdom's File/Blob so FileReader.readAsText can consume them
globalThis.File = dom.window.File;
globalThis.Blob = dom.window.Blob;
