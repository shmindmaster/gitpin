import { appendFileSync, readFileSync } from 'node:fs';

const reportPath = process.argv[2];
if (!reportPath) fail('Report path is required.');

let report;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch {
  fail('Gate did not produce a valid JSON report.');
}

if (
  report?.kind !== 'gitpin-gate-report' ||
  report.schemaVersion !== 1 ||
  !['ok', 'failed'].includes(report.status) ||
  !/^[0-9a-f]{16}$/u.test(report.reportId ?? '') ||
  !Array.isArray(report.claims) ||
  !Array.isArray(report.violations) ||
  !Array.isArray(report.changedPaths?.required)
) {
  fail('Gate report does not match gitpin-gate-report schema version 1.');
}

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `status=${report.status}\nreport-id=${report.reportId}\n`);
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    '## GitPin Evidence Gate',
    '',
    `**Status:** ${report.status} · **Report:** \`${report.reportId}\``,
    '',
    report.message,
    '',
    `Changed paths requiring claims: ${report.changedPaths.required.length}`,
    `Claims with verified evidence locators: ${report.claims.filter((claim) => claim.status === 'evidence-verified').length}/${report.claims.length}`,
  ];
  if (report.violations.length) {
    lines.push('', '### Violations', '');
    for (const violation of report.violations.slice(0, 20)) lines.push(`- ${violation.message}`);
  }
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}

function fail(message) {
  process.stderr.write(`::error title=GitPin Evidence Gate::${message}\n`);
  process.exit(1);
}
