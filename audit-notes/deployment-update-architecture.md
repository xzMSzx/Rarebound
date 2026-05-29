# Update / Deployment Preparation Architecture

As part of the Rarebound 1.7.9 transaction safety upgrade, we are preparing the infrastructure for future over-the-air (OTA) update detection. 

## Version Source

The authoritative version source currently lives in `artifacts/msge-lite/data/settingsManager.js`:
```js
export const APP_VERSION = '1.7.9';
```

## Future Implementation (`version.json`)

To support seamless updates across Vercel or other cloud deployments without relying on manual page reloads:
1. **Host a `version.json` file**: During the build step (e.g. Vite build), generate a `public/version.json` file containing the current `package.json` version and a build hash.
2. **Polling Mechanism**: Implement a silent background poll (e.g., every 5-15 minutes) or check on visibility-change (when the player returns to the tab). 
3. **Fetch Strategy**: The client fetches `/version.json?t=<timestamp>` to bust the cache.

## Deployment Notifications

If a new version is detected:
- **Soft Update**: Display a subtle toast or utility dock badge indicating "Update Available. Tap to refresh."
- **Hard Update (Critical)**: If the version indicates a breaking schema change (e.g. 2.0.0), render a blocking modal requiring the player to refresh to preserve economy integrity.
- **Service Worker Integration**: If Rarebound becomes a PWA with a Service Worker, we can hook into the `updatefound` event of the Service Worker registration to prompt the user.

This prepares the game to gracefully handle background updates without corrupting active pack sessions.