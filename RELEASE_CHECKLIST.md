# 0.13.0 Release Checklist

## Automated gate

- [ ] `npm ci`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run release:check`
- [ ] GitHub Actions succeeds on Ubuntu and Windows for the release PR head

## Existing Linux vault

- [ ] Open a chapter with existing portable editorial data
- [ ] Edit Title, POV, story date, chapter status, editorial pass and change summary
- [ ] Confirm frontmatter remains authoritative and no duplicate properties appear
- [ ] Add an annotation and navigate back to the manuscript extract
- [ ] Resolve and reopen an annotation
- [ ] Complete and reopen an editorial pass
- [ ] Switch chapters and reload Obsidian with collapsed-section state preserved
- [ ] Rename a test chapter and confirm all editorial data follows it
- [ ] Delete and recreate a test chapter and confirm its editorial data returns

## Windows Obsidian smoke test

- [ ] Copy `main.js`, `manifest.json` and `styles.css` into a Windows test vault plugin folder
- [ ] Enable Murmuration Writing Companion
- [ ] Open a chapter with existing portable editorial data
- [ ] Exercise Chapter Context editing
- [ ] Add, navigate, resolve and reopen an annotation
- [ ] Complete and reopen an editorial pass
- [ ] Restart Obsidian and confirm editorial data persists
- [ ] Confirm collapsed-section preferences persist locally
- [ ] Rename a test chapter and confirm editorial data follows it
- [ ] Delete and recreate a test chapter and confirm its editorial data returns

## Publish

- [ ] Merge the release PR only after explicit approval
- [ ] Create tag `0.13.0` from the merged release commit
- [ ] Push tag `0.13.0`
- [ ] Confirm the Publish release workflow succeeds
- [ ] Confirm GitHub release `0.13.0` uses `RELEASE_NOTES.md`
- [ ] Confirm `main.js`, `manifest.json` and `styles.css` are attached
- [ ] Download the published assets once and perform a clean manual install
