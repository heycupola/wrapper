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

pub struct PlanInfo<'a> {
    pub theme: &'a Theme,
}

impl<'a> PlanInfo<'a> {
    pub fn new(theme: &'a Theme) -> Self {
        Self { theme }
    }

    pub fn render(&self, frame: &mut Frame, area: Rect) {
        // TODO: fetch the data dynamically here
        let plan_text = vec![Line::from(Span::styled(
            format!("Current plan: {}", "Free hey"),
            Style::default().fg(self.theme.foreground),
        ))];

        frame.render_widget(
            Paragraph::new(plan_text)
                .block(render_content_block(
                    self.theme,
                    &true,
                    Some("plan"),
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
