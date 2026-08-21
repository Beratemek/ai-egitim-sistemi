import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

const raw = fs.readFileSync(".env.local", "utf8");
const env = {};

for (const line of raw.split(/\r?\n/)) {
  const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
  if (!match) continue;
  env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
}

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase URL veya gizli sunucu anahtari eksik.");
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const [securityRpc, assignments, attempts, questions, submissions] =
  await Promise.all([
    supabase.rpc("get_my_submissions", { target_exam: null }),
    supabase.from("exam_assignments").select("id", { count: "exact", head: true }),
    supabase.from("exam_attempts").select("id", { count: "exact", head: true }),
    supabase.from("questions").select("id", { count: "exact", head: true }),
    supabase.from("submissions").select("id", { count: "exact", head: true }),
  ]);

const checks = { securityRpc, assignments, attempts, questions, submissions };
const output = Object.fromEntries(
  Object.entries(checks).map(([name, result]) => [
    name,
    {
      ok: !result.error,
      count: "count" in result ? result.count : undefined,
      error: result.error?.message ?? null,
    },
  ]),
);

console.log(JSON.stringify(output));

if (Object.values(checks).some((result) => result.error)) process.exit(1);
