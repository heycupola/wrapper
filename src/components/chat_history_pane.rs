use ratatui::{
    layout::Alignment,
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem},
    Frame,
};

use crate::util::theme::Theme;

pub struct ChatHistoryPane<'a> {
    pub chat_history: &'a Vec<String>,
    pub history_scroll: usize,
    pub is_focused: bool,
    pub theme: &'a Theme,
}

impl<'a> ChatHistoryPane<'a> {
    pub fn new(
        chat_history: &'a Vec<String>,
        history_scroll: usize,
        is_focused: bool,
        theme: &'a Theme,
    ) -> Self {
        Self {
            chat_history,
            history_scroll,
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

        let chat_history_block = Block::default()
            .title(
                Line::from(vec![
                    Span::styled("  ", Style::default().bg(self.theme.primary)),
                    Span::styled(
                        " Chat History ",
                        Style::default().fg(self.theme.primary_foreground),
                    ),
                ])
                .alignment(Alignment::Center),
            )
            .borders(Borders::ALL)
            .border_style(Style::default().fg(border_color));

        let chat_history_items: Vec<ListItem> = self
            .chat_history
            .iter()
            .enumerate()
            .map(|(i, chat)| {
                let style = if i == self.history_scroll {
                    Style::default()
                        .fg(self.theme.selection_foreground)
                        .bg(self.theme.selection)
                        .add_modifier(Modifier::BOLD)
                } else {
                    Style::default().fg(self.theme.foreground)
                };

                // Create a more visually appealing list item with a bullet point
                let content = if i == self.history_scroll {
                    format!(" ● {}", chat)
                } else {
                    format!(" ○ {}", chat)
                };

                ListItem::new(Line::from(Span::styled(content, style)))
                    .style(Style::default().bg(self.theme.background))
            })
            .collect();

        let chat_history_list = List::new(chat_history_items)
            .block(chat_history_block)
            .highlight_style(
                Style::default()
                    .bg(self.theme.selection)
                    .fg(self.theme.selection_foreground)
                    .add_modifier(Modifier::BOLD),
            );

        frame.render_widget(chat_history_list, area);
    }
}
