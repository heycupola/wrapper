use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Clear, Paragraph, Wrap},
    Frame,
};

use crate::util::theme::{current_theme, Theme};
use crate::{
    app::{App, PositionOnChat, Screen},
    components::footer::Footer,
};
use crate::{
    components::{
        chat_box::ChatBox, chat_history_pane::ChatHistoryPane, constraints_box::ConstraintsBox,
        messages_pane::MessagesPane, navbar::Navbar,
    },
    util::renderer::render_content_block,
};

pub fn ui(frame: &mut Frame, app: &App) {
    // Get the current theme
    let theme = current_theme();

    // Set the background color for the entire frame
    frame.render_widget(
        render_content_block(
            &theme,
            &false,
            None,
            None,
            Some(Style::default().bg(theme.background)),
            None,
        ),
        frame.area(),
    );

    // Create a centered area with padding on all sides
    let centered_area = centered_rect(70, 90, frame.area());

    match app.current_screen {
        Screen::Chat => draw_chat_screen(frame, app, &theme, centered_area),
        Screen::Account => draw_account_screen(frame, app, &theme, centered_area),
        Screen::Exit => draw_exit_screen(frame, &theme, centered_area),
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
    let constraints_box = ConstraintsBox::new(&app.model, theme, app.reason, app.search_on_web);
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
            Constraint::Min(1),    // Content
            Constraint::Length(3), // Footer
        ])
        .split(area);

    let content_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(chunks[1]);

    let upper_content_layout = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(33),
            Constraint::Percentage(33),
            Constraint::Percentage(33),
        ])
        .split(content_layout[0]);

    let lower_content_layout = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(66), Constraint::Percentage(33)])
        .split(content_layout[1]);

    // headings: account, quota, plan
    let account_text = vec![
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
    ];

    let quota_text = vec![Line::from(Span::styled(
        format!("Remaining Quota: {}", "31"),
        Style::default().fg(theme.foreground),
    ))];

    let plan_text = vec![Line::from(Span::styled(
        format!("Current plan: {}", "Free af"),
        Style::default().fg(theme.foreground),
    ))];

    frame.render_widget(
        Paragraph::new(account_text)
            .block(render_content_block(
                theme,
                &true,
                Some("account"),
                None,
                None,
                None,
            ))
            .style(Style::default().bg(theme.background))
            .wrap(Wrap { trim: true }),
        upper_content_layout[0],
    );

    frame.render_widget(
        Paragraph::new(quota_text)
            .block(render_content_block(
                theme,
                &true,
                Some("quota"),
                None,
                None,
                None,
            ))
            .style(Style::default().bg(theme.background))
            .wrap(Wrap { trim: true }),
        upper_content_layout[1],
    );

    frame.render_widget(
        Paragraph::new(plan_text)
            .block(render_content_block(
                theme,
                &true,
                Some("plan"),
                None,
                None,
                None,
            ))
            .style(Style::default().bg(theme.background))
            .wrap(Wrap { trim: true }),
        upper_content_layout[2],
    );

    let keybindings_layout = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(lower_content_layout[0]);

    let chat_keybindings_text = vec![
        Line::from(Span::styled(
            format!("chat keybindings:"),
            Style::default()
                .fg(theme.foreground)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(Span::styled(
            format!(" go chat: ctrl+c"),
            Style::default().fg(theme.foreground),
        )),
        Line::from(Span::styled(
            format!("go messages: ctrl+l"),
            Style::default().fg(theme.foreground),
        )),
    ];

    let account_keybindings_text = vec![
        Line::from(Span::styled(
            format!("account keybindings:"),
            Style::default()
                .fg(theme.foreground)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(Span::styled(
            format!("login: l"),
            Style::default().fg(theme.foreground),
        )),
        Line::from(Span::styled(
            format!("logout: o"),
            Style::default().fg(theme.foreground),
        )),
        Line::from(Span::styled(
            format!("chat: c"),
            Style::default().fg(theme.foreground),
        )),
    ];

    frame.render_widget(
        Paragraph::new(chat_keybindings_text)
            .block(render_content_block(
                theme,
                &false,
                None,
                Some(&1),
                None,
                None,
            ))
            .style(Style::default().bg(theme.background))
            .wrap(Wrap { trim: true }),
        keybindings_layout[0],
    );

    frame.render_widget(
        Paragraph::new(account_keybindings_text)
            .block(render_content_block(
                theme,
                &false,
                None,
                Some(&1),
                None,
                None,
            ))
            .style(Style::default().bg(theme.background))
            .wrap(Wrap { trim: true }),
        keybindings_layout[1],
    );

    frame.render_widget(
        Paragraph::new("")
            .block(render_content_block(
                theme,
                &true,
                Some("plan"),
                None,
                None,
                None,
            ))
            .style(Style::default().bg(theme.background))
            .wrap(Wrap { trim: true }),
        lower_content_layout[0],
    );

    let sync_text = vec![Line::from(Span::styled(
        format!("Last sync: {}", "24hrs ago"),
        Style::default().fg(theme.foreground),
    ))];

    frame.render_widget(
        Paragraph::new(sync_text)
            .block(render_content_block(
                theme,
                &true,
                Some("sync"),
                None,
                None,
                None,
            ))
            .style(Style::default().bg(theme.background))
            .wrap(Wrap { trim: true }),
        lower_content_layout[1],
    );

    // Render the navbar
    let navbar = Navbar::new(&app.current_screen, theme, "Wrapper");
    navbar.render(frame, chunks[0]);

    // TODO: we're gonna render here after figuring out the desing of the account page with
    // authenticated account
    // login box
    // let login_box = centered_rect(40, 40, chunks[1]);

    // let login_box_block = Block::default()
    //     .borders(Borders::ALL)
    //     .border_style(Style::new().fg(theme.border));

    // let login_box_heading = Line::from(vec![
    //     Span::styled("log in to ", Style::default().add_modifier(Modifier::BOLD)),
    //     Span::styled(
    //         "wrapper.sh",
    //         Style::default()
    //             .fg(theme.primary)
    //             .add_modifier(Modifier::BOLD),
    //     ),
    // ]);

    // let login_hero_paragraph = Paragraph::new(login_box_heading)
    //     .alignment(Alignment::Center)
    //     .block(login_box_block)
    //     .style(Style::default().bg(theme.background))
    //     .wrap(Wrap { trim: true });

    // frame.render_widget(login_hero_paragraph, login_box);

    // Footer component
    let footer = Footer::new(
        &app.current_screen,
        theme,
        &app.position_on_chat,
        Some(app.user.is_logged_in),
    );

    footer.render(frame, chunks[2]);
}

fn draw_exit_screen(frame: &mut Frame, theme: &Theme, area: Rect) {
    // Set background
    frame.render_widget(
        render_content_block(theme, &false, None, None, None, None),
        frame.area(),
    );

    // Clear the area for the popup
    frame.render_widget(Clear, area);

    let popup_block = render_content_block(
        theme,
        &Borders::ALL,
        Some("exit"),
        None,
        Some(Style::default().bg(theme.muted)),
        Some(Style::default().fg(theme.destructive)),
    );

    let exit_text = Text::styled(
        "Are you sure you want to exit? (y/n)",
        Style::default().fg(theme.destructive_foreground),
    );

    let exit_paragraph = Paragraph::new(exit_text)
        .block(popup_block)
        .wrap(Wrap { trim: false });

    let area = centered_rect(60, 25, area);
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
