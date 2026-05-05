#[tauri::command]
pub fn get_secret_status() -> String {
    "secret-ref boundary stub: OS secret store integration starts after storage/runtime setup"
        .to_string()
}

#[tauri::command]
pub fn read_secret_ref(secret_ref: String) -> Result<SecretRefReadResult, String> {
    let secret_ref = non_empty_secret_ref(secret_ref)?;

    Ok(SecretRefReadResult {
        secret_ref,
        status: "missing".to_string(),
        value: None,
        reason: "secret store is not implemented in PR-02".to_string(),
    })
}

#[tauri::command]
pub fn write_secret_ref(secret_ref: String, secret_value: String) -> Result<SecretRefWriteResult, String> {
    let secret_ref = non_empty_secret_ref(secret_ref)?;
    drop(secret_value);

    Ok(SecretRefWriteResult {
        secret_ref,
        stored: false,
        status: "not_implemented".to_string(),
        reason: "PR-02 declares the native boundary but does not persist secrets".to_string(),
    })
}

fn non_empty_secret_ref(secret_ref: String) -> Result<String, String> {
    if secret_ref.trim().is_empty() {
        return Err("secret_ref must not be empty".to_string());
    }

    Ok(secret_ref)
}

#[derive(Debug, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretRefReadResult {
    pub secret_ref: String,
    pub status: String,
    pub value: Option<String>,
    pub reason: String,
}

#[derive(Debug, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretRefWriteResult {
    pub secret_ref: String,
    pub stored: bool,
    pub status: String,
    pub reason: String,
}

#[cfg(test)]
mod tests {
    use super::{get_secret_status, read_secret_ref, write_secret_ref};

    #[test]
    fn reports_secret_ref_boundary_stub() {
        assert_eq!(
            get_secret_status(),
            "secret-ref boundary stub: OS secret store integration starts after storage/runtime setup"
        );
    }

    #[test]
    fn read_secret_ref_returns_missing_without_plaintext_persistence() {
        let result = read_secret_ref("remote-db-token".to_string())
            .expect("non-empty secret refs should reach the stub boundary");

        assert_eq!(result.secret_ref, "remote-db-token");
        assert_eq!(result.status, "missing");
        assert_eq!(result.value, None);
    }

    #[test]
    fn write_secret_ref_accepts_the_boundary_call_without_storing() {
        let result = write_secret_ref("remote-db-token".to_string(), "secret".to_string())
            .expect("non-empty secret refs should reach the stub boundary");

        assert_eq!(result.secret_ref, "remote-db-token");
        assert!(!result.stored);
        assert_eq!(result.status, "not_implemented");
    }

    #[test]
    fn rejects_blank_secret_refs_before_secret_store_integration() {
        assert_eq!(
            read_secret_ref("   ".to_string()).expect_err("blank read refs must be rejected"),
            "secret_ref must not be empty"
        );
        assert_eq!(
            write_secret_ref("".to_string(), "secret".to_string())
                .expect_err("blank write refs must be rejected"),
            "secret_ref must not be empty"
        );
    }
}
