const $ = id => document.getElementById(id);
const config = window.APP_CONFIG || {};
const supabaseReady = Boolean(config.supabaseUrl && config.supabasePublishableKey && window.supabase?.createClient);
const supabase = supabaseReady ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey) : null;

let submissions = [];
let ratingChart = null;
let confidenceChart = null;

function notice(message, type = "info") {
  const element = $("admin-notice");
  element.textContent = message;
  element.className = `notice ${type}`;
  element.hidden = false;
}
function hideNotice() {
  $("admin-notice").hidden = true;
}
function safeText(value) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}
function timeText(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
function percentage(count, total) {
  return total ? `${(100 * count / total).toFixed(1)}%` : "—";
}
function appendCell(row, value, className = "") {
  const cell = document.createElement("td");
  cell.textContent = safeText(value);
  if (className) cell.className = className;
  row.appendChild(cell);
}
function emptyRow(body, columns, message) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = columns;
  cell.textContent = message;
  cell.className = "empty-cell";
  row.appendChild(cell);
  body.appendChild(row);
}
function allResponses(rows = submissions) {
  const flattened = [];
  for (const submission of rows) {
    const responseRows = Array.isArray(submission.responses) ? submission.responses : [];
    for (const response of responseRows) {
      flattened.push({
        submission_id: submission.id,
        participant_id: submission.participant_id,
        submitted_at: submission.submitted_at,
        clinical_role: submission.clinical_role,
        neonatal_experience: submission.neonatal_experience,
        presentation_order: submission.presentation_order,
        ...response
      });
    }
  }
  return flattened;
}
function currentFilters() {
  const selectedScenario = $("filter-baby").value;
  const selectedRating = $("filter-rating").value;
  return allResponses().filter(response =>
    (selectedScenario === "all" || response.scenario_id === selectedScenario) &&
    (selectedRating === "all" || response.final_rating === selectedRating)
  );
}
function countByColor(rows, color, field = "final_rating") {
  return rows.filter(row => row[field] === color).length;
}
function ratingTimeline(events) {
  if (!Array.isArray(events) || events.length === 0) return "—";
  return events.map(event => {
    const color = safeText(event.color).toUpperCase();
    const seconds = Number(event.live_seconds);
    const elapsed = Number.isFinite(seconds) ? `${seconds.toFixed(1)} s` : "time unavailable";
    return `${color} at ${elapsed} (${timeText(event.timestamp)})`;
  }).join(" → ");
}
function renderScenarioTable() {
  const rows = currentFilters();
  const selectedScenario = $("filter-baby").value;
  const body = $("scenario-table").querySelector("tbody");
  body.replaceChildren();

  let visible = 0;
  for (let cot = 1; cot <= 8; cot += 1) {
    const id = `baby-${String(cot).padStart(2, "0")}`;
    if (selectedScenario !== "all" && selectedScenario !== id) continue;
    const group = rows.filter(row => row.scenario_id === id);
    visible += group.length;
    const initialGreen = countByColor(group, "green", "first_rating");
    const initialYellow = countByColor(group, "yellow", "first_rating");
    const initialRed = countByColor(group, "red", "first_rating");
    const finalGreen = countByColor(group, "green");
    const finalYellow = countByColor(group, "yellow");
    const finalRed = countByColor(group, "red");
    const confidenceValues = group.map(row => Number(row.confidence)).filter(Number.isFinite);
    const average = confidenceValues.length
      ? (confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(2)
      : "—";
    const changed = group.filter(row => Number(row.selection_change_count || 0) > 0).length;
    const realism = group.filter(row => row.unrealistic_baby === true).length;
    const row = document.createElement("tr");
    appendCell(row, `Scenario ${cot}`);
    appendCell(row, cot);
    appendCell(row, `${initialGreen} (${percentage(initialGreen, group.length)})`);
    appendCell(row, `${initialYellow} (${percentage(initialYellow, group.length)})`);
    appendCell(row, `${initialRed} (${percentage(initialRed, group.length)})`);
    appendCell(row, `${finalGreen} (${percentage(finalGreen, group.length)})`);
    appendCell(row, `${finalYellow} (${percentage(finalYellow, group.length)})`);
    appendCell(row, `${finalRed} (${percentage(finalRed, group.length)})`);
    appendCell(row, average);
    appendCell(row, `${changed} (${percentage(changed, group.length)})`);
    appendCell(row, `${realism} (${percentage(realism, group.length)})`);
    body.appendChild(row);
  }
  if (!visible) emptyRow(body, 11, "No responses match the selected filters.");
}
function destroyChart(chart) {
  if (chart) chart.destroy();
}
function renderCharts() {
  if (!submissions.length || typeof Chart === "undefined") {
    destroyChart(ratingChart); ratingChart = null;
    destroyChart(confidenceChart); confidenceChart = null;
    return;
  }
  const rows = currentFilters();
  const selectedScenario = $("filter-baby").value;
  const cotNumbers = selectedScenario === "all"
    ? [1, 2, 3, 4, 5, 6, 7, 8]
    : [Number(selectedScenario.split("-")[1])];
  const labels = cotNumbers.map(cot => `Cot ${cot}`);
  const selectedRating = $("filter-rating").value;
  const colors = ["green", "yellow", "red"];
  const palette = { green: "#27834e", yellow: "#a87810", red: "#b83d3b" };
  const visibleColors = selectedRating === "all" ? colors : [selectedRating];
  const ratingDatasets = visibleColors.map(color => ({
    label: color[0].toUpperCase() + color.slice(1),
    backgroundColor: palette[color],
    borderRadius: 5,
    data: cotNumbers.map(cot => rows.filter(row =>
      row.scenario_id === `baby-${String(cot).padStart(2, "0")}` && row.final_rating === color
    ).length)
  }));

  destroyChart(ratingChart);
  ratingChart = new Chart($("rating-chart"), {
    type: "bar",
    data: { labels, datasets: ratingDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#e7eef0" } }
      },
      plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, font: { size: 10 } } } }
    }
  });

  const confidenceMeans = cotNumbers.map(cot => {
    const values = rows.filter(row => row.scenario_id === `baby-${String(cot).padStart(2, "0")}`)
      .map(row => Number(row.confidence)).filter(Number.isFinite);
    return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null;
  });
  destroyChart(confidenceChart);
  confidenceChart = new Chart($("confidence-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Mean confidence (1–5)",
        backgroundColor: "#176b78",
        borderRadius: 6,
        maxBarThickness: 35,
        data: confidenceMeans
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 5, ticks: { stepSize: 1 }, grid: { color: "#e7eef0" } },
        x: { grid: { display: false } }
      },
      plugins: { legend: { display: false } }
    }
  });
}
function renderFilteredResponses() {
  const rows = currentFilters().sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  const body = $("response-table").querySelector("tbody");
  body.replaceChildren();
  if (!rows.length) {
    emptyRow(body, 11, "No individual responses are available for the selected filters.");
    return;
  }
  for (const response of rows) {
    const row = document.createElement("tr");
    appendCell(row, timeText(response.submitted_at));
    appendCell(row, response.participant_id);
    appendCell(row, `${response.scenario_id} / Cot ${response.cot_number}`);
    appendCell(row, response.first_rating);
    appendCell(row, response.final_rating);
    appendCell(row, response.selection_change_count ?? Math.max(0, (response.rating_events || []).length - 1));
    appendCell(row, ratingTimeline(response.rating_events), "comment-cell");
    appendCell(row, response.confidence);
    appendCell(row, response.unrealistic_baby ? "Realism concern flagged" : "Not flagged");
    appendCell(row, response.additional_information_needed, "comment-cell");
    appendCell(row, response.comments, "comment-cell");
    body.appendChild(row);
  }
}
function renderFinalQuestionnaire() {
  const body = $("final-table").querySelector("tbody");
  body.replaceChildren();
  const rows = [...submissions].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  if (!rows.length) {
    emptyRow(body, 6, "No final questionnaire responses have been submitted yet.");
    return;
  }
  for (const submission of rows) {
    const q = submission.final_questions || {};
    const row = document.createElement("tr");
    appendCell(row, timeText(submission.submitted_at));
    appendCell(row, submission.participant_id);
    appendCell(row, q.elevated_rate_concern_threshold);
    appendCell(row, q.reduced_rate_concern_threshold);
    appendCell(row, q.concern_duration_after_return_to_baseline);
    appendCell(row, q.other_comments, "comment-cell");
    body.appendChild(row);
  }
}
function renderStats() {
  const rows = allResponses();
  const changed = submissions.filter(submission =>
    (submission.responses || []).some(response => Number(response.selection_change_count || 0) > 0)
  ).length;
  const confidence = rows.map(row => Number(row.confidence)).filter(Number.isFinite);
  $("total-submissions").textContent = String(submissions.length);
  $("total-responses").textContent = String(rows.length);
  $("changed-submissions").textContent = `${changed} (${percentage(changed, submissions.length)})`;
  $("average-confidence").textContent = confidence.length
    ? (confidence.reduce((sum, value) => sum + value, 0) / confidence.length).toFixed(2)
    : "—";
}
function populateScenarioFilter() {
  const select = $("filter-baby");
  if (select.options.length > 1) return;
  for (let cot = 1; cot <= 8; cot += 1) {
    const option = document.createElement("option");
    option.value = `baby-${String(cot).padStart(2, "0")}`;
    option.textContent = `Scenario ${cot}`;
    select.appendChild(option);
  }
}
function renderAll() {
  renderStats();
  renderScenarioTable();
  $("empty-state").hidden = submissions.length > 0;
  $("chart-grid").hidden = submissions.length === 0;
  if (submissions.length) renderCharts();
  else {
    destroyChart(ratingChart); ratingChart = null;
    destroyChart(confidenceChart); confidenceChart = null;
  }
  renderFilteredResponses();
  renderFinalQuestionnaire();
  $("last-updated").textContent = `Updated ${new Date().toLocaleString()}`;
}
async function loadAllRows() {
  if (!supabase) throw new Error("The dashboard connection is not configured.");
  const allRows = [];
  let start = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.from("submissions")
      .select("*")
      .order("submitted_at", { ascending: false })
      .range(start, start + pageSize - 1);
    if (error) throw error;
    allRows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    start += pageSize;
  }
  submissions = allRows.filter(row => row.is_test !== true);
  renderAll();
}
function flattenForExport() {
  return allResponses().map(response => ({
    submission_id: response.submission_id,
    participant_session_id: response.participant_id,
    submitted_at: response.submitted_at,
    clinical_role: response.clinical_role,
    neonatal_experience: response.neonatal_experience,
    presentation_order: Array.isArray(response.presentation_order) ? response.presentation_order.join(" > ") : response.presentation_order,
    scenario_id: response.scenario_id,
    cot_number: response.cot_number,
    baseline_rr: response.baseline_rr,
    programmed_current_rr: response.programmed_current_rr,
    simulated_pattern: response.simulated_pattern,
    trajectory: response.trajectory,
    seesaw_pattern: response.seesaw_pattern,
    pauses: JSON.stringify(response.pauses || []),
    first_rating: response.first_rating,
    rating_events: JSON.stringify(response.rating_events || []),
    final_rating: response.final_rating,
    final_rating_confirmed_at: response.final_rating_confirmed_at,
    selection_change_count: response.selection_change_count,
    confidence: response.confidence,
    unrealistic_baby: response.unrealistic_baby,
    additional_information_needed: response.additional_information_needed,
    comments: response.comments
  }));
}
function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCsv() {
  const rows = flattenForExport();
  if (!rows.length) {
    notice("There are no non-test research responses to export.", "info");
    return;
  }
  const columns = Object.keys(rows[0]);
  const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [
    columns.map(quote).join(","),
    ...rows.map(row => columns.map(column => quote(row[column])).join(","))
  ].join("\r\n");
  downloadBlob("\ufeff" + csv, "neonatal-breathing-survey-results.csv", "text/csv;charset=utf-8");
  notice("Your CSV export has been prepared.", "success");
}
function exportExcel() {
  const responses = flattenForExport();
  if (!responses.length) {
    notice("There are no non-test research responses to export.", "info");
    return;
  }
  if (typeof XLSX === "undefined") {
    notice("The Excel export library did not load. Please retry or use the CSV export.", "error");
    return;
  }
  const summary = submissions.map(submission => ({
    submission_id: submission.id,
    participant_session_id: submission.participant_id,
    submitted_at: submission.submitted_at,
    clinical_role: submission.clinical_role,
    neonatal_experience: submission.neonatal_experience,
    presentation_order: Array.isArray(submission.presentation_order) ? submission.presentation_order.join(" > ") : submission.presentation_order,
    final_questions: JSON.stringify(submission.final_questions || {}),
    consent_version: submission.consent_version,
    client_version: submission.client_version
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), "Submissions");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(responses), "Scenario responses");
  XLSX.writeFile(workbook, "neonatal-breathing-survey-results.xlsx");
  notice("Your Excel workbook has been prepared.", "success");
}
function showLogin() {
  $("login-panel").hidden = false;
  $("dashboard").hidden = true;
  $("logout").hidden = true;
}
function showDashboard() {
  $("login-panel").hidden = true;
  $("dashboard").hidden = false;
  $("logout").hidden = false;
}
async function checkAdmin() {
  if (!supabase) return false;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const user = data?.user;
  if (!user) {
    showLogin();
    return false;
  }
  const { data: adminRow, error: allowListError } = await supabase
    .from("study_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (allowListError) throw allowListError;
  if (!adminRow) {
    await supabase.auth.signOut();
    showLogin();
    notice("This account is signed in but is not authorized to view this study. Ask the project owner to add it to the administrator allow-list.", "error");
    return false;
  }
  showDashboard();
  await loadAllRows();
  return true;
}

if (!supabaseReady) {
  notice("The dashboard connection is not configured. Check the public Supabase project URL and publishable key in config.js.", "error");
  $("login-form").addEventListener("submit", event => event.preventDefault());
} else {
  $("login-form").addEventListener("submit", async event => {
    event.preventDefault();
    const button = $("login-form").querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Verifying account…";
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: $("admin-email").value.trim(),
        password: $("admin-password").value
      });
      if (error) {
        notice("Sign-in was not successful. Check the email and password, and confirm that the account belongs to this study's Supabase project.", "error");
        return;
      }
      await checkAdmin();
      $("admin-password").value = "";
    } catch (error) {
      notice("We could not open the administrator dashboard. Please retry. If the issue continues, contact the project owner.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "Sign in securely →";
    }
  });
  checkAdmin().catch(() => {
    showLogin();
    notice("We could not verify administrator access. Refresh the page and try again.", "error");
  });
}

$("logout").addEventListener("click", async () => {
  if (supabase) await supabase.auth.signOut();
  location.reload();
});
$("refresh").addEventListener("click", async () => {
  const button = $("refresh");
  button.disabled = true;
  button.textContent = "Refreshing…";
  try {
    await loadAllRows();
    notice("Research data have been refreshed.", "success");
  } catch {
    notice("We could not refresh the research data. Check your connection and administrator access, then retry.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "↻ Refresh";
  }
});
function applyFilters() {
  renderScenarioTable();
  renderCharts();
  renderFilteredResponses();
}
$("filter-baby").addEventListener("change", applyFilters);
$("filter-rating").addEventListener("change", applyFilters);
$("export-csv").addEventListener("click", exportCsv);
$("export-xlsx").addEventListener("click", exportExcel);
populateScenarioFilter();
