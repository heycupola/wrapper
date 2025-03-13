use crate::app::{Plan, PositionOnChat, Screen};
use crate::util::renderer::render_content_block;
use crate::util::theme::Theme;
use ratatui::layout::{Alignment, Rect};
use ratatui::{style::Style, text::Text, widgets::Paragraph, Frame};

pub struct Footer<'a> {
    pub current_screen: &'a Screen,
    pub theme: &'a Theme,
    pub position_on_chat: &'a Option<PositionOnChat>,
    pub is_logged_in: Option<bool>,
    pub user_plan: Option<&'a Plan>,
}

impl<'a> Footer<'a> {
    pub fn new(
        current_screen: &'a Screen,
        theme: &'a Theme,
        position_on_chat: &'a Option<PositionOnChat>,
        is_logged_in: Option<bool>,
        user_plan: Option<&'a Plan>,
    ) -> Self {
        Self {
            current_screen,
            theme,
            position_on_chat,
            is_logged_in,
            user_plan,
        }
    }

    pub fn render(&self, frame: &mut Frame, area: Rect) {
        let footer_text = match self.current_screen {
            Screen::Chat => {
                let base = "new chat: <C-n> | prompt: <C-p> | history: <C-h> | messages: <C-l>";

                let result: String = if let Some(a) = self.position_on_chat {
                    match a {
                        PositionOnChat::ChatBox => format!(
                            "{} | switch model: Tab | reason: <C-r> | search on web: <C-w>",
                            base
                        ),
                        PositionOnChat::Messages => format!("{} | navigate: ↑/↓ | copy: c", base),
                        PositionOnChat::ChatHistory => {
                            format!("{} | navigate: ↑/↓ | delete: d", base)
                        }
                    }
                } else {
                    base.to_string()
                };

                result
            }
            Screen::Account => {
                let user_plan = if let Some(ref user_plan) = self.user_plan {
                    match user_plan {
                        Plan::Free => "get premium: <C-u>",
                        Plan::Premium => "",
                    }
                } else {
                    ""
                };

                let authentication = if let Some(is_logged_in) = self.is_logged_in {
                    if is_logged_in {
                        "logout: o"
                    } else {
                        "login: l"
                    }
                } else {
                    ""
                };

                format!("{} | sync: <C-s> | {}", user_plan, authentication)
            }
            Screen::Exit => String::from(""),
        };

        let footer = Paragraph::new(Text::styled(
            footer_text,
            Style::default().fg(self.theme.muted_foreground),
        ))
        .alignment(Alignment::Center)
        .block(render_content_block(
            &self.theme,
            &true,
            None,
            None,
            None,
            None,
        ));

        frame.render_widget(footer, area);
    }
}
