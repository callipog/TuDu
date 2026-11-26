//! Player da ilha: controle de midia do Windows (SMTC), o mesmo do painel de
//! volume. Um canal so serve Spotify, YouTube no navegador, VLC etc.
//! Comandos: toggle, next, prev, pause.

use crate::io::{emit, emit_raw, sleep_ms, Commands, Poll};
use base64::Engine;
use serde_json::json;
use windows::core::Result;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession as Session,
    GlobalSystemMediaTransportControlsSessionManager as Manager,
    GlobalSystemMediaTransportControlsSessionMediaProperties as Props,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
};
use windows::Storage::Streams::DataReader;

/// Capa acima disso nao vai: nao entope o IPC com uma imagem gigante.
const MAX_ART: u64 = 600 * 1024;
/// 100 ns entre 1601-01-01 e 1970-01-01.
const EPOCH_DIFF: i64 = 116_444_736_000_000_000;

fn secs(ticks: i64) -> f64 {
    ((ticks as f64 / 10_000_000.0) * 10.0).round() / 10.0
}

fn read_art(props: &Props) -> Option<String> {
    let thumb = props.Thumbnail().ok()?;
    let stream = thumb.OpenReadAsync().ok()?.join().ok()?;
    let size = stream.Size().ok()?;
    if size < 16 || size > MAX_ART {
        return None;
    }
    let reader = DataReader::CreateDataReader(&stream).ok()?;
    let n = reader.LoadAsync(size as u32).ok()?.join().ok()?;
    let mut bytes = vec![0u8; n as usize];
    reader.ReadBytes(&mut bytes).ok()?;
    if bytes.len() < 16 {
        return None;
    }
    // O tipo vem pelos primeiros bytes.
    let mime = if bytes[0] == 0xFF && bytes[1] == 0xD8 {
        "image/jpeg"
    } else if bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[8] == 0x57 {
        "image/webp"
    } else {
        "image/png"
    };
    Some(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(&bytes)
    ))
}

fn command(session: &Session, cmd: &str) {
    let op = match cmd {
        "toggle" => session.TryTogglePlayPauseAsync(),
        "next" => session.TrySkipNextAsync(),
        "prev" => session.TrySkipPreviousAsync(),
        "pause" => session.TryPauseAsync(),
        _ => return,
    };
    if let Ok(op) = op {
        let _ = op.join();
    }
}

struct Track {
    state: serde_json::Value,
    key: String,
    props: Option<Props>,
}

fn read_state(session: Option<&Session>) -> Result<Track> {
    let Some(session) = session else {
        return Ok(Track { state: json!({ "t": "state", "active": false }), key: String::new(), props: None });
    };
    let props = session.TryGetMediaPropertiesAsync()?.join().ok();
    let info = session.GetPlaybackInfo()?;
    let tl = session.GetTimelineProperties()?;
    let (title, artist) = match &props {
        Some(p) => (
            p.Title().map(|s| s.to_string_lossy()).unwrap_or_default(),
            p.Artist().map(|s| s.to_string_lossy()).unwrap_or_default(),
        ),
        None => (String::new(), String::new()),
    };
    let playing = info.PlaybackStatus().map(|s| s == Status::Playing).unwrap_or(false);
    let position = secs(tl.Position()?.Duration);
    let duration = secs(tl.EndTime()?.Duration - tl.StartTime()?.Duration);
    let updated_at = (tl.LastUpdatedTime()?.UniversalTime - EPOCH_DIFF) / 10_000;
    let app = session.SourceAppUserModelId().map(|s| s.to_string_lossy()).unwrap_or_default();
    let key = format!("{title}|{artist}");
    Ok(Track {
        state: json!({
            "t": "state",
            "active": !title.is_empty(),
            "app": app,
            "title": title,
            "artist": artist,
            "playing": playing,
            "position": position,
            "duration": duration,
            "updatedAt": updated_at,
        }),
        key,
        props,
    })
}

pub fn run() -> i32 {
    let manager = match Manager::RequestAsync().and_then(|op| op.join()) {
        Ok(m) => m,
        Err(e) => {
            emit(&json!({ "t": "error", "message": format!("sem gerenciador de midia: {e}") }));
            return 2;
        }
    };
    emit(&json!({ "t": "ready" }));

    let cmds = Commands::start();
    let mut last_json = String::new();
    let mut last_track = String::new();
    let mut art_tries = 0;
    let mut art_done = false;
    let mut tick: u64 = 0;

    loop {
        let cmd = match cmds.poll() {
            Poll::Line(l) if !l.is_empty() => Some(l),
            Poll::Closed => return 0,
            _ => None,
        };

        let session = manager.GetCurrentSession().ok();
        if let (Some(c), Some(s)) = (&cmd, &session) {
            command(s, c);
            sleep_ms(150);
        }

        // Estado a cada ~1s, ou logo depois de um comando.
        if cmd.is_some() || tick % 4 == 0 {
            match read_state(session.as_ref()) {
                Ok(track) => {
                    let line = track.state.to_string();
                    if line != last_json {
                        emit_raw(&line);
                        last_json = line;
                    }
                    // A capa vai depois do estado da faixa. O Spotify as vezes
                    // publica a imagem um instante depois do titulo, entao tenta
                    // de novo nas leituras seguintes (ate ~5s).
                    if let Some(props) = &track.props {
                        if !track.key.starts_with('|') || track.key.len() > 1 {
                            let has_title = track.state["active"].as_bool().unwrap_or(false);
                            if has_title {
                                if track.key != last_track {
                                    last_track = track.key.clone();
                                    art_tries = 0;
                                    art_done = false;
                                }
                                if !art_done && art_tries < 5 {
                                    art_tries += 1;
                                    if let Some(data) = read_art(props) {
                                        art_done = true;
                                        emit(&json!({ "t": "art", "track": track.key, "data": data }));
                                    }
                                }
                            }
                        }
                    }
                }
                Err(e) => emit(&json!({ "t": "warn", "message": e.message().to_string() })),
            }
        }

        tick += 1;
        sleep_ms(250);
    }
}
