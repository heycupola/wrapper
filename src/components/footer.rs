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
        let os = std::env::consts::OS;
        let control_key = if os == "macos" { "⌘" } else { "C" };
        let alt_key = if os == "macos" { "⌥" } else { "Alt" };

        let footer_text = match self.current_screen {
            Screen::Chat => {
                let base = format!(
                    "new chat: <{}-n> | prompt: <{}-j> | history: <{}-h> | messages: <{}-l>",
                    control_key, control_key, control_key, control_key
                );

                let result: String = if let Some(a) = self.position_on_chat {
                    match a {
                        PositionOnChat::ChatBox => format!(
                            "{} | switch model: Tab | reason: <{}-r> | search on web: <{}-w>",
                            base, alt_key, alt_key
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
                        Plan::Free => format!("get premium: <{}-u>", control_key),
                        Plan::Premium => String::new(),
                    }
                } else {
                    String::new()
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

                format!(
                    "{} | sync: <{}-s> | {}",
                    user_plan, control_key, authentication
                )
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
