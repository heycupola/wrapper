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

pub struct SyncBox<'a> {
    pub theme: &'a Theme,
}

impl<'a> SyncBox<'a> {
    pub fn new(theme: &'a Theme) -> Self {
        Self { theme }
    }

    pub fn render(&self, frame: &mut Frame, area: Rect) {
        // TODO: fetch the data dynamically here
        let sync_text = vec![Line::from(Span::styled(
            format!("Last sync: {}", "24hrs ago"),
            Style::default().fg(self.theme.foreground),
        ))];

        frame.render_widget(
            Paragraph::new(sync_text)
                .block(render_content_block(
                    self.theme,
                    &true,
                    Some("sync"),
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
