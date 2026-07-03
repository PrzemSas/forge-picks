param([string]$OutDir)
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('Microsoft Zira Desktop')
$s.Rate = 1
$s.Volume = 100

$lines = @{
  'kickoff' = 'Germany kick off in New York. Paraguay sitting deep, looking to counter on the break.'
  'goal1'   = 'GOAL for Germany! Florian Wirtz with the opener — what a start!'
  'goal2'   = 'Paraguay pull one back! Sanabria levels it — we are all square.'
  'goal3'   = 'Musiala restores Germany lead! The crowd are on their feet!'
  'fulltime'= 'Full time! Germany through to the next round. What a match that was.'
}

foreach ($key in $lines.Keys) {
  $path = Join-Path $OutDir ($key + '.wav')
  $s.SetOutputToWaveFile($path)
  $s.Speak($lines[$key])
  $s.SetOutputToNull()
  Write-Output $path
}