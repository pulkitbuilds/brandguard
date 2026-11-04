// Creates one demo account per role in your Supabase project.
// Run: node --env-file=.env.local scripts/seed-demo-users.mjs
import { createClient } from "@supabase/supabase-js";
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
for (const role of ["admin", "creator", "manager", "reviewer"]) {
  const email = `${role}@brandguard.demo`;
  let id;
  const { data, error } = await s.auth.admin.createUser({ email, password: "demo1234", email_confirm: true });
  if (error) id = (await s.auth.admin.listUsers({ perPage: 200 })).data.users.find((u) => u.email === email)?.id;
  else id = data.user.id;
  if (id) { await s.from("profiles").upsert({ id, email, name: role, role }); console.log("ready:", email, "/ demo1234 /", role); }
  else console.log("failed:", email, error?.message);
}
