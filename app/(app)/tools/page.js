"use client";
import { useState } from "react";

const lum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export default function Tools() {
  const [fg, setFg] = useState("#777777");
  const [bg, setBg] = useState("#ffffff");
  const l1 = lum(fg), l2 = lum(bg), r = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return (
    <section>
      <h2>Contrast check (WCAG 2.1 AA)</h2>
      <div className="row"><input type="color" value={fg} onChange={(e) => setFg(e.target.value)} aria-label="Text colour" /><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} aria-label="Background colour" /><span className="sw" style={{ color: fg, background: bg }}>Aa</span></div>
      <p className="src">Ratio {r.toFixed(2)}:1. Normal text (4.5:1): {r >= 4.5 ? "pass" : "fail"}. Large text (3:1): {r >= 3 ? "pass" : "fail"}.</p>
      <p className="src">Missing alt text on images and very long sentences are checked automatically in the Review tab.</p>
    </section>
  );
}
