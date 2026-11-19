// Usage: node loadtest.js <base-url> [concurrency=50] [seconds=30] [work-ms=300]
// Sends slow requests non-stop and reports which instances answered.
const [base, concArg, secsArg, msArg] = process.argv.slice(2);
if (!base) {
  console.error('Usage: node loadtest.js <base-url> [concurrency=50] [seconds=30] [work-ms=300]');
  process.exit(1);
}
const concurrency = Number(concArg) || 50;
const seconds = Number(secsArg) || 30;
const workMs = Number(msArg) || 300;
const url = `${base.replace(/\/$/, '')}/api/work?ms=${workMs}`;

const perInstance = {};
const times = [];
let failed = 0;
const endAt = Date.now() + seconds * 1000;

async function worker() {
  while (Date.now() < endAt) {
    const t = Date.now();
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      perInstance[body.instance] = (perInstance[body.instance] || 0) + 1;
      times.push(Date.now() - t);
    } catch {
      failed++;
    }
  }
}

function report(final) {
  const done = times.length;
  const ids = Object.keys(perInstance);
  if (!final) {
    process.stdout.write(`\r${done} ok, ${failed} failed, ${ids.length} instance(s)   `);
    return;
  }
  const sorted = [...times].sort((a, b) => a - b);
  const pct = p => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
  console.log(`\n\nRequests: ${done} ok, ${failed} failed (${(done / seconds).toFixed(1)} req/s)`);
  console.log(`Latency:  median ${pct(0.5)} ms, p95 ${pct(0.95)} ms, max ${sorted.at(-1) ?? 0} ms`);
  console.log(`Instances that answered: ${ids.length}`);
  for (const [id, n] of Object.entries(perInstance).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${id}  ${String(n).padStart(6)}  ${'#'.repeat(Math.ceil((n / done) * 40))}`);
  }
}

console.log(`Hitting ${url}\n${concurrency} at once for ${seconds}s...`);
const ticker = setInterval(() => report(false), 500);
Promise.all(Array.from({ length: concurrency }, worker)).then(() => {
  clearInterval(ticker);
  report(true);
});
