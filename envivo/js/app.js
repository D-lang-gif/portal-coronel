/* Coronel En Vivo — consola de voz + ritmos + auto-mezcla (WebAudio / AudioWorklet / Web MIDI). */
(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const DSP = window.CoronelDSP;
  const NOM = ["Do", "Do#", "Re", "Mib", "Mi", "Fa", "Fa#", "Sol", "Lab", "La", "Sib", "Si"];
  const SF = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const mod = (a, n) => ((a % n) + n) % n;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  function toast(msg, ms = 2600) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), ms);
  }

  /* ───────── Candado (mismo hash PBKDF2 del portal; no se guarda la contraseña) ───────── */
  const GATE = { SALT: "f5683dd503d323855db92b852f5f1ff4", HASH: "7e5a33ce72990d7df64c18c5b9bf4dbfd945eb8111148b2deb4240f967688cf8", ITER: 120000, KEY: "portal_coronel_ok_v1", REC: "coronel_envivo_recordar_v1" };
  async function hashPw(pw) {
    const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
    const salt = new Uint8Array(GATE.SALT.match(/.{2}/g).map((b) => parseInt(b, 16)));
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: GATE.ITER, hash: "SHA-256" }, km, 256);
    return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function abrir() { sessionStorage.setItem(GATE.KEY, "1"); $("#gate").hidden = true; $("#app").hidden = false; iniciarUI(); }
  function candado() {
    if (sessionStorage.getItem(GATE.KEY) === "1" || localStorage.getItem(GATE.REC) === "1") return abrir();
    $("#gate-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#gate-err"); err.textContent = "Verificando…";
      try {
        if ((await hashPw($("#gate-pw").value)) === GATE.HASH) {
          if ($("#gate-recordar").checked) localStorage.setItem(GATE.REC, "1");
          err.textContent = ""; abrir();
        } else err.textContent = "Contraseña incorrecta.";
      } catch (_) { err.textContent = "Este navegador no puede verificar (falta WebCrypto / https)."; }
    });
  }

  /* ───────── Estado ───────── */
  const CANALES = [
    { id: "voz", nom: "VOZ" }, { id: "coros", nom: "COROS" }, { id: "bateria", nom: "BATERÍA" }, { id: "bajo", nom: "BAJO" },
    { id: "armonia", nom: "ARMONÍA" }, { id: "pads", nom: "PADS" }, { id: "reverb", nom: "REVERB" }, { id: "master", nom: "MASTER" },
  ];
  const GENEROS = {
    cumbia: { bpm: 100, base: 0, mezcla: { voz: .78, coros: .60, bateria: .72, bajo: .72, armonia: .64, pads: .48, reverb: .55, master: .75 }, voz: { vibrato: 18, velocidad: 25, fuerza: 85, compresion: 55 }, coros: true },
    banda: { bpm: 108, base: 0, mezcla: { voz: .80, coros: .55, bateria: .74, bajo: .76, armonia: .68, pads: .38, reverb: .55, master: .75 }, voz: { vibrato: 24, velocidad: 30, fuerza: 80, compresion: 60 }, coros: true },
    norteno: { bpm: 118, base: 2, mezcla: { voz: .78, coros: .66, bateria: .68, bajo: .72, armonia: .66, pads: .32, reverb: .45, master: .75 }, voz: { vibrato: 15, velocidad: 25, fuerza: 85, compresion: 55 }, coros: true },
    corrido_tumbado: { bpm: 145, base: 0, mezcla: { voz: .80, coros: .45, bateria: .66, bajo: .77, armonia: .66, pads: .55, reverb: .62, master: .75 }, voz: { vibrato: 0, velocidad: 6, fuerza: 100, compresion: 70 }, coros: false },
  };
  const SECCION_DELTA = {
    intro: { voz: -.05, coros: -.25, bateria: -.08, bajo: -.05, armonia: .06, pads: .08, reverb: .05 },
    A: {},
    B: { coros: .08, bateria: .04, armonia: .04, pads: .04 },
    fill: { bateria: .08, armonia: -.03 },
    ending: { armonia: .05, reverb: .10, pads: .05, voz: -.02 },
  };
  const S = {
    ac: null, encendido: false, gen: "cumbia", estilos: {}, estilo: null, inst: {}, playing: false,
    sec: "intro", pendiente: null, retorno: "A", barEnSec: 0, compasesMain: 0, paso: 0, tSig: 0, bpm: 100,
    tonica: 0, escala: "mayor", transp: 0, acordeMidi: null, acordeBar: null, rootBar: null,
    fader: {}, objetivo: {}, usuario: {}, mute: {}, autoMezcla: true, autoFill: true, cantando: 0,
    voz: { ganancia: 6, fuerza: 100, velocidad: 20, vibrato: 0, vibHz: 5.5, compuerta: -55, compresion: 50, graves: 0, medios: 2, agudos: 2 },
    nodos: {}, analizadores: {}, worklet: null, latWorklet: 0, padTipo: "", padVoces: [], split: 60, held: new Set(), wake: null,
  };
  CANALES.forEach((c) => { S.fader[c.id] = GENEROS.cumbia.mezcla[c.id]; S.usuario[c.id] = 0; S.mute[c.id] = false; });
  const fader2gain = (p) => (p <= 0.001 ? 0 : Math.pow(p / 0.75, 3));
  const gain2db = (g) => (g <= 0.00001 ? "-∞" : (20 * Math.log10(g)).toFixed(1));

  /* ───────── Audio ───────── */
  function hacerIR(ac, seg = 2.4) {
    const n = Math.floor(ac.sampleRate * seg), ir = ac.createBuffer(2, n, ac.sampleRate), pre = Math.floor(0.018 * ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c); let lp = 0, e = 0;
      for (let i = pre; i < n; i++) {
        const t = (i - pre) / ac.sampleRate, k = 0.25 + 0.7 * Math.min(1, t / 1.2);
        lp = lp * k + (Math.random() * 2 - 1) * (1 - k);
        d[i] = lp * Math.exp(-t * 6.9 / seg) * (t < 0.08 ? 1.4 : 1);
      }
      for (let i = 0; i < n; i++) e += d[i] * d[i];
      const g = 1 / Math.sqrt(e + 1e-9); for (let i = 0; i < n; i++) d[i] *= g * 0.9;
    }
    return ir;
  }
  async function encender() {
    if (S.encendido) { if (S.ac.state !== "running") await S.ac.resume(); return true; }
    let ac;
    try { ac = new AudioContext({ latencyHint: "interactive", sampleRate: 48000 }); } catch (_) { ac = new AudioContext({ latencyHint: "interactive" }); }
    S.ac = ac;
    const N = S.nodos, g = () => ac.createGain();
    // buses
    N.master = g(); N.lim = ac.createDynamicsCompressor();
    Object.assign(N.lim, {}); N.lim.threshold.value = -3; N.lim.knee.value = 0; N.lim.ratio.value = 20; N.lim.attack.value = 0.002; N.lim.release.value = 0.12;
    N.master.connect(N.lim); N.lim.connect(ac.destination);
    N.conv = ac.createConvolver(); N.conv.buffer = hacerIR(ac); N.reverb = g(); N.conv.connect(N.reverb); N.reverb.connect(N.master);
    N.voz = g(); N.coros = g(); N.bateria = g(); N.bajo = g(); N.armonia = g(); N.pads = g();
    N.envVoz = g(); N.envVoz.gain.value = 1; N.envMus = g(); N.envMus.gain.value = 0.18;
    ["voz", "coros"].forEach((k) => { N[k].connect(N.master); N[k].connect(N.envVoz); });
    ["bateria", "bajo", "armonia", "pads"].forEach((k) => { N[k].connect(N.master); N[k].connect(N.envMus); });
    N.pads.disconnect(N.envMus); N.padRev = g(); N.padRev.gain.value = 0.5; N.pads.connect(N.padRev); N.padRev.connect(N.conv);
    N.envVoz.connect(N.conv); N.envMus.connect(N.conv);
    // ajuste de nivel: los samples FluidR3 vienen bajos y la batería sintética alta
    N.trimBajo = g(); N.trimBajo.gain.value = 3.0; N.trimBajo.connect(N.bajo);
    N.trimArm = g(); N.trimArm.gain.value = 4.5; N.trimArm.connect(N.armonia);
    N.trimBat = g(); N.trimBat.gain.value = 0.4; N.trimBat.connect(N.bateria);
    N.padBus = g(); N.padBus.gain.value = 0.5; N.padBus.connect(N.pads);
    // medidores
    CANALES.forEach((c) => { const a = ac.createAnalyser(); a.fftSize = 1024; (c.id === "master" ? N.lim : N[c.id]).connect(a); S.analizadores[c.id] = a; });
    // cadena de voz
    N.entrada = g(); N.hp = ac.createBiquadFilter(); N.hp.type = "highpass"; N.hp.frequency.value = 85;
    N.graves = ac.createBiquadFilter(); N.graves.type = "lowshelf"; N.graves.frequency.value = 160;
    N.medios = ac.createBiquadFilter(); N.medios.type = "peaking"; N.medios.frequency.value = 2800; N.medios.Q.value = 0.9;
    N.agudos = ac.createBiquadFilter(); N.agudos.type = "highshelf"; N.agudos.frequency.value = 9000;
    N.comp = ac.createDynamicsCompressor(); N.comp.attack.value = 0.004; N.comp.release.value = 0.15; N.comp.knee.value = 8;
    N.salidaVoz = g();
    N.aIn = ac.createAnalyser(); N.aIn.fftSize = 1024;
    N.entrada.connect(N.hp); N.hp.connect(N.aIn);
    try {
      await ac.audioWorklet.addModule("js/voz-dsp.js");
      await ac.audioWorklet.addModule("js/voz-worklet.js");
      const w = new AudioWorkletNode(ac, "voz-coronel", { numberOfInputs: 1, numberOfOutputs: 3, outputChannelCount: [1, 1, 1], channelCount: 1, channelCountMode: "explicit" });
      S.worklet = w;
      w.port.onmessage = (e) => { if (e.data.latenciaMs) S.latWorklet = e.data.latenciaMs; if (e.data.estado) estadoVoz(e.data.estado); };
      N.hp.connect(w);
      w.connect(N.graves, 0); N.graves.connect(N.medios); N.medios.connect(N.agudos); N.agudos.connect(N.comp); N.comp.connect(N.salidaVoz); N.salidaVoz.connect(N.voz);
      N.p1 = ac.createStereoPanner(); N.p1.pan.value = -0.45; N.p2 = ac.createStereoPanner(); N.p2.pan.value = 0.45;
      N.cg1 = g(); N.cg1.gain.value = 0.8; N.cg2 = g(); N.cg2.gain.value = 0.65;
      w.connect(N.cg1, 1); w.connect(N.cg2, 2); N.cg1.connect(N.p1); N.cg2.connect(N.p2); N.p1.connect(N.coros); N.p2.connect(N.coros);
    } catch (e) { console.error(e); toast("Este navegador no soporta AudioWorklet: sin afinador."); N.hp.connect(N.graves); N.graves.connect(N.medios); N.medios.connect(N.agudos); N.agudos.connect(N.comp); N.comp.connect(N.salidaVoz); N.salidaVoz.connect(N.voz); }
    // micrófono: sin cancelación de eco, sin supresión de ruido, sin control automático de ganancia
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 1 }, sampleRate: { ideal: 48000 }, latency: { ideal: 0 } } });
      S.stream = stream; N.mic = ac.createMediaStreamSource(stream); N.mic.connect(N.entrada);
      const tr = stream.getAudioTracks()[0]; S.micNombre = tr ? tr.label : ""; S.micAjustes = tr && tr.getSettings ? tr.getSettings() : {};
      $("#led-mic").classList.add("on");
      toast("Micrófono: " + (S.micNombre || "listo"));
    } catch (e) { $("#led-mic").classList.add("warn"); toast("Sin micrófono (permiso o interfaz): sólo ritmos y pads."); }
    S.encendido = true;
    aplicarVoz(); aplicarFaders(true);
    $("#led-audio").classList.add("on");
    $("#btn-encender").textContent = "● ENCENDIDO"; $("#btn-encender").classList.add("on");
    ac.onstatechange = () => $("#led-audio").classList.toggle("on", ac.state === "running");
    mostrarLatencia();
    await cargarEstilo(S.gen);
    return true;
  }
  function mostrarLatencia() {
    if (!S.ac) return;
    const out = 1000 * ((S.ac.baseLatency || 0) + (S.ac.outputLatency || 0));
    const inp = S.micAjustes && S.micAjustes.latency ? 1000 * S.micAjustes.latency : null;
    const tot = out + S.latWorklet + (inp || 0);
    $("#lat").textContent = `Latencia ≈ ${tot.toFixed(0)} ms (salida ${out.toFixed(0)}${inp != null ? " · entrada " + inp.toFixed(0) : ""} · afinador ${S.latWorklet.toFixed(0)}) · ${S.ac.sampleRate / 1000} kHz`;
  }
  function aplicarVoz() {
    const v = S.voz, N = S.nodos;
    if (S.ac) {
      const t = S.ac.currentTime;
      N.entrada.gain.setTargetAtTime(Math.pow(10, v.ganancia / 20), t, 0.02);
      N.graves.gain.setTargetAtTime(v.graves, t, 0.05); N.medios.gain.setTargetAtTime(v.medios, t, 0.05); N.agudos.gain.setTargetAtTime(v.agudos, t, 0.05);
      const c = v.compresion / 100;
      N.comp.threshold.setTargetAtTime(-8 - 30 * c, t, 0.05); N.comp.ratio.setTargetAtTime(1.5 + 6.5 * c, t, 0.05);
      N.salidaVoz.gain.setTargetAtTime(($("#t-monitor").checked ? 1 : 0) * (1 + 0.6 * c), t, 0.03);
    }
    if (S.worklet) S.worklet.port.postMessage({ set: {
      tonica: S.tonica, escala: S.escala, fuerza: v.fuerza / 100, velocidadMs: v.velocidad, vibratoCents: v.vibrato, vibratoHz: v.vibHz,
      compuertaDb: v.compuerta, afinacion: $("#t-afinar").checked, coros: $("#t-coros").checked,
      acorde: $("#t-coro-acorde").checked && acordeActual() ? acordeActual().pcs : null,
    } });
  }
  function estadoVoz(e) {
    if (e.nota != null && e.f0 > 0) {
      const m = Math.round(e.nota);
      $("#af-nota").textContent = NOM[mod(m, 12)] + (Math.floor(m / 12) - 1);
      $("#af-ind").style.left = `calc(${50 + clamp(e.cents, -50, 50)}% - 2px)`;
      $("#af-hz").textContent = `${e.f0.toFixed(1)} Hz · ${e.cents > 0 ? "+" : ""}${e.cents}¢`;
      if (e.gate > 0.5) S.cantando = performance.now();
    } else { $("#af-hz").textContent = e.gate > 0.5 ? "sin tono" : "silencio"; }
  }

  /* ───────── Ritmos (patrones del portal + FluidR3 offline) ───────── */
  const BAJOS = new Set(["tuba", "electric_bass_finger", "acoustic_bass"]);
  async function cargarEstilo(id) {
    if (!S.estilos[id]) {
      const r = await fetch(`../data/patterns/${id}.json`); if (!r.ok) throw new Error("patrón " + id);
      const st = await r.json();
      st.bb = (st.timeSig[0] === 6 && st.timeSig[1] === 8) ? 3 : (st.timeSig[0] === 2 ? 2 : 4);
      st.pasosBar = Math.round(st.bb / 0.25);
      st.idx = {}; st.raices = {};
      for (const [k, sec] of Object.entries(st.sections)) {
        const m = new Map();
        for (const ev of sec.events) { const p = Math.round(ev.t / 0.25); if (!m.has(p)) m.set(p, []); m.get(p).push(ev); }
        st.idx[k] = m;
        st.raices[k] = [];
        for (let b = 0; b < sec.bars; b++) {
          const bs = sec.events.filter((e) => e.part === "bass" && e.t >= b * st.bb - 1e-6 && e.t < (b + 1) * st.bb - 1e-6).sort((a, c) => a.t - c.t);
          st.raices[k].push(bs.length ? mod(bs[0].notes[0], 12) : (b > 0 ? st.raices[k][b - 1] : GENEROS[id].base));
        }
      }
      S.estilos[id] = st;
    }
    if (S.ac && typeof Soundfont !== "undefined") {
      const st = S.estilos[id], faltan = Object.values(st.parts).map((p) => p.instrument).filter((n) => n && !S.inst[n]);
      if (faltan.length) toast("Cargando instrumentos: " + faltan.join(", ").replace(/_/g, " ") + "…", 4000);
      await Promise.all(faltan.map(async (n) => {
        try {
          S.inst[n] = await Soundfont.instrument(S.ac, n, { nameToUrl: (x) => `../soundfonts/FluidR3_GM/${x}-mp3.js`, destination: BAJOS.has(n) ? S.nodos.trimBajo : S.nodos.trimArm });
        } catch (e) { console.warn("instrumento", n, e); }
      }));
      if (faltan.length) toast("Instrumentos listos ✔");
    }
    return S.estilos[id];
  }
  function calcularTransp() {
    const base = GENEROS[S.gen].base, menor = S.escala.startsWith("menor");
    const obj = menor ? mod(S.tonica + 3, 12) : S.tonica; // en menor el ritmo va en su relativo mayor
    S.transp = mod(obj - base + 6, 12) - 6;
  }
  function acordeActual() { return S.acordeMidi || S.acordeBar; }
  function triada(root, menor) { return { root, menor, pcs: [root, mod(root + (menor ? 3 : 4), 12), mod(root + 7, 12)], nom: NOM[root] + (menor ? "m" : "") }; }

  function tocarParte(parte, notas, vel, dur, cuando) {
    const st = S.estilo, p = st.parts[parte]; if (!p) return;
    if (parte === "drums") { notas.forEach((n) => tambor(n, vel, cuando)); return; }
    const inst = p.instrument && S.inst[p.instrument]; if (!inst) return;
    const durS = Math.max(0.05, dur * 60 / S.bpm), vol = (p.volume || 100) / 127;
    for (let n of notas) {
      n += S.transp;
      if (S.acordeMidi && S.rootBar != null) {
        const a = S.acordeMidi; n += mod(a.root - S.rootBar + 6, 12) - 6;
        if (a.menor && mod(n - a.root, 12) === 4) n -= 1;
      }
      try { inst.play(SF[mod(n, 12)] + (Math.floor(n / 12) - 1), cuando, { gain: (vel / 127) * vol * 0.95, duration: durS }); } catch (_) {}
    }
  }
  let ruido = null;
  function tambor(n, vel, t0) {
    const ac = S.ac, dst = S.nodos.trimBat, v = vel / 127;
    if (!ruido) { const len = ac.sampleRate; ruido = ac.createBuffer(1, len, ac.sampleRate); const d = ruido.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; }
    const env = (node, pico, dur, ataque = 0.002) => { const gg = ac.createGain(); gg.gain.setValueAtTime(0.0001, t0); gg.gain.exponentialRampToValueAtTime(pico * v, t0 + ataque); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); node.connect(gg); gg.connect(dst); return gg; };
    const osc = (f, tipo, pico, dur, fFin) => { const o = ac.createOscillator(); o.type = tipo; o.frequency.setValueAtTime(f, t0); if (fFin) o.frequency.exponentialRampToValueAtTime(fFin, t0 + dur); env(o, pico, dur); o.start(t0); o.stop(t0 + dur + 0.02); };
    const ruid = (filtro, f, q, pico, dur) => { const s = ac.createBufferSource(); s.buffer = ruido; const b = ac.createBiquadFilter(); b.type = filtro; b.frequency.value = f; b.Q.value = q; s.connect(b); env(b, pico, dur); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02); };
    switch (n) {
      case 35: case 36: osc(140, "sine", 1.0, 0.28, 42); ruid("lowpass", 900, 0.7, 0.15, 0.02); break;
      case 38: case 40: ruid("bandpass", 1900, 0.8, 0.75, 0.16); osc(190, "triangle", 0.4, 0.09, 150); break;
      case 42: case 44: ruid("highpass", 7500, 0.7, 0.32, 0.045); break;
      case 46: ruid("highpass", 6500, 0.7, 0.28, 0.26); break;
      case 49: case 51: case 57: ruid("bandpass", 7800, 0.5, 0.32, n === 51 ? 0.35 : 0.7); break;
      case 45: case 47: case 48: case 50: osc(n === 45 ? 110 : n === 47 ? 140 : 170, "sine", 0.7, 0.25, n === 45 ? 80 : 110); break;
      case 54: ruid("highpass", 8000, 1, 0.3, 0.09); osc(5200, "square", 0.04, 0.04); break;
      case 56: { const o1 = ac.createOscillator(), o2 = ac.createOscillator(), bp = ac.createBiquadFilter(); o1.type = o2.type = "square"; o1.frequency.value = 562; o2.frequency.value = 845; bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 2; o1.connect(bp); o2.connect(bp); env(bp, 0.22, 0.12); o1.start(t0); o2.start(t0); o1.stop(t0 + 0.15); o2.stop(t0 + 0.15); break; }
      case 60: case 61: case 62: case 63: case 64: osc(n <= 62 ? 330 : 220, "sine", 0.55, n === 62 ? 0.05 : 0.18, n <= 62 ? 300 : 200); ruid("bandpass", 1200, 2, 0.08, 0.03); break;
      case 73: case 74: { const len = n === 73 ? 0.08 : 0.22; for (let k = 0; k < (n === 73 ? 3 : 8); k++) { const s = ac.createBufferSource(); s.buffer = ruido; const b = ac.createBiquadFilter(); b.type = "bandpass"; b.frequency.value = 4200; b.Q.value = 3; const gg = ac.createGain(); const tk = t0 + k * len / (n === 73 ? 3 : 8); gg.gain.setValueAtTime(0.0001, tk); gg.gain.exponentialRampToValueAtTime(0.25 * v, tk + 0.003); gg.gain.exponentialRampToValueAtTime(0.0001, tk + 0.022); s.connect(b); b.connect(gg); gg.connect(dst); s.start(tk, Math.random() * 0.5); s.stop(tk + 0.03); } break; }
      default: ruid("bandpass", 3000, 1, 0.2, 0.06);
    }
  }
  function cambiarSeccion(nueva) {
    if (nueva === S.sec) return;
    if (["A", "B"].includes(S.sec)) S.retorno = S.sec;
    S.sec = nueva; S.barEnSec = 0; if (nueva === "A" || nueva === "B") S.compasesMain = 0;
    pintarSecciones(); objetivosMezcla();
  }
  function inicioCompas(cuando) {
    const st = S.estilo, sec = st.sections[S.sec];
    S.rootBar = mod(st.raices[S.sec][S.barEnSec % sec.bars] + S.transp, 12);
    const esc = S.escala.startsWith("menor") ? mod(S.tonica + 3, 12) : S.tonica; // tónica mayor de referencia
    const rel = mod(S.rootBar - esc, 12), menor = rel === 2 || rel === 4 || rel === 9; // ii, iii, vi menores
    const ac = triada(S.rootBar, menor);
    const cambio = !S.acordeBar || S.acordeBar.nom !== ac.nom;
    S.acordeBar = ac;
    if (cambio && !S.acordeMidi) { setTimeout(() => { padsAcorde(); aplicarVoz(); }, Math.max(0, (cuando - S.ac.currentTime) * 1000)); }
    const visual = S.barEnSec, compas = S.compasesMain;
    setTimeout(() => { $("#compas").textContent = `${S.sec === "ending" ? "FINAL" : S.sec.toUpperCase()} · ${visual + 1}/${sec.bars} · ${(acordeActual() || {}).nom || ""}`; }, Math.max(0, (cuando - S.ac.currentTime) * 1000));
    void compas;
  }
  function finCompas() {
    const st = S.estilo, sec = st.sections[S.sec];
    S.barEnSec++; if (S.sec === "A" || S.sec === "B") S.compasesMain++;
    if (S.pendiente && (S.pendiente.gen || true)) {
      if (S.pendiente.gen) { S.gen = S.pendiente.gen; S.estilo = S.estilos[S.gen]; calcularTransp(); S.swing = S.estilo.swing || 0; }
      if (S.pendiente.sec) cambiarSeccion(S.pendiente.sec);
      else if (S.pendiente.gen) { S.barEnSec = 0; pintarSecciones(); objetivosMezcla(); }
      S.pendiente = null; return;
    }
    if (S.barEnSec >= sec.bars && !sec.loop) {
      if (S.sec === "ending") { detener(true); return; }
      if (S.sec === "intro") return cambiarSeccion("A");
      if (S.sec === "fill") { const r = S.fillAuto ? (S.retorno === "A" ? "B" : "A") : S.retorno; S.fillAuto = false; return cambiarSeccion(r); }
    }
    if (S.autoFill && (S.sec === "A" || S.sec === "B") && S.compasesMain > 0 && S.compasesMain % 8 === 0) { S.fillAuto = true; cambiarSeccion("fill"); }
  }
  function planificar() {
    if (!S.playing) return;
    const ac = S.ac;
    while (S.tSig < ac.currentTime + 0.12) {
      const st = S.estilo, sec = st.sections[S.sec];
      if (S.paso === 0) inicioCompas(S.tSig);
      const p = (S.barEnSec % sec.bars) * st.pasosBar + S.paso;
      const evs = st.idx[S.sec].get(p);
      const spb = 60 / S.bpm;
      if (evs) {
        const t = S.tSig + ((S.paso % 2 === 1) ? (S.swing || 0) * spb * 0.2 : 0);
        for (const e of evs) tocarParte(e.part, e.notes, e.vel, e.dur, t);
      }
      S.tSig += spb * 0.25;
      if (++S.paso >= st.pasosBar) { S.paso = 0; finCompas(); if (!S.playing) return; }
    }
  }
  async function tocar() {
    await encender();
    if (S.playing) return;
    S.estilo = await cargarEstilo(S.gen); calcularTransp(); S.swing = S.estilo.swing || 0;
    S.playing = true; S.paso = 0; S.barEnSec = 0; S.compasesMain = 0; S.tSig = S.ac.currentTime + 0.08;
    if (!S.sec || S.sec === "ending") S.sec = "intro";
    pintarSecciones(); objetivosMezcla();
    S.timer = setInterval(planificar, 25); planificar();
    $("#btn-play").classList.add("on");
    try { if (navigator.wakeLock) S.wake = await navigator.wakeLock.request("screen"); } catch (_) {}
  }
  function detener(porFinal) {
    S.playing = false; clearInterval(S.timer); S.pendiente = null;
    $("#btn-play").classList.remove("on"); $("#compas").textContent = porFinal ? "FIN ✔" : "— · —";
    S.sec = "intro"; pintarSecciones(); objetivosMezcla();
    if (S.wake) { S.wake.release().catch(() => {}); S.wake = null; }
  }
  function pedirSeccion(sec) {
    if (!S.playing) { S.sec = sec; pintarSecciones(); objetivosMezcla(); return; }
    S.pendiente = { ...(S.pendiente || {}), sec }; if (sec === "fill") S.fillAuto = false; pintarSecciones();
  }
  async function elegirGenero(id) {
    const g = GENEROS[id];
    $$(".gen").forEach((b) => b.classList.toggle("on", b.dataset.gen === id));
    S.bpm = g.bpm; $("#bpm").textContent = S.bpm;
    Object.assign(S.voz, g.voz); $("#t-coros").checked = g.coros; refrescarKnobs();
    CANALES.forEach((c) => (S.usuario[c.id] = 0));
    if (S.playing) {
      await cargarEstilo(id); S.pendiente = { ...(S.pendiente || {}), gen: id };
      toast(`Cambio a ${$(`.gen[data-gen="${id}"]`).innerText.split("\n")[1] || id} en el próximo compás`);
    } else { S.gen = id; if (S.encendido) await cargarEstilo(id); calcularTransp(); }
    S.genMezcla = id; objetivosMezcla(); aplicarVoz();
  }

  /* ───────── Auto-mezcla y faders "motorizados" ───────── */
  function objetivosMezcla() {
    const gen = GENEROS[S.genMezcla || S.gen], d = SECCION_DELTA[S.sec] || {};
    const duck = performance.now() - S.cantando < 900 ? 1 : 0;
    CANALES.forEach(({ id }) => {
      let t = gen.mezcla[id] + (S.autoMezcla ? (d[id] || 0) : 0) + S.usuario[id];
      if (S.autoMezcla && duck && (id === "armonia" || id === "pads")) t -= 0.04;
      if (S.autoMezcla && !$("#t-coros").checked && id === "coros") t = Math.min(t, gen.mezcla.coros);
      S.objetivo[id] = clamp(t, 0, 1);
    });
  }
  function aplicarFaders(inmediato) {
    if (!S.ac) return;
    const t = S.ac.currentTime;
    CANALES.forEach(({ id }) => {
      const gn = S.mute[id] ? 0 : fader2gain(S.fader[id]);
      const nodo = S.nodos[id]; if (!nodo) return;
      if (!inmediato && Math.abs((aplicarFaders.ult[id] ?? -1) - gn) < 0.0005) return;
      aplicarFaders.ult[id] = gn;
      if (inmediato) nodo.gain.setValueAtTime(gn, t); else nodo.gain.setTargetAtTime(gn, t, 0.04);
    });
  }
  aplicarFaders.ult = {};
  const UI = { faders: {}, vu: {}, vuNivel: {}, vuPico: {} };
  function crearConsola() {
    const cont = $("#canales");
    CANALES.forEach(({ id, nom }) => {
      const el = document.createElement("div"); el.className = "canal" + (id === "master" ? " master" : "");
      el.innerHTML = `<div class="nombre">${nom}</div><div class="cuerpo"><canvas width="12" height="190"></canvas><div class="fader"><div class="marcas"></div><div class="riel"></div><div class="tapa"></div></div></div><div class="db">0.0 dB</div><button class="mute">MUTE</button>`;
      cont.appendChild(el);
      const f = $(".fader", el), tapa = $(".tapa", el);
      UI.faders[id] = { f, tapa, db: $(".db", el) }; UI.vu[id] = $("canvas", el); UI.vuNivel[id] = 0; UI.vuPico[id] = 0;
      let arrastrando = false;
      const mover = (ev) => {
        const r = f.getBoundingClientRect(), v = clamp(1 - (ev.clientY - r.top - 8) / (r.height - 16), 0, 1);
        S.fader[id] = v; const gen = GENEROS[S.genMezcla || S.gen], d = SECCION_DELTA[S.sec] || {};
        S.usuario[id] = v - (gen.mezcla[id] + (S.autoMezcla ? (d[id] || 0) : 0)); S.objetivo[id] = v; aplicarFaders();
      };
      f.addEventListener("pointerdown", (ev) => { arrastrando = true; f.setPointerCapture(ev.pointerId); UI.faders[id].manual = true; mover(ev); });
      f.addEventListener("pointermove", (ev) => arrastrando && mover(ev));
      f.addEventListener("pointerup", () => { arrastrando = false; UI.faders[id].manual = false; });
      f.addEventListener("dblclick", () => { S.usuario[id] = 0; objetivosMezcla(); });
      $(".mute", el).addEventListener("click", (e) => { S.mute[id] = !S.mute[id]; e.target.classList.toggle("on", S.mute[id]); aplicarFaders(); });
    });
  }
  function pintarFader(id) {
    const u = UI.faders[id], v = S.fader[id];
    u.tapa.style.top = `calc(8px + ${(1 - v) * 100}% - ${(1 - v) * 16}px)`;
    u.db.textContent = gain2db(fader2gain(v)) + " dB";
  }
  const buf = new Float32Array(1024);
  function pintarVU(cv, an, id) {
    let pk = 0, s = 0;
    if (an) { an.getFloatTimeDomainData(buf); for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); s += a * a; if (a > pk) pk = a; } }
    const rmsDb = 20 * Math.log10(Math.sqrt(s / buf.length) + 1e-9), pkDb = 20 * Math.log10(pk + 1e-9);
    const lvl = clamp((rmsDb + 54) / 54, 0, 1), pkl = clamp((pkDb + 54) / 54, 0, 1);
    UI.vuNivel[id] = Math.max(lvl, UI.vuNivel[id] * 0.86); UI.vuPico[id] = Math.max(pkl, UI.vuPico[id] - 0.006);
    const c = cv.getContext("2d"), H = cv.height, W = cv.width, segs = 24, sh = H / segs;
    c.clearRect(0, 0, W, H);
    for (let k = 0; k < segs; k++) {
      const y = H - (k + 1) * sh, on = (k + 1) / segs <= UI.vuNivel[id];
      const col = k >= segs - 3 ? "#ff4d3d" : k >= segs - 8 ? "#f3d27a" : "#3fd46b";
      c.fillStyle = on ? col : "#16161c"; c.fillRect(1, y + 1, W - 2, sh - 2);
    }
    const py = H - UI.vuPico[id] * H; c.fillStyle = "#fff"; c.fillRect(1, py, W - 2, 2);
  }
  function bucle() {
    if (S.autoMezcla || true) objetivosMezcla();
    CANALES.forEach(({ id }) => {
      const u = UI.faders[id]; if (!u) return;
      if (!u.manual) {
        const d = S.objetivo[id] - S.fader[id];
        if (Math.abs(d) > 0.0015) { S.fader[id] += d * 0.07; u.f.classList.add("motor"); } else { S.fader[id] = S.objetivo[id]; u.f.classList.remove("motor"); }
      }
      pintarFader(id); pintarVU(UI.vu[id], S.analizadores[id], id);
    });
    pintarVU($("#vu-in"), S.nodos.aIn, "in");
    aplicarFaders();
    if (S.ac && (bucle.n = (bucle.n || 0) + 1) % 60 === 0) mostrarLatencia();
    requestAnimationFrame(bucle);
  }
  UI.vuNivel.in = 0; UI.vuPico.in = 0;
  function pintarSecciones() {
    $$(".sec").forEach((b) => { b.classList.toggle("on", b.dataset.sec === S.sec); b.classList.toggle("next", !!(S.pendiente && S.pendiente.sec === b.dataset.sec)); });
  }

  /* ───────── Perillas de voz ───────── */
  const KNOBS = [
    { k: "ganancia", nom: "Ganancia", min: 0, max: 30, paso: 1, u: "dB", def: 6 },
    { k: "fuerza", nom: "Afinación", min: 0, max: 100, paso: 1, u: "%", def: 100 },
    { k: "velocidad", nom: "Velocidad", min: 0, max: 200, paso: 1, u: "ms", def: 20 },
    { k: "vibrato", nom: "Vibrato", min: 0, max: 60, paso: 1, u: "¢", def: 0 },
    { k: "vibHz", nom: "Vib. vel.", min: 3, max: 8, paso: 0.1, u: "Hz", def: 5.5 },
    { k: "compuerta", nom: "Compuerta", min: -80, max: -25, paso: 1, u: "dB", def: -55 },
    { k: "compresion", nom: "Compresor", min: 0, max: 100, paso: 1, u: "%", def: 50 },
    { k: "graves", nom: "Graves", min: -12, max: 12, paso: 0.5, u: "dB", def: 0 },
    { k: "medios", nom: "Medios", min: -12, max: 12, paso: 0.5, u: "dB", def: 2 },
    { k: "agudos", nom: "Agudos", min: -12, max: 12, paso: 0.5, u: "dB", def: 2 },
  ];
  function crearKnobs() {
    const cont = $("#knobs-voz");
    KNOBS.forEach((d) => {
      const el = document.createElement("div"); el.className = "knob";
      el.innerHTML = `<div class="k"><svg viewBox="0 0 62 62"><circle cx="31" cy="31" r="28" fill="none" stroke="#2a2a33" stroke-width="4" stroke-dasharray="132 176" transform="rotate(135 31 31)"/><circle class="arc" cx="31" cy="31" r="28" fill="none" stroke="#d4a63a" stroke-width="4" stroke-linecap="round" stroke-dasharray="0 176" transform="rotate(135 31 31)"/></svg><div class="dial"></div></div><b>${d.nom}</b><output></output>`;
      cont.appendChild(el); d.el = el;
      let y0 = 0, v0 = 0, act = false;
      el.addEventListener("pointerdown", (e) => { act = true; y0 = e.clientY; v0 = S.voz[d.k]; el.setPointerCapture(e.pointerId); });
      el.addEventListener("pointermove", (e) => { if (!act) return; const v = clamp(v0 + (y0 - e.clientY) / 140 * (d.max - d.min), d.min, d.max); S.voz[d.k] = Math.round(v / d.paso) * d.paso; refrescarKnobs(); aplicarVoz(); });
      el.addEventListener("pointerup", () => (act = false));
      el.addEventListener("dblclick", () => { S.voz[d.k] = d.def; refrescarKnobs(); aplicarVoz(); });
    });
    refrescarKnobs();
  }
  function refrescarKnobs() {
    KNOBS.forEach((d) => {
      if (!d.el) return;
      const v = S.voz[d.k], f = (v - d.min) / (d.max - d.min);
      $(".dial", d.el).style.transform = `rotate(${-135 + 270 * f}deg)`;
      $(".arc", d.el).setAttribute("stroke-dasharray", `${(132 * f).toFixed(1)} 176`);
      $("output", d.el).textContent = (d.paso < 1 ? v.toFixed(1) : Math.round(v)) + " " + d.u;
    });
  }

  /* ───────── Pads sintetizados ───────── */
  function padsAcorde() {
    const ac = S.ac; if (!ac) return;
    const t = ac.currentTime;
    S.padVoces.forEach((v) => { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, 0.35); v.osc.forEach((o) => o.stop(t + 2.5)); });
    S.padVoces = [];
    if (!S.padTipo || !acordeActual()) return;
    const a = acordeActual();
    const notas = [a.root + 48, a.pcs[1] + 48 + (a.pcs[1] < a.root ? 12 : 0), a.pcs[2] + 48 + (a.pcs[2] < a.root ? 12 : 0), a.root + 60].map((n) => (n > 67 ? n - 12 : n));
    for (const n of notas) {
      const f = 440 * Math.pow(2, (n - 69) / 12), g = ac.createGain(), osc = [];
      g.gain.setValueAtTime(0, t);
      let salida = g;
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.6;
      const tipo = S.padTipo, ataque = { cuerdas: 0.5, coro: 0.6, sinte: 0.25, organo: 0.03, viento: 0.3 }[tipo];
      const mk = (type, mult, det, amp) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f * mult; o.detune.value = det; const og = ac.createGain(); og.gain.value = amp; o.connect(og); og.connect(lp); o.start(t); osc.push(o); return o; };
      if (tipo === "cuerdas") { lp.frequency.value = 2400; mk("sawtooth", 1, -9, .3); mk("sawtooth", 1, 8, .3); mk("sawtooth", 2, 3, .08); }
      if (tipo === "sinte") { lp.frequency.value = 1600; mk("sawtooth", 1, -12, .28); mk("square", 1, 12, .18); mk("sawtooth", .5, 0, .12); }
      if (tipo === "organo") { lp.frequency.value = 5000; mk("sine", 1, 0, .35); mk("sine", 2, 0, .22); mk("sine", 3, 0, .12); mk("sine", 4, 0, .08); }
      if (tipo === "viento") { lp.frequency.value = 1300; mk("triangle", 1, -4, .4); mk("sawtooth", 1, 5, .1); }
      if (tipo === "coro") {
        lp.frequency.value = 3500; const fuente = ac.createGain(); fuente.gain.value = 1;
        [[-7, .22], [6, .22], [0, .2]].forEach(([det, amp]) => { const o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det; const og = ac.createGain(); og.gain.value = amp; o.connect(og); og.connect(fuente); o.start(t); osc.push(o); });
        const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 5; lg.gain.value = 6; lfo.connect(lg); osc.forEach((o) => lg.connect(o.detune)); lfo.start(t); osc.push(lfo);
        [[730, 6, 1], [1090, 7, .55], [2440, 9, .25]].forEach(([ff, q, amp]) => { const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = ff; bp.Q.value = q; const bg = ac.createGain(); bg.gain.value = amp * 3; fuente.connect(bp); bp.connect(bg); bg.connect(lp); });
      }
      lp.connect(g); salida.connect(S.nodos.padBus);
      g.gain.setTargetAtTime(0.22, t, ataque / 3);
      S.padVoces.push({ g, osc });
    }
  }

  /* ───────── Web MIDI (MK-900) ───────── */
  const PLANTILLAS = [{ iv: [0, 4, 7], menor: false }, { iv: [0, 3, 7], menor: true }, { iv: [0, 4, 7, 10], menor: false }, { iv: [0, 3, 7, 10], menor: true }, { iv: [0, 4, 10], menor: false }, { iv: [0, 3], menor: true }, { iv: [0, 4], menor: false }, { iv: [0, 7], menor: false }];
  function detectarAcorde(notas) {
    if (!notas.length) return null;
    const pcs = [...new Set(notas.map((n) => mod(n, 12)))], bajo = mod(Math.min(...notas), 12);
    if (pcs.length === 1) { const rel = mod(pcs[0] - S.tonica, 12), m = S.escala.startsWith("menor") ? [0, 5, 7].includes(rel) && rel !== 7 : [2, 4, 9].includes(rel); return triada(pcs[0], m); }
    let mejor = null, ms = -99;
    for (let r = 0; r < 12; r++) for (const p of PLANTILLAS) {
      const set = p.iv.map((i) => mod(r + i, 12)); let s = 0;
      pcs.forEach((pc) => (s += set.includes(pc) ? 1 : -1)); set.forEach((pc) => { if (!pcs.includes(pc)) s -= 0.6; });
      if (r === bajo) s += 0.5; if (s > ms) { ms = s; mejor = triada(r, p.menor); }
    }
    return mejor;
  }
  async function conectarMIDI() {
    if (!navigator.requestMIDIAccess) { toast("Este navegador no tiene Web MIDI (usa Chrome en Android)."); return; }
    try {
      const acc = await navigator.requestMIDIAccess({ sysex: false });
      const enlazar = () => {
        const ins = [...acc.inputs.values()];
        ins.forEach((i) => (i.onmidimessage = midiMsg));
        $("#led-midi").classList.toggle("on", ins.length > 0);
        $("#midi-info").textContent = ins.length ? "Conectado: " + ins.map((i) => i.name).join(", ") : "No veo teclado: conecta el MK-900 por USB (OTG) y vuelve a tocar Conectar.";
      };
      enlazar(); acc.onstatechange = enlazar;
    } catch (_) { toast("Permiso MIDI negado."); }
  }
  function midiMsg(e) {
    const [st, n, v] = e.data, cmd = st & 0xf0;
    if (st === 0xfa) return tocar(); if (st === 0xfc) return detener();
    if (n >= S.split) return;
    if (cmd === 0x90 && v > 0) S.held.add(n); else if (cmd === 0x80 || (cmd === 0x90 && v === 0)) S.held.delete(n); else return;
    if (!S.held.size) return; // memoria de acorde: se queda el último
    const a = detectarAcorde([...S.held]);
    if (a && (!S.acordeMidi || a.nom !== S.acordeMidi.nom)) { S.acordeMidi = a; $("#midi-acorde").textContent = "Acorde: " + a.nom; padsAcorde(); aplicarVoz(); }
  }

  /* ───────── Sin internet ───────── */
  async function guardarOffline() {
    const est = $("#offline-estado");
    if (!("caches" in window)) { est.textContent = "Este navegador no permite guardar."; return; }
    const lista = ["./", "index.html", "css/envivo.css", "js/app.js", "js/voz-dsp.js", "js/voz-worklet.js", "manifest.webmanifest", "img/icono.svg", "img/icono-192.png", "img/icono-512.png", "../js/soundfont-player.min.js", "../data/patterns/index.json"];
    Object.keys(GENEROS).forEach((g) => lista.push(`../data/patterns/${g}.json`));
    ["accordion", "acoustic_bass", "acoustic_guitar_nylon", "acoustic_guitar_steel", "electric_bass_finger", "synth_brass_1", "trumpet", "tuba"].forEach((n) => lista.push(`../soundfonts/FluidR3_GM/${n}-mp3.js`));
    const c = await caches.open("coronel-envivo-v1"); let ok = 0;
    for (const u of lista) { est.textContent = `Guardando ${ok + 1}/${lista.length}…`; try { const r = await fetch(u, { cache: "reload" }); if (r.ok) { await c.put(u, r); ok++; } } catch (_) {} }
    est.textContent = ok === lista.length ? `✔ Todo guardado (${ok} archivos). Ya funciona sin internet.` : `Guardados ${ok}/${lista.length}. Repite con buena señal.`;
  }

  /* ───────── Arranque de la interfaz ───────── */
  let uiLista = false;
  function iniciarUI() {
    if (uiLista) return; uiLista = true;
    const tono = $("#tono"); NOM.forEach((n, i) => tono.add(new Option(n, i)));
    const split = $("#split"); for (let n = 48; n <= 72; n++) split.add(new Option(SF[n % 12] + (Math.floor(n / 12) - 1), n)); split.value = 60;
    crearConsola(); crearKnobs();
    $("#btn-encender").addEventListener("click", encender);
    $("#btn-play").addEventListener("click", tocar);
    $("#btn-stop").addEventListener("click", () => detener());
    $$(".sec").forEach((b) => b.addEventListener("click", () => pedirSeccion(b.dataset.sec)));
    $$(".gen").forEach((b) => b.addEventListener("click", () => elegirGenero(b.dataset.gen)));
    $("#bpm-menos").addEventListener("click", () => { S.bpm = clamp(S.bpm - 2, 60, 200); $("#bpm").textContent = S.bpm; });
    $("#bpm-mas").addEventListener("click", () => { S.bpm = clamp(S.bpm + 2, 60, 200); $("#bpm").textContent = S.bpm; });
    let taps = [];
    $("#bpm-tap").addEventListener("click", () => { const t = performance.now(); taps = taps.filter((x) => t - x < 2500); taps.push(t); if (taps.length >= 3) { const d = (taps[taps.length - 1] - taps[0]) / (taps.length - 1); S.bpm = clamp(Math.round(60000 / d), 60, 200); $("#bpm").textContent = S.bpm; } });
    tono.addEventListener("change", () => { S.tonica = +tono.value; calcularTransp(); aplicarVoz(); });
    $("#escala").addEventListener("change", (e) => { S.escala = e.target.value; calcularTransp(); aplicarVoz(); });
    $("#auto-mezcla").addEventListener("change", (e) => (S.autoMezcla = e.target.checked));
    $("#auto-fill").addEventListener("change", (e) => (S.autoFill = e.target.checked));
    ["#t-afinar", "#t-coros", "#t-coro-acorde", "#t-monitor"].forEach((s) => $(s).addEventListener("change", aplicarVoz));
    $$(".pad").forEach((b) => b.addEventListener("click", async () => {
      await encender(); S.padTipo = S.padTipo === b.dataset.pad ? "" : b.dataset.pad;
      $$(".pad").forEach((x) => x.classList.toggle("on", x.dataset.pad === S.padTipo && !!S.padTipo));
      if (!acordeActual()) S.acordeBar = triada(S.escala.startsWith("menor") ? mod(S.tonica + 3, 12) : S.tonica, false);
      padsAcorde();
    }));
    $("#btn-midi").addEventListener("click", conectarMIDI);
    split.addEventListener("change", () => (S.split = +split.value));
    $("#btn-offline").addEventListener("click", guardarOffline);
    const red = () => $("#led-offline").classList.toggle("warn", !navigator.onLine); window.addEventListener("online", red); window.addEventListener("offline", red); red();
    document.addEventListener("visibilitychange", () => { if (!document.hidden && S.ac && S.ac.state !== "running") S.ac.resume(); });
    S.genMezcla = "cumbia"; elegirGenero("cumbia"); pintarSecciones();
    requestAnimationFrame(bucle);
  }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").then(() => { const l = document.getElementById("led-offline"); if (l) l.title = "Lista para usar sin internet"; }).catch(() => {});
  window.CoronelEnVivo = { S, encender, tocar, detener, pedirSeccion, elegirGenero, detectarAcorde };
  document.addEventListener("DOMContentLoaded", candado);
})();
