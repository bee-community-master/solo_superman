use std::sync::OnceLock;

const DEFAULT_SIDECAR_BASE_URL: &str = "http://127.0.0.1:43110";
const SIDECAR_BASE_URL_ENV: &str = "SOLO_SIDECAR_BASE_URL";
const LOCAL_CAPABILITY_TOKEN_ENV: &str = "SOLO_LOCAL_CAPABILITY_TOKEN";
static GENERATED_LOCAL_CAPABILITY_TOKEN: OnceLock<Result<String, String>> = OnceLock::new();

#[tauri::command]
pub fn get_sidecar_base_url() -> Result<SidecarDiscovery, String> {
    discover_sidecar_base_url()
}

#[derive(Debug, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SidecarDiscovery {
    pub base_url: String,
    pub mode: String,
    pub status: String,
    pub local_capability_token: String,
    pub token_source: String,
}

fn discover_sidecar_base_url() -> Result<SidecarDiscovery, String> {
    let env_value = std::env::var(SIDECAR_BASE_URL_ENV).ok();
    let base_url = env_value
        .clone()
        .unwrap_or_else(|| DEFAULT_SIDECAR_BASE_URL.to_string());

    if !is_loopback_http_url(&base_url) {
        return Err("sidecar base URL must be loopback-only".to_string());
    }

    let token = local_capability_token()?;

    Ok(SidecarDiscovery {
        base_url,
        mode: if env_value.is_some() {
            "mock_packaged_env".to_string()
        } else {
            "dev_default".to_string()
        },
        status: "discovered".to_string(),
        local_capability_token: token.value,
        token_source: token.source,
    })
}

fn is_loopback_http_url(value: &str) -> bool {
    let Some(authority) = value.strip_prefix("http://") else {
        return false;
    };

    let Some(port) = authority
        .strip_prefix("[::1]:")
        .or_else(|| authority.strip_prefix("127.0.0.1:"))
        .or_else(|| authority.strip_prefix("localhost:"))
    else {
        return false;
    };

    port.parse::<u16>().is_ok_and(|parsed| parsed > 0)
}

struct LocalCapabilityToken {
    value: String,
    source: String,
}

fn local_capability_token() -> Result<LocalCapabilityToken, String> {
    match std::env::var(LOCAL_CAPABILITY_TOKEN_ENV) {
        Ok(token) if token.trim().is_empty() => {
            Err("SOLO_LOCAL_CAPABILITY_TOKEN must not be empty".to_string())
        }
        Ok(token) => Ok(LocalCapabilityToken {
            value: token,
            source: "dev_env".to_string(),
        }),
        Err(_) => Ok(LocalCapabilityToken {
            value: generated_local_capability_token()?,
            source: "generated_in_tauri_memory".to_string(),
        }),
    }
}

fn generated_local_capability_token() -> Result<String, String> {
    GENERATED_LOCAL_CAPABILITY_TOKEN
        .get_or_init(generate_local_capability_token)
        .clone()
}

fn generate_local_capability_token() -> Result<String, String> {
    let mut bytes = [0_u8; 32];
    getrandom::fill(&mut bytes)
        .map_err(|error| format!("failed to generate local capability token: {error}"))?;

    Ok(hex_encode(&bytes))
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);

    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }

    output
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::{
        get_sidecar_base_url, DEFAULT_SIDECAR_BASE_URL, LOCAL_CAPABILITY_TOKEN_ENV,
        SIDECAR_BASE_URL_ENV,
    };

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn uses_default_sidecar_base_url_when_env_is_absent() {
        let _guard = ENV_LOCK.lock().expect("sidecar env lock poisoned");
        std::env::remove_var(SIDECAR_BASE_URL_ENV);
        std::env::remove_var(LOCAL_CAPABILITY_TOKEN_ENV);

        let discovery = get_sidecar_base_url().expect("default sidecar URL should be loopback");

        assert_eq!(discovery.base_url, DEFAULT_SIDECAR_BASE_URL);
        assert_eq!(discovery.mode, "dev_default");
        assert_eq!(discovery.status, "discovered");
        assert_eq!(discovery.local_capability_token.len(), 64);
        assert_eq!(discovery.token_source, "generated_in_tauri_memory");
    }

    #[test]
    fn uses_mock_packaged_sidecar_base_url_from_env() {
        let _guard = ENV_LOCK.lock().expect("sidecar env lock poisoned");
        std::env::set_var(SIDECAR_BASE_URL_ENV, "http://127.0.0.1:61234");
        std::env::set_var(LOCAL_CAPABILITY_TOKEN_ENV, "shared-test-token");

        let discovery = get_sidecar_base_url().expect("mock packaged URL should be loopback");

        assert_eq!(discovery.base_url, "http://127.0.0.1:61234");
        assert_eq!(discovery.mode, "mock_packaged_env");
        assert_eq!(discovery.local_capability_token, "shared-test-token");
        assert_eq!(discovery.token_source, "dev_env");

        std::env::remove_var(SIDECAR_BASE_URL_ENV);
        std::env::remove_var(LOCAL_CAPABILITY_TOKEN_ENV);
    }

    #[test]
    fn rejects_empty_local_capability_token_from_env() {
        let _guard = ENV_LOCK.lock().expect("sidecar env lock poisoned");
        std::env::set_var(LOCAL_CAPABILITY_TOKEN_ENV, "   ");

        assert_eq!(
            get_sidecar_base_url().expect_err("empty token must be rejected"),
            "SOLO_LOCAL_CAPABILITY_TOKEN must not be empty"
        );

        std::env::remove_var(LOCAL_CAPABILITY_TOKEN_ENV);
    }

    #[test]
    fn rejects_non_loopback_sidecar_base_url_from_env() {
        let _guard = ENV_LOCK.lock().expect("sidecar env lock poisoned");
        std::env::set_var(SIDECAR_BASE_URL_ENV, "http://192.0.2.10:43110");

        assert_eq!(
            get_sidecar_base_url().expect_err("non-loopback URL must be rejected"),
            "sidecar base URL must be loopback-only"
        );

        std::env::remove_var(SIDECAR_BASE_URL_ENV);
    }

    #[test]
    fn rejects_loopback_prefix_url_with_remote_authority() {
        let _guard = ENV_LOCK.lock().expect("sidecar env lock poisoned");
        std::env::set_var(SIDECAR_BASE_URL_ENV, "http://127.0.0.1:43110@evil.example");

        assert_eq!(
            get_sidecar_base_url().expect_err("userinfo tricks must not pass loopback validation"),
            "sidecar base URL must be loopback-only"
        );

        std::env::remove_var(SIDECAR_BASE_URL_ENV);
    }

    #[test]
    fn rejects_loopback_prefix_url_with_extra_path() {
        let _guard = ENV_LOCK.lock().expect("sidecar env lock poisoned");
        std::env::set_var(SIDECAR_BASE_URL_ENV, "http://127.0.0.1:43110/api");

        assert_eq!(
            get_sidecar_base_url().expect_err("base URL must be host and port only"),
            "sidecar base URL must be loopback-only"
        );

        std::env::remove_var(SIDECAR_BASE_URL_ENV);
    }
}
