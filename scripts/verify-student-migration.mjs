import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const raw = fs.readFileSync(".env.local", "utf8");
const env = {};

for (const line of raw.split(/\r?\n/)) {
  const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
  if (!match) continue;
  env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const auth = await supabase.auth.signInWithPassword({
  email: env.DEV_ADMIN_EMAIL,
  password: env.DEV_ADMIN_PASSWORD,
});
if (auth.error) throw new Error(`AUTH: ${auth.error.message}`);

const [assignments, attempts, criteriaColumn, manageRpc] = await Promise.all([
  supabase.from("exam_assignments").select("id", { count: "exact", head: true }),
  supabase.from("exam_attempts").select("id", { count: "exact", head: true }),
  supabase.from("submissions").select("id, ai_criteria_json").limit(1),
  supabase.rpc("can_manage_exam", {
    target_exam: "00000000-0000-0000-0000-000000000000",
  }),
]);

console.log(
  JSON.stringify({
    assignments: { count: assignments.count, error: assignments.error?.message ?? null },
    attempts: { count: attempts.count, error: attempts.error?.message ?? null },
    criteriaColumn: { ok: !criteriaColumn.error, error: criteriaColumn.error?.message ?? null },
    manageRpc: { ok: !manageRpc.error, error: manageRpc.error?.message ?? null },
  }),
);

await supabase.auth.signOut();
