use crate::util::{browser::Browser, clipboard::Clipboard};

#[derive(Clone, PartialEq)]
pub enum Screen {
    Chat,
    Account,
    Exit,
}

pub enum PositionOnChat {
    ChatBox,
    Messages,
    ChatHistory,
}

pub struct Message {
    pub content: String,
    pub is_user: bool,
}

pub enum Plan {
    Free,
    Premium,
}

pub struct User {
    pub email: String,
    pub remaining_messages: u32,
    pub is_logged_in: bool,
    pub plan: Plan,
}

pub struct App {
    pub input: String,
    pub model: String,
    pub available_models: Vec<String>,
    pub is_prompting: bool,
    pub current_screen: Screen,
    pub last_screen: Screen,
    pub position_on_chat: Option<PositionOnChat>,
    pub messages: Vec<Message>,
    pub chat_history: Vec<String>,
    pub user: User,
    pub message_scroll: usize,
    pub history_scroll: usize,
    pub reason: bool,
    pub search_on_web: bool,
    pub cursor_position: usize,
}

impl Default for App {
    fn default() -> Self {
        Self {
            input: String::default(),
            model: String::from("gpt-3.5-turbo"),
            available_models: vec![
                String::from("gpt-3.5-turbo"),
                String::from("gpt-4"),
                String::from("claude-3-opus"),
                String::from("claude-3-sonnet"),
                String::from("llama-3-70b"),
            ],
            is_prompting: false,
            current_screen: Screen::Chat,
            last_screen: Screen::Chat,
            position_on_chat: Some(PositionOnChat::ChatBox),
            messages: Vec::default(),
            chat_history: vec![
                String::from("Chat 3"),
                String::from("Chat 2"),
                String::from("Chat 1"),
            ],
            user: User {
                email: String::default(),
                remaining_messages: 0,
                is_logged_in: false,
                plan: Plan::Free,
            },
            message_scroll: 0,
            history_scroll: 0,
            reason: false,
            search_on_web: false,
            cursor_position: 0,
        }
    }
}

impl App {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn prompt(&mut self) {
        // Check if input is empty or contains only whitespace
        if self.input.trim().is_empty() {
            return;
        }

        // Add user message to messages
        self.messages.push(Message {
            content: self.input.clone(),
            is_user: true,
        });

        // Clear input
        self.input.clear();

        // Reset cursor position
        self.cursor_position = 0;

        // Set prompting to true
        self.is_prompting = true;

        // In a real implementation, you would send the message to the LLM here
        // and wait for a response asynchronously

        // For now, we'll simulate a response
        self.messages.push(Message {
            content: String::from("This is a simulated response from the LLM."),
            is_user: false,
        });

        // Set prompting to false when done
        self.is_prompting = false;

        // Auto-scroll to the latest message
        if !self.messages.is_empty() {
            self.message_scroll = self.messages.len() - 1;
        }
    }

    pub fn cancel_prompting(&mut self) {
        if self.is_prompting {
            self.is_prompting = false;
        }
    }

    pub fn set_model(&mut self, model: String) {
        self.model = model;
    }

    pub fn cycle_model(&mut self) {
        if let Some(index) = self.available_models.iter().position(|m| m == &self.model) {
            let next_index = (index + 1) % self.available_models.len();
            self.model = self.available_models[next_index].clone();
        }
    }

    pub fn login(&mut self) {
        // In a real implementation, you would show a login form and authenticate the user
        // For now, we'll simulate a successful login
        self.user.email = String::from("user@example.com");
        self.user.remaining_messages = 100;
        self.user.is_logged_in = true;
    }

    pub fn logout(&mut self) {
        self.user.email = String::default();
        self.user.remaining_messages = 0;
        self.user.is_logged_in = false;
    }

