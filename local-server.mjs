import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 7001);
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.mp3', 'audio/mpeg']
]);

function safePath(urlPath) {
  const pathname = decodeURIComponent(urlPath.split('?')[0] || '/');
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = path.resolve(root, relative);
  return candidate.startsWith(root + path.sep) ? candidate : null;
}

const server = http.createServer(async (request, response) => {
  try {
    const file = safePath(request.url || '/');
    if (!file) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    const body = await fs.readFile(file);
    response.writeHead(200, {
      'content-type': mime.get(path.extname(file).toLowerCase()) || 'application/octet-stream',
      'cache-control': 'no-cache'
    });
    response.end(body);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    console.warn('[learning-center-server] request failed:', error);
    response.writeHead(500);
    response.end('Internal server error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Learning Center: http://127.0.0.1:${port}/`);
});
