# GitHub Pages setup

This repository includes `.github/workflows/pages.yml`.

1. Open repository Settings → Pages.
2. Under Build and deployment, choose **GitHub Actions** as the source.
3. Open the Actions tab and confirm the **Deploy survey to GitHub Pages** workflow succeeds.
4. Participant preview URL: `https://just254q.github.io/neonatal-breathing-sim/`.
5. Dashboard shell: `https://just254q.github.io/neonatal-breathing-sim/admin.html`.

The workflow deploys only `index.html`, `admin.html`, `config.js`, `css/` and `js/`. It does not upload database migrations or backend functions to the public site.

This release is unconfigured and automatically runs in local test mode. Test responses stay in browser local storage. The preview link must not be used for nurse recruitment. Configure data storage and obtain faculty/ethics approval before any official collection. Never publish Supabase secret/service-role keys.
