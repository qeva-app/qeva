// server.js — Custom HTTPS server wrapper for Qeva
// Wraps Next.js with HTTPS using SSL certs from certs/ directory
// Starts weekly email scheduler after Next.js is ready

const { createServer } = require('https');
const { createServer: createHttpServer } = require('http');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3100', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const certsDir = path.join(__dirname, 'certs');
const hasSSL =
  fs.existsSync(path.join(certsDir, 'privkey.pem')) &&
  fs.existsSync(path.join(certsDir, 'fullchain.pem'));

app.prepare().then(() => {
  const requestHandler = (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  };

  let server;

  if (hasSSL) {
    const httpsOptions = {
      key: fs.readFileSync(path.join(certsDir, 'privkey.pem')),
      cert: fs.readFileSync(path.join(certsDir, 'fullchain.pem')),
    };
    server = createServer(httpsOptions, requestHandler);
    console.log(`> HTTPS server ready`);
  } else {
    server = createHttpServer(requestHandler);
    console.log(`> HTTP server ready (no SSL certs found in certs/)`);
  }

  server.listen(port, hostname, () => {
    console.log(`> Ready on ${hasSSL ? 'https' : 'http'}://${hostname}:${port}`);

    // Start schedulers after server is ready
    try {
      require('./src/lib/init-schedulers');
      console.log('> Schedulers initialized');
    } catch (e) {
      console.warn('> Could not initialize schedulers:', e.message);
    }
  });
});
