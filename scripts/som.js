/**
 * Os sons do computador, sintetizados no browser — sem ficheiros de áudio para
 * licenciar nem para carregar no Forge. Seguem o volume de «Interface» do Foundry.
 */
let ctx = null;
const audio = () => (ctx ??= new (globalThis.AudioContext ?? globalThis.webkitAudioContext)());

function volume() {
  try { return game.settings.get("core", "globalInterfaceVolume") ?? 0.5; } catch { return 0.5; }
}

function tom({ freq = 440, tipo = "sine", dur = 0.08, ganho = 0.2, em = 0, deslize = null }) {
  const a = audio(), t = a.currentTime + em;
  const o = a.createOscillator(), g = a.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(freq, t);
  if (deslize) o.frequency.exponentialRampToValueAtTime(deslize, t + dur);
  const v = ganho * volume();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

function estalido(ganho = 0.12) {
  const a = audio(), t = a.currentTime;
  const n = Math.floor(a.sampleRate * 0.025);
  const b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 6);
  const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
  f.type = "bandpass"; f.frequency.value = 2400 + Math.random() * 900;
  g.gain.value = ganho * volume();
  s.buffer = b; s.connect(f).connect(g).connect(a.destination); s.start(t);
}

export const tocar = {
  tecla: () => estalido(0.14),
  abrir: () => { tom({ freq: 880, dur: 0.05, ganho: 0.06, tipo: "square" }); tom({ freq: 1320, dur: 0.06, ganho: 0.05, tipo: "square", em: 0.05 }); },
  erro: () => { tom({ freq: 150, dur: 0.28, ganho: 0.18, tipo: "sawtooth" }); tom({ freq: 110, dur: 0.3, ganho: 0.14, tipo: "square", em: 0.02 }); },
  acesso: () => { tom({ freq: 660, dur: 0.09, ganho: 0.1, tipo: "square" }); tom({ freq: 990, dur: 0.12, ganho: 0.1, tipo: "square", em: 0.1 }); tom({ freq: 1480, dur: 0.18, ganho: 0.08, tipo: "square", em: 0.22 }); },
  arranque: () => {
    tom({ freq: 40, dur: 1.4, ganho: 0.22, tipo: "sine", deslize: 70 });
    tom({ freq: 3200, dur: 0.05, ganho: 0.05, tipo: "square", em: 0.2 });
    for (let i = 0; i < 6; i++) setTimeout(() => estalido(0.07), 500 + i * 240);
  },
  desligar: () => tom({ freq: 900, dur: 0.35, ganho: 0.08, tipo: "sine", deslize: 60 })
};

/** O browser só deixa tocar som depois de um clique: acorda o áudio no primeiro que houver. */
export function acordar() { try { audio().resume(); } catch { /* sem áudio */ } }
