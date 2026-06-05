"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { FALLBACK_TECHSTACK } from "@/data/techstack";
import { FALLBACK_SECTION_COPY } from "@/data/sections";
import SectionFrame from "./SectionFrame";
import { analytics } from "@/lib/analytics";

// Derives the five legacy lookup tables (rawData, catAngles, rightCats,
// leftCats, mobileAnglesRight, mobileAnglesLeft) from a flat
// {name, side, skills}[] array — same array shape fetchTechStack() returns
// from Notion (Categories + Skills DBs joined by relation).
//
// Angle math: each side's cats spread evenly across a fixed angular range
// (desktop: π/2 wide; mobile: 2π/2.5 wide). Right side centered at 0,
// left side centered at π. Index within Side determines position
// top→bottom. Adding/removing categories auto-rebalances.
function deriveLookups(stack) {
  const rightStack = stack.filter((c) => c.side === "right");
  const leftStack = stack.filter((c) => c.side === "left");

  const rawData = Object.fromEntries(stack.map((c) => [c.name, c.skills ?? []]));
  const rightCats = rightStack.map((c) => c.name);
  const leftCats = leftStack.map((c) => c.name);
  // List view order: left cats first (top row), then right cats. Grid's
  // `auto-fit` + `minmax(300px, 1fr)` handles row wrapping — when one side
  // outgrows what fits per row, the extras flow into the row below the
  // other side. e.g. 4 left + 3 right at 3-per-row → row 1: left 1-3,
  // row 2: right 1-3, row 3: left 4 (with empty slots).
  const categories = [...leftCats, ...rightCats];

  // Spread N items across `spread` radians, centered at `center`.
  // For N=1 → just [center]. For N=2 → [center - spread/2, center + spread/2].
  function spreadAngles(names, center, spread) {
    const N = names.length;
    if (N === 0) return {};
    if (N === 1) return { [names[0]]: center };
    const step = spread / (N - 1);
    const start = center - spread / 2;
    return Object.fromEntries(names.map((name, i) => [name, start + i * step]));
  }

  const desktopSpread = Math.PI / 2;
  const mobileSpread = (Math.PI * 2) / 2.5;

  const catAngles = {
    ...spreadAngles(rightCats, 0, desktopSpread),
    ...spreadAngles(leftCats, Math.PI, desktopSpread),
  };
  const mobileAnglesRight = spreadAngles(rightCats, 0, mobileSpread);
  const mobileAnglesLeft = spreadAngles(leftCats, Math.PI, mobileSpread);

  return { rawData, categories, rightCats, leftCats, catAngles, mobileAnglesRight, mobileAnglesLeft };
}

