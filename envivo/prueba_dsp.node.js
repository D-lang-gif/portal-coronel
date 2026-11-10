// Prueba offline del DSP de voz: tono sintético desafinado → corrección → error en cents.
// Uso: node prueba_dsp.js
const D = require("./js/voz-dsp.js");
const fs = require("fs");
const sr = 48000;

function voz(segmentos) { // [{hz, cents, seg}] → tono con armónicos + formantes simples + jitter
  const out = []; let ph = 0, t = 0;
  for (const s of segmentos) {
    const n = Math.round(s.seg * sr);
    for (let i = 0; i < n; i++, t++) {
      const f = s.hz * Math.pow(2, s.cents / 1200) * (1 + 0.003 * Math.sin(2 * Math.PI * 5.2 * t / sr));
      ph += 2 * Math.PI * f / sr;
      let x = 0;
      for (let k = 1; k <= 20; k++) {
        const fk = k * f, A = (1 / k) * (1 + 2.5 * Math.exp(-((fk - 750) ** 2) / (2 * 150 ** 2)) + 1.5 * Math.exp(-((fk - 1200) ** 2) / (2 * 200 ** 2)));
        x += A * Math.sin(k * ph);
      }
      out.push(0.15 * x);
    }
  }
  return Float32Array.from(out);
}
// medidor independiente (autocorrelación normalizada, ventana 4096)
function f0(x, i0) {
  const W = 2048, lo = Math.floor(sr / 700), hi = Math.floor(sr / 70);
  let best = 0, bt = 0; const r = new Float64Array(hi + 2);
  for (let t = lo - 1; t <= hi + 1; t++) {
    let s = 0, e1 = 0, e2 = 0;
    for (let i = 0; i < W; i++) { const a = x[i0 + i], b = x[i0 + i + t]; s += a * b; e1 += a * a; e2 += b * b; }
    r[t] = s / Math.sqrt(e1 * e2 + 1e-12);
  }
  // primer pico alto (evita errores de octava)
  let maxr = 0; for (let t = lo; t <= hi; t++) maxr = Math.max(maxr, r[t]);
  for (let t = lo; t <= hi; t++) if (r[t] > 0.9 * maxr && r[t] >= r[t - 1] && r[t] >= r[t + 1]) { bt = t; break; }
  const a = r[bt - 1], b = r[bt], c = r[bt + 1], den = a - 2 * b + c;
  return sr / (den ? bt + 0.5 * (a - c) / den : bt);
}
function correr(x, params) {
  const m = new D.MotorVoz(sr); m.set(params);
  const L = new Float32Array(x.length), c1 = new Float32Array(x.length), c2 = new Float32Array(x.length);
  for (let o = 0; o + 128 <= x.length; o += 128)
    m.procesar(x.subarray(o, o + 128), L.subarray(o, o + 128), c1.subarray(o, o + 128), c2.subarray(o, o + 128));
  return { L, c1, c2, lat: m.latenciaMs() };
}
function nota(m) { const n = Math.round(m); return D.NOMBRES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1); }
function informe(nombre, y, tiempos) {
  const filas = [];
  for (const t of tiempos) {
    const f = f0(y, Math.round(t * sr)), m = D.hz2midi(f), n = Math.round(m);
    filas.push({ t, hz: f.toFixed(2), nota: nota(m), cents: +(100 * (m - n)).toFixed(1) });
  }
  console.log("\n" + nombre); console.table(filas); return filas;
}
function wav(nombre, canales) {
  const n = canales[0].length, ch = canales.length, b = Buffer.alloc(44 + n * ch * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * ch * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * ch * 2, 28);
  b.writeUInt16LE(ch * 2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * ch * 2, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(canales[c][i] * 32767))), 44 + (i * ch + c) * 2);
  fs.writeFileSync(nombre, b);
}

const x = voz([{ hz: 220, cents: 45, seg: 1.5 }, { hz: 261.63, cents: -35, seg: 1.5 }, { hz: 329.63, cents: 30, seg: 1.5 }]);
const T = [0.6, 1.2, 2.1, 2.7, 3.6, 4.2];
const res = {};
res.original = informe("ORIGINAL (desafinado: La +45, Do -35, Mi +30)", x, T);
const a = correr(x, { tonica: 9, escala: "menor", fuerza: 1, velocidadMs: 15, compuertaDb: -70 });
res.corregido = informe("CORRECCIÓN 100% · La menor · velocidad 15 ms", a.L, T);
const b = correr(x, { tonica: 9, escala: "menor", fuerza: 0.5, velocidadMs: 15, compuertaDb: -70 });
res.mitad = informe("CORRECCIÓN 50% (debe quedar a la mitad)", b.L, T);
const c = correr(x, { tonica: 9, escala: "menor", fuerza: 1, velocidadMs: 15, coros: true, compuertaDb: -70 });
res.coroArriba = informe("CORO ARRIBA (3ra en La menor: La→Do, Do→Mi, Mi→Sol)", c.c1, T);
res.coroAbajo = informe("CORO ABAJO (6ta abajo: La→Do, Do→Mi, Mi→Sol una octava abajo)", c.c2, T);
const v = correr(x, { tonica: 9, escala: "menor", fuerza: 1, velocidadMs: 15, vibratoCents: 35, vibratoHz: 5.5, compuertaDb: -70 });
// vibrato: oscilación medida con ventanas cortas
const osc = []; for (let k = 0; k < 60; k++) osc.push(D.hz2midi(f0(v.L, Math.round((0.5 + k * 0.012) * sr))) * 100);
const med = osc.reduce((s, q) => s + q, 0) / osc.length;
const pp = Math.max(...osc) - Math.min(...osc);
console.log(`\nVIBRATO 35 cents @5.5 Hz → oscilación medida pico a pico ${pp.toFixed(1)} cents (esperado ~70)`);
console.log(`Latencia del desplazador de tono: ~${a.lat.toFixed(1)} ms`);
// tiempo de CPU
const t0 = process.hrtime.bigint(); correr(x, { coros: true, compuertaDb: -70 }); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
console.log(`CPU: ${ms.toFixed(0)} ms para ${(x.length / sr).toFixed(1)} s de audio con coros (${(100 * ms / (1000 * x.length / sr)).toFixed(1)}% de un núcleo de esta PC)`);
fs.writeFileSync("resultado_dsp.json", JSON.stringify({ ...res, vibrato_pp_cents: pp, latencia_ms: a.lat, cpu_pct: 100 * ms / (1000 * x.length / sr) }, null, 1));
wav("voz_sintetica_original.wav", [x]);
wav("voz_corregida_con_coros.wav", [Float32Array.from(c.L, (s, i) => 0.6 * s + 0.35 * c.c1[i] + 0.2 * c.c2[i])]);
