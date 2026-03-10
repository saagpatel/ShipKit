//! CSS variable theme engine with system theme detection.

pub mod detection;
pub mod engine;

pub use engine::{ThemeDefinition, ThemeEngine, ThemeMode, default_themes};
