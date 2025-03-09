use crate::util::renderer::render_content_block;
use crate::util::theme::Theme;
use ratatui::layout::Rect;
use ratatui::widgets::Wrap;
use ratatui::{
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

pub struct Keybinds<'a> {
    pub theme: &'a Theme,
}

impl<'a> Keybinds<'a> {
    pub fn new(theme: &'a Theme) -> Self {
        Self { theme }
    }

    pub fn render(&self, frame: &mut Frame, areas: [Rect; 2]) {
        let adjust_text = |title: &'a str, keybinds: Vec<&'a str>| -> Vec<Line<'a>> {
            let lines: Vec<Line<'a>> = keybinds
                .iter()
                .map(|&item| {
                    Line::from(Span::styled(
                        item, // Borrowing directly
                        Style::default().fg(self.theme.foreground),
                    ))
                })
                .collect();

            let mut all_lines = vec![Line::from(Span::styled(
                title, // Borrowing directly
                Style::default()
                    .fg(self.theme.foreground)
                    .add_modifier(Modifier::BOLD),
            ))];

            all_lines.extend(lines);
            all_lines
        };

        // TODO: fetch here dynamically in the future
        let chat_keybinds = adjust_text(
            "chat keybinds:",
            vec!["go chat: <C-c>", "go messages: <C-l>"],
        );
        let account_keybinds =
            adjust_text("account keybinds:", vec!["login l", "logout: o", "chat: c"]);

        let render_paragraph = |keybinds: Vec<Line<'a>>| {
            Paragraph::new(keybinds) // Now it takes ownership
                .block(render_content_block(
                    self.theme,
                    &false,
                    None,
                    Some(&1),
                    None,
                    None,
                ))
                .style(Style::default().bg(self.theme.background))
                .wrap(Wrap { trim: true })
        };

        frame.render_widget(render_paragraph(chat_keybinds), areas[0]);
        frame.render_widget(render_paragraph(account_keybinds), areas[1]);
    }
}
