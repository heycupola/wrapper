use crate::app::{PositionOnChat, Screen};
use crate::util::theme::Theme;
use ratatui::layout::{Alignment, Rect};
use ratatui::{
    style::Style,
    text::Text,
    widgets::{Block, Borders, Paragraph},
    Frame,
};

pub struct Footer<'a> {
    pub current_screen: &'a Screen,
    pub theme: &'a Theme,
    pub position_on_chat: &'a Option<PositionOnChat>,
    pub is_logged_in: Option<bool>,
}

impl<'a> Footer<'a> {
    pub fn new(
        current_screen: &'a Screen,
        theme: &'a Theme,
        position_on_chat: &'a Option<PositionOnChat>,
        is_logged_in: Option<bool>,
    ) -> Self {
        Self {
            current_screen,
            theme,
            position_on_chat,
            is_logged_in,
        }
    }

    pub fn render(&self, frame: &mut Frame, area: Rect) {
        let footer_text = match self.current_screen {
            Screen::Chat => "ctrl+n: new chat | ctrl+l: messages | ctrl+h: history | ctrl+c: chat | ctrl+r: reason | ctrl+w: search on web",
            Screen::Account => {
                if self.is_logged_in.unwrap_or(false) {
                    "o: logout | q: exit"
                } else {
                    "l: login | q: exit"
                }
            }
            Screen::Exit => "",
        };

        let footer = Paragraph::new(Text::styled(
            footer_text,
            Style::default().fg(self.theme.muted_foreground),
        ))
        .alignment(Alignment::Center)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(self.theme.border)),
        );

        frame.render_widget(footer, area);
    }
}
