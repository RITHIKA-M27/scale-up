// Scale lab: a tiny backend for watching load balancing and autoscaling.
// No dependencies - plain Node.
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

// Every running copy of this server gets its own random ID at startup.
// Seeing different IDs in responses = the load balancer is spreading requests.
const INSTANCE_ID = crypto.randomBytes(3).toString('hex');
const STARTED_AT = Date.now();

// State kept in this process's memory. Each instance has its OWN copy,
// which is exactly the problem /api/counter demonstrates.
let requestsServed = 0;
let counter = 0;

function whoami() {
  return {
    instance: INSTANCE_ID,
    hostname: os.hostname(),
    revision: process.env.K_REVISION || 'local',
    uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
    requestsServedByThisInstance: requestsServed,
  };
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

// Burn CPU for `ms` milliseconds (blocks this instance, like heavy real work).
function burnCpu(ms) {
  const end = Date.now() + ms;
  let x = 0;
  while (Date.now() < end) x += Math.sqrt(Math.random());
  return x;
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  requestsServed++;

  // Which instance answered?
  if (url.pathname === '/api/whoami') {
    return sendJson(res, 200, whoami());
  }

  // Simulated slow request. ?ms=300 waits (like a slow database call),
  // ?cpu=300 burns CPU (like image processing). Both capped at 5s.
  if (url.pathname === '/api/work') {
    const waitMs = clamp(Number(url.searchParams.get('ms')) || 0, 0, 5000);
    const cpuMs = clamp(Number(url.searchParams.get('cpu')) || 0, 0, 5000);
    if (cpuMs) burnCpu(cpuMs);
    return setTimeout(
      () => sendJson(res, 200, { ...whoami(), waitedMs: waitMs, cpuMs }),
      waitMs
    );
  }

  // In-memory counter: correct with 1 instance, wrong with several,
  // because each instance counts separately.
  if (url.pathname === '/api/counter') {
    counter++;
    return sendJson(res, 200, { instance: INSTANCE_ID, counter });
  }

  if (url.pathname === '/healthz') {
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
  }

  sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`instance ${INSTANCE_ID} listening on port ${PORT}`);
});

// Cloud Run sends SIGTERM before removing an instance (scale down).
process.on('SIGTERM', () => {
  console.log(`instance ${INSTANCE_ID} shutting down`);
  server.close(() => process.exit(0));
});
