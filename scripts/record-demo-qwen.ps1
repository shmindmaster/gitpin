$ErrorActionPreference = 'Stop'

$workspace = Split-Path -Parent $PSScriptRoot
$localAiRoot = if ($env:LOCAL_AI_ROOT) { $env:LOCAL_AI_ROOT } else { 'D:\Local-AI' }
$python = Join-Path $localAiRoot 'creative-lab\capabilities\voice\qwen3-venv\Scripts\python.exe'
$cli = Join-Path $localAiRoot 'creative-lab\capabilities\voice\qwen_narrate_cli.py'

if (-not (Test-Path -LiteralPath $python) -or -not (Test-Path -LiteralPath $cli)) {
  throw 'The local Qwen3-TTS runtime is unavailable. Set LOCAL_AI_ROOT or use demo:record for the offline fallback.'
}

$env:REPOCONTEXT_DEMO_NARRATION_PROVIDER = 'qwen'
$env:REPOCONTEXT_QWEN_TTS_PYTHON = $python
$env:REPOCONTEXT_QWEN_TTS_CLI = $cli
$env:HF_HOME = if ($env:HF_HOME) { $env:HF_HOME } else { Join-Path $localAiRoot 'models\library\ai\huggingface' }

Set-Location $workspace
node scripts/record-demo.mjs
