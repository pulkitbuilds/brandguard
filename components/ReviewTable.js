import Link from "next/link";
import { STAGES } from "@/lib/constants";

export default function ReviewTable({ rows, empty }) {
  if (!rows.length) return <p className="src">{empty}</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table><thead><tr><th>Title</th><th>Author</th><th>Stage</th><th>Open issues</th><th>Updated</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}><td><Link href={`/review?id=${r.id}`}>{r.title || "Untitled"}</Link></td><td>{r.author_email}</td><td>{STAGES[r.stage]}</td><td>{r.issues}</td><td>{new Date(r.updated_at).toLocaleString()}</td></tr>
        ))}</tbody></table>
    </div>
  );
}

