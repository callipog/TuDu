//! Notificacoes de outros apps (WhatsApp, Discord, e-mail...) para a ilha.
//!
//! Le a central de notificacoes do Windows (UserNotificationListener) a cada
//! 1,5 s e avisa cada notificacao nova:
//!   {"t":"notif","id":12,"app":"WhatsApp","appId":"...","title":"Ana","body":"Chego em 5 min","at":1795...}
//! As que ja estavam na central ao abrir nao sao avisadas (a ilha nao anuncia
//! o que voce ja viu). O texto nao e gravado em lugar nenhum: so passa para a
//! ilha. Sem acesso: {"t":"error","access":"denied"} e sai.
//! Comando: nenhum (fechar o stdin encerra).

use crate::io::{emit, sleep_ms, Commands, Poll};
use serde_json::json;
use std::collections::HashSet;
use windows::UI::Notifications::Management::{UserNotificationListener, UserNotificationListenerAccessStatus};
use windows::UI::Notifications::{KnownNotificationBindings, NotificationKinds, UserNotification};

/// 100 ns entre 1601-01-01 e 1970-01-01.
const EPOCH_DIFF: i64 = 116_444_736_000_000_000;
const POLL_MS: u64 = 1500;

fn clip(s: &str, n: usize) -> String {
    let t: String = s.split_whitespace().collect::<Vec<_>>().join(" ");
    t.chars().take(n).collect()
}

fn describe(n: &UserNotification) -> Option<serde_json::Value> {
    let id = n.Id().ok()?;
    let info = n.AppInfo().ok()?;
    let app = info.DisplayInfo().ok().and_then(|d| d.DisplayName().ok()).map(|s| s.to_string_lossy()).unwrap_or_default();
    let app_id = info.AppUserModelId().map(|s| s.to_string_lossy()).unwrap_or_default();
    let mut texts: Vec<String> = Vec::new();
    if let Ok(binding) = n
        .Notification()
        .and_then(|x| x.Visual())
        .and_then(|v| v.GetBinding(&KnownNotificationBindings::ToastGeneric()?))
    {
        if let Ok(list) = binding.GetTextElements() {
            for t in list {
                if let Ok(s) = t.Text() {
                    let s = s.to_string_lossy();
                    if !s.trim().is_empty() {
                        texts.push(s);
                    }
                }
            }
        }
    }
    let title = texts.first().cloned().unwrap_or_default();
    let body = texts.iter().skip(1).cloned().collect::<Vec<_>>().join(" ");
    let at = n.CreationTime().map(|d| (d.UniversalTime - EPOCH_DIFF) / 10_000).unwrap_or(0);
    Some(json!({
        "t": "notif",
        "id": id,
        "app": clip(&app, 60),
        "appId": clip(&app_id, 200),
        "title": clip(&title, 120),
        "body": clip(&body, 160),
        "at": at,
    }))
}

pub fn run() -> i32 {
    let listener = match UserNotificationListener::Current() {
        Ok(l) => l,
        Err(e) => {
            emit(&json!({ "t": "error", "access": "unavailable", "message": e.message().to_string() }));
            return 2;
        }
    };
    let status = listener.GetAccessStatus().unwrap_or(UserNotificationListenerAccessStatus::Unspecified);
    if status != UserNotificationListenerAccessStatus::Allowed {
        let access = if status == UserNotificationListenerAccessStatus::Denied { "denied" } else { "unspecified" };
        emit(&json!({ "t": "error", "access": access, "message": "sem acesso as notificacoes" }));
        return 2;
    }
    emit(&json!({ "t": "ready" }));

    let cmds = Commands::start();
    let mut seen: HashSet<u32> = HashSet::new();
    let mut first = true;
    loop {
        loop {
            match cmds.poll() {
                Poll::Line(_) => {}
                Poll::Empty => break,
                Poll::Closed => return 0,
            }
        }
        match listener.GetNotificationsAsync(NotificationKinds::Toast).and_then(|op| op.join()) {
            Ok(list) => {
                let mut now_ids: HashSet<u32> = HashSet::new();
                for n in list {
                    let Ok(id) = n.Id() else { continue };
                    now_ids.insert(id);
                    if seen.contains(&id) {
                        continue;
                    }
                    if !first {
                        if let Some(v) = describe(&n) {
                            emit(&v);
                        }
                    }
                }
                // Esquece as que sairam da central (a lista fica sempre pequena).
                seen = now_ids;
                first = false;
            }
            Err(e) => emit(&json!({ "t": "warn", "message": e.message().to_string() })),
        }
        sleep_ms(POLL_MS);
    }
}
