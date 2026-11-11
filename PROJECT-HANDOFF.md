# Project handoff

## Live project

- Repository: https://github.com/just254q/neonatal-breathing-sim
- Participant site: https://just254q.github.io/neonatal-breathing-sim/
- Administrator dashboard: https://just254q.github.io/neonatal-breathing-sim/admin.html
- Supabase project reference: `wpcgwnrtkcyldzxnorto`
- Supabase region: Mumbai, India (`ap-south-1`)

## Delivered

- Responsive participant information and consent interface.
- Eight randomized neonatal breathing scenarios.
- Animated newborn model and respiratory-rate history graph.
- 30-second live observation per scenario.
- Green/yellow/red assessment controls and timestamped rating changes.
- Per-scenario confidence, realism and comment questions.
- Final questionnaire.
- Database-backed test mode for completed runs, plus an explicitly local-only `?test=1` sandbox.
- Supabase database schema, row-level security and secure submission Edge Function.
- Authenticated, allow-listed administrator dashboard with summaries, filters, CSV export and Excel export.
- Automated tests and GitHub Pages deployment workflow.

## Infrastructure status

- GitHub Pages is enabled and deployments have succeeded.
- Supabase project `neonatal-breathing-study` is active.
- Schema migration `initial_neonatal_survey_schema` is applied.
- `public.submissions` and `public.study_admins` exist with RLS enabled.
- Edge Function `submit-survey` is deployed.
- Administrator Auth user `jmogire93@gmail.com` exists and is on the allow-list.
- While `RESEARCH_COLLECTION_ENABLED` is not `true`, the Edge Function accepts completed runs only as test records and sets `is_test=true` server-side.
- Once research collection is enabled, the endpoint requires the exact `APPROVED_CONSENT_VERSION` from the approved study materials.
- Public `config.js` currently sets `researchCollectionEnabled: false` and `databaseTestMode: true`; consent and ethics placeholders remain.

## Research release state

**Official research data collection is not open.** The main participant site stores completed runs in Supabase as test records. The optional `?test=1` route remains local-only. The Edge Function will not create official research records until faculty/ethics approval, data-location approval, clinical review, final consent wording and server-side release settings are confirmed.

## Remaining owner tasks

1. Confirm permission and attribution for source/design material derived from the teammate's project.
2. Obtain faculty/ethics approval for the participant information sheet and consent text.
3. Complete the study title, investigator contact, ethics contact, approval number, privacy notice, provider-log handling, storage location, retention and withdrawal text.
4. Confirm neonatal-clinical review of each simulated breathing pattern.
5. Agree the exact consent version identifier.
6. Have the institutional data protection/security contact review RLS, endpoint validation, hosting and cross-border data storage.
7. Set Edge Function secrets `RESEARCH_COLLECTION_ENABLED=true` and `APPROVED_CONSENT_VERSION=<exact version>` only after written approval.
8. Change `researchCollectionEnabled` to true and deploy the public config only after the approved details are final.
9. End-to-end test against a separate test environment, including all eight scenarios, retry/idempotency, dashboard access and export.
10. Open recruitment only after release sign-off.

## Credential handling

Do not put administrator passwords, Supabase secret keys, service-role keys or database passwords into GitHub or browser configuration. The public site contains only the Supabase publishable key, which is intended for browser use.
