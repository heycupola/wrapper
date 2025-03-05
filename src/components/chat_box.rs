use ratatui::{
    layout::Rect,
    style::{Color, Style},
    widgets::{Block, Borders, Paragraph, Wrap},
    Frame,
};

pub struct ChatBox<'a> {
    pub input: &'a String,
    pub is_focused: bool,
}

impl<'a> ChatBox<'a> {
    pub fn new(input: &'a String, is_focused: bool) -> Self {
        Self { input, is_focused }
    }

    pub fn render(&self, frame: &mut Frame, area: Rect) {
        let input_block =
            Block::default()
                .title("Input")
                .borders(Borders::ALL)
                .style(if self.is_focused {
                    Style::default().fg(Color::Yellow)
                } else {
                    Style::default()
                });

        let input_text = Paragraph::new(self.input.as_str())
            .block(input_block)
            .wrap(Wrap { trim: true });

        frame.render_widget(input_text, area);
    }
}
