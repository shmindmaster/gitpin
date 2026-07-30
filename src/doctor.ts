import { getCatalog, type CatalogEntry } from './wiki';

export type DoctorStatus = 'ready' | 'attention' | 'blocked';

export interface DoctorReport {
  status: DoctorStatus;
  repositories: CatalogEntry[];
  summary: {
    indexed: number;
    empty: number;
    unavailable: number;
    stale: number;
    documents: number;
  };
}

export async function getDoctorReport(): Promise<DoctorReport> {
  const repositories = await getCatalog();
  const summary = repositories.reduce<DoctorReport['summary']>(
    (current, repository) => ({
      indexed: current.indexed + Number(repository.status === 'indexed'),
      empty: current.empty + Number(repository.status === 'empty'),
      unavailable: current.unavailable + Number(repository.status === 'unavailable'),
      stale: current.stale + Number(repository.stale),
      documents: current.documents + repository.docCount,
    }),
    { indexed: 0, empty: 0, unavailable: 0, stale: 0, documents: 0 },
  );
  return {
    status: doctorStatus(repositories, summary),
    repositories,
    summary,
  };
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = [
    `GitPin readiness: ${report.status}`,
    `Repositories: ${report.repositories.length} | indexed: ${report.summary.indexed} | empty: ${report.summary.empty} | unavailable: ${report.summary.unavailable} | stale: ${report.summary.stale} | docs: ${report.summary.documents}`,
    '',
  ];
  for (const repository of report.repositories) {
    const details = [
      `status=${repository.status}`,
      `docs=${repository.docCount}`,
      `commit=${repository.commitSha ?? 'none'}`,
      `confidence=${repository.confidence}`,
      `stale=${repository.stale}`,
    ];
    if (repository.message) details.push(`reason=${repository.message}`);
    lines.push(`${repository.name}: ${details.join(' | ')}`);
  }
  return lines.join('\n');
}

export function doctorExitCode(report: DoctorReport): number {
  return report.status === 'blocked' ? 1 : 0;
}

function doctorStatus(repositories: CatalogEntry[], summary: DoctorReport['summary']): DoctorStatus {
  if (repositories.length === 0 || summary.unavailable > 0 || summary.documents === 0) return 'blocked';
  if (summary.empty > 0 || summary.stale > 0) return 'attention';
  return 'ready';
}
