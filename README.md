# Neonatal Breathing Observation Study

A responsive browser-based simulator for a structured neonatal breathing observation task. The participant experience contains eight randomized scenarios, animated breathing, an eight-minute respiratory-rate history, a 30-second live observation, timestamped ratings, confidence and realism feedback, and a final questionnaire.

## Live project

- Participant site: https://just254q.github.io/neonatal-breathing-sim/
- Administrator dashboard: https://just254q.github.io/neonatal-breathing-sim/admin.html
- Source repository: https://github.com/just254q/neonatal-breathing-sim

## Current release state

The public website is deployed and the Supabase project is provisioned in Mumbai, India. The database schema and `submit-survey` Edge Function have been deployed. The administrator account `jmogire93@gmail.com` is on the study administrator allow-list.

**Research response collection remains disabled.** The public configuration deliberately keeps `researchCollectionEnabled: false`; the study title, ethics reference, contacts, retention wording and privacy statement still require faculty-approved values. The Edge Function also fails closed unless the server-side `RESEARCH_COLLECTION_ENABLED` and `APPROVED_CONSENT_VERSION` secrets are set. The current participant experience is therefore a technical preview and saves completed test records only in local browser storage.

Do not distribute the preview as a recruitment link or use it to collect research data before the required ethics, clinical and institutional approvals.

## Participant flow and data handling

1. The participant reviews the approved study information and gives consent.
2. The site creates a random session ID and assigns a randomized order of the eight fixed scenarios.
3. Each scenario records the initial rating, all rating-change events and timestamps, confirmed final rating, confidence, realism feedback, and optional comments.
4. After all eight scenarios, the participant completes the final respiratory-rate threshold questionnaire.
5. The site sends the complete eight-scenario response package as one submission to the `submit-survey` Edge Function. It does not send partial scenario responses as individual research submissions.
6. The Edge Function validates the anonymous session identifier, consent, exact eight-scenario permutation and order, scenario metadata, rating values, event timing and comment lengths. It inserts the submission using the server-side Supabase secret key.
7. The participant sees a database reference only after the server confirms the saved record. If submission fails, the completed draft remains in that browser for retry.
8. The administrator dashboard reads submissions only after Supabase authentication and a matching row in `public.study_admins`. Test records are excluded from research summaries.

The server derives the `is_test` flag from its own environment. A browser cannot mark a record as a test record.

## Supabase project

- Project: `neonatal-breathing-study`
- Project reference: `wpcgwnrtkcyldzxnorto`
- Region: `ap-south-1` (Mumbai, India)
- Project URL: `https://wpcgwnrtkcyldzxnorto.supabase.co`
- Frontend key: a Supabase publishable key in `config.js`. Publishable keys are intended for browser use.
- Database: `public.submissions` and `public.study_admins`, with row-level security enabled.
- Edge Function: `submit-survey`.

Never add a Supabase secret key, service-role key, database password or other privileged credential to GitHub or browser JavaScript.

### Server-side release gate

The Edge Function is intentionally closed by default. Before opening collection, the project owner must enter the following in Supabase Dashboard → Edge Functions → Secrets, using the exact approved consent version:

- `RESEARCH_COLLECTION_ENABLED=true`
- `APPROVED_CONSENT_VERSION=<exact approved consent version>`

The matching public `config.js` must then be updated with the faculty-approved study title, contact details, ethics approval/reference, privacy notice, storage and retention statement, the same `consentVersion`, and `researchCollectionEnabled: true`. The frontend and backend settings must be reviewed together before recruitment begins. Do not switch these settings on with draft or placeholder consent wording.

## Administrator access

Open the private dashboard link and sign in with a Supabase Auth account added to `public.study_admins`. The current administrator account is `jmogire93@gmail.com`. Do not share administrator passwords. Add or remove administrators by changing the allow-list through an owner-controlled and audited process.

The dashboard supports scenario comparisons, rating and confidence summaries, response-level review, final questionnaire review, CSV export and a two-sheet Excel export.

## Local development and tests

Requires Node.js 20+ and Python 3.

```bash
npm test
npm run serve
```

Open `http://localhost:8080/?test=1`. Test responses stay in local browser storage and are not sent to Supabase.

## Project structure

- `index.html`: participant information, consent, scenario instructions and questionnaire.
- `css/styles.css`: participant design system and responsive layout.
- `js/scenarios.js`: eight stable scenario definitions, metadata and randomization.
- `js/simulator.js`: breathing engine, newborn animation and respiratory-rate graph.
- `js/app.js`: participant workflow, timestamps, local draft recovery and submission handoff.
- `admin.html`, `js/admin.js`, `css/admin.css`: authenticated research dashboard and exports.
- `config.js`: public URL, publishable key and study release settings only.
- `supabase/migrations/001_schema.sql`: database schema and row-level security policies.
- `supabase/functions/submit-survey/index.ts`: validated server-side submission handler with a research-activation gate.
- `tests/`: simulator, scenario and project-structure tests.
- `.github/workflows/pages.yml`: GitHub Pages deployment after tests pass.

## Research and clinical safeguards

- The respiratory scenarios are experimental stimuli, not clinical thresholds, diagnosis or guidance.
- Obtain neonatal-clinical review of all scenarios and simulated patterns before research use.
- Confirm the institution's approval of the Mumbai data location, hosting/provider log handling, access roles, retention and withdrawal procedures.
- Do not collect patient-identifying information. Review all optional free-text fields and the participant information sheet.
- Test data persistence and export using a separate test environment before production recruitment. Do not create synthetic records in the live research database.

## Provenance

This is a separately hosted project. The original repository `iyanuoj-cloud/Clinician-rating-sim_v1` has not been modified. Confirm the original author's permission and any required attribution before public redistribution or research use.
