"use client";

// Two folded-paper items pinned to the wall: a Frontier boarding pass to MSY
// and a Subway receipt from the Arlington store. Both render as inline JSX
// (no images) so they crisp-up at any zoom and stay tunable without re-export.

export function BoardingPass() {
  // Hand-tuned barcode widths — looks more "real" than a uniform repeat.
  const bars = [
    2, 1, 3, 1, 2, 1, 1, 3, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2, 1, 1,
    2, 3, 1, 2, 1, 3, 1, 1, 2, 1, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1,
    1, 3, 2, 1, 2, 1, 3, 1,
  ];
  return (
    <div
      style={{
        width: 268,
        fontFamily: "var(--font-mono)",
        borderRadius: 5,
        overflow: "hidden",
        boxShadow: "0 8px 28px rgba(0,0,0,.7)",
      }}
    >
      <div style={{ background: "linear-gradient(135deg,#005c3a,#007a4d 45%,#006040)", padding: "13px 16px 11px", color: "white" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 11 }}>
          <div>
            <div style={{ fontSize: 6.5, letterSpacing: ".3em", opacity: 0.6, textTransform: "uppercase", marginBottom: 2 }}>Boarding Pass</div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: ".08em" }}>FRONTIER</div>
            <div style={{ fontSize: 5.5, opacity: 0.4 }}>AIRLINES</div>
          </div>
          <div style={{ textAlign: "right", opacity: 0.7 }}>
            <div style={{ fontSize: 18 }}>✈</div>
            <div style={{ fontSize: 5.5, letterSpacing: ".15em", opacity: 0.55, marginTop: 1 }}>F9 1847</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.03em", lineHeight: 1 }}>DFW</div>
            <div style={{ fontSize: 5.5, opacity: 0.55, marginTop: 2 }}>DALLAS</div>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.28)" }} />
            <div style={{ fontSize: 8, opacity: 0.5 }}>✈</div>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.28)" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.03em", lineHeight: 1 }}>MSY</div>
            <div style={{ fontSize: 5.5, opacity: 0.55, marginTop: 2 }}>NEW ORLEANS</div>
          </div>
        </div>
        <div
          style={{
            height: 1,
            background: "rgba(255,255,255,.14)",
            margin: "0 -16px 10px",
            backgroundImage: "repeating-linear-gradient(90deg,rgba(255,255,255,.2) 0 5px,transparent 5px 10px)",
          }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 8 }}>
          <div>
            <div style={{ fontSize: 5, letterSpacing: ".2em", opacity: 0.48, textTransform: "uppercase", marginBottom: 2 }}>Passenger</div>
            <div style={{ fontSize: 7, fontWeight: 600 }}>FATMI KHAN / A</div>
          </div>
          <div>
            <div style={{ fontSize: 5, letterSpacing: ".2em", opacity: 0.48, textTransform: "uppercase", marginBottom: 2 }}>Seat</div>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1 }}>22B</div>
          </div>
          <div>
            <div style={{ fontSize: 5, letterSpacing: ".2em", opacity: 0.48, textTransform: "uppercase", marginBottom: 2 }}>Date</div>
            <div style={{ fontSize: 6.5, fontWeight: 600 }}>APR 23, 2026</div>
          </div>
        </div>
      </div>
      <div style={{ height: 1, backgroundImage: "repeating-linear-gradient(90deg,rgba(180,180,180,.35) 0 6px,transparent 6px 12px)" }} />
      <div style={{ background: "#f5f3ef", padding: "8px 16px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
        <div style={{ display: "flex", gap: "1px", alignItems: "flex-end", height: 34 }}>
          {bars.map((w, i) => (
            <div
              key={i}
              style={{
                width: w,
                background: "#1a1a18",
                flexShrink: 0,
                height: i % 5 === 0 ? "100%" : i % 3 === 0 ? "75%" : "58%",
                borderRadius: "0.5px 0.5px 0 0",
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: 6, letterSpacing: ".22em", color: "#666" }}>F9 1847 · DFW→MSY · 22B</div>
      </div>
    </div>
  );
}

export function SubwayReceipt() {
  return (
    <div style={{ width: 128, fontFamily: "var(--font-mono)", position: "relative" }}>
      <svg width="128" height="12" style={{ display: "block" }}>
        <path
          d="M0,12 L0,6 L6,0 L12,7 L18,0 L24,7 L30,1 L36,7 L42,0 L48,7 L54,1 L60,7 L66,0 L72,6 L78,1 L84,7 L90,0 L96,7 L102,1 L108,6 L114,0 L120,6 L128,5 L128,12 Z"
          fill="#fefefe"
        />
      </svg>
      <div
        style={{
          background: "#fefefe",
          padding: "5px 9px 12px",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 4px 16px rgba(0,0,0,.55)",
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 5,
            right: 3,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "radial-gradient(circle,rgba(130,75,25,.2) 0%,transparent 70%)",
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a7a1a" }}>SUBWAY®</div>
          <div style={{ fontSize: 5, color: "#777", lineHeight: 1.7, marginTop: 2 }}>
            1234 University Dr
            <br />
            Arlington, TX 76013
          </div>
        </div>
        <div style={{ borderTop: "1px dashed #ccc", margin: "3px -9px" }} />
        <div style={{ fontSize: 5.5, color: "#888", margin: "4px 0 2px" }}>04/23/2026 · #0847</div>
        <div style={{ borderTop: "1px dashed #ccc", margin: "3px -9px" }} />
        <div style={{ fontSize: 5.5, color: "#222", lineHeight: 1.85, margin: "4px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700 }}>1 FT TUNA</span>
            <span>$8.99</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700 }}>1 LRG TEA</span>
            <span>$2.49</span>
          </div>
        </div>
        <div style={{ borderTop: "1px dashed #ccc", margin: "3px -9px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 7, margin: "4px 0", color: "#111" }}>
          <span>TOTAL</span>
          <span>$12.43</span>
        </div>
        <div style={{ borderTop: "1px dashed #ccc", margin: "3px -9px 5px" }} />
        <div style={{ textAlign: "center", fontSize: 5, color: "#bbb" }}>THANK YOU · EAT FRESH ®</div>
      </div>
    </div>
  );
}
