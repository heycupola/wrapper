use ratatui::{
    layout::Rect,
    style::Style,
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Wrap},
    Frame,
};

use crate::util::theme::Theme;

pub struct ChatBox<'a> {
    pub input: &'a String,
    pub is_focused: bool,
    pub theme: &'a Theme,
}

impl<'a> ChatBox<'a> {
    pub fn new(input: &'a String, is_focused: bool, theme: &'a Theme) -> Self {
        Self {
            input,
            is_focused,
            theme,
        }
    }

    pub fn render(&self, frame: &mut Frame, area: Rect) {
        let border_color = if self.is_focused {
            self.theme.focus
        } else {
            self.theme.border
        };

        let input_block = Block::default()
            .title(Line::from(vec![
                Span::styled("  ", Style::default().bg(self.theme.primary)),
                Span::styled(
                    " Input ",
                    Style::default().fg(self.theme.primary_foreground),
                ),
            ]))
            .borders(Borders::ALL)
            .border_style(Style::default().fg(border_color));

        let input_style = if self.is_focused {
            Style::default().fg(self.theme.foreground)
        } else {
            Style::default().fg(self.theme.muted_foreground)
        };

        let input_text = Paragraph::new(self.input.as_str())
            .style(input_style)
            .block(input_block)
            .wrap(Wrap { trim: true });

        frame.render_widget(input_text, area);
    }
}
