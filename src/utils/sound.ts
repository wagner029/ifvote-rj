/**
 * Sistema de áudio do IFVote — Urna Digital Estudantil
 * Reproduz o som de confirmação oficial anexado pela comissão
 */

let audioCtx: AudioContext | null = null;
let audioConfirmaElement: HTMLAudioElement | null = null;

function getAudioConfirma(): HTMLAudioElement {
  if (!audioConfirmaElement && typeof Audio !== 'undefined') {
    // Tenta caminho relativo com BASE_URL e fallback
    const basePath = (import.meta as any).env?.BASE_URL || './';
    const cleanBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
    audioConfirmaElement = new Audio(`${cleanBase}assets/confirma-urna.mp3`);
    audioConfirmaElement.volume = 0.85;
    audioConfirmaElement.preload = 'auto';
  }
  return audioConfirmaElement!;
}

function iniciarAudio() {
  if (!audioCtx && typeof window !== 'undefined') {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

export function tocarSomTecla() {
  try {
    iniciarAudio();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine'; // Som suave e pontual
    osc.frequency.setValueAtTime(1500, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
  } catch {
    // Fallback silencioso
  }
}

/**
 * Reproduz o som oficial de confirmação do voto (arquivo mp3 anexado)
 * Uma única vez, em volume adequado, sem travar a interface
 */
export function tocarSomConfirma() {
  try {
    const audio = getAudioConfirma();
    if (audio) {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // Se o navegador bloquear o autoplay de áudio HTML5, usa sintetizador web audio como fallback
          console.warn('HTML5 Audio play restrito, acionando fallback sintetizado:', err);
          tocarSomConfirmaSintetizado();
        });
      }
      return;
    }
  } catch {
    tocarSomConfirmaSintetizado();
  }
}

/**
 * Fallback sintetizado em Web Audio API caso o arquivo de áudio não possa ser carregado
 */
function tocarSomConfirmaSintetizado() {
  try {
    iniciarAudio();
    if (!audioCtx) return;
    const tempoBase = audioCtx.currentTime;

    function tocarNota(freq: number, duracao: number, inicio: number) {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, inicio);

      gain.gain.setValueAtTime(0.3, inicio);
      gain.gain.exponentialRampToValueAtTime(0.01, inicio + duracao);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(inicio);
      osc.stop(inicio + duracao);
    }

    for (let i = 0; i < 5; i++) {
      tocarNota(1400, 0.08, tempoBase + i * 0.12);
      tocarNota(1800, 0.08, tempoBase + i * 0.12 + 0.06);
    }
    tocarNota(2000, 0.8, tempoBase + 0.6);
  } catch {
    // Silencioso
  }
}

