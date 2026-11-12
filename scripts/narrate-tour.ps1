param(
  [string]$Ffmpeg = 'ffmpeg',
  [string]$Voice = 'Microsoft Hazel Desktop'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
Add-Type -ReferencedAssemblies System.Speech -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Speech.Synthesis;
public class VeilWordCue {
  public double Start;
  public string Text;
}
public static class VeilTourVoice {
  public static List<VeilWordCue> Render(string text, string path, string voice, int rate) {
    var cues = new List<VeilWordCue>();
    using (var synth = new SpeechSynthesizer()) {
      synth.SelectVoice(voice);
      synth.Rate = rate;
      synth.Volume = 95;
      synth.SetOutputToWaveFile(path);
      synth.SpeakProgress += (sender, e) => cues.Add(new VeilWordCue {Start=e.AudioPosition.TotalSeconds, Text=e.Text});
      synth.Speak(text);
    }
    return cues;
  }
}
'@
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
$timeline = @(); $wordCues = @(); $offset = 0; $argsList = @('-hide_banner','-loglevel','error','-y')
foreach ($scene in $scenes) {
  $path = Join-Path $outputDir ($scene.id + '.wav'); $rate = 0
  do {
    $cues = [VeilTourVoice]::Render($scene.text, $path, $Voice, $rate)
    $spoken = Get-WaveSeconds $path
    if ($spoken -le $scene.seconds - 0.5) { break }
    $rate++
    if ($rate -gt 3) { throw "Shorten narration for $($scene.id); speech will not be truncated" }
  } while ($true)
  if (!$cues.Count) { throw "Missing speech progress timing for $($scene.id)" }
  $timeline += [pscustomobject]@{id=$scene.id; start=$offset; end=($offset+$scene.seconds); spoken_seconds=[Math]::Round($spoken,3); speech_rate=$rate; scope=$scene.scope}
  foreach ($cue in $cues) { $wordCues += [pscustomobject]@{scene=$scene.id; start=[Math]::Round($offset+$cue.Start,3); text=$cue.Text} }
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
$report = [pscustomobject]@{status='PASS'; type='NARRATION_TIMING_ONLY'; duration_seconds=$duration; truncated_speech=$false; voice=$Voice; synthetic=$true; caption_timing='System.Speech SpeakProgress audio positions'; scenes=$timeline}
$encoding = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText((Join-Path $repo 'results/narrated-tour-timing.json'),($report | ConvertTo-Json -Depth 6),$encoding)
[System.IO.File]::WriteAllText((Join-Path $outputDir 'word-cues.json'),($wordCues | ConvertTo-Json -Depth 4),$encoding)
Write-Output "Narration ready: $duration seconds; $($wordCues.Count) timed words; no speech truncated."
