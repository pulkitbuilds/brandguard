import json, urllib.request
B="http://localhost:3000"
def call(path, method="GET", body=None, tok=None):
    req=urllib.request.Request(B+path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type":"application/json", **({"Authorization":"Bearer "+tok} if tok else {})})
    try:
        r=urllib.request.urlopen(req); return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")
def login(r): s,d=call("/api/auth/demo","POST",{"email":f"{r}@brandguard.demo","password":"demo1234"}); assert s==200,(s,d); return d["token"]
ok=lambda name,cond: print(("PASS " if cond else "FAIL ")+name)
T={r:login(r) for r in ["admin","creator","manager","reviewer"]}
ok("bad password rejected", call("/api/auth/demo","POST",{"email":"admin@brandguard.demo","password":"x"})[0]==401)
ok("no token -> 401", call("/api/me")[0]==401)
ok("me returns role", call("/api/me",tok=T["manager"])[1]["user"]["role"]=="manager")
s,d=call("/api/reviews",tok=T["creator"]); ok("creator sees own seeded reviews (4)", len(d["reviews"])==4)
# role enforcement
ok("creator blocked from insights", call("/api/insights",tok=T["creator"])[0]==403)
ok("creator blocked from team", call("/api/team",tok=T["creator"])[0]==403)
ok("creator cannot save rulebook", call("/api/rulebook","PUT",{"rules":"x","facts":""},tok=T["creator"])[0]==403)
ok("manager insights ok", call("/api/insights",tok=T["manager"])[0]==200)
# full workflow
text="We’re gonna win. Join 100 clients today."
s,d=call("/api/reviews","POST",{"content":text,"findings":[],"dismissed":[],"notes":[]},tok=T["creator"]); rid=d["id"]; ok("create review",s==200)
ok("submit blocked by open issues", call(f"/api/reviews/{rid}/transition","POST",{"action":"submit"},tok=T["creator"])[0]==409)
s,d=call(f"/api/reviews/{rid}","PATCH",{"content":"We are going to win. Join 500 clients today.","notes":["Accepted fixes"]},tok=T["creator"]); ok("fix saved",s==200)
ok("reviewer cannot see->manager stage skip: reviewer approve at stage0", call(f"/api/reviews/{rid}/transition","POST",{"action":"approve"},tok=T["reviewer"])[0]==409)
ok("submit ok after fixes", call(f"/api/reviews/{rid}/transition","POST",{"action":"submit"},tok=T["creator"])[1].get("stage")==1)
ok("edit locked while in approval", call(f"/api/reviews/{rid}","PATCH",{"content":"x"},tok=T["creator"])[0]==409)
ok("reviewer cannot approve manager stage", call(f"/api/reviews/{rid}/transition","POST",{"action":"approve"},tok=T["reviewer"])[0]==403)
ok("manager approves -> stage 2", call(f"/api/reviews/{rid}/transition","POST",{"action":"approve"},tok=T["manager"])[1].get("stage")==2)
ok("manager cannot give final approval", call(f"/api/reviews/{rid}/transition","POST",{"action":"approve"},tok=T["manager"])[0]==403)
ok("reviewer final approval -> stage 3", call(f"/api/reviews/{rid}/transition","POST",{"action":"approve"},tok=T["reviewer"])[1].get("stage")==3)
s,d=call(f"/api/reviews/{rid}",tok=T["admin"]); print("audit:",[a["action"] for a in d["audit"]]); ok("audit has 5+ entries", len(d["audit"])>=5)
# return flow + visibility
s,d=call("/api/reviews","POST",{"content":"Clean text here.","notes":[]},tok=T["creator"]); r2=d["id"]
call(f"/api/reviews/{r2}/transition","POST",{"action":"submit"},tok=T["creator"])
ok("return by manager -> stage 0", call(f"/api/reviews/{r2}/transition","POST",{"action":"return","note":"tighten"},tok=T["manager"])[1].get("stage")==0)
call("/api/reviews","POST",{"content":"admin note","notes":[]},tok=T["admin"])
ok("creator doesn't see admin's review", all(r["author_email"]=="creator@brandguard.demo" for r in call("/api/reviews",tok=T["creator"])[1]["reviews"]))
ok("manager sees all", len(call("/api/reviews",tok=T["manager"])[1]["reviews"])>=7)
# admin
ok("admin rulebook save", call("/api/rulebook","PUT",{"rules":call("/api/rulebook",tok=T["admin"])[1]["rules"],"facts":"clients: 500"},tok=T["admin"])[0]==200)
ok("admin sees 4 users", len(call("/api/team",tok=T["admin"])[1]["users"])==4)
ok("admin changes role", call("/api/team","PATCH",{"id":"u-creator","role":"manager"},tok=T["admin"])[0]==200)
ok("role change takes effect", call("/api/me",tok=T["creator"])[1]["user"]["role"]=="manager")
ok("admin cannot demote self", call("/api/team","PATCH",{"id":"u-admin","role":"creator"},tok=T["admin"])[0]==409)
s,d=call("/api/insights",tok=T["admin"]); print("insights:",d["funnel"],d["categories"][:3]); ok("insights funnel sums", sum(d["funnel"])==d["total"])
# python backend direct
s,d=call("/api/py/review","POST",{"text":"Utilize 100 clients","rules":"Terminology | utilize | use | g","facts":"clients: 500"}); print("py via rewrite:",s,d.get("engine"))
