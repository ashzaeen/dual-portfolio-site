"use client";

import { useEffect, useRef, useState } from "react";
import { FALLBACK_SONGS } from "@/data/songs";
import ScrollReveal from "@/components/shared/ScrollReveal";
import SectionGuide from "@/components/shared/SectionGuide";
import { FALLBACK_SECTION_COPY } from "@/data/sections";
import NotionImage from "@/components/shared/NotionImage";
import styles from "./MusicSection.module.css";
import { analytics } from "@/lib/analytics";

const ACCENT_PALETTE = [
  "#a0691f", "#3a6a9a", "#c4a050", "#a04068",
  "#6a8ac4", "#7a8a3a", "#8a5a3a", "#4a8a7a",
];

function hashAccent(seed) {
  let h = 0;
  const s = String(seed || "x");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ACCENT_PALETTE[Math.abs(h) % ACCENT_PALETTE.length];
}

function deriveLabel(hex) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return "#333333";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const h = (n) => Math.round(n * 0.6).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function normalizeSong(song, index) {
  const accent = song.accent || ACCENT_PALETTE[index % ACCENT_PALETTE.length];
  return { ...song, accent, label: deriveLabel(accent) };
}

function timeAgo(ms) {
  if (!ms) return null;
  const diff = Date.now() - ms;
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

/* ─── VINYL DISC ─────────────────────────────────────────── */
function VinylDisc({ song, size = 200, spinning = false, speed = 33, suffix = "" }) {
  const grooves = [];
  for (let i = 0; i < 16; i++) {
    const r = 0.96 - i * 0.034;
    grooves.push(
      <circle key={i} cx="100" cy="100" r={r * 95} fill="none"
        stroke={i % 2 ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.55)"}
        strokeWidth={i % 2 ? "0.35" : "0.55"} />
    );
  }
  const dur = speed === 45 ? 1.33 : 1.8;
  const did = `vd-${song.id}${suffix}`;
  const lid = `vl-${song.id}${suffix}`;
  const cid = `vc-${song.id}${suffix}`;
  return (
    <div
      className={styles.vinylWrap}
      style={{
        width: size, height: size,
        animation: spinning ? `vinylSpin ${dur}s linear infinite` : "none",
      }}
    >
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ display: "block" }}>
        <defs>
          <radialGradient id={did} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1a1610" />
            <stop offset="55%" stopColor="#0c0a08" />
            <stop offset="100%" stopColor="#15110c" />
          </radialGradient>
          <radialGradient id={lid} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={song.accent} />
            <stop offset="78%" stopColor={song.label || song.accent} />
            <stop offset="100%" stopColor={song.label || song.accent} stopOpacity="0.85" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="98" fill={`url(#${did})`} />
        {grooves}
        <ellipse cx="78" cy="58" rx="38" ry="20" fill="rgba(255,255,255,0.06)" transform="rotate(-32 78 58)" />
        <circle cx="100" cy="100" r="34" fill={`url(#${lid})`} />
        <circle cx="100" cy="100" r="34" fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="0.5" />
        <text fill="rgba(255,255,255,0.45)" fontFamily="var(--font-mono)" fontSize="3.4" letterSpacing="0.16em" textAnchor="middle">
          <textPath href={`#${cid}`} startOffset="50%">
            {(song.artist || "").toUpperCase()} · {song.year ?? ""}
          </textPath>
        </text>
        <path id={cid} d="M 70,100 a 30,30 0 1 1 60,0" fill="none" />
        <circle cx="100" cy="100" r="2.6" fill="#0a0805" />
        <circle cx="100" cy="100" r="1.8" fill="rgba(255,255,255,0.12)" />
      </svg>
    </div>
  );
}

/* ─── MINI VINYL (crate list) ────────────────────────────── */
function MiniVinyl({ song, size = 40, spinning = false, speed = 33 }) {
  const dur = speed === 45 ? 1.33 : 1.8;
  return (
    <div
      className={styles.miniVinylDisc}
      style={{
        width: size, height: size,
        animation: spinning ? `vinylSpin ${dur}s linear infinite` : "none",
      }}
    >
      {[0.85, 0.7, 0.56, 0.44].map((r, i) => (
        <div key={i} className={styles.miniVinylRing}
          style={{ width: size * r, height: size * r }} />
      ))}
      <div className={styles.miniVinylLabel}
        style={{
          width: size * 0.38, height: size * 0.38,
          background: `radial-gradient(circle, ${song.accent} 0%, ${song.label || song.accent} 100%)`,
        }}
      >
        <div className={styles.miniVinylHole} />
      </div>
    </div>
  );
}

