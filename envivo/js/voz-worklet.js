/* AudioWorklet: usa CoronelDSP (cargado antes con addModule('js/voz-dsp.js')). */
class VozCoronel extends AudioWorkletProcessor {
  constructor() {
    super();
    this.m = new globalThis.CoronelDSP.MotorVoz(sampleRate);
    this.t = 0;
    this.port.onmessage = (e) => { if (e.data && e.data.set) this.m.set(e.data.set); };
    this.port.postMessage({ latenciaMs: this.m.latenciaMs() });
  }
  process(inputs, outputs) {
    const inp = inputs[0] && inputs[0][0];
    const oL = outputs[0][0], o1 = outputs[1][0], o2 = outputs[2][0];
    if (!inp) { oL.fill(0); o1.fill(0); o2.fill(0); return true; }
    this.m.procesar(inp, oL, o1, o2);
    if ((this.t += inp.length) > sampleRate / 20) {
      this.t = 0;
      this.port.postMessage({ estado: this.m.ultimo, latenciaMs: this.m.latenciaMs() });
    }
    return true;
  }
}
registerProcessor("voz-coronel", VozCoronel);
