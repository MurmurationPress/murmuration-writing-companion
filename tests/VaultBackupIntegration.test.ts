import { equal, match } from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import { after, test } from "node:test";
import { VaultBackupService } from "../src/backup/VaultBackupService";

const run = promisify(execFile);
const roots: string[] = [];
after(async () => Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))));

async function git(cwd: string, ...args: string[]): Promise<string> {
  return (await run("git", args, { cwd })).stdout.trim();
}

async function fixture(name: string, pushInitial = true) {
  const root = await mkdtemp(path.join(tmpdir(), `mwc-backup-${name}-`));
  roots.push(root);
  const remote = path.join(root, "Remote Repository.git");
  const vault = path.join(root, "Writer's [Vault] 世界");
  await mkdir(vault);
  await git(root, "init", "--bare", remote);
  await git(vault, "init", "-b", "main");
  await git(vault, "config", "user.name", "MWC Test Author");
  await git(vault, "config", "user.email", "mwc-test@example.invalid");
  await git(vault, "remote", "add", "origin", remote);
  await writeFile(path.join(vault, "Scene One.md"), "Initial scene\n", "utf8");
  await git(vault, "add", "-A");
  await git(vault, "commit", "-m", "Initial");
  if (pushInitial) await git(vault, "push", "origin", "main");
  return { root, remote, vault, service: new VaultBackupService({ getBasePath: () => vault }) };
}

test("real Git backup handles special-character paths and pushes a vault edit", async () => {
  const { vault, remote, service } = await fixture("edit");
  await writeFile(path.join(vault, "Scene One.md"), "Edited scene\n", "utf8");
  const result = await service.run();
  equal(result.kind, "success");
  equal(await git(vault, "status", "--porcelain"), "");
  equal(await git(vault, "rev-parse", "HEAD"), await git(remote, "rev-parse", "refs/heads/main"));
  match(await git(vault, "log", "-1", "--format=%s"), /^Vault backup: /u);
});

test("real Git backup pushes an existing local commit without making another", async () => {
  const { vault, remote, service } = await fixture("ahead");
  await writeFile(path.join(vault, "Scene Two.md"), "Second scene\n", "utf8");
  await git(vault, "add", "-A");
  await git(vault, "commit", "-m", "Existing local work");
  const before = await git(vault, "rev-parse", "HEAD");
  equal((await service.run()).kind, "success");
  equal(await git(vault, "rev-parse", "HEAD"), before);
  equal(await git(remote, "rev-parse", "refs/heads/main"), before);
});

test("real Git backup supports the first remote branch push", async () => {
  const { vault, remote, service } = await fixture("initial", false);
  equal((await service.check()).kind, "ready_initial_push");
  equal((await service.run()).kind, "success");
  equal(await git(remote, "rev-parse", "refs/heads/main"), await git(vault, "rev-parse", "HEAD"));
});

test("real Git check refuses remote-ahead and divergence", async () => {
  const remoteAhead = await fixture("remote-ahead");
  const other = path.join(remoteAhead.root, "other");
  await git(remoteAhead.root, "clone", "--branch", "main", remoteAhead.remote, other);
  await git(other, "config", "user.name", "Remote Author");
  await git(other, "config", "user.email", "remote@example.invalid");
  await writeFile(path.join(other, "Remote.md"), "Remote work\n", "utf8");
  await git(other, "add", "-A");
  await git(other, "commit", "-m", "Remote work");
  await git(other, "push", "origin", "main");
  equal((await remoteAhead.service.check()).kind, "remote_ahead");

  await writeFile(path.join(remoteAhead.vault, "Local.md"), "Local work\n", "utf8");
  await git(remoteAhead.vault, "add", "-A");
  await git(remoteAhead.vault, "commit", "-m", "Local work");
  equal((await remoteAhead.service.check()).kind, "diverged");
});

test("real Git pull fast-forwards remote work in a special-character vault path", async () => {
  const remoteAhead = await fixture("pull remote ahead");
  const other = path.join(remoteAhead.root, "Other Writer Ω");
  await git(remoteAhead.root, "clone", "--branch", "main", remoteAhead.remote, other);
  await git(other, "config", "user.name", "Remote Author");
  await git(other, "config", "user.email", "remote@example.invalid");
  await writeFile(path.join(other, "Remote Scene [final].md"), "Remote work\n", "utf8");
  await git(other, "add", "-A");
  await git(other, "commit", "-m", "Remote work");
  await git(other, "push", "origin", "main");

  equal((await remoteAhead.service.pull()).kind, "success");
  equal(await git(remoteAhead.vault, "rev-parse", "HEAD"), await git(remoteAhead.remote, "rev-parse", "refs/heads/main"));
  equal(await git(remoteAhead.vault, "status", "--porcelain"), "");
});

test("real Git pull refuses dirty and divergent repositories without modifying them", async () => {
  const dirty = await fixture("pull-dirty");
  await writeFile(path.join(dirty.vault, "Scene One.md"), "Uncommitted work\n", "utf8");
  const dirtyHead = await git(dirty.vault, "rev-parse", "HEAD");
  equal((await dirty.service.pull()).kind, "local_changes");
  equal(await git(dirty.vault, "rev-parse", "HEAD"), dirtyHead);
  match(await git(dirty.vault, "status", "--porcelain"), /Scene One\.md/u);

  const diverged = await fixture("pull-diverged");
  const other = path.join(diverged.root, "other");
  await git(diverged.root, "clone", "--branch", "main", diverged.remote, other);
  await git(other, "config", "user.name", "Remote Author");
  await git(other, "config", "user.email", "remote@example.invalid");
  await writeFile(path.join(other, "Remote.md"), "Remote work\n", "utf8");
  await git(other, "add", "-A");
  await git(other, "commit", "-m", "Remote work");
  await git(other, "push", "origin", "main");
  await writeFile(path.join(diverged.vault, "Local.md"), "Local work\n", "utf8");
  await git(diverged.vault, "add", "-A");
  await git(diverged.vault, "commit", "-m", "Local work");
  const localHead = await git(diverged.vault, "rev-parse", "HEAD");
  equal((await diverged.service.pull()).kind, "diverged");
  equal(await git(diverged.vault, "rev-parse", "HEAD"), localHead);
});

test("real Git inspection rejects a vault nested in a parent repository", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mwc-backup-parent-"));
  roots.push(root);
  await git(root, "init", "-b", "main");
  const vault = path.join(root, "Vault");
  await mkdir(vault);
  const service = new VaultBackupService({ getBasePath: () => vault });
  equal((await service.inspect()).kind, "unsafe_repository_scope");
});
