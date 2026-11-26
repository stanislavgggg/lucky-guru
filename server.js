// Lucky Guru GTA 6 LT landing: zero-dependency static server for Railway.
// Config (Railway > Variables):
//   TG_LINK        Telegram join link the CTA buttons open (required for launch)
//   META_PIXEL_ID  optional; adds the Meta Pixel and tracks CTA clicks as "Lead"
//   GTM_ID         optional; Google Tag Manager container (e.g. GTM-PVHMWFVM)
//   PORT           set by Railway automatically
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, 'public');
const TG_LINK = process.env.TG_LINK || 'https://t.me/YOUR_CHANNEL';
const PIXEL_ID = (process.env.META_PIXEL_ID || '').trim();
const GTM_ID = (process.env.GTM_ID || '').trim();

if (!process.env.TG_LINK) console.warn('[warn] TG_LINK is not set; CTA buttons point to the placeholder link.');
if (GTM_ID && !/^GTM-[A-Z0-9]{4,12}$/.test(GTM_ID)) { console.error('[error] GTM_ID must look like GTM-XXXXXXX.'); process.exit(1); }
if (PIXEL_ID && !/^\d{6,20}$/.test(PIXEL_ID)) { console.error('[error] META_PIXEL_ID must be digits only.'); process.exit(1); }

const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const pixel = PIXEL_ID ? `<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${PIXEL_ID}');fbq('track','PageView');
</script>
<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1"></noscript>` : '';

const gtmHead = GTM_ID ? `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');</script>` : '';
const gtmBody = GTM_ID ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>` : '';

// Render index.html once at boot with config baked in, and pre-compress it.
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .split('__TG_LINK__').join(escAttr(TG_LINK))
  .replace('<!--GTM_HEAD-->', gtmHead)
  .replace('<!--GTM_BODY-->', gtmBody)
  .replace('<!--META_PIXEL-->', pixel);
const htmlBuf = Buffer.from(html);
const htmlBr = zlib.brotliCompressSync(htmlBuf);
const htmlGz = zlib.gzipSync(htmlBuf, { level: 9 });

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json', '.mp4': 'video/mp4', '.webm': 'video/webm'
};

const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000'
};

function send(res, status, headers, body, method) {
  res.writeHead(status, Object.assign({}, BASE_HEADERS, headers));
  res.end(method === 'HEAD' ? undefined : body);
}

function sendIndex(req, res) {
  const ae = req.headers['accept-encoding'] || '';
  const h = { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-cache', 'Vary': 'Accept-Encoding' };
  if (/\bbr\b/.test(ae)) return send(res, 200, Object.assign(h, { 'Content-Encoding': 'br' }), htmlBr, req.method);
  if (/\bgzip\b/.test(ae)) return send(res, 200, Object.assign(h, { 'Content-Encoding': 'gzip' }), htmlGz, req.method);
  return send(res, 200, h, htmlBuf, req.method);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { Allow: 'GET, HEAD' }, '', req.method);

  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { return send(res, 400, {}, 'Bad request', req.method); }

  if (pathname === '/healthz') return send(res, 200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }, 'ok', req.method);
  if (pathname === '/' || pathname === '/index.html') return sendIndex(req, res);
  if (pathname === '/favicon.ico') pathname = '/assets/img/icon-32.png';

  const file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, {}, 'Forbidden', req.method);

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      // Missing assets get a real 404; any other unknown path (ad links with extra segments) lands on the page.
      if (pathname.startsWith('/assets/')) return send(res, 404, { 'Content-Type': 'text/plain' }, 'Not found', req.method);
      return sendIndex(req, res);
    }
    const ext = path.extname(file).toLowerCase();
    const headers = Object.assign({}, BASE_HEADERS, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=2592000' : 'public, max-age=3600',
      'Last-Modified': st.mtime.toUTCString(),
      'Accept-Ranges': 'bytes'
    });
    // Byte ranges: iPhone Safari will not play an inline video without them.
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      let start = m[1] ? parseInt(m[1], 10) : st.size - parseInt(m[2], 10);
      let end = m[1] && m[2] ? parseInt(m[2], 10) : st.size - 1;
      if (start < 0) start = 0;
      if (start >= st.size || end < start) {
        res.writeHead(416, Object.assign(headers, { 'Content-Range': `bytes */${st.size}` }));
        return res.end();
      }
      end = Math.min(end, st.size - 1);
      res.writeHead(206, Object.assign(headers, { 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 }));
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, Object.assign(headers, { 'Content-Length': st.size }));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Lucky Guru GTA landing on :${PORT} | TG_LINK=${TG_LINK} | pixel=${PIXEL_ID ? 'on' : 'off'} | gtm=${GTM_ID || 'off'}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
