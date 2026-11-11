import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SCENARIO_IDS, SCENARIOS } from "../js/scenarios.js";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("participant page includes the complete consent, observation and questionnaire flow", () => {
  const html = read("../index.html");
  for (const required of [
    "consent-check", "clinical-role", "neonatal-experience", "Cot 1", "baseline-number",
    'data-rating="green"', 'data-rating="yellow"', 'data-rating="red"',
    "unrealistic", "confidence", "additional-info", "comments", "save-continue",
    "elevated-threshold", "reduced-threshold", "concern-duration", "submit-survey",
    "environment-badge", "submission-status", "response-rating-summary"
  ]) {
    assert.ok(html.includes(required), "Missing participant page element: " + required);
  }
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, "Participant HTML IDs must be unique");
});

test("all eight scenarios have distinct visual identity variants and valid baselines", () => {
  const signatures = new Set();
  for (const id of SCENARIO_IDS) {
    const scenario = SCENARIOS[id];
    assert.ok(scenario.appearance?.skin && scenario.appearance?.skinDark && scenario.appearance?.cap && scenario.appearance?.blanket, id + " has incomplete visual variant");
    signatures.add([scenario.appearance.skin, scenario.appearance.skinDark, scenario.appearance.cap, scenario.appearance.blanket, scenario.appearance.style].join("|"));
    assert.ok(Number.isInteger(scenario.baseline) && scenario.baseline > 0, id + " has invalid baseline");
  }
  assert.equal(signatures.size, 8);
});

test("public configuration contains no privileged credential and keeps research collection disabled", () => {
  const config = read("../config.js");
  assert.ok(config.includes('supabaseUrl: "https://wpcgwnrtkcyldzxnorto.supabase.co"'));
  assert.ok(config.includes('supabasePublishableKey: "sb_publishable_'));
  assert.ok(config.includes("researchCollectionEnabled: false"));
  assert.ok(!/sb_secret|service_role|service-role/i.test(config));
  assert.ok(!/supabaseSecretKey\s*:/.test(config));
  assert.ok(config.includes("[Insert faculty-approved study title]"));
  assert.ok(config.includes("[Insert faculty-approved privacy statement"));
});

test("database policies keep participant submissions private and use a private admin helper", () => {
  const sql = read("../supabase/migrations/001_schema.sql");
  assert.ok(sql.includes("alter table public.submissions enable row level security"));
  assert.ok(sql.includes("alter table public.study_admins enable row level security"));
  assert.ok(sql.includes("create schema if not exists private"));
  assert.ok(sql.includes("private.is_study_admin()"));
  assert.ok(!sql.includes("function public.is_study_admin"));
  assert.ok(sql.includes("using ((select private.is_study_admin()))"));
  assert.ok(sql.includes("using (user_id = (select auth.uid()))"));
  assert.ok(sql.includes("revoke all on public.submissions from anon, authenticated"));
  assert.ok(sql.includes("grant select on public.submissions to authenticated"));
});

test("server endpoint validates all scenario IDs, presentation order, metadata and rating events", () => {
  const fn = read("../supabase/functions/submit-survey/index.ts");
  for (const id of SCENARIO_IDS) assert.ok(fn.includes('"' + id + '"'));
  assert.ok(fn.includes("input.presentation_order.some"));
  assert.ok(fn.includes("r.baseline_rr"));
  assert.ok(fn.includes("r.programmed_current_rr"));
  assert.ok(fn.includes("SUPABASE_SECRET_KEYS"));
  assert.ok(fn.includes("SUPABASE_PUBLISHABLE_KEYS"));
  assert.ok(fn.includes('req.headers.get("apikey")'));
  assert.ok(fn.includes("23505"));
  assert.ok(fn.includes("rating_events"));
  assert.ok(fn.includes('Deno.env.get("RESEARCH_COLLECTION_ENABLED")!=="true"'));
  assert.ok(fn.includes('Deno.env.get("APPROVED_CONSENT_VERSION")'));
  assert.ok(fn.includes("input.consent_version!==approvedConsentVersion"));
});

test("final questionnaire answers are saved and restored with an interrupted draft", () => {
  const app = read("../js/app.js");
  assert.ok(app.includes("function restoreFinalQuestions()"));
  assert.ok(app.includes("function persistFinalQuestions()"));
  assert.ok(app.includes('$(id).addEventListener("input", persistFinalQuestions)'));
  assert.ok(app.includes("restoreFinalQuestions();"));
  assert.ok(app.includes("final_questions: readFinalQuestions()"));
});

test("successful completion distinguishes a database save from a local preview", () => {
  const app = read("../js/app.js");
  assert.ok(app.includes("data?.saved !== true"));
  assert.ok(app.includes("Your eight scenario assessments and final questionnaire have been saved to the study database."));
  assert.ok(app.includes("Nothing was sent to the research database."));
  assert.ok(app.includes("Retry secure submission"));
});

test("an interrupted preview draft is restorable without mixing test and research sessions", () => {
  const app = read("../js/app.js");
  assert.ok(app.includes("loaded.is_test !== TEST_MODE"));
  assert.ok(app.includes("if (restoreDraftState())"));
  assert.ok(app.includes("localStorage.setItem(TEST_STORAGE_KEY"));
});

test("local preview cannot send a submission to Supabase", () => {
  const app = read("../js/app.js");
  const start = app.indexOf("async function submitAll()");
  const testBranch = app.indexOf("if (TEST_MODE) {", start);
  const invoke = app.indexOf('supabase.functions.invoke("submit-survey"', start);
  assert.ok(start >= 0 && testBranch > start && invoke > testBranch);
  assert.ok(app.indexOf("return;", testBranch) < invoke);
});

test("admin page contains every element referenced by the dashboard script", () => {
  const html = read("../admin.html");
  const script = read("../js/admin.js");
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]));
  const references = [...script.matchAll(/\$\("([^"]+)"\)/g)].map(match => match[1]);
  for (const id of references) assert.ok(ids.has(id), "Admin script references missing element: " + id);
});

test("administrator dashboard queries submissions only through the authenticated Supabase client", () => {
  const script = read("../js/admin.js");
  assert.ok(script.includes("supabase.auth.signInWithPassword"));
  assert.ok(script.includes('.from("study_admins")'));
  assert.ok(script.includes('.from("submissions")'));
  assert.ok(script.includes("maybeSingle()"));
  assert.ok(script.includes("row.is_test !== true"));
});

test("GitHub Pages deploys only the public frontend and tests pull requests before merging", () => {
  const workflow = read("../.github/workflows/pages.yml");
  assert.ok(workflow.includes("pull_request:"));
  assert.ok(workflow.includes("run: npm test"));
  assert.ok(workflow.includes("cp index.html admin.html config.js dist/"));
  assert.ok(workflow.includes("cp -R css js dist/"));
  assert.ok(workflow.includes("actions/deploy-pages@v4"));
  assert.ok(!workflow.includes("cp -R supabase"));
});
