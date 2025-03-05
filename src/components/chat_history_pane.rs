use ratatui::{
    layout::Rect,
    style::{Color, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem},
    Frame,
};

pub struct ChatHistoryPane<'a> {
    pub chat_history: &'a Vec<String>,
    pub history_scroll: usize,
    pub is_focused: bool,
}

impl<'a> ChatHistoryPane<'a> {
    pub fn new(chat_history: &'a Vec<String>, history_scroll: usize, is_focused: bool) -> Self {
        Self {
            chat_history,
            history_scroll,
            is_focused,
        }
    }

    pub fn render(&self, frame: &mut Frame, area: Rect) {
        let chat_history_block = Block::default()
            .title("Chat History (Enter to select)")
            .borders(Borders::ALL)
            .style(if self.is_focused {
                Style::default().fg(Color::Yellow)
            } else {
                Style::default()
            });

        let chat_history_items: Vec<ListItem> = self
            .chat_history
            .iter()
            .enumerate()
            .map(|(i, chat)| {
                let style = if i == self.history_scroll {
                    Style::default().fg(Color::Yellow).bg(Color::DarkGray)
                } else {
                    Style::default().fg(Color::White)
                };

                ListItem::new(Line::from(Span::styled(chat, style)))
            })
            .collect();

        let chat_history_list = List::new(chat_history_items).block(chat_history_block);

        frame.render_widget(chat_history_list, area);
    }
}
