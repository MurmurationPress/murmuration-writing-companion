import * as path from "node:path";
import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";

export interface VaultFileSystemAdapter {
  getBasePath?: () => string;
}

export interface GitExecution {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  errorCode?: string;
}

export type GitExecutor = (
  executable: "git",
  args: readonly string[],
  options: { cwd: string }
) => Promise<GitExecution>;

export type VaultBackupProblemKind =
  | "unsupported"
  | "git_unavailable"
  | "not_repository"
  | "unsafe_repository_scope"
  | "detached_head"
  | "no_remote"
  | "ambiguous_remote"
  | "remote_not_found"
  | "fetch_failed"
  | "remote_ahead"
  | "diverged"
  | "commit_failed"
  | "push_failed"
  | "failed";

export interface VaultBackupRepository {
  vaultPath: string;
  repositoryRoot: string;
  branch: string;
  remotes: string[];
  remote: string;
  remoteUrl: string;
  remoteSelection: "automatic_origin" | "automatic_single" | "explicit_override";
}

export type VaultBackupInspection =
  | ({ kind: "ready" } & VaultBackupRepository)
  | { kind: VaultBackupProblemKind; detail?: string; vaultPath?: string; repositoryRoot?: string; remotes?: string[] };

export type VaultBackupReadiness =
  | ({ kind: "ready_clean" | "ready_local_changes" | "ready_local_ahead" | "ready_initial_push" } & VaultBackupRepository)
  | { kind: "busy" }
  | Exclude<VaultBackupInspection, { kind: "ready" }>;

export type VaultBackupResult =
  | ({ kind: "success"; committed: boolean; pushed: boolean; detail?: string } & VaultBackupRepository)
  | ({ kind: "no_changes" } & VaultBackupRepository)
  | { kind: "busy" }
  | Exclude<VaultBackupInspection, { kind: "ready" }>;

export interface VaultBackupServiceDependencies {
  execute?: GitExecutor;
  now?: () => Date;
  remoteOverride?: () => string | null;
  canonicalPath?: (value: string) => Promise<string>;
}

export const executeGit: GitExecutor = (_executable, args, options) =>
  new Promise((resolve) => {
    execFile("git", [...args], { cwd: options.cwd, windowsHide: true }, (error, stdout, stderr) => {
      const failure = error as (Error & { code?: number | string }) | null;
      resolve({
        stdout,
        stderr: stderr || (failure && typeof failure.code !== "number" ? failure.message : ""),
        exitCode: failure ? (typeof failure.code === "number" ? failure.code : null) : 0,
        errorCode: failure && typeof failure.code === "string" ? failure.code : undefined
      });
    });
  });

function isAbsoluteFilesystemPath(value: string): boolean {
  return path.isAbsolute(value) || path.win32.isAbsolute(value);
}

function comparablePath(value: string): string {
  const windows = path.win32.isAbsolute(value);
  const normalised = (windows ? path.win32 : path).normalize(value).replace(/[\\/]+$/u, "");
  return windows ? normalised.toLowerCase() : normalised;
}

export function resolveVaultPath(adapter: unknown): string | null {
  if (!adapter || typeof (adapter as VaultFileSystemAdapter).getBasePath !== "function") return null;
  const vaultPath = (adapter as Required<VaultFileSystemAdapter>).getBasePath();
  return vaultPath && isAbsoluteFilesystemPath(vaultPath) ? vaultPath : null;
}

function lines(value: string): string[] {
  return value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}

function detail(execution: GitExecution): string | undefined {
  const stderr = lines(execution.stderr);
  const stdout = lines(execution.stdout);
  return stderr[stderr.length - 1] ?? stdout[stdout.length - 1];
}

export function safeRemoteUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) {
      parsed.username = "";
      parsed.password = "";
    }
    return parsed.toString().replace(/\/$/u, "");
  } catch {
    return value;
  }
}

function isMissingRemoteBranch(execution: GitExecution): boolean {
  return /couldn't find remote ref|remote ref .* not found|could not find remote branch/u.test(execution.stderr.toLowerCase());
}

interface Synchronisation {
  kind: "equal" | "local_ahead" | "remote_ahead" | "diverged" | "initial" | "failed";
  detail?: string;
}

export class VaultBackupService {
  private running = false;
  private readonly execute: GitExecutor;
  private readonly now: () => Date;
  private readonly remoteOverride: () => string | null;
  private readonly canonicalPath: (value: string) => Promise<string>;

