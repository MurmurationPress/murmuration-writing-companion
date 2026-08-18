import { deepEqual, equal, match } from "node:assert/strict";
import * as path from "node:path";
import { test } from "node:test";
import {
  GitExecution,
  GitExecutor,
  resolveVaultPath,
  safeRemoteUrl,
  VaultBackupService
} from "../src/backup/VaultBackupService";

const ok = (stdout = ""): GitExecution => ({ stdout, stderr: "", exitCode: 0 });
const fail = (stderr: string, exitCode: number | null = 128, errorCode?: string): GitExecution => ({ stdout: "", stderr, exitCode, errorCode });
const vaultPath = path.resolve("vaults", "Author's [Book] 世界");
const adapter = { getBasePath: () => vaultPath };

interface MockState {
  root?: string;
  branch?: string | null;
  remotes?: string[];
  urls?: Record<string, string>;
  fetch?: GitExecution;
  local?: string;
  remote?: string;
  base?: string;
  changes?: boolean | boolean[];
  staged?: boolean;
  failures?: Partial<Record<string, GitExecution>>;
}

function mockGit(state: MockState = {}): { execute: GitExecutor; calls: string[][] } {
  const calls: string[][] = [];
  let statusCount = 0;
  const execute: GitExecutor = async (executable, args, options) => {
    equal(executable, "git");
    equal(options.cwd, vaultPath);
    const command = [...args];
    calls.push(command);
    const key = command.join(" ");
    if (state.failures?.[key]) return state.failures[key]!;
    if (key === "rev-parse --show-toplevel") return ok(`${state.root ?? vaultPath}\n`);
    if (key === "symbolic-ref --quiet --short HEAD") return state.branch === null ? fail("", 1) : ok(`${state.branch ?? "main"}\n`);
    if (key === "remote") return ok(`${(state.remotes ?? ["origin"]).join("\n")}\n`);
    if (command[0] === "remote" && command[1] === "get-url") return ok(`${state.urls?.[command[2]] ?? "git@example.test:author/book.git"}\n`);
    if (command[0] === "fetch") return state.fetch ?? ok();
    if (key === "rev-parse HEAD") return ok(`${state.local ?? "aaa"}\n`);
    if (key === "rev-parse FETCH_HEAD") return ok(`${state.remote ?? state.local ?? "aaa"}\n`);
    if (command[0] === "merge-base") return ok(`${state.base ?? state.local ?? "aaa"}\n`);
    if (key === "status --porcelain --untracked-files=normal") {
      const changed = Array.isArray(state.changes)
        ? (state.changes[statusCount++] ?? state.changes[state.changes.length - 1])
        : state.changes;
      return ok(changed ? " M Scene.md\n" : "");
    }
    if (key === "add -A -- .") return ok();
    if (key === "diff --cached --quiet --exit-code") return state.staged ? fail("", 1) : ok();
    if (key === "merge --ff-only FETCH_HEAD") return ok("Updating aaa..bbb\nFast-forward\n");
    if (command[0] === "commit" || command[0] === "push") return ok();
    throw new Error(`Unexpected Git command: ${key}`);
  };
  return { execute, calls };
}

test("resolves desktop vault paths without scripts, including Windows and Linux forms", () => {
  equal(resolveVaultPath(adapter), vaultPath);
  equal(resolveVaultPath({ getBasePath: () => "C:\\Users\\Writer\\My Vault" }), "C:\\Users\\Writer\\My Vault");
  equal(resolveVaultPath({ getBasePath: () => "/home/writer/My Vault" }), "/home/writer/My Vault");
  equal(resolveVaultPath({ getBasePath: () => "relative/vault" }), null);
  equal(resolveVaultPath({}), null);
});

test("classifies Git unavailable and a non-repository", async () => {
  const unavailable = mockGit({ failures: { "rev-parse --show-toplevel": fail("spawn git ENOENT", null, "ENOENT") } });
  equal((await new VaultBackupService(adapter, unavailable).inspect()).kind, "git_unavailable");
  const absent = mockGit({ failures: { "rev-parse --show-toplevel": fail("not a git repository") } });
  equal((await new VaultBackupService(adapter, absent).inspect()).kind, "not_repository");
});

test("detects the repository root and rejects a parent repository", async () => {
  const safe = await new VaultBackupService(adapter, mockGit()).inspect();
  equal(safe.kind, "ready");
  if (safe.kind === "ready") equal(safe.repositoryRoot, vaultPath);
  const parent = await new VaultBackupService(adapter, mockGit({ root: path.dirname(vaultPath) })).inspect();
  equal(parent.kind, "unsafe_repository_scope");
});

