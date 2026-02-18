use tauri::State;
use crate::resource_engine::{ResourceEngineState, ResourceFilter, ResourceSummary, ResourceStats, CategoryInfo};

#[tauri::command]
pub fn resource_list(
    state: State<'_, ResourceEngineState>,
    resource_type: Option<String>,
    major_category: Option<String>,
    sub_category: Option<String>,
    source: Option<String>,
    enabled: Option<bool>,
    limit: Option<u32>,
    offset: Option<u32>,
    sort_by: Option<String>,
    sort_order: Option<String>,
) -> Result<Vec<ResourceSummary>, String> {
    let filter = ResourceFilter {
        resource_type,
        major_category,
        sub_category,
        source,
        enabled,
        query: None,
        limit,
        offset,
        sort_by,
        sort_order,
    };
    state.with_engine(|engine| engine.list(&filter))
}

#[tauri::command]
pub fn resource_search(
    state: State<'_, ResourceEngineState>,
    query: String,
    resource_type: Option<String>,
    source: Option<String>,
    enabled: Option<bool>,
) -> Result<Vec<ResourceSummary>, String> {
    let filter = ResourceFilter {
        resource_type,
        major_category: None,
        sub_category: None,
        source,
        enabled,
        query: Some(query.clone()),
        limit: Some(100),
        offset: None,
        sort_by: None,
        sort_order: None,
    };
    state.with_engine(|engine| engine.search(&query, &filter))
}

#[tauri::command]
pub fn resource_get(
    state: State<'_, ResourceEngineState>,
    id: String,
) -> Result<Option<String>, String> {
    state.with_engine(|engine| engine.get(&id))
}

#[tauri::command]
pub fn resource_set_enabled(
    state: State<'_, ResourceEngineState>,
    id: String,
    enabled: bool,
) -> Result<(), String> {
    state.with_engine(|engine| engine.set_enabled(&id, enabled))
}

#[tauri::command]
pub fn resource_stats(
    state: State<'_, ResourceEngineState>,
) -> Result<ResourceStats, String> {
    state.with_engine(|engine| engine.get_stats())
}

#[tauri::command]
pub fn resource_categories(
    state: State<'_, ResourceEngineState>,
    resource_type: String,
) -> Result<Vec<CategoryInfo>, String> {
    state.with_engine(|engine| engine.list_categories(&resource_type))
}

#[tauri::command]
pub fn resource_rebuild_index(
    state: State<'_, ResourceEngineState>,
) -> Result<(), String> {
    state.with_engine(|engine| {
        engine.rebuild_index_from_local()?;
        Ok(())
    })
}
