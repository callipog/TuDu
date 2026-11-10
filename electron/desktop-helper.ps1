# Vigia da area de trabalho para a ilha.
#
# O "Mostrar area de trabalho" (Win+D) nao minimiza as janelas: ele poe a
# propria area de trabalho na frente de tudo. A ilha, que nao e "sempre por
# cima", fica escondida atras dela. Este vigia olha quem esta em primeiro plano
# e, enquanto for a area de trabalho, deixa a ilha por cima; quando outro app
# volta, devolve a ilha para baixo dele, sem roubar o foco.
#
# Roda como processo filho do TuDu (electron/desktop-watch.cjs):
#   - stdin, um comando por linha: "hwnd <numero>", "pid <numero>", "auto 1|0";
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
$ownPid = 0
$auto = $true
$onDesktop = $false
$tick = 0

function Raise() {
  if ($target -eq [IntPtr]::Zero) { return }
  # SW_SHOWNOACTIVATE: se algo minimizou a ilha, ela volta sem pegar o foco.
  if ([TuduDesk]::IsIconic($target) -or -not [TuduDesk]::IsWindowVisible($target)) { [void][TuduDesk]::ShowWindow($target, 4) }
  [void][TuduDesk]::SetWindowPos($target, $TOPMOST, 0, 0, 0, 0, $FLAGS)
}

function Lower($fg) {
  if ($target -eq [IntPtr]::Zero) { return }
  [void][TuduDesk]::SetWindowPos($target, $NOTOPMOST, 0, 0, 0, 0, $FLAGS)
  # Logo abaixo do app que voltou, para nao cobri-lo.
  if ($fg -ne [IntPtr]::Zero) { [void][TuduDesk]::SetWindowPos($target, $fg, 0, 0, 0, 0, $FLAGS) }
}

$stdin = New-Object System.IO.StreamReader([Console]::OpenStandardInput())
$pendingLine = $stdin.ReadLineAsync()

while ($true) {
  while ($pendingLine.IsCompleted) {
    $line = $pendingLine.Result
    if ($null -eq $line) { exit 0 }   # o TuDu fechou o stdin
    $parts = $line.Trim() -split '\s+'
    switch ($parts[0]) {
      'hwnd' { $target = [IntPtr][int64]$parts[1] }
      'pid'  { $ownPid = [int]$parts[1] }
      'auto' {
        $auto = ($parts[1] -eq '1')
        if ($auto -and $onDesktop) { Raise }
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
          if ($auto) { if ($desk) { Raise } else { Lower $fg } }
          Emit @{ t = 'desktop'; on = $desk; cls = $cls }
        }
      }
    }
    # Enquanto a area de trabalho estiver na frente, reafirma de tempos em tempos.
    if ($auto -and $onDesktop -and ($tick % 5 -eq 0)) { Raise }
  } catch {
    Emit @{ t = 'warn'; message = "$($_.Exception.Message)" }
  }

  $tick++
  Start-Sleep -Milliseconds 200
}
