use ratatui::{
    layout::Rect,
    style::{Color, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Scrollbar, ScrollbarOrientation, ScrollbarState, Wrap},
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
        let messages_block = Block::default()
            .title("Messages")
            .borders(Borders::ALL)
            .style(if self.is_focused {
                Style::default().fg(Color::Yellow)
            } else {
                Style::default()
            });

        let inner_area = messages_block.inner(area);
        let max_visible_messages = inner_area.height as usize;

        let scroll_position = if self.messages.len() <= max_visible_messages {
            // If all messages fit, no need to scroll
            0
        } else if self.message_scroll >= self.messages.len() - 1 {
            // If at the last message, always show the last page of messages
            // This ensures the latest message is visible and sticks to the bottom
            self.messages.len().saturating_sub(max_visible_messages)
        } else if self.message_scroll < max_visible_messages / 2 {
            // If near the beginning, show from the start
            0
        } else {
            // For messages in the middle, center the selected message
            // But ensure we don't go beyond the last page
            let centered_position = self.message_scroll.saturating_sub(max_visible_messages / 2);
            let max_scroll = self.messages.len().saturating_sub(max_visible_messages);

            centered_position.min(max_scroll)
        };

        let messages_text = self
            .messages
            .iter()
            .enumerate()
            .skip(scroll_position)
            .take(max_visible_messages)
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

        // Create paragraph with appropriate alignment
        let messages_paragraph = Paragraph::new(messages_text)
            .block(messages_block)
            .wrap(Wrap { trim: true });

        frame.render_widget(messages_paragraph, area);

        // Only render scrollbar if there are more messages than can fit in the view
        if self.messages.len() > max_visible_messages {
            let scrollbar_state =
                ScrollbarState::new(self.messages.len()).position(scroll_position);

            let scrollbar = Scrollbar::new(ScrollbarOrientation::VerticalRight)
                .style(Style::default().fg(Color::White))
                .thumb_style(if self.is_focused {
                    Style::default().fg(Color::Yellow)
                } else {
                    Style::default().fg(Color::DarkGray)
                });

            frame.render_stateful_widget(
                scrollbar,
                Rect::new(area.right() - 1, area.y + 1, 1, area.height - 2),
                &mut scrollbar_state.clone(),
            );
        }
    }
}
