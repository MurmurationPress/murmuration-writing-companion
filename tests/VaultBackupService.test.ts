import { deepEqual, equal } from "node:assert/strict";
import * as path from "node:path";
import { test } from "node:test";
import {
  resolveVaultBackupScript,
  VaultBackupExecution,
  VaultBackupService
} from "../src/backup/VaultBackupService";

const vaultPath = path.resolve("vaults", "PRIME Trilogy");
const scriptPath = path.join(vaultPath, "Scripts", "backup-vault.sh");
const adapter = { getBasePath: () => vaultPath };
const accessible = async () => {};

function service(execution: VaultBackupExecution) {
  return new VaultBackupService(adapter, {
    canAccess: accessible,
    execute: async () => execution
  });
}

test("resolves the backup script relative to the current vault", () => {
  deepEqual(resolveVaultBackupScript(adapter), {
    vaultPath,
    scriptPath
  });
});

test("rejects adapters without a desktop filesystem base path", async () => {
  equal((await new VaultBackupService({}).run()).kind, "unsupported");
  equal((await new VaultBackupService({ getBasePath: () => "relative/vault" }).run()).kind, "unsupported");
});

test("reports a missing vault-local script without executing it", async () => {
  let executions = 0;
  const result = await new VaultBackupService(adapter, {
    canAccess: async () => { throw new Error("ENOENT"); },
    execute: async () => { executions += 1; return { stdout: "", stderr: "", exitCode: 0 }; }
  }).run();
  equal(result.kind, "missing_script");
  equal(result.scriptPath, scriptPath);
  equal(executions, 0);
});

test("captures successful script output and execution location", async () => {
  let invocation: string[] = [];
  const result = await new VaultBackupService(adapter, {
    canAccess: accessible,
    execute: async (scriptPath, cwd) => {
      invocation = [scriptPath, cwd];
      return { stdout: "PRIME Trilogy vault backup complete.\n", stderr: "", exitCode: 0 };
    }
  }).run();
  equal(result.kind, "success");
  equal(result.detail, "PRIME Trilogy vault backup complete.");
  deepEqual(invocation, [scriptPath, vaultPath]);
});

test("normalises no-change output", async () => {
  equal((await service({ stdout: "No vault changes to back up.\n", stderr: "", exitCode: 0 }).run()).kind, "no_changes");
});

test("normalises a remote-ahead failure and retains its actionable final line", async () => {
  const result = await service({
    stdout: "",
    stderr: "Backup stopped.\nGitHub has newer commits. Run: git pull --ff-only origin main\n",
    exitCode: 1
  }).run();
  equal(result.kind, "remote_ahead");
  equal(result.detail, "GitHub has newer commits. Run: git pull --ff-only origin main");
  equal(result.exitCode, 1);
});

test("normalises divergent history without attempting recovery", async () => {
  equal((await service({ stdout: "", stderr: "Local and remote branches have diverged.", exitCode: 2 }).run()).kind, "diverged");
});

test("reports generic non-zero exits with captured output", async () => {
  const result = await service({ stdout: "context\n", stderr: "Authentication failed\n", exitCode: 128 }).run();
  equal(result.kind, "failed");
  equal(result.detail, "Authentication failed");
  equal(result.stderr, "Authentication failed\n");
  equal(result.exitCode, 128);
});

test("suppresses concurrent plugin invocations", async () => {
  let finish!: (execution: VaultBackupExecution) => void;
  const pending = new Promise<VaultBackupExecution>((resolve) => { finish = resolve; });
  let executions = 0;
  const backup = new VaultBackupService(adapter, {
    canAccess: accessible,
    execute: async () => { executions += 1; return pending; }
  });

  const first = backup.run();
  await Promise.resolve();
  equal((await backup.run()).kind, "busy");
  equal(executions, 1);
  finish({ stdout: "Backup complete.", stderr: "", exitCode: 0 });
  equal((await first).kind, "success");
});
