use ratatui::{
    layout::Rect,
    style::Style,
    text::{Line, Span},
    widgets::{Paragraph, Wrap},
    Frame,
};

use crate::util::{renderer::render_focusable_content_block, theme::Theme};

pub struct ChatBox<'a> {
    pub input: &'a String,
    pub is_focused: bool,
    pub theme: &'a Theme,
    pub cursor_position: usize,
}

impl<'a> ChatBox<'a> {
    pub fn new(input: &'a String, is_focused: bool, theme: &'a Theme) -> Self {
        Self {
            input,
            is_focused,
            theme,
            cursor_position: input.len(), // Default cursor position at the end of input
        }
    }

    pub fn render(&self, frame: &mut Frame, area: Rect) {
        let input_block = render_focusable_content_block(
            self.theme,
            &true,
            Some("input"),
            None,
            None,
            self.is_focused,
        );

        let input_style = if self.is_focused {
            Style::default().fg(self.theme.foreground)
        } else {
            Style::default().fg(self.theme.muted_foreground)
        };

        // Determine if we need to show placeholder text or cursor
        let display_text = if self.input.is_empty() {
            // Show placeholder when input is empty
            vec![Span::styled(
                "prompt here...",
                Style::default().fg(self.theme.muted_foreground),
            )]
        } else {
            let mut spans = Vec::new();
            let input_str = self.input.as_str();

            // If focused, split the text at cursor position and insert the cursor
            if self.is_focused {
                let cursor_pos = self.cursor_position.min(input_str.len());

                // Text before cursor
                if cursor_pos > 0 {
                    let before_cursor = &input_str[..cursor_pos];
                    spans.push(Span::styled(before_cursor, input_style));
                }

                // Cursor (Neovim normal mode style block cursor)
                let cursor_char = if cursor_pos < input_str.len() {
                    // If cursor is within text, highlight the character at cursor position
                    input_str[cursor_pos..]
                        .chars()
                        .next()
                        .unwrap_or(' ')
                        .to_string()
                } else {
                    // If cursor is at the end, use a space
                    " ".to_string()
                };

                spans.push(Span::styled(
                    cursor_char.clone(),
                    Style::default()
                        .bg(self.theme.foreground)
                        .fg(self.theme.background),
                ));

                // Text after cursor
                if cursor_pos < input_str.len() {
                    // Skip the character that's being used for the cursor
                    let after_cursor_start = cursor_pos + 1; // Just skip one character
                    if after_cursor_start < input_str.len() {
                        let after_cursor = &input_str[after_cursor_start..];
                        spans.push(Span::styled(after_cursor, input_style));
                    }
                }
            } else {
                // If not focused, just show the text
                spans.push(Span::styled(input_str, input_style));
            }

            // Add the "press enter to prompt" hint at the end
            spans.push(Span::styled(
                " ⏎",
                Style::default().fg(self.theme.muted_foreground),
            ));

            spans
        };

        let input_text = Paragraph::new(Line::from(display_text))
            .style(input_style)
            .block(input_block)
            .wrap(Wrap { trim: true });

        frame.render_widget(input_text, area);
    }

    // Method to move cursor left
    pub fn move_cursor_left(&mut self) {
        if self.cursor_position > 0 {
            self.cursor_position -= 1;
        }
    }

    // Method to move cursor right
    pub fn move_cursor_right(&mut self) {
        if self.cursor_position < self.input.len() {
            self.cursor_position += 1;
        }
    }

    // Method to set cursor to a specific position
    pub fn set_cursor_position(&mut self, position: usize) {
        self.cursor_position = position.min(self.input.len());
    }

    // Method to move cursor to the start of the input
    pub fn cursor_to_start(&mut self) {
        self.cursor_position = 0;
    }

    // Method to move cursor to the end of the input
    pub fn cursor_to_end(&mut self) {
        self.cursor_position = self.input.len();
    }
}
