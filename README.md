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

The app is designed to be deployed on a static host such as Netlify. To make it installable as a PWA:

1. Deploy the contents of `dist/` to your hosting provider (for Netlify, push to the connected Git repository or drag the folder into the dashboard).
2. Visit the deployed site in a modern browser (Android Chrome, iOS Safari, or desktop Chromium browsers).
3. Open the **PWA** tab inside the app and use the download buttons to grab `manifest.webmanifest`, `sw.js`, and the icon assets. Upload these files to the root of your site alongside `index.html`.
4. Refresh the deployed site, then use your browser's “Add to Home screen” / “Install app” option to install it like a native app.

The generated service worker caches the app shell for offline use. When you publish a new build, re-download the PWA files so that the cache version stays in sync.

## Running the built-in diagnostics

Inside the app, switch to the **Diagnostics** tab and click **Run tests** to execute the lightweight runtime checks that validate the `.ics` utilities.

