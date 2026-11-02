/**
 * Локальная разработка без Vercel CLI и сторонних зависимостей.
 * Использует тот же API-обработчик, который выполняется на Vercel.
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import apiHandler from './api/submit.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = resolve(ROOT, 'public');
const ENV_FILE = resolve(ROOT, '.env');

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ message }));
}

async function handleApi(req, res, baseUrl) {
  try {
    const buffers = [];
    let total = 0;
    for await (const chunk of req) {
      total += chunk.byteLength;
      if (total > 12 * 1024) {
        sendJson(res, 413, 'Слишком большой запрос.');
        return;
      }
      buffers.push(chunk);
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) headers.set(name, value.join(', '));
      else if (value != null) headers.set(name, value);
    }
    const request = new Request(new URL(req.url, baseUrl), {
      method: req.method,
      headers,
      ...(req.method !== 'GET' && req.method !== 'HEAD'
        ? { body: Buffer.concat(buffers) }
        : {}),
    });
    const response = await apiHandler.fetch(request);
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error('API error:', error);
    if (!res.headersSent) sendJson(res, 500, 'Внутренняя ошибка сервера.');
    else res.end();
  }
}

async function handleStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }

  let decoded;
  try { decoded = decodeURIComponent(pathname); }
  catch { sendJson(res, 400, 'Некорректный адрес.'); return; }

  const filePath = resolve(PUBLIC_DIR, '.' + (decoded === '/' ? '/index.html' : decoded));
  const rel = relative(PUBLIC_DIR, filePath);
  if (rel === '..' || rel.startsWith(`..${sep}`) || resolve(PUBLIC_DIR, rel) !== filePath) {
    sendJson(res, 403, 'Доступ запрещён.');
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw Object.assign(new Error('Not a file'), { code: 'ENOENT' });
    const bytes = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') sendJson(res, 404, 'Не найдено.');
    else {
      console.error('File read error:', error);
      sendJson(res, 500, 'Ошибка чтения файла.');
    }
  }
}

export function createLocalServer() {
  return http.createServer(async (req, res) => {
    const baseUrl = `http://${req.headers.host || 'localhost'}`;
    let pathname;
    try { pathname = new URL(req.url || '/', baseUrl).pathname; }
    catch { sendJson(res, 400, 'Некорректный адрес.'); return; }
    if (pathname === '/api/submit') {
      await handleApi(req, res, baseUrl);
    } else {
      await handleStatic(req, res, pathname);
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number.parseInt(process.env.PORT || '3000', 10);
  const server = createLocalServer();
  server.listen(port, '127.0.0.1');
  await once(server, 'listening');
  console.log(`\nАнкета доступна: http://localhost:${server.address().port}`);
  console.log(existsSync(ENV_FILE)
    ? 'Настройки Telegram: .env'
    : 'Создай .env из .env.example, чтобы включить отправку в Telegram.');
}
