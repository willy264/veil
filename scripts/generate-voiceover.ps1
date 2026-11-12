param([string]$Ffmpeg = 'ffmpeg')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$repo = Split-Path $PSScriptRoot -Parent
$outputDir = Join-Path $repo 'results/video-assets'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$scenes = Get-Content (Join-Path $repo 'docs/video-scenes.json') -Raw | ConvertFrom-Json

function Get-WaveSeconds([string]$path) {
  $reader = [System.IO.BinaryReader]::new([System.IO.File]::OpenRead($path))
  try {
    $reader.BaseStream.Position = 12
    $byteRate = 0; $dataSize = 0
    while ($reader.BaseStream.Position + 8 -le $reader.BaseStream.Length) {
      $id = [System.Text.Encoding]::ASCII.GetString($reader.ReadBytes(4))
      $size = $reader.ReadUInt32(); $start = $reader.BaseStream.Position
      if ($id -eq 'fmt ') { $reader.BaseStream.Position += 8; $byteRate = $reader.ReadUInt32() }
      if ($id -eq 'data') { $dataSize += $size }
      $reader.BaseStream.Position = $start + $size + ($size % 2)
    }
    if (!$byteRate) { throw 'Missing WAV sample format' }
    return $dataSize / $byteRate
  } finally { $reader.Dispose() }
}

$timeline = @(); $offset = 0; $ffArgs = @('-hide_banner','-loglevel','error','-y')
foreach ($scene in $scenes) {
  $path = Join-Path $outputDir ($scene.id + '.wav')
  $rate = 0
  do {
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try { $synth.Rate = $rate; $synth.Volume = 95; $synth.SetOutputToWaveFile($path); $synth.Speak($scene.text) } finally { $synth.Dispose() }
    $spokenSeconds = Get-WaveSeconds $path
    if ($spokenSeconds -le $scene.seconds - 0.5) { break }
    $rate++
    if ($rate -gt 4) { throw "Narration too long for scene $($scene.id); shorten the text instead of cutting audio" }
  } while ($true)
  $timeline += [pscustomobject]@{id=$scene.id;start=$offset;end=($offset+$scene.seconds);spoken_seconds=[Math]::Round($spokenSeconds,3);speech_rate=$rate;shot=$scene.shot}
  $offset += $scene.seconds
  $ffArgs += @('-i',$path)
}
$filters = @(); $inputs = ''
for ($i=0; $i -lt $scenes.Count; $i++) {
  # Measured speech fits each scene; trims remove only padded silence.
  $filters += "[$($i):a]apad,atrim=duration=$($scenes[$i].seconds),asetpts=PTS-STARTPTS[a$i]"
  $inputs += "[a$i]"
}
$filters += "$($inputs)concat=n=$($scenes.Count):v=0:a=1[out]"
$ffArgs += @('-filter_complex',($filters -join ';'),'-map','[out]','-c:a','pcm_s16le',(Join-Path $outputDir 'voiceover-final.wav'))
& $Ffmpeg @ffArgs
if ($LASTEXITCODE -ne 0) { throw 'FFmpeg failed to assemble narration' }
$duration = Get-WaveSeconds (Join-Path $outputDir 'voiceover-final.wav')
if ([Math]::Abs($duration - $offset) -gt 0.05 -or $duration -lt 110 -or $duration -gt 120) { throw 'Narration length check failed' }
$report = [pscustomobject]@{status='PASS';type='NARRATION_TIMING_ONLY';duration_seconds=$duration;truncated_speech=$false;voice='Windows System.Speech synthetic voice';scenes=$timeline}
[System.IO.File]::WriteAllText((Join-Path $repo 'results/video-narration-timing.json'), ($report | ConvertTo-Json -Depth 5), [System.Text.UTF8Encoding]::new($false))
Write-Output "Narration verified: $duration seconds; complete speech in every scene. Output: results/video-assets/voiceover-final.wav"
