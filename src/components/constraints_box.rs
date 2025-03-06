use ratatui::{
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    symbols,
    text::{Line, Span},
    widgets::{Block, Borders, Padding, Paragraph},
    Frame,
};

use crate::util::theme::Theme;
pub struct ConstraintsBox<'a> {
    pub current_model: &'a str,
    pub theme: &'a Theme,
    pub reason: bool,
    pub search: bool,
}

impl<'a> ConstraintsBox<'a> {
    pub fn new(current_model: &'a str, theme: &'a Theme, reason: bool, search: bool) -> Self {
        Self {
            current_model,
            theme,
            reason,
            search,
        }
    }

    pub fn render(&self, frame: &mut Frame, area: Rect) {
        // Create the main block with title "Constraints"
        let main_block = Block::default()
            .title(
                Line::from(vec![Span::styled(
                    " Model ",
                    Style::default().fg(self.theme.primary_foreground),
                )])
                .alignment(Alignment::Center),
            )
            .borders(Borders::ALL)
            .border_style(Style::default().fg(self.theme.border))
            .padding(Padding::new(1, 1, 0, 0));

        // Get the inner area of the main block
        let inner_area = main_block.inner(area);

        // Create a vertical layout with two sections
        let vertical_layout = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(3), // Mode section
                Constraint::Length(1), // Divider
                Constraint::Length(3), // Model section
            ])
            .split(inner_area);

        // Mode section - using a placeholder for now
        let mode_name = if self.reason && self.search {
            "Search + Reason"
        } else if self.reason {
            "Reason"
        } else if self.search {
            "Search"
        } else {
            "No Mode"
        };

        let mode_text = Span::styled(
            mode_name,
            Style::default()
                .fg(self.theme.muted_foreground)
                .add_modifier(Modifier::BOLD),
        );

        let mode_paragraph = Paragraph::new(mode_text)
            .alignment(Alignment::Center)
            .style(Style::default().bg(self.theme.background));

        // Divider line
        let divider = Paragraph::new(Line::from(vec![Span::styled(
            symbols::line::HORIZONTAL.repeat(inner_area.width as usize),
            Style::default().fg(self.theme.border),
        )]));

        // Model section
        let model_text = Span::styled(
            self.current_model,
            Style::default()
                .fg(self.theme.muted_foreground)
                .add_modifier(Modifier::BOLD),
        );

        let model_paragraph = Paragraph::new(model_text)
            .alignment(Alignment::Center)
            .style(Style::default().bg(self.theme.background));

        // Render everything
        frame.render_widget(main_block, area);
        frame.render_widget(mode_paragraph, vertical_layout[0]);
        frame.render_widget(divider, vertical_layout[1]);
        frame.render_widget(model_paragraph, vertical_layout[2]);
    }
}
