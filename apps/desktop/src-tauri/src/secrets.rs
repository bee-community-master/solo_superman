#[tauri::command]
pub fn get_secret_status() -> String {
    "scaffold-only: secret bridge is not implemented in PR-01".to_string()
}
