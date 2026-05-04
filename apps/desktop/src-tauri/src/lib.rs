mod native_paths;
mod secrets;
mod sidecar;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            native_paths::get_app_data_dir,
            secrets::get_secret_status,
            secrets::read_secret_ref,
            secrets::write_secret_ref,
            sidecar::get_sidecar_base_url
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Solo Superman desktop scaffold");
}