    pub fn navigate_chat(&mut self, direction: &str) {
        match direction {
            "up" => {
                if let Some(pos) = &self.position_on_chat {
                    match pos {
                        PositionOnChat::ChatBox => {}
                        PositionOnChat::Messages => {
                            if self.message_scroll > 0 {
                                self.message_scroll -= 1;
                            }
                        }
                        PositionOnChat::ChatHistory => {
                            if self.history_scroll > 0 {
                                self.history_scroll -= 1;
                            }
                        }
                    }
                }
            }
            "down" => {
                if let Some(pos) = &self.position_on_chat {
                    match pos {
                        PositionOnChat::ChatBox => {}
                        PositionOnChat::Messages => {
                            if !self.messages.is_empty()
                                && self.message_scroll < self.messages.len() - 1
                            {
                                self.message_scroll += 1;
                            }
                        }
                        PositionOnChat::ChatHistory => {
                            if !self.chat_history.is_empty()
                                && self.history_scroll < self.chat_history.len() - 1
                            {
                                self.history_scroll += 1;
                            }
                        }
                    }
                }
            }
            "bottom" => {
                if let Some(pos) = &self.position_on_chat {
                    match pos {
                        PositionOnChat::ChatBox => {}
                        PositionOnChat::Messages => {
                            if !self.messages.is_empty() {
                                self.message_scroll = self.messages.len() - 1;
                            }
                        }
                        PositionOnChat::ChatHistory => {
                            if !self.chat_history.is_empty() {
                                self.history_scroll = self.chat_history.len() - 1;
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }

    pub fn change_chat_position(&mut self, new_position: PositionOnChat) {
        self.position_on_chat = Some(new_position);
    }

    pub fn switch_screen(&mut self, screen: Screen) {
        self.last_screen = self.current_screen.clone();
        self.current_screen = screen;
    }

    pub fn clear_chat(&mut self) {
        // Add the current chat to history if it's not empty
        if !self.messages.is_empty() {
            let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M").to_string();
            self.chat_history.insert(0, format!("Chat {}", timestamp));
        }

        self.messages.clear();
        self.input.clear();
        self.cursor_position = 0;
        self.message_scroll = 0;
    }

    pub fn select_chat(&mut self) {
        // In a real implementation, you would load the selected chat
        // For now, we'll just simulate selecting a chat
        if !self.chat_history.is_empty() {
            let selected_chat = self.chat_history[self.history_scroll].clone();

            // Clear current messages
            self.messages.clear();

            // Add some simulated messages for the selected chat
            self.messages.push(Message {
                content: format!("This is a user message in {}", selected_chat),
                is_user: true,
            });

            self.messages.push(Message {
                content: format!("This is an AI response in {}", selected_chat),
                is_user: false,
            });

            // Auto-scroll to the latest message
            if !self.messages.is_empty() {
                self.message_scroll = self.messages.len() - 1;
            }
        }
    }

    pub fn load_model(&mut self, index: usize) {
        if index < self.available_models.len() {
            self.model = self.available_models[index].clone();
        }
    }

    pub fn move_cursor_left(&mut self) {
        if self.cursor_position > 0 {
            self.cursor_position -= 1;
        }
    }

    pub fn move_cursor_right(&mut self) {
        if self.cursor_position < self.input.len() {
            self.cursor_position += 1;
        }
    }

    pub fn cursor_to_start(&mut self) {
        self.cursor_position = 0;
    }

    pub fn cursor_to_end(&mut self) {
        self.cursor_position = self.input.len();
    }

    pub fn insert_char(&mut self, c: char) {
        // Prevent adding whitespace character if input is empty
        if self.input.is_empty() && c.is_whitespace() {
            return;
        }

        self.input.insert(self.cursor_position, c);
        self.cursor_position += 1;
    }

    pub fn delete_char(&mut self) {
        if self.cursor_position > 0 {
            self.input.remove(self.cursor_position - 1);
            self.cursor_position -= 1;
        }
    }

    pub fn delete_char_forward(&mut self) {
        if self.cursor_position < self.input.len() {
            self.input.remove(self.cursor_position);
        }
    }

    pub fn toggle_reason(&mut self) {
        self.reason = !self.reason;
    }

    pub fn toggle_search_on_web(&mut self) {
        self.search_on_web = !self.search_on_web;
    }

    pub fn copy_to_clipboard(&mut self) {
        Clipboard::copy("wrapper.sh");
    }

    pub fn delete_chat_history(&mut self) {
        self.chat_history.remove(self.history_scroll);

        if self.history_scroll > 0 {
            self.history_scroll -= 1;
        }
    }

    pub fn open_url(&mut self) {
        Browser::open_url("https://x.com/icanvardar");
    }

    pub fn sync_data(&mut self) {}
}