export default function TechStack({ techStack = FALLBACK_TECHSTACK, copy = FALLBACK_SECTION_COPY.techstack }) {
  // Derived once per prop — D3 useEffect captures these via closure. The
  // effect itself has [] deps so the viz only initializes on mount; if
  // `techStack` changes after mount (rare — it's a server-fetched prop)
  // the existing nodes/links won't be torn down. Acceptable for an ISR
  // page where data updates trigger a fresh server render anyway.
  const { rawData, categories, rightCats, leftCats, catAngles, mobileAnglesRight, mobileAnglesLeft } =
    useMemo(() => deriveLookups(techStack), [techStack]);

  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const stateRef = useRef({
    mode: "constellation",
    mobileArchSide: "right",
    isMobile: false,
    focusedNode: null,
    expandedCategories: new Set()
  });
  const apiRef = useRef(null);

  const [mode, setMode] = useState("constellation");
  const [hudOpen, setHudOpen] = useState(false);
  const [mobileFocused, setMobileFocused] = useState(null);
  const [mobileArchSide, setMobileArchSide] = useState("right");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [listHighlight, setListHighlight] = useState(null); // { id, parent } | null

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Desktop HUD focus → techstack_node_focused on open, _closed (with dwell)
  // when it shuts. The focused node lives in stateRef (set by the D3 click
  // just before setHudOpen(true)).
  const hudFocusRef = useRef(null);
  const hudOpenAtRef = useRef(0);
  useEffect(() => {
    if (hudOpen) {
      const node = stateRef.current.focusedNode;
      hudFocusRef.current = node?.id ?? null;
      hudOpenAtRef.current = performance.now();
      analytics.techstackNodeFocused(hudFocusRef.current, node?.group === 1 ? "category" : "skill");
    } else if (hudOpenAtRef.current) {
      analytics.techstackNodeClosed(hudFocusRef.current, Math.round(performance.now() - hudOpenAtRef.current));
      hudOpenAtRef.current = 0;
    }
  }, [hudOpen]);

  // Shared hover-dwell timer for the list view (one item hovered at a time).
  const tsHoverStartRef = useRef(0);
  const tsStartHover = () => { tsHoverStartRef.current = performance.now(); };
  const tsEndHover = (id, type) => {
    const d = Math.round(performance.now() - (tsHoverStartRef.current || 0));
    const ok = tsHoverStartRef.current && d >= 500;
    tsHoverStartRef.current = 0;
    if (ok) analytics.techstackNodeHovered(id, type, d);
  };

  const dustParticles = useMemo(() => mounted ? Array.from({ length: 28 }).map(() => ({
    size: Math.random() * 5 + 2,
    left: Math.random() * 100,
    bottom: Math.random() * 30,
    duration: 14 + Math.random() * 18,
    delay: Math.random() * 16,
    opacity: Math.random() * 0.5 + 0.15
  })) : [], [mounted]);

  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return;

    const container = containerRef.current;
    let allNodes = [{ id: 'ASHZAEEN', group: 0, radius: 45 }];
    let allLinks = [];

    let width = container.clientWidth;
    let height = container.clientHeight;
    stateRef.current.isMobile = width <= 768;

    categories.forEach(category => {
      allNodes.push({ id: category, group: 1, radius: 35, desktopArchA: catAngles[category], desktopArchR: 160 });
      allLinks.push({ source: 'ASHZAEEN', target: category, type: 'core' });
      let leaves = rawData[category];
      let angleSpread = Math.PI / 3.5;
      let step = leaves.length > 1 ? angleSpread / (leaves.length - 1) : 0;
      let startAngle = catAngles[category] - angleSpread / 2;
      leaves.forEach((skill, j) => {
        allNodes.push({ id: skill, group: 2, radius: 20, desktopArchA: startAngle + (j * step), desktopArchR: 280, parent: category });
        allLinks.push({ source: category, target: skill, type: 'leaf' });
      });
    });

    allNodes.forEach(n => {
      n.x = width / 2 + (Math.random() - 0.5) * 10;
      n.y = height / 2 + (Math.random() - 0.5) * 10;
    });

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg.append("defs").html(`
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    `);

    const archSlices = svg.append('g').attr('id', 'arch-slices').style('pointer-events', 'none').style('opacity', 0).style('transition', 'transform 0.6s ease, opacity 0.6s ease');
    const linkLayer = svg.append('g').attr('class', 'links');
    const nodeLayer = svg.append('g').attr('class', 'nodes');
    const hudLayer = svg.append('g').attr('id', 'hud-layer').style('pointer-events', 'none').style('opacity', 0).style('transition', 'opacity 0.5s ease');

    hudLayer.append('circle').attr('class', 'hud-ring').attr('r', 100);
    hudLayer.append('circle').attr('class', 'hud-ring-reverse').attr('r', 130);
    const hudTextTop = hudLayer.append('text').attr('y', -240).attr('text-anchor', 'middle').attr('fill', '#c4a050').style('font-size', '12px').style('letter-spacing', '2px').style('font-family', "var(--font-mono)");
    const hudTextBottom = hudLayer.append('text').attr('y', 240).attr('text-anchor', 'middle').attr('fill', 'rgba(237,232,223,0.6)').style('font-size', '10px').style('font-family', "var(--font-mono)");

    let simulation = d3.forceSimulation();

    function getIsMobile() { return stateRef.current.isMobile; }
    function getMode() { return stateRef.current.mode; }

    function updateGraph() {
      const isMobile = getIsMobile();
      const curMode = getMode();
      const { mobileArchSide, expandedCategories } = stateRef.current;
      let activeNodes, activeLinks;

      if (isMobile && curMode === 'constellation') {
        activeNodes = allNodes.filter(n => n.group === 0 || n.group === 1 || (n.group === 2 && expandedCategories.has(n.parent)));
        activeLinks = allLinks.filter(l => activeNodes.find(n => n.id === (l.source.id || l.source)) && activeNodes.find(n => n.id === (l.target.id || l.target)));
      } else if (isMobile && curMode === 'architecture') {
        let visibleCats = mobileArchSide === 'right' ? rightCats : leftCats;
        activeNodes = allNodes.filter(n => n.group === 0 || visibleCats.includes(n.id) || visibleCats.includes(n.parent));
        activeLinks = allLinks.filter(l => activeNodes.find(n => n.id === (l.source.id || l.source)) && activeNodes.find(n => n.id === (l.target.id || l.target)));
      } else {
        activeNodes = allNodes;
        activeLinks = allLinks;
      }

      simulation.nodes(activeNodes);

      linkLayer.selectAll('.link-stream')
        .data(activeLinks, d => (d.source.id || d.source) + "-" + (d.target.id || d.target))
        .join(
          enter => enter.append('line').attr('class', 'link-stream').attr('stroke', 'rgba(196,160,80,0.25)').attr('stroke-width', d => d.type === 'core' ? 2.5 : 1.5),
          update => update,
          exit => exit.remove()
        );

      nodeLayer.selectAll('.node')
        .data(activeNodes, d => d.id)
        .join(
          enter => {
            const g = enter.append('g').attr('class', 'node')
              .call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended))
              .on('click', handleNodeClick)
              .on('mouseover', handleNodeHover)
              .on('mouseout', handleNodeOut);

            g.append('circle').attr('r', 0).attr('fill', d => d.group === 0 ? '#1a1814' : '#0f0e0c').attr('stroke', '#c4a050').attr('stroke-width', d => d.group === 0 ? 2 : 1).attr('stroke-opacity', 0.8)
              .transition().duration(500).attr('r', d => d.radius);

            g.append('text').text(d => d.id).attr('y', 4).attr('text-anchor', 'middle').attr('fill', '#ede8df').style('font-size', d => d.group === 0 ? (getIsMobile() ? '12px' : '16px') : (d.group === 1 ? '12px' : '10px')).style('font-family', "var(--font-mono)").style('pointer-events', 'none').style('user-select', 'none')
              .style('opacity', 0).transition().duration(500).style('opacity', 1);
            return g;
          },
          update => update,
          exit => {
            exit.select('circle').transition().duration(300).attr('r', 0);
            exit.select('text').transition().duration(300).style('opacity', 0);
            exit.transition().duration(300).remove();
          }
        );

      if (curMode === 'constellation') applyConstellationForces(activeLinks);
      if (curMode === 'architecture') applyArchitectureForces(activeLinks);
    }

    function applyConstellationForces(activeLinks) {
      const isMobile = getIsMobile();
      allNodes[0].fx = width / 2;
      allNodes[0].fy = height / 2;

      simulation
        .force('x', d3.forceX(width / 2).strength(isMobile ? 0.05 : 0.04))
        .force('y', d3.forceY(height / 2).strength(isMobile ? 0.05 : 0.04))
        .force('link', d3.forceLink(activeLinks).id(d => d.id).distance(d => d.type === 'core' ? (isMobile ? 110 : 90) : (isMobile ? 75 : 50)))
        .force('charge', d3.forceManyBody().strength(isMobile ? -200 : -300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collide', d3.forceCollide().radius(d => d.radius + (isMobile ? 12 : 15)).iterations(3))
        .alpha(1).restart();

      archSlices.style('opacity', 0);

      setTimeout(() => {
        if (getMode() === 'constellation' && !stateRef.current.focusedNode) {
          allNodes[0].fx = null; allNodes[0].fy = null;
        }
      }, 500);
    }

    function applyArchitectureForces(activeLinks) {
      const isMobile = getIsMobile();
      const { mobileArchSide } = stateRef.current;

      if (isMobile) {
        const archR = 130;
        const leafR = 240;
        let archCenterX = mobileArchSide === 'right' ? 60 : width - 60;

        simulation.nodes().forEach(n => {
          if (n.group === 0) {
            n.tx = archCenterX; n.ty = height / 2;
          } else {
            let categoryName = n.group === 1 ? n.id : n.parent;
            let baseAngle = mobileArchSide === 'right' ? mobileAnglesRight[categoryName] : mobileAnglesLeft[categoryName];
            if (n.group === 1) {
              n.tx = archCenterX + archR * Math.cos(baseAngle);
              n.ty = height / 2 + archR * Math.sin(baseAngle);
            } else {
              let leaves = rawData[n.parent];
              let angleSpread = Math.PI / 2.5;
              let step = leaves.length > 1 ? angleSpread / (leaves.length - 1) : 0;
              let startAngle = baseAngle - angleSpread / 2;
              let lIdx = leaves.indexOf(n.id);
              let leafAngle = startAngle + (lIdx * step);
              n.tx = archCenterX + leafR * Math.cos(leafAngle);
              n.ty = height / 2 + leafR * Math.sin(leafAngle);
            }
          }
        });
      } else {
        allNodes.forEach(n => {
          if (n.group === 0) {
            n.tx = width / 2; n.ty = height / 2;
          } else {
            n.tx = width / 2 + n.desktopArchR * Math.cos(n.desktopArchA);
            n.ty = height / 2 + n.desktopArchR * Math.sin(n.desktopArchA);
          }
        });

        const arc = d3.arc().innerRadius(120).outerRadius(350).padAngle(0.04).cornerRadius(6);
        const slicesData = Object.values(catAngles).map(angle => ({ startAngle: angle - Math.PI/7, endAngle: angle + Math.PI/7 }));
        archSlices.selectAll('path').data(slicesData).join('path').attr('d', arc).attr('fill', 'rgba(196,160,80,0.02)').attr('stroke', 'rgba(196,160,80,0.1)').attr('stroke-width', 1);
        archSlices.attr('transform', `translate(${width/2},${height/2})`);
      }

      archSlices.style('opacity', isMobile ? 0 : 1);
      simulation.force('charge', null).force('center', null);
      simulation.force('link', d3.forceLink(activeLinks).id(d => d.id).distance(0).strength(0));
      simulation
        .force('x', d3.forceX(d => d.tx).strength(0.8))
        .force('y', d3.forceY(d => d.ty).strength(0.8))
        .force('collide', d3.forceCollide().radius(d => d.radius + 4).iterations(3))
        .alpha(1).restart();
    }

    function highlightBranch(targetId) {
      const target = allNodes.find(n => n.id === targetId);
      const connectedIds = new Set([targetId]);
      allLinks.forEach(l => {
        let sid = typeof l.source === 'object' ? l.source.id : l.source;
        let tid = typeof l.target === 'object' ? l.target.id : l.target;
        if (target.group === 1) {
          if (sid === targetId) connectedIds.add(tid);
          if (tid === targetId) connectedIds.add(sid);
        } else if (target.group === 2) {
          if (sid === targetId) connectedIds.add(tid);
          if (tid === targetId) connectedIds.add(sid);
          if (sid === target.parent || tid === target.parent) connectedIds.add(target.parent);
        }
      });
      nodeLayer.selectAll('circle').attr('stroke-opacity', n => connectedIds.has(n.id) ? 1 : 0.1).attr('fill', n => connectedIds.has(n.id) ? 'rgba(196,160,80,0.15)' : '#0f0e0c');
      nodeLayer.selectAll('text').style('opacity', n => connectedIds.has(n.id) ? 1 : 0.1);
      linkLayer.selectAll('.link-stream').attr('stroke-opacity', l => {
        let sid = typeof l.source === 'object' ? l.source.id : l.source;
        let tid = typeof l.target === 'object' ? l.target.id : l.target;
        return (connectedIds.has(sid) && connectedIds.has(tid)) ? 0.8 : 0.05;
      });
    }

    function resetHighlight() {
      nodeLayer.selectAll('circle').attr('stroke-opacity', 0.8).attr('fill', d => d.group === 0 ? '#1a1814' : '#0f0e0c');
      nodeLayer.selectAll('text').style('opacity', 1);
      linkLayer.selectAll('.link-stream').attr('stroke-opacity', 1);
    }

    function openDesktopHUD(d) {
      stateRef.current.focusedNode = d;
      simulation.stop();
      const backdrop = containerRef.current?.querySelector('[data-hud-backdrop]');
      if (backdrop) backdrop.style.opacity = '1';

      let hudNodes = [d.id];
      if (d.group === 1) {
        allLinks.forEach(l => {
          let sid = typeof l.source === 'object' ? l.source.id : l.source;
          let tid = typeof l.target === 'object' ? l.target.id : l.target;
          let targetNode = allNodes.find(n => n.id === tid);
          let sourceNode = allNodes.find(n => n.id === sid);
          if (sid === d.id && targetNode?.group === 2) hudNodes.push(tid);
          if (tid === d.id && sourceNode?.group === 2) hudNodes.push(sid);
        });
      }

      nodeLayer.selectAll('circle').attr('stroke-opacity', n => hudNodes.includes(n.id) ? 1 : 0.05).attr('fill', n => n.id === d.id ? '#1a1814' : (hudNodes.includes(n.id) ? '#0f0e0c' : '#050505'));
      nodeLayer.selectAll('text').style('opacity', n => hudNodes.includes(n.id) ? 1 : 0.05);
      linkLayer.selectAll('.link-stream').attr('stroke-opacity', 0.02);
      archSlices.style('opacity', 0.02);
      nodeLayer.selectAll('.node').filter(n => n.id === d.id).select('circle').attr('stroke-width', 2).attr('filter', 'url(#glow)');
      hudNodes.forEach(id => { nodeLayer.selectAll('.node').filter(n => n.id === id).raise(); });

      const children = hudNodes.filter(id => id !== d.id);
      const angleStep = (Math.PI * 2) / Math.max(1, children.length);
      allNodes.forEach(n => {
        if (n.id === d.id) { n.hx = width / 2; n.hy = height / 2; }
        else if (children.includes(n.id)) {
          let idx = children.indexOf(n.id);
          n.hx = width / 2 + 170 * Math.cos(idx * angleStep - Math.PI/2);
          n.hy = height / 2 + 170 * Math.sin(idx * angleStep - Math.PI/2);
        } else { n.hx = n.x; n.hy = n.y; }
      });

      nodeLayer.selectAll('.node').transition().duration(800).ease(d3.easeCubicOut).attr('transform', n => `translate(${n.hx}, ${n.hy})`);
      linkLayer.selectAll('.link-stream').transition().duration(800).ease(d3.easeCubicOut)
        .attr('x1', l => l.source.hx || l.source.x).attr('y1', l => l.source.hy || l.source.y)
        .attr('x2', l => l.target.hx || l.target.x).attr('y2', l => l.target.hy || l.target.y);
      allNodes.forEach(n => { n.x = n.hx; n.y = n.hy; n.vx = 0; n.vy = 0; });

      hudTextTop.text(`[ SYS_NODE: ${d.id.toUpperCase()} ]`);
      hudTextBottom.text(`STATUS: ACTIVE // DOMAIN: ${d.group === 1 ? 'CATEGORY' : 'TECHNOLOGY'}`);
      hudLayer.attr('transform', `translate(${width/2}, ${height/2})`).style('opacity', 1);
      setHudOpen(true);
    }

    function closeDesktopHUD() {
      stateRef.current.focusedNode = null;
      const backdrop = containerRef.current?.querySelector('[data-hud-backdrop]');
      if (backdrop) backdrop.style.opacity = '0';
      hudLayer.style('opacity', 0);
      nodeLayer.selectAll('circle').attr('filter', null);
      nodeLayer.selectAll('.node').interrupt();
      linkLayer.selectAll('.link-stream').interrupt();
      resetHighlight();
      setHudOpen(false);
      updateGraph();
    }

    function handleNodeClick(event, d) {
      event.stopPropagation();
      if (d.group === 0) return;
      if (getIsMobile()) {
        if (getMode() === 'constellation' && d.group === 1) {
          if (stateRef.current.expandedCategories.has(d.id)) {
            stateRef.current.expandedCategories.delete(d.id);
          } else {
            stateRef.current.expandedCategories.clear();
            stateRef.current.expandedCategories.add(d.id);
          }
          updateGraph();
        }
        highlightBranch(d.id);
        stateRef.current.focusedNode = d;
        setMobileFocused(d);
      } else {
        openDesktopHUD(d);
      }
    }

    function handleNodeHover(event, d) { if (getIsMobile() || stateRef.current.focusedNode) return; highlightBranch(d.id); }
    function handleNodeOut() { if (getIsMobile() && stateRef.current.focusedNode) return; if (!getIsMobile() && !stateRef.current.focusedNode) resetHighlight(); }

    function dragstarted(event) { if (stateRef.current.focusedNode || getMode() === 'architecture') return; if (!event.active) simulation.alphaTarget(0.3).restart(); event.subject.fx = event.subject.x; event.subject.fy = event.subject.y; }
    function dragged(event) { if (stateRef.current.focusedNode || getMode() === 'architecture') return; event.subject.fx = Math.max(event.subject.radius, Math.min(width - event.subject.radius, event.x)); event.subject.fy = Math.max(event.subject.radius, Math.min(height - event.subject.radius, event.y)); }
    function dragended(event) { if (stateRef.current.focusedNode || getMode() === 'architecture') return; if (!event.active) simulation.alphaTarget(0); event.subject.fx = null; event.subject.fy = null; }

    simulation.on('tick', () => {
      if (stateRef.current.focusedNode && !getIsMobile()) return;
      linkLayer.selectAll('.link-stream').attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      nodeLayer.selectAll('.node').attr('transform', d => {
        d.x = Math.max(d.radius, Math.min(width - d.radius, d.x));
        d.y = Math.max(d.radius, Math.min(height - d.radius, d.y));
        return `translate(${d.x},${d.y})`;
      });
    });

    svg.on('click', (e) => {
      if (e.target.tagName === 'svg') {
        if (!getIsMobile() && stateRef.current.focusedNode) closeDesktopHUD();
        if (getIsMobile()) {
          stateRef.current.focusedNode = null;
          setMobileFocused(null);
          resetHighlight();
          stateRef.current.expandedCategories.clear();
          updateGraph();
        }
      }
    });

    apiRef.current = {
      setMode(newMode) {
        if (stateRef.current.focusedNode) {
          getIsMobile() ? closeMobileHUD_internal() : closeDesktopHUD();
        }
        stateRef.current.mode = newMode;
        const backdrop = containerRef.current?.querySelector('[data-hud-backdrop]');
        if (backdrop) backdrop.style.opacity = '0';
        hudLayer.style('opacity', 0);
        stateRef.current.focusedNode = null;
        if (newMode === 'list') {
          simulation.stop();
        } else {
          updateGraph();
        }
      },
      toggleMobileArch() {
        stateRef.current.mobileArchSide = stateRef.current.mobileArchSide === 'left' ? 'right' : 'left';
        setMobileArchSide(stateRef.current.mobileArchSide);
        updateGraph();
      },
      closeDesktopHUD,
      getUpdateGraph: () => updateGraph
    };

    function closeMobileHUD_internal() {
      stateRef.current.focusedNode = null;
      setMobileFocused(null);
      setMobileDrawerOpen(false);
      resetHighlight();
      updateGraph();
    }

    const handleResize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      let newIsMobile = width <= 768;
      if (newIsMobile !== stateRef.current.isMobile) {
        stateRef.current.isMobile = newIsMobile;
        if (stateRef.current.focusedNode) {
          stateRef.current.isMobile ? closeMobileHUD_internal() : closeDesktopHUD();
        }
        updateGraph();
      } else {
        if (getMode() === 'constellation') applyConstellationForces(simulation.force('link').links());
        if (getMode() === 'architecture') applyArchitectureForces(simulation.force('link').links());
      }
    };

    window.addEventListener('resize', handleResize);
    updateGraph();

    return () => {
      simulation.stop();
      window.removeEventListener('resize', handleResize);
      svg.selectAll("*").remove();
      svg.on("click", null);
    };
  }, []);

  function handleModeBtn(newMode) {
    if (newMode !== mode) analytics.techstackModeChanged(mode, newMode);
    stateRef.current.mode = newMode;
    setMode(newMode);
    apiRef.current?.setMode(newMode);
  }

  function closeMobileDrawer() {
    setMobileDrawerOpen(false);
    setMobileFocused(null);
    stateRef.current.focusedNode = null;
    const svgEl = svgRef.current;
    if (svgEl) {
      const nodeLayer = d3.select(svgEl).select('.nodes');
      const linkLayer = d3.select(svgEl).select('.links');
      nodeLayer.selectAll('circle').attr('stroke-opacity', 0.8).attr('fill', d => d.group === 0 ? '#1a1814' : '#0f0e0c');
      nodeLayer.selectAll('text').style('opacity', 1);
      linkLayer.selectAll('.link-stream').attr('stroke-opacity', 1);
    }
    apiRef.current?.getUpdateGraph()?.();
  }

  function handleMobileFabClick() {
    if (!mobileFocused) return;
    analytics.techstackMobileDrawerOpened(mobileFocused?.id);
    setMobileFocused(prev => prev);
    setMobileDrawerOpen(true);
    const svgEl = svgRef.current;
    if (svgEl && mobileFocused) {
      const nodeLayer = d3.select(svgEl).select('.nodes');
      nodeLayer.selectAll('.node').filter(n => n.id === mobileFocused.id).raise()
        .transition().duration(600).ease(d3.easeCubicOut)
        .attr('transform', `translate(${containerRef.current.clientWidth / 2}, 100)`);
    }
    d3.select(svgRef.current)?.select('.links')?.selectAll('.link-stream')?.transition()?.duration(600);
    const sim = d3.select(svgRef.current)?.__sim;
    if (sim) sim.stop();
  }

  return (
    <div id="stack" className="px-6 md:px-12 py-20" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowX: 'hidden', backgroundColor: '#0f0e0c', fontFamily: "var(--font-mono)" }}>

      <div className="ts-header">
        <div className="ts-title-area">
          <SectionFrame
            eyebrow={`✦ ${copy.eyebrow}`}
            title={copy.title}
            description={copy.intro}
            className="!mb-0"
          />
        </div>
        <div className="ts-controls">
          {['constellation', 'architecture', 'list'].map(m => (
            <button key={m} className={`ts-ctrl-btn${mode === m ? ' active' : ''}`} onClick={() => handleModeBtn(m)}>
              {m === 'constellation' ? 'Graph' : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="ts-view-container" ref={containerRef}>
        {/* HUD backdrop */}
        <div data-hud-backdrop style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', background: 'rgba(15,14,12,0.45)', opacity: 0, transition: 'opacity 0.5s ease', pointerEvents: 'none', zIndex: 5, borderRadius: '8px' }} />

        {/* D3 SVG */}
        <svg ref={svgRef} style={{ width: '100%', height: '100%', cursor: 'crosshair', position: 'relative', zIndex: 6, display: mode === 'list' ? 'none' : 'block' }} />

        {/* List view */}
        <div id="ts-list-view" className={`ts-list-view${listHighlight ? ' has-highlight' : ''}`} style={{ display: mode === 'list' ? 'grid' : 'none' }}>
          {categories.map(category => (
            <div key={category} className="ts-list-category">
              <h4
                data-id={category}
                className={`ts-list-h4${listHighlight && (listHighlight.id === category || (!listHighlight.parent && listHighlight.id === category)) ? ' highlighted' : ''}`}
                onMouseEnter={() => { tsStartHover(); setListHighlight({ id: category, parent: null }); }}
                onMouseLeave={() => { tsEndHover(category, "category"); setListHighlight(null); }}
                onTouchStart={() => setListHighlight({ id: category, parent: null })}
                onTouchEnd={() => setListHighlight(null)}
              >{category}</h4>
              <div className="ts-pill-container">
                {rawData[category].map(skill => (
                  <div
                    key={skill}
                    className={`ts-pill${listHighlight && (listHighlight.id === skill || listHighlight.id === category) ? ' highlighted' : ''}`}
                    onMouseEnter={() => { tsStartHover(); setListHighlight({ id: skill, parent: category }); }}
                    onMouseLeave={() => { tsEndHover(skill, "skill"); setListHighlight(null); }}
                    onTouchStart={() => setListHighlight({ id: skill, parent: category })}
                    onTouchEnd={() => setListHighlight(null)}
                  >
                    <div className="ts-pill-logo">{skill.charAt(0)}</div>
                    <span>{skill}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop HUD close */}
        <button id="close-hud" onClick={() => { stateRef.current.focusedNode = null; apiRef.current?.closeDesktopHUD(); }} style={{ position: 'absolute', top: '20px', right: '20px', background: '#1a1814', border: '1px solid #c4a050', color: '#c4a050', padding: '8px 16px', fontFamily: "var(--font-mono)", fontSize: '12px', cursor: 'pointer', display: hudOpen ? 'block' : 'none', borderRadius: '4px', zIndex: 21, transition: 'background 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(196,160,80,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = '#1a1814'}
        >[X] Close HUD</button>

        {/* Mobile arch toggle — desktop fits all nodes in one view, so this is mobile-only */}
        <button id="mobile-arch-toggle"
          className="mobile-only"
          onClick={e => { e.stopPropagation(); analytics.techstackMobileArchToggled(); apiRef.current?.toggleMobileArch(); }}
          style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(26,24,20,0.85)', backdropFilter: 'blur(8px)', border: '1px solid #c4a050', color: '#c4a050', padding: '10px 20px', borderRadius: '30px', fontFamily: "var(--font-mono)", fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s ease', zIndex: 25, display: mode === 'architecture' ? 'block' : 'none' }}
        >{mobileArchSide === 'right' ? 'View Right ▸' : '◂ View Left'}</button>

        {/* Mobile FAB */}
        <button id="mobile-fab"
          onClick={e => { e.stopPropagation(); handleMobileFabClick(); }}
          className={`ts-mobile-fab${mobileFocused ? ' visible' : ''}`}
        >View Details</button>

        {/* Mobile drawer */}
        <div id="mobile-drawer" className={`ts-mobile-drawer${mobileDrawerOpen ? ' open' : ''}`}>
          <div style={{ color: '#c4a050', fontSize: '12px', letterSpacing: '2px', marginBottom: '8px' }}>[ SYS_NODE: {mobileFocused?.id?.toUpperCase() ?? 'SYS_NODE'} ]</div>
          <div style={{ color: 'rgba(237,232,223,0.5)', fontSize: '10px', marginBottom: '24px' }}>DOMAIN: {mobileFocused?.group === 1 ? 'CATEGORY' : 'TECHNOLOGY'}</div>
          <button onClick={closeMobileDrawer} style={{ background: 'transparent', border: '1px solid #c4a050', color: '#c4a050', padding: '8px 24px', borderRadius: '4px', fontFamily: "var(--font-mono)", fontSize: '12px', cursor: 'pointer' }}>Close Drawer</button>
        </div>

        {/* Dust particles */}
        {dustParticles.map((p, i) => (
          <div key={i} className="ts-dust-particle" style={{ width: p.size + 'px', height: p.size + 'px', left: p.left + '%', bottom: p.bottom + '%', animationDuration: p.duration + 's', animationDelay: p.delay + 's', opacity: p.opacity }} />
        ))}
      </div>

      <style jsx global>{`
        .ts-header {
          width: 100%; max-width: 1152px; display: flex; justify-content: space-between;
          align-items: flex-end; margin-bottom: 30px; z-index: 10; flex-wrap: wrap; gap: 12px;
        }
        .ts-title-area { flex: 1; }
        .ts-controls { display: flex; background: #1a1814; border: 1px solid rgba(196,160,80,0.15); border-radius: 30px; padding: 4px; }
        .ts-ctrl-btn {
          background: transparent; border: none; color: rgba(237,232,223,0.5); padding: 8px 16px;
          font-family: var(--font-mono); font-size: 12px; border-radius: 20px; cursor: pointer; transition: all 0.3s ease;
        }
        .ts-ctrl-btn.active { background: rgba(196,160,80,0.15); color: #c4a050; }

        .ts-view-container {
          width: 100%; max-width: 1152px; height: calc(100vh - 140px); min-height: 640px; max-height: 840px;
          background-color: #0b0a09; border: 1px solid rgba(196,160,80,0.15); border-radius: 8px; position: relative;
          background-image: linear-gradient(rgba(237,232,223,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(237,232,223,0.03) 1px, transparent 1px);
          background-size: 30px 30px; overflow: hidden;
        }

        .ts-list-view {
          width: 100%; height: 100%; padding: 40px; box-sizing: border-box; overflow-y: auto;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 40px; align-content: start;
        }
        .ts-list-category h4, .ts-list-h4 { color: #c4a050; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; border-bottom: 1px solid rgba(196,160,80,0.15); padding-bottom: 8px; margin: 0 0 16px 0; transition: all 0.3s ease; cursor: default; font-family: var(--font-mono); font-weight: 400; }
        .ts-pill-container { display: flex; flex-wrap: wrap; gap: 12px; }
        .ts-pill { background: #1a1814; border: 1px solid rgba(196,160,80,0.15); padding: 6px 14px 6px 6px; border-radius: 30px; display: inline-flex; align-items: center; gap: 10px; font-size: 11px; color: rgba(237,232,223,0.5); transition: all 0.3s ease; cursor: default; font-family: var(--font-mono); }
        .ts-pill-logo { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; background: #0f0e0c; border-radius: 50%; border: 1px solid rgba(196,160,80,0.15); color: #c4a050; transition: all 0.3s ease; font-family: var(--font-mono); }

        .ts-list-view.has-highlight .ts-pill { opacity: 0.6; }
        .ts-list-view.has-highlight .ts-list-h4 { opacity: 0.5; }
        .ts-list-view.has-highlight .ts-pill.highlighted { opacity: 1; border-color: #c4a050; color: #c4a050; transform: translateY(-1px); background: #1a1814; }
        .ts-list-view.has-highlight .ts-pill.highlighted .ts-pill-logo { background: rgba(196,160,80,0.15); color: #c4a050; }
        .ts-list-view.has-highlight .ts-list-h4.highlighted { opacity: 1; color: #c4a050; }

        .ts-mobile-fab {
          position: absolute; bottom: -60px; left: 50%; transform: translateX(-50%);
          background: #c4a050; color: #0f0e0c; padding: 12px 24px; border-radius: 30px;
          font-family: var(--font-mono); font-size: 12px; font-weight: 700; border: none;
          box-shadow: 0 4px 16px rgba(196,160,80,0.4); cursor: pointer; transition: bottom 0.3s cubic-bezier(0.16,1,0.3,1); z-index: 31;
        }
        .ts-mobile-fab.visible { bottom: 30px; }

        .ts-mobile-drawer {
          position: absolute; bottom: 0; left: 0; width: 100%; height: auto; padding: 30px; box-sizing: border-box;
          background: rgba(26,24,20,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          border-top: 1px solid rgba(196,160,80,0.15); transform: translateY(100%); transition: transform 0.4s cubic-bezier(0.16,1,0.3,1);
          z-index: 41; border-radius: 20px 20px 0 0; display: flex; flex-direction: column; align-items: center; text-align: center;
        }
        .ts-mobile-drawer.open { transform: translateY(0); }

        .ts-dust-particle {
          position: absolute; background: radial-gradient(circle, rgba(196,160,80,0.9) 0%, rgba(196,160,80,0) 70%);
          border-radius: 50%; pointer-events: none; animation: dustFloat linear infinite; z-index: 1;
        }
        @keyframes dustFloat {
          0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
          10%  { opacity: 1; }
          50%  { transform: translateY(-40%) translateX(8px) scale(0.8); }
          90%  { opacity: 0.6; }
          100% { transform: translateY(-100%) translateX(-6px) scale(0.4); opacity: 0; }
        }
        .node circle { transition: fill 0.4s ease, stroke-opacity 0.4s ease; }
        .node text { pointer-events: none; user-select: none; transition: opacity 0.4s ease; }
        .link-stream { stroke-dasharray: 4 8; animation: dataFlow 20s linear infinite; }
        @keyframes dataFlow { to { stroke-dashoffset: -1000; } }
        #arch-slices { pointer-events: none; opacity: 0; transition: transform 0.6s ease, opacity 0.6s ease; }
        #hud-layer { pointer-events: none; opacity: 0; transition: opacity 0.5s ease; }
        .hud-ring { fill: none; stroke: #c4a050; stroke-width: 1; stroke-dasharray: 4 6; animation: hudSpin 30s linear infinite; transform-origin: center; }
        .hud-ring-reverse { fill: none; stroke: rgba(237,232,223,0.2); stroke-width: 2; stroke-dasharray: 20 10; animation: hudSpinReverse 40s linear infinite; transform-origin: center; }
        @keyframes hudSpin { 100% { transform: rotate(360deg); } }
        @keyframes hudSpinReverse { 100% { transform: rotate(-360deg); } }

        @media (max-width: 768px) {
          .ts-header { flex-direction: column; align-items: flex-start; }
          .ts-view-container { height: calc(100vh - 175px); min-height: 420px; max-height: 620px; }
          .ts-list-view { grid-template-columns: 1fr; padding: 20px; }
          .ts-controls { width: 100%; justify-content: space-between; }
          .ts-ctrl-btn { padding: 8px 12px; font-size: 11px; }
        }
      `}</style>
    </div>
  );
}