test("compares canonical filesystem identities for equivalent Windows Git paths", async () => {
  const windowsVault = "C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\Writer Vault";
  const windowsRoot = "C:/Users/runneradmin/AppData/Local/Temp/Writer Vault";
  const canonical = "C:\\Users\\runneradmin\\AppData\\Local\\Temp\\Writer Vault";
  const windowsAdapter = { getBasePath: () => windowsVault };
  const git = mockGit({ root: windowsRoot });
  const execute: GitExecutor = async (executable, args, options) =>
    git.execute(executable, args, { cwd: options.cwd === windowsVault ? vaultPath : options.cwd });
  const result = await new VaultBackupService(windowsAdapter, {
    execute,
    canonicalPath: async (value) => value === windowsVault || value === windowsRoot ? canonical : value
  }).inspect();
  equal(result.kind, "ready");
});

test("detects the current branch and refuses detached HEAD", async () => {
  const ready = await new VaultBackupService(adapter, mockGit({ branch: "feature/story" })).inspect();
  if (ready.kind === "ready") equal(ready.branch, "feature/story");
  equal((await new VaultBackupService(adapter, mockGit({ branch: null })).inspect()).kind, "detached_head");
});

test("selects origin, otherwise the sole remote, and displays its URL", async () => {
  const origin = await new VaultBackupService(adapter, { ...mockGit({ remotes: ["upstream", "origin"] }), remoteOverride: () => "upstream" }).inspect();
  if (origin.kind === "ready") {
    equal(origin.remote, "origin");
    equal(origin.remoteSelection, "automatic_origin");
    equal(origin.remoteUrl, "git@example.test:author/book.git");
  }
  const sole = await new VaultBackupService(adapter, mockGit({ remotes: ["upstream"], urls: { upstream: "https://example.test/book.git" } })).inspect();
  if (sole.kind === "ready") {
    equal(sole.remote, "upstream");
    equal(sole.remoteSelection, "automatic_single");
    equal(sole.remoteUrl, "https://example.test/book.git");
  }
});

test("remote URL display removes embedded HTTPS credentials without changing SSH remotes", () => {
  equal(safeRemoteUrl("https://writer:secret@example.test/book.git"), "https://example.test/book.git");
  equal(safeRemoteUrl("git@example.test:author/book.git"), "git@example.test:author/book.git");
});

test("reports no remote, ambiguous remotes, and a stale selected remote", async () => {
  equal((await new VaultBackupService(adapter, mockGit({ remotes: [] })).inspect()).kind, "no_remote");
  equal((await new VaultBackupService(adapter, mockGit({ remotes: ["one", "two"] })).inspect()).kind, "ambiguous_remote");
  const stale = mockGit({ failures: { "remote get-url origin": fail("No such remote") } });
  equal((await new VaultBackupService(adapter, stale).inspect()).kind, "remote_not_found");
});

test("an explicit valid remote override resolves multiple non-origin remotes", async () => {
  const git = mockGit({ remotes: ["backup", "upstream"], urls: { upstream: "ssh://example.test/upstream.git" } });
  const result = await new VaultBackupService(adapter, { ...git, remoteOverride: () => "upstream" }).inspect();
  equal(result.kind, "ready");
  if (result.kind === "ready") {
    equal(result.remote, "upstream");
    equal(result.remoteSelection, "explicit_override");
  }
});

test("a stale override is rejected only when multiple non-origin remotes need selection", async () => {
  const multiple = mockGit({ remotes: ["backup", "upstream"] });
  const stale = await new VaultBackupService(adapter, { ...multiple, remoteOverride: () => "removed" }).inspect();
  equal(stale.kind, "remote_not_found");
  if (stale.kind === "remote_not_found") match(stale.detail ?? "", /no longer configured/u);

  const single = mockGit({ remotes: ["upstream"] });
  const automatic = await new VaultBackupService(adapter, { ...single, remoteOverride: () => "removed" }).inspect();
  equal(automatic.kind, "ready");
  if (automatic.kind === "ready") equal(automatic.remote, "upstream");
});

test("configuration check distinguishes clean, changes, and local commits", async () => {
  equal((await new VaultBackupService(adapter, mockGit()).check()).kind, "ready_clean");
  equal((await new VaultBackupService(adapter, mockGit({ changes: true })).check()).kind, "ready_local_changes");
  equal((await new VaultBackupService(adapter, mockGit({ local: "bbb", remote: "aaa", base: "aaa" })).check()).kind, "ready_local_ahead");
});

test("configuration check permits a missing remote branch as an initial push", async () => {
  const git = mockGit({ fetch: fail("fatal: couldn't find remote ref main") });
  equal((await new VaultBackupService(adapter, git).check()).kind, "ready_initial_push");
});

