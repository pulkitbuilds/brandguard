"use client";
// Shows the uploaded pages/image with a box over every open finding.
export default function SourcePreview({ source, items }) {
  if (!source?.pages?.length) return null;
  return (
    <div style={{ maxHeight: 520, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8, padding: 8 }}>
      {source.pages.map((pg) => (
        <div key={pg.n} style={{ position: "relative", marginBottom: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pg.img} alt={`${source.kind === "image" ? "Uploaded image" : "Page " + pg.n}`} style={{ width: "100%", display: "block" }} />
          {items.flatMap((it, n) => it.boxes.filter((x) => x.p === pg.n).map((x, k) => (
            <div key={n + "-" + k} title={it.cat} style={{ position: "absolute", left: (x.b[0] / pg.w) * 100 + "%", top: (x.b[1] / pg.h) * 100 + "%", width: ((x.b[2] - x.b[0]) / pg.w) * 100 + "%", height: ((x.b[3] - x.b[1]) / pg.h) * 100 + "%", border: `2px solid var(--c-${it.cat})`, background: `color-mix(in srgb,var(--c-${it.cat}) 18%,transparent)`, borderRadius: 3 }} />
          )))}
          <div className="note" style={{ margin: 0 }}>{source.kind === "image" ? "Uploaded image" : `Page ${pg.n}`}</div>
        </div>
      ))}
    </div>
  );
}
