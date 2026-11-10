/* Coronel En Vivo — DSP de voz (sin dependencias).
 * YIN (detección de tono) + desplazador de tono granular sincronizado al periodo
 * + corrección a la escala, vibrato, coros (armonías) y compuerta de ruido.
 * Se usa dentro del AudioWorklet y también en Node para pruebas offline.
 */
(function (G) {
  "use strict";
  const NOMBRES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const ESCALAS = {
    mayor: [0, 2, 4, 5, 7, 9, 11],
    menor: [0, 2, 3, 5, 7, 8, 10],
    menor_armonica: [0, 2, 3, 5, 7, 8, 11],
    pentatonica: [0, 2, 4, 7, 9],
    cromatica: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  };
  const hz2midi = (f) => 69 + 12 * Math.log2(f / 440);
  const midi2hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const mod = (a, n) => ((a % n) + n) % n;

  /** Nota más cercana (entera) que pertenece a la escala. */
  function ajustarAEscala(midi, tonica, escala) {
    const esc = ESCALAS[escala] || ESCALAS.mayor;
    let mejor = Math.round(midi), dist = 1e9;
    for (let n = Math.floor(midi) - 2; n <= Math.ceil(midi) + 2; n++) {
      if (esc.includes(mod(n - tonica, 12))) {
        const d = Math.abs(n - midi);
        if (d < dist) { dist = d; mejor = n; }
      }
    }
    return mejor;
  }

  /** Mueve una nota de la escala 'grados' pasos dentro de la escala (+2 = tercera arriba). */
  function moverGrados(nota, grados, tonica, escala) {
    const esc = ESCALAS[escala] || ESCALAS.mayor;
    let n = nota, paso = grados > 0 ? 1 : -1, cuenta = Math.abs(grados);
    while (cuenta > 0) {
      n += paso;
      if (esc.includes(mod(n - tonica, 12))) cuenta--;
    }
    return n;
  }

  /** Tono del acorde más cercano estrictamente arriba (dir=1) o abajo (dir=-1). */
  function tonoDeAcorde(nota, pcs, dir) {
    for (let k = 1; k <= 12; k++) {
      const n = nota + dir * k;
      if (pcs.includes(mod(n, 12))) return n;
    }
    return nota + dir * 4;
  }

  /** Detector YIN con decimación x2 para que alcance en un teléfono. */
  class YIN {
    constructor(sr, o = {}) {
      this.sr = sr;
      this.dec = o.dec || (sr > 32000 ? 2 : 1);
      this.fs = sr / this.dec;
      this.W = o.win || 512;
      this.tauMax = Math.floor(this.fs / (o.fmin || 70));
      this.tauMin = Math.max(2, Math.floor(this.fs / (o.fmax || 1000)));
      this.thr = o.thr || 0.15;
      this.d = new Float32Array(this.tauMax + 2);
      this.x = new Float32Array(this.W + this.tauMax + 2);
      this.necesita = (this.W + this.tauMax + 2) * this.dec; // muestras originales
    }
    /** ring: Float32Array circular, pos: índice de escritura siguiente */
    analizar(ring, pos) {
      const N = ring.length, L = this.x.length, dec = this.dec, x = this.x;
      let p = mod(pos - L * dec, N);
      for (let i = 0; i < L; i++) {
        let s = 0;
        for (let k = 0; k < dec; k++) { s += ring[p]; p = p + 1 === N ? 0 : p + 1; }
        x[i] = s / dec;
      }
      const W = this.W, d = this.d;
      let energia = 0;
      for (let i = 0; i < W; i++) energia += x[i] * x[i];
      const rms = Math.sqrt(energia / W);
      d[0] = 1;
      let acum = 0, tauSel = -1;
      for (let tau = 1; tau <= this.tauMax; tau++) {
        let s = 0;
        for (let i = 0; i < W; i++) { const df = x[i] - x[i + tau]; s += df * df; }
        acum += s;
        d[tau] = acum > 0 ? (s * tau) / acum : 1;
      }
      for (let tau = this.tauMin; tau < this.tauMax; tau++) {
        if (d[tau] < this.thr) {
          while (tau + 1 < this.tauMax && d[tau + 1] < d[tau]) tau++;
          tauSel = tau; break;
        }
      }
      if (tauSel < 0) return { f0: 0, conf: 0, rms };
      const a = d[tauSel - 1], b = d[tauSel], c = d[tauSel + 1];
      const den = a - 2 * b + c;
      const t = den !== 0 ? tauSel + (0.5 * (a - c)) / den : tauSel;
      return { f0: this.fs / t, conf: 1 - b, rms };
    }
  }

  /** Desplazador de tono: dos lecturas de una línea de retardo con fundido Hann,
   *  ventana = múltiplo del periodo (sincronizado al tono) → menos "metálico". */
  class Desplazador {
    constructor(sr, maxSeg = 0.1) {
      this.sr = sr;
      this.N = 1 << Math.ceil(Math.log2(sr * maxSeg));
      this.buf = new Float32Array(this.N);
      this.w = 0;
      this.fase = 0;
      this.win = Math.round(sr * 0.025);
      this.winSig = this.win;
      this.min = 32;
    }
    fijarVentana(periodo) { // periodo en muestras
      if (!(periodo > 0)) { this.winSig = Math.round(this.sr * 0.025); return; }
      let k = Math.max(1, Math.round((this.sr * 0.018) / periodo));
      this.winSig = Math.min(Math.round(this.sr * 0.045), Math.max(Math.round(periodo * k), 96));
    }
    leer(retardo) {
      const N = this.N, pos = this.w - retardo;
      const i0 = Math.floor(pos), fr = pos - i0;
      const a = this.buf[mod(i0, N)], b = this.buf[mod(i0 + 1, N)];
      return a + (b - a) * fr;
    }
    procesar(x, ratio) {
      this.buf[this.w & (this.N - 1)] = x;
      let f = this.fase + (1 - ratio) / this.win;
      if (f >= 1 || f < 0) { f = mod(f, 1); this.win = this.winSig; }
      this.fase = f;
      const f2 = (f + 0.5) % 1;
      const d1 = this.min + f * this.win, d2 = this.min + f2 * this.win;
      const g1 = 0.5 - 0.5 * Math.cos(2 * Math.PI * f);
      const g2 = 0.5 - 0.5 * Math.cos(2 * Math.PI * f2);
      const y = g1 * this.leer(d1) + g2 * this.leer(d2);
      this.w++;
      if (this.w >= 1 << 30) this.w -= this.N * 1024;
      return y;
    }
    /** retardo promedio (latencia) en muestras */
    latencia() { return this.min + this.win / 2; }
  }

  /** Motor completo de la voz (sin AudioWorklet: procesa arreglos). */
  class MotorVoz {
    constructor(sr) {
      this.sr = sr;
      this.yin = new YIN(sr);
      this.ring = new Float32Array(1 << Math.ceil(Math.log2(this.yin.necesita + 256)));
      this.rpos = 0;
      this.hop = 256;
      this.cuenta = 0;
      this.lead = new Desplazador(sr);
      this.c1 = new Desplazador(sr);
      this.c2 = new Desplazador(sr);
      this.p = {
        tonica: 0, escala: "mayor", fuerza: 1, velocidadMs: 20,
        vibratoCents: 0, vibratoHz: 5.5, coros: false, acorde: null,
        coroArriba: 2, coroAbajo: -5, compuertaDb: -55, afinacion: true,
      };
      this.f0 = 0; this.conf = 0; this.nota = null;
      this.corrCents = 0; this.objCents = 0;
      this.ratioL = 1; this.r1 = 1; this.r2 = 1;
      this.gCoro = 0; this.gGate = 0; this.env = 0;
      this.lfo = 0;
      this.ultimo = { f0: 0, nota: null, cents: 0, gate: 0 };
    }
    set(params) { Object.assign(this.p, params); }
    _analizar() {
      const r = this.yin.analizar(this.ring, this.rpos);
      const sonoro = r.f0 > 60 && r.f0 < 1100 && r.conf > 0.8 && r.rms > 1e-3;
      if (sonoro) {
        this.f0 = this.f0 > 0 && Math.abs(hz2midi(r.f0) - hz2midi(this.f0)) < 0.7
          ? this.f0 * 0.5 + r.f0 * 0.5 : r.f0;
        const m = hz2midi(this.f0);
        const p = this.p;
        const obj = p.afinacion ? ajustarAEscala(m, p.tonica, p.escala) : Math.round(m);
        this.nota = obj;
        this.objCents = (obj - m) * 100 * (p.afinacion ? p.fuerza : 0);
        this.lead.fijarVentana(this.sr / this.f0);
        this.c1.fijarVentana(this.sr / this.f0);
        this.c2.fijarVentana(this.sr / this.f0);
        let h1, h2;
        if (p.acorde && p.acorde.length) {
          h1 = tonoDeAcorde(obj, p.acorde, 1);
          h2 = tonoDeAcorde(obj, p.acorde, -1);
        } else {
          h1 = moverGrados(obj, p.coroArriba, p.tonica, p.escala);
          h2 = moverGrados(obj, p.coroAbajo, p.tonica, p.escala);
        }
        this.obj1 = Math.pow(2, (h1 - m) / 12);
        this.obj2 = Math.pow(2, (h2 - m) / 12);
        this.sonoro = true;
      } else {
        this.objCents = 0; this.obj1 = this.obj2 = 1; this.sonoro = false;
      }
      this.ultimo = { f0: sonoro ? this.f0 : 0, nota: sonoro ? this.nota : null,
        cents: sonoro ? Math.round((hz2midi(this.f0) - this.nota) * 100) : 0, gate: this.gGate };
    }
    /** entrada: Float32Array; salidas: lead, coro1, coro2 (Float32Array del mismo tamaño) */
    procesar(inp, outL, out1, out2) {
      const p = this.p, sr = this.sr;
      const aV = Math.exp(-1 / Math.max(1, (p.velocidadMs / 1000) * sr));
      const aR = Math.exp(-1 / (0.02 * sr));
      const umbral = Math.pow(10, p.compuertaDb / 20);
      const aEnv = Math.exp(-1 / (0.01 * sr));
      const aG1 = Math.exp(-1 / (0.003 * sr)), aG0 = Math.exp(-1 / (0.12 * sr));
      const dLfo = (2 * Math.PI * p.vibratoHz) / sr;
      for (let i = 0; i < inp.length; i++) {
        const x = inp[i];
        this.ring[this.rpos] = x;
        this.rpos = (this.rpos + 1) & (this.ring.length - 1);
        if (++this.cuenta >= this.hop) { this.cuenta = 0; this._analizar(); }
        // compuerta de ruido
        const ax = Math.abs(x);
        this.env = ax > this.env ? ax : this.env * aEnv + ax * (1 - aEnv);
        const abierta = this.env > umbral ? 1 : 0;
        this.gGate = abierta ? this.gGate * aG1 + (1 - aG1) : this.gGate * aG0;
        // corrección suave (velocidad) + vibrato
        this.corrCents = this.corrCents * aV + this.objCents * (1 - aV);
        this.lfo += dLfo; if (this.lfo > 2 * Math.PI) this.lfo -= 2 * Math.PI;
        const vib = this.sonoro ? p.vibratoCents * Math.sin(this.lfo) : 0;
        const rL = Math.pow(2, (this.corrCents + vib) / 1200);
        this.ratioL = this.ratioL * aR + rL * (1 - aR);
        this.r1 = this.r1 * aR + (this.obj1 || 1) * (1 - aR);
        this.r2 = this.r2 * aR + (this.obj2 || 1) * (1 - aR);
        const objCoro = p.coros && this.sonoro ? 1 : 0;
        this.gCoro = this.gCoro * 0.9995 + objCoro * 0.0005;
        const xg = x * this.gGate;
        outL[i] = this.lead.procesar(xg, this.ratioL);
        if (out1) out1[i] = this.c1.procesar(xg, this.r1 * Math.pow(2, (vib * 0.6) / 1200)) * this.gCoro;
        if (out2) out2[i] = this.c2.procesar(xg, this.r2 * Math.pow(2, (-vib * 0.4) / 1200)) * this.gCoro;
      }
    }
    latenciaMs() { return (1000 * this.lead.latencia()) / this.sr; }
  }

  const API = { NOMBRES, ESCALAS, hz2midi, midi2hz, ajustarAEscala, moverGrados, tonoDeAcorde, YIN, Desplazador, MotorVoz };
  G.CoronelDSP = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
