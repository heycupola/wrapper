use ratatui::{
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Paragraph, Wrap},
    Frame,
};

use crate::app::Message;
use crate::util::{renderer::render_focusable_content_block, theme::Theme};

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
        let messages_block = render_focusable_content_block(
            self.theme,
            &true,
            Some("messages"),
            None,
            None,
            self.is_focused,
        );

        let messages_text = self
            .messages
            .iter()
            .enumerate()
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
    }
}
