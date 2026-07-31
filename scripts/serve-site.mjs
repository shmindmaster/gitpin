import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, isAbsolute, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'site');
const port = Number(process.env.REPOCONTEXT_SITE_PORT ?? 4173);
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  const requestPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const path = resolve(root, requestPath);
  const pathFromRoot = relative(root, path);
  if (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot) || !existsSync(path) || !statSync(path).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-type': types[extname(path)] ?? 'application/octet-stream',
  });
  createReadStream(path).pipe(response);
}).listen(port, '127.0.0.1', () => {
  process.stderr.write(`GitPin site ready at http://127.0.0.1:${port}\n`);
});
