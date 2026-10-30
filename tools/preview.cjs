const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', 'index.html');
const port = Number(process.env.KYUDO_PREVIEW_PORT || 5173);
const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405); res.end(); return;
  }
  const url = new URL(req.url, 'http://127.0.0.1');
  if (!['/', '/index.html', '/feedback.js', '/late-join.js', '/__preview-feedback.js'].includes(url.pathname)) {
    res.writeHead(404); res.end(); return;
  }
  try {
    if (['/feedback.js', '/late-join.js', '/__preview-feedback.js'].includes(url.pathname)) {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      const scriptFile = url.pathname === '/__preview-feedback.js' ? path.join(__dirname, 'feedback-demo.js') : path.join(__dirname, '..', url.pathname.slice(1));
      res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(scriptFile)); return;
    }
    let html = fs.readFileSync(file, 'utf8').replace('<body>',
      '<body><div style="padding:10px;background:#fff0bf;color:#382900;text-align:center">開発プレビュー：外部通信を遮断しています。本番データは表示・更新されません。</div>');
    if (url.searchParams.get('preview') === 'other') {
      html = html.replace(/<\/body>\s*<\/html>\s*$/, '<script src="/__preview-feedback.js"></script></body></html>');
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "connect-src 'none'; script-src 'self' 'unsafe-inline'; form-action 'none'; object-src 'none'; frame-src 'none'",
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(req.method === 'HEAD' ? undefined : html);
  } catch (error) {
    console.error(error.message);
    res.writeHead(500); res.end('Unable to read index.html');
  }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => {
  console.log(`開発プレビュー: http://127.0.0.1:${port}`);
  console.log('Firebase通信は遮断されます。終了: Ctrl+C');
});
