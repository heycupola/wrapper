use crate::util::renderer::render_content_block;
use crate::util::theme::Theme;
use ratatui::layout::Rect;
use ratatui::widgets::Wrap;
use ratatui::{
    style::Style,
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

pub struct AccountInfo<'a> {
    pub theme: &'a Theme,
    pub email: &'a str,
    pub remaining_messages: u32,
}

impl<'a> AccountInfo<'a> {
    pub fn new(theme: &'a Theme, email: &'a str, remaining_messages: u32) -> Self {
        Self {
            theme,
            email,
            remaining_messages,
        }
    }

    pub fn render(&self, frame: &mut Frame, area: Rect) {
        // TODO: fetch the data dynamically here
        let account_text = vec![
            Line::from(Span::styled(
                format!("Email: {}", self.email),
                Style::default().fg(self.theme.foreground),
            )),
            Line::from(Span::styled(
                format!("Remaining Messages: {}", self.remaining_messages),
                Style::default().fg(self.theme.foreground),
            )),
            Line::from(""),
            Line::from(Span::styled(
                "Press 'o' to log out",
                Style::default().fg(self.theme.warning),
            )),
        ];

        frame.render_widget(
            Paragraph::new(account_text)
                .block(render_content_block(
                    self.theme,
                    &true,
                    Some("account"),
                    None,
                    None,
                    None,
                ))
                .style(Style::default().bg(self.theme.background))
                .wrap(Wrap { trim: true }),
            area,
        );
    }
}
