# Backup, Preparation, and Recovery

## Prepare safely

Project Readiness is read-only. When preparation is available, MWC shows the exact proposed `type`, `parent`, and `manuscript_order_key` changes before writing. A blocked preview cannot be approved. Preparation preserves prose, filenames, folders, and unrelated frontmatter.

MWC verifies every write. If part of the operation fails, it rolls completed files back to their original bytes.

## Immediate Undo

After successful preparation, **Undo manuscript preparation** restores the original files exactly, including absent properties, formatting, line endings, and a removed legacy order list. Undo refuses to overwrite a file changed after preparation. Preserve the later work, restore the expected post-preparation state if appropriate, and retry while the in-session Undo remains available.

Immediate Undo is not a substitute for a backup.

## Back up the vault

Keep the whole vault under a backup system you trust. If using GitHub, make the repository private when the manuscript is unpublished, commit before structural work, and check the changed-file list before pushing. Obsidian Sync or another versioned backup can serve the same purpose.

On desktop, **Back up vault to GitHub** runs the executable `Scripts/backup-vault.sh` supplied by your vault. That vault-local script—not MWC—defines the repository, branch, commit, and push behaviour. MWC reports failures but never pulls, merges, rebases, or resolves conflicts for you.

Authoritative manuscript and Story World data stays in Markdown. Portable editorial information lives under `.murmuration/writing-companion/`; include it in private backups if you want Chapter Notes, annotations, histories, and dispositions to travel with the vault. Local interface preferences may remain local.

Reinstalling the plugin should not rewrite source notes. Install matching `main.js`, `manifest.json`, and `styles.css` from one official release.

## Recover

For an interrupted operation, inspect the backup or version-control diff first. Reopen Project Readiness and analyse again. Do not bulk-delete structural metadata or force an old snapshot over newer prose. See [Troubleshooting](Troubleshooting.md) and the deeper [preparation contract](../docs/prepare-existing-manuscript.md).
