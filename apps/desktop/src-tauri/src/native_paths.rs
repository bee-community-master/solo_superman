#[tauri::command]
pub fn get_app_data_dir() -> String {
    "scaffold-only: app data directory is assigned in a later PR".to_string()
}

#[cfg(test)]
mod tests {
    use super::get_app_data_dir;

    #[test]
    fn reports_scaffold_only_app_data_contract() {
        assert_eq!(
            get_app_data_dir(),
            "scaffold-only: app data directory is assigned in a later PR"
        );
    }
}
