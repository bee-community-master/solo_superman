#[tauri::command]
pub fn get_sidecar_base_url() -> String {
    std::env::var("SOLO_SIDECAR_BASE_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:43110".to_string())
}
