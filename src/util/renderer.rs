use std::any::Any;

use crate::util::theme::Theme;
use ratatui::widgets::Padding;
use ratatui::{
    style::Style,
    text::{Line, Span},
    widgets::{Block, Borders},
};

// NOTE: border can be boolean and true represents Borders::ALL and false represents Borders::NONE
// or border can be Borders type and can be customizable accordingly
// NOTE: padding can be uint16 and become uniform type of padding or can be Padding type and can be
// customizable accordingly
pub fn render_content_block<'a>(
    theme: &'a Theme,
    border: &dyn Any,
    title: Option<&str>,
    padding: Option<&dyn Any>,
    style: Option<Style>,
    border_style: Option<Style>,
) -> Block<'a> {
    let set_block_title = || {
        if let Some(t) = title {
            Line::from(vec![
                Span::styled("  ", Style::default().bg(theme.primary)),
                Span::styled(
                    format!(" {} ", t),
                    Style::default().fg(theme.primary_foreground),
                ),
            ])
        } else {
            Line::from("")
        }
    };

    let set_padding = || {
        if let Some(p) = padding {
            if let Some(p) = p.downcast_ref::<u16>() {
                Padding::uniform(*p)
            } else if let Some(p) = p.downcast_ref::<Padding>() {
                *p
            } else {
                Padding::uniform(0)
            }
        } else {
            Padding::uniform(0)
        }
    };

    let set_border = || {
        if let Some(b) = border.downcast_ref::<bool>() {
            if *b {
                Borders::ALL
            } else {
                Borders::NONE
            }
        } else if let Some(b) = border.downcast_ref::<Borders>() {
            *b
        } else {
            Borders::NONE
        }
    };

    let block = Block::default()
        .borders(set_border())
        .border_style(border_style.unwrap_or(Style::default().fg(theme.muted)))
        .title(set_block_title())
        .style(style.unwrap_or(Style::default()))
        .padding(set_padding());

    return block;
}

pub fn render_focusable_content_block<'a>(
    theme: &'a Theme,
    border: &dyn Any,
    title: Option<&str>,
    padding: Option<&dyn Any>,
    style: Option<Style>,
    is_focused: bool,
) -> Block<'a> {
    render_content_block(theme, border, title, padding, style, None).border_style(
        Style::default().fg(if is_focused {
            theme.focus
        } else {
            theme.border
        }),
    )
}
