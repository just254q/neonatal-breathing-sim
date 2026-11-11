# Project handoff

## Repository

- Owner: `just254q`
- Repository: `https://github.com/just254q/neonatal-breathing-sim`
- Participant Pages URL after successful deployment: `https://just254q.github.io/neonatal-breathing-sim/`
- Dashboard shell URL: `https://just254q.github.io/neonatal-breathing-sim/admin.html`

## Included

Participant survey interface, eight randomized scenarios, breathing engine and animation, respiratory-rate graph, timestamped rating-change events, local test mode, final questionnaire, administrator dashboard shell, database schema source, server-side submission Edge Function source, automated tests and GitHub Pages workflow.

## Current state

- Code is added on the deployment branch; merge to `main` and Pages configuration are required to publish.
- The Pages workflow runs the test suite before deployment.
- Current public config has blank Supabase credentials and draft consent details; the site operates in local-only preview mode.
- Supabase migration and Edge Function are source files only and have not been deployed.
- No live participant responses or administrator credentials have been stored in GitHub.

## Owner tasks before research use

1. Confirm permissions and attribution for any source/design material derived from the teammate's existing simulator.
2. Enable GitHub Pages using GitHub Actions and verify the workflow run.
3. Obtain faculty/ethics and neonatal-clinical review.
4. Create an institution-controlled Supabase project in the approved data region.
5. Apply and independently review the SQL migration.
6. Deploy the Edge Function, configure server-side secrets and validate the endpoint against a separate test database.
7. Add only approved administrators to the Supabase allow-list and test data access controls.
8. Replace the public configuration placeholders only with approved study details and the intended public anon key; never publish service-role or secret credentials.
9. Complete end-to-end desktop/mobile and submission tests before nurse recruitment.
