#![allow(non_snake_case)]

use crate::plugin::{self, PluginManifest};
use crate::error::Result;

#[tauri::command]
pub fn list_plugins() -> Result<Vec<PluginManifest>> {
    Ok(plugin::list_plugins())
}

#[tauri::command]
pub fn set_plugin_enabled(pluginId: String, enabled: bool) -> Result<()> {
    plugin::set_plugin_enabled(&pluginId, enabled)
}
