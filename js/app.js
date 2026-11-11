import { SCENARIOS, SCENARIO_IDS, shuffleScenarioIds, getScenarioMetadata, LIVE_SECONDS } from "./scenarios.js";
import { BreathingEngine, drawBaby, drawTrace, refreshCanvasColors } from "./simulator.js";

const $ = id => document.getElementById(id);
const config = window.APP_CONFIG || {};
// An unconfigured build is automatically a safe local preview. This keeps the demo usable
// while ensuring it cannot submit research responses until a database is explicitly configured.
const TEST_MODE = new URLSearchParams(location.search).get("test") === "1" ||
  !config.supabaseUrl || !config.supabaseAnonKey;
const CONSENT_VERSION = config.consentVersion || "draft-1.0";
const VERSION = config.appVersion || "0.2.1";
const STORAGE_KEY = "newborn-breathing-survey-draft-v1";
const TEST_STORAGE_KEY = "newborn-breathing-survey-test-submissions-v1";
const supabaseReady = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase?.createClient);
const consentDetailsReady = [config.studyTitle, config.studyContact, config.ethicsContact, config.ethicsApproval, config.dataRetention]
  .every(value => typeof value === "string" && value.trim() && !value.includes("[Insert"));
const recruitmentReady = supabaseReady && consentDetailsReady && CONSENT_VERSION !== "draft-1.0";
const supabase = supabaseReady ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

let draft = null;
let scenario = null;
let engine = null;
let mode = "idle";
let rating = null;
let firstRating = null;
let ratingEvents = [];
let events = [];
let liveAccumulator = 0;
let timerId = null;
let lastFrame = performance.now();
let frameCount = 0;

