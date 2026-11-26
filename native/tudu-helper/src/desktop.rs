//! Vigia da area de trabalho para a ilha.
//!
//! O Win+D nao minimiza as janelas: ele poe a propria area de trabalho na
//! frente de tudo. Enquanto ela estiver em primeiro plano, a ilha fica por
//! cima; quando outro app volta, a ilha desce para logo abaixo dele, sem roubar
//! o foco.
//! Comandos: "hwnd <numero>" (a ilha; 0 = nenhuma), "extra <n1,n2,...>" (cards
//! fixados que nao ficam sempre por cima; vazio = nenhum), "pid <numero>",
//! "auto 1|0" (vale so para a ilha).
//! Saida: {"t":"desktop","on":true,"cls":"WorkerW"} e, quando o app em primeiro
//! plano entra ou sai de tela cheia, {"t":"fullscreen","on":true,"x":0,"y":0,"w":1920,"h":1080}
//! (o retangulo do monitor dele, em pixels fisicos).

use crate::io::{emit, sleep_ms, Commands, Poll};
use serde_json::json;
use windows::Win32::Foundation::{HWND, RECT};
use windows::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
use windows::Win32::UI::WindowsAndMessaging::{
    GetClassNameW, GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId, IsIconic, IsWindowVisible,
    SetWindowPos, ShowWindow, HWND_NOTOPMOST, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
    SW_SHOWNOACTIVATE,
};

/// Clicar na barra de tarefas ou na bandeja nao tira a area de trabalho da vista.
const NEUTRAL: &[&str] = &[
    "Shell_TrayWnd",
    "Shell_SecondaryTrayWnd",
    "NotifyIconOverflowWindow",
    "TopLevelWindowForOverflowXamlIsland",
    "XamlExplorerHostIslandWindow",
    "ForegroundStaging",
];

fn class_of(h: HWND) -> String {
    let mut buf = [0u16; 128];
    let n = unsafe { GetClassNameW(h, &mut buf) };
    String::from_utf16_lossy(&buf[..n.max(0) as usize])
}

fn raise(target: HWND) {
    if target.is_invalid() {
        return;
    }
    unsafe {
        // Se algo minimizou a ilha, ela volta sem pegar o foco.
        if IsIconic(target).as_bool() || !IsWindowVisible(target).as_bool() {
            let _ = ShowWindow(target, SW_SHOWNOACTIVATE);
        }
        let _ = SetWindowPos(target, Some(HWND_TOPMOST), 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE);
    }
}

fn lower(target: HWND, fg: HWND) {
    if target.is_invalid() {
        return;
    }
    unsafe {
        let flags = SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE;
        let _ = SetWindowPos(target, Some(HWND_NOTOPMOST), 0, 0, 0, 0, flags);
        // Logo abaixo do app que voltou, para nao cobri-lo.
        if !fg.is_invalid() {
            let _ = SetWindowPos(target, Some(fg), 0, 0, 0, 0, flags);
        }
    }
}

fn parse_hwnd(s: &str) -> HWND {
    HWND(s.trim().parse::<i64>().unwrap_or(0) as isize as *mut _)
}

/// Se a janela cobre o monitor inteiro (tela cheia), devolve o retangulo do monitor.
fn fullscreen_monitor(h: HWND) -> Option<(i32, i32, i32, i32)> {
    unsafe {
        let mut r = RECT::default();
        GetWindowRect(h, &mut r).ok()?;
        let mon = MonitorFromWindow(h, MONITOR_DEFAULTTONEAREST);
        let mut mi = MONITORINFO { cbSize: std::mem::size_of::<MONITORINFO>() as u32, ..Default::default() };
        if !GetMonitorInfoW(mon, &mut mi).as_bool() {
            return None;
        }
        let m = mi.rcMonitor;
        if r.left <= m.left && r.top <= m.top && r.right >= m.right && r.bottom >= m.bottom {
            Some((m.left, m.top, m.right - m.left, m.bottom - m.top))
        } else {
            None
        }
    }
}

pub fn run() -> i32 {
    emit(&json!({ "t": "ready" }));
    let cmds = Commands::start();
    let mut target = HWND::default();
    let mut extras: Vec<HWND> = Vec::new();
    let mut own_pid: u32 = 0;
    let mut auto = true;
    let mut on_desktop = false;
    let mut full: Option<(i32, i32, i32, i32)> = None;
    let mut tick: u64 = 0;

    loop {
        loop {
            match cmds.poll() {
                Poll::Line(l) => {
                    let mut parts = l.split_whitespace();
                    let cmd = parts.next().unwrap_or("");
                    let arg = parts.next().unwrap_or("");
                    match cmd {
                        "hwnd" => target = parse_hwnd(arg),
                        "extra" => {
                            extras = arg.split(',').map(parse_hwnd).filter(|h| !h.is_invalid()).collect();
                            if on_desktop {
                                extras.iter().for_each(|h| raise(*h));
                            }
                        }
                        "pid" => own_pid = arg.parse().unwrap_or(0),
                        "auto" => {
                            auto = arg == "1";
                            if auto && on_desktop {
                                raise(target);
                            }
                        }
                        _ => {}
                    }
                }
                Poll::Empty => break,
                Poll::Closed => return 0,
            }
        }

        let fg = unsafe { GetForegroundWindow() };
        if !fg.is_invalid() {
            let cls = class_of(fg);
            let mut pid: u32 = 0;
            unsafe { GetWindowThreadProcessId(fg, Some(&mut pid)) };
            // Tela cheia (jogo, video, apresentacao): a ilha pode ir para outro monitor.
            // Janela do proprio TuDu na frente conta como "sem tela cheia"; a barra
            // de tarefas e a bandeja nao mudam nada.
            if !NEUTRAL.contains(&cls.as_str()) {
                let desk = cls == "WorkerW" || cls == "Progman";
                let now = if desk || pid == own_pid { None } else { fullscreen_monitor(fg) };
                if now != full {
                    full = now;
                    match now {
                        Some((x, y, w, h)) => emit(&json!({ "t": "fullscreen", "on": true, "x": x, "y": y, "w": w, "h": h })),
                        None => emit(&json!({ "t": "fullscreen", "on": false })),
                    }
                }
            }
            // A propria ilha (ou o TuDu) e a barra de tarefas nao mudam nada.
            if pid != own_pid && !NEUTRAL.contains(&cls.as_str()) {
                let desk = cls == "WorkerW" || cls == "Progman";
                if desk != on_desktop {
                    on_desktop = desk;
                    if auto {
                        if desk { raise(target) } else { lower(target, fg) }
                    }
                    for h in &extras {
                        if desk { raise(*h) } else { lower(*h, fg) }
                    }
                    emit(&json!({ "t": "desktop", "on": desk, "cls": cls }));
                }
            }
        }
        // Enquanto a area de trabalho estiver na frente, reafirma de tempos em tempos.
        if on_desktop && tick % 5 == 0 {
            if auto {
                raise(target);
            }
            extras.iter().for_each(|h| raise(*h));
        }

        tick += 1;
        sleep_ms(200);
    }
}
