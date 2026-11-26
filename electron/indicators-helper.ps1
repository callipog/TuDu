# Indicadores da ilha: volume, microfone mudo, Caps/Num Lock e brilho.
#
# Reserva do helper nativo (native/tudu-helper, modo "indicators"): so roda
# quando o Windows barra o .exe nativo (Controle Inteligente de Aplicativos).
# Mesmo protocolo:
#   - escreve no stdout uma linha JSON por mudanca:
#       {"t":"volume","level":0.42,"muted":false}
#       {"t":"mic","muted":true}
#       {"t":"keys","caps":true,"num":false}
#       {"t":"brightness","level":0.7}
#     A primeira leitura de cada um sai com "init":true (nao e mudanca: a ilha
#     nao deve anunciar o estado que ja estava ao abrir).
#   - le comandos do stdin, um por linha: "hideosd 1|0".
# Core Audio por interop COM, teclas por GetKeyState, brilho pelo WMI.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Emit($obj) {
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
}

try {
  Add-Type @"
using System;
using System.Runtime.InteropServices;

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int RegisterControlChangeNotify(IntPtr p);
  int UnregisterControlChangeNotify(IntPtr p);
  int GetChannelCount(out int c);
  int SetMasterVolumeLevel(float l, ref Guid g);
  int SetMasterVolumeLevelScalar(float l, ref Guid g);
  int GetMasterVolumeLevel(out float l);
  int GetMasterVolumeLevelScalar(out float l);
  int SetChannelVolumeLevel(uint n, float l, ref Guid g);
  int SetChannelVolumeLevelScalar(uint n, float l, ref Guid g);
  int GetChannelVolumeLevel(uint n, out float l);
  int GetChannelVolumeLevelScalar(uint n, out float l);
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool m, ref Guid g);
  int GetMute([MarshalAs(UnmanagedType.Bool)] out bool m);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  int Activate(ref Guid iid, int ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o);
}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  int EnumAudioEndpoints(int flow, int mask, out IntPtr devs);
  int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice dev);
}
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorCo {}

public static class TuduInd {
  static IMMDeviceEnumerator en;
  [DllImport("user32.dll")] static extern short GetKeyState(int k);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);

  /* flow 0 = saida (alto-falante), 1 = entrada (microfone). Devolve nivel 0..1
     e mudo; -1 quando nao ha dispositivo. O padrao e lido a cada vez: trocar
     de fone para caixa muda o dispositivo. */
  public static float[] Read(int flow) {
    try {
      if (en == null) en = (IMMDeviceEnumerator)(new MMDeviceEnumeratorCo());
      IMMDevice dev;
      if (en.GetDefaultAudioEndpoint(flow, flow == 1 ? 2 : 1, out dev) != 0 || dev == null) return new float[] { -1, 0 };
      Guid iid = typeof(IAudioEndpointVolume).GUID;
      object o;
      dev.Activate(ref iid, 23, IntPtr.Zero, out o);
      var v = (IAudioEndpointVolume)o;
      float lvl; bool mute;
      v.GetMasterVolumeLevelScalar(out lvl);
      v.GetMute(out mute);
      Marshal.ReleaseComObject(o);
      Marshal.ReleaseComObject(dev);
      return new float[] { lvl, mute ? 1 : 0 };
    } catch { en = null; return new float[] { -1, 0 }; }
  }

  public static bool Caps() { return (GetKeyState(0x14) & 1) != 0; }
  public static bool Num() { return (GetKeyState(0x90) & 1) != 0; }

  /* Aviso nativo de volume/brilho do Windows 10 e de parte das versoes do 11:
     uma janela "NativeHWNDHost" com um "DirectUIHWND" dentro. Minimizar faz ela
     sumir sem quebrar as teclas de midia. Devolve se achou (no Windows 11 mais
     novo o aviso e outro e nao da para esconder por aqui). */
  public static bool OsdExists() {
    IntPtr h = IntPtr.Zero;
    while ((h = FindWindowEx(IntPtr.Zero, h, "NativeHWNDHost", "")) != IntPtr.Zero)
      if (FindWindowEx(h, IntPtr.Zero, "DirectUIHWND", "") != IntPtr.Zero) return true;
    return false;
  }

  public static bool HideOsd(bool hide) {
    IntPtr h = IntPtr.Zero;
    while ((h = FindWindowEx(IntPtr.Zero, h, "NativeHWNDHost", "")) != IntPtr.Zero) {
      if (FindWindowEx(h, IntPtr.Zero, "DirectUIHWND", "") != IntPtr.Zero) {
        ShowWindow(h, hide ? 6 : 9);
        return true;
      }
    }
    return false;
  }
}
"@
} catch {
  Emit @{ t = 'error'; message = "$($_.Exception.Message)" }
  exit 2
}

