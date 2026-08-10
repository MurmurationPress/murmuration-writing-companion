# Backup, Preparation, and Recovery

## Prepare safely

Project Readiness is read-only. When preparation is available, MWC shows the exact proposed `type`, `parent`, and `manuscript_order_key` changes before writing. A blocked preview cannot be approved. Preparation preserves prose, filenames, folders, and unrelated frontmatter.

MWC verifies every write. If part of the operation fails, it rolls completed files back to their original bytes.

## Immediate Undo

After successful preparation, **Undo manuscript preparation** restores the original files exactly, including absent properties, formatting, line endings, and a removed legacy order list. Undo refuses to overwrite a file changed after preparation. Preserve the later work, restore the expected post-preparation state if appropriate, and retry while the in-session Undo remains available.

Immediate Undo is not a substitute for a backup.

## Back up the vault

Keep the whole vault under a backup system you trust. If using GitHub, make the repository private when the manuscript is unpublished, commit before structural work, and check the changed-file list before pushing. Obsidian Sync or another versioned backup can serve the same purpose.

On desktop, make the vault itself a Git repository and configure a remote using your normal Git tools. Git must be installed and available on `PATH`, and authentication must already work through SSH, Git Credential Manager, a credential helper, or another normal Git mechanism. MWC never asks for or stores GitHub credentials.

### First-time Git backup setup

Before MWC can back up a new vault, install Git on the desktop computer and create an empty remote repository—for example, a private GitHub repository for an unpublished manuscript. Do not initialise the remote with a README or other files if you want the first push to start from your existing vault.

Git also needs your author identity. These are normally one-time settings for your computer user account, not MWC settings:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Open a terminal, change to the vault folder, initialise the vault itself as the repository, and add the remote. For SSH authentication:

```bash
cd "/path/to/My Vault"
git init
git remote add origin git@github.com:USERNAME/REPOSITORY.git
```

HTTPS is an equally valid alternative when normal Git HTTPS authentication is configured on the computer:

```bash
git remote add origin https://github.com/USERNAME/REPOSITORY.git
```

MWC does not prefer one authentication method universally. Configure SSH keys, Git Credential Manager, or another standard Git credential helper outside MWC. Never put passwords, personal access tokens, or SSH private keys into MWC.

For the first backup:

1. Open **Settings → Murmuration Writing Companion → Vault backup**.
2. Confirm **Repository**, **Branch**, **Remote**, and **Remote URL**.
3. Select **Check backup configuration**.
4. When the check reports ready, run **Back up vault to GitHub** from the Command Palette or cloud-upload ribbon action.
5. MWC stages the vault, creates a dated commit when needed, and pushes the current branch.

For a new empty remote, MWC can make the first ordinary push of the current branch. It does not change persistent upstream configuration merely for convenience.

MWC does not create a GitHub account or remote repository, install Git, configure Git identity, or manage passwords, personal access tokens, or SSH keys. It also does not automatically pull, merge, rebase, reset, switch branches, force-push, or resolve conflicts. If the remote contains newer work or the histories have diverged, resolve that with Git outside MWC and run the configuration check again.

Open **Settings → Murmuration Writing Companion → Vault backup** to see the repository, current branch, selected remote, and remote URL detected from the current vault. Choose **Check backup configuration** to fetch deliberately and verify readiness. MWC selects `origin` when present, otherwise the only configured remote. If several non-`origin` remotes exist, choose one from the Remote list; MWC remembers only that remote name and asks again if it is later removed.

Run **Back up vault to GitHub** from the Command Palette or the cloud-upload ribbon action. MWC fetches the current branch, refuses remote-ahead or divergent history, stages vault changes, creates a dated backup commit when needed, and pushes the current branch. Despite the command's established name, ordinary SSH or HTTPS Git remotes are supported.

MWC never pulls, merges, rebases, resets, switches branches, force-pushes, or resolves conflicts. If the remote is ahead or histories diverge, resolve that state manually and check again. A vault nested inside a larger repository is also refused so unrelated parent files cannot be staged.

Older vaults may contain `Scripts/backup-vault.sh`. The script is no longer required, and MWC neither reads nor runs it. You may leave it untouched or run it independently if you deliberately choose to do so.

Authoritative manuscript and Story World data stays in Markdown. Portable editorial information lives under `.murmuration/writing-companion/`; include it in private backups if you want Chapter Notes, annotations, histories, and dispositions to travel with the vault. Local interface preferences may remain local.

Reinstalling the plugin should not rewrite source notes. Install matching `main.js`, `manifest.json`, and `styles.css` from one official release.

## Recover

For an interrupted operation, inspect the backup or version-control diff first. Reopen Project Readiness and analyse again. Do not bulk-delete structural metadata or force an old snapshot over newer prose. See [Troubleshooting](Troubleshooting.md) and the deeper [preparation contract](../docs/prepare-existing-manuscript.md).
