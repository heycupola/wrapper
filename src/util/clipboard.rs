use std::io::Write;
use std::process::{Command, Stdio};

pub struct Clipboard;

impl Clipboard {
    pub fn copy(text: &str) {
        #[cfg(target_os = "windows")]
        {
            let mut child = Command::new("cmd")
                .args(["/C", "clip"])
                .stdin(Stdio::piped())
                .spawn()
                .expect("Failed to run clip command");

            child
                .stdin
                .as_mut()
                .unwrap()
                .write_all(text.as_bytes())
                .unwrap();
        }

        #[cfg(target_os = "macos")]
        {
            let mut child = Command::new("pbcopy")
                .stdin(Stdio::piped())
                .spawn()
                .expect("Failed to run pbcopy");

            child
                .stdin
                .as_mut()
                .unwrap()
                .write_all(text.as_bytes())
                .unwrap();
        }

        #[cfg(target_os = "linux")]
        {
            let mut child = Command::new("xclip")
                .args(["-selection", "clipboard"])
                .stdin(Stdio::piped())
                .spawn()
                .expect("Failed to run xclip. Make sure xclip is installed.");

            child
                .stdin
                .as_mut()
                .unwrap()
                .write_all(text.as_bytes())
                .unwrap();
        }
    }
}
