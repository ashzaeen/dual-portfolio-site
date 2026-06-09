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
import Postcard from "./Postcard";
import styles from "./TravelMap.module.css";
import { analytics } from "@/lib/analytics";
import { useDwellDuration } from "@/lib/dwell";

const WORLD_TOPO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const US_TOPO_URL =
  "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
const BD_DIVISIONS_URL = "/data/bd-divisions.geojson";

const CARD_W = 190;
const PIN_H = 34; // 14px head + 20px shaft — tip must align with map coordinate

export default function TravelMap({ locations = [], locationStories = {}, onViewStory, forcePaused = false }) {
  const LOCATIONS = locations;
  const shellRef = useRef(null);
  const svgRef = useRef(null);
  const tipRef = useRef(null);
  const pfillRef = useRef(null);
  const overlayRef = useRef(null);

  const apiRef = useRef({}); // imperative methods exposed by main effect
  const stateRef = useRef({
    paused: false,
    hovered: false,
    forcePaused: false,
    activePin: null,
    region: "world",
  });

  const [region, setRegion] = useState("world");
  const [paused, setPaused] = useState(false);
  const [activePin, setActivePin] = useState(null);
  const [pinPos, setPinPos] = useState({ left: 0, top: 0, flipped: false, showPin: true });
  const [overlayShow, setOverlayShow] = useState(false);
  // Holds the location object behind the open postcard so postcard_closed can
  // name it after activePin clears.
  const activeLocRef = useRef(null);
  useDwellDuration(!!activePin, (d) => analytics.postcardClosed(activeLocRef.current, d));

  // Mirror state into stateRef so D3 callbacks can read latest
  useEffect(() => {
    stateRef.current.paused = paused;
  }, [paused]);
  useEffect(() => {
    stateRef.current.activePin = activePin;
  }, [activePin]);
  useEffect(() => {
    stateRef.current.region = region;
  }, [region]);

  useEffect(() => {
    stateRef.current.forcePaused = forcePaused;
    apiRef.current.setPaused?.(forcePaused);
  }, [forcePaused]);

  useEffect(() => {
    const shell = shellRef.current;
    const svgEl = svgRef.current;
    if (!shell || !svgEl) return;

    let W = shell.clientWidth;
    let H = shell.clientHeight;
    let cancelled = false;

    const svg = d3.select(svgEl).attr("width", W).attr("height", H);

    const proj = d3
      .geoNaturalEarth1()
      .center(VIEWS.world.center)
      .scale(VIEWS.world.scale)
      .translate([W / 2, H / 2]);
    const pathFn = d3.geoPath().projection(proj);

    const lSphere = svg.append("g");
    const lGrat = svg.append("g");
    const lLand = svg.append("g");
    const lBdFills = svg.append("g");
    const lBdBorders = svg.append("g");
    const lBdLabels = svg.append("g");
    const lStates = svg.append("g");
    const lBorders = svg.append("g");
    const lPins = svg.append("g");

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
    let progRaf = 0;
    let progStart = 0;
    let progDur = 0;
    let animTimer = null;

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

      // BD divisions: fills + borders + labels
      bdFillsSel = lBdFills
        .selectAll("path")
        .data(bdData.features)
        .join("path")
        .attr("class", "l-bd-div")
        .attr("d", pathFn)
        .attr("fill", (d) => BD_DIVISION_TONES[d.properties.shapeName] || "#dccfa0")
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
      // Pins are pure visual elements — hover and click are handled at
      // the svg level via closest-pin detection below, so adjacent pins
      // can't steal each other's catchment when their hit zones would
      // otherwise overlap.
      LOCATIONS.forEach((loc) => {
        const [px, py] = proj(loc.coords);
        const g = lPins
          .append("g")
          .attr("class", "svg-pin")
          .attr("data-id", loc.id)
          .attr("transform", `translate(${px},${py})`)
          .style("pointer-events", "none");
        g.append("circle").attr("class", "pin-pulse").attr("r", 7);
        g.append("circle").attr("class", "pin-ring").attr("r", 14);
        g.append("circle").attr("class", "pin-dot").attr("r", 5.5);
      });

      // Distance (in svg pixels) within which a pin captures hover/click.
      // Hover radius matches the visible pin-ring (r=14) so the tooltip
      // only triggers when the cursor is actually on the pin — no invisible
      // hover extension. Click is slightly larger so missed clicks on the
      // rim still register. Closest-pin still wins inside the radius, so
      // adjacent pins never steal each other's zone.
      const HOVER_RADIUS = 14;
      const CLICK_RADIUS = 18;

      function findClosestPin(event) {
        const [mx, my] = d3.pointer(event, svg.node());
        let chosen = null;
        let minDist = Infinity;
        for (const loc of LOCATIONS) {
          const p = proj(loc.coords);
          if (!p) continue;
          const d = Math.hypot(mx - p[0], my - p[1]);
          if (d < minDist) {
            minDist = d;
            chosen = { loc, dist: d };
          }
        }
        return chosen;
      }

      function setHotPin(id) {
        lPins
          .selectAll("g.svg-pin")
          .classed("hot", function () {
            return this.getAttribute("data-id") === id;
          });
      }
      function clearHotPin() {
        lPins.selectAll("g.svg-pin").classed("hot", false);
      }

      svg
        .on("mousemove", (event) => {
          const c = findClosestPin(event);
          if (c && c.dist < HOVER_RADIUS) {
            showTip(c.loc);
            setHotPin(c.loc.id);
            svg.style("cursor", c.dist < CLICK_RADIUS ? "pointer" : "default");
          } else {
            hideTip();
            clearHotPin();
            svg.style("cursor", "default");
          }
        })
        .on("mouseleave", () => {
          hideTip();
          clearHotPin();
          svg.style("cursor", "default");
        })
        .on("click", (event) => {
          const c = findClosestPin(event);
          if (c && c.dist < CLICK_RADIUS) {
            event.stopPropagation();
            const current = stateRef.current.activePin;
            if (current === c.loc.id) {
              setActivePin(null);
            } else {
              setActivePin(c.loc.id);
              activeLocRef.current = c.loc;
              analytics.postcardOpened(c.loc);
              triggerManualZoom(c.loc.region);
            }
          } else {
            setActivePin(null);
          }
        });
    }

    function applyLandStyle(r) {
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
      repositionOverlay();
    }

    function repositionOverlay() {
      const id = stateRef.current.activePin;
      if (!id || !overlayRef.current) return;
      const loc = LOCATIONS.find((l) => l.id === id);
      if (!loc) return;
      const [px, py] = proj(loc.coords);
      const Wn = shell.clientWidth;
      const Hn = shell.clientHeight;
      const cardEl = overlayRef.current.querySelector("[data-card]");
      const cardH =
        cardEl?.offsetHeight || (loc.ratio === "portrait" ? 320 : 280);

      let left = px - CARD_W / 2;
      if (left < 8) left = 8;
      if (left + CARD_W > Wn - 8) left = Wn - CARD_W - 8;

      // Pin tip (bottom of shaft) must land at py.
      // Non-flipped: overlay top = py - PIN_H, card below pin.
      // Flipped: card above, pin below; overlay top = py - cardH - PIN_H.
      let top, flipped = false, showPin = true;
      if (py + cardH <= Hn - 12) {
        top = py - PIN_H;
        if (top < 8) { top = 8; showPin = false; }
      } else {
        flipped = true;
        top = py - cardH - PIN_H;
        if (top < 8) { top = 8; showPin = false; }
      }

      setPinPos({ left, top, flipped, showPin });
    }

    // Laptop viewports (shell narrower than ~1400px) clip Panchagarh at
    // the top of the BD view. Large monitors fit comfortably at full
    // scale; phones use MobileTravelMap. A 2% shrink restores top margin
    // without disturbing world/us framing.
    function scaleFor(regionKey) {
      const base = VIEWS[regionKey].scale;
      if (regionKey === "bd" && W < 1400) return base * 0.94;
      return base;
    }

    function zoomTo(regionKey, onDone) {
      const view = VIEWS[regionKey];
      const c0 = proj.center().slice();
      const s0 = proj.scale();
      const c1 = view.center;
      const s1 = scaleFor(regionKey);
      // Use ratio to catch large-scale jumps in either direction (e.g. BD↔world).
      const ratio = Math.max(s0, s1) / Math.min(s0, s1);
      const ms = view?.zoomMs ?? (ratio > 15 ? 2200 : TRANS_MS);
      // Hide BD overlays immediately when leaving BD — labels drift across the
      // map during the long zoom-out if we wait until applyLandStyle at t=1.
      if (regionKey !== "bd") {
        if (bdFillsSel)   bdFillsSel.style("display", "none");
        if (bdBordersSel) bdBordersSel.style("display", "none");
        if (bdLabelsSel)  bdLabelsSel.style("display", "none");
      }
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

    // Close any open postcard (allow its 280ms exit animation) then start the zoom.
    function closeThenZoom(regionKey, onDone) {
      if (stateRef.current.activePin) {
        setActivePin(null);
        setTimeout(() => zoomTo(regionKey, onDone), 320);
      } else {
        zoomTo(regionKey, onDone);
      }
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
        closeThenZoom(next, () => {
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

    // Pin click: open postcard immediately, zoom in background.
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

    // Region button click: close any open postcard first, then zoom.
    function switchRegion(r) {
      analytics.regionSwitched(r);
      clearTimeout(cycleTimer);
      cancelAnimationFrame(progRaf);
      const fill = pfillRef.current;
      if (fill) fill.style.width = "0%";
      const idx = CYCLE_SEQ.lastIndexOf(r);
      if (idx >= 0) cycleIdx = idx;
      setRegion(r);
      closeThenZoom(r, () => {
        if (!stateRef.current.paused) scheduleNext();
      });
    }

    function showTip(loc) {
      const tip = tipRef.current;
      if (!tip) return;
      tip.textContent = `${loc.city}, ${loc.country}`;
      tip.classList.add(styles.visible);
      const onMove = (e) => moveTip(e);
      shell.addEventListener("mousemove", onMove);
      tip._cleanup = () => shell.removeEventListener("mousemove", onMove);
    }
    function moveTip(e) {
      const tip = tipRef.current;
      if (!tip) return;
      const rect = shell.getBoundingClientRect();
      let x = e.clientX - rect.left + 14;
      let y = e.clientY - rect.top - tip.offsetHeight - 10;
      if (x + tip.offsetWidth > rect.width - 8)
        x = e.clientX - rect.left - tip.offsetWidth - 14;
      if (y < 8) y = e.clientY - rect.top + 16;
      tip.style.left = x + "px";
      tip.style.top = y + "px";
    }
    function hideTip() {
      const tip = tipRef.current;
      if (!tip) return;
      tip.classList.remove(styles.visible);
      if (tip._cleanup) {
        tip._cleanup();
        tip._cleanup = null;
      }
    }

    // Hover-pause — tracked independently from forcePaused
    const onShellEnter = () => {
      stateRef.current.hovered = true;
      setPausedFlag(true);
    };
    const onShellLeave = () => {
      stateRef.current.hovered = false;
      if (!stateRef.current.forcePaused) setPausedFlag(false);
    };
    shell.addEventListener("mouseenter", onShellEnter);
    shell.addEventListener("mouseleave", onShellLeave);

    const onResize = () => {
      const nw = shell.clientWidth;
      const nh = shell.clientHeight;
      if (nw === 0 || nh === 0) return;
      W = nw;
      H = nh;
      svg.attr("width", W).attr("height", H);
      proj.translate([W / 2, H / 2]);
      redrawPaths();
    };
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(() => onResize());
    ro.observe(shell);

    // Expose imperatives for JSX handlers
    apiRef.current.manualZoom = switchRegion;
    apiRef.current.repositionOverlay = repositionOverlay;
    // Force-pause: when turning off, only resume if hover isn't also holding the pause
    apiRef.current.setPaused = (val) => {
      if (val) {
        setPausedFlag(true);
      } else if (!stateRef.current.hovered) {
        setPausedFlag(false);
      }
    };

    return () => {
      cancelled = true;
      clearTimeout(cycleTimer);
      cancelAnimationFrame(progRaf);
      if (animTimer) animTimer.stop();
      shell.removeEventListener("mouseenter", onShellEnter);
      shell.removeEventListener("mouseleave", onShellLeave);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      svg.selectAll("*").remove();
      apiRef.current = {};
    };
  }, []);

  // Sync activePin → DOM .active class + reposition + show animation
  useEffect(() => {
    if (typeof document === "undefined") return;
    svgRef.current
      ?.querySelectorAll("g[data-id]")
      .forEach((el) => el.classList.remove("active"));
    if (activePin) {
      const node = svgRef.current?.querySelector(
        `g[data-id="${activePin}"]`
      );
      if (node) node.classList.add("active");
      requestAnimationFrame(() => {
        apiRef.current.repositionOverlay?.();
        requestAnimationFrame(() => setOverlayShow(true));
      });
    } else {
      setOverlayShow(false);
    }
  }, [activePin]);

  const handleRegionClick = (r) => {
    apiRef.current.manualZoom?.(r);
  };

  const activeLoc = activePin ? LOCATIONS.find((l) => l.id === activePin) : null;
  const tilt = activeLoc
    ? ((activeLoc.id.charCodeAt(0) % 6) - 3) * 0.8
    : 0;

  return (
    <div className={styles.frame}>
      <span className={styles.cornerBL} />
      <span className={styles.cornerBR} />
      <div className={styles.shell} ref={shellRef}>
        <div className={styles.rsel}>
          <button
            type="button"
            className={`${styles.rbtn} ${region === "world" ? styles.on : ""}`}
            onClick={() => handleRegionClick("world")}
          >
            World
          </button>
          <button
            type="button"
            className={`${styles.rbtn} ${region === "us" ? styles.on : ""}`}
            onClick={() => handleRegionClick("us")}
          >
            United States
          </button>
          <button
            type="button"
            className={`${styles.rbtn} ${region === "bd" ? styles.on : ""}`}
            onClick={() => handleRegionClick("bd")}
          >
            Bangladesh
          </button>
        </div>

        <div className={styles.compass}>
          <div className={styles.compassN}>N</div>
          <div className={styles.compassStar}>✦</div>
        </div>

        <div className={styles.meta}>
          <div className={styles.metaRegion}>{VIEWS[region].label}</div>
          <div className={styles.metaCycle}>
            <div
              className={`${styles.cdot} ${paused ? styles.paused : ""}`}
            />
            <span>{paused ? "Paused" : "Auto-cycling"}</span>
          </div>
        </div>

        <div className={styles.tip} ref={tipRef} />
        <div className={styles.pbar}>
          <div className={styles.pfill} ref={pfillRef} />
        </div>

        <svg ref={svgRef} className={styles.svg} />

        <div
          ref={overlayRef}
          className={`${styles.pcOverlay} ${
            pinPos.flipped ? styles.flipped : ""
          } ${overlayShow ? styles.show : ""}`}
          style={{
            left: pinPos.left,
            top: pinPos.top,
            width: CARD_W,
          }}
        >
          {activeLoc && (
            <>
              {pinPos.showPin && (
                <div className={styles.pcPin}>
                  <div className={styles.pcPinHead} />
                  <div className={styles.pcPinShaft} />
                </div>
              )}
              <div data-card style={{ width: "100%" }}>
                <Postcard
                  loc={activeLoc}
                  storySlugs={locationStories[activeLoc.id] ?? []}
                  showClose
                  onClose={(e) => {
                    e?.stopPropagation?.();
                    setActivePin(null);
                  }}
                  rotation={tilt}
                  onViewStory={onViewStory}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
