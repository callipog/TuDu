# Vigia da area de trabalho para a ilha.
#
# O "Mostrar area de trabalho" (Win+D) nao minimiza as janelas: ele poe a
# propria area de trabalho na frente de tudo. A ilha, que nao e "sempre por
# cima", fica escondida atras dela. Este vigia olha quem esta em primeiro plano
# e, enquanto for a area de trabalho, deixa a ilha por cima; quando outro app
# volta, devolve a ilha para baixo dele, sem roubar o foco.
#
# Reserva do helper nativo (native/tudu-helper, modo "desktop"): so roda quando
# o Windows barra o .exe nativo (Controle Inteligente de Aplicativos).
#   - stdin, um comando por linha: "hwnd <numero>" (a ilha; 0 = nenhuma),
#     "extra <n1,n2,...>" (cards fixados), "pid <numero>", "auto 1|0";
#   - stdout, uma linha JSON por mudanca: {"t":"desktop","on":true,"cls":"WorkerW"}.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Emit($obj) {
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
}

try {
  Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class TuduDesk {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
}
"@
} catch {
  Emit @{ t = 'error'; message = "$($_.Exception.Message)" }
  exit 2
}

Emit @{ t = 'ready' }

# SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE
$FLAGS = [uint32](0x0001 -bor 0x0002 -bor 0x0010)
$TOPMOST = [IntPtr](-1)
$NOTOPMOST = [IntPtr](-2)
# Clicar na barra de tarefas ou na bandeja nao tira a area de trabalho da vista.
$neutral = @('Shell_TrayWnd', 'Shell_SecondaryTrayWnd', 'NotifyIconOverflowWindow',
  'TopLevelWindowForOverflowXamlIsland', 'XamlExplorerHostIslandWindow', 'ForegroundStaging')

$target = [IntPtr]::Zero
$extras = @()
$ownPid = 0
$auto = $true
$onDesktop = $false
$tick = 0

function RaiseOne($h) {
  if ($h -eq [IntPtr]::Zero) { return }
  # SW_SHOWNOACTIVATE: se algo minimizou a janela, ela volta sem pegar o foco.
  if ([TuduDesk]::IsIconic($h) -or -not [TuduDesk]::IsWindowVisible($h)) { [void][TuduDesk]::ShowWindow($h, 4) }
  [void][TuduDesk]::SetWindowPos($h, $TOPMOST, 0, 0, 0, 0, $FLAGS)
}

function LowerOne($h, $fg) {
  if ($h -eq [IntPtr]::Zero) { return }
  [void][TuduDesk]::SetWindowPos($h, $NOTOPMOST, 0, 0, 0, 0, $FLAGS)
  # Logo abaixo do app que voltou, para nao cobri-lo.
  if ($fg -ne [IntPtr]::Zero) { [void][TuduDesk]::SetWindowPos($h, $fg, 0, 0, 0, 0, $FLAGS) }
}

# A ilha segue o "auto"; os cards fixados sobem sempre.
function Raise() { if ($auto) { RaiseOne $target }; foreach ($h in $extras) { RaiseOne $h } }
function Lower($fg) { if ($auto) { LowerOne $target $fg }; foreach ($h in $extras) { LowerOne $h $fg } }

$stdin = New-Object System.IO.StreamReader([Console]::OpenStandardInput())
$pendingLine = $stdin.ReadLineAsync()

while ($true) {
  while ($pendingLine.IsCompleted) {
    $line = $pendingLine.Result
    if ($null -eq $line) { exit 0 }   # o TuDu fechou o stdin
    $parts = $line.Trim() -split '\s+'
    switch ($parts[0]) {
      'hwnd' { $target = [IntPtr][int64]$parts[1] }
      'extra' {
        $extras = @()
        if ($parts.Count -gt 1 -and $parts[1]) { $extras = @($parts[1] -split ',' | Where-Object { $_ } | ForEach-Object { [IntPtr][int64]$_ }) }
        if ($onDesktop) { foreach ($h in $extras) { RaiseOne $h } }
      }
      'pid'  { $ownPid = [int]$parts[1] }
      'auto' {
        $auto = ($parts[1] -eq '1')
        if ($auto -and $onDesktop) { RaiseOne $target }
      }
    }
    $pendingLine = $stdin.ReadLineAsync()
  }

  try {
    $fg = [TuduDesk]::GetForegroundWindow()
    if ($fg -ne [IntPtr]::Zero) {
      $sb = New-Object System.Text.StringBuilder 128
      [void][TuduDesk]::GetClassName($fg, $sb, 128)
      $cls = $sb.ToString()
      $fgPid = [uint32]0
      [void][TuduDesk]::GetWindowThreadProcessId($fg, [ref]$fgPid)
      # A propria ilha (ou o TuDu) e a barra de tarefas nao mudam nada.
      if ($fgPid -ne $ownPid -and $neutral -notcontains $cls) {
        $desk = ($cls -eq 'WorkerW' -or $cls -eq 'Progman')
        if ($desk -ne $onDesktop) {
          $onDesktop = $desk
          if ($desk) { Raise } else { Lower $fg }
          Emit @{ t = 'desktop'; on = $desk; cls = $cls }
        }
      }
    }
    # Enquanto a area de trabalho estiver na frente, reafirma de tempos em tempos.
    if ($onDesktop -and ($tick % 5 -eq 0)) { Raise }
  } catch {
    Emit @{ t = 'warn'; message = "$($_.Exception.Message)" }
  }

  $tick++
  Start-Sleep -Milliseconds 200
}