  constructor(private readonly adapter: unknown, dependencies: VaultBackupServiceDependencies = {}) {
    this.execute = dependencies.execute ?? executeGit;
    this.now = dependencies.now ?? (() => new Date());
    this.remoteOverride = dependencies.remoteOverride ?? (() => null);
    this.canonicalPath = dependencies.canonicalPath ?? (async (value) => {
      try { return await realpath(value); } catch { return value; }
    });
  }

  private git(cwd: string, ...args: string[]): Promise<GitExecution> {
    return this.execute("git", args, { cwd });
  }

  async inspect(): Promise<VaultBackupInspection> {
    const vaultPath = resolveVaultPath(this.adapter);
    if (!vaultPath) return { kind: "unsupported" };

    const root = await this.git(vaultPath, "rev-parse", "--show-toplevel");
    if (root.errorCode === "ENOENT") return { kind: "git_unavailable", vaultPath };
    if (root.exitCode !== 0) return { kind: "not_repository", vaultPath, detail: detail(root) };
    const repositoryRoot = lines(root.stdout)[0];
    if (!repositoryRoot) return { kind: "not_repository", vaultPath };
    const [canonicalRoot, canonicalVault] = await Promise.all([
      this.canonicalPath(repositoryRoot),
      this.canonicalPath(vaultPath)
    ]);
    if (comparablePath(canonicalRoot) !== comparablePath(canonicalVault)) {
      return { kind: "unsafe_repository_scope", vaultPath, repositoryRoot };
    }

    const branchResult = await this.git(vaultPath, "symbolic-ref", "--quiet", "--short", "HEAD");
    if (branchResult.exitCode !== 0 || !lines(branchResult.stdout)[0]) {
      return { kind: "detached_head", vaultPath, repositoryRoot };
    }
    const branch = lines(branchResult.stdout)[0];

    const remoteResult = await this.git(vaultPath, "remote");
    if (remoteResult.exitCode !== 0) return { kind: "failed", vaultPath, repositoryRoot, detail: detail(remoteResult) };
    const remotes = lines(remoteResult.stdout).sort((a, b) => a.localeCompare(b));
    if (remotes.length === 0) return { kind: "no_remote", vaultPath, repositoryRoot, remotes };
    const override = this.remoteOverride();
    let remote: string | null = null;
    let remoteSelection: VaultBackupRepository["remoteSelection"] | null = null;
    if (remotes.includes("origin")) {
      remote = "origin";
      remoteSelection = "automatic_origin";
    } else if (remotes.length === 1) {
      remote = remotes[0];
      remoteSelection = "automatic_single";
    } else if (override && remotes.includes(override)) {
      remote = override;
      remoteSelection = "explicit_override";
    } else if (override) {
      return { kind: "remote_not_found", vaultPath, repositoryRoot, remotes, detail: `Saved remote '${override}' is no longer configured.` };
    }
    if (!remote || !remoteSelection) return { kind: "ambiguous_remote", vaultPath, repositoryRoot, remotes };

    const urlResult = await this.git(vaultPath, "remote", "get-url", remote);
    if (urlResult.exitCode !== 0) {
      return { kind: "remote_not_found", vaultPath, repositoryRoot, remotes, detail: detail(urlResult) };
    }
    return {
      kind: "ready",
      vaultPath,
      repositoryRoot,
      branch,
      remotes,
      remote,
      remoteUrl: safeRemoteUrl(lines(urlResult.stdout)[0] ?? ""),
      remoteSelection
    };
  }

  private async synchronisation(repository: VaultBackupRepository): Promise<Synchronisation> {
    const fetched = await this.git(repository.vaultPath, "fetch", repository.remote, repository.branch);
    if (fetched.exitCode !== 0) {
      return isMissingRemoteBranch(fetched)
        ? { kind: "initial" }
        : { kind: "failed", detail: detail(fetched) };
    }
    const local = await this.git(repository.vaultPath, "rev-parse", "HEAD");
    const remote = await this.git(repository.vaultPath, "rev-parse", "FETCH_HEAD");
    if (local.exitCode !== 0 || remote.exitCode !== 0) return { kind: "failed", detail: detail(local) ?? detail(remote) };
    const localSha = lines(local.stdout)[0];
    const remoteSha = lines(remote.stdout)[0];
    if (localSha === remoteSha) return { kind: "equal" };
    const base = await this.git(repository.vaultPath, "merge-base", localSha, remoteSha);
    if (base.exitCode !== 0) return { kind: "diverged" };
    const baseSha = lines(base.stdout)[0];
    if (baseSha === remoteSha) return { kind: "local_ahead" };
    if (baseSha === localSha) return { kind: "remote_ahead" };
    return { kind: "diverged" };
  }