/* ─── ALBUM ART ──────────────────────────────────────────── */
function AlbumArt({ song, width, height, className }) {
  const initials = (song.title || song.name || "")
    .split(" ").slice(0, 2).map((w) => w[0]).join("");

  // Generated gradient art — shown when there's no cover at all, and also used
  // as the fallback if a (proxied) cover image fails to load.
  const gradientArt = (
    <div
      className={`${styles.albumArtGen} ${className || ""}`}
      style={{
        width, height,
        background: `linear-gradient(140deg, ${song.accent} 0%, ${song.label || song.accent} 50%, #15110c 130%)`,
      }}
    >
      <div className={styles.albumArtGrain} />
      <div className={styles.albumArtCornerTL} />
      <div className={styles.albumArtCornerBR} />
      <div className={styles.albumArtStreak} />
      <div className={styles.albumArtTop}>
        {song.from || song.album || song.artist}
      </div>
      <div className={styles.albumArtBottom}>
        <div className={styles.albumArtTitle}>{song.title || song.name || initials}</div>
        <div className={styles.albumArtMeta}>
          {song.artist}{song.year ? ` · ${song.year}` : ""}
        </div>
      </div>
    </div>
  );

  return (
    <NotionImage
      src={song.cover || song.image}
      alt={song.title || song.name || song.album || "cover"}
      className={`${styles.albumArtImg} ${className || ""}`}
      style={{ width, height }}
      fallback={gradientArt}
    />
  );
}

/* ─── EQUALIZER ──────────────────────────────────────────── */
// Per-bar durations/offsets are deliberately irregular (not a linear ramp) so
// the bars fall out of phase and read like a real spectrum analyzer reacting
// to audio, rather than a synchronized bounce.
const EQ_DURS = [0.64, 0.83, 0.55, 0.74, 0.6, 0.79];
const EQ_DELAYS = [0, 0.21, 0.37, 0.09, 0.28, 0.14];

function Equalizer({ playing = true, color = "var(--gold)", bars = 4 }) {
  return (
    <div className={styles.eq}>
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} className={styles.eqBar}
          style={{
            background: color,
            animation: playing
              ? `eqBar ${EQ_DURS[i % EQ_DURS.length]}s ease-in-out ${EQ_DELAYS[i % EQ_DELAYS.length]}s infinite`
              : "none",
            opacity: playing ? 1 : 0.4,
            transform: playing ? undefined : "scaleY(0.3)",
          }}
        />
      ))}
    </div>
  );
}

/* ─── TONEARM ────────────────────────────────────────────── */
function Tonearm({ playing }) {
  const angle = playing ? -22 : -58;
  return (
    <div className={styles.tonearmWrap}>
      <div className={styles.tonearmBase} />
      <div className={styles.tonearmPivot} />
      <div className={styles.tonearmArm} style={{ transform: `rotate(${angle}deg)` }}>
        <div className={styles.tonearmHead}>
          <div className={styles.tonearmStylus} />
        </div>
        <div className={styles.tonearmCounter} />
      </div>
    </div>
  );
}

