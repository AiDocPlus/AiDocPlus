use crate::config::AppState;
use crate::document::Document;
use crate::error::Result;
use regex::RegexBuilder;
use serde::{Deserialize, Serialize};
use tauri::State;

/// ReDoS 防护：正则表达式资源限制
const REGEX_SIZE_LIMIT: usize = 10 * 1024 * 1024; // 10MB
const REGEX_DFA_SIZE_LIMIT: usize = 10 * 1024 * 1024; // 10MB

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub document_id: String,
    pub project_id: String,
    pub title: String,
    pub matches: Vec<SearchMatch>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchMatch {
    #[serde(rename = "type")]
    pub match_type: SearchMatchType,
    pub line: Option<usize>,
    pub column: Option<usize>,
    pub context: String,
    pub preview: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SearchMatchType {
    Title,
    Content,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchOptions {
    pub query: String,
    pub search_content: bool,
    pub match_case: bool,
    pub match_whole_word: bool,
    pub use_regex: bool,
    pub limit: Option<usize>,
}

#[tauri::command]
pub fn search_documents(
    state: State<'_, AppState>,
    project_id: String,
    options: SearchOptions,
) -> Result<Vec<SearchResult>> {
    let query = if options.match_case {
        options.query.clone()
    } else {
        options.query.to_lowercase()
    };

    // Build search pattern with ReDoS protection
    let search_pattern = if options.use_regex {
        // 使用 RegexBuilder 设置资源限制，防止 ReDoS 攻击
        Some(
            RegexBuilder::new(&options.query)
                .size_limit(REGEX_SIZE_LIMIT)
                .dfa_size_limit(REGEX_DFA_SIZE_LIMIT)
                .build()
                .map_err(|e| format!("正则表达式无效: {}", e))?
        )
    } else {
        None
    };

    let project_dir = state.config.projects_dir.join(&project_id);
    let docs_dir = project_dir.join("documents");

    if !docs_dir.exists() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();
    let limit = options.limit.unwrap_or(100);

    let entries = std::fs::read_dir(&docs_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        if results.len() >= limit {
            break;
        }

        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Ok(document) = Document::load(&path) {
                let mut matches = Vec::new();

                // Search in title
                let title_to_search = if options.match_case {
                    document.title.clone()
                } else {
                    document.title.to_lowercase()
                };

                if let Some(matches_in_title) = find_matches(
                    &title_to_search,
                    &document.title,
                    &query,
                    &search_pattern,
                    options.match_whole_word,
                ) {
                    matches.extend(matches_in_title);
                }

                // Search in content if requested
                if options.search_content {
                    let content_to_search = if options.match_case {
                        document.content.clone()
                    } else {
                        document.content.to_lowercase()
                    };

                    if let Some(matches_in_content) = find_matches(
                        &content_to_search,
                        &document.content,
                        &query,
                        &search_pattern,
                        options.match_whole_word,
                    ) {
                        // Add context and preview for content matches
                        let content_matches: Vec<SearchMatch> = matches_in_content
                            .into_iter()
                            .map(|m| {
                                let (context, preview) = extract_context(&document.content, m.column.unwrap_or(0));
                                SearchMatch {
                                    match_type: SearchMatchType::Content,
                                    line: m.line,
                                    column: m.column,
                                    context,
                                    preview,
                                }
                            })
                            .collect();
                        matches.extend(content_matches);
                    }
                }

                if !matches.is_empty() {
                    results.push(SearchResult {
                        document_id: document.id,
                        project_id: document.project_id,
                        title: document.title,
                        matches,
                    });
                }
            }
        }
    }

    Ok(results)
}

fn find_matches(
    text_to_search: &str,
    original_text: &str,
    query: &str,
    regex_pattern: &Option<regex::Regex>,
    match_whole_word: bool,
) -> Option<Vec<SearchMatch>> {
    let mut matches = Vec::new();

    if let Some(regex) = regex_pattern {
        // Use regex search
        for mat in regex.find_iter(text_to_search) {
            let (line, column) = get_line_column(original_text, mat.start());
            matches.push(SearchMatch {
                match_type: SearchMatchType::Content,
                line: Some(line),
                column: Some(column),
                context: String::new(),
                preview: original_text.chars().take(mat.start() + 50).collect::<String>(),
            });
        }
    } else {
        // Simple string search
        let mut start = 0;
        while let Some(pos) = text_to_search[start..].find(query) {
            let absolute_pos = start + pos;

            if match_whole_word {
                // Check if it's a whole word
                let chars: Vec<char> = text_to_search.chars().collect();
                let query_len = query.chars().count();

                // Check character before match
                if absolute_pos > 0 {
                    let prev_char = chars[absolute_pos - 1];
                    if prev_char.is_alphanumeric() || prev_char == '_' {
                        start = absolute_pos + query_len;
                        continue;
                    }
                }

                // Check character after match
                if absolute_pos + query_len < chars.len() {
                    let next_char = chars[absolute_pos + query_len];
                    if next_char.is_alphanumeric() || next_char == '_' {
                        start = absolute_pos + query_len;
                        continue;
                    }
                }
            }

            let (line, column) = get_line_column(original_text, absolute_pos);
            matches.push(SearchMatch {
                match_type: SearchMatchType::Content,
                line: Some(line),
                column: Some(column),
                context: String::new(),
                preview: original_text.chars().take(absolute_pos + 50).collect::<String>(),
            });

            start = absolute_pos + query.chars().count();
        }
    }

    if matches.is_empty() {
        None
    } else {
        Some(matches)
    }
}

fn get_line_column(text: &str, pos: usize) -> (usize, usize) {
    let chars: Vec<char> = text.chars().collect();
    let mut line = 1;
    let mut column = 1;

    for (i, &c) in chars.iter().enumerate() {
        if i >= pos {
            break;
        }
        if c == '\n' {
            line += 1;
            column = 1;
        } else {
            column += 1;
        }
    }

    (line, column)
}

fn extract_context(text: &str, pos: usize) -> (String, String) {
    let chars: Vec<char> = text.chars().collect();
    const CONTEXT_LENGTH: usize = 50;

    let start = if pos > CONTEXT_LENGTH {
        pos - CONTEXT_LENGTH
    } else {
        0
    };

    let end = (pos + CONTEXT_LENGTH).min(chars.len());

    let context: String = chars[start..end].iter().collect();
    let preview: String = chars[start..].iter().take(100).collect();

    (context, preview)
}

#[tauri::command]
pub fn get_search_suggestions(
    state: State<'_, AppState>,
    project_id: String,
    prefix: String,
    limit: Option<usize>,
) -> Result<Vec<String>> {
    let project_dir = state.config.projects_dir.join(&project_id);
    let docs_dir = project_dir.join("documents");

    if !docs_dir.exists() || prefix.is_empty() {
        return Ok(Vec::new());
    }

    let mut suggestions = Vec::new();
    let limit = limit.unwrap_or(10);
    let prefix_lower = prefix.to_lowercase();

    let entries = std::fs::read_dir(&docs_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        if suggestions.len() >= limit {
            break;
        }

        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Ok(document) = Document::load(&path) {
                // Add title as suggestion
                if document.title.to_lowercase().starts_with(&prefix_lower) {
                    suggestions.push(document.title);
                }

                // Extract words from content for suggestions
                for word in document.content.split_whitespace() {
                    if word.to_lowercase().starts_with(&prefix_lower) {
                        if !suggestions.contains(&word.to_string()) {
                            suggestions.push(word.to_string());
                            if suggestions.len() >= limit {
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    suggestions.sort();
    suggestions.dedup();
    suggestions.truncate(limit);

    Ok(suggestions)
}
