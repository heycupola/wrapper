use ratatui::{
    layout::Rect,
    style::{Color, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph},
    Frame,
};

pub struct ModelsBox<'a> {
    pub available_models: &'a [String],
    pub current_model: &'a str,
    pub is_focused: bool,
    pub selected_index: usize,
}

impl<'a> ModelsBox<'a> {
    pub fn new(available_models: &'a [String], current_model: &'a str, is_focused: bool) -> Self {
        let selected_index = available_models
            .iter()
            .position(|m| m == current_model)
            .unwrap_or(0);

        Self {
            available_models,
            current_model,
            is_focused,
            selected_index,
        }
    }

    pub fn render(&self, frame: &mut Frame, area: Rect) {
        let title_block = Block::default()
            .borders(Borders::ALL)
            .style(if self.is_focused {
                Style::default().fg(Color::Yellow)
            } else {
                Style::default()
            });

        let models_text = self
            .available_models
            .iter()
            .enumerate()
            .map(|(i, m)| {
                let prefix = format!("{}. ", i + 1);
                if m == self.current_model {
                    Span::styled(
                        format!("{}{}", prefix, m),
                        Style::default().fg(Color::Yellow),
                    )
                } else {
                    Span::styled(
                        format!("{}{}", prefix, m),
                        Style::default().fg(Color::White),
                    )
                }
            })
            .collect::<Vec<Span>>();

        let mut title_spans = vec![Span::styled(
            "LLM Chat - Model: ",
            Style::default().fg(Color::Green),
        )];

        for (i, span) in models_text.into_iter().enumerate() {
            title_spans.push(span);
            if i < self.available_models.len() - 1 {
                title_spans.push(Span::styled(" | ", Style::default().fg(Color::DarkGray)));
            }
        }

        let title = Paragraph::new(Line::from(title_spans)).block(title_block);

        frame.render_widget(title, area);
    }
}
