# Family Appointment Manager

This project is a small Vite + React single-page app for keeping track of appointments for a family. It includes quality-of-life tooling such as local filtering, .ics export/import, and helpers for bundling the web app as an installable Progressive Web App (PWA).

## Getting started

```bash
npm install
npm run dev
```

Open the development server URL that Vite prints (usually `http://localhost:5173`) to work on the app locally.

## Building for production

```bash
npm run build
```

Vite outputs a static production build into the `dist/` folder. You can preview it locally by running:

```bash
npm run preview
```

## Deploying as a website or PWA

The app is designed to be deployed on a static host such as Netlify. The repository now ships with a GitHub Actions workflow that builds the site and (optionally) deploys it to Netlify on every push to `main` or for pull request previews.

### Configure automated Netlify deployments

1. In Netlify, create a new site and note its **Site ID**. Generate a personal access token from the **User settings → Applications** area.
2. In your GitHub repository settings, add the following secrets so the workflow can authenticate with Netlify:
   - `NETLIFY_SITE_ID`
   - `NETLIFY_AUTH_TOKEN`
3. Push to `main` to trigger a production deployment (`netlify deploy --prod`). Pull requests automatically receive preview URLs using the same workflow.

If you prefer to deploy manually:

1. Run `npm run build` locally to emit a static build in `dist/`.
2. Deploy the contents of `dist/` to your hosting provider (for Netlify, drag the folder into the dashboard).
3. Visit the deployed site in a modern browser (Android Chrome, iOS Safari, or desktop Chromium browsers).
4. Open the **PWA** tab inside the app and use the download buttons to grab `manifest.webmanifest`, `sw.js`, and the icon assets. Upload these files to the root of your site alongside `index.html`.
5. Refresh the deployed site, then use your browser's “Add to Home screen” / “Install app” option to install it like a native app.

The generated service worker caches the app shell for offline use. When you publish a new build, re-download the PWA files so that the cache version stays in sync.

## Running the built-in diagnostics

Inside the app, switch to the **Diagnostics** tab and click **Run tests** to execute the lightweight runtime checks that validate the `.ics` utilities.

