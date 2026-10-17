import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function assertStableReleaseTag(tag, version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag) || tag !== version) {
    throw new Error('Stable release tag must exactly match the manifest version (no v prefix or prerelease suffix).');
  }
}

/** Fail closed before publishing: branch/PR CI is not post-merge main CI. */
export function assertReleaseSource({ tag, version, headSha, tagSha, mainSha, runs }) {
  assertStableReleaseTag(tag, version);
  if (!headSha || headSha !== tagSha || headSha !== mainSha) {
    throw new Error('Release tag must point to the checked-out, reviewed merge at the current main head.');
  }
  // GitHub lists newest runs first. A later failed/pending run must not be
  // hidden by selecting an older success on the same commit.
  const latest = runs.find(run => run.head_sha === headSha && run.head_branch === 'main'
    && run.event === 'push' && run.path === '.github/workflows/ci.yml');
  if (!latest || latest.status !== 'completed' || latest.conclusion !== 'success') throw new Error('Successful post-merge main Ubuntu/Windows CI is required on the exact release commit.');
  return latest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.GITHUB_REF_TYPE !== 'tag') throw new Error('Publication requires a tag event.');
  const tag = process.env.GITHUB_REF_NAME ?? '';
  const { version } = JSON.parse(await readFile('manifest.json', 'utf8'));
  // Validate before placing the tag in a git argument or API path.
  assertStableReleaseTag(tag, version);
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const headSha = git('rev-parse', 'HEAD');
  const tagSha = git('rev-parse', '--verify', `refs/tags/${tag}^{commit}`);
  git('fetch', '--no-tags', 'origin', 'main:refs/remotes/origin/main');
  const mainSha = git('rev-parse', 'refs/remotes/origin/main');
  const repository = process.env.GITHUB_REPOSITORY;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) throw new Error('Missing GitHub repository.');
  const response = JSON.parse(execFileSync('gh', ['api',
    `repos/${repository}/actions/workflows/ci.yml/runs?branch=main&event=push&head_sha=${headSha}&per_page=100`
  ], { encoding: 'utf8' }));
  const passed = assertReleaseSource({ tag, version, headSha, tagSha, mainSha, runs: response.workflow_runs });
  console.log(`Publication source verified: ${headSha}; post-merge CI ${passed.html_url}`);
}
