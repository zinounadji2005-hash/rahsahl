const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Decode URL to handle spaces/special characters
  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(req.url);
  } catch (e) {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }

  // Map root to index.html
  let target = decodedUrl === '/' || decodedUrl === '/dashboard' || decodedUrl === '/dashboard/' 
    ? 'dashboard/index.html' 
    : decodedUrl;

  let filePath = path.join(PUBLIC_DIR, target);

  // Prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.statusCode = 404;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1><p>The requested file was not found.</p>');
      } else {
        res.statusCode = 500;
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 RahSahl Dashboard is running locally!`);
  console.log(`👉 Open your browser at: http://localhost:${PORT}/dashboard/index.html`);
  console.log(`Press Ctrl+C to stop.\n`);
});
