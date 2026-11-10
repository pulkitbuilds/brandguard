"""Document extraction service: PDF, DOCX and images (OCR) -> text + word positions + page previews.
Every word carries its character range in the extracted text (s, e), page (p), line (l) and a box (b)
in preview-image pixels, so findings in the text can be pinned back to the original file."""
import base64
import io
import os
from typing import Optional

import pymupdf
from docx import Document
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from PIL import Image

try:
    import pytesseract
    pytesseract.get_tesseract_version()
    OCR = True
except Exception:
    OCR = False

MAX_BYTES = int(float(os.environ.get("MAX_MB", "8")) * 1024 * 1024)
MAX_PAGES, ZOOM = 10, 1.3
app = FastAPI()


def jpeg(img, q=60):
    b = io.BytesIO(); img.convert("RGB").save(b, "JPEG", quality=q)
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()


class Builder:
    def __init__(self):
        self.text, self.words = "", []

    def word(self, w, page, line, box):
        if self.text and not self.text.endswith(("\n", " ")):
            self.text += " "
        s = len(self.text); self.text += w
        self.words.append({"s": s, "e": len(self.text), "p": page, "l": line, "b": [round(x) for x in box]})

    def newline(self, n=1):
        if self.text and not self.text.endswith("\n" * n):
            self.text += "\n" * n


def ocr_words(img, page, b):
    d = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    last = None
    for i, w in enumerate(d["text"]):
        if not w.strip() or float(d["conf"][i]) < 30:
            continue
        line = (d["block_num"][i], d["par_num"][i], d["line_num"][i])
        if last is not None and line != last:
            b.newline()
        last = line
        b.word(w, page, d["block_num"][i] * 1000 + d["line_num"][i], (d["left"][i], d["top"][i], d["left"][i] + d["width"][i], d["top"][i] + d["height"][i]))


def read_pdf(data):
    doc, b, pages, ocr_used = pymupdf.open(stream=data, filetype="pdf"), Builder(), [], False
    for n, page in enumerate(doc):
        if n >= MAX_PAGES:
            break
        pix = page.get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM))
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        words = page.get_text("words")
        if words:
            prev = None
            for x0, y0, x1, y1, w, blk, ln, _ in words:
                if prev is not None and (blk, ln) != prev:
                    b.newline()
                prev = (blk, ln)
                b.word(w, n + 1, blk * 1000 + ln, (x0 * ZOOM, y0 * ZOOM, x1 * ZOOM, y1 * ZOOM))
        elif OCR:  # scanned page: fall back to OCR on the rendered image
            ocr_words(img, n + 1, b); ocr_used = True
        b.newline(2)
        pages.append({"n": n + 1, "w": img.width, "h": img.height, "img": jpeg(img)})
    return {"kind": "pdf", "text": b.text.strip(), "words": b.words, "pages": pages, "paras": [], "ocr": ocr_used, "truncated": len(doc) > MAX_PAGES}


def read_docx(data):
    d = Document(io.BytesIO(data))
    parts = [p.text for p in d.paragraphs] + [c.text for t in d.tables for r in t.rows for c in r.cells]
    text, paras, n = "", [], 0
    for t in parts:
        if not t.strip():
            continue
        n += 1
        if text:
            text += "\n\n"
        paras.append({"s": len(text), "e": len(text) + len(t), "n": n})
        text += t
    return {"kind": "docx", "text": text, "words": [], "pages": [], "paras": paras, "ocr": False, "truncated": False}


def read_image(data):
    if not OCR:
        raise HTTPException(503, "OCR engine (Tesseract) is not installed on the upload service")
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img.thumbnail((1600, 1600))
    b = Builder(); ocr_words(img, 1, b)
    return {"kind": "image", "text": b.text.strip(), "words": b.words, "pages": [{"n": 1, "w": img.width, "h": img.height, "img": jpeg(img)}], "paras": [], "ocr": True, "truncated": False}


@app.get("/health")
def health():
    return {"ok": True, "ocr": OCR}


@app.post("/extract")
async def extract(file: UploadFile = File(...), x_extractor_key: Optional[str] = Header(default=None)):
    key = os.environ.get("EXTRACTOR_KEY")
    if key and x_extractor_key != key:
        raise HTTPException(403, "Forbidden")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File is too large")
    name = (file.filename or "").lower()
    try:
        if name.endswith(".pdf") or data[:4] == b"%PDF":
            out = read_pdf(data)
        elif name.endswith(".docx") or data[:2] == b"PK":
            out = read_docx(data)
        elif name.endswith((".png", ".jpg", ".jpeg", ".webp")) or data[:3] == b"\xff\xd8\xff" or data[:4] == b"\x89PNG":
            out = read_image(data)
        else:
            raise HTTPException(415, "Upload a PDF, DOCX, PNG or JPG file")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(422, f"Could not read this file ({type(e).__name__})")
    if not out["text"].strip():
        raise HTTPException(422, "No readable text found in this file")
    out["filename"] = file.filename
    return out
