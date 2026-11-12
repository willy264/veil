param(
  [string]$Ffmpeg = 'ffmpeg',
  [string]$Voice = 'Microsoft Hazel Desktop'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$repo = Split-Path $PSScriptRoot -Parent
$outputDir = Join-Path $repo 'results/video-assets/green-ui'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$scenes = Get-Content (Join-Path $repo 'docs/narrated-tour-scenes.json') -Raw -Encoding UTF8 | ConvertFrom-Json
function Get-WaveSeconds([string]$path) {
  $reader = [System.IO.BinaryReader]::new([System.IO.File]::OpenRead($path))
  try {
    $reader.BaseStream.Position = 12; $byteRate = 0; $dataSize = 0
    while ($reader.BaseStream.Position + 8 -le $reader.BaseStream.Length) {
      $id = [System.Text.Encoding]::ASCII.GetString($reader.ReadBytes(4))
      $size = $reader.ReadUInt32(); $start = $reader.BaseStream.Position
      if ($id -eq 'fmt ') { $reader.BaseStream.Position += 8; $byteRate = $reader.ReadUInt32() }
      if ($id -eq 'data') { $dataSize += $size }
      $reader.BaseStream.Position = $start + $size + ($size % 2)
    }
    if (!$byteRate) { throw 'WAV format unavailable' }
    return $dataSize / $byteRate
  } finally { $reader.Dispose() }
}
$timeline = @(); $sentenceCues = @(); $offset = 0; $argsList = @('-hide_banner','-loglevel','error','-y')
foreach ($scene in $scenes) {
  $path = Join-Path $outputDir ($scene.id + '.wav'); $rate = 0
  $sentences = @($scene.text -split '(?<=[.!?])\s+')
  do {
    $parts = @(); $spoken = 0
    for ($j=0; $j -lt $sentences.Count; $j++) {
      $partPath = Join-Path $outputDir ("$($scene.id)-sentence-$j.wav")
      $synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
      try {
        $synth.SelectVoice($Voice); $synth.Rate = $rate; $synth.Volume = 95
        $synth.SetOutputToWaveFile($partPath); $synth.Speak($sentences[$j])
      } finally { $synth.Dispose() }
      $seconds = Get-WaveSeconds $partPath
      $parts += [pscustomobject]@{path=$partPath; start=$spoken; seconds=$seconds; text=$sentences[$j]}
      $spoken += $seconds
    }
    if ($spoken -le $scene.seconds - 0.5) { break }
    $rate++
    if ($rate -gt 3) { throw "Shorten narration for $($scene.id); speech will not be truncated" }
  } while ($true)
  $partArgs = @('-hide_banner','-loglevel','error','-y'); $partInputs = ''
  for ($j=0; $j -lt $parts.Count; $j++) { $partArgs += @('-i',$parts[$j].path); $partInputs += "[$($j):a]" }
  $partArgs += @('-filter_complex',"$($partInputs)concat=n=$($parts.Count):v=0:a=1[out]",'-map','[out]','-c:a','pcm_s16le',$path)
  & $Ffmpeg @partArgs
  if ($LASTEXITCODE -ne 0) { throw "Sentence assembly failed: $($scene.id)" }
  if ([Math]::Abs((Get-WaveSeconds $path)-$spoken) -gt 0.01) { throw 'Sentence duration mismatch' }
  $timeline += [pscustomobject]@{id=$scene.id; start=$offset; end=($offset+$scene.seconds); spoken_seconds=[Math]::Round($spoken,3); speech_rate=$rate; scope=$scene.scope}
  foreach ($part in $parts) { $sentenceCues += [pscustomobject]@{scene=$scene.id; start=[Math]::Round($offset+$part.start,3); end=[Math]::Round($offset+$part.start+$part.seconds,3); text=$part.text} }
  $argsList += @('-i',$path); $offset += $scene.seconds
}
$filters = @(); $inputs = ''
for ($i=0; $i -lt $scenes.Count; $i++) {
  $filters += "[$($i):a]apad,atrim=duration=$($scenes[$i].seconds),asetpts=PTS-STARTPTS[a$i]"
  $inputs += "[a$i]"
}
$filters += "$($inputs)concat=n=$($scenes.Count):v=0:a=1,alimiter=limit=0.95:level=false[out]"
$argsList += @('-filter_complex',($filters -join ';'),'-map','[out]','-ar','48000','-c:a','pcm_s16le',(Join-Path $outputDir 'voiceover-final.wav'))
& $Ffmpeg @argsList
if ($LASTEXITCODE -ne 0) { throw 'Narration assembly failed' }
$duration = Get-WaveSeconds (Join-Path $outputDir 'voiceover-final.wav')
if ([Math]::Abs($duration-$offset) -gt 0.05 -or $duration -lt 110 -or $duration -gt 120) { throw 'Unexpected narration length' }
$report = [pscustomobject]@{status='PASS'; type='NARRATION_TIMING_ONLY'; duration_seconds=$duration; truncated_speech=$false; voice=$Voice; synthetic=$true; caption_timing='Sentence WAV sample durations; complete narration coverage'; scenes=$timeline}
$encoding = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText((Join-Path $repo 'results/narrated-tour-timing.json'),($report | ConvertTo-Json -Depth 6),$encoding)
[System.IO.File]::WriteAllText((Join-Path $outputDir 'sentence-cues.json'),($sentenceCues | ConvertTo-Json -Depth 4),$encoding)
Write-Output "Narration ready: $duration seconds; $($sentenceCues.Count) timed sentences; no speech truncated."
