"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { APPROVER } from "@/lib/constants";

const ALL = ["creator", "manager", "reviewer", "admin"];
const TABS = [
  { href: "/dashboard", label: "Dashboard", roles: ALL },
  { href: "/review", label: "Review", roles: ALL },
  { href: "/queue", label: "Approvals", roles: APPROVER },
  { href: "/rulebook", label: "Rulebook", roles: ALL },
  { href: "/insights", label: "Insights", roles: APPROVER },
  { href: "/tools", label: "Accessibility", roles: ALL },
  { href: "/team", label: "Team", roles: ["admin"] },
];

export default function AppLayout({ children }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);
  if (loading || !user) return <p className="note" style={{ padding: 24 }}>Loading…</p>;
  const tabs = TABS.filter((t) => t.roles.includes(user.role));
  const allowed = tabs.some((t) => path.startsWith(t.href));
  return (
    <>
      <header>
        <h1>BrandGuard AI<small>Checks content against your brand rules before it is published</small></h1>
        <div className="row">
          <span className="chip">{user.email} · {user.role}</span>
          <button onClick={async () => { await signOut(); router.replace("/login"); }}>Sign out</button>
        </div>
      </header>
      <nav className="tabs" aria-label="Sections">
        {tabs.map((t) => <Link key={t.href} href={t.href} className={path.startsWith(t.href) ? "tab on" : "tab"}>{t.label}</Link>)}
      </nav>
      <div className="page">{allowed ? children : <section><h2>Not available for your role</h2><p className="src">Ask an admin to change your role in the Team tab.</p></section>}</div>
    </>
  );
}