test("configuration check reports fetch and authentication failures", async () => {
  const network = await new VaultBackupService(adapter, mockGit({ fetch: fail("Could not resolve host") })).check();
  equal(network.kind, "fetch_failed");
  const auth = await new VaultBackupService(adapter, mockGit({ fetch: fail("Authentication failed for remote") })).check();
  equal(auth.kind, "fetch_failed");
  if (auth.kind === "fetch_failed") match(auth.detail ?? "", /Authentication failed/u);
});

test("refuses remote-ahead and divergent histories", async () => {
  equal((await new VaultBackupService(adapter, mockGit({ local: "aaa", remote: "bbb", base: "aaa" })).check()).kind, "remote_ahead");
  equal((await new VaultBackupService(adapter, mockGit({ local: "aaa", remote: "bbb", base: "ccc" })).check()).kind, "diverged");
});

test("pull fast-forwards a clean remote-ahead repository using the fetched commit", async () => {
  const git = mockGit({ local: "aaa", remote: "bbb", base: "aaa" });
  equal((await new VaultBackupService(adapter, git).pull()).kind, "success");
  deepEqual(git.calls.find((args) => args[0] === "merge"), ["merge", "--ff-only", "FETCH_HEAD"]);
  equal(git.calls.filter((args) => args[0] === "status").length, 2);
});

test("pull reports synchronized and local-ahead repositories without modifying them", async () => {
  const equalGit = mockGit();
  equal((await new VaultBackupService(adapter, equalGit).pull()).kind, "up_to_date");
  equal(equalGit.calls.some((args) => args[0] === "merge"), false);

  const aheadGit = mockGit({ local: "bbb", remote: "aaa", base: "aaa" });
  equal((await new VaultBackupService(adapter, aheadGit).pull()).kind, "local_ahead");
  equal(aheadGit.calls.some((args) => args[0] === "merge"), false);
});

test("pull refuses local changes before fetching and refuses divergent histories", async () => {
  const dirty = mockGit({ changes: true, local: "aaa", remote: "bbb", base: "aaa" });
  equal((await new VaultBackupService(adapter, dirty).pull()).kind, "local_changes");
  equal(dirty.calls.some((args) => args[0] === "fetch"), false);

  const diverged = mockGit({ local: "aaa", remote: "bbb", base: "ccc" });
  equal((await new VaultBackupService(adapter, diverged).pull()).kind, "diverged");
  equal(diverged.calls.some((args) => args[0] === "merge"), false);
});

test("pull rechecks the working tree after fetch and refuses a concurrent local edit", async () => {
  const git = mockGit({ changes: [false, true], local: "aaa", remote: "bbb", base: "aaa" });
  equal((await new VaultBackupService(adapter, git).pull()).kind, "local_changes");
  equal(git.calls.some((args) => args[0] === "fetch"), true);
  equal(git.calls.some((args) => args[0] === "merge"), false);
});

test("pull refuses detached HEAD and missing or ambiguous remote branches", async () => {
  equal((await new VaultBackupService(adapter, mockGit({ branch: null })).pull()).kind, "detached_head");
  equal((await new VaultBackupService(adapter, mockGit({ remotes: [] })).pull()).kind, "no_remote");
  equal((await new VaultBackupService(adapter, mockGit({ remotes: ["one", "two"] })).pull()).kind, "ambiguous_remote");
  equal((await new VaultBackupService(adapter, mockGit({ fetch: fail("fatal: couldn't find remote ref main") })).pull()).kind, "no_remote_branch");
});

test("pull reports fetch authentication and fast-forward failures without fallback", async () => {
  const auth = await new VaultBackupService(adapter, mockGit({ fetch: fail("Authentication failed for remote") })).pull();
  equal(auth.kind, "fetch_failed");
  if (auth.kind === "fetch_failed") match(auth.detail ?? "", /Authentication failed/u);

  const git = mockGit({
    local: "aaa",
    remote: "bbb",
    base: "aaa",
    failures: { "merge --ff-only FETCH_HEAD": fail("Not possible to fast-forward") }
  });
  equal((await new VaultBackupService(adapter, git).pull()).kind, "fast_forward_failed");
  equal(git.calls.some((args) => args.includes("rebase") || args.includes("stash") || args.includes("reset")), false);
});

test("pull preserves Windows vault paths and argument boundaries", async () => {
  const windowsVault = "C:\\Users\\Writer\\My Vault [Ω]";
  const windowsAdapter = { getBasePath: () => windowsVault };
  const base = mockGit({ root: windowsVault, local: "aaa", remote: "bbb", base: "aaa" });
  const calls: { args: readonly string[]; cwd: string }[] = [];
  const execute: GitExecutor = async (executable, args, options) => {
    calls.push({ args, cwd: options.cwd });
    return base.execute(executable, args, { cwd: vaultPath });
  };
  const result = await new VaultBackupService(windowsAdapter, {
    execute,
    canonicalPath: async (value) => value
  }).pull();
  equal(result.kind, "success");
  equal(calls.every((call) => call.cwd === windowsVault), true);
  deepEqual(calls.find((call) => call.args[0] === "fetch")?.args, ["fetch", "origin", "main"]);
  deepEqual(calls.find((call) => call.args[0] === "merge")?.args, ["merge", "--ff-only", "FETCH_HEAD"]);
});

