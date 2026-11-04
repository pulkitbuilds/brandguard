import { db } from "./supabase";
import { review, key, SAMPLE } from "./engine";

// ---------- in-memory store (demo mode) ----------
function seed() {
  const users = [
    { id: "u-admin", email: "admin@brandguard.demo", name: "Asha (Admin)", role: "admin", password: "demo1234" },
    { id: "u-creator", email: "creator@brandguard.demo", name: "Chirag (Creator)", role: "creator", password: "demo1234" },
    { id: "u-manager", email: "manager@brandguard.demo", name: "Meera (Manager)", role: "manager", password: "demo1234" },
    { id: "u-reviewer", email: "reviewer@brandguard.demo", name: "Rohan (Reviewer)", role: "reviewer", password: "demo1234" },
  ];
  const rulebook = {
    rules: `Terminology | utilize | use | Terminology glossary\nTerminology | e-?mail | email | Terminology glossary\nTerminology | click here | select this link | Style guide, links\nTone | gonna | going to | Brand voice guide\nTone | awesome | excellent | Brand voice guide\nTone | !{2,} | ! | Brand voice guide\nClaims | no\\.?\\s?1\\b | (add proof or remove) | Claims policy\nClaims | 100% guaranteed | (add proof or remove) | Claims policy\nClaims | world-?class | (add proof or remove) | Claims policy\nClaims | unbeatable | (add proof or remove) | Claims policy`,
    facts: `clients: 500\nstudents: 20,000\napproved claim: Rated 4.7 out of 5 by 2,000 learners (survey, Q3 2026)`,
  };
  const reviews = [], audit = [];
  const mk = (title, content, stage, dismissKeys = []) => {
    const findings = review(content, rulebook.rules, rulebook.facts).map(({ cat, text, src }) => ({ cat, text, src }));
    const dismissed = findings.filter((f) => dismissKeys.includes(f.text.toLowerCase())).map((f) => ({ key: key(f), ...f }));
    const id = "r-" + (reviews.length + 1), now = new Date(Date.now() - (5 - reviews.length) * 36e5).toISOString();
    reviews.push({ id, title, content, findings, dismissed, stage, author_id: "u-creator", author_email: "creator@brandguard.demo", created_at: now, updated_at: now });
    audit.push({ review_id: id, user_email: "creator@brandguard.demo", role: "creator", action: "Created draft", created_at: now });
    if (stage >= 1) audit.push({ review_id: id, user_email: "creator@brandguard.demo", role: "creator", action: "Submitted for approval", created_at: now });
    if (stage >= 2) audit.push({ review_id: id, user_email: "manager@brandguard.demo", role: "manager", action: "Approved by manager, sent to reviewer", created_at: now });
    if (stage >= 3) audit.push({ review_id: id, user_email: "reviewer@brandguard.demo", role: "reviewer", action: "Approved for publishing", created_at: now });
  };
  mk("Launch post (needs work)", SAMPLE, 0);
  mk("Pricing page copy", "Join 500 clients today. Select this link to email us.", 1);
  mk("Webinar invite", "Hear from our team about how 20,000 students learn. Rated 4.7 out of 5 by 2,000 learners (survey, Q3 2026).", 2);
  mk("Campaign tagline", "India’s No.1 platform for learners. Join 500 clients.", 3, ["no.1"]);
  return { users, rulebook, reviews, audit, n: 4 };
}
const M = (globalThis.__bgmem ||= seed());
const pub = ({ password, ...u }) => u;
const memory = {
  userByToken: async (t) => { const u = M.users.find((x) => "demo:" + x.id === t); return u ? pub(u) : null; },
  login: async (email, pw) => { const u = M.users.find((x) => x.email === email && x.password === pw); return u ? { token: "demo:" + u.id, user: pub(u) } : null; },
  profile: async (u) => pub(M.users.find((x) => x.id === u.id)),
  profiles: async () => M.users.map(pub),
  setRole: async (id, role) => { M.users.find((x) => x.id === id).role = role; },
  rulebook: async () => M.rulebook,
  saveRulebook: async (r) => { M.rulebook = { rules: r.rules, facts: r.facts }; },
  reviews: async () => [...M.reviews].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
  review: async (id) => M.reviews.find((r) => r.id === id) || null,
  createReview: async (r) => { const row = { ...r, id: "r-" + ++M.n, stage: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; M.reviews.push(row); return row; },
  updateReview: async (id, p) => { const r = M.reviews.find((x) => x.id === id); Object.assign(r, p, { updated_at: new Date().toISOString() }); return r; },
  audit: async (id) => M.audit.filter((a) => a.review_id === id),
  addAudit: async (a) => { M.audit.push({ ...a, created_at: new Date().toISOString() }); },
};

// ---------- Supabase store ----------
const supa = (s) => ({
  profile: async (u) => {
    const { data } = await s.from("profiles").select("*").eq("id", u.id).maybeSingle();
    if (data) return data;
    const { count } = await s.from("profiles").select("*", { count: "exact", head: true });
    const row = { id: u.id, email: u.email, name: u.email.split("@")[0], role: count ? "creator" : "admin" }; // first account becomes admin
    const { error } = await s.from("profiles").insert(row);
    if (error) throw error;
    return row;
  },
  profiles: async () => (await s.from("profiles").select("*").order("email")).data || [],
  setRole: async (id, role) => { const { error } = await s.from("profiles").update({ role }).eq("id", id); if (error) throw error; },
  rulebook: async () => (await s.from("rulebooks").select("rules,facts").eq("id", "default").maybeSingle()).data,
  saveRulebook: async (r) => { const { error } = await s.from("rulebooks").upsert({ id: "default", rules: r.rules, facts: r.facts, updated_at: new Date().toISOString() }); if (error) throw error; },
  reviews: async () => (await s.from("reviews").select("*").order("updated_at", { ascending: false })).data || [],
  review: async (id) => (await s.from("reviews").select("*").eq("id", id).maybeSingle()).data,
  createReview: async (r) => { const { data, error } = await s.from("reviews").insert(r).select("*").single(); if (error) throw error; return data; },
  updateReview: async (id, p) => { const { data, error } = await s.from("reviews").update({ ...p, updated_at: new Date().toISOString() }).eq("id", id).select("*").single(); if (error) throw error; return data; },
  audit: async (id) => (await s.from("audit_log").select("user_email,role,action,created_at").eq("review_id", id).order("id")).data || [],
  addAudit: async (a) => { await s.from("audit_log").insert(a); },
});

export const isDemo = () => !db();
export const store = () => (db() ? supa(db()) : memory);
