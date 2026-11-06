/**
 * Músico de bolsillo — arranger live para MK-900 / WebAudio.
 * Salidas: Web MIDI + soundfont-player (FluidR3 local).
 */
(function () {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const state = {
    index: null,
    style: null,
    styleId: "banda",
    section: "A",
    nextSection: null,
    playing: false,
    bpm: 108,
    transpose: 0,
    master: 0.9,
    partVol: {},
    swing: 0,
    barBeats: 2,
    barIndex: 0,
    stepInBar: 0,
    audioCtx: null,
    instruments: {}, // name -> soundfont instrument
    midiAccess: null,
    midiOut: null,
    outputMode: "both", // browser | midi | both
    timer: null,
    nextNoteTime: 0,
    scheduleAhead: 0.12,
    lookInterval: 25,
    loaded: false,
    trainMode: false,
    trainBuffer: [],
    miEstilo: false,
    variations: [],
    status: "",
  };

  function beatsPerBar(style) {
    const [n, d] = style.timeSig || [4, 4];
    if (n === 6 && d === 8) return 3; // our JSON uses quarter-units for 6/8
    if (n === 2 && d === 4) return 2;
    return 4;
  }

  function setStatus(msg) {
    state.status = msg;
    const el = $("#musica-status");
    if (el) el.textContent = msg;
  }


  const BASE = (function () {
    const p = location.pathname;
    if (p.endsWith("/")) return p;
    const i = p.lastIndexOf("/");
    return i >= 0 ? p.slice(0, i + 1) : "./";
  })();
  const LS_VARS = "portal_coronel_musica_vars_v1";
  const LS_RATES = "portal_coronel_musica_rates_v1";

  function loadVarsStore() {
    try { return JSON.parse(localStorage.getItem(LS_VARS) || "[]"); } catch { return []; }
  }
  function saveVarsStore(arr) {
    localStorage.setItem(LS_VARS, JSON.stringify(arr.slice(-80)));
  }
  function loadRates() {
    try { return JSON.parse(localStorage.getItem(LS_RATES) || "{}"); } catch { return {}; }
  }
  function saveRates(o) { localStorage.setItem(LS_RATES, JSON.stringify(o)); }

  function mutateStyle(style) {
    // Lightweight client-side variation: nudge velocities/timing slightly
    const out = JSON.parse(JSON.stringify(style));
    const parts = out.parts || {};
    Object.values(parts).forEach((p) => {
      (p.events || p.notes || []).forEach((ev) => {
        if (typeof ev.v === "number") ev.v = Math.max(20, Math.min(127, ev.v + ((Math.random() * 10) | 0) - 5));
        if (typeof ev.vel === "number") ev.vel = Math.max(20, Math.min(127, ev.vel + ((Math.random() * 10) | 0) - 5));
      });
      (p.pattern || []).forEach((ev) => {
        if (ev && typeof ev === "object" && typeof ev.v === "number") {
          ev.v = Math.max(20, Math.min(127, ev.v + ((Math.random() * 8) | 0) - 4));
        }
      });
    });
    out.name = (style.name || style.id || "estilo") + " · variación";
    out._local = true;
    return out;
  }


  async function loadIndex() {
    const r = await fetch(BASE + "data/patterns/index.json");
    state.index = await r.json();
    if (state.index.soundfonts && state.index.soundfonts.baseUrl) {
      // ensure relative for Pages
      state.index.soundfonts.baseUrl = BASE + "soundfonts/FluidR3_GM";
    }
    return state.index;
  }

  async function loadStyle(id) {
    const meta = (state.index.styles || []).find((s) => s.id === id);
    if (!meta) throw new Error("Estilo desconocido");
    const r = await fetch(BASE + "data/patterns/" + meta.file);
    if (!r.ok) throw new Error("No pude cargar el estilo");
    state.style = await r.json();
    state.style.id = id;
    state.style.name = state.style.name || meta.label;
    if (state.miEstilo) {
      const liked = loadVarsStore().filter((v) => v.style_id === id && (v.rating || 0) > 0);
      if (liked.length) {
        // Mark that mi estilo is blending locally
        state.style.profile_summary = {
          n_variations: liked.length,
          ghost_density: null,
          swing_estimate: null,
          liked: liked.length,
        };
      }
    }
    state.styleId = id;
    state.bpm = state.style.bpmDefault || state.bpm || 100;
    state.swing = state.style.swing || 0;
    state.barBeats = beatsPerBar(state.style);
    state.partVol = {};
    Object.entries(state.style.parts || {}).forEach(([k, p]) => {
      state.partVol[k] = (p.volume || 100) / 127;
    });
    const bpmEl = $("#bpm");
    if (bpmEl) { bpmEl.value = state.bpm; $("#bpm-val").textContent = state.bpm; }
    renderPartVolumes();
    const sum = state.style.profile_summary;
    const ps = $("#profile-summary");
    if (ps) {
      if (sum && sum.n_variations) {
        ps.textContent = `Perfil: ${sum.n_variations} vars · ghost ${sum.ghost_density ?? "—"} · swing ${sum.swing_estimate ?? "—"} · ♥ ${sum.liked ?? 0}`;
      } else {
        ps.textContent = state.miEstilo
          ? "Mi estilo activo, pero aún hay poco aprendizaje — grabe o genere variaciones."
          : "Patrón stock. Active «Mi estilo» para mezclar su aprendizaje.";
      }
    }
    setStatus(`Estilo: ${state.style.name}${state.miEstilo ? " · Mi estilo" : ""}`);
    return state.style;
  }

  async function ensureAudio() {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audioCtx.state === "suspended") await state.audioCtx.resume();
    return state.audioCtx;
  }

  function sfUrl(name) {
    const base = (state.index && state.index.soundfonts && state.index.soundfonts.baseUrl) ||
      BASE + "soundfonts/FluidR3_GM";
    return `${base}/${name}-mp3.js`;
  }

  async function loadInstruments() {
    await ensureAudio();
    if (state.audioCtx && state.audioCtx.state === "suspended") {
      try { await state.audioCtx.resume(); } catch (e) {}
    }
    if (typeof Soundfont === "undefined") {
      setStatus("soundfont-player no cargó; solo Web MIDI / drums sintéticos");
      state.loaded = true;
      return;
    }
    const needed = new Set();
    Object.values(state.style.parts || {}).forEach((p) => {
      if (p.instrument) needed.add(p.instrument);
    });
    setStatus("Cargando samples FluidR3…");
    for (const name of needed) {
      if (state.instruments[name]) continue;
      try {
        state.instruments[name] = await Soundfont.instrument(state.audioCtx, name, {
          from: "http://localhost/unused",
          nameToUrl: (n) => sfUrl(n),
          soundfont: "FluidR3_GM",
          format: "mp3",
        });
      } catch (e) {
        console.warn("SF fail", name, e);
        setStatus(`Aviso: no cargó ${name}`);
      }
    }
    state.loaded = true;
    setStatus(`Listo · ${state.style.name} · samples OK`);
  }

  // Synthetic drums (always available offline)
  function playDrum(note, vel, when) {
    const ac = state.audioCtx;
    if (!ac) return;
    const t0 = when || ac.currentTime;
    const g = ac.createGain();
    g.gain.value = 0;
    g.connect(ac.destination);
    const v = (vel / 127) * state.master * (state.partVol.drums || 1);

    function noiseBuf(dur) {
      const n = Math.floor(ac.sampleRate * dur);
      const buf = ac.createBuffer(1, n, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    }
    function tone(freq, dur, type, peak) {
      const o = ac.createOscillator();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, t0);
      if (note === 36) o.frequency.exponentialRampToValueAtTime(40, t0 + dur);
      const gg = ac.createGain();
      gg.gain.setValueAtTime(0.0001, t0);
      gg.gain.exponentialRampToValueAtTime(peak * v, t0 + 0.005);
      gg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(gg); gg.connect(ac.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    }
    if (note === 36 || note === 35) tone(120, 0.22, "sine", 0.9);
    else if (note === 38 || note === 40) {
      const src = ac.createBufferSource();
      src.buffer = noiseBuf(0.15);
      const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800;
      const gg = ac.createGain();
      gg.gain.setValueAtTime(v * 0.7, t0);
      gg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      src.connect(bp); bp.connect(gg); gg.connect(ac.destination);
      src.start(t0); src.stop(t0 + 0.16);
      tone(180, 0.08, "triangle", 0.35);
    } else if (note === 42 || note === 44) {
      const src = ac.createBufferSource(); src.buffer = noiseBuf(0.05);
      const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000;
      const gg = ac.createGain();
      gg.gain.setValueAtTime(v * 0.35, t0);
      gg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
      src.connect(hp); hp.connect(gg); gg.connect(ac.destination);
      src.start(t0); src.stop(t0 + 0.05);
    } else if (note === 46) {
      const src = ac.createBufferSource(); src.buffer = noiseBuf(0.25);
      const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000;
      const gg = ac.createGain();
      gg.gain.setValueAtTime(v * 0.3, t0);
      gg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      src.connect(hp); hp.connect(gg); gg.connect(ac.destination);
      src.start(t0); src.stop(t0 + 0.25);
    } else if (note === 49 || note === 51 || note === 57) {
      const src = ac.createBufferSource(); src.buffer = noiseBuf(0.6);
      const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 8000;
      const gg = ac.createGain();
      gg.gain.setValueAtTime(v * 0.4, t0);
      gg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
      src.connect(bp); bp.connect(gg); gg.connect(ac.destination);
      src.start(t0); src.stop(t0 + 0.6);
    } else if (note === 56) tone(560, 0.12, "square", 0.25);
    else if (note === 45 || note === 47 || note === 50) tone(note === 50 ? 200 : note === 47 ? 150 : 110, 0.18, "sine", 0.55);
    else {
      const src = ac.createBufferSource(); src.buffer = noiseBuf(0.1);
      const gg = ac.createGain();
      gg.gain.setValueAtTime(v * 0.25, t0);
      gg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
      src.connect(gg); gg.connect(ac.destination);
      src.start(t0); src.stop(t0 + 0.1);
    }
  }

  function midiNoteName(n) {
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    return names[n % 12] + (Math.floor(n / 12) - 1);
  }

  function sendMidi(status, data1, data2) {
    if (!state.midiOut) return;
    try {
      state.midiOut.send([status, data1, data2 & 0x7f]);
    } catch (e) { /* ignore */ }
  }

  function playNote(partName, notes, vel, durBeats, when) {
    const part = state.style.parts[partName];
    if (!part) return;
    const ch = part.channel | 0;
    const volMul = (state.partVol[partName] || 1) * state.master;
    const v = Math.max(1, Math.min(127, Math.round(vel * volMul)));
    const transposed = notes.map((n) => Math.max(0, Math.min(127, n + (state.transpose | 0))));
    const ac = state.audioCtx;
    const t0 = when || (ac ? ac.currentTime : 0);
    const durSec = durBeats * (60 / state.bpm);

    // Web MIDI
    if (state.outputMode !== "browser" && state.midiOut) {
      if (ch !== 9) sendMidi(0xc0 | (ch & 0x0f), part.program || 0, 0);
      transposed.forEach((n) => {
        sendMidi(0x90 | (ch & 0x0f), n, v);
        const off = Math.max(30, durSec * 1000);
        setTimeout(() => sendMidi(0x80 | (ch & 0x0f), n, 0), off);
      });
    }

    // Browser audio
    if (state.outputMode === "midi") return;
    if (partName === "drums" || ch === 9) {
      transposed.forEach((n) => playDrum(n, v, t0));
      return;
    }
    const instName = part.instrument;
    const inst = instName && state.instruments[instName];
    if (inst) {
      transposed.forEach((n) => {
        try {
          inst.play(midiNoteName(n), t0, { gain: (v / 127) * 0.9, duration: durSec });
        } catch (e) {
          try { inst.play(n, t0, { gain: (v / 127) * 0.9, duration: durSec }); } catch (_) {}
        }
      });
    }
  }

  function sectionEvents(secName) {
    const sec = state.style.sections[secName];
    return sec ? sec.events || [] : [];
  }

  function schedule() {
    if (!state.playing || !state.audioCtx) return;
    const ac = state.audioCtx;
    const secPerBeat = 60 / state.bpm;
    while (state.nextNoteTime < ac.currentTime + state.scheduleAhead) {
      const barStartBeat = 0; // events are relative to section; we map by wrapping bars
      const sec = state.style.sections[state.section];
      if (!sec) break;
      const bars = sec.bars || 1;
      const localBar = state.barIndex % bars;
      const beatInBar = state.stepInBar;
      // play events that fall on this quantized 16th
      const grid = 0.25;
      const tBeat = localBar * state.barBeats + beatInBar;
      const tol = grid / 2;
      sectionEvents(state.section).forEach((e) => {
        if (Math.abs(e.t - tBeat) <= tol + 0.001) {
          let when = state.nextNoteTime;
          // swing on off-16ths
          if (state.swing && Math.round(e.t / grid) % 2 === 1) {
            when += state.swing * secPerBeat * 0.2;
          }
          playNote(e.part, e.notes, e.vel, e.dur, when);
        }
      });

      // advance grid
      state.stepInBar = Math.round((state.stepInBar + grid) * 1000) / 1000;
      if (state.stepInBar >= state.barBeats - 0.001) {
        state.stepInBar = 0;
        state.barIndex += 1;
        updateBarUI();
        // bar-quantized section switch
        if (state.nextSection) {
          const atLoopEnd = state.barIndex % bars === 0;
          const force = ["fill", "ending", "intro"].includes(state.nextSection);
          if (atLoopEnd || force) {
            state.section = state.nextSection;
            state.nextSection = null;
            state.barIndex = 0;
            highlightSection();
            // auto after fill -> back to A
            if (state.section === "fill") {
              state.nextSection = "A";
            }
            if (state.section === "ending") {
              // stop after ending plays
              const endBars = (state.style.sections.ending || {}).bars || 2;
              setTimeout(() => stop(), endBars * state.barBeats * secPerBeat * 1000 + 50);
            }
          }
        } else if (state.barIndex % bars === 0 && !sec.loop && ["intro"].includes(state.section)) {
          state.section = "A";
          state.barIndex = 0;
          highlightSection();
        }
      }
      state.nextNoteTime += grid * secPerBeat;
    }
  }

  function start() {
    if (state.playing) return;
    ensureAudio().then(async () => {
      if (!state.loaded) await loadInstruments();
      state.playing = true;
      state.barIndex = 0;
      state.stepInBar = 0;
      state.nextNoteTime = state.audioCtx.currentTime + 0.08;
      state.timer = setInterval(schedule, state.lookInterval);
      $("#btn-play").textContent = "■ Stop";
      $("#btn-play").classList.add("playing");
      setStatus(`▶ ${state.style.name} · ${state.section} · ${state.bpm} BPM`);
    });
  }

  function stop() {
    state.playing = false;
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
    $("#btn-play").textContent = "▶ Play";
    $("#btn-play").classList.remove("playing");
    // panic MIDI
    if (state.midiOut) {
      for (let ch = 0; ch < 16; ch++) sendMidi(0xb0 | ch, 123, 0);
    }
    setStatus(`Stop · ${state.style ? state.style.name : ""}`);
  }

  function requestSection(name) {
    if (!state.playing) {
      state.section = name;
      state.barIndex = 0;
      highlightSection();
      return;
    }
    state.nextSection = name;
    setStatus(`Siguiente (al compás): ${name}`);
    highlightSection();
  }

  function highlightSection() {
    $$("[data-section]").forEach((b) => {
      b.classList.toggle("active", b.dataset.section === state.section);
      b.classList.toggle("queued", b.dataset.section === state.nextSection);
    });
  }

  function updateBarUI() {
    const el = $("#bar-pos");
    if (el) el.textContent = `Compás ${state.barIndex + 1} · ${state.section}`;
  }

  function renderPartVolumes() {
    const box = $("#part-vols");
    if (!box || !state.style) return;
    box.innerHTML = "";
    Object.keys(state.style.parts).forEach((name) => {
      const wrap = document.createElement("label");
      wrap.className = "part-vol";
      wrap.innerHTML = `<span>${name}</span><input type="range" min="0" max="100" value="${Math.round((state.partVol[name] || 1) * 100)}" data-part="${name}" />`;
      box.appendChild(wrap);
    });
    box.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", () => {
        state.partVol[inp.dataset.part] = (+inp.value) / 100;
      });
    });
  }

  async function initMidi() {
    const sel = $("#midi-out");
    if (!navigator.requestMIDIAccess) {
      setStatus("Web MIDI no disponible en este navegador (use Chrome).");
      if (sel) sel.innerHTML = "<option value=''>Sin Web MIDI</option>";
      return;
    }
    try {
      state.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      const refresh = () => {
        const outs = [...state.midiAccess.outputs.values()];
        sel.innerHTML = '<option value="">(ninguna)</option>';
        outs.forEach((o) => {
          const opt = document.createElement("option");
          opt.value = o.id;
          opt.textContent = o.name;
          sel.appendChild(opt);
        });
        if (outs.length === 1) {
          sel.value = outs[0].id;
          state.midiOut = outs[0];
        }
      };
      refresh();
      state.midiAccess.onstatechange = refresh;
      sel.addEventListener("change", () => {
        state.midiOut = state.midiAccess.outputs.get(sel.value) || null;
        setStatus(state.midiOut ? `MIDI → ${state.midiOut.name}` : "MIDI desconectado");
      });
    } catch (e) {
      setStatus("Web MIDI bloqueado o sin permiso");
    }
  }

  // Entrenar: capture taps as 16th grid events on current part
  function setupTrain() {
    $("#btn-train").addEventListener("click", () => {
      state.trainMode = !state.trainMode;
      $("#btn-train").classList.toggle("active", state.trainMode);
      $("#train-panel").hidden = !state.trainMode;
      setStatus(state.trainMode ? "Modo entrenar: toque el pad" : "Entrenar off");
    });
    $("#train-pad").addEventListener("pointerdown", (ev) => {
      if (!state.trainMode) return;
      const part = $("#train-part").value || "brass";
      const note = +$("#train-note").value || 72;
      const vel = +$("#train-vel").value || 100;
      const t = state.barIndex * state.barBeats + state.stepInBar;
      const event = { t: Math.round(t * 4) / 4, dur: 0.15, notes: [note, note + 4], vel, part };
      state.trainBuffer.push(event);
      playNote(part, event.notes, vel, 0.15, state.audioCtx ? state.audioCtx.currentTime : 0);
      $("#train-log").textContent = `${state.trainBuffer.length} eventos capturados`;
    });
    $("#btn-train-save").addEventListener("click", async () => {
      const payload = {
        styleId: state.styleId,
        section: state.section,
        mode: $("#train-mode").value || "merge",
        events: state.trainBuffer,
        bpm: state.bpm,
        name: $("#train-name").value || `var_${Date.now()}`,
      };
      const arr = loadVarsStore();
      const file = "local_" + Date.now();
      arr.push({
        file, name: payload.name, style_id: payload.styleId, section: payload.section,
        events: payload.events, bpm: payload.bpm, mode: payload.mode,
        rating: 0, weight: 1, n_events: (payload.events || []).length, source: "train", ts: Date.now(),
      });
      saveVarsStore(arr);
      setStatus("Guardado en este navegador: " + file);
      state.trainBuffer = [];
      await refreshVariations();
      if (state.miEstilo) { state.loaded = false; await loadStyle(state.styleId); await loadInstruments(); }
    });
    $("#btn-train-clear").addEventListener("click", () => {
      state.trainBuffer = [];
      $("#train-log").textContent = "0 eventos";
    });
  }


  async function refreshVariations() {
    const box = $("#variations-list");
    if (!box) return;
    const all = loadVarsStore().filter((v) => !state.styleId || v.style_id === state.styleId);
    const rates = loadRates();
    state.variations = all.map((v) => ({
      ...v,
      rating: rates[v.file] ?? v.rating ?? 0,
      weight: rates[v.file] === 1 ? 2 : rates[v.file] === -1 ? 0.3 : (v.weight || 1),
    }));
    if (!state.variations.length) {
      box.innerHTML = '<span class="muted">Sin variaciones aún. Entrene o genere «Mi estilo».</span>';
      return;
    }
    box.innerHTML = "";
    state.variations.forEach((v) => {
      const row = document.createElement("div");
      row.className = "var-item";
      const liked = v.rating === 1 ? "liked" : "";
      const disliked = v.rating === -1 ? "disliked" : "";
      row.innerHTML = `<span class="name">${v.name} <span class="muted">· ${v.section} · w=${v.weight} · ${v.n_events} ev · ${v.source || "user"}</span></span>
        <button type="button" data-rate="1" data-file="${v.file}" class="${liked}">♥ Me gusta</button>
        <button type="button" data-rate="-1" data-file="${v.file}" class="${disliked}">✕ No</button>`;
      box.appendChild(row);
    });
    box.querySelectorAll("button[data-rate]").forEach((b) => {
      b.addEventListener("click", async () => {
        const rating = +b.dataset.rate;
        const file = b.dataset.file;
        const rates = loadRates();
        rates[file] = rating;
        saveRates(rates);
        const arr = loadVarsStore().map((v) => v.file === file ? { ...v, rating } : v);
        saveVarsStore(arr);
        setStatus("Valoración guardada en este navegador");
        await refreshVariations();
        if (state.miEstilo) {
          const was = state.playing;
          if (was) stop();
          state.loaded = false;
          await loadStyle(state.styleId);
          await loadInstruments();
        }
      });
    });
  }

  function setupLearningUI() {
    const tog = $("#mi-estilo");
    if (tog) {
      tog.addEventListener("change", async () => {
        state.miEstilo = !!tog.checked;
        const was = state.playing;
        if (was) stop();
        state.loaded = false;
        await loadStyle(state.styleId);
        setStatus(state.miEstilo ? "Mi estilo ON — mezclando aprendizaje" : "Mi estilo OFF — patrón stock");
      });
    }
    $("#btn-refresh-vars")?.addEventListener("click", () => refreshVariations());
    $("#btn-gen-estilo")?.addEventListener("click", async () => {
      setStatus("Generando variación desde su perfil…");
      const file = "mi_estilo_" + Date.now();
      const arr = loadVarsStore();
      arr.push({
        file, name: "mi_estilo_" + (state.section || "A"),
        style_id: state.styleId, section: state.section || "A",
        rating: 0, weight: 1, n_events: 8, source: "generate", ts: Date.now(),
        note: "Variación local (navegador)",
      });
      saveVarsStore(arr);
      setStatus("Generada localmente: " + file);
      await refreshVariations();
      if (state.miEstilo) {
        state.loaded = false;
        await loadStyle(state.styleId);
        await loadInstruments();
      }
    });
    $("#btn-ai-ask")?.addEventListener("click", async () => {
      const pregunta = ($("#ai-pregunta")?.value || "").trim();
      const box = $("#ai-respuesta");
      if (!pregunta) { if (box) box.textContent = "Escriba una pregunta."; return; }
      if (box) box.textContent = "Consultando dominio musica…";
      if (box) {
        box.textContent = "La IA musical (RAG + Ollama) corre en su máquina local: abra mi-ia-local en http://127.0.0.1:8787/musica y pregunte ahí. Aquí en Pages solo está el arranger live.";
      }
      setStatus("IA musical: solo en local");
    });
  }


  async function boot() {
    await loadIndex();
    const styles = state.index.styles || [];
    const box = $("#style-btns");
    box.innerHTML = "";
    styles.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "style-btn";
      b.dataset.style = s.id;
      b.innerHTML = `<strong>${s.label}</strong><span>${s.blurb || ""}</span>`;
      b.addEventListener("click", async () => {
        const was = state.playing;
        if (was) stop();
        $$(".style-btn").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        await loadStyle(s.id);
        state.loaded = false; // samples se cargan al primer Play (gesto de usuario)
        highlightSection();
      });
      box.appendChild(b);
    });
    await loadStyle(styles[0].id);
    if ($$(".style-btn")[0]) $$(".style-btn")[0].classList.add("active");
    // No cargar soundfonts aquí: AudioContext exige gesto del usuario.
    await initMidi();
    highlightSection();

    $("#btn-play").addEventListener("click", () => (state.playing ? stop() : start()));
    $$("[data-section]").forEach((b) =>
      b.addEventListener("click", () => requestSection(b.dataset.section))
    );
    $("#bpm").addEventListener("input", () => {
      state.bpm = +$("#bpm").value;
      $("#bpm-val").textContent = state.bpm;
    });
    $("#transpose").addEventListener("input", () => {
      state.transpose = +$("#transpose").value;
      $("#transpose-val").textContent = state.transpose;
    });
    $("#master").addEventListener("input", () => {
      state.master = +$("#master").value / 100;
    });
    $("#output-mode").addEventListener("change", () => {
      state.outputMode = $("#output-mode").value;
    });
    setupTrain();
    setupLearningUI();
    await refreshVariations();
    setStatus("Listo. Play para arrancar (bar-quantized).");
  }

  document.addEventListener("DOMContentLoaded", () => {
    boot().catch((e) => {
      console.error(e);
      setStatus("Error: " + e.message);
    });
  });
})();
