param(
  [Parameter(Mandatory = $true)]
  [string]$StoryboardPath,
  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech

$storyboard = Get-Content -LiteralPath $StoryboardPath -Raw | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
  $voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Name -eq 'Microsoft Zira Desktop' } | Select-Object -First 1
  if ($null -eq $voice) {
    throw 'The required offline demo voice Microsoft Zira Desktop is unavailable.'
  }
  $synth.SelectVoice($voice.VoiceInfo.Name)
  $synth.Rate = -1
  $synth.Volume = 100
  foreach ($segment in $storyboard.segments) {
    $target = Join-Path $OutputDirectory ("{0}.wav" -f $segment.id)
    if (Test-Path -LiteralPath $target) {
      throw "Narration target already exists: $target"
    }
    $spokenText = $segment.narration -replace 'RepoContext', 'Repo Context' -replace 'API', 'A P I'
    $synth.SetOutputToWaveFile($target)
    $synth.Speak($spokenText)
    $synth.SetOutputToNull()
  }
}
finally {
  $synth.Dispose()
}
