import { err } from "./workflow";
import { extractorBase } from "./services";
export const MAX_UPLOAD = 4 * 1024 * 1024; // Vercel functions accept request bodies up to about 4.5 MB

// Sends an uploaded File to the extraction service (PDF, DOCX, image) and returns text, word boxes and previews.
export async function extractFile(file) {
  if (!file || typeof file === "string") throw err(400, "No file received");
  if (file.size > MAX_UPLOAD) throw err(413, "The file is over 4 MB");
  const fd = new FormData();
  fd.append("file", file, file.name);
  let r;
  try {
    r = await fetch(extractorBase() + "/extract", { method: "POST", body: fd, headers: process.env.EXTRACTOR_KEY ? { "x-extractor-key": process.env.EXTRACTOR_KEY } : {} });
  } catch {
    throw err(503, "The upload service is not running. Start the extractor (see README).");
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw err(r.status, d.detail || "Could not read the file");
  return d;
}
