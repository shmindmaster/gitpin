$ErrorActionPreference = 'Stop'

$workspace = Split-Path -Parent $PSScriptRoot
Set-Location $workspace
$Host.UI.RawUI.WindowTitle = 'RepoContext Demo'

try {
  $Host.UI.RawUI.BufferSize = New-Object System.Management.Automation.Host.Size(132, 40)
  $Host.UI.RawUI.WindowSize = New-Object System.Management.Automation.Host.Size(132, 34)
} catch {
  # Window hosts that do not support resizing still render the real workflow.
}

$env:REPOCONTEXT_DEMO_PACE_MS = if ($env:REPOCONTEXT_DEMO_PACE_MS) { $env:REPOCONTEXT_DEMO_PACE_MS } else { '1800' }
node scripts/demo-workflow.mjs
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Start-Sleep -Seconds 4
