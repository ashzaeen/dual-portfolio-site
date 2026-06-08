"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { feature, mesh } from "topojson-client";
import {
  VIEWS,
  CYCLE_SEQ,
  CYCLE_HOLD,
  CYCLE_BACK_TO_WORLD,
  TRANS_MS,
  REGION_IDS,
  BD_DIVISION_TONES,
  BD_DIVISION_DISPLAY,
} from "@/data/locations";
import styles from "./TravelMap.module.css";

const WORLD_TOPO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const US_TOPO_URL =
  "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
const BD_DIVISIONS_URL = "/data/bd-divisions.geojson";

export default function MobileTravelMap({ locations = [], activeId = null, onPinTap }) {
  const LOCATIONS = locations;
  const shellRef = useRef(null);
  const svgRef = useRef(null);
  const tipRef = useRef(null);
  const pfillRef = useRef(null);
  const apiRef = useRef({});
  const stateRef = useRef({
    paused: false,
    touched: false,
    forcePaused: false,
    activePin: activeId,
    region: "world",
  });
  const [region, setRegion] = useState("world");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    stateRef.current.activePin = activeId;
  }, [activeId]);
  useEffect(() => {
    stateRef.current.region = region;
  }, [region]);

  // Pause cycling whenever a pin is active
  useEffect(() => {
    stateRef.current.forcePaused = !!activeId;
    apiRef.current.setPaused?.(!!activeId);
  }, [activeId]);

  // Sync the active class onto the matching pin and toggle the tooltip
  useEffect(() => {
    if (typeof document === "undefined") return;
    svgRef.current
      ?.querySelectorAll("g[data-id]")
      .forEach((el) => el.classList.remove("active"));
    const tip = tipRef.current;
    if (activeId) {
      const node = svgRef.current?.querySelector(
        `g[data-id="${activeId}"]`
      );
      if (node) node.classList.add("active");
      const loc = LOCATIONS.find((l) => l.id === activeId);
      if (loc && tip) {
        tip.textContent = `${loc.city}, ${loc.country}`;
        tip.classList.add(styles.visible);
      }
    } else if (tip) {
      tip.classList.remove(styles.visible);
    }
  }, [activeId]);

  useEffect(() => {
    const shell = shellRef.current;
    const svgEl = svgRef.current;
    if (!shell || !svgEl) return;

    let W = shell.clientWidth;
    let H = shell.clientHeight;
    let cancelled = false;
    const svg = d3.select(svgEl).attr("width", W).attr("height", H);

    let baseScaleRatio = W / 1060;
    const proj = d3
      .geoNaturalEarth1()
      .center(VIEWS.world.center)
      .scale(VIEWS.world.scale * baseScaleRatio)
      .translate([W / 2, H / 2]);
    const pathFn = d3.geoPath().projection(proj);

    // Single wrapper group — pinch-to-zoom applies here as an SVG transform,
    // keeping the D3 projection untouched.
    const mapGroup = svg.append("g");
    const mapGroupEl = mapGroup.node();

    const lSphere = mapGroup.append("g");
    const lGrat = mapGroup.append("g");
    const lLand = mapGroup.append("g");
    const lBdFills = mapGroup.append("g");
    const lBdBorders = mapGroup.append("g");
    const lBdLabels = mapGroup.append("g");
    const lStates = mapGroup.append("g");
    const lBorders = mapGroup.append("g");
    const lPins = mapGroup.append("g");

    lSphere
      .append("path")
      .datum({ type: "Sphere" })
      .attr("class", "l-sphere")
      .attr("d", pathFn);
    const grat = d3.geoGraticule()();
    const gratMaj = d3.geoGraticule().step([30, 30])();
    lGrat.append("path").datum(grat).attr("class", "l-grat").attr("d", pathFn);
    lGrat
      .append("path")
      .datum(gratMaj)
      .attr("class", "l-grat-maj")
      .attr("d", pathFn);

    let landSel,
      bordersSel,
      statesSel,
      usOutlineSel,
      bdFillsSel,
      bdBordersSel,
      bdLabelsSel;
    let cycleIdx = 0;
    let cycleTimer = null;
    let animTimer = null;
    let progRaf = 0;
    let progStart = 0;
    let progDur = 0;

    Promise.all([
      fetch(WORLD_TOPO_URL).then((r) => r.json()),
      fetch(US_TOPO_URL).then((r) => r.json()),
      fetch(BD_DIVISIONS_URL).then((r) => r.json()),
    ]).then(([worldData, usData, bdData]) => {
      if (cancelled) return;
      const countries = feature(worldData, worldData.objects.countries);
      const borders = mesh(
        worldData,
        worldData.objects.countries,
        (a, b) => a !== b
      );

      landSel = lLand
        .selectAll("path")
        .data(countries.features)
        .join("path")
        .attr("class", "l-base")
        .attr("d", pathFn);

      bordersSel = lBorders
        .append("path")
        .datum(borders)
        .attr("class", "l-borders")
        .attr("d", pathFn);

      const stateMesh = mesh(
        usData,
        usData.objects.states,
        (a, b) => a !== b
      );
      const usOutlineMesh = mesh(
        usData,
        usData.objects.states,
        (a, b) => a === b
      );

      statesSel = lStates
        .append("path")
        .datum(stateMesh)
        .attr("class", "l-states")
        .attr("d", pathFn)
        .style("display", "none");

      usOutlineSel = lStates
        .append("path")
        .datum(usOutlineMesh)
        .attr("class", "l-us-outline")
        .attr("d", pathFn)
        .style("display", "none");

      bdFillsSel = lBdFills
        .selectAll("path")
        .data(bdData.features)
        .join("path")
        .attr("class", "l-bd-div")
        .attr("d", pathFn)
        .attr(
          "fill",
          (d) => BD_DIVISION_TONES[d.properties.shapeName] || "#dccfa0"
        )
        .style("display", "none");

      bdBordersSel = lBdBorders
        .selectAll("path")
        .data(bdData.features)
        .join("path")
        .attr("class", "l-bd-div-border")
        .attr("d", pathFn)
        .style("display", "none");

      bdLabelsSel = lBdLabels
        .selectAll("text")
        .data(bdData.features)
        .join("text")
        .attr("class", "l-bd-div-label")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .text((d) =>
          (
            BD_DIVISION_DISPLAY[d.properties.shapeName] ||
            d.properties.shapeName
          ).toUpperCase()
        )
        .style("display", "none");

      positionBdLabels();
      drawPins();
      applyLandStyle("world");
      startCycle();
    });

    function drawPins() {
      LOCATIONS.forEach((loc) => {
        const [px, py] = proj(loc.coords);
        const g = lPins
          .append("g")
          .attr("class", "svg-pin")
          .attr("data-id", loc.id)
          .attr("transform", `translate(${px},${py})`);
        g.append("circle").attr("class", "pin-pulse").attr("r", 9);
        g.append("circle").attr("class", "pin-ring").attr("r", 16);
        g.append("circle").attr("class", "pin-dot").attr("r", 6);

        g.on("click", (event) => {
          event.stopPropagation();
          if (stateRef.current.activePin === loc.id) {
            onPinTap?.(null);
          } else {
            onPinTap?.(loc.id);
            triggerManualZoom(loc.region);
          }
        });
      });

      svg.on("click", () => onPinTap?.(null));
    }

    function applyLandStyle(r) {
      updateTouchAction();
      if (!landSel) return;
      landSel.attr("class", (d) => {
        const id = +d.id;
        if (r === "world") return "l-base";
        if (r === "us") return id === REGION_IDS.US_ID ? "l-us" : "l-dim";
        if (r === "bd") {
          if (id === REGION_IDS.BD_ID) return "l-bd l-bd-empty";
          if (REGION_IDS.BD_NEIGHBORS.includes(id)) return "l-bd-nbr";
          return "l-dim";
        }
        return "l-base";
      });
      const showStates = r === "us";
      const showBd = r === "bd";
      if (statesSel) statesSel.style("display", showStates ? "" : "none");
      if (usOutlineSel) usOutlineSel.style("display", showStates ? "" : "none");
      if (bdFillsSel) bdFillsSel.style("display", showBd ? "" : "none");
      if (bdBordersSel) bdBordersSel.style("display", showBd ? "" : "none");
      if (bdLabelsSel) bdLabelsSel.style("display", showBd ? "" : "none");
      if (bordersSel) bordersSel.style("opacity", r === "world" ? 1 : 0.6);
      updatePinSizes(r);
    }

    function positionBdLabels() {
      if (!bdLabelsSel) return;
      bdLabelsSel
        .attr("x", (d) => pathFn.centroid(d)[0])
        .attr("y", (d) => pathFn.centroid(d)[1]);
    }

    // Sets every pin's SVG transform to its projected position with an
    // optional counter-scale so pins keep a consistent visual size when
    // the map group is zoomed (pinScale = 1/uZoom). At zoom=1 no scale
    // attribute is written, keeping the DOM clean.
    function updatePinPositions(pinScale) {
      LOCATIONS.forEach((loc) => {
        const [px, py] = proj(loc.coords);
        lPins
          .select(`g[data-id="${loc.id}"]`)
          .attr("transform",
            pinScale === 1
              ? `translate(${px},${py})`
              : `translate(${px},${py}) scale(${pinScale})`
          );
      });
    }

    function redrawPaths() {
      svg.selectAll("path").attr("d", pathFn);
      positionBdLabels();
      updatePinPositions(uZoom > 1 ? 1 / uZoom : 1);
    }

    function zoomTo(regionKey, onDone) {
      // Clear any user pinch-zoom so each region starts clean.
      uZoom = 1; uTx = 0; uTy = 0;
      mapGroupEl.removeAttribute("transform");
      updatePinPositions(1);
      const view = VIEWS[regionKey];
      const c0 = proj.center().slice();
      const s0 = proj.scale();
      const c1 = view.center;
      const s1 = view.scale * baseScaleRatio;
      const ratio = Math.max(s0, s1) / Math.min(s0, s1);
      const ms = view?.zoomMs ?? (ratio > 15 ? 2200 : TRANS_MS);
      if (animTimer) animTimer.stop();
      animTimer = d3.timer((elapsed) => {
        const t = Math.min(elapsed / ms, 1);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        proj
          .scale(s0 + (s1 - s0) * e)
          .center([c0[0] + (c1[0] - c0[0]) * e, c0[1] + (c1[1] - c0[1]) * e]);
        redrawPaths();
        if (t >= 1) {
          animTimer.stop();
          animTimer = null;
          applyLandStyle(regionKey);
          if (onDone) onDone();
        }
      });
    }

    function startCycle() {
      cycleIdx = 0;
      scheduleNext();
    }

    function scheduleNext() {
      if (stateRef.current.paused) return;
      const r = CYCLE_SEQ[cycleIdx];
      const isBackToWorld = r === "world" && cycleIdx !== 0;
      const hold = isBackToWorld ? CYCLE_BACK_TO_WORLD : CYCLE_HOLD[r];
      startProgress(hold);
      cycleTimer = setTimeout(() => {
        if (stateRef.current.paused) return;
        cycleIdx = (cycleIdx + 1) % CYCLE_SEQ.length;
        const next = CYCLE_SEQ[cycleIdx];
        setRegion(next);
        zoomTo(next, () => {
          if (!stateRef.current.paused) scheduleNext();
        });
      }, hold);
    }

    function startProgress(ms) {
      cancelAnimationFrame(progRaf);
      const fill = pfillRef.current;
      if (!fill) return;
      fill.style.width = "0%";
      progStart = performance.now();
      progDur = ms;
      const tick = (now) => {
        if (stateRef.current.paused) return;
        const pct = Math.min(((now - progStart) / progDur) * 100, 100);
        fill.style.width = pct + "%";
        if (pct < 100) progRaf = requestAnimationFrame(tick);
      };
      progRaf = requestAnimationFrame(tick);
    }

    function setPausedFlag(val) {
      stateRef.current.paused = val;
      setPaused(val);
      if (val) {
        clearTimeout(cycleTimer);
        cancelAnimationFrame(progRaf);
      } else {
        scheduleNext();
      }
    }

    function triggerManualZoom(r) {
      clearTimeout(cycleTimer);
      cancelAnimationFrame(progRaf);
      const fill = pfillRef.current;
      if (fill) fill.style.width = "0%";
      const idx = CYCLE_SEQ.lastIndexOf(r);
      if (idx >= 0) cycleIdx = idx;
      setRegion(r);
      // Skip zoomTo when already in the target region — keeps the user's
      // current pinch-zoom intact instead of snapping it back to 1×.
      if (stateRef.current.region !== r) {
        zoomTo(r, () => {
          if (!stateRef.current.paused) scheduleNext();
        });
      }
    }

    apiRef.current.manualZoom = triggerManualZoom;
    // Force-pause: when turning off, only resume if no finger is held down
    apiRef.current.setPaused = (val) => {
      if (val) {
        setPausedFlag(true);
      } else if (!stateRef.current.touched) {
        setPausedFlag(false);
      }
    };
    // Direct toggle for the cycle button (which lives in JSX render scope
    // and can't reach the useEffect-local setPausedFlag without this hook).
    apiRef.current.setPausedFlag = setPausedFlag;

    // Tap inside the map → pause; tap anywhere outside → resume.
    // Ignore taps on the cycle button so the button owns its own toggle
    // semantics (otherwise the shell's pause-on-tap always wins and the
    // button can pause but never resume).
    const onShellTap = (e) => {
      if (e.target?.closest?.(`.${styles.cycleBtn}`)) return;
      stateRef.current.touched = true;
      setPausedFlag(true);
    };
    const onDocTap = (e) => {
      if (shell.contains(e.target)) return;
      // Region selector taps own their own pause semantics (handle()
      // sets touched=true + paused=true). Without this guard, the doc
      // tap would immediately unpause what handle() just paused.
      if (e.target?.closest?.(`.${styles.mobileSelectorRow}`)) return;
      if (!stateRef.current.touched) return;
      stateRef.current.touched = false;
      if (!stateRef.current.forcePaused) setPausedFlag(false);
    };
    shell.addEventListener("click", onShellTap);
    document.addEventListener("click", onDocTap);

    const onResize = () => {
      const nw = shell.clientWidth;
      const nh = shell.clientHeight;
      if (nw === 0 || nh === 0) return;
      W = nw;
      H = nh;
      svg.attr("width", W).attr("height", H);
      baseScaleRatio = W / 1060;
      const view = VIEWS[stateRef.current.region || "world"];
      proj
        .scale(view.scale * baseScaleRatio)
        .center(view.center)
        .translate([W / 2, H / 2]);
      redrawPaths();
    };
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(() => onResize());
    ro.observe(shell);

    // ── Pinch-to-zoom + single-finger pan (US and BD views only) ────────
    // Group transform on mapGroup keeps D3 projection state clean.
    // Zoom clamped [1×, 3×]; pivot held at pinch midpoint.
    // After zooming, one finger pans the map freely.
    // Pins are counter-scaled so they stay visually consistent with zoom.
    let uZoom = 1, uTx = 0, uTy = 0;
    let pinchData = null; // 2-finger pinch state
    let panData = null;   // 1-finger pan state (only when zoomed)

    function pinchDist(t) {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
    function pinchMid(t, rect) {
      return [
        (t[0].clientX + t[1].clientX) / 2 - rect.left,
        (t[0].clientY + t[1].clientY) / 2 - rect.top,
      ];
    }

    // Applies both the group transform AND counter-scales pins.
    function applyMapTransform() {
      mapGroupEl.setAttribute("transform", `translate(${uTx},${uTy}) scale(${uZoom})`);
      updatePinPositions(1 / uZoom);
    }

    // touch-action: none captures all touch for pan; pan-y passes single-finger
    // vertical touches to the browser so the page can be scrolled when not zoomed.
    function updateTouchAction() {
      const r = stateRef.current.region;
      shell.style.touchAction = (r === "us" || r === "bd") && uZoom > 1 ? "none" : "pan-y";
    }

    // Resize pins so world-view stays at the original small size and US/BD
    // get the larger tap-friendly size (matches the drawPins initial attrs).
    function updatePinSizes(r) {
      const big = r === "us" || r === "bd";
      lPins.selectAll(".pin-dot").attr("r", big ? 6 : 4.5);
      lPins.selectAll(".pin-pulse").attr("r", big ? 9 : 6);
      lPins.selectAll(".pin-ring").attr("r", big ? 16 : 12);
    }

    function onPinchStart(e) {
      const r = stateRef.current.region;
      if (r !== "us" && r !== "bd") return;

      if (e.touches.length >= 2) {
        // 2-finger pinch zoom — cancel any ongoing pan first.
        panData = null;
        const rect = shell.getBoundingClientRect();
        const [mx, my] = pinchMid(e.touches, rect);
        pinchData = { dist: pinchDist(e.touches), zoom0: uZoom, tx0: uTx, ty0: uTy, mx, my };
      } else if (e.touches.length === 1 && uZoom > 1) {
        // 1-finger pan — only available when already zoomed in.
        pinchData = null;
        panData = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, tx0: uTx, ty0: uTy };
      }
    }

    // Clamp pan so the map always covers ≥ 80% of the viewport in each
    // dimension — prevents wandering into blank space. Derived from:
    // overlap([uTx, uTx+W*uZoom], [0,W]) ≥ 0.8*W  →  uTx ∈ [W*(0.8−uZoom), 0.2W].
    function clampTranslation() {
      uTx = Math.max(W * (0.8 - uZoom), Math.min(W * 0.2, uTx));
      uTy = Math.max(H * (0.8 - uZoom), Math.min(H * 0.2, uTy));
    }

    function onPinchMove(e) {
      const r = stateRef.current.region;
      if (r !== "us" && r !== "bd") return;

      if (pinchData && e.touches.length >= 2) {
        e.preventDefault();
        const newZoom = Math.max(1, Math.min(3, pinchData.zoom0 * pinchDist(e.touches) / pinchData.dist));
        const wasZoomed = uZoom > 1;
        const ratio = newZoom / pinchData.zoom0;
        uZoom = newZoom;
        uTx = pinchData.mx - (pinchData.mx - pinchData.tx0) * ratio;
        uTy = pinchData.my - (pinchData.my - pinchData.ty0) * ratio;
        clampTranslation();
        updateTouchAction();
        if (!wasZoomed && uZoom > 1) {
          stateRef.current.touched = true;
          setPausedFlag(true);
        }
        applyMapTransform();
      } else if (panData && e.touches.length === 1 && uZoom > 1) {
        e.preventDefault();
        uTx = panData.tx0 + (e.touches[0].clientX - panData.x0);
        uTy = panData.ty0 + (e.touches[0].clientY - panData.y0);
        clampTranslation();
        applyMapTransform();
      }
    }

    function onPinchEnd(e) {
      if (e.touches.length < 2) pinchData = null;
      if (e.touches.length === 0) panData = null;
      if (uZoom <= 1) { uZoom = 1; uTx = 0; uTy = 0; panData = null; }
      updateTouchAction();
    }

    shell.addEventListener("touchstart", onPinchStart, { passive: true });
    shell.addEventListener("touchmove", onPinchMove, { passive: false });
    shell.addEventListener("touchend", onPinchEnd, { passive: true });
    shell.addEventListener("touchcancel", onPinchEnd, { passive: true });

    return () => {
      cancelled = true;
      clearTimeout(cycleTimer);
      cancelAnimationFrame(progRaf);
      if (animTimer) animTimer.stop();
      shell.removeEventListener("click", onShellTap);
      document.removeEventListener("click", onDocTap);
      window.removeEventListener("resize", onResize);
      shell.removeEventListener("touchstart", onPinchStart);
      shell.removeEventListener("touchmove", onPinchMove);
      shell.removeEventListener("touchend", onPinchEnd);
      shell.removeEventListener("touchcancel", onPinchEnd);
      ro.disconnect();
      svg.selectAll("*").remove();
      apiRef.current = {};
    };
  }, []);

  const handle = (r) => {
    setRegion(r);
    // Manual region toggle = user has taken control. Pause auto-cycle and
    // mark `touched` so it stays paused until the cycle button toggles it
    // back on. Pause must come BEFORE manualZoom so the post-zoom callback
    // sees paused=true and skips scheduleNext.
    stateRef.current.touched = true;
    apiRef.current.setPausedFlag?.(true);
    apiRef.current.manualZoom?.(r);
  };

  return (
    <div>
      <div className={styles.mobileSelectorRow}>
        {[
          { k: "world", label: "World" },
          { k: "us", label: "US" },
          { k: "bd", label: "Bangladesh" },
        ].map((b) => (
          <button
            key={b.k}
            type="button"
            className={`${styles.rbtn} ${region === b.k ? styles.on : ""}`}
            onClick={() => handle(b.k)}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className={styles.frame}>
        <span className={styles.cornerBL} />
        <span className={styles.cornerBR} />
        <div className={styles.shell} ref={shellRef}>
          <div className={styles.compass}>
            <div className={styles.compassN}>N</div>
            <div className={styles.compassStar}>✦</div>
          </div>

          <div className={styles.meta}>
            <button
              type="button"
              className={styles.cycleBtn}
              onClick={(e) => {
                // Native bubbling to shell is already filtered by the
                // shell handler (it ignores button taps), but we still
                // stop synthetic propagation as belt-and-suspenders.
                e.stopPropagation();
                const next = !paused;
                stateRef.current.touched = next;
                apiRef.current.setPausedFlag?.(next);
              }}
              aria-label={paused ? "Resume auto-cycle" : "Pause auto-cycle"}
            >
              <span className={styles.cycleIcon} aria-hidden="true">
                {paused ? (
                  <svg viewBox="0 0 12 12" width="11" height="11">
                    <path d="M3 2 L10 6 L3 10 Z" fill="currentColor" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 12 12" width="11" height="11">
                    <rect x="3" y="2" width="2.4" height="8" fill="currentColor" />
                    <rect x="6.6" y="2" width="2.4" height="8" fill="currentColor" />
                  </svg>
                )}
              </span>
              <span>{paused ? "Paused" : "Auto-cycling"}</span>
            </button>
          </div>

          <div
            className={`${styles.tip} ${styles.tipMobile}`}
            ref={tipRef}
          />

          <div className={styles.pbar}>
            <div className={styles.pfill} ref={pfillRef} />
          </div>

          <svg ref={svgRef} className={styles.svg} />
        </div>
      </div>
    </div>
  );
}