  private async hasLocalChanges(repository: VaultBackupRepository): Promise<boolean | null> {
    const status = await this.git(repository.vaultPath, "status", "--porcelain", "--untracked-files=normal");
    return status.exitCode === 0 ? status.stdout.length > 0 : null;
  }

  async check(): Promise<VaultBackupReadiness> {
    if (this.running) return { kind: "busy" };
    this.running = true;
    try {
      const inspected = await this.inspect();
      if (inspected.kind !== "ready") return inspected;
      const sync = await this.synchronisation(inspected);
      if (sync.kind === "failed") return { kind: "fetch_failed", detail: sync.detail, vaultPath: inspected.vaultPath, repositoryRoot: inspected.repositoryRoot };
      if (sync.kind === "remote_ahead") return { kind: "remote_ahead", vaultPath: inspected.vaultPath, repositoryRoot: inspected.repositoryRoot };
      if (sync.kind === "diverged") return { kind: "diverged", vaultPath: inspected.vaultPath, repositoryRoot: inspected.repositoryRoot };
      const changes = await this.hasLocalChanges(inspected);
      if (changes === null) return { kind: "failed", vaultPath: inspected.vaultPath, repositoryRoot: inspected.repositoryRoot };
      if (sync.kind === "initial") return { ...inspected, kind: "ready_initial_push" };
      if (sync.kind === "local_ahead") return { ...inspected, kind: "ready_local_ahead" };
      return { ...inspected, kind: changes ? "ready_local_changes" : "ready_clean" };
    } finally {
      this.running = false;
    }
  }

  async run(): Promise<VaultBackupResult> {
    if (this.running) return { kind: "busy" };
    this.running = true;
    try {
      const inspected = await this.inspect();
      if (inspected.kind !== "ready") return inspected;
      const sync = await this.synchronisation(inspected);
      if (sync.kind === "failed") return { kind: "fetch_failed", detail: sync.detail, vaultPath: inspected.vaultPath, repositoryRoot: inspected.repositoryRoot };
      if (sync.kind === "remote_ahead") return { kind: "remote_ahead", vaultPath: inspected.vaultPath, repositoryRoot: inspected.repositoryRoot };
      if (sync.kind === "diverged") return { kind: "diverged", vaultPath: inspected.vaultPath, repositoryRoot: inspected.repositoryRoot };

      const staged = await this.git(inspected.vaultPath, "add", "-A", "--", ".");
      if (staged.exitCode !== 0) return { kind: "failed", detail: detail(staged), vaultPath: inspected.vaultPath, repositoryRoot: inspected.repositoryRoot };
      const diff = await this.git(inspected.vaultPath, "diff", "--cached", "--quiet", "--exit-code");
      if (diff.exitCode !== 0 && diff.exitCode !== 1) return { kind: "failed", detail: detail(diff), vaultPath: inspected.vaultPath, repositoryRoot: inspected.repositoryRoot };
      const committed = diff.exitCode === 1;
      if (committed) {
        const stamp = this.now();
        const message = `Vault backup: ${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, "0")}-${String(stamp.getDate()).padStart(2, "0")} ${String(stamp.getHours()).padStart(2, "0")}:${String(stamp.getMinutes()).padStart(2, "0")}`;
        const commit = await this.git(inspected.vaultPath, "commit", "-m", message);
        if (commit.exitCode !== 0) return { kind: "commit_failed", detail: detail(commit), vaultPath: inspected.vaultPath, repositoryRoot: inspected.repositoryRoot };
      }

      if (!committed && sync.kind === "equal") return { ...inspected, kind: "no_changes" };
      const push = await this.git(inspected.vaultPath, "push", inspected.remote, inspected.branch);
      if (push.exitCode !== 0) return { kind: "push_failed", detail: detail(push), vaultPath: inspected.vaultPath, repositoryRoot: inspected.repositoryRoot };
      return { ...inspected, kind: "success", committed, pushed: true };
    } catch (error) {
      return { kind: "failed", detail: error instanceof Error ? error.message : String(error) };
    } finally {
      this.running = false;
    }
  }
}
