use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::Style,
    text::Text,
    widgets::{Borders, Clear, Paragraph, Wrap},
    Frame,
};

use crate::{
    app::{App, PositionOnChat, Screen},
    components::{
        account_info::AccountInfo, footer::Footer, plan_info::PlanInfo, quota_info::QuotaInfo,
        sync_box::SyncBox,
    },
};
use crate::{
    components::keybinds::Keybinds,
    util::{
        renderer::centered_rect,
        theme::{current_theme, Theme},
    },
};
use crate::{
    components::{
        chat_box::ChatBox, chat_history_pane::ChatHistoryPane, constraints_box::ConstraintsBox,
        messages_pane::MessagesPane, navbar::Navbar,
    },
    util::renderer::render_content_block,
};

pub fn ui(frame: &mut Frame, app: &App) {
    let theme = current_theme();

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

    // NOTE: this is our main area that represents screen with padding in x and y axes
    let centered_area = centered_rect(70, 90, frame.area());

    fn adjust_main_layout(f: &mut Frame, app: &App, theme: &Theme, centered_area: Rect) -> Rect {
        let layout = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(3),
                Constraint::Min(1),
                Constraint::Length(3),
            ])
            .split(centered_area);

        Navbar::new(&app.current_screen, theme, "wrapper").render(f, layout[0]);

        Footer::new(
            &app.current_screen,
            theme,
            &app.position_on_chat,
            Some(app.user.is_logged_in),
        )
        .render(f, layout[2]);

        layout[1]
    }

    let main_layout = match &app.current_screen {
        Screen::Chat | Screen::Account => {
            Some(adjust_main_layout(frame, app, &theme, centered_area))
        }
        _ => None,
    };

    match &app.current_screen {
        Screen::Chat => draw_chat_screen(frame, app, &theme, main_layout.unwrap()),
        Screen::Account => draw_account_screen(frame, app, &theme, main_layout.unwrap()),
        Screen::Exit => draw_exit_screen(frame, &theme, centered_area),
    }
}

fn draw_chat_screen(frame: &mut Frame, app: &App, theme: &Theme, area: Rect) {
    let content_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(20), // chat history
            Constraint::Percentage(80), // messages and input
        ])
        .split(area);

    // layout for chat history pane and constraints box
    let left_side_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Min(1), Constraint::Length(5)])
        .split(content_chunks[0]);

    // render chat history pane
    ChatHistoryPane::new(
        &app.chat_history,
        app.history_scroll,
        matches!(app.position_on_chat, Some(PositionOnChat::ChatHistory)),
        theme,
    )
    .render(frame, left_side_chunks[0]);

    // render constraints box
    ConstraintsBox::new(&app.model, theme, app.reason, app.search_on_web)
        .render(frame, left_side_chunks[1]);

    // layout for messages and chat box
    let right_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Min(1),    // Messages
            Constraint::Length(5), // Input
        ])
        .split(content_chunks[1]);

    // render messages pane
    MessagesPane::new(
        &app.messages,
        app.message_scroll,
        matches!(app.position_on_chat, Some(PositionOnChat::Messages)),
        theme,
    )
    .render(frame, right_chunks[0]);

    // render chatbox
    let mut chat_box = ChatBox::new(
        &app.input,
        matches!(app.position_on_chat, Some(PositionOnChat::ChatBox)),
        theme,
    );

    chat_box.cursor_position = app.cursor_position;

    chat_box.render(frame, right_chunks[1]);
}

fn draw_account_screen(frame: &mut Frame, app: &App, theme: &Theme, area: Rect) {
    let content_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(area);

    let upper_content_layout = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(33),
            Constraint::Percentage(33),
            Constraint::Percentage(33),
        ])
        .split(content_layout[0]);

    // render account info
    AccountInfo::new(&theme, &app.user.email, app.user.remaining_messages)
        .render(frame, upper_content_layout[0]);

    // render quota info
    QuotaInfo::new(&theme).render(frame, upper_content_layout[1]);

    // render plan info
    PlanInfo::new(&theme).render(frame, upper_content_layout[2]);

    let lower_content_layout = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(66), Constraint::Percentage(33)])
        .split(content_layout[1]);

    let keybinds_layout = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(lower_content_layout[0]);

    // render keybinds
    Keybinds::new(&theme).render(frame, [keybinds_layout[0], keybinds_layout[1]]);

    // NOTE: this rendering is for creating a background block for keybindings
    // because we need to give them a separate look
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

    // render syncbox
    SyncBox::new(&theme).render(frame, lower_content_layout[1]);

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
}

fn draw_exit_screen(frame: &mut Frame, theme: &Theme, area: Rect) {
    // Clear the area for the popup
    frame.render_widget(Clear, area);

    let bg_block = render_content_block(
        theme,
        &false,
        None,
        None,
        Some(Style::default().bg(theme.background)),
        None,
    );

    frame.render_widget(bg_block, area);

    let popup_block = render_content_block(
        theme,
        &Borders::ALL,
        Some("exit"),
        None,
        Some(Style::default().bg(theme.background)),
        Some(Style::default().fg(theme.destructive)),
    );

    let exit_text = Text::styled(
        "are you sure you want to exit? (y/n)",
        Style::default().fg(theme.destructive_foreground),
    );

    let exit_paragraph = Paragraph::new(exit_text)
        .block(popup_block)
        .wrap(Wrap { trim: false });

    let area = centered_rect(40, 25, area);

    frame.render_widget(exit_paragraph, area);
}
