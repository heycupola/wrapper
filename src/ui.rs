use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Style},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Clear, List, ListItem, Paragraph, Wrap},
    Frame,
};

use crate::components::{chat_history_pane, messages_pane::MessagesPane, models_box::ModelsBox};
use crate::{
    app::{App, Message, PositionOnChat, Screen},
    components::chat_history_pane::ChatHistoryPane,
};

pub fn ui(frame: &mut Frame, app: &App) {
    match app.current_screen {
        Screen::Chat => draw_chat_screen(frame, app),
        Screen::Account => draw_account_screen(frame, app),
        Screen::Exit => draw_exit_screen(frame, app),
    }
}

fn draw_chat_screen(frame: &mut Frame, app: &App) {
    // Create main layout with title and content
    let main_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Models
            Constraint::Min(1),    // Content -> History + Messages + Input
            Constraint::Length(3), // Footer
        ])
        .split(frame.area());

    // ModelsBox component
    let models_box = ModelsBox::new(&app.available_models, &app.model);
    models_box.render(frame, main_chunks[0]);

    // Split content horizontally for chat history and messages/input
    let content_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(20), // Chat history
            Constraint::Percentage(80), // Messages and input
        ])
        .split(main_chunks[1]);

    // ChatHistoryPane component
    let chat_history_pane = ChatHistoryPane::new(
        &app.chat_history,
        app.history_scroll,
        matches!(app.position_on_chat, Some(PositionOnChat::ChatHistory)),
    );

    chat_history_pane.render(frame, content_chunks[0]);

    // Split right side vertically for messages and input
    let right_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Min(1),    // Messages
            Constraint::Length(5), // Input
        ])
        .split(content_chunks[1]);

    // MessagesPane component
    let messages_pane = MessagesPane::new(
        &app.messages,
        app.message_scroll,
        matches!(app.position_on_chat, Some(PositionOnChat::Messages)),
    );

    messages_pane.render(frame, right_chunks[0]);

    // Draw input
    let input_block =
        Block::default()
            .title("Input")
            .borders(Borders::ALL)
            .style(match app.position_on_chat {
                Some(PositionOnChat::ChatBox) => Style::default().fg(Color::Yellow),
                _ => Style::default(),
            });

    let input_text = Paragraph::new(app.input.as_str())
        .block(input_block)
        .wrap(Wrap { trim: true });

    frame.render_widget(input_text, right_chunks[1]);

    // Draw footer with help text
    let footer_text = if app.is_prompting {
        "Ctrl+Q: Cancel | Ctrl+Arrow Keys: Navigate"
    } else {
        "Enter: Send | Tab: Change Model | Alt+1-5: Quick Model Select | Ctrl+N: New Chat | Ctrl+Arrow Keys: Navigate | Up/Down: Scroll | Ctrl+A: Account | Esc: Exit"
    };

    let footer = Paragraph::new(Text::styled(footer_text, Style::default().fg(Color::White)))
        .block(Block::default().borders(Borders::ALL));

    frame.render_widget(footer, main_chunks[2]);
}

fn draw_account_screen(frame: &mut Frame, app: &App) {
    // Create main layout
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Title
            Constraint::Min(1),    // Content
            Constraint::Length(3), // Footer
        ])
        .split(frame.area());

    // Draw title
    let title_block = Block::default()
        .borders(Borders::ALL)
        .style(Style::default());

    let title = Paragraph::new(Text::styled(
        "Account Information",
        Style::default().fg(Color::Green),
    ))
    .block(title_block);

    frame.render_widget(title, chunks[0]);

    // Draw account information
    let account_block = Block::default().title("Account").borders(Borders::ALL);

    let account_text = if app.user.is_logged_in {
        vec![
            Line::from(Span::styled(
                format!("Email: {}", app.user.email),
                Style::default().fg(Color::White),
            )),
            Line::from(Span::styled(
                format!("Remaining Messages: {}", app.user.remaining_messages),
                Style::default().fg(Color::White),
            )),
            Line::from(""),
            Line::from(Span::styled(
                "Press 'o' to log out",
                Style::default().fg(Color::Yellow),
            )),
        ]
    } else {
        vec![
            Line::from(Span::styled(
                "You are not logged in",
                Style::default().fg(Color::Red),
            )),
            Line::from(""),
            Line::from(Span::styled(
                "Press 'l' to log in",
                Style::default().fg(Color::Yellow),
            )),
        ]
    };

    let account_paragraph = Paragraph::new(account_text)
        .block(account_block)
        .wrap(Wrap { trim: true });

    frame.render_widget(account_paragraph, chunks[1]);

    // Draw footer
    let footer = Paragraph::new(Text::styled(
        "c: Chat | q: Exit",
        Style::default().fg(Color::White),
    ))
    .block(Block::default().borders(Borders::ALL));

    frame.render_widget(footer, chunks[2]);
}

fn draw_exit_screen(frame: &mut Frame, app: &App) {
    frame.render_widget(Clear, frame.area());

    let popup_block = Block::default()
        .title("Exit")
        .borders(Borders::ALL)
        .style(Style::default().bg(Color::DarkGray));

    let exit_text = Text::styled(
        "Are you sure you want to exit? (y/n)",
        Style::default().fg(Color::Red),
    );

    let exit_paragraph = Paragraph::new(exit_text)
        .block(popup_block)
        .wrap(Wrap { trim: false });

    let area = centered_rect(60, 25, frame.area());
    frame.render_widget(exit_paragraph, area);
}

fn centered_rect(percent_x: u16, percent_y: u16, r: Rect) -> Rect {
    let popup_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage((100 - percent_y) / 2),
            Constraint::Percentage(percent_y),
            Constraint::Percentage((100 - percent_y) / 2),
        ])
        .split(r);

    Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage((100 - percent_x) / 2),
            Constraint::Percentage(percent_x),
            Constraint::Percentage((100 - percent_x) / 2),
        ])
        .split(popup_layout[1])[1]
}
