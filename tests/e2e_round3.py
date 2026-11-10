"""Round 3 checks. Needs: next dev :3000, FastAPI :8000, extractor :8001, INTERNAL_KEY=k3 on both Next and FastAPI."""
import json, urllib.request, uuid
B = "http://localhost:3000"
def call(path, method="GET", body=None, tok=None, raw=None, ctype="application/json", base=B, hdr=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    h = {"Content-Type": ctype, **({"Authorization": "Bearer " + tok} if tok else {}), **(hdr or {})}
    try:
        r = urllib.request.urlopen(urllib.request.Request(base + path, method=method, data=data, headers=h)); return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")
def upload(path, fname, tok):
    bd = uuid.uuid4().hex
    body = (f'--{bd}\r\nContent-Disposition: form-data; name="file"; filename="{fname}"\r\nContent-Type: application/octet-stream\r\n\r\n').encode() + open(path, "rb").read() + f"\r\n--{bd}--\r\n".encode()
    return call(path="/api/" + upload.ep, method="POST", raw=body, ctype=f"multipart/form-data; boundary={bd}", tok=tok)
upload.ep = "extract"
res = []
def ok(n, c): res.append(c); print(("PASS " if c else "FAIL ") + n)
def login(r): return call("/api/auth/demo", "POST", {"email": f"{r}@brandguard.demo", "password": "demo1234"})[1]["token"]
T = {r: login(r) for r in ["admin", "creator", "manager", "reviewer"]}

# ---- 1. document / image upload with located findings
for f, kind in [("tests/fixtures/t.pdf", "pdf"), ("tests/fixtures/t.docx", "docx"), ("tests/fixtures/t.png", "image")]:
    s, d = upload(f, f.split("/")[-1], T["creator"]); ok(f"extract {kind}", s == 200 and d["kind"] == kind and len(d["text"]) > 10)
ok("extract needs login", upload("tests/fixtures/t.pdf", "t.pdf", None)[0] == 401)
ok("unsupported type rejected", call("/api/extract", "POST", raw=b"--x\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.txt\"\r\n\r\nhello\r\n--x--\r\n", ctype="multipart/form-data; boundary=x", tok=T["creator"])[0] == 415)
s, doc = upload("tests/fixtures/t.pdf", "t.pdf", T["creator"])
s, d = call("/api/reviews", "POST", {"title": "t.pdf", "content": doc["text"], "findings": [], "dismissed": [], "source": doc, "notes": []}, tok=T["creator"]); rid = d["id"]
s, d = call(f"/api/reviews/{rid}", tok=T["creator"]); ok("source saved with review", d["source"]["kind"] == "pdf" and len(d["source"]["pages"]) == 2 and d["rulebook_version"] == 1)
ok("source not in list view", "source" not in call("/api/reviews", tok=T["creator"])[1]["reviews"][0])

# ---- 2. meaning-based findings are enforced by the server
s, d = call("/api/reviews", "POST", {"content": "Join us today. We promise every learner a placement.", "notes": []}, tok=T["creator"]); r2 = d["id"]
ok("semantic finding blocks submit", call(f"/api/reviews/{r2}/transition", "POST", {"action": "submit"}, tok=T["creator"])[0] == 409)
s, d = call("/api/py/review", "POST", {"text": "We promise every learner a placement.", "rules": call("/api/rulebook", tok=T["admin"])[1]["rules"], "facts": ""})
f = d["findings"][0]; ok("python flags paraphrase by meaning", f.get("semantic") is True and f["cat"] == "Claims")
call(f"/api/reviews/{r2}", "PATCH", {"dismissed": [{"key": f"Claims:{f['text'].lower()}", "cat": "Claims", "text": f["text"], "src": f["src"]}]}, tok=T["creator"])
ok("submit works after dismissing it", call(f"/api/reviews/{r2}/transition", "POST", {"action": "submit"}, tok=T["creator"])[1].get("stage") == 1)
s, d = call(f"/api/reviews/{r2}", tok=T["admin"]); ok("audit records rule version", any("rules v1" in a["action"] for a in d["audit"]))

# ---- explain (grounded; no LLM key in test) + internal key protection
s, e = call("/api/explain", "POST", {"text": "We promise every learner a placement.", "finding": {"i": 0, "len": 36, "text": "We promise every learner a placement.", "cat": "Claims"}}, tok=T["creator"])
ok("explain returns matched rulebook lines", s == 200 and e["llm"] is False and len(e["sources"]) >= 1)
ok("explain needs login", call("/api/explain", "POST", {"text": "x", "finding": {"i": 0, "len": 1, "text": "x", "cat": "Claims"}})[0] == 401)
ok("python explain blocked without internal key", call("/api/py/explain", "POST", {"text": "x", "finding": {"i": 0}, "rules": ""}, base="http://localhost:8000")[0] == 403)
ok("python propose blocked without internal key", call("/api/py/propose", "POST", {"text": "x"}, base="http://localhost:8000")[0] == 403)

# ---- 3. versioned rulebook
v0 = call("/api/rulebook", tok=T["admin"])[1]; ok("rulebook has version", v0["version"] == 1)
s, d = call("/api/rulebook", "PUT", {"rules": v0["rules"] + "\nTone | cheap | affordable | Voice", "facts": v0["facts"], "note": "add cheap"}, tok=T["admin"]); ok("save creates v2", d["version"] == 2)
ok("creator cannot save rulebook", call("/api/rulebook", "PUT", {"rules": "x"}, tok=T["creator"])[0] == 403)
s, d = call("/api/rulebook/versions", "POST", {"restore": 1}, tok=T["admin"]); ok("rollback creates v3", d["version"] == 3)
cur = call("/api/rulebook", tok=T["admin"])[1]; ok("v3 equals v1 text", cur["rules"] == v0["rules"] and cur["version"] == 3)
vs = call("/api/rulebook/versions", tok=T["creator"])[1]["versions"]; ok("history keeps all 3", [v["version"] for v in vs] == [3, 2, 1] and "Rolled back" in vs[0]["note"])
ok("creator cannot roll back", call("/api/rulebook/versions", "POST", {"restore": 1}, tok=T["creator"])[0] == 403)
s, d = call(f"/api/reviews/{r2}/transition", "POST", {"action": "approve"}, tok=T["manager"]); s, a = call(f"/api/reviews/{r2}", tok=T["admin"])
ok("review records the newer rule version", a["rulebook_version"] == 3 and any("rules v3" in x["action"] for x in a["audit"]))

# ---- 4. guideline -> proposed rules
upload.ep = "rulebook/propose"
s, p = upload("tests/fixtures/guide.pdf", "guide.pdf", T["admin"]); ok("propose returns rules", s == 200 and len(p["proposals"]) >= 4)
lines = [x["line"] for x in p["proposals"]]; print("   proposals:", lines)
ok("terminology rule found with page", any(x["cat"] == "Terminology" and "e\\-mail" in x["pattern"] and x["page"] == 1 for x in p["proposals"]))
ok("slang rule from page 2", any(x["cat"] == "Tone" and "gonna" in x["pattern"] and x["page"] == 2 for x in p["proposals"]))
ok("fact proposed", any(x["kind"] == "fact" and x["pattern"] == "clients: 500" for x in p["proposals"]))
ok("existing rules not re-proposed", not any("e\\-mail" in x["pattern"] and x["cat"] == "Terminology" and "utilize" in x["pattern"] for x in p["proposals"]))
ok("creator cannot import guideline", upload("tests/fixtures/guide.pdf", "g.pdf", T["creator"])[0] == 403)
ok("log import", call("/api/rulebook/import-log", "POST", {"filename": "guide.pdf", "proposed": len(p["proposals"]), "accepted": 4}, tok=T["admin"])[0] == 200)
s, i = call("/api/insights", tok=T["manager"]); ok("insights show acceptance rate", i["imports"]["count"] == 1 and 0 < i["imports"]["rate"] < 1)
print(f"\n{sum(res)}/{len(res)} passed")