/* ─── LAST PLAYED CARD (display only) ────────────────────── */
function LastPlayedCard() {
  const [track, setTrack] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/lastfm");
        const json = await res.json();
        if (!cancelled) setTrack(json.track ?? null);
      } catch {
        if (!cancelled) setTrack(null);
      }
    }
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (track === undefined) return <div className={`${styles.lpCard} ${styles.lpSkeleton}`} />;

  const accent = track ? hashAccent(`${track.artist}|${track.name}`) : "var(--gold-dim)";
  const ago = track && !track.nowPlaying ? timeAgo(track.playedAt) : null;
  const song = track ? { ...track, title: track.name, accent, label: deriveLabel(accent) } : null;

  return (
    <div className={styles.lpCard}>
      <div className={styles.lpTape} />
      {song && (
        <AlbumArt song={song} width={200} height={220} className={styles.lpArt} />
      )}
      {!song && (
        <div className={styles.lpArtEmpty}>
          <span>—</span>
        </div>
      )}
      <div className={styles.lpBody}>
        <div className={styles.lpEyebrowRow}>
          <div className={styles.lpEyebrow} style={{ color: "var(--gold-dim)" }}>
            <Equalizer playing={!!track?.nowPlaying} color={accent} bars={4} />
            <span>
              ✦ {track?.nowPlaying ? "Now Playing" : "Last Played"}
              {ago ? ` · ${ago} ago` : ""}
            </span>
          </div>
        </div>
        <div className={styles.lpTitle}>{track?.name || "Nothing on right now"}</div>
        <div className={styles.lpMeta}>
          {track ? `${track.artist}${track.album ? ` · ${track.album}` : ""}` : "Not scrobbling"}
        </div>
        <div className={styles.lpNote} style={{ borderLeftColor: accent }}>
          {track
            ? (track.nowPlaying
                ? "— Ashzaeen is listening to this right now —"
                : "— Ashzaeen was listening earlier —")
            : "— Couldn't fetch what Ashzaeen was listening —"}
        </div>
      </div>
    </div>
  );
}

