const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const DIST = '/home/test/Desktop/full-stack-app/frontend/dist';
const SSL_KEY = '/home/test/ssl/seedlab.key';
const SSL_CERT = '/home/test/ssl/seedlab.crt';
const PORT = 8443;
const HTTP_PORT = 8080;

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

function serveStatic(req, res) {
  // proxy /api/ to backend
  if (req.url.startsWith('/api/')) {
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: '127.0.0.1:3000' },
    };
    const proxy = http.request(options, (backRes) => {
      res.writeHead(backRes.statusCode, backRes.headers);
      backRes.pipe(res);
    });
    proxy.on('error', (e) => {
      res.writeHead(502);
      res.end('Backend error: ' + e.message);
    });
    req.pipe(proxy);
    return;
  }

  // serve static files
  let filePath = path.join(DIST, req.url.split('?')[0]);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html');
  }

  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

// HTTPS server on 8443
const sslOpts = {
  key:  fs.readFileSync(SSL_KEY),
  cert: fs.readFileSync(SSL_CERT),
};
https.createServer(sslOpts, serveStatic).listen(PORT, '130.1.35.63', () => {
  console.log(`HTTPS server running on 130.1.35.63:${PORT}`);
});

// HTTP → HTTPS redirect on 8080
http.createServer((req, res) => {
  res.writeHead(301, { Location: `https://130.1.35.63:8443${req.url}` });
  res.end();
}).listen(HTTP_PORT, '130.1.35.63', () => {
  console.log(`HTTP redirect running on 130.1.35.63:${HTTP_PORT}`);
});
