const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const initialPort = Number(process.env.PORT) || 8000;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.aspx': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.apk': 'application/vnd.android.package-archive',
  '.exe': 'application/octet-stream'
};

const publicPrefixes = ['/index.html', '/app.html', '/css/', '/img/', '/script/', '/footer/', '/licence/', '/downloads/', '/Login%20and%20Registration/', '/Login and Registration/'];
const deniedFragments = ['/db/', '/.git', '/node_modules', '/package.json', '/auth-server.js', '/server.js', '/.env', '..'];

function startServer(port) {
  const server = http.createServer((req, res) => {
    let requestPath = decodeURIComponent(req.url.split('?')[0]);
    if (requestPath === '/') requestPath = '/index.html';
    if (requestPath.startsWith('/app/')) requestPath = '/app.html';

    if (deniedFragments.some(fragment => requestPath.includes(fragment))) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      res.end('Forbidden');
      return;
    }

    const isPublicRequest = publicPrefixes.some(prefix => requestPath === prefix.slice(0, -1) || requestPath.startsWith(prefix));
    if (!isPublicRequest && !requestPath.startsWith('/')) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      res.end('Forbidden');
      return;
    }

    const filePath = path.resolve(root, `.${requestPath}`);
    const ext = path.extname(filePath).toLowerCase();

    if (!filePath.startsWith(root)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      });
      res.end(data);
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} kullanımda, ${port + 1} portuna geçiliyor...`);
      startServer(port + 1);
    } else {
      console.error(err);
    }
  });

  server.listen(port, () => {
    console.log(`T.U App Store sunucusu http://localhost:${port} adresinde çalışıyor.`);
  });
}

startServer(initialPort);

