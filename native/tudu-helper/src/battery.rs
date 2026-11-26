//! O PC tem bateria? (Notebook mostra a bateria na ilha; desktop nao.)
//! Responde uma linha e sai: {"t":"battery","present":true}.

use crate::io::emit;
use serde_json::json;
use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};

pub fn run() -> i32 {
    let mut s = SYSTEM_POWER_STATUS::default();
    let ok = unsafe { GetSystemPowerStatus(&mut s) }.is_ok();
    // BatteryFlag 128 = "sem bateria"; 255 = desconhecido (trata como sem).
    let present = ok && s.BatteryFlag != 128 && s.BatteryFlag != 255;
    emit(&json!({ "t": "battery", "present": present }));
    0
}
