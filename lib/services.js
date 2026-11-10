const trim = (u) => u.replace(/\/+$/, "");
// Vercel injects REVIEW_URL / EXTRACTOR_URL through the service bindings in vercel.json (private, not public URLs).
// Without them (plain `npm run dev`) fall back to the app's own origin, which next.config.js forwards to :8000.
export const reviewBase = (origin) => (process.env.REVIEW_URL ? trim(process.env.REVIEW_URL) : origin);
export const extractorBase = () => trim(process.env.EXTRACTOR_URL || "http://127.0.0.1:8001");
