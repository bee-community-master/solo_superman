const DEFAULT_SIDECAR_BASE_URL: &str = "http://127.0.0.1:43110";

#[tauri::command]
pub fn get_sidecar_base_url() -> String {
    std::env::var("SOLO_SIDECAR_BASE_URL").unwrap_or_else(|_| DEFAULT_SIDECAR_BASE_URL.to_string())
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::{get_sidecar_base_url, DEFAULT_SIDECAR_BASE_URL};

    static ENV_LOCK: Mutex<()> = Mutex::new(());
    const SIDECAR_BASE_URL_ENV: &str = "SOLO_SIDECAR_BASE_URL";

    #[test]
    fn uses_default_sidecar_base_url_when_env_is_absent() {
        let _guard = ENV_LOCK.lock().expect("sidecar env lock poisoned");
        std::env::remove_var(SIDECAR_BASE_URL_ENV);

        assert_eq!(get_sidecar_base_url(), DEFAULT_SIDECAR_BASE_URL);
    }

    #[test]
    fn uses_sidecar_base_url_from_env() {
        let _guard = ENV_LOCK.lock().expect("sidecar env lock poisoned");
        std::env::set_var(SIDECAR_BASE_URL_ENV, "http://127.0.0.1:61234");

        assert_eq!(get_sidecar_base_url(), "http://127.0.0.1:61234");

        std::env::remove_var(SIDECAR_BASE_URL_ENV);
    }
}
