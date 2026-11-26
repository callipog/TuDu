//! Ponte nativa do TuDu com o Windows. Substitui os antigos helpers em
//! PowerShell (cada um custava ~100 MB de RAM) mantendo o mesmo protocolo:
//!   - stdout: uma linha JSON por evento ({"t":"..."});
//!   - stdin: um comando por linha; fechar o stdin encerra o helper.
//!
//! Uso: tudu-helper.exe media | desktop | indicators | battery
//!
//! Subsistema "windows": sem janela de console (nem conhost.exe) por instancia.
#![windows_subsystem = "windows"]

mod battery;
mod desktop;
mod indicators;
mod io;
mod media;

use serde_json::json;
use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};

fn main() {
    // MTA: as chamadas WinRT/COM podem esperar (.get()) sem travar ninguem.
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED).ok();
    }
    let mode = std::env::args().nth(1).unwrap_or_default();
    let code = match mode.as_str() {
        "media" => media::run(),
        "desktop" => desktop::run(),
        "indicators" => indicators::run(),
        "battery" => battery::run(),
        _ => {
            io::emit(&json!({ "t": "error", "message": format!("modo desconhecido: {mode}") }));
            2
        }
    };
    std::process::exit(code);
}
