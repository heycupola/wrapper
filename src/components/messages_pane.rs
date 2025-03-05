use ratatui::{
    layout::Rect,
    style::{Color, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Wrap},
    Frame,
};

use crate::app::Message;

pub struct MessagesPane<'a> {
    pub messages: &'a Vec<Message>,
    pub message_scroll: usize,
    pub is_focused: bool,
}

impl<'a> MessagesPane<'a> {
    pub fn new(messages: &'a Vec<Message>, message_scroll: usize, is_focused: bool) -> Self {
        Self {
            messages,
            message_scroll,
            is_focused,
        }
    }

    pub fn render(&self, frame: &mut Frame, area: Rect) {
        // Draw messages
        let messages_block = Block::default()
            .title("Messages")
            .borders(Borders::ALL)
            .style(if self.is_focused {
                Style::default().fg(Color::Yellow)
            } else {
                Style::default()
            });

        let messages_text = self
            .messages
            .iter()
            .enumerate()
            .map(|(i, message)| {
                let style = if i == self.message_scroll {
                    if message.is_user {
                        Style::default().fg(Color::Green).bg(Color::DarkGray)
                    } else {
                        Style::default().fg(Color::Cyan).bg(Color::DarkGray)
                    }
                } else {
                    if message.is_user {
                        Style::default().fg(Color::Green)
                    } else {
                        Style::default().fg(Color::Cyan)
                    }
                };

                if message.is_user {
                    Line::from(Span::styled(format!("You: {}", message.content), style))
                } else {
                    Line::from(Span::styled(format!("AI: {}", message.content), style))
                }
            })
            .collect::<Vec<Line>>();

        let messages_paragraph = Paragraph::new(messages_text)
            .block(messages_block)
            .wrap(Wrap { trim: true });

        frame.render_widget(messages_paragraph, area);
    }
}
