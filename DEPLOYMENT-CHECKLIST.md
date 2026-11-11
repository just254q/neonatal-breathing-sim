# Deployment checklist

## Hosting and ownership
- [ ] Confirm permission/attribution for the source and design elements derived from the teammate's project.
- [ ] Confirm this repository is owned by the research owner/institution.
- [ ] In Settings → Pages, set Build and deployment source to GitHub Actions.
- [ ] Confirm the Actions workflow succeeds and open the Pages URL.

## Faculty and clinical review
- [ ] Approve the information sheet and consent wording.
- [ ] Insert study title, researcher contact, ethics contact and approval reference in `config.js`.
- [ ] Approve data retention, storage jurisdiction, provider logs and withdrawal wording.
- [ ] Have neonatal clinicians review each simulated rate, trajectory, see-saw pattern and pause.

## Secure data collection (not configured in this preview)
- [ ] Provision a Supabase project under owner/institution control in the approved region.
- [ ] Apply and review the database migration.
- [ ] Implement and deploy a server-side submission Edge Function with strict payload validation.
- [ ] Keep all service-role/secret keys in server-side secrets only.
- [ ] Configure the browser with only the intended public project key after review.
- [ ] Create named administrator accounts and apply the administrator allow-list.
- [ ] Verify anonymous users cannot read submissions and non-admin users cannot access the dashboard.
- [ ] Test database persistence, idempotency, error recovery and export outputs against a separate test project.

## Release
- [ ] Remove preview-only warning only after all required gates pass.
- [ ] Complete end-to-end desktop and mobile tests.
- [ ] Recruit participants only after required ethics and institutional approval.
