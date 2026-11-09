# Ponte da ilha com o controle de midia do Windows (SMTC).
#
# E o mesmo controle que aparece no painel de volume do Windows: um canal so
# serve Spotify, YouTube no navegador, VLC e o que mais publicar sessao de
# midia. Roda como processo filho do TuDu (electron/media.cjs):
#   - escreve no stdout uma linha JSON por mudanca;
#   - le comandos do stdin, um por linha: toggle, next, prev, pause.
# Sem modulo nativo: o PowerShell do proprio Windows ja enxerga o WinRT.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProgressPreference = 'SilentlyContinue'

function Emit($obj) {
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 4))
  [Console]::Out.Flush()
}

try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  } | Select-Object -First 1

  function Await($op, [Type]$type) {
    $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
    [void]$task.Wait(4000)
    if (-not $task.IsCompleted) { return $null }
    return $task.Result
  }

  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  $null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
  $tManager = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]
  $tProps = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]
  $tStream = [Windows.Storage.Streams.IRandomAccessStreamWithContentType]

  $manager = Await ($tManager::RequestAsync()) $tManager
  if ($null -eq $manager) { throw 'sem gerenciador de midia' }
} catch {
  Emit @{ t = 'error'; message = "$($_.Exception.Message)" }
  exit 2
}

Emit @{ t = 'ready' }

# Capa: le o stream inteiro e devolve como data URL. Limitada a 600 KB para
# nao entupir o IPC com uma imagem gigante.
function Read-Art($props) {
  try {
    if ($null -eq $props.Thumbnail) { return $null }
    $stream = Await ($props.Thumbnail.OpenReadAsync()) $tStream
    if ($null -eq $stream -or $stream.Size -eq 0 -or $stream.Size -gt 600KB) { return $null }
    $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
    $null = Await ($reader.LoadAsync([uint32]$stream.Size)) ([uint32])
    $bytes = New-Object byte[] ([int]$stream.Size)
    $reader.ReadBytes($bytes)
    $mime = if ($stream.ContentType) { $stream.ContentType } else { 'image/png' }
    return "data:$mime;base64," + [Convert]::ToBase64String($bytes)
  } catch {
    return $null
  }
}

$stdin = New-Object System.IO.StreamReader([Console]::OpenStandardInput())
$pendingLine = $stdin.ReadLineAsync()
$lastJson = ''
$lastTrack = ''
$tick = 0

while ($true) {
  # Comandos chegam sem travar o laco: a leitura do stdin e assincrona.
  $command = $null
  if ($pendingLine.IsCompleted) {
    $line = $pendingLine.Result
    if ($null -eq $line) { break }   # o TuDu fechou o stdin: hora de sair
    $command = $line.Trim()
    $pendingLine = $stdin.ReadLineAsync()
  }

  try {
    $session = $manager.GetCurrentSession()

    if ($command -and $session) {
      switch ($command) {
        'toggle' { $null = Await ($session.TryTogglePlayPauseAsync()) ([bool]) }
        'next'   { $null = Await ($session.TrySkipNextAsync()) ([bool]) }
        'prev'   { $null = Await ($session.TrySkipPreviousAsync()) ([bool]) }
        'pause'  { $null = Await ($session.TryPauseAsync()) ([bool]) }
      }
      Start-Sleep -Milliseconds 150
    }

    # Estado a cada ~1s, ou logo depois de um comando.
    if ($command -or ($tick % 4 -eq 0)) {
      if ($null -eq $session) {
        $state = @{ t = 'state'; active = $false }
      } else {
        $props = Await ($session.TryGetMediaPropertiesAsync()) $tProps
        $info = $session.GetPlaybackInfo()
        $tl = $session.GetTimelineProperties()
        $title = if ($props) { "$($props.Title)" } else { '' }
        $artist = if ($props) { "$($props.Artist)" } else { '' }
        $state = @{
          t         = 'state'
          active    = [bool]$title
          app       = "$($session.SourceAppUserModelId)"
          title     = $title
          artist    = $artist
          playing   = ("$($info.PlaybackStatus)" -eq 'Playing')
          position  = [math]::Round($tl.Position.TotalSeconds, 1)
          duration  = [math]::Round(($tl.EndTime - $tl.StartTime).TotalSeconds, 1)
          updatedAt = $tl.LastUpdatedTime.ToUnixTimeMilliseconds()
        }
        $track = "$title|$artist"
      }
      $json = $state | ConvertTo-Json -Compress -Depth 4
      if ($json -ne $lastJson) {
        $lastJson = $json
        [Console]::Out.WriteLine($json)
        [Console]::Out.Flush()
      }
      # A capa vai depois do estado da faixa, que e quando o TuDu ja sabe a
      # que faixa ela pertence. So quando a faixa muda: e o dado mais pesado.
      if ($session -and $title -and $track -ne $lastTrack) {
        $lastTrack = $track
        Emit @{ t = 'art'; track = $track; data = (Read-Art $props) }
      }
    }
  } catch {
    Emit @{ t = 'warn'; message = "$($_.Exception.Message)" }
  }

  $tick++
  Start-Sleep -Milliseconds 250
}
