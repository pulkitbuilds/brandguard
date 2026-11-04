"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { DEMO } from "@/lib/client";

const DEMOS = ["admin", "creator", "manager", "reviewer"];

export default function Login() {
  const { user, signIn, signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("in");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) router.replace("/dashboard"); }, [user, router]);

  async function go(e, pw, fn) {
    setBusy(true); setMsg("");
    try {
      const r = await (fn || (mode === "in" ? signIn : signUp))(e, pw);
      if (r === "confirm") setMsg("Check your email to confirm the account, then sign in.");
    } catch (x) { setMsg(x.message); }
    setBusy(false);
  }
  return (
    <div className="login">
      <section>
        <h1>BrandGuard AI<small>Sign in to review content against your brand rules</small></h1>
        <form onSubmit={(e) => { e.preventDefault(); go(email, password); }}>
          <label htmlFor="em">Email</label>
          <input id="em" type="text" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="p" disabled={busy}>{mode === "in" ? "Sign in" : "Create account"}</button>
            {!DEMO && <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Create an account" : "I have an account"}</button>}
          </div>
        </form>
        {msg && <p className="low" role="alert">{msg}</p>}
        {DEMO ? (
          <>
            <h2 style={{ marginTop: 18 }}>Demo accounts</h2>
            <p className="src" style={{ margin: "0 0 8px" }}>Demo mode (no Supabase set). Password for all: demo1234</p>
            <div className="row">{DEMOS.map((r) => <button key={r} disabled={busy} onClick={() => go(`${r}@brandguard.demo`, "demo1234", signIn)}>{r}</button>)}</div>
          </>
        ) : <p className="src">The first account created becomes the admin and can assign roles in the Team tab.</p>}
      </section>
    </div>
  );
}
