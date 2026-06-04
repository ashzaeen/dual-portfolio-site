"use client";

import { useCallback, useRef, useState } from "react";

// Web-Audio-only SFX layer for the immersive wall.
// All sounds are synthesized — no audio files to ship.
//
//   thud   — cork-board landing when a photo is dropped (low oscillator drop)
//   click  — pin lift / pickup (short high blip)
//   rustle — paper-folded items (boarding pass / receipt) — band-pass noise burst
//   egg    — discovery jingle (4-note arpeggio)
//
// AudioContext is lazily created on first user gesture so we don't trip
// autoplay-policy warnings. Mute toggle is a React state, not just the
// AudioContext's suspend (so muting persists across re-mounts).
export function useSoundFX() {
  const ctxRef = useRef(null);
  const noiseBufRef = useRef(null);
  const [muted, setMuted] = useState(false);

  const getCtx = () => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  };

  // Build a 1s white-noise buffer the first time rustle is requested; reuse after.
  const getNoiseBuffer = (ctx) => {
    if (noiseBufRef.current) return noiseBufRef.current;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBufRef.current = buf;
    return buf;
  };

  const playThud = useCallback(() => {
    if (muted) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(90, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.18);
    } catch {}
  }, [muted]);

  const playClick = useCallback(() => {
    if (muted) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(1100, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.045);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.045);
    } catch {}
  }, [muted]);

  // Paper rustle = band-passed white noise. Resonant peak around 3.5kHz
  // gives it that "crinkled paper" character (vs. dry hiss).
  const playRustle = useCallback(() => {
    if (muted) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 3500;
      bp.Q.value = 1.6;
      const gain = ctx.createGain();
      src.connect(bp);
      bp.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.04, now + 0.09);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      src.start(now);
      src.stop(now + 0.22);
    } catch {}
  }, [muted]);

  const playEgg = useCallback(() => {
    if (muted) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      [0, 0.12, 0.24, 0.38].forEach((t, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = [523, 659, 784, 1047][i];
        gain.gain.setValueAtTime(0.18, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.22);
      });
    } catch {}
  }, [muted]);

  return {
    playThud, playClick, playRustle, playEgg,
    muted, toggleMute: () => setMuted((m) => !m),
  };
}
