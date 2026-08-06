# Murmuration Writing Companion 0.17.1

This patch restores the no-write clean-start contract introduced in V2.

## Fixed

- Opening the plugin in a clean vault no longer creates an empty `.murmuration/writing-companion/editorial-data.json`.
- Read-only startup, Project Readiness, Writing Companion, manuscript and Story World views remain storage-free.
- Editorial storage is created only after the first genuine editorial mutation.
- Existing storage loading, migration, recovery and save behaviour remain unchanged.

For a manual upgrade, replace all three plugin files together:

- `main.js`
- `manifest.json`
- `styles.css`
