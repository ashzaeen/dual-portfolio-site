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
        g.append("circle").attr("class", "pin-pulse").attr("r", 6);
        g.append("circle").attr("class", "pin-ring").attr("r", 12);
        g.append("circle").attr("class", "pin-dot").attr("r", 4.5);

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
      // Allow page-vertical-scroll on world; take full touch ownership on
      // us/bd so the browser doesn't intercept the pinch-to-zoom gesture.
      shell.style.touchAction = (r === "us" || r === "bd") ? "none" : "pan-y";
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
    }

    function positionBdLabels() {
      if (!bdLabelsSel) return;
      bdLabelsSel
        .attr("x", (d) => pathFn.centroid(d)[0])
        .attr("y", (d) => pathFn.centroid(d)[1]);
    }

    function redrawPaths() {
      svg.selectAll("path").attr("d", pathFn);
      positionBdLabels();
      LOCATIONS.forEach((loc) => {
        const [px, py] = proj(loc.coords);
        lPins
          .select(`g[data-id="${loc.id}"]`)
          .attr("transform", `translate(${px},${py})`);
      });
    }

    function zoomTo(regionKey, onDone) {
      // Clear any user pinch-zoom so each region starts clean.
      uZoom = 1; uTx = 0; uTy = 0;
      mapGroupEl.removeAttribute("transform");
      const view = VIEWS[regionKey];
      const c0 = proj.center().slice();
      const s0 = proj.scale();
      const c1 = view.center;
      const s1 = view.scale * baseScaleRatio;
      if (animTimer) animTimer.stop();
      animTimer = d3.timer((elapsed) => {
        const t = Math.min(elapsed / TRANS_MS, 1);
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
      zoomTo(r, () => {
        if (!stateRef.current.paused) scheduleNext();
      });
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

    // ── Pinch-to-zoom (US and BD views only) ────────────────────────────
    // Applies a plain SVG group transform on top of the D3 projection so
    // projection state stays clean. Zoom is clamped [1×, 3×]; pivot is
    // kept at the pinch midpoint via the standard scale-around-point math.
    let uZoom = 1, uTx = 0, uTy = 0;
    let pinchData = null;

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

    function onPinchStart(e) {
      if (e.touches.length < 2) return;
      const r = stateRef.current.region;
      if (r !== "us" && r !== "bd") return;
      const rect = shell.getBoundingClientRect();
      const [mx, my] = pinchMid(e.touches, rect);
      pinchData = { dist: pinchDist(e.touches), zoom0: uZoom, tx0: uTx, ty0: uTy, mx, my };
    }

    function onPinchMove(e) {
      if (!pinchData || e.touches.length < 2) return;
      e.preventDefault();
      const newZoom = Math.max(1, Math.min(3, pinchData.zoom0 * pinchDist(e.touches) / pinchData.dist));
      // Keep pinch midpoint visually fixed: new_translate = mid - (mid - old_translate) * (newZoom/oldZoom)
      const r = newZoom / pinchData.zoom0;
      uZoom = newZoom;
      uTx = pinchData.mx - (pinchData.mx - pinchData.tx0) * r;
      uTy = pinchData.my - (pinchData.my - pinchData.ty0) * r;
      mapGroupEl.setAttribute("transform", `translate(${uTx},${uTy}) scale(${uZoom})`);
    }

    function onPinchEnd(e) {
      if (e.touches.length < 2) pinchData = null;
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
