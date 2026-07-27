import * as path from "node:path";

export const VAULT_BACKUP_SCRIPT = "Scripts/backup-vault.sh";

export interface VaultFileSystemAdapter {
  getBasePath?: () => string;
}

export interface VaultBackupExecution {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export type VaultBackupResult = VaultBackupExecution & {
  kind:
    | "success"
    | "no_changes"
    | "busy"
    | "unsupported"
    | "missing_script"
    | "remote_ahead"
    | "diverged"
    | "failed";
  scriptPath?: string;
  detail?: string;
};

export type VaultBackupExecutor = (
  scriptPath: string,
  cwd: string
) => Promise<VaultBackupExecution>;

export interface VaultBackupServiceDependencies {
  canAccess?: (scriptPath: string) => Promise<void>;
  execute?: VaultBackupExecutor;
}

export function resolveVaultBackupScript(
  adapter: unknown
): { vaultPath: string; scriptPath: string } | null {
  if (!adapter || typeof (adapter as VaultFileSystemAdapter).getBasePath !== "function") return null;
  const vaultPath = (adapter as Required<VaultFileSystemAdapter>).getBasePath();
  if (!vaultPath || !path.isAbsolute(vaultPath)) return null;
  return { vaultPath, scriptPath: path.join(vaultPath, VAULT_BACKUP_SCRIPT) };
}

function finalLine(value: string): string | undefined {
  const lines = value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines[lines.length - 1];
}

function classify(execution: VaultBackupExecution, scriptPath: string): VaultBackupResult {
  const output = `${execution.stdout}\n${execution.stderr}`;
  const normalised = output.toLowerCase();
  const detail = finalLine(execution.stderr) ?? finalLine(execution.stdout);

  if (execution.exitCode === 0) {
    return {
      ...execution,
      kind: /no (?:vault )?changes|nothing to (?:commit|back up)|working (?:tree )?clean/u.test(normalised)
        ? "no_changes"
        : "success",
      scriptPath,
      detail
    };
  }

  if (/newer commits|remote(?: branch)? is ahead|behind .*origin|pull --ff-only/u.test(normalised)) {
    return { ...execution, kind: "remote_ahead", scriptPath, detail };
  }
  if (/diverg(?:ed|ent|ence)|non-fast-forward|have diverged/u.test(normalised)) {
    return { ...execution, kind: "diverged", scriptPath, detail };
  }
  return { ...execution, kind: "failed", scriptPath, detail };
}

export const executeVaultBackup: VaultBackupExecutor = (scriptPath, cwd) =>
  new Promise((resolve) => {
    const { execFile } = require("node:child_process") as typeof import("node:child_process");
    execFile(scriptPath, [], { cwd }, (error, stdout, stderr) => {
      const errorWithCode = error as (Error & { code?: number | string }) | null;
      resolve({
        stdout,
        stderr: stderr || (errorWithCode && typeof errorWithCode.code !== "number" ? errorWithCode.message : ""),
        exitCode: errorWithCode ? (typeof errorWithCode.code === "number" ? errorWithCode.code : null) : 0
      });
    });
  });

export class VaultBackupService {
  private running = false;
  private readonly canAccess: (scriptPath: string) => Promise<void>;
  private readonly execute: VaultBackupExecutor;

  constructor(
    private readonly adapter: unknown,
    dependencies: VaultBackupServiceDependencies = {}
  ) {
    this.canAccess = dependencies.canAccess ?? (async (scriptPath) => {
      const { constants } = require("node:fs") as typeof import("node:fs");
      const { access } = require("node:fs/promises") as typeof import("node:fs/promises");
      await access(scriptPath, constants.F_OK);
    });
    this.execute = dependencies.execute ?? executeVaultBackup;
  }

  async run(): Promise<VaultBackupResult> {
    if (this.running) return { kind: "busy", stdout: "", stderr: "", exitCode: null };

    const resolved = resolveVaultBackupScript(this.adapter);
    if (!resolved) return { kind: "unsupported", stdout: "", stderr: "", exitCode: null };

    this.running = true;
    try {
      try {
        await this.canAccess(resolved.scriptPath);
      } catch {
        return {
          kind: "missing_script",
          stdout: "",
          stderr: "",
          exitCode: null,
          scriptPath: resolved.scriptPath
        };
      }
      return classify(await this.execute(resolved.scriptPath, resolved.vaultPath), resolved.scriptPath);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return {
        kind: "failed",
        stdout: "",
        stderr: detail,
        exitCode: null,
        scriptPath: resolved.scriptPath,
        detail
      };
    } finally {
      this.running = false;
    }
  }
}
