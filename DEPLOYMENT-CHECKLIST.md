# Deployment and research-release checklist

## Hosting and ownership
- [x] Create a separate owner-controlled repository and GitHub Pages site.
- [x] Enable GitHub Pages through GitHub Actions.
- [x] Configure the public frontend with only the Supabase URL and publishable key.
- [ ] Confirm permission/attribution for source and design elements derived from the teammate's project.
- [ ] Confirm the institution/research owner has approved repository and hosting ownership.

## Supabase infrastructure
- [x] Create the dedicated Supabase project in the faculty-approved Mumbai region.
- [x] Apply the initial schema and row-level security policies.
- [x] Deploy the `submit-survey` Edge Function.
- [x] Create the administrator Auth user and add it to `public.study_admins`.
- [x] Ensure the Edge Function is closed by default and rejects submissions without server-side release settings.
- [ ] Independently review database schema, RLS, endpoint validation and administrator access with the institution's data/security contact.
- [ ] Confirm the institution's approval of the data region, hosting logs and any cross-border transfer arrangements.

## Faculty, ethics and neonatal-clinical review
- [ ] Approve the participant information sheet and consent wording.
- [ ] Insert the approved study title in `config.js`.
- [ ] Insert the principal investigator/researcher name and institutional contact.
- [ ] Insert the ethics committee contact and approval/reference number.
- [ ] Approve the privacy notice, including database location, provider logs, retention, access and withdrawal arrangements.
- [ ] Agree the exact consent version string (for example, an institution-assigned version identifier).
- [ ] Have neonatal clinicians review all simulated respiratory rates, trajectories, seesaw patterns and pause scenario.
- [ ] Confirm that the final questionnaire and all collected profile fields are necessary and approved.

## End-to-end verification before recruitment
- [ ] Test the complete participant journey on desktop and mobile in a separate test project/environment.
- [ ] Verify one complete eight-scenario submission creates one database row with all eight ordered responses and final questionnaire answers.
- [ ] Verify retry after a lost response does not create duplicate submissions.
- [ ] Verify browser preview data never reaches the database.
- [ ] Verify anonymous visitors cannot read submissions and authenticated non-admin users cannot read submissions.
- [ ] Verify the authorized administrator can log in, filter records and export CSV/Excel.
- [ ] Verify submission errors preserve the local draft and do not show a false success message.
- [ ] Complete the institution's data protection/security review and obtain written release approval.

## Open research collection only after all approvals
- [ ] In Supabase Dashboard → Edge Functions → Secrets, set `RESEARCH_COLLECTION_ENABLED=true`.
- [ ] Set `APPROVED_CONSENT_VERSION` to the exact consent version inserted in `config.js`.
- [ ] Set `researchCollectionEnabled: true` in the public `config.js`.
- [ ] Confirm all contact, ethics, privacy and retention fields are final and contain no placeholders.
- [ ] Confirm the participant page shows research collection active and the Edge Function accepts only the matching consent version.
- [ ] Publish the recruitment link only after the above checks are signed off.

**Current state:** the infrastructure is deployed, but participant research collection remains disabled. The public site is a technical preview and should not be used for recruitment.
