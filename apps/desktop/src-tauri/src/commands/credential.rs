/// AI API Key 凭证管理模块
/// 使用 OS 级密钥链安全存储 AI 服务的 API Key
/// macOS: Keychain, Windows: Credential Manager, Linux: Secret Service

/// keyring 服务名常量（AI 凭证专用，与邮件凭证分离）
const AI_KEYRING_SERVICE: &str = "com.aidocplus.ai";

/// 存储 AI API Key 到 OS 密钥链
#[tauri::command]
#[allow(non_snake_case)]
pub fn store_ai_credential(serviceId: String, apiKey: String) -> crate::error::Result<String> {
    use crate::error::{AppError, ResultExt};
    if serviceId.is_empty() {
        return Err(AppError::ValidationError("服务 ID 不能为空".to_string()));
    }
    if apiKey.is_empty() {
        return Err(AppError::ValidationError("API Key 不能为空".to_string()));
    }
    let entry = keyring::Entry::new(AI_KEYRING_SERVICE, &serviceId)
        .context("KEYRING_INIT_FAILED")?;
    entry
        .set_password(&apiKey)
        .context("KEYRING_STORE_FAILED")?;
    Ok("CREDENTIAL_STORED".to_string())
}

/// 从 OS 密钥链读取 AI API Key
#[tauri::command]
#[allow(non_snake_case)]
pub fn get_ai_credential(serviceId: String) -> crate::error::Result<String> {
    use crate::error::{AppError, ResultExt};
    if serviceId.is_empty() {
        return Err(AppError::ValidationError("服务 ID 不能为空".to_string()));
    }
    let entry = keyring::Entry::new(AI_KEYRING_SERVICE, &serviceId)
        .context("KEYRING_INIT_FAILED")?;
    match entry.get_password() {
        Ok(key) => Ok(key),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(e) => Err(AppError::Internal(format!("KEYRING_GET_FAILED: {}", e))),
    }
}

/// 从 OS 密钥链删除 AI API Key
#[tauri::command]
#[allow(non_snake_case)]
pub fn delete_ai_credential(serviceId: String) -> crate::error::Result<String> {
    use crate::error::{AppError, ResultExt};
    if serviceId.is_empty() {
        return Err(AppError::ValidationError("服务 ID 不能为空".to_string()));
    }
    let entry = keyring::Entry::new(AI_KEYRING_SERVICE, &serviceId)
        .context("KEYRING_INIT_FAILED")?;
    match entry.delete_credential() {
        Ok(()) => Ok("CREDENTIAL_DELETED".to_string()),
        Err(keyring::Error::NoEntry) => Ok("CREDENTIAL_NOT_FOUND".to_string()),
        Err(e) => Err(AppError::Internal(format!("KEYRING_DELETE_FAILED: {}", e))),
    }
}

/// 内部函数：从 keyring 读取 AI API Key（供 AI 命令模块调用）
pub fn get_ai_key_from_keyring(service_id: &str) -> Option<String> {
    if service_id.is_empty() {
        return None;
    }
    let entry = keyring::Entry::new(AI_KEYRING_SERVICE, service_id).ok()?;
    match entry.get_password() {
        Ok(key) if !key.is_empty() => Some(key),
        _ => None,
    }
}

/// 批量迁移：将明文 API Key 存入 keyring 并返回需要清除的服务 ID 列表
/// 由前端在启动时调用一次
#[tauri::command]
#[allow(non_snake_case)]
pub fn migrate_ai_keys_to_keyring(services: Vec<MigrateKeyInfo>) -> crate::error::Result<Vec<String>> {
    use crate::error::ResultExt;
    let mut migrated_ids = Vec::new();
    for svc in &services {
        if svc.apiKey.is_empty() || svc.serviceId.is_empty() {
            continue;
        }
        // 跳过占位符
        if svc.apiKey == "__KEYRING__" {
            continue;
        }
        let entry = keyring::Entry::new(AI_KEYRING_SERVICE, &svc.serviceId)
            .context_with(|| format!("KEYRING_INIT_FAILED for {}", svc.serviceId))?;
        entry
            .set_password(&svc.apiKey)
            .context_with(|| format!("KEYRING_STORE_FAILED for {}", svc.serviceId))?;
        migrated_ids.push(svc.serviceId.clone());
    }
    Ok(migrated_ids)
}

#[derive(Debug, serde::Deserialize)]
#[allow(non_snake_case)]
pub struct MigrateKeyInfo {
    pub serviceId: String,
    pub apiKey: String,
}
