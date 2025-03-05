use ratatui::{
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Scrollbar, ScrollbarOrientation, ScrollbarState, Wrap},
    Frame,
};

use crate::app::Message;
use crate::util::theme::Theme;

pub struct MessagesPane<'a> {
    pub messages: &'a Vec<Message>,
    pub message_scroll: usize,
    pub is_focused: bool,
    pub theme: &'a Theme,
}

impl<'a> MessagesPane<'a> {
    pub fn new(
        messages: &'a Vec<Message>,
        message_scroll: usize,
        is_focused: bool,
        theme: &'a Theme,
    ) -> Self {
        Self {
            messages,
            message_scroll,
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

        let messages_block = Block::default()
            .title(Line::from(vec![
                Span::styled("  ", Style::default().bg(self.theme.primary)),
                Span::styled(
                    " Messages ",
                    Style::default().fg(self.theme.primary_foreground),
                ),
            ]))
            .borders(Borders::ALL)
            .border_style(Style::default().fg(border_color));

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
                // Create a modern message bubble style
                let (bg_color, fg_color, prefix, name_style) = if message.is_user {
                    (
                        self.theme.accent,
                        self.theme.accent_foreground,
                        "You",
                        Style::default()
                            .fg(self.theme.primary)
                            .add_modifier(Modifier::BOLD),
                    )
                } else {
                    (
                        self.theme.muted,
                        self.theme.foreground,
                        "AI",
                        Style::default()
                            .fg(self.theme.success)
                            .add_modifier(Modifier::BOLD),
                    )
                };

                // Highlight the selected message
                let (bg, fg) = if i == self.message_scroll {
                    (
                        if message.is_user {
                            self.theme.primary
                        } else {
                            self.theme.success
                        },
                        self.theme.selection_foreground,
                    )
                } else {
                    (bg_color, fg_color)
                };

                // Create a modern message bubble with sender name
                let spans = vec![
                    Span::styled(format!("{}: ", prefix), name_style),
                    Span::styled(message.content.clone(), Style::default().fg(fg)),
                ];

                Line::from(spans).style(Style::default().bg(if i == self.message_scroll {
                    bg
                } else {
                    self.theme.background
                }))
            })
            .collect::<Vec<Line>>();

        // Create paragraph with appropriate alignment
        let messages_paragraph = Paragraph::new(messages_text)
            .block(messages_block)
            .style(Style::default().bg(self.theme.background))
            .wrap(Wrap { trim: true });

        frame.render_widget(messages_paragraph, area);

        // Only render scrollbar if there are more messages than can fit in the view
        if self.messages.len() > max_visible_messages {
            let scrollbar_state =
                ScrollbarState::new(self.messages.len()).position(scroll_position);

            let scrollbar = Scrollbar::new(ScrollbarOrientation::VerticalRight)
                .style(Style::default().fg(self.theme.muted))
                .thumb_style(Style::default().fg(if self.is_focused {
                    self.theme.primary
                } else {
                    self.theme.muted_foreground
                }));

            frame.render_stateful_widget(
                scrollbar,
                Rect::new(area.right() - 1, area.y + 1, 1, area.height - 2),
                &mut scrollbar_state.clone(),
            );
        }
    }
}