/* ─── MOST PLAYED CARD (display only) ────────────────────── */
function MostPlayedCard() {
  const [tracks, setTracks] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/lastfm/top?period=7day&limit=3");
        const json = await res.json();
        if (!cancelled) setTracks(Array.isArray(json.tracks) ? json.tracks : []);
      } catch {
        if (!cancelled) setTracks([]);
      }
    }
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (tracks === undefined) return <div className={`${styles.mpCard} ${styles.lpSkeleton}`} />;

  return (
    <div className={styles.mpCard}>
      <div className={styles.mpHead}>
        <span className={styles.mpEyebrow}>✦ Most Played</span>
        <span className={styles.mpWindow}>Last 7 days</span>
      </div>
      {tracks.length === 0 ? (
        <div className={styles.mpEmpty}>No scrobbles this week.</div>
      ) : (
        <div className={styles.mpList}>
          {tracks.map((t, i) => {
            const accent = hashAccent(`${t.artist}|${t.name}`);
            return (
              <div key={`${t.artist}-${t.name}-${i}`} className={styles.mpRow}>
                <div className={styles.mpRank} style={{ color: accent }}>{i + 1}</div>
                <div className={styles.mpText}>
                  <div className={styles.mpTitle}>{t.name}</div>
                  <div className={styles.mpArtist}>{t.artist}</div>
                </div>
                <div className={styles.mpCount}>
                  <div className={styles.mpCountNum}>{t.playcount}</div>
                  <div className={styles.mpCountLbl}>plays</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── CRATE LIST ─────────────────────────────────────────── */
function CrateList({ songs, activeIndex, onPick, onDragStart, onDragEnd, draggingId, playing, dense }) {
  return (
    <div className={`${styles.crateCard} ${dense ? styles.crateDense : ""}`}>
      <div className={styles.crateHead}>
        <span className={styles.crateEyebrow}>✦ The Crate</span>
        <span className={styles.crateCount}>{songs.length} songs</span>
      </div>

      <div className={styles.crateScroll}>
        {songs.map((s, i) => {
          const isActive = i === activeIndex;
          return (
            <div
              key={s.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", s.id);
                e.dataTransfer.effectAllowed = "move";
                onDragStart?.(s.id);
              }}
              onDragEnd={() => onDragEnd?.()}
              onClick={() => onPick(i)}
              className={styles.crateRow}
              style={{
                background: isActive ? "var(--cream)" : "transparent",
                borderColor: isActive ? "var(--gold)" : "transparent",
                opacity: draggingId === s.id ? 0.4 : 1,
              }}
            >
              <div
                className={styles.crateRowRank}
                style={{ color: isActive ? s.accent : "var(--ink-faint)" }}
              >
                {i + 1}
              </div>
              <MiniVinyl song={s} size={40} spinning={isActive && playing} />
              <div className={styles.crateRowText}>
                <div className={styles.crateRowTitle}>{s.title}</div>
                <div className={styles.crateRowMeta}>
                  {s.artist} · {s.year} · {s.genre}
                </div>
              </div>
              <div className={styles.crateDragHandle}>⋮⋮</div>
            </div>
          );
        })}
      </div>

      <div className={styles.crateFooter}>
        <span>browse</span>
        <span>↕ drag to deck</span>
      </div>
    </div>
  );
}

/* ─── SHELF (mobile crate, side-view) ────────────────────── */
function Shelf({ songs, activeIndex, setActiveIndex, playing }) {
  const song = songs[activeIndex];
  return (
    <div className={styles.shelf}>
      <div className={styles.shelfGrain} />
      <div className={styles.shelfLabel}>✦ {song.artist}</div>
      <div className={styles.shelfTrack}>
        <div className={styles.dividerTab}>♩</div>
        {songs.map((s, i) => {
          const isActive = i === activeIndex;
          return (
            <div
              key={s.id}
              onClick={() => setActiveIndex(i)}
              className={styles.shelfSlot}
              style={{
                transform: isActive ? "translateY(-18px)" : "translateY(0)",
                zIndex: isActive ? 3 : 1,
              }}
            >
              <div
                className={styles.shelfSlotBg}
                style={{
                  background: `linear-gradient(90deg, ${s.accent} 0%, ${s.label} 100%)`,
                  boxShadow: isActive
                    ? "0 6px 14px rgba(0,0,0,0.5), inset 0 0 14px rgba(0,0,0,0.25), 0 0 0 1.5px var(--gold)"
                    : "0 2px 4px rgba(0,0,0,0.4), inset 0 0 12px rgba(0,0,0,0.25)",
                }}
              >
                <div className={styles.slotCorner} />
                <div className={styles.slotLabel}>{s.artist}</div>
              </div>
              {isActive && (
                <div
                  className={styles.shelfMiniVinyl}
                  style={{
                    background: `radial-gradient(circle, ${s.accent} 0%, ${s.label} 18%, #15110c 22%, #0a0805 100%)`,
                    animation: playing ? "vinylSpin 3s linear infinite" : "none",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── DECK ───────────────────────────────────────────────── */
function Deck({ song, playing, speed, onTogglePlay, onSpeedChange, onDrop, vinylSize = 250, platterSize = 290 }) {
  const [dragOver, setDragOver] = useState(false);
  const hasAudio = !!song.ytId;

  return (
    <div
      className={styles.deck}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        setDragOver(false);
        if (id) onDrop(id);
      }}
      style={{
        boxShadow: dragOver
          ? "0 0 0 2px var(--gold), 0 12px 32px rgba(20,12,4,0.4)"
          : "0 12px 32px rgba(20,12,4,0.32)",
        borderColor: dragOver ? "var(--gold)" : "rgba(196,160,80,0.12)",
      }}
    >
      <div
        className={styles.deckGlow}
        style={{ background: `radial-gradient(ellipse at 50% 55%, ${song.accent}26 0%, transparent 55%)` }}
      />
      <div className={styles.deckInset} />

      <div className={styles.deckTop}>
        <div className={styles.deckLabel}>✦ Technics SL-1200 · Direct Drive</div>
        <div className={styles.speedBtns}>
          {[33, 45].map((s) => {
            const active = speed === s;
            return (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={styles.speedBtn}
                style={{
                  borderColor: `rgba(196,160,80,${active ? 0.6 : 0.15})`,
                  background: active ? "rgba(196,160,80,0.18)" : "transparent",
                  color: active ? "rgba(244,238,224,0.95)" : "rgba(244,238,224,0.4)",
                }}
              >
                {s === 33 ? "33⅓" : "45"}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.deckPlatterWrap}>
        <div className={styles.deckPlatter} style={{ width: platterSize, height: platterSize }}>
          <div className={styles.deckSlipmat} />
          <VinylDisc song={song} size={vinylSize} spinning={playing} speed={speed} suffix="-deck" />
          {dragOver && <div className={styles.deckDropRing} />}
        </div>
        <Tonearm playing={playing} />
      </div>

      <div className={styles.deckFooter}>
        <div className={styles.deckCue}>
          {playing ? "— let it spin —" : "drop the needle"}
        </div>
        <div className={styles.deckStatus}
          style={{ color: playing ? song.accent : "rgba(196,160,80,0.55)" }}
        >
          {playing && <span className={styles.deckStatusTri} aria-hidden="true" />}
          {playing ? "Now Playing" : "On Deck"}
        </div>
        <div className={styles.deckTitle}>{song.title}</div>
        <div className={styles.deckMeta}>
          {song.artist} · {song.year}
        </div>

        <div className={styles.deckControls}>
          <button
            onClick={onTogglePlay}
            disabled={!hasAudio}
            className={styles.playBtn}
            title={hasAudio ? undefined : "Add a YouTube ID in Notion to enable playback"}
            style={{
              background: playing ? "rgba(244,238,224,0.95)" : "var(--gold)",
              boxShadow: hasAudio ? `0 4px 14px ${song.accent}66` : "none",
              opacity: hasAudio ? 1 : 0.4,
              cursor: hasAudio ? "pointer" : "not-allowed",
            }}
          >
            {playing ? (
              <div className={styles.pauseIcon}><div /><div /></div>
            ) : (
              <div className={styles.playIcon} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── LINER NOTES ────────────────────────────────────────── */
// Notion rich-text → paragraphs (newline-aware, annotations preserved). A
// paragraph whose every text run is italic is treated as a quoted *lyric* line
// and set as verse; everything else is the writer's prose. This is what lets
// the liner read like a real inner-sleeve essay.
function splitNoteParagraphs(richText) {
  const paras = [[]];
  for (const rt of richText) {
    if (rt.type !== "text") { paras[paras.length - 1].push(rt); continue; }
    const content = rt.text?.content ?? rt.plain_text ?? "";
    content.split("\n").forEach((piece, idx) => {
      if (idx > 0) paras.push([]); // newline starts a new paragraph
      if (piece) {
        paras[paras.length - 1].push({
          ...rt, text: { ...rt.text, content: piece }, plain_text: piece,
        });
      }
    });
  }
  return paras.filter((p) => p.length > 0);
}

function isLyricPara(para) {
  const runs = para.filter((s) => s.type === "text");
  return runs.length > 0 && runs.every((s) => s.annotations?.italic);
}

// Render one inline run. In a lyric line the whole line is already italic (via
// the .lyricLine face), so we skip the per-run <em> wrap there to avoid
// double-styling; other annotations still apply.
function renderRun(rt, key, lyric) {
  if (rt.type !== "text") return null;
  const { bold, italic, underline, code } = rt.annotations || {};
  const content = rt.text?.content ?? rt.plain_text ?? "";
  const href = rt.text?.link?.url;
  let node = content;
  if (code) node = <code key={`c${key}`}>{node}</code>;
  if (italic && !lyric) node = <em key={`i${key}`}>{node}</em>;
  if (underline) node = <u key={`u${key}`}>{node}</u>;
  if (bold) node = <strong key={`b${key}`}>{node}</strong>;
  if (href) {
    return <a key={key} href={href} target="_blank" rel="noopener noreferrer">{node}</a>;
  }
  return <span key={key}>{node}</span>;
}

function NoteBody({ song }) {
  const rich = song.noteRich;
  let paras;
  if (Array.isArray(rich) && rich.length > 0) {
    paras = splitNoteParagraphs(rich).map((segs) => ({ segs, lyric: isLyricPara(segs) }));
  } else {
    // FALLBACK_SONGS notes are plain strings — split on newlines, all prose.
    paras = (song.note || "—").split("\n").filter((l) => l.trim())
      .map((line) => ({ text: line, lyric: false }));
  }
  if (paras.length === 0) paras = [{ text: "—", lyric: false }];

  // Drop cap goes on the first PROSE line. For songs that open with a quote,
  // that's the line right after the lyric block — not the lyric itself.
  const dropCapIdx = paras.findIndex((p) => !p.lyric);

  return (
    <>
      {paras.map((p, i) => {
        const cls = `${p.lyric ? styles.lyricLine : styles.proseLine}${i === dropCapIdx ? ` ${styles.dropCap}` : ""}`;
        return (
          <p key={i} className={cls}>
            {p.segs ? p.segs.map((s, j) => renderRun(s, `${i}-${j}`, p.lyric)) : p.text}
          </p>
        );
      })}
    </>
  );
}

function LinerNotes({ song }) {
  return (
    <div className={styles.liner}>
      <div className={styles.linerGrain} />
      <div className={styles.linerRingStain} />
      <div className={styles.linerCornerTL} />
      <div className={styles.linerCornerBR} />
      <div className={styles.linerEyebrow}>✦ Liner Notes</div>

      <div className={styles.linerHeader}>
        <AlbumArt song={song} width={92} height={92} className={styles.linerCover} />
        <div className={styles.linerHeaderText}>
          <div className={styles.linerTitle}>{song.title}</div>
          <div className={styles.linerArtist}>{song.artist} · {song.year}</div>
          {song.genre && (
            <div className={styles.linerGenre}
              style={{
                background: `${song.accent}1c`,
                color: song.accent,
                borderColor: `${song.accent}55`,
              }}
            >
              {song.genre}
            </div>
          )}
        </div>
      </div>

      <div className={styles.linerRule} />

      <div className={styles.linerNoteBlock}>
        <div className={styles.linerNote}>
          <NoteBody song={song} />
        </div>
      </div>

      <div className={styles.linerFooter}>
        <div><span className={styles.linerKey}>From</span> · {song.album || "—"}</div>
        <div><span className={styles.linerKey}>Side</span> A · Track 01</div>
      </div>
    </div>
  );
}

/* ─── YouTube IFrame API singleton (unchanged) ──────────── */
const _ytQueue = [];
let _ytReady = false;

if (typeof window !== "undefined") {
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    if (typeof prev === "function") prev();
    _ytReady = true;
    _ytQueue.splice(0).forEach((fn) => fn());
  };
}

function whenYT(fn) {
  if (typeof window === "undefined") return;
  if (_ytReady && window.YT?.Player) { fn(); return; }
  _ytQueue.push(fn);
  if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }
}

function useYouTubePlayer(videoId, snippetStart = 0, snippetEnd = null, onListen) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const pollRef = useRef(null);
  // True while a freshly-selected song is buffering silently (muted) in the
  // background. The PLAYING/PAUSED events it generates must NOT flip the UI or
  // start the listen timer — that only happens on a real, user-initiated play.
  const preloadingRef = useRef(false);
  // Wall-clock listen time: stamped when playback starts, reported (rounded to
  // seconds) when it pauses/ends. onListen read through a ref so the latest
  // song-aware callback is always used inside the YT event closure.
  const playStartRef = useRef(null);
  const onListenRef = useRef(onListen);
  onListenRef.current = onListen;
  const reportListen = () => {
    if (playStartRef.current == null) return;
    const secs = Math.round((performance.now() - playStartRef.current) / 1000);
    playStartRef.current = null;
    if (secs > 0) onListenRef.current?.(secs);
  };

  function stopPoll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  // Buffer a song ahead of play. A cued video only loads its thumbnail, so the
  // first playVideo() stalls on the network; instead we mute + load (which
  // autoplays muted, allowed without a gesture) to force real buffering. When
  // it reaches PLAYING we park it paused & unmuted (see onStateChange), leaving
  // it ready to resume from buffer the instant the user hits play.
  function preload(p, vid, startMs) {
    if (!p || !vid || typeof p.loadVideoById !== "function") return;
    preloadingRef.current = true;
    try {
      p.mute();
      p.loadVideoById({ videoId: vid, startSeconds: (startMs ?? 0) / 1000 });
    } catch {
      preloadingRef.current = false;
    }
  }

  useEffect(() => {
    whenYT(() => {
      if (playerRef.current || !containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        width: 2,
        height: 2,
        videoId: videoId || "",
        playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          // Start buffering the initial song as soon as the player exists.
          onReady: (e) => { if (videoId) preload(e.target, videoId, snippetStart); },
          onStateChange: (e) => {
            const S = window.YT?.PlayerState;
            if (!S) return;
            if (e.data === S.PLAYING) {
              if (preloadingRef.current) {
                // Silent buffer reached playback — park it paused & audible-ready
                // without touching the UI or the listen timer.
                preloadingRef.current = false;
                try { e.target.pauseVideo(); e.target.unMute(); } catch {}
                return;
              }
              setPlaying(true);
              playStartRef.current = performance.now();
            } else if (e.data === S.PAUSED || e.data === S.ENDED) {
              setPlaying(false);
              stopPoll();
              reportListen();
              if (e.data === S.ENDED) setProgress(0);
            }
          },
        },
      });
    });
    return stopPoll;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    stopPoll();
    const p = playerRef.current;
    if (!p) return;
    if (videoId) {
      preload(p, videoId, snippetStart);
    } else if (typeof p.stopVideo === "function") {
      p.stopVideo();
    }
  }, [videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing) { stopPoll(); return; }
    pollRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p || typeof p.getCurrentTime !== "function") return;
      const cur = p.getCurrentTime();
      const startSec = (snippetStart ?? 0) / 1000;
      const endSec = snippetEnd != null ? snippetEnd / 1000 : null;
      if (endSec != null && cur >= endSec) {
        p.pauseVideo();
        p.seekTo(startSec, true);
        setPlaying(false);
        setProgress(0);
        stopPoll();
        return;
      }
      const dur = endSec != null ? endSec - startSec : (p.getDuration?.() || 0);
      if (dur > 0) setProgress(Math.max(0, (cur - startSec) / dur));
    }, 250);
    return stopPoll;
  }, [playing, snippetStart, snippetEnd]);

  function toggle() {
    const p = playerRef.current;
    if (!p || !videoId) return;
    if (playing) {
      p.pauseVideo();
      return;
    }
    const startSec = (snippetStart ?? 0) / 1000;
    // Still mid silent-preload: the buffer is already rolling, so just unmute
    // it for instant sound and flip the UI ourselves (no new PLAYING event
    // fires since it's already playing).
    if (preloadingRef.current) {
      preloadingRef.current = false;
      try { p.unMute(); } catch {}
      setPlaying(true);
      playStartRef.current = performance.now();
      return;
    }
    // Parked & pre-buffered (or a cold player): unmute and resume — playback
    // starts from the buffer with no network stall.
    try { p.unMute(); } catch {}
    const cur = p.getCurrentTime?.() ?? 0;
    if (startSec > 0 && cur < startSec) p.seekTo(startSec, true);
    p.playVideo();
  }

  return { playing, progress, toggle, containerRef };
}

/* ─── DESKTOP ────────────────────────────────────────────── */
function MusicDesktop({ songs, activeIndex, setActiveIndex, loadSong, song, playing, speed, setSpeed, toggle, copy }) {
  const [draggingId, setDraggingId] = useState(null);
  const loadById = (id) => {
    const idx = songs.findIndex((s) => s.id === id);
    if (idx >= 0) loadSong(idx, "drag");
  };

  return (
    <div className={styles.desktopWrap}>
      <div className={styles.desktopBgGrain} />
      <div className={styles.desktopBgGlow}
        style={{ background: `radial-gradient(ellipse at 75% 35%, ${song.accent}10 0%, transparent 55%)` }}
      />
      <div className="section-fade" aria-hidden="true" />

      <ScrollReveal className={styles.desktopInner}>
        <div className={styles.sectionHead}>
          <div className={styles.eyebrow}>✦ {copy.eyebrow}</div>
          <h2 className={styles.sectionTitle}>{copy.title}</h2>
          <p className={styles.sectionSub}>
            {copy.intro}
          </p>
          <div className={styles.rule}
            style={{ background: `linear-gradient(90deg, ${song.accent}, transparent)` }} />
          {copy.instruction && <SectionGuide>{copy.instruction}</SectionGuide>}
        </div>

        <div className={styles.heroRow}>
          <LastPlayedCard />
          <MostPlayedCard />
        </div>

        <div className={styles.mainRow}>
          <CrateList
            songs={songs}
            activeIndex={activeIndex}
            onPick={(i) => loadSong(i, "click")}
            onDragStart={(id) => setDraggingId(id)}
            onDragEnd={() => setDraggingId(null)}
            draggingId={draggingId}
            playing={playing}
          />
          <Deck
            song={song}
            playing={playing}
            speed={speed}
            onTogglePlay={toggle}
            onSpeedChange={setSpeed}
            onDrop={loadById}
          />
          <LinerNotes song={song} />
        </div>

        <div className={styles.desktopFooter}>
          <span>drag a record · or click to load</span>
          <span>← / → cycle · space to play</span>
        </div>
      </ScrollReveal>
    </div>
  );
}

/* ─── MOBILE ─────────────────────────────────────────────── */
function MusicMobile({ songs, activeIndex, setActiveIndex, loadSong, song, playing, speed, setSpeed, toggle, copy }) {
  const linerRef = useRef(null);

  const loadById = (id) => {
    const idx = songs.findIndex((s) => s.id === id);
    if (idx >= 0) loadSong(idx, "drag");
  };

  // When a different song is tapped, glide the page down so the liner notes
  // slide gently into the bottom of the viewport — mirroring how the travel
  // section scrolls up to the postcard rail on pin tap.
  const handlePick = (i) => {
    loadSong(i, "click");
    if (i !== activeIndex) {
      setTimeout(() => {
        linerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    }
  };

  return (
    <div className={styles.mobileWrap}>
      <div className={styles.mobileBgGlow}
        style={{ background: `radial-gradient(ellipse at 50% 25%, ${song.accent}1f 0%, transparent 55%)` }}
      />
      <div className="section-fade" aria-hidden="true" />

      <div className={styles.mobileInner}>
        <div className={styles.mobileHead}>
          <div className={styles.eyebrow}>✦ {copy.eyebrow}</div>
          <h2 className={styles.mobileSectionTitle}>{copy.title}</h2>
          <p className={styles.mobileSubtitle}>{copy.introMobile}</p>
          <div className={styles.rule}
            style={{ background: `linear-gradient(90deg, ${song.accent}, transparent)` }} />
          {copy.instructionMobile && <SectionGuide>{copy.instructionMobile}</SectionGuide>}
        </div>

        <LastPlayedCard />
        <MostPlayedCard />

        <div className={styles.mobileTrio}>
          <div className={styles.mobileTrioShelf}>
            <Shelf
              songs={songs}
              activeIndex={activeIndex}
              setActiveIndex={handlePick}
              playing={playing}
            />
          </div>
          <div className={styles.mobileTrioDeck}>
            <Deck
              song={song}
              playing={playing}
              speed={speed}
              onTogglePlay={toggle}
              onSpeedChange={setSpeed}
              onDrop={loadById}
              vinylSize={160}
              platterSize={190}
            />
          </div>
          <div ref={linerRef} className={styles.mobileTrioLiner}>
            <LinerNotes song={song} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── ROOT ───────────────────────────────────────────────── */
export default function MusicSection({ songs: rawSongs, copy = FALLBACK_SECTION_COPY.music }) {
  const songs = (rawSongs?.length ? rawSongs : FALLBACK_SONGS).map(normalizeSong);
  const [activeIndex, setActiveIndex] = useState(0);
  const [speed, setSpeed] = useState(33);
  const song = songs[activeIndex];
  // Keep the current song reachable from the YT event closure for listen-time.
  const songRef = useRef(song);
  songRef.current = song;

  const { playing, toggle, containerRef } = useYouTubePlayer(
    song.ytId ?? null,
    song.snippetStart ?? 0,
    song.snippetEnd ?? null,
    (secs) => analytics.musicListenDuration(songRef.current, secs),
  );

  // Analytics-wrapped controls. `loadSong` records click-vs-drag at the call
  // site; play/pause and speed wrap the underlying setters.
  const loadSong = (index, method) => {
    if (songs[index]) analytics.musicSongLoaded(songs[index], method);
    setActiveIndex(index);
  };
  const handleToggle = () => {
    analytics.musicPlaybackToggled(songRef.current, playing ? "pause" : "play");
    toggle();
  };
  const handleSpeed = (s) => {
    analytics.musicSpeedChanged(s);
    setSpeed(s);
  };

  useEffect(() => {
    function onKey(e) {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === " ") {
        if (song.ytId) { e.preventDefault(); handleToggle(); }
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        setActiveIndex((i) => (i + 1) % songs.length);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        setActiveIndex((i) => (i - 1 + songs.length) % songs.length);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs.length, song.ytId, playing]);

  const shared = {
    songs, activeIndex, setActiveIndex, loadSong, song, playing,
    speed, setSpeed: handleSpeed, toggle: handleToggle, copy,
  };

  return (
    <section id="music">
      <div
        ref={containerRef}
        style={{ position: "fixed", bottom: -4, right: -4, width: 2, height: 2, pointerEvents: "none", zIndex: -1 }}
      />
      <div className="desktop-only">
        <MusicDesktop {...shared} />
      </div>
      <div className="mobile-only">
        <MusicMobile {...shared} />
      </div>
    </section>
  );
}
