//! Indicadores da ilha: volume, microfone mudo, Caps/Num Lock e brilho.
//!
//! Saida, uma linha por mudanca (a primeira de cada tipo leva "init":true,
//! para a ilha nao anunciar o estado que ja estava ao abrir):
//!   {"t":"volume","level":0.42,"muted":false}
//!   {"t":"mic","muted":true}
//!   {"t":"keys","caps":true,"num":false}
//!   {"t":"brightness","level":0.7}
//!   {"t":"osd","found":false}
//! Comando: "hideosd 1|0".

use crate::io::{emit, sleep_ms, Commands, Poll};
use serde_json::json;
use windows::core::{w, BSTR};
use windows::Win32::Foundation::HWND;
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{eCapture, eCommunications, eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
use windows::Win32::System::Com::{
    CoCreateInstance, CoSetProxyBlanket, CLSCTX_ALL, CLSCTX_INPROC_SERVER, EOAC_NONE, RPC_C_AUTHN_LEVEL_CALL,
    RPC_C_IMP_LEVEL_IMPERSONATE,
};
use windows::Win32::System::Rpc::{RPC_C_AUTHN_WINNT, RPC_C_AUTHZ_NONE};
use windows::Win32::System::Variant::{VARIANT, VT_I4, VT_UI1};
use windows::Win32::System::Wmi::{
    IWbemLocator, IWbemServices, WbemLocator, WBEM_FLAG_FORWARD_ONLY, WBEM_FLAG_RETURN_IMMEDIATELY, WBEM_INFINITE,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{GetKeyState, VK_CAPITAL, VK_NUMLOCK};
use windows::Win32::UI::WindowsAndMessaging::{FindWindowExW, ShowWindow, SW_MINIMIZE, SW_RESTORE};

/// Quantos ciclos (de 120 ms) o dispositivo guardado vale antes de procurar o
/// padrao de novo (~2 s): trocar de fone para caixa muda o dispositivo.
const DEVICE_TTL: u32 = 16;

struct Audio {
    en: Option<IMMDeviceEnumerator>,
    /// [saida, entrada]: o controle de volume guardado e quantos ciclos ainda vale.
    cache: [Option<(IAudioEndpointVolume, u32)>; 2],
}

impl Audio {
    fn open(&mut self, capture: bool) -> Option<IAudioEndpointVolume> {
        unsafe {
            if self.en.is_none() {
                self.en = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok();
            }
            let en = self.en.as_ref()?;
            let dev = if capture {
                en.GetDefaultAudioEndpoint(eCapture, eCommunications)
            } else {
                en.GetDefaultAudioEndpoint(eRender, eMultimedia)
            };
            match dev.and_then(|d| d.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None)) {
                Ok(v) => Some(v),
                Err(_) => {
                    self.en = None;
                    None
                }
            }
        }
    }

    /// Nivel 0..1 e mudo do dispositivo padrao. None quando nao ha dispositivo.
    /// O controle fica guardado por ~2 s: abrir o dispositivo a cada leitura
    /// era o que mais gastava CPU no helper.
    fn read(&mut self, capture: bool) -> Option<(f32, bool)> {
        let i = capture as usize;
        let valido = matches!(&self.cache[i], Some((_, ttl)) if *ttl > 0);
        if !valido {
            self.cache[i] = self.open(capture).map(|v| (v, DEVICE_TTL));
        }
        let (v, ttl) = self.cache[i].as_mut()?;
        *ttl -= 1;
        let r = unsafe { v.GetMasterVolumeLevelScalar().and_then(|l| Ok((l, v.GetMute()?.as_bool()))) };
        match r {
            Ok(x) => Some(x),
            Err(_) => {
                // Dispositivo sumiu (desplugou o fone): procura de novo na proxima.
                self.cache[i] = None;
                None
            }
        }
    }
}

fn toggled(vk: u16) -> bool {
    unsafe { (GetKeyState(vk as i32) & 1) != 0 }
}

/// Brilho da tela de notebook pelo WMI (monitor externo nao publica).
struct Brightness {
    svc: Option<IWbemServices>,
}

impl Brightness {
    fn connect() -> Option<IWbemServices> {
        unsafe {
            let loc: IWbemLocator = CoCreateInstance(&WbemLocator, None, CLSCTX_INPROC_SERVER).ok()?;
            let svc = loc
                .ConnectServer(&BSTR::from("root\\wmi"), &BSTR::new(), &BSTR::new(), &BSTR::new(), 0, &BSTR::new(), None)
                .ok()?;
            CoSetProxyBlanket(
                &svc,
                RPC_C_AUTHN_WINNT,
                RPC_C_AUTHZ_NONE,
                None,
                RPC_C_AUTHN_LEVEL_CALL,
                RPC_C_IMP_LEVEL_IMPERSONATE,
                None,
                EOAC_NONE,
            )
            .ok()?;
            Some(svc)
        }
    }

    fn read(&mut self) -> Option<f64> {
        if self.svc.is_none() {
            self.svc = Self::connect();
        }
        let svc = self.svc.as_ref()?;
        unsafe {
            let en = svc
                .ExecQuery(
                    &BSTR::from("WQL"),
                    &BSTR::from("SELECT CurrentBrightness FROM WmiMonitorBrightness"),
                    WBEM_FLAG_FORWARD_ONLY | WBEM_FLAG_RETURN_IMMEDIATELY,
                    None,
                )
                .ok()?;
            let mut objs = [None];
            let mut got = 0u32;
            let _ = en.Next(WBEM_INFINITE, &mut objs, &mut got);
            if got == 0 {
                return None;
            }
            let obj = objs[0].take()?;
            let mut v = VARIANT::default();
            obj.Get(w!("CurrentBrightness"), 0, &mut v, None, None).ok()?;
            let inner = &v.Anonymous.Anonymous;
            let n = match inner.vt {
                VT_UI1 => inner.Anonymous.bVal as i64,
                VT_I4 => inner.Anonymous.lVal as i64,
                _ => return None,
            };
            Some(n as f64 / 100.0)
        }
    }
}

/// Aviso nativo de volume/brilho do Windows 10 e de parte das versoes do 11:
/// uma "NativeHWNDHost" com um "DirectUIHWND" dentro. Devolve a janela, se houver.
fn find_osd() -> Option<HWND> {
    unsafe {
        let mut after: Option<HWND> = None;
        loop {
            let h = FindWindowExW(None, after, w!("NativeHWNDHost"), w!("")).ok()?;
            if h.is_invalid() {
                return None;
            }
            if FindWindowExW(Some(h), None, w!("DirectUIHWND"), w!("")).map(|c| !c.is_invalid()).unwrap_or(false) {
                return Some(h);
            }
            after = Some(h);
        }
    }
}

fn hide_osd(hide: bool) -> bool {
    match find_osd() {
        Some(h) => {
            unsafe {
                let _ = ShowWindow(h, if hide { SW_MINIMIZE } else { SW_RESTORE });
            }
            true
        }
        None => false,
    }
}

fn r2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

pub fn run() -> i32 {
    emit(&json!({ "t": "ready" }));
    let cmds = Commands::start();
    let mut audio = Audio { en: None, cache: [None, None] };
    let mut bri = Brightness { svc: None };
    let has_brightness = bri.read().is_some();

    let mut hide = false;
    let mut osd_found: Option<bool> = None;
    let mut last_vol: Option<(i32, bool)> = None;
    let mut last_mic: Option<bool> = None;
    let mut last_keys: Option<(bool, bool)> = None;
    let mut last_bri: Option<i32> = None;
    let mut tick: u64 = 0;

    loop {
        loop {
            match cmds.poll() {
                Poll::Line(l) => {
                    if let Some(v) = l.strip_prefix("hideosd ") {
                        let was = hide;
                        hide = v.trim() == "1";
                        // Desligou a opcao: devolve o aviso do Windows.
                        if was && !hide {
                            hide_osd(false);
                        }
                    }
                }
                Poll::Empty => break,
                Poll::Closed => return 0,
            }
        }

        if let Some((lvl, muted)) = audio.read(false) {
            let key = ((lvl as f64 * 100.0).round() as i32, muted);
            if Some(key) != last_vol {
                emit(&json!({ "t": "volume", "level": r2(lvl as f64), "muted": muted, "init": last_vol.is_none() }));
                last_vol = Some(key);
                if hide {
                    hide_osd(true);
                }
            }
        }

        if let Some((_, muted)) = audio.read(true) {
            if Some(muted) != last_mic {
                emit(&json!({ "t": "mic", "muted": muted, "init": last_mic.is_none() }));
                last_mic = Some(muted);
            }
        }

        let keys = (toggled(VK_CAPITAL.0), toggled(VK_NUMLOCK.0));
        if Some(keys) != last_keys {
            emit(&json!({ "t": "keys", "caps": keys.0, "num": keys.1, "init": last_keys.is_none() }));
            last_keys = Some(keys);
        }

        // Brilho pelo WMI e mais caro: uma vez por segundo basta.
        if has_brightness && tick % 8 == 0 {
            if let Some(b) = bri.read() {
                let key = (b * 100.0).round() as i32;
                if Some(key) != last_bri {
                    emit(&json!({ "t": "brightness", "level": r2(b), "init": last_bri.is_none() }));
                    last_bri = Some(key);
                    if hide {
                        hide_osd(true);
                    }
                }
            }
        }

        // O aviso nativo so nasce no primeiro uso das teclas de volume, entao a
        // resposta pode mudar. Com a opcao ligada, segura ele escondido.
        if tick % 16 == 0 {
            let found = if hide { hide_osd(true) } else { find_osd().is_some() };
            if Some(found) != osd_found {
                osd_found = Some(found);
                emit(&json!({ "t": "osd", "found": found }));
            }
        }

        tick += 1;
        sleep_ms(120);
    }
}