function newId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
function showNotice(message, type = "info") {
  const el = $("notice"); el.textContent = message; el.className = `notice ${type}`; el.hidden = false;
}
function hideNotice() { $("notice").hidden = true; }
function saveDraft() {
  if (!draft) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); }
  catch { showNotice("This browser could not save a local draft. Please avoid refreshing or closing this page before submitting.", "error"); }
}
function loadDraft() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function removeDraft() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* browser storage may be disabled */ }
}
function setPanel(id) {
  ["consent-panel", "scenario-intro", "sim", "final-questions", "thank-you"].forEach(panel => $(panel).hidden = panel !== id);
}
function updateProgress() {
  const completed = draft.responses.length;
  const current = Math.min(completed + 1, 8);
  const remaining = 8 - completed;
  $("progress-label").textContent = completed >= 8 ? "All 8 scenarios complete" : `Scenario ${current} of 8`;
  $("remaining-label").textContent = completed >= 8 ? "Ready to submit" : `${remaining} ${remaining === 1 ? "scenario" : "scenarios"} remaining`;
  $("progress-fill").style.width = `${(completed / 8) * 100}%`;
  $("progress-track").setAttribute("aria-valuenow", String(completed));
}
function restoreProfile() {
  if (!draft) return;
  $("clinical-role").value = draft.clinical_role || "";
  $("neonatal-experience").value = draft.neonatal_experience || "";
}
function restoreFinalQuestions() {
  if (!draft) return;
  const q = draft.final_questions || {};
  $("elevated-threshold").value = q.elevated_rate_concern_threshold ?? "";
  $("reduced-threshold").value = q.reduced_rate_concern_threshold ?? "";
  $("concern-duration").value = q.concern_duration_after_return_to_baseline || "";
  $("final-comments").value = q.other_comments || "";
}
function readFinalQuestions() {
  return {
    elevated_rate_concern_threshold: optionalNumber("elevated-threshold"),
    reduced_rate_concern_threshold: optionalNumber("reduced-threshold"),
    concern_duration_after_return_to_baseline: $("concern-duration").value || null,
    other_comments: $("final-comments").value.trim() || null
  };
}
function persistFinalQuestions() {
  if (!draft || draft.responses.length !== 8) return;
  draft.final_questions = readFinalQuestions();
  draft.last_activity_at = new Date().toISOString();
  saveDraft();
}
function persistProfile() {
  if (!draft) return;
  draft.clinical_role = $("clinical-role").value || null;
  draft.neonatal_experience = $("neonatal-experience").value || null;
  saveDraft();
}
function initialiseDraft() {
  draft = {
    participant_id: newId(),
    consent_given: true,
    consent_version: CONSENT_VERSION,
    clinical_role: $("clinical-role").value || null,
    neonatal_experience: $("neonatal-experience").value || null,
    presentation_order: shuffleScenarioIds(),
    responses: [],
    final_questions: null,
    created_at: new Date().toISOString(),
    client_version: VERSION,
    is_test: TEST_MODE
  };
  saveDraft();
}
function restoreDraftState() {
  const loaded = loadDraft();
  if (!loaded || !loaded.consent_given || !Array.isArray(loaded.responses) || !Array.isArray(loaded.presentation_order)) return false;
  const validOrder = loaded.presentation_order.length === 8 && new Set(loaded.presentation_order).size === 8 && loaded.presentation_order.every(id => SCENARIO_IDS.includes(id));
  if (!validOrder || loaded.responses.length > 8) return false;
  draft = loaded;
  restoreProfile();
  if (draft.responses.length === 8) {
    restoreFinalQuestions();
    setPanel("final-questions");
    showNotice("An unfinished survey was found on this device. Your eight completed scenario responses have been restored.");
  } else {
    setPanel("scenario-intro");
    showNotice(`An unfinished survey was found on this device. You can resume at scenario ${draft.responses.length + 1} of 8. The current observation restarts from the beginning if it was in progress.`, "info");
  }
  updateProgress();
  return true;
}
function scenarioForCurrentIndex() {
  const id = draft.presentation_order[draft.responses.length];
  return SCENARIOS[id];
}
function setRatingButtons(enabled) {
  document.querySelectorAll(".rating-btn").forEach(button => { button.disabled = !enabled; });
}
function paintRating() {
  document.querySelectorAll(".rating-btn").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.rating === rating));
  });
  $("current-rating").textContent = rating ? `Current rating: ${rating[0].toUpperCase()}${rating.slice(1)}.` : "Not yet rated.";
  $("save-continue").disabled = !(mode === "ended" && rating && $("confidence").value);
}
function addEvent(type, extra = {}) {
  const snapshot = engine ? engine.snapshot() : {};
  const event = { event_type: type, ...snapshot, ...extra };
  events.push(event);
  return event;
}
function setSelectedRating(color) {
  if (mode !== "live" && mode !== "ended") return;
  if (!["green", "yellow", "red"].includes(color) || rating === color) return;
  const previous = rating;
  rating = color;
  if (!firstRating) firstRating = color;
  const event = addEvent("rating_selection", {
    color,
    previous_color: previous,
    first_selection: previous === null,
    selection_number: ratingEvents.length + 1
  });
  ratingEvents.push(event);
  paintRating();
  if (draft) {
    draft.last_activity_at = new Date().toISOString();
    saveDraft();
  }
}
function startScenario() {
  if (!draft || draft.responses.length >= 8) return;
  hideNotice();
  scenario = scenarioForCurrentIndex();
  engine = new BreathingEngine(scenario);
  mode = "countdown"; rating = null; firstRating = null; ratingEvents = []; events = [];
  liveAccumulator = 0;
  $("cot-heading").textContent = `Cot ${scenario.cot}`;
  $("baseline-number").textContent = String(scenario.baseline);
  $("clock").textContent = "Live starts in 3";
  $("current-rr").textContent = Math.round(engine.snapshot().rolling_rr_estimate);
  $("end-panel").hidden = true;
  $("unrealistic").checked = false;
  $("confidence").value = "";
  $("additional-info").value = "";
  $("comments").value = "";
  setRatingButtons(false); paintRating(); updateProgress();
  setPanel("sim");
  let seconds = 3;
  clearInterval(timerId);
  timerId = setInterval(() => {
    seconds--;
    if (seconds > 0) $("clock").textContent = `Live starts in ${seconds}`;
    else {
      clearInterval(timerId); timerId = null; beginLive();
    }
  }, 1000);
}
function beginLive() {
  mode = "live";
  addEvent("live_observation_started");
  setRatingButtons(true);
  paintRating();
  $("clock").textContent = `Live: ${LIVE_SECONDS} s left`;
}
function finishLive() {
  mode = "ended";
  $("clock").textContent = "Live observation complete";
  $("end-panel").hidden = false;
  paintRating();
  $("end-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function saveScenarioResponse() {
  if (mode !== "ended" || !rating || !$("confidence").value) return;
  const metadata = getScenarioMetadata(scenario.id);
  const confirmation = addEvent("final_rating_confirmed", {
    color: rating,
    unrealistic_baby: $("unrealistic").checked,
    confidence: Number($("confidence").value)
  });
  const response = {
    ...metadata,
    first_rating: firstRating,
    rating_events: ratingEvents,
    events,
    final_rating: rating,
    final_rating_confirmed_at: confirmation.timestamp,
    confidence: Number($("confidence").value),
    unrealistic_baby: $("unrealistic").checked,
    comments: $("comments").value.trim() || null,
    additional_information_needed: $("additional-info").value.trim() || null,
    observation_started_at: events.find(e => e.event_type === "live_observation_started")?.timestamp || null,
    selection_change_count: Math.max(0, ratingEvents.length - 1)
  };
  draft.responses.push(response);
  draft.last_activity_at = new Date().toISOString();
  saveDraft();
  setRatingButtons(false);
  engine = null; scenario = null; mode = "saved";
  updateProgress();
  if (draft.responses.length === 8) {
    setPanel("final-questions");
    $("final-questions").scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    setPanel("scenario-intro");
    $("scenario-intro").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
function optionalNumber(id) {
  const raw = $(id).value.trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
function createSubmissionPayload() {
  return {
    participant_id: draft.participant_id,
    clinical_role: draft.clinical_role,
    neonatal_experience: draft.neonatal_experience,
    presentation_order: draft.presentation_order,
    responses: draft.responses,
    final_questions: readFinalQuestions(),
    consent_given: true,
    consent_version: draft.consent_version,
    client_version: VERSION,
    is_test: TEST_MODE
  };
}
async function submitAll() {
  if (!draft || draft.responses.length !== 8) return;
  const ids = draft.responses.map(r => r.scenario_id);
  if (new Set(ids).size !== 8 || SCENARIO_IDS.some(id => !ids.includes(id))) {
    showNotice("This survey is missing one or more scenario responses. Please return to the survey before submitting.", "error");
    return;
  }
  const button = $("submit-survey"); button.disabled = true; button.textContent = "Submitting…";
  const payload = createSubmissionPayload();
  // Test mode is always local-only, even when production Supabase credentials exist.
  if (TEST_MODE) {
    try {
      const current = JSON.parse(localStorage.getItem(TEST_STORAGE_KEY) || "[]");
      current.push({ ...payload, submitted_at: new Date().toISOString(), local_preview_only: true });
      localStorage.setItem(TEST_STORAGE_KEY, JSON.stringify(current));
      localStorage.removeItem(STORAGE_KEY);
      showThankYou(`TEST ONLY — saved locally in this browser. Nothing was sent to a database. Test record ${current.length}.`);
    } catch {
      showNotice("The local test record could not be saved by this browser. No database submission was made.", "error");
      button.disabled = false; button.textContent = "Submit all 8 responses";
    }
    return;
  }
  if (!supabaseReady) {
    showNotice("This survey is not connected to its secure database yet. No response has been submitted. Contact the study administrator; do not distribute this deployment link until setup is complete.", "error");
    button.disabled = false; button.textContent = "Submit all 8 responses";
    return;
  }
  try {
    const { data, error } = await supabase.functions.invoke("submit-survey", { body: payload });
    if (error) throw error;
    const submissionId = data?.submission_id || data?.id;
    if (!submissionId) throw new Error("The server did not confirm a submission reference.");
    removeDraft();
    showThankYou(`Anonymous submission reference: ${submissionId}`);
  } catch (error) {
    console.error("Survey submission failed", error);
    showNotice("We could not confirm that your responses reached the server. Your eight responses remain saved on this device. Check your connection and use Submit all 8 responses to retry. Error: " + (error?.message || "Unknown network error"), "error");
    button.disabled = false; button.textContent = "Retry submission";
  }
}
function showThankYou(reference) {
  setPanel("thank-you");
  $("submission-reference").textContent = reference;
  hideNotice();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function animateFrame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  if (mode === "live" && engine) {
    liveAccumulator += dt;
    while (liveAccumulator >= 0.025 && mode === "live") {
      engine.step(0.025); liveAccumulator -= 0.025;
      if (engine.t >= scenario.live) { finishLive(); break; }
    }
    if (mode === "live") $("clock").textContent = `Live: ${Math.max(0, Math.ceil(scenario.live - engine.t))} s left`;
  }
  if (engine && !$("sim").hidden) {
    if (frameCount++ % 30 === 0) refreshCanvasColors();
    drawBaby($("baby"), engine);
    drawTrace($("trace"), engine, scenario.baseline);
    $("current-rr").textContent = Math.round(engine.snapshot().rolling_rr_estimate);
  }
  requestAnimationFrame(animateFrame);
}
// Populate consent details from the deploy-time configuration.
if (config.studyTitle) $("study-title-value").textContent = config.studyTitle;
if (config.studyContact) $("study-contact").textContent = config.studyContact;
if (config.ethicsContact) $("ethics-contact").textContent = config.ethicsContact;
if (config.ethicsApproval) $("approval-reference").textContent = config.ethicsApproval;
if (config.dataRetention) $("data-retention").textContent = config.dataRetention;
if (recruitmentReady) $("approval-note").hidden = true;
if (TEST_MODE && !recruitmentReady) {
  showNotice("PREVIEW / TEST MODE: deployment is not configured for research. You can explore the eight scenarios, but responses are stored only in this browser and are never sent to a research database. Do not use this link for nurse recruitment.", "info");
  $("begin-survey").textContent = "Agree and begin test preview";
} else if (TEST_MODE) {
  showNotice("TEST MODE: this session is for technical testing only. It will not be included in research results.", "info");
} else if (!recruitmentReady) {
  showNotice("Deployment setup is incomplete. The survey is not ready for nurse recruitment: secure database settings and/or faculty-approved consent details still need to be configured.", "error");
}
$("consent-check").addEventListener("change", () => {
  $("begin-survey").disabled = !$("consent-check").checked || (!recruitmentReady && !TEST_MODE);
});
$("clinical-role").addEventListener("change", persistProfile);
$("neonatal-experience").addEventListener("change", persistProfile);
["elevated-threshold", "reduced-threshold", "concern-duration", "final-comments"].forEach(id => {
  $(id).addEventListener("input", persistFinalQuestions);
  $(id).addEventListener("change", persistFinalQuestions);
});
["elevated-threshold", "reduced-threshold", "concern-duration", "final-comments"].forEach(id => {
  $(id).addEventListener("input", persistFinalQuestions);
  $(id).addEventListener("change", persistFinalQuestions);
});
$("begin-survey").addEventListener("click", () => {
  if (!$("consent-check").checked || (!recruitmentReady && !TEST_MODE)) return;
  initialiseDraft();
  setPanel("scenario-intro"); updateProgress();
});
$("start-scenario").addEventListener("click", startScenario);
document.querySelectorAll(".rating-btn").forEach(button => button.addEventListener("click", () => setSelectedRating(button.dataset.rating)));
$("confidence").addEventListener("change", paintRating);
$("save-continue").addEventListener("click", saveScenarioResponse);
$("submit-survey").addEventListener("click", submitAll);
document.addEventListener("keydown", event => {
  const tag = event.target?.tagName || "";
  if (["TEXTAREA", "INPUT", "SELECT"].includes(tag) || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === "1") setSelectedRating("green");
  if (event.key === "2") setSelectedRating("yellow");
  if (event.key === "3") setSelectedRating("red");
});
window.addEventListener("resize", () => { if (engine && scenario) { drawBaby($("baby"), engine); drawTrace($("trace"), engine, scenario.baseline); } });
window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", refreshCanvasColors);
if (!TEST_MODE && restoreDraftState()) $("consent-check").checked = true;
else setPanel("consent-panel");
refreshCanvasColors();
$("new-preview")?.addEventListener("click", () => { localStorage.removeItem(TEST_STORAGE_KEY); localStorage.removeItem(STORAGE_KEY); location.href = location.pathname + "?test=1"; });
requestAnimationFrame(animateFrame);