Emit @{ t = 'ready' }

function Brightness() {
  try {
    $b = Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightness -ErrorAction Stop | Select-Object -First 1
    if ($null -eq $b) { return -1 }
    return [double]$b.CurrentBrightness / 100
  } catch { return -1 }
}

$hideOsd = $false
$osdFound = $null
$last = @{ vol = $null; mic = $null; keys = $null; bri = $null }
$tick = 0
$hasBrightness = (Brightness) -ge 0

# stdin sem bloquear o laco. O [Console]::In do PowerShell 5.1 le de forma
# sincrona mesmo no ReadLineAsync; um StreamReader proprio e assincrono de fato.
$reader = New-Object System.IO.StreamReader([Console]::OpenStandardInput())
$pending = $reader.ReadLineAsync()

while ($true) {
  if ($pending.IsCompleted) {
    $line = $pending.Result
    if ($null -eq $line) { break }  # o TuDu fechou: encerra junto
    if ($line -match '^hideosd ([01])') {
      $was = $hideOsd
      $hideOsd = $Matches[1] -eq '1'
      # Desligou a opcao: devolve o aviso do Windows.
      if ($was -and -not $hideOsd) { [void][TuduInd]::HideOsd($false) }
    }
    $pending = $reader.ReadLineAsync()
  }

  $v = [TuduInd]::Read(0)
  if ($v[0] -ge 0) {
    $key = '{0:N2}|{1}' -f $v[0], $v[1]
    if ($key -ne $last.vol) {
      Emit @{ t = 'volume'; level = [math]::Round($v[0], 2); muted = ($v[1] -eq 1); init = ($null -eq $last.vol) }
      $last.vol = $key
      if ($hideOsd) { [void][TuduInd]::HideOsd($true) }
    }
  }

  $m = [TuduInd]::Read(1)
  if ($m[0] -ge 0) {
    $key = "$($m[1])"
    if ($key -ne $last.mic) {
      Emit @{ t = 'mic'; muted = ($m[1] -eq 1); init = ($null -eq $last.mic) }
      $last.mic = $key
    }
  }

  $caps = [TuduInd]::Caps(); $num = [TuduInd]::Num()
  $key = "$caps|$num"
  if ($key -ne $last.keys) {
    Emit @{ t = 'keys'; caps = $caps; num = $num; init = ($null -eq $last.keys) }
    $last.keys = $key
  }

  # Brilho pelo WMI e mais caro: uma vez por segundo basta.
  if ($hasBrightness -and ($tick % 8) -eq 0) {
    $b = Brightness
    if ($b -ge 0) {
      $key = '{0:N2}' -f $b
      if ($key -ne $last.bri) {
        Emit @{ t = 'brightness'; level = [math]::Round($b, 2); init = ($null -eq $last.bri) }
        $last.bri = $key
        if ($hideOsd) { [void][TuduInd]::HideOsd($true) }
      }
    }
  }

  # Da para esconder o aviso nativo nesta versao do Windows? (Ele so nasce no
  # primeiro uso das teclas de volume, entao a resposta pode mudar.) Com a
  # opcao ligada, segura ele escondido: o Windows o recria de vez em quando.
  if (($tick % 16) -eq 0) {
    $found = if ($hideOsd) { [TuduInd]::HideOsd($true) } else { [TuduInd]::OsdExists() }
    if ($found -ne $osdFound) { $osdFound = $found; Emit @{ t = 'osd'; found = $found } }
  }

  $tick++
  Start-Sleep -Milliseconds 120
}
