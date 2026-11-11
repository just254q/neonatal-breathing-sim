import { SCENARIOS, SCENARIO_IDS, shuffleScenarioIds, getScenarioMetadata, LIVE_SECONDS } from "./scenarios.js";
import { BreathingEngine, drawBaby, drawTrace, refreshCanvasColors } from "./simulator.js";

const $ = id => document.getElementById(id);
const config = window.APP_CONFIG || {};
// An unconfigured build is automatically a safe local preview. This keeps the demo usable
// while ensuring it cannot submit research responses until a database is explicitly configured.
const TEST_MODE = new URLSearchParams(location.search).get("test") === "1" ||
  !config.supabaseUrl || !config.supabasePublishableKey || config.researchCollectionEnabled !== true;
const CONSENT_VERSION = config.consentVersion || "draft-1.0";
const VERSION = config.appVersion || "0.2.2";
const STORAGE_KEY = "newborn-breathing-survey-draft-v1";
const TEST_STORAGE_KEY = "newborn-breathing-survey-test-submissions-v1";
const supabaseReady = Boolean(config.supabaseUrl && config.supabasePublishableKey && window.supabase?.createClient);
const consentDetailsReady = [config.studyTitle, config.studyContact, config.ethicsContact, config.ethicsApproval, config.dataRetention, config.privacyNotice]
  .every(value => typeof value === "string" && value.trim() && !value.includes("[Insert"));
const recruitmentReady = supabaseReady && config.researchCollectionEnabled === true && consentDetailsReady && CONSENT_VERSION !== "draft-1.0";
const supabase = supabaseReady ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey) : null;

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
  $("intro-step-number").textContent = String(current).padStart(2, "0");
  $("scenario-heading").textContent = completed >= 8 ? "Your final questions are ready" : `Your next observation is ready`;
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
  if (!validOrder || loaded.responses.length > 8 || loaded.is_test !== TEST_MODE) return false;
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
  const ratingContext = mode === "live"
    ? "You can change this selection while the live observation is running."
    : mode === "ended"
      ? "This is your final assessment for this observation."
      : "Choose a rating when the live observation begins.";
  $("current-rating").textContent = rating
    ? `Selected: ${rating[0].toUpperCase()}${rating.slice(1)}. ${ratingContext}`
    : (mode === "live" ? "Choose the response that best reflects your assessment." : "Choose a rating when the live observation begins.");
  if ($("response-rating-summary")) $("response-rating-summary").textContent = rating ? rating[0].toUpperCase() + rating.slice(1) : "Not yet rated";
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
  draft.final_questions = payload.final_questions;
  draft.last_activity_at = new Date().toISOString();
  saveDraft();

  if (TEST_MODE) {
    try {
      const current = JSON.parse(localStorage.getItem(TEST_STORAGE_KEY) || "[]");
      current.push({ ...payload, submitted_at: new Date().toISOString(), local_preview_only: true });
      localStorage.setItem(TEST_STORAGE_KEY, JSON.stringify(current));
      removeDraft();
      showThankYou({
        title: "Preview completed",
        message: "Your test responses have been saved in this browser only. Nothing was sent to the research database.",
        reference: `Local preview record ${current.length}`
      });
    } catch {
      showNotice("This browser could not save the local preview record. No database submission was made. Your current survey draft has been kept so you can retry.", "error");
      button.disabled = false; button.textContent = "Retry local save";
    }
    return;
  }
  if (!recruitmentReady) {
    showNotice("Research collection is not enabled for this deployment. Your completed responses remain saved on this device. Contact the study team before attempting to submit again.", "error");
    button.disabled = false; button.textContent = "Retry when collection is enabled";
    return;
  }
  try {
    const { data, error } = await supabase.functions.invoke("submit-survey", { body: payload });
    if (error) throw error;
    const submissionId = data?.submission_id || data?.id;
    if (data?.saved !== true || !submissionId) throw new Error("The server did not confirm that the response was saved.");
    removeDraft();
    showThankYou({
      title: "Your response has been securely submitted",
      message: "Thank you. Your eight scenario assessments and final questionnaire have been saved to the study database. You may close this page.",
      reference: `Anonymous submission reference: ${submissionId}`
    });
  } catch (error) {
    console.error("Survey submission failed", error);
    showNotice("We could not confirm that your responses reached the study database. Your completed responses remain saved on this device. Check your connection, then select Retry secure submission. Do not start a new survey.", "error");
    button.disabled = false; button.textContent = "Retry secure submission";
  }
}
function showThankYou({ title, message, reference = "" }) {
  setPanel("thank-you");
  $("thank-you-heading").textContent = title;
  $("thank-you-message").textContent = message;
  $("submission-reference").textContent = reference;
  $("submission-reference").hidden = !reference;
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
if (config.privacyNotice && !config.privacyNotice.includes("[Insert")) $("privacy-copy").textContent = config.privacyNotice;
const status = document.querySelector(".header-status");
if (TEST_MODE) {
  $("environment-badge").textContent = "Technical preview · local only";
  $("consent-label").textContent = "I understand this is a technical preview only. My test responses will remain in this browser and will not be sent to the research database.";
  $("begin-survey").textContent = "Start test preview";
  $("submit-survey").textContent = "Finish test preview";
  $("submission-status").textContent = "Preview only: your eight scenario responses and final answers will be saved in this browser. They will not be sent to the research database.";
  $("new-preview").hidden = false;
  $("new-preview").textContent = "Start a new test preview";
  status?.classList.remove("collect-mode");
  showNotice("TECHNICAL PREVIEW — This version is for testing the simulator only. Responses are saved locally in this browser and are not sent to the research database. Do not use this link to recruit participants.", "info");
} else if (recruitmentReady) {
  $("environment-badge").textContent = "Research collection active";
  $("submission-status").textContent = "When you submit, all eight scenario responses and the final questionnaire will be securely sent together to the study database.";
  $("new-preview").hidden = true;
  status?.classList.add("collect-mode");
  $("approval-note").hidden = true;
} else {
  $("environment-badge").textContent = "Research collection unavailable";
  $("begin-survey").textContent = "Study not yet open";
  $("begin-survey").disabled = true;
  $("new-preview").hidden = true;
  status?.classList.remove("collect-mode");
  showNotice("Research collection is not enabled. The study team must complete the approved consent information and server configuration before participants can begin.", "error");
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
if (restoreDraftState()) $("consent-check").checked = true;
else setPanel("consent-panel");
refreshCanvasColors();
$("new-preview")?.addEventListener("click", () => {
  if (!TEST_MODE) return;
  removeDraft();
  try { localStorage.removeItem(TEST_STORAGE_KEY); } catch { /* local test storage may be unavailable */ }
  location.href = location.pathname + "?test=1";
});
requestAnimationFrame(animateFrame);
