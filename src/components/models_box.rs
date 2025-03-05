use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Tabs},
    Frame,
};

use crate::util::theme::Theme;

pub struct ModelsBox<'a> {
    pub available_models: &'a [String],
    pub current_model: &'a str,
    pub selected_index: usize,
    pub theme: &'a Theme,
}

impl<'a> ModelsBox<'a> {
    pub fn new(available_models: &'a [String], current_model: &'a str, theme: &'a Theme) -> Self {
        let selected_index = available_models
            .iter()
            .position(|m| m == current_model)
            .unwrap_or(0);

        Self {
            available_models,
            current_model,
            selected_index,
            theme,
        }
    }

    pub fn render(&self, frame: &mut Frame, area: Rect) {
        // Create a modern header block
        let header_block = Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(self.theme.border))
            .style(Style::default().bg(self.theme.background));

        // Create tabs for model selection
        let model_tabs: Vec<Line> = self
            .available_models
            .iter()
            .enumerate()
            .map(|(_i, model)| {
                let (style, prefix) = if model == self.current_model {
                    (
                        Style::default()
                            .fg(self.theme.primary)
                            .add_modifier(Modifier::BOLD),
                        "● ",
                    )
                } else {
                    (Style::default().fg(self.theme.muted_foreground), "○ ")
                };

                Line::from(vec![
                    Span::styled(format!("{}", prefix), style),
                    Span::styled(format!("{}", model), style),
                ])
            })
            .collect();

        // Create layout for header with app title and tabs
        let header_layout = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([Constraint::Percentage(30), Constraint::Percentage(70)])
            .split(area);

        // Render app title
        let title = Paragraph::new(Line::from(vec![
            Span::styled("  ", Style::default().bg(self.theme.primary)),
            Span::styled(
                " LLM Chat ",
                Style::default()
                    .fg(self.theme.primary)
                    .add_modifier(Modifier::BOLD),
            ),
        ]))
        .block(Block::default());

        // Render tabs
        let tabs = Tabs::new(model_tabs)
            .block(Block::default())
            .style(Style::default())
            .highlight_style(
                Style::default()
                    .fg(self.theme.primary)
                    .add_modifier(Modifier::BOLD),
            )
            .select(self.selected_index);

        // Render the components
        frame.render_widget(header_block, area);
        frame.render_widget(title, header_layout[0]);
        frame.render_widget(tabs, header_layout[1]);
    }
}
