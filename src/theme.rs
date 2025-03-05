use ratatui::style::Color;

/// A modern theme inspired by shadcn UI design principles
pub struct Theme {
    // Base colors
    pub background: Color,
    pub foreground: Color,
    pub muted: Color,
    pub muted_foreground: Color,
    pub accent: Color,
    pub accent_foreground: Color,
    pub border: Color,
    pub input: Color,
    
    // State colors
    pub primary: Color,
    pub primary_foreground: Color,
    pub secondary: Color,
    pub secondary_foreground: Color,
    pub destructive: Color,
    pub destructive_foreground: Color,
    pub success: Color,
    pub success_foreground: Color,
    pub warning: Color,
    pub warning_foreground: Color,
    
    // Focus and selection
    pub focus: Color,
    pub selection: Color,
    pub selection_foreground: Color,
}

/// Dark theme inspired by shadcn UI
pub fn dark_theme() -> Theme {
    Theme {
        // Base colors
        background: Color::Rgb(9, 9, 11),        // #09090b
        foreground: Color::Rgb(250, 250, 250),   // #fafafa
        muted: Color::Rgb(39, 39, 42),           // #27272a
        muted_foreground: Color::Rgb(161, 161, 170), // #a1a1aa
        accent: Color::Rgb(63, 63, 70),          // #3f3f46
        accent_foreground: Color::Rgb(250, 250, 250), // #fafafa
        border: Color::Rgb(39, 39, 42),          // #27272a
        input: Color::Rgb(39, 39, 42),           // #27272a
        
        // State colors
        primary: Color::Rgb(147, 51, 234),       // #9333ea (purple)
        primary_foreground: Color::Rgb(250, 250, 250), // #fafafa
        secondary: Color::Rgb(39, 39, 42),       // #27272a
        secondary_foreground: Color::Rgb(250, 250, 250), // #fafafa
        destructive: Color::Rgb(239, 68, 68),    // #ef4444 (red)
        destructive_foreground: Color::Rgb(250, 250, 250), // #fafafa
        success: Color::Rgb(34, 197, 94),        // #22c55e (green)
        success_foreground: Color::Rgb(250, 250, 250), // #fafafa
        warning: Color::Rgb(245, 158, 11),       // #f59e0b (amber)
        warning_foreground: Color::Rgb(250, 250, 250), // #fafafa
        
        // Focus and selection
        focus: Color::Rgb(147, 51, 234),         // #9333ea (purple)
        selection: Color::Rgb(147, 51, 234),     // #9333ea (purple)
        selection_foreground: Color::Rgb(250, 250, 250), // #fafafa
    }
}

/// Light theme inspired by shadcn UI
pub fn light_theme() -> Theme {
    Theme {
        // Base colors
        background: Color::Rgb(255, 255, 255),   // #ffffff
        foreground: Color::Rgb(9, 9, 11),        // #09090b
        muted: Color::Rgb(244, 244, 245),        // #f4f4f5
        muted_foreground: Color::Rgb(113, 113, 122), // #71717a
        accent: Color::Rgb(244, 244, 245),       // #f4f4f5
        accent_foreground: Color::Rgb(9, 9, 11), // #09090b
        border: Color::Rgb(228, 228, 231),       // #e4e4e7
        input: Color::Rgb(244, 244, 245),        // #f4f4f5
        
        // State colors
        primary: Color::Rgb(147, 51, 234),       // #9333ea (purple)
        primary_foreground: Color::Rgb(255, 255, 255), // #ffffff
        secondary: Color::Rgb(244, 244, 245),    // #f4f4f5
        secondary_foreground: Color::Rgb(9, 9, 11), // #09090b
        destructive: Color::Rgb(239, 68, 68),    // #ef4444 (red)
        destructive_foreground: Color::Rgb(255, 255, 255), // #ffffff
        success: Color::Rgb(34, 197, 94),        // #22c55e (green)
        success_foreground: Color::Rgb(255, 255, 255), // #ffffff
        warning: Color::Rgb(245, 158, 11),       // #f59e0b (amber)
        warning_foreground: Color::Rgb(255, 255, 255), // #ffffff
        
        // Focus and selection
        focus: Color::Rgb(147, 51, 234),         // #9333ea (purple)
        selection: Color::Rgb(147, 51, 234),     // #9333ea (purple)
        selection_foreground: Color::Rgb(255, 255, 255), // #ffffff
    }
}

/// Get the current theme (defaults to dark)
pub fn current_theme() -> Theme {
    light_theme()
} 