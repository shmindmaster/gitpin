import { resolveRepoPath } from './registry';
import { gitComponents, snapshotMetadata } from './git-shared';

export async function getRepoRecentChanges(name: string, limit = 10) {
  const root = resolveRepoPath(name);
  const snapshot = snapshotMetadata(root);
  if (snapshot) {
    return snapshot.components.map((component) => ({
      component: component.relativePath,
      hash: component.commitSha.slice(0, 7),
      commitSha: component.commitSha,
      branch: component.branch,
      files: [],
      note: 'Snapshot contains one source revision; history is intentionally omitted.',
    }));
  }

  const components = gitComponents(name);
  const changes: Array<{
    component: string;
    hash: string;
    commitSha: string;
    message: string;
    date: string;
    files: string[];
  }> = [];
  for (const component of components) {
    const log = await component.git.log({ maxCount: limit });
    for (const commit of log.all) {
      try {
        const diff = await component.git.diff(['--name-only', '--no-renames', `${commit.hash}^`, commit.hash]);
        changes.push({
          component: component.relativePath,
          hash: commit.hash.slice(0, 7),
          commitSha: commit.hash,
          message: commit.message,
          date: commit.date,
          files: diff.split('\n').filter(Boolean),
        });
      } catch {
        changes.push({
          component: component.relativePath,
          hash: commit.hash.slice(0, 7),
          commitSha: commit.hash,
          message: commit.message,
          date: commit.date,
          files: [],
        });
      }
    }
  }
  return changes.slice(0, Math.max(limit, limit * components.length));
}

export async function compareRepoCommits(name: string, base: string, head: string) {
  const root = resolveRepoPath(name);
  if (snapshotMetadata(root)) {
    return {
      repository: name,
      base,
      head,
      error: 'Remote snapshots contain one pinned source revision and cannot compare commit history.',
    };
  }
  for (const component of gitComponents(name)) {
    try {
      await component.git.raw(['cat-file', '-e', `${base}^{commit}`]);
      await component.git.raw(['cat-file', '-e', `${head}^{commit}`]);
      const diff = await component.git.diff(['--name-status', '--no-renames', base, head]);
      const log = await component.git.log({ from: base, to: head });
      return {
        repository: name,
        component: component.relativePath,
        base,
        head,
        commitsBetween: log.total,
        files: diff
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const [status, ...path] = line.split('\t');
            return { status, path: path.join('\t') };
          }),
      };
    } catch {
      // Try the next component.
    }
  }
  return { repository: name, base, head, error: 'Both commits were not found in one indexed Git component.' };
}
