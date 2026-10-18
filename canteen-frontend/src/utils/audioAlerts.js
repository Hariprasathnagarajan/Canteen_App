/**
 * Web Audio API synthesized kitchen notification chime with HTML5 Audio fallback.
 * Dual-harmonic acoustic chime: E5 (659.25Hz) + B5 (987.77Hz) with natural exponential decay.
 * 
 * Features:
 * - 100% standalone: zero external mp3/wav files required, zero network dependencies, offline-ready.
 * - Robust unlock engine conforming to modern browser autoplay policies on localhost & production.
 * - Dual playback engines: Web Audio API (primary) + In-memory synthesized WAV Audio element (fallback).
 * - React state subscription for live UI unlock status and kitchen prompt banners.
 */

let audioCtx = null;
let fallbackAudio = null;
let cachedWavDataUri = null;
let isUnlocked = false;
const listeners = new Set();

const notifyListeners = () => {
  const status = isAudioUnlocked();
  listeners.forEach((cb) => {
    try {
      cb(status);
    } catch (_) {}
  });
};

/**
 * Generate in-memory 16-bit PCM WAV Data URI for fallback HTML5 Audio playback.
 * Synthesizes a crisp dual-bell harmonic chime without any external audio asset files.
 */
export const getChimeDataUri = () => {
  if (cachedWavDataUri) return cachedWavDataUri;

  try {
    const sampleRate = 22050;
    const duration = 0.85;
    const numSamples = Math.floor(sampleRate * duration);
    const dataSize = numSamples * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    // RIFF chunk descriptor
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');

    // fmt sub-chunk (16-bit Mono PCM)
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);

    // data sub-chunk
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    // Dual-tone harmonic synthesis: E5 (659.25Hz) & B5 (987.77Hz)
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const env1 = Math.exp(-t * 3.8);
      const tone1 = Math.sin(2 * Math.PI * 659.25 * t) * env1;
      let tone2 = 0;
      if (t >= 0.08) {
        const t2 = t - 0.08;
        const env2 = Math.exp(-t2 * 4.2);
        tone2 = Math.sin(2 * Math.PI * 987.77 * t2) * env2 * 0.75;
      }
      const sample = Math.max(-1, Math.min(1, (tone1 + tone2) * 0.65));
      const intSample = sample < 0 ? sample * 32768 : sample * 32767;
      view.setInt16(44 + i * 2, intSample, true);
    }

    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i += 8192) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, len)));
    }
    cachedWavDataUri = 'data:audio/wav;base64,' + (typeof window !== 'undefined' && window.btoa ? window.btoa(binary) : '');
  } catch (err) {
    console.warn('WAV synthesis failed:', err);
    cachedWavDataUri = '';
  }

  return cachedWavDataUri;
};

/**
 * Lazy singleton getter for Web Audio Context
 */
export const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx) {
    try {
      audioCtx = new AudioContextClass();
    } catch (e) {
      console.warn('AudioContext initialization failed:', e);
      return null;
    }
  }
  return audioCtx;
};

/**
 * Check if audio is currently unlocked and capable of immediate audible playback
 */
export const isAudioUnlocked = () => {
  if (typeof window === 'undefined') return false;
  if (audioCtx && audioCtx.state === 'running') return true;
  return isUnlocked;
};

/**
 * Subscribe to audio unlock / state transitions
 */
export const subscribeAudioStatus = (callback) => {
  listeners.add(callback);
  callback(isAudioUnlocked());
  return () => {
    listeners.delete(callback);
  };
};

/**
 * Warm up and unlock Web Audio and HTML5 audio engines.
 * Called automatically on user interaction or explicitly via UI action.
 */
export const unlockAudio = async () => {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      // Prime hardware audio pipeline with an instantaneous 1-sample silent buffer
      try {
        const silentBuf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = silentBuf;
        src.connect(ctx.destination);
        src.start(0);
      } catch (_) {}
    }

    // Warm up fallback HTML5 Audio element
    if (!fallbackAudio && typeof window !== 'undefined' && typeof window.Audio !== 'undefined') {
      try {
        const uri = getChimeDataUri();
        if (uri) {
          fallbackAudio = new Audio(uri);
          fallbackAudio.volume = 0.75;
          fallbackAudio.preload = 'auto';
        }
      } catch (_) {}
    }

    isUnlocked = true;
    notifyListeners();
    return ctx;
  } catch (err) {
    console.warn('Audio unlock warning:', err);
    return null;
  }
};

// Global auto-unlock on first user gesture anywhere in the browser window
if (typeof window !== 'undefined') {
  const GESTURE_EVENTS = ['click', 'pointerup', 'touchend', 'keydown'];

  const handleFirstGesture = () => {
    unlockAudio().then((ctx) => {
      if (ctx && ctx.state === 'running') {
        GESTURE_EVENTS.forEach((evt) => {
          window.removeEventListener(evt, handleFirstGesture, true);
        });
      }
    });
  };

  GESTURE_EVENTS.forEach((evt) => {
    window.addEventListener(evt, handleFirstGesture, { capture: true, passive: true });
  });
}

/**
 * User preference persistence
 */
export const isSoundEnabled = () => {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem('vdart_kitchen_sound_enabled');
  return stored !== 'false'; // default to true
};

export const setSoundEnabled = (enabled) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('vdart_kitchen_sound_enabled', enabled ? 'true' : 'false');
};

/**
 * Play kitchen order notification chime.
 * Utilizes Web Audio API oscillators as primary engine with HTML5 synthesized WAV as fallback.
 * 
 * @param {Object} [options]
 * @param {boolean} [options.force] Force playback even if sound is muted in settings (e.g. for testing)
 */
export const playOrderChime = async ({ force = false } = {}) => {
  if (!force && !isSoundEnabled()) return false;

  let webAudioSucceeded = false;

  // Engine 1: Web Audio API synthesized Dual Bell Chime
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      if (ctx.state === 'running') {
        const now = ctx.currentTime;

        // Tone 1: E5 (659.25Hz) - bright bell strike
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now);

        gain1.gain.setValueAtTime(0.001, now);
        gain1.gain.exponentialRampToValueAtTime(0.38, now + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

        osc1.connect(gain1);
        gain1.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + 0.9);

        // Tone 2: B5 (987.77Hz) - resonant harmonic bell chime fired 80ms later
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(987.77, now + 0.08);

        gain2.gain.setValueAtTime(0.001, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.3, now + 0.11);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.15);

        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        osc2.start(now + 0.08);
        osc2.stop(now + 1.2);

        webAudioSucceeded = true;
        isUnlocked = true;
        notifyListeners();
        return true;
      }
    }
  } catch (err) {
    console.warn('Web Audio chime playback failed, attempting HTML5 fallback:', err);
  }

  // Engine 2: HTML5 Audio synthesized WAV fallback
  if (!webAudioSucceeded) {
    try {
      if (!fallbackAudio) {
        const uri = getChimeDataUri();
        if (uri) {
          fallbackAudio = new Audio(uri);
          fallbackAudio.volume = 0.75;
        }
      }

      if (fallbackAudio) {
        fallbackAudio.currentTime = 0;
        await fallbackAudio.play();
        isUnlocked = true;
        notifyListeners();
        return true;
      }
    } catch (fallbackErr) {
      console.warn('HTML5 audio fallback also blocked or failed:', fallbackErr);
    }
  }

  return false;
};

/**
 * Explicit audio test triggered by user action.
 * Unlocks audio context and immediately fires test chime with guaranteed user gesture.
 */
export const testOrderChime = async () => {
  await unlockAudio();
  return playOrderChime({ force: true });
};
