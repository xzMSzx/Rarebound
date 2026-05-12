import "./_group.css";

export type AgsTier = {
  id: "AGS_6" | "AGS_7" | "AGS_8" | "AGS_9" | "AGS_9_5" | "AGS_10";
  numeric: string;
  label: string;
  className: string;
  serial: string;
  service: string;
  turnaround: string;
  date: string;
  subgrades: { centering: number; surface: number; edges: number; corners: number; print: number };
};

const Laurel = () => (
  <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
    <path d="M 8 30 Q 10 18 18 12 M 12 22 Q 14 18 18 17 M 14 28 Q 16 24 20 23 M 14 34 Q 16 30 20 29 M 14 40 Q 16 36 20 35 M 12 46 Q 14 42 18 41 M 8 30 Q 10 42 18 48" />
    <path d="M 52 30 Q 50 18 42 12 M 48 22 Q 46 18 42 17 M 46 28 Q 44 24 40 23 M 46 34 Q 44 30 40 29 M 46 40 Q 44 36 40 35 M 48 46 Q 46 42 42 41 M 52 30 Q 50 42 42 48" />
  </svg>
);

const Barcode = () => {
  const widths = [2, 1, 1, 2, 1, 3, 1, 1, 2, 1, 1, 2, 1, 3, 1, 1, 2, 1, 1, 2, 1, 1, 3, 1, 1, 2, 1, 1, 2, 1];
  return (
    <div className="slab-label__barcode">
      {widths.map((w, i) => <span key={i} style={{ width: `${w}px` }} />)}
    </div>
  );
};

export function SlabBase({ tier }: { tier: AgsTier }) {
  const subRows = [
    ["CENTERING", tier.subgrades.centering],
    ["SURFACE", tier.subgrades.surface],
    ["EDGES", tier.subgrades.edges],
    ["CORNERS", tier.subgrades.corners],
    ["PRINT QUALITY", tier.subgrades.print],
  ] as const;

  const longGrade = tier.numeric.length >= 3;

  return (
    <div className="slab-stage">
      <div className={`ags-slab ${tier.className}`}>
        {/* OUTER ACRYLIC SHELL — thick clear bevel frame */}
        <div className="slab-outer-shell">
          {/* INNER SHELL — holds the floating panels */}
          <div className="slab-inner-shell">

            {/* TOP LABEL — own acrylic frame */}
            <div className="slab-panel slab-label">
              <div className="slab-label__brand">
                <div className="slab-label__logo">AGS</div>
                <div className="slab-label__sub">ARCHIVE<br/>GRADING<br/>SERVICES</div>
              </div>
              <div className="slab-label__center">
                <div className="slab-label__name">UMBREON VMAX</div>
                <div className="slab-label__set">EVOLVING SKIES <em>#215</em></div>
                <div className="slab-label__rarity">SECRET RARE</div>
                <Barcode />
                <div className="slab-label__cert">{tier.serial}</div>
              </div>
              <div className="slab-label__grade">
                <div className={`slab-label__grade-num ${longGrade ? "slab-label__grade-num--small" : ""}`}>
                  {tier.numeric}
                </div>
                <div className="slab-label__grade-name">{tier.label.split(" ").map((w, i) => (
                  <span key={i} style={{ display: "block" }}>{w}</span>
                ))}</div>
              </div>
            </div>

            {/* GEM — between label and card chamber */}
            <div className="slab-gem"><span>AGS</span></div>

            {/* CARD CHAMBER — own thick acrylic frame around the card */}
            <div className="slab-panel slab-card-chamber">
              <div className="slab-card-chamber__inner">
                <img
                  className="slab-card"
                  src="https://images.pokemontcg.io/swsh7/215_hires.png"
                  alt="Umbreon VMAX"
                  onError={(e) => {
                    const t = e.currentTarget;
                    t.style.display = "none";
                    const next = t.nextElementSibling as HTMLElement | null;
                    if (next) next.style.display = "flex";
                  }}
                />
                <div className="slab-card slab-card--fallback" style={{ display: "none" }}>
                  UMBREON VMAX<br/>SECRET RARE<br/>EVOLVING SKIES
                </div>
              </div>
            </div>

            {/* SUBGRADES — own acrylic frame */}
            <div className="slab-panel slab-subgrades">
              <div className="slab-sub-col">
                <div className="slab-col-title">SUBGRADE BREAKDOWN</div>
                <div className="slab-sub">
                  {subRows.map(([key, val]) => (
                    <div className="slab-sub__row" key={key}>
                      <span className="slab-sub__key">{key}</span>
                      <span className="slab-sub__bar" style={{ ["--w" as any]: `${val * 10}%` }} />
                      <span className="slab-sub__val">{val.toFixed(1).replace(/\.0$/, "")}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="slab-medal">
                <div className="slab-medal__laurel"><Laurel /></div>
                <div className="slab-medal__num">{tier.numeric}</div>
                <div className="slab-medal__lbl">{tier.label.split(" ").map((w, i) => (
                  <span key={i} style={{ display: "block" }}>{w}</span>
                ))}</div>
              </div>
              <div className="slab-sub-col">
                <div className="slab-col-title">ARCHIVE DETAILS</div>
                <div className="slab-details">
                  <div className="slab-details__row">
                    <span className="slab-details__lbl">DATE GRADED</span>
                    <span className="slab-details__val">{tier.date}</span>
                  </div>
                  <div className="slab-details__row">
                    <span className="slab-details__lbl">SERVICE LEVEL</span>
                    <span className="slab-details__val">{tier.service}</span>
                  </div>
                  <div className="slab-details__row">
                    <span className="slab-details__lbl">TURNAROUND</span>
                    <span className="slab-details__val">{tier.turnaround}</span>
                  </div>
                  <div className="slab-details__row">
                    <span className="slab-details__lbl">SERIAL NUMBER</span>
                    <span className="slab-details__val">{tier.serial}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* small AGS pin at bottom of inner shell */}
            <div className="slab-pin"><span>AGS</span></div>

            {/* LIGHT/REFRACTION OVERLAYS — sit over everything inside the shell */}
            <div className="slab-light-overlay" />
            <div className="slab-edge-reflections">
              <span className="slab-refr slab-refr--tl" />
              <span className="slab-refr slab-refr--tr" />
              <span className="slab-refr slab-refr--bl" />
              <span className="slab-refr slab-refr--br" />
            </div>
            <div className="slab-specular" />

          </div>

          {/* OUTER SHELL CORNER BLOOMS — sit on the thick bezel */}
          <span className="slab-outer-corner slab-outer-corner--tl" />
          <span className="slab-outer-corner slab-outer-corner--tr" />
          <span className="slab-outer-corner slab-outer-corner--bl" />
          <span className="slab-outer-corner slab-outer-corner--br" />
        </div>
      </div>
    </div>
  );
}
