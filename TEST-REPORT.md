# Test and verification report

**Build:** 0.2.1  
**Review date:** 11 November 2026

## Automated checks

The local Node.js test suite completed with **18 passed, 0 failed**. The suite covers:

- Eight stable scenario IDs and cot/baseline mapping.
- Scenario respiratory-rate trajectories and randomization.
- Eight-minute history generation and breathing-engine time progression.
- Breath-event rates for the first seven scenarios.
- Seesaw patterns and the Baby 8 interruption/resumption behavior.
- Participant page controls and unique HTML IDs.
- Public configuration and the absence of privileged keys.
- Database row-level security and service-role-only submission RPC.
- Edge Function payload checks and owner-controlled test-mode flag.
- Local-only preview submission path.
- GitHub Pages workflow publishing only frontend assets.

The GitHub Actions deployment workflow runs `npm test` before preparing the Pages artifact.

## Not verified

- Real browser interaction on desktop and physical mobile devices has not been certified in this environment.
- The GitHub Pages deployment is pending the merge to `main` and repository Pages configuration.
- Supabase project creation, Edge Function deployment, database persistence, authentication, RLS and administrator dashboard access have not been end-to-end tested.
- No faculty/ethics approval or neonatal-clinical validation has been provided.

## Release boundary

This repository is a technical preview. The public `config.js` has blank Supabase credentials and draft consent placeholders, so the participant app automatically selects local-only test mode. A preview response is stored in browser local storage and is not transmitted to a research database.

Do not recruit nurses or collect official research responses until faculty/ethics approval, clinical review, data residency approval, server-side submission configuration, administrator access and live security tests are complete.
