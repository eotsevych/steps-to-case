// Local investigation fixture. Does not change the extension or recording state.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  root,
  configFile: false,
  logLevel: 'silent',
  build: {
    write: false,
    minify: false,
    lib: {
      entry: `${root}src/injected/selectorGenerator.ts`,
      name: 'LocatorEngine',
      formats: ['iife'],
    },
  },
});
const bundle = (Array.isArray(result) ? result[0] : result).output.find(item => item.type === 'chunk').code;
const html = await readFile(new URL('../test-pages/locator-diagnostics/index.html', import.meta.url));
const port = Number(process.env.LOCATOR_DEMO_PORT || 4174);
const server = createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  if (request.url === '/' || request.url === '/index.html') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(html);
  } else if (request.url === '/recorder-selectors.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    response.end(bundle);
  } else {
    response.writeHead(404);
    response.end('Not found');
  }
});
server.on('error', error => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Locator use case: http://127.0.0.1:${server.address().port}`);
  console.log('Uses the current src/injected/selectorGenerator.ts with its default settings.');
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close());
}
