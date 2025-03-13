use std::process::Command;

pub struct Browser;

impl Browser {
    pub fn open_url(url: &str) {
        #[cfg(target_os = "windows")]
        {
            Command::new("cmd")
                .args(["/C", "start", url])
                .spawn()
                .expect("Failed to open URL in browser");
        }

        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg(url)
                .spawn()
                .expect("Failed to open URL in browser");
        }

        #[cfg(target_os = "linux")]
        {
            Command::new("xdg-open")
                .arg(url)
                .spawn()
                .expect("Failed to open URL in browser");
        }
    }
}
