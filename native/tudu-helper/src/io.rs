use std::io::{BufRead, Write};
use std::sync::mpsc::{channel, Receiver, TryRecvError};
use std::thread;

/// Escreve um evento. Se o TuDu sumiu (pipe quebrado), sai junto.
pub fn emit(v: &serde_json::Value) {
    emit_raw(&v.to_string());
}

pub fn emit_raw(line: &str) {
    let mut out = std::io::stdout().lock();
    if writeln!(out, "{line}").and_then(|_| out.flush()).is_err() {
        std::process::exit(0);
    }
}

/// Comandos do stdin lidos numa thread, para o laco principal nunca travar.
pub struct Commands {
    rx: Receiver<String>,
}

pub enum Poll {
    Line(String),
    Empty,
    /// O TuDu fechou o stdin: hora de sair.
    Closed,
}

impl Commands {
    pub fn start() -> Self {
        let (tx, rx) = channel();
        thread::spawn(move || {
            let stdin = std::io::stdin();
            for line in stdin.lock().lines() {
                match line {
                    Ok(l) => {
                        if tx.send(l).is_err() {
                            return;
                        }
                    }
                    Err(_) => return,
                }
            }
            // Fim do stdin: o canal fecha quando tx cai.
        });
        Commands { rx }
    }

    pub fn poll(&self) -> Poll {
        match self.rx.try_recv() {
            Ok(l) => Poll::Line(l.trim().to_string()),
            Err(TryRecvError::Empty) => Poll::Empty,
            Err(TryRecvError::Disconnected) => Poll::Closed,
        }
    }
}

pub fn sleep_ms(ms: u64) {
    thread::sleep(std::time::Duration::from_millis(ms));
}
