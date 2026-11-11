# Newborn Breathing Observation Survey

A browser-based neonatal breathing observation simulator with eight randomized scenarios, intended for technical preview and later faculty-approved research deployment.

## Current deployment status

This is a **technical preview only**. The public `config.js` intentionally contains no Supabase URL or public key, and its consent information still contains faculty-approval placeholders. The site therefore automatically uses local test mode. Responses are saved only in browser local storage; no research data are submitted to a server.

**Do not use this preview for nurse recruitment or official research data collection.** Before recruitment, the study team must obtain faculty/ethics approval, approve the consent text and data-location statement, review the simulated stimuli with neonatal clinicians, provision an owner-controlled database and secure submission endpoint, configure authentication and administrator access, and complete end-to-end security tests.

## Features

- Eight randomized newborn scenarios with stable identifiers and different respiratory-rate patterns.
- Animated newborn illustration, breathing movement, rolling respiratory-rate history, usual-rate dashed baseline and seesaw indicator.
- Eight-minute history and 30-second live observation per scenario.
- Green/yellow/red rating selection with timestamped changes, confidence, realism feedback and free-text comments.
- Final respiratory-rate threshold questionnaire and local draft recovery.
- Administrator dashboard shell with filtering, charts and CSV/XLSX exports. It requires a separately configured Supabase project and an allow-listed administrator account; it will not show research data in this preview.
- GitHub Actions workflow for automatic GitHub Pages deployment.

## Open the site

After the GitHub Pages workflow completes, the technical preview will be available at:

`https://just254q.github.io/neonatal-breathing-sim/`

The dashboard shell is at:

`https://just254q.github.io/neonatal-breathing-sim/admin.html`

## Local run and tests

Requires Node.js 20+ and Python 3.

```bash
npm test
npm run serve
```

Open `http://localhost:8080/?test=1`. Test submissions remain in local browser storage.

## Project structure

- `index.html`: participant information, consent and eight-scenario survey flow.
- `js/scenarios.js`: scenario definitions, metadata and randomization.
- `js/simulator.js`: breathing engine, baby animation and graph rendering.
- `js/app.js`: survey flow, response events, local draft storage and test-mode completion.
- `admin.html`, `js/admin.js`, `css/admin.css`: authenticated dashboard interface.
- `config.js`: public frontend configuration placeholders only.
- `supabase/migrations/001_schema.sql`: draft database schema and access-control policies for future owner-managed setup.
- `tests/`: automated local logic and structure tests.
- `.github/workflows/pages.yml`: static-site deployment workflow.

## Safety and data security

- Never place a Supabase service-role key or any secret in this repository or in browser JavaScript.
- The administrator dashboard relies on Supabase authentication plus a database administrator allow-list. A hidden page URL is not an access control.
- The database migration is not a deployed backend. No submission Edge Function has been deployed or connected in this repository.
- The respiratory scenarios are experimental stimuli, not validated clinical thresholds, diagnostic tools, or clinical advice. Obtain neonatal-clinical review before research use.

## Provenance

This is a separately hosted project package. The original teammate-owned repository `iyanuoj-cloud/Clinician-rating-sim_v1` has not been modified. Confirm the original author's permission and any required attribution before public redistribution or research use.
