use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Clear, Paragraph, Wrap},
    Frame,
};

use crate::app::{App, PositionOnChat, Screen};
use crate::components::{
    chat_box::ChatBox, chat_history_pane::ChatHistoryPane, messages_pane::MessagesPane,
    models_box::ModelsBox,
};
use crate::util::theme::{current_theme, Theme};

pub fn ui(frame: &mut Frame, app: &App) {
    // Get the current theme
    let theme = current_theme();

    // Set the background color for the entire frame
    frame.render_widget(
        Block::default().style(Style::default().bg(theme.background)),
        frame.area(),
    );

    match app.current_screen {
        Screen::Chat => draw_chat_screen(frame, app, &theme),
        Screen::Account => draw_account_screen(frame, app, &theme),
        Screen::Exit => draw_exit_screen(frame, app, &theme),
    }
}

fn draw_chat_screen(frame: &mut Frame, app: &App, theme: &Theme) {
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
    let models_box = ModelsBox::new(&app.available_models, &app.model, theme);
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
        theme,
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
        theme,
    );

    messages_pane.render(frame, right_chunks[0]);

    // ChatBox component
    let chat_box = ChatBox::new(
        &app.input,
        matches!(app.position_on_chat, Some(PositionOnChat::ChatBox)),
        theme,
    );

    chat_box.render(frame, right_chunks[1]);

    // Draw footer with help text
    let footer_text = if app.is_prompting {
        "Ctrl+Q: Cancel | Ctrl+Arrow Keys: Navigate"
    } else {
        "Enter: Send | Tab: Change Model | Alt+1-5: Quick Model Select | Ctrl+N: New Chat | Ctrl+Arrow Keys: Navigate | Up/Down: Scroll | Ctrl+A: Account | Esc: Exit"
    };

    let footer = Paragraph::new(Text::styled(
        footer_text,
        Style::default().fg(theme.muted_foreground),
    ))
    .block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(theme.border)),
    );

    frame.render_widget(footer, main_chunks[2]);
}

fn draw_account_screen(frame: &mut Frame, app: &App, theme: &Theme) {
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
        .border_style(Style::default().fg(theme.border))
        .style(Style::default().bg(theme.background));

    let title = Paragraph::new(Line::from(vec![
        Span::styled("  ", Style::default().bg(theme.primary)),
        Span::styled(
            " Account Information ",
            Style::default()
                .fg(theme.primary)
                .add_modifier(Modifier::BOLD),
        ),
    ]))
    .block(title_block);

    frame.render_widget(title, chunks[0]);

    // Draw account information
    let account_block = Block::default()
        .title(Line::from(vec![
            Span::styled("  ", Style::default().bg(theme.primary)),
            Span::styled(" Account ", Style::default().fg(theme.primary_foreground)),
        ]))
        .borders(Borders::ALL)
        .border_style(Style::default().fg(theme.border));

    let account_text = if app.user.is_logged_in {
        vec![
            Line::from(Span::styled(
                format!("Email: {}", app.user.email),
                Style::default().fg(theme.foreground),
            )),
            Line::from(Span::styled(
                format!("Remaining Messages: {}", app.user.remaining_messages),
                Style::default().fg(theme.foreground),
            )),
            Line::from(""),
            Line::from(Span::styled(
                "Press 'o' to log out",
                Style::default().fg(theme.warning),
            )),
        ]
    } else {
        vec![
            Line::from(Span::styled(
                "You are not logged in",
                Style::default().fg(theme.destructive),
            )),
            Line::from(""),
            Line::from(Span::styled(
                "Press 'l' to log in",
                Style::default().fg(theme.primary),
            )),
        ]
    };

    let account_paragraph = Paragraph::new(account_text)
        .block(account_block)
        .style(Style::default().bg(theme.background))
        .wrap(Wrap { trim: true });

    frame.render_widget(account_paragraph, chunks[1]);

    // Draw footer
    let footer = Paragraph::new(Text::styled(
        "c: Chat | q: Exit",
        Style::default().fg(theme.muted_foreground),
    ))
    .block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(theme.border)),
    );

    frame.render_widget(footer, chunks[2]);
}

fn draw_exit_screen(frame: &mut Frame, app: &App, theme: &Theme) {
    frame.render_widget(Clear, frame.area());

    // Set background
    frame.render_widget(
        Block::default().style(Style::default().bg(theme.background)),
        frame.area(),
    );

    let popup_block = Block::default()
        .title(Line::from(vec![
            Span::styled("  ", Style::default().bg(theme.destructive)),
            Span::styled(
                " Exit ",
                Style::default()
                    .fg(theme.destructive)
                    .add_modifier(Modifier::BOLD),
            ),
        ]))
        .borders(Borders::ALL)
        .border_style(Style::default().fg(theme.destructive))
        .style(Style::default().bg(theme.muted));

    let exit_text = Text::styled(
        "Are you sure you want to exit? (y/n)",
        Style::default().fg(theme.destructive_foreground),
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
