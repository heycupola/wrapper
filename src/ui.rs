use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Clear, Paragraph, Wrap},
    Frame,
};

use crate::components::{
    chat_box::ChatBox, chat_history_pane::ChatHistoryPane, constraints_box::ConstraintsBox,
    messages_pane::MessagesPane, navbar::Navbar,
};
use crate::util::theme::{current_theme, Theme};
use crate::{
    app::{App, PositionOnChat, Screen},
    components::footer::Footer,
};

pub fn ui(frame: &mut Frame, app: &App) {
    // Get the current theme
    let theme = current_theme();

    // Set the background color for the entire frame
    frame.render_widget(
        Block::default().style(Style::default().bg(theme.background)),
        frame.area(),
    );

    // Create a centered area with padding on all sides
    let centered_area = centered_rect(70, 90, frame.area());

    match app.current_screen {
        Screen::Chat => draw_chat_screen(frame, app, &theme, centered_area),
        Screen::Account => draw_account_screen(frame, app, &theme, centered_area),
        Screen::Exit => draw_exit_screen(frame, app, &theme, centered_area),
    }
}

fn draw_chat_screen(frame: &mut Frame, app: &App, theme: &Theme, area: Rect) {
    // Create main layout with navbar, title and content
    let main_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Navbar
            Constraint::Min(1),    // Content -> History + Messages + Input
            Constraint::Length(3), // Footer
        ])
        .split(area);

    // Render the navbar
    let navbar = Navbar::new(&app.current_screen, theme, "Wrapper");
    navbar.render(frame, main_chunks[0]);

    // Split content horizontally for chat history and messages/input
    let content_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(20), // Chat history
            Constraint::Percentage(80), // Messages and input
        ])
        .split(main_chunks[1]);

    let left_side_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Min(1), Constraint::Length(5)])
        .split(content_chunks[0]);

    // ChatHistoryPane component
    let chat_history_pane = ChatHistoryPane::new(
        &app.chat_history,
        app.history_scroll,
        matches!(app.position_on_chat, Some(PositionOnChat::ChatHistory)),
        theme,
    );

    chat_history_pane.render(frame, left_side_chunks[0]);

    // ModelsBox component
    let constraints_box = ConstraintsBox::new(&app.model, theme, app.reason, app.search);
    constraints_box.render(frame, left_side_chunks[1]);

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
    let mut chat_box = ChatBox::new(
        &app.input,
        matches!(app.position_on_chat, Some(PositionOnChat::ChatBox)),
        theme,
    );

    chat_box.cursor_position = app.cursor_position;

    chat_box.render(frame, right_chunks[1]);

    // Footer component
    let footer = Footer::new(&app.current_screen, theme, &app.position_on_chat, None);

    footer.render(frame, main_chunks[2]);
}

fn draw_account_screen(frame: &mut Frame, app: &App, theme: &Theme, area: Rect) {
    // Create main layout
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Navbar
            Constraint::Length(3), // Title
            Constraint::Min(1),    // Content
            Constraint::Length(3), // Footer
        ])
        .split(area);

    // Render the navbar
    let navbar = Navbar::new(&app.current_screen, theme, "Wrapper");
    navbar.render(frame, chunks[0]);

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

    frame.render_widget(title, chunks[1]);

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

    frame.render_widget(account_paragraph, chunks[2]);

    // Footer component
    let footer = Footer::new(
        &app.current_screen,
        theme,
        &app.position_on_chat,
        Some(app.user.is_logged_in),
    );

    footer.render(frame, chunks[3]);
}

fn draw_exit_screen(frame: &mut Frame, app: &App, theme: &Theme, area: Rect) {
    // Set background
    frame.render_widget(
        Block::default().style(Style::default().bg(theme.background)),
        frame.area(),
    );

    // Create main layout with navbar
    let main_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Navbar
            Constraint::Min(1),    // Exit popup content
        ])
        .split(area);

    // Render the navbar
    let navbar = Navbar::new(&app.current_screen, theme, "Wrapper");
    navbar.render(frame, main_chunks[0]);

    // Clear the area for the popup
    frame.render_widget(Clear, main_chunks[1]);

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

    let area = centered_rect(60, 25, main_chunks[1]);
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
