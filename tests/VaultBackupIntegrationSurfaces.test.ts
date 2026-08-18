import { match, doesNotMatch } from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { test } from "node:test";

const root = process.cwd();

test("backup command and ribbon retain their established user-facing contract", async () => {
  const source = await readFile(path.join(root, "src/main.ts"), "utf8");
  match(source, /addRibbonIcon\("cloud-upload", "Back up vault to GitHub", backUpVault\)/u);
  match(source, /id: "back-up-vault-to-github",\s+name: "Back up vault to GitHub",\s+callback: backUpVault/u);
  match(source, /new VaultBackupService\(this\.app\.vault\.adapter, \{/u);
  match(source, /remoteOverride: \(\) => this\.vaultBackupRemotePreference\.get\(\)/u);
  match(source, /addRibbonIcon\("cloud-download", "Pull from Git", pullVaultFromGit\)/u);
  match(source, /id: "pull-vault-from-git",\s+name: "Pull from Git",\s+callback: pullVaultFromGit/u);
});

test("Settings presents detected backup state and an explicit configuration check", async () => {
  const source = await readFile(path.join(root, "src/companion/ContinuitySettingsTab.ts"), "utf8");
  for (const label of ["Vault backup", "Repository", "Branch", "Remote", "Remote URL", "Check backup configuration", "Git actions", "Pull from Git", "Back up vault to GitHub"]) {
    match(source, new RegExp(`"${label}"`, "u"));
  }
  match(source, /inspectVaultBackup\(\)/u);
  match(source, /checkVaultBackup\(\)/u);
  match(source, /pullVaultFromGit\(\)/u);
  match(source, /backUpVault\(\)/u);
  match(source, /vaultBackupRemoteOptions\(inspection\.remotes \?\? \[\]\)/u);
  match(source, /for \(const name of options\) dropdown\.addOption\(name, name\)/u);
  match(source, /case "detached_head": return "Detached HEAD"/u);
  match(source, /case "ambiguous_remote": return "Multiple remotes; no origin"/u);
});

test("backup persists no repository, branch, remote URL, or credential setting", async () => {
  const settings = await readFile(path.join(root, "src/companion/ContinuitySettingsTab.ts"), "utf8");
  const service = await readFile(path.join(root, "src/backup/VaultBackupService.ts"), "utf8");
  doesNotMatch(settings, /saveData|loadData|personal.?access.?token|password|private.?key|repositoryPath|branchSetting|remoteUrlSetting/iu);
  doesNotMatch(service, /saveData|loadData|personal.?access.?token|repositoryPath|branchSetting|remoteUrlSetting/iu);
  const preference = await readFile(path.join(root, "src/backup/VaultBackupRemotePreference.ts"), "utf8");
  doesNotMatch(preference, /repository|branch|url|credential|token|password|private.?key/iu);
});

test("the direct backup path contains no shell or legacy-script execution", async () => {
  const source = await readFile(path.join(root, "src/backup/VaultBackupService.ts"), "utf8");
  match(source, /execFile\("git"/u);
  doesNotMatch(source, /\bexec\(|backup-vault\.sh|flock|\/tmp|execFile\("(?:sh|bash)"/u);
});
