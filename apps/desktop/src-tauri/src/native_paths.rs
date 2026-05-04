use std::path::Path;

const APP_DATA_DIR_ENV: &str = "SOLO_APP_DATA_DIR";

#[tauri::command]
pub fn get_app_data_dir() -> Result<AppDataDirBoundary, String> {
    resolve_app_data_dir_boundary()
}

#[derive(Debug, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppDataDirBoundary {
    pub path: Option<String>,
    pub source: String,
    pub status: String,
}

fn resolve_app_data_dir_boundary() -> Result<AppDataDirBoundary, String> {
    match std::env::var(APP_DATA_DIR_ENV) {
        Ok(path) if Path::new(&path).is_absolute() => Ok(AppDataDirBoundary {
            path: Some(path),
            source: "dev_env".to_string(),
            status: "resolved".to_string(),
        }),
        Ok(_) => Err("SOLO_APP_DATA_DIR must be an absolute path".to_string()),
        Err(_) => Ok(AppDataDirBoundary {
            path: None,
            source: "native_stub".to_string(),
            status: "not_initialized_until_pr_03_storage".to_string(),
        }),
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::{get_app_data_dir, APP_DATA_DIR_ENV};

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn reports_stub_when_app_data_dir_is_not_injected() {
        let _guard = ENV_LOCK.lock().expect("app data dir env lock poisoned");
        std::env::remove_var(APP_DATA_DIR_ENV);

        let boundary = get_app_data_dir().expect("missing app data dir should remain a stub");

        assert_eq!(boundary.path, None);
        assert_eq!(boundary.source, "native_stub");
        assert_eq!(boundary.status, "not_initialized_until_pr_03_storage");
    }

    #[cfg(unix)]
    fn absolute_test_path() -> &'static str {
        "/tmp/solo-superman-test-data"
    }

    #[cfg(windows)]
    fn absolute_test_path() -> &'static str {
        r"C:\solo-superman-test-data"
    }

    #[test]
    fn reports_dev_env_app_data_dir_without_creating_storage() {
        let _guard = ENV_LOCK.lock().expect("app data dir env lock poisoned");
        std::env::set_var(APP_DATA_DIR_ENV, absolute_test_path());

        let boundary = get_app_data_dir().expect("absolute dev app data dir should be accepted");

        assert_eq!(boundary.path, Some(absolute_test_path().to_string()));
        assert_eq!(boundary.source, "dev_env");
        assert_eq!(boundary.status, "resolved");

        std::env::remove_var(APP_DATA_DIR_ENV);
    }

    #[test]
    fn rejects_relative_app_data_dir() {
        let _guard = ENV_LOCK.lock().expect("app data dir env lock poisoned");
        std::env::set_var(APP_DATA_DIR_ENV, "relative/path");

        assert_eq!(
            get_app_data_dir().expect_err("relative paths must be rejected"),
            "SOLO_APP_DATA_DIR must be an absolute path"
        );

        std::env::remove_var(APP_DATA_DIR_ENV);
    }
}
