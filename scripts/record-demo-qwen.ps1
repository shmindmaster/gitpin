$ErrorActionPreference = 'Stop'

$workspace = Split-Path -Parent $PSScriptRoot
$platformRoot = if ($env:AI_PLATFORM_ROOT) { $env:AI_PLATFORM_ROOT } else { 'D:\AI-Platform' }
$python = Join-Path $platformRoot 'creative-lab\capabilities\voice\qwen3-venv\Scripts\python.exe'
$cli = Join-Path $platformRoot 'creative-lab\capabilities\voice\qwen_narrate_cli.py'

if (-not (Test-Path -LiteralPath $python) -or -not (Test-Path -LiteralPath $cli)) {
  throw 'The local Qwen3-TTS runtime is unavailable. Set AI_PLATFORM_ROOT or use demo:record for the offline fallback.'
}

$env:REPOCONTEXT_DEMO_NARRATION_PROVIDER = 'qwen'
$env:REPOCONTEXT_QWEN_TTS_PYTHON = $python
$env:REPOCONTEXT_QWEN_TTS_CLI = $cli
$env:HF_HOME = if ($env:HF_HOME) { $env:HF_HOME } else { Join-Path $platformRoot 'models\library\ai\huggingface' }

Set-Location $workspace
node scripts/record-demo.mjs
