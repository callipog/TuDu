# Notificacoes de outros apps (WhatsApp, Discord, e-mail...) para a ilha.
#
# Reserva do helper nativo (native/tudu-helper, modo "notifications"): so roda
# quando o Windows barra o .exe nativo (Controle Inteligente de Aplicativos).
# Mesmo protocolo: le a central de notificacoes a cada 1,5 s e escreve uma
# linha por notificacao nova:
#   {"t":"notif","id":12,"app":"WhatsApp","appId":"...","title":"Ana","body":"...","at":1795...}
# As que ja estavam na central ao abrir nao sao avisadas. Sem acesso:
# {"t":"error","access":"denied"} e sai. Fechar o stdin encerra.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Emit($obj) {
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
}

function Clip([string]$s, [int]$n) {
  $t = (($s -split '\s+') | Where-Object { $_ }) -join ' '
  if ($t.Length -gt $n) { $t = $t.Substring(0, $n) }
  return $t
}

try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  } | Select-Object -First 1
  $null = [Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI.Notifications, ContentType = WindowsRuntime]
  $null = [Windows.UI.Notifications.UserNotification, Windows.UI.Notifications, ContentType = WindowsRuntime]
  $listener = [Windows.UI.Notifications.Management.UserNotificationListener]::Current
  $status = "$($listener.GetAccessStatus())"
  if ($status -ne 'Allowed') {
    $access = if ($status -eq 'Denied') { 'denied' } else { 'unspecified' }
    Emit @{ t = 'error'; access = $access; message = 'sem acesso as notificacoes' }
    exit 2
  }
  $tList = [System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]]
  $generic = [Windows.UI.Notifications.KnownNotificationBindings]::ToastGeneric
} catch {
  Emit @{ t = 'error'; access = 'unavailable'; message = "$($_.Exception.Message)" }
  exit 2
}

Emit @{ t = 'ready' }

$stdin = New-Object System.IO.StreamReader([Console]::OpenStandardInput())
$pending = $stdin.ReadLineAsync()
$seen = @{}
$first = $true
$epoch = [DateTimeOffset]::FromUnixTimeMilliseconds(0)

while ($true) {
  while ($pending.IsCompleted) {
    if ($null -eq $pending.Result) { exit 0 }   # o TuDu fechou o stdin
    $pending = $stdin.ReadLineAsync()
  }
  try {
    $task = $asTask.MakeGenericMethod($tList).Invoke($null, @($listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)))
    [void]$task.Wait(4000)
    if ($task.IsCompleted) {
      $now = @{}
      foreach ($n in $task.Result) {
        $id = [uint32]$n.Id
        $now[$id] = $true
        if ($seen.ContainsKey($id) -or $first) { continue }
        $app = ''; $appId = ''; $texts = @()
        try { $app = "$($n.AppInfo.DisplayInfo.DisplayName)" } catch { }
        try { $appId = "$($n.AppInfo.AppUserModelId)" } catch { }
        try {
          $b = $n.Notification.Visual.GetBinding($generic)
          if ($b) { $texts = @($b.GetTextElements() | ForEach-Object { "$($_.Text)" } | Where-Object { $_.Trim() }) }
        } catch { }
        $title = if ($texts.Count -gt 0) { $texts[0] } else { '' }
        $body = if ($texts.Count -gt 1) { ($texts[1..($texts.Count - 1)]) -join ' ' } else { '' }
        $at = [int64]($n.CreationTime - $epoch).TotalMilliseconds
        Emit @{ t = 'notif'; id = $id; app = (Clip $app 60); appId = (Clip $appId 200); title = (Clip $title 120); body = (Clip $body 160); at = $at }
      }
      $seen = $now
      $first = $false
    }
  } catch {
    Emit @{ t = 'warn'; message = "$($_.Exception.Message)" }
  }
  Start-Sleep -Milliseconds 1500
}
