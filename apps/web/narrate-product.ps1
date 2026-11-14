param(
  [string]$Ffmpeg = $env:VEIL_FFMPEG,
  [string]$Voice = 'Microsoft Hazel Desktop',
  [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$edit = Join-Path $repo 'results/video-assets/product-polish/edit'
$scenePath = Join-Path $PSScriptRoot 'demo-scenes.json'
$encoding = [Text.UTF8Encoding]::new($false)
$culture = [Globalization.CultureInfo]::InvariantCulture
$phase = 'scene plan validation'
function Number-Text([double]$value) { return $value.ToString('0.#########', $culture) }
function Invoke-AudioTool([string[]]$ToolArgs) {
  # Tool stderr can contain paths or input data; never forward raw diagnostics.
  $oldPreference = $ErrorActionPreference
  try { $ErrorActionPreference = 'Continue'; & $Ffmpeg @ToolArgs 2>&1 | Out-Null; $code = $LASTEXITCODE }
  finally { $ErrorActionPreference = $oldPreference }
  if ($code -ne 0) { throw 'Audio tool failed; raw diagnostics withheld.' }
}
function Get-WaveSeconds([string]$File) {
  $reader = [IO.BinaryReader]::new([IO.File]::OpenRead($File))
  try {
    if ([Text.Encoding]::ASCII.GetString($reader.ReadBytes(4)) -ne 'RIFF') { throw 'Invalid WAV container.' }
    $reader.BaseStream.Position = 8
    if ([Text.Encoding]::ASCII.GetString($reader.ReadBytes(4)) -ne 'WAVE') { throw 'Invalid WAV format.' }
    $byteRate = 0; $dataSize = 0
    while ($reader.BaseStream.Position + 8 -le $reader.BaseStream.Length) {
      $id = [Text.Encoding]::ASCII.GetString($reader.ReadBytes(4)); $size = $reader.ReadUInt32(); $start = $reader.BaseStream.Position
      if ($start + $size -gt $reader.BaseStream.Length) { throw 'Incomplete WAV chunk.' }
      if ($id -eq 'fmt ') { $reader.BaseStream.Position += 8; $byteRate = $reader.ReadUInt32() }
      if ($id -eq 'data') { $dataSize += $size }
      $reader.BaseStream.Position = $start + $size + ($size % 2)
    }
    if (!$byteRate -or !$dataSize) { throw 'WAV has no measured speech.' }
    return $dataSize / $byteRate
  } finally { $reader.Dispose() }
}
try {
  if (!$Ffmpeg) {
    $candidate = Join-Path $env:LOCALAPPDATA 'Temp/veil-video-tools/node_modules/ffmpeg-static/ffmpeg.exe'
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { $Ffmpeg = $candidate } else { $Ffmpeg = 'ffmpeg' }
  }
  # Windows PowerShell 5.1 emits the JSON array as one pipeline object.
  $scenes = Get-Content -LiteralPath $scenePath -Raw -Encoding UTF8 | ConvertFrom-Json
  $expectedIds = @('intro','enable','register','send','scan','spend','auditor','dao','limits')
  $expectedSeconds = @(12,16,10,18,14,12,13,12,10)
  $words = (@($scenes | ForEach-Object { $_.text }) -join ' ' -split '\s+').Count
  if ($scenes.Count -ne 9 -or $words -lt 230 -or $words -gt 260) { throw 'Invalid narration plan or word count.' }
  for ($i=0; $i -lt 9; $i++) {
    if ($scenes[$i].id -ne $expectedIds[$i] -or $scenes[$i].seconds -ne $expectedSeconds[$i]) { throw 'Scene order or duration changed.' }
  }
  if ($scenes[0].text -notmatch 'scripted signer, not browser wallet approvals') { throw 'Required spoken disclosure is absent.' }
  $phase = 'Windows voice selection'
  Add-Type -AssemblyName System.Speech
  $probe = [System.Speech.Synthesis.SpeechSynthesizer]::new()
  try { $probe.SelectVoice($Voice) } finally { $probe.Dispose() }
  $phase = 'FFmpeg availability check'
  Invoke-AudioTool -ToolArgs @('-hide_banner','-version')
  if ($CheckOnly) { Write-Output "Plan and tools ready: $words words, 117 seconds, selected Windows voice available. No audio written."; exit 0 }
  $phase = 'sentence synthesis and measured assembly'
  # All generated speech/cue intermediates stay under this fixed ignored folder.
  New-Item -ItemType Directory -Force -Path $edit | Out-Null
  $timeline = @(); $cues = @(); $offset = 0
  foreach ($scene in $scenes) {
    $sentences = @($scene.text -split '(?<=[.!?])\s+')
    $rate = 0
    do {
      $phase = "sentence synthesis for $($scene.id), voice rate $rate"
      $parts = @(); $spoken = 0
      for ($j=0; $j -lt $sentences.Count; $j++) {
        $partPath = Join-Path $edit ("$($scene.id)-sentence-$j.wav")
        $synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
        try {
          $synth.SelectVoice($Voice); $synth.Rate = $rate; $synth.Volume = 95
          $synth.SetOutputToWaveFile($partPath); $synth.Speak($sentences[$j])
        } finally { $synth.Dispose() }
        $seconds = Get-WaveSeconds $partPath
        $parts += [pscustomobject]@{ path=$partPath; start=$spoken; seconds=$seconds; text=$sentences[$j] }
        $spoken += $seconds
      }
      if ($spoken -le $scene.seconds - 0.5) { break }
      Write-Output "Measured $($scene.id): $(Number-Text $spoken) seconds at voice rate $rate; trying the next voice rate."
      $rate++
      # Keep delivery calm. Shorten the scene copy if the measured speech still
      # exceeds its slot; never time-compress or trim spoken audio.
      if ($rate -gt 3) { throw 'Narration exceeds a scene slot. Shorten the text; speech is never cut.' }
    } while ($true)
    $phase = "measured audio assembly for $($scene.id)"
    $sceneWave = Join-Path $edit ($scene.id + '.wav')
    $toolArgs = @('-hide_banner','-loglevel','error','-nostdin','-y'); $inputs = ''
    for ($j=0; $j -lt $parts.Count; $j++) { $toolArgs += @('-i',$parts[$j].path); $inputs += "[$($j):a]" }
    $toolArgs += @('-filter_complex',"$($inputs)concat=n=$($parts.Count):v=0:a=1[out]",'-map','[out]','-ar','48000','-c:a','pcm_s16le',$sceneWave)
    Invoke-AudioTool $toolArgs
    if ([Math]::Abs((Get-WaveSeconds $sceneWave)-$spoken) -gt 0.01) { throw 'Speech assembly duration mismatch.' }
    $timeline += [pscustomobject]@{ id=$scene.id; start=$offset; end=($offset+$scene.seconds); spokenSeconds=$spoken; speechRate=$rate }
    foreach ($part in $parts) { $cues += [pscustomobject]@{ scene=$scene.id; start=($offset+$part.start); end=($offset+$part.start+$part.seconds); text=$part.text } }
    $offset += $scene.seconds
    Write-Output "Narrated $($scene.id): complete sentences fit their scene."
  }
  $phase = 'final narration assembly'
  $toolArgs = @('-hide_banner','-loglevel','error','-nostdin','-y'); $filters = @(); $inputs = ''
  for ($i=0; $i -lt $scenes.Count; $i++) {
    $toolArgs += @('-i',(Join-Path $edit ($scenes[$i].id + '.wav')))
    # Every measured WAV already fits. atrim removes ONLY apad silence.
    $filters += "[$($i):a]apad,atrim=duration=$(Number-Text $scenes[$i].seconds),asetpts=PTS-STARTPTS[a$i]"
    $inputs += "[a$i]"
  }
  $filters += "$($inputs)concat=n=9:v=0:a=1,alimiter=limit=0.95:level=false[out]"
  $wavePath = Join-Path $edit 'voiceover-final.wav'
  $toolArgs += @('-filter_complex',($filters -join ';'),'-map','[out]','-ar','48000','-c:a','pcm_s16le',$wavePath)
  Invoke-AudioTool $toolArgs
  $duration = Get-WaveSeconds $wavePath
  if ([Math]::Abs($duration-117) -gt 0.01) { throw 'Narration must measure exactly 117 seconds.' }
  $phase = 'timing report export'
  $report = [ordered]@{
    status='PASS'; scope='NARRATION_TIMING_ONLY'; durationSeconds=$duration; wordCount=$words
    voice=$Voice; syntheticNarration=$true; speechTruncated=$false
    scenePlanSha256=(Get-FileHash -LiteralPath $scenePath -Algorithm SHA256).Hash.ToLowerInvariant()
    audioSha256=(Get-FileHash -LiteralPath $wavePath -Algorithm SHA256).Hash.ToLowerInvariant()
    captionTiming='Complete sentences measured from WAV sample durations'; scenes=$timeline
  }
  [IO.File]::WriteAllText((Join-Path $edit 'sentence-cues.json'),(ConvertTo-Json -InputObject $cues -Depth 6),$encoding)
  [IO.File]::WriteAllText((Join-Path $repo 'results/product-video-timing.json'),($report | ConvertTo-Json -Depth 8),$encoding)
  Write-Output "Narration ready: 117 seconds, $words words, complete sentence captions."
} catch {
  # Do not serialize exception/provider/process objects or expand input contents.
  [Console]::Error.WriteLine("Product narration failed during $phase. Check the scene plan, installed Windows voice and FFmpeg. Speech was not truncated; raw diagnostics withheld.")
  exit 1
}