test("a clean synchronized repository returns no_changes without staging outside the vault", async () => {
  const git = mockGit();
  const result = await new VaultBackupService(adapter, git).run();
  equal(result.kind, "no_changes");
  deepEqual(git.calls.find((args) => args[0] === "add"), ["add", "-A", "--", "."]);
  equal(git.calls.some((args) => args[0] === "push"), false);
});

test("local modifications are staged, committed with deterministic local time, and pushed", async () => {
  const git = mockGit({ staged: true });
  const result = await new VaultBackupService(adapter, { ...git, now: () => new Date(2026, 7, 10, 11, 30) }).run();
  equal(result.kind, "success");
  const commit = git.calls.find((args) => args[0] === "commit");
  deepEqual(commit, ["commit", "-m", "Vault backup: 2026-08-10 11:30"]);
  deepEqual(git.calls.find((args) => args[0] === "push"), ["push", "origin", "main"]);
});

test("existing local commits are pushed even without file changes", async () => {
  const git = mockGit({ local: "bbb", remote: "aaa", base: "aaa" });
  const result = await new VaultBackupService(adapter, git).run();
  equal(result.kind, "success");
  if (result.kind === "success") equal(result.committed, false);
  equal(git.calls.some((args) => args[0] === "commit"), false);
  equal(git.calls.some((args) => args[0] === "push"), true);
});

test("first push uses the selected remote and branch without changing upstream config", async () => {
  const git = mockGit({ fetch: fail("fatal: couldn't find remote ref feature/book") , branch: "feature/book" });
  const result = await new VaultBackupService(adapter, git).run();
  equal(result.kind, "success");
  deepEqual(git.calls.find((args) => args[0] === "push"), ["push", "origin", "feature/book"]);
  equal(git.calls.flat().includes("--set-upstream"), false);
});

test("commit and push failures retain concise Git diagnostics", async () => {
  const commit = mockGit({ staged: true, failures: { "commit -m Vault backup: 2026-08-10 11:30": fail("Author identity unknown") } });
  const commitResult = await new VaultBackupService(adapter, { ...commit, now: () => new Date(2026, 7, 10, 11, 30) }).run();
  equal(commitResult.kind, "commit_failed");
  const push = mockGit({ local: "bbb", remote: "aaa", base: "aaa", failures: { "push origin main": fail("Permission denied (publickey)") } });
  const pushResult = await new VaultBackupService(adapter, push).run();
  equal(pushResult.kind, "push_failed");
});

test("suppresses concurrent plugin invocations", async () => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  const git = mockGit();
  const execute: GitExecutor = async (...args) => {
    if (args[1][0] === "fetch") await wait;
    return git.execute(...args);
  };
  const service = new VaultBackupService(adapter, { execute });
  const first = service.run();
  await new Promise((resolve) => setTimeout(resolve, 0));
  equal((await service.run()).kind, "busy");
  release();
  equal((await first).kind, "no_changes");
});

test("configuration checks and backups share one concurrency guard", async () => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  const git = mockGit();
  const execute: GitExecutor = async (...args) => {
    if (args[1][0] === "fetch") await wait;
    return git.execute(...args);
  };
  const service = new VaultBackupService(adapter, { execute });
  const checking = service.check();
  await new Promise((resolve) => setTimeout(resolve, 0));
  equal((await service.run()).kind, "busy");
  equal((await service.check()).kind, "busy");
  equal((await service.pull()).kind, "busy");
  release();
  equal((await checking).kind, "ready_clean");
});

test("pull shares the Git operation guard with backup and configuration checks", async () => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  const git = mockGit();
  const execute: GitExecutor = async (...args) => {
    if (args[1][0] === "fetch") await wait;
    return git.execute(...args);
  };
  const service = new VaultBackupService(adapter, { execute });
  const pulling = service.pull();
  await new Promise((resolve) => setTimeout(resolve, 0));
  equal((await service.run()).kind, "busy");
  equal((await service.check()).kind, "busy");
  equal((await service.pull()).kind, "busy");
  release();
  equal((await pulling).kind, "up_to_date");
});

test("legacy backup script presence is irrelevant to all Git invocations", async () => {
  const git = mockGit();
  await new VaultBackupService(adapter, git).run();
  equal(git.calls.flat().some((argument) => argument.includes("backup-vault.sh")), false);
  equal(git.calls.flat().some((argument) => argument === "sh" || argument === "bash"), false);
});
