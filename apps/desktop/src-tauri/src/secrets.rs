#[tauri::command]
pub fn get_secret_status() -> String {
    "scaffold-only: secret bridge is not implemented in PR-01".to_string()
}

#[cfg(test)]
mod tests {
    use super::get_secret_status;

    #[test]
    fn reports_scaffold_only_secret_contract() {
        assert_eq!(
            get_secret_status(),
            "scaffold-only: secret bridge is not implemented in PR-01"
        );
    }
}
