use crate::app::Screen;
use crate::util::renderer::render_content_block;
use crate::util::theme::Theme;
use ratatui::layout::{Alignment, Rect};
use ratatui::{
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

pub struct Navbar<'a> {
    pub current_screen: &'a Screen,
    pub theme: &'a Theme,
    pub app_name: &'a str,
}

impl<'a> Navbar<'a> {
    pub fn new(current_screen: &'a Screen, theme: &'a Theme, app_name: &'a str) -> Self {
        Self {
            current_screen,
            theme,
            app_name,
        }
    }

    pub fn render(&self, frame: &mut Frame, area: Rect) {
        // Create the app name section - now without background color
        let app_name_span = Span::styled(
            format!(" {} ", self.app_name),
            Style::default()
                .fg(self.theme.primary)
                .add_modifier(Modifier::BOLD),
        );

        // Create the tabs
        let chat_tab_style = if matches!(self.current_screen, Screen::Chat) {
            Style::default()
                .fg(self.theme.primary_foreground)
                .bg(self.theme.primary)
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(self.theme.muted_foreground)
        };

        let account_tab_style = if matches!(self.current_screen, Screen::Account) {
            Style::default()
                .fg(self.theme.primary_foreground)
                .bg(self.theme.primary)
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(self.theme.muted_foreground)
        };

        let chat_tab = Span::styled(" c chat ", chat_tab_style);
        let account_tab = Span::styled(" ctrl+a account ", account_tab_style);

        // Combine all elements into a single line
        let navbar_line = Line::from(vec![
            app_name_span,
            Span::styled(" | ", Style::default().fg(self.theme.border)),
            chat_tab,
            Span::styled(" | ", Style::default().fg(self.theme.border)),
            account_tab,
        ]);

        // Create the navbar paragraph
        let navbar = Paragraph::new(navbar_line)
            .alignment(Alignment::Center)
            .block(render_content_block(
                self.theme, &true, None, None, None, None,
            ));

        frame.render_widget(navbar, area);
    }
}
