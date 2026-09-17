/**
 * Regression test for: Unique constraint failed on the fields: (`payment_id`)
 * Flow: login → create client/project/termin → create invoice from termin
 *       → delete invoice → create invoice again (must be 201)
 *       → creating another while one is active must be 409 with clear message
 *
 * Usage: node scripts/test-reissue-invoice.mjs [baseUrl]
 */
const base = process.argv[2] || "http://localhost:3100";
const email = process.env.SEED_EMAIL || "admin@ppms.local";
const password = process.env.SEED_PASSWORD || "admin123";

let cookie = "";

async function req(method, path, body, { form = false } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? (form ? new URLSearchParams(body).toString() : JSON.stringify(body)) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const pair = c.split(";")[0];
    if (/^(next-auth|ppms|__Secure|__Host)/.test(pair.split("=")[0])) {
      const name = pair.split("=")[0];
      cookie = cookie
        .split("; ")
        .filter((c2) => !c2.startsWith(name + "="))
        .concat(pair)
        .join("; ");
    }
  }
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

function assert(cond, msg, res) {
  if (!cond) { console.error("✗ FAIL:", msg, res ? JSON.stringify(res.json)?.slice(0, 300) : ""); process.exit(1); }
  console.log("✓", msg);
}

// 1. Login
const csrf = await req("GET", "/api/auth/csrf");
const login = await req(
  "POST",
  "/api/auth/callback/credentials",
  { csrfToken: csrf.json.csrfToken, email, password, json: "true" },
  { form: true }
);
assert(login.status < 400, "login berhasil");
const dash = await req("GET", "/api/dashboard");
assert(dash.status === 200, "dashboard API OK (session valid)");

// 2. Setup data uji
const client = await req("POST", "/api/clients", {
  companyName: "TEST Reissue Client", contactPerson: "Tester", email: "test@reissue.local",
});
assert(client.status === 201, "client uji dibuat", client);

const project = await req("POST", "/api/projects", {
  clientId: client.json.id, name: "TEST Reissue Project",
  startDate: new Date().toISOString().slice(0, 10),
  targetCompletionDate: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
  totalValue: 10000000,
});
assert(project.status === 201, "project uji dibuat");
const pid = project.json.id;

const term = await req("POST", `/api/projects/${pid}/payments`, {
  description: "Termin 1 — DP", percentage: 50, amount: 5000000,
  dueDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
});
assert(term.status === 201, "termin dibuat");
const paymentId = term.json.id;

// 3. Buat invoice pertama dari termin
const inv1 = await req("POST", "/api/invoices", { clientId: client.json.id, projectId: pid, paymentId });
assert(inv1.status === 201, `invoice #1 dibuat (${inv1.json?.number})`);

// 4. Buat invoice kedua saat #1 masih aktif → harus 409 (pesan jelas)
const dup = await req("POST", "/api/invoices", { clientId: client.json.id, projectId: pid, paymentId });
assert(dup.status === 409, `invoice ganda ditolak (409): ${dup.json?.error}`, dup);

// 5. Hapus invoice #1
const del = await req("DELETE", `/api/invoices/${inv1.json.id}`);
assert(del.status === 200, "invoice #1 dihapus");

// 6. Create lagi — INI YANG SEBELUMNYA ERROR 500
const inv2 = await req("POST", "/api/invoices", { clientId: client.json.id, projectId: pid, paymentId });
assert(inv2.status === 201, `invoice re-create berhasil (${inv2.json?.number}) — bug payment_id FIXED`, inv2);

console.log("\nSEMUA TEST LULUS ✅");
process.exit(0);
