/* ==============================================================
   Minimal static server for the Docker deploy.
   Serves index.html and config.js (written by build-config.js at
   container start). Listens on $PORT (Render sets it; default 10000)
   on 0.0.0.0 so Render can reach the container.
   ============================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

// Only these files are served; everything else is 404.
const FILES = {
  '/':           { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/index.html': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/config.js':  { file: 'config.js',  type: 'text/javascript; charset=utf-8' },
};

http.createServer((req, res) => {
  const route = FILES[new URL(req.url, 'http://localhost').pathname];
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    return res.end('Method not allowed');
  }
  if (!route) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  fs.readFile(path.join(__dirname, route.file), (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': route.type, 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}).listen(PORT, HOST, () => {
  console.log(`Rhythm Game serving on http://${HOST}:${PORT}`);
});
