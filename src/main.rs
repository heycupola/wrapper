use crossterm::event::{self, DisableMouseCapture, Event, KeyCode, KeyEvent, KeyModifiers};
use crossterm::terminal::{disable_raw_mode, LeaveAlternateScreen};
use ratatui::crossterm::event::EnableMouseCapture;
use ratatui::crossterm::execute;
use ratatui::crossterm::terminal::{enable_raw_mode, EnterAlternateScreen};
use ratatui::prelude::{Backend, CrosstermBackend};
use ratatui::Terminal;
use std::error::Error;
use std::io;
use wrapper_sh::app::{App, PositionOnChat, Screen};
use wrapper_sh::ui::ui;

fn main() -> Result<(), Box<dyn Error>> {
    enable_raw_mode()?;
    let mut stderr = io::stderr();
    execute!(stderr, EnterAlternateScreen, EnableMouseCapture)?;

    let backend = CrosstermBackend::new(stderr);
    let mut terminal = Terminal::new(backend)?;

    let mut app = App::new();

    // Ensure we start at the bottom of the messages if there are any
    if !app.messages.is_empty() {
        app.navigate_chat("bottom");
    }

    let res = run_app(&mut terminal, &mut app);

    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    if let Err(err) = res {
        println!("{err:?}");
    }

    Ok(())
}

fn run_app<B: Backend>(terminal: &mut Terminal<B>, app: &mut App) -> io::Result<bool> {
    loop {
        terminal.draw(|f| ui(f, app))?;

        if let Ok(event) = event::read() {
            match event {
                Event::Key(key) => {
                    if key.kind == event::KeyEventKind::Release {
                        continue;
                    }

                    match app.current_screen {
                        Screen::Chat => handle_chat_keys(key, app),
                        Screen::Account => handle_account_keys(key, app),
                        Screen::Exit => {
                            if handle_exit_keys(key) {
                                return Ok(true);
                            }
                        }
                    }
                }
                Event::Mouse(mouse_event) => {
                    if matches!(app.current_screen, Screen::Chat) {
                        handle_mouse_events(mouse_event, app);
                    }
                }
                _ => {}
            }
        }
    }
}

fn handle_chat_keys(key: KeyEvent, app: &mut App) {
    if key.modifiers == KeyModifiers::CONTROL {
        match key.code {
            KeyCode::Char(c) => match c {
                'c' => app.change_chat_position(PositionOnChat::ChatBox),
                'l' => app.change_chat_position(PositionOnChat::Messages),
                'h' => app.change_chat_position(PositionOnChat::ChatHistory),
                'q' => app.cancel_prompting(),
                'a' => app.switch_screen(Screen::Account),
                'n' => app.clear_chat(),
                _ => {}
            },
            _ => {}
        }
        return;
    }

    match app.position_on_chat {
        Some(PositionOnChat::ChatBox) => match key.code {
            KeyCode::Enter => {
                if matches!(app.position_on_chat, Some(PositionOnChat::ChatBox)) {
                    app.prompt();
                }
            }
            KeyCode::Char(c) => {
                app.insert_char(c);
            }
            KeyCode::Backspace => {
                app.delete_char();
            }
            KeyCode::Delete => {
                app.delete_char_forward();
            }
            KeyCode::Left => {
                app.move_cursor_left();
            }
            KeyCode::Right => {
                app.move_cursor_right();
            }
            KeyCode::Home => {
                app.cursor_to_start();
            }
            KeyCode::End => {
                app.cursor_to_end();
            }
            KeyCode::Tab => {
                app.cycle_model();
            }
            _ => {}
        },
        Some(PositionOnChat::Messages) => match key.code {
            KeyCode::Up => app.navigate_chat("up"),
            KeyCode::Down => app.navigate_chat("down"),
            _ => {}
        },
        Some(PositionOnChat::ChatHistory) => match key.code {
            KeyCode::Up => app.navigate_chat("up"),
            KeyCode::Down => app.navigate_chat("down"),
            KeyCode::Enter => app.select_chat(),
            _ => {}
        },
        None => {
            // If no position is set, default to ChatBox
            app.change_chat_position(PositionOnChat::ChatBox);
        }
    }
}

fn handle_account_keys(key: KeyEvent, app: &mut App) {
    match key.code {
        KeyCode::Char('l') => {
            if !app.user.is_logged_in {
                app.login();
            }
        }
        KeyCode::Char('o') => {
            if app.user.is_logged_in {
                app.logout();
            }
        }
        KeyCode::Char('c') => {
            app.switch_screen(Screen::Chat);
        }
        KeyCode::Char('q') => {
            app.switch_screen(Screen::Exit);
        }
        _ => {}
    }
}

fn handle_exit_keys(key: KeyEvent) -> bool {
    match key.code {
        KeyCode::Char('y') => true,
        KeyCode::Char('n') | KeyCode::Char('q') => false,
        _ => false,
    }
}

fn handle_mouse_events(mouse_event: event::MouseEvent, app: &mut App) {
    use crossterm::event::MouseEventKind;

    match mouse_event.kind {
        MouseEventKind::ScrollUp => {
            if matches!(app.position_on_chat, Some(PositionOnChat::Messages)) {
                app.navigate_chat("up");
            }
        }
        MouseEventKind::ScrollDown => {
            if matches!(app.position_on_chat, Some(PositionOnChat::Messages)) {
                app.navigate_chat("down");
            }
        }
        _ => {}
    }
}
