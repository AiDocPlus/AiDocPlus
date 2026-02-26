use serde::Serialize;
use std::sync::Mutex;
use tauri::State;
use tts::Tts;
/// 系统 TTS 单例状态
pub struct TtsState(pub Mutex<Option<Tts>>);

/// 语音信息
#[derive(Debug, Clone, Serialize)]
pub struct VoiceInfo {
    pub id: String,
    pub name: String,
    pub language: String,
}

/// TTS 引擎能力信息
#[derive(Debug, Clone, Serialize)]
pub struct TtsCapabilities {
    pub rate: bool,
    pub pitch: bool,
    pub volume: bool,
    pub voice: bool,
}

fn ensure_tts(state: &TtsState) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| format!("锁定 TTS 失败: {}", e))?;
    if guard.is_none() {
        let engine = Tts::default().map_err(|e| format!("初始化系统 TTS 失败: {}", e))?;
        *guard = Some(engine);
    }
    Ok(())
}

/// 获取系统 TTS 能力
#[tauri::command]
pub fn tts_capabilities(state: State<'_, TtsState>) -> Result<TtsCapabilities, String> {
    ensure_tts(&state)?;
    let guard = state.0.lock().map_err(|e| format!("{}", e))?;
    let tts = guard.as_ref().unwrap();
    let features = tts.supported_features();
    Ok(TtsCapabilities {
        rate: features.rate,
        pitch: features.pitch,
        volume: features.volume,
        voice: features.voice,
    })
}

/// 播放文本段落
#[tauri::command]
pub fn tts_speak(state: State<'_, TtsState>, text: String, interrupt: bool) -> Result<(), String> {
    ensure_tts(&state)?;
    let mut guard = state.0.lock().map_err(|e| format!("{}", e))?;
    let tts = guard.as_mut().unwrap();
    tts.speak(text, interrupt)
        .map_err(|e| format!("TTS 播放失败: {}", e))?;
    Ok(())
}

/// 停止播放
#[tauri::command]
pub fn tts_stop(state: State<'_, TtsState>) -> Result<(), String> {
    ensure_tts(&state)?;
    let mut guard = state.0.lock().map_err(|e| format!("{}", e))?;
    let tts = guard.as_mut().unwrap();
    tts.stop().map_err(|e| format!("TTS 停止失败: {}", e))?;
    Ok(())
}

/// 查询是否正在播放
#[tauri::command]
pub fn tts_is_speaking(state: State<'_, TtsState>) -> Result<bool, String> {
    ensure_tts(&state)?;
    let guard = state.0.lock().map_err(|e| format!("{}", e))?;
    let tts = guard.as_ref().unwrap();
    tts.is_speaking().map_err(|e| format!("{}", e))
}

/// 设置语速
#[tauri::command]
pub fn tts_set_rate(state: State<'_, TtsState>, rate: f32) -> Result<(), String> {
    ensure_tts(&state)?;
    let mut guard = state.0.lock().map_err(|e| format!("{}", e))?;
    let tts = guard.as_mut().unwrap();
    tts.set_rate(rate).map_err(|e| format!("设置语速失败: {}", e))?;
    Ok(())
}

/// 设置音调
#[tauri::command]
pub fn tts_set_pitch(state: State<'_, TtsState>, pitch: f32) -> Result<(), String> {
    ensure_tts(&state)?;
    let mut guard = state.0.lock().map_err(|e| format!("{}", e))?;
    let tts = guard.as_mut().unwrap();
    tts.set_pitch(pitch).map_err(|e| format!("设置音调失败: {}", e))?;
    Ok(())
}

/// 设置音量
#[tauri::command]
pub fn tts_set_volume(state: State<'_, TtsState>, volume: f32) -> Result<(), String> {
    ensure_tts(&state)?;
    let mut guard = state.0.lock().map_err(|e| format!("{}", e))?;
    let tts = guard.as_mut().unwrap();
    tts.set_volume(volume).map_err(|e| format!("设置音量失败: {}", e))?;
    Ok(())
}

/// 获取当前参数
#[tauri::command]
pub fn tts_get_params(state: State<'_, TtsState>) -> Result<(f32, f32, f32), String> {
    ensure_tts(&state)?;
    let guard = state.0.lock().map_err(|e| format!("{}", e))?;
    let tts = guard.as_ref().unwrap();
    let rate = tts.get_rate().unwrap_or(tts.normal_rate());
    let pitch = tts.get_pitch().unwrap_or(tts.normal_pitch());
    let volume = tts.get_volume().unwrap_or(tts.normal_volume());
    Ok((rate, pitch, volume))
}

/// 获取参数范围
#[tauri::command]
pub fn tts_get_param_ranges(state: State<'_, TtsState>) -> Result<serde_json::Value, String> {
    ensure_tts(&state)?;
    let guard = state.0.lock().map_err(|e| format!("{}", e))?;
    let tts = guard.as_ref().unwrap();
    Ok(serde_json::json!({
        "rate": { "min": tts.min_rate(), "max": tts.max_rate(), "normal": tts.normal_rate() },
        "pitch": { "min": tts.min_pitch(), "max": tts.max_pitch(), "normal": tts.normal_pitch() },
        "volume": { "min": tts.min_volume(), "max": tts.max_volume(), "normal": tts.normal_volume() },
    }))
}

/// 列出系统可用语音
#[tauri::command]
pub fn tts_list_voices(state: State<'_, TtsState>) -> Result<Vec<VoiceInfo>, String> {
    ensure_tts(&state)?;
    let guard = state.0.lock().map_err(|e| format!("{}", e))?;
    let tts = guard.as_ref().unwrap();
    let voices = tts.voices().map_err(|e| format!("获取语音列表失败: {}", e))?;
    Ok(voices
        .into_iter()
        .map(|v| VoiceInfo {
            id: v.id(),
            name: v.name(),
            language: v.language().to_string(),
        })
        .collect())
}

/// 设置语音
#[tauri::command]
pub fn tts_set_voice(state: State<'_, TtsState>, voice_id: String) -> Result<(), String> {
    ensure_tts(&state)?;
    let mut guard = state.0.lock().map_err(|e| format!("{}", e))?;
    let tts = guard.as_mut().unwrap();
    let voices = tts.voices().map_err(|e| format!("{}", e))?;
    let voice = voices
        .iter()
        .find(|v| v.id() == voice_id)
        .ok_or_else(|| format!("未找到语音: {}", voice_id))?;
    tts.set_voice(voice).map_err(|e| format!("设置语音失败: {}", e))?;
    Ok(())
}
