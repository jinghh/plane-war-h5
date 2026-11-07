#!/usr/bin/env node
/* 可选本地静态服务器：node serve.mjs（监听 0.0.0.0，默认 http://0.0.0.0:8080） */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const host = process.env.HOST || '0.0.0.0';
const basePort = Number(process.env.PORT || 8080);
const mainUrl = process.env.PLANE_WAR_URL || '';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8'
};

function lanAddresses() {
  const out = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) out.push(a.address);
    }
  }
  return out;
}

function handler(req, res) {
  const url = req.url.split('?')[0];
  const rel = url === '/' ? 'index.html' : decodeURIComponent(url.replace(/^\/+/, ''));
  const file = path.join(root, rel);
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}

function start(port, attemptsLeft) {
  const server = http.createServer(handler);
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      const next = port + 1;
      console.log('[serve] 端口 ' + port + ' 已被占用，尝试 ' + next + ' …');
      server.close();
      start(next, attemptsLeft - 1);
      return;
    }
    console.error('[serve] 启动失败：' + err.message);
    process.exit(1);
  });
  server.listen(port, host, () => {
    console.log('[serve] 监听 ' + host + ':' + port);
    console.log('[serve] 本机访问 http://localhost:' + port + '/');
    for (const ip of lanAddresses()) {
      console.log('[serve] 局域网访问 http://' + ip + ':' + port + '/');
    }
    if (mainUrl) console.log('[serve] 建议手机打开 ' + mainUrl);
    console.log('PLANE_WAR_PORT=' + port);
  });
}

start(basePort, 10);

