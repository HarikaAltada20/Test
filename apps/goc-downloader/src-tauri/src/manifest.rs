//! Signed `.gocdownload` verification aligned with `lib/goc-download/schemas.ts`.
//!
//! Unsigned payload (everything except `signature`) is JCS-canonicalized, then
//! verified with Ed25519. Cross-language vector: `lib/goc-download/test-vector.ts`.

use crate::error::{AppError, AppResult};
use crate::urls::validate_youtube_url;
use base64::Engine;
use chrono::{DateTime, Duration, Utc};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::Path;

const CLOCK_SKEW: Duration = Duration::minutes(5);
const SUPPORTED_VERSION: u64 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestContext {
    pub job_id: String,
    #[serde(default)]
    pub contest_id: Option<String>,
    pub user_id: String,
    pub naming_pattern: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestArchive {
    pub archive_id: String,
    pub zip_filename: String,
    pub item_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestItem {
    pub item_id: String,
    #[serde(default)]
    pub submission_id: Option<String>,
    pub url: String,
    pub filename: String,
    pub platform: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestCallback {
    pub status_url: String,
    pub status_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestSignature {
    pub key_id: String,
    pub algorithm: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub version: u64,
    pub context: ManifestContext,
    pub archives: Vec<ManifestArchive>,
    pub items: Vec<ManifestItem>,
    pub callback: ManifestCallback,
    pub signature: ManifestSignature,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicKeyEntry {
    pub key_id: String,
    pub algorithm: String,
    pub public_key_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PublicKeysFile {
    keys: Vec<PublicKeyEntry>,
}

pub fn load_public_keys(path: &Path) -> AppResult<Vec<PublicKeyEntry>> {
    let raw = fs::read_to_string(path).map_err(|e| AppError::Manifest(e.to_string()))?;
    let file: PublicKeysFile =
        serde_json::from_str(&raw).map_err(|e| AppError::Manifest(e.to_string()))?;
    Ok(file.keys)
}

pub fn verify_manifest_file(path: &Path, keys_path: &Path) -> AppResult<Manifest> {
    let raw = fs::read_to_string(path).map_err(|e| AppError::Manifest(e.to_string()))?;
    verify_manifest_json(&raw, keys_path)
}

pub fn verify_manifest_json(raw: &str, keys_path: &Path) -> AppResult<Manifest> {
    let value: Value =
        serde_json::from_str(raw).map_err(|e| AppError::Manifest(e.to_string()))?;
    let manifest: Manifest =
        serde_json::from_value(value.clone()).map_err(|e| AppError::Manifest(e.to_string()))?;

    validate_schema(&manifest)?;
    validate_expiry(&manifest, Utc::now())?;

    let mut seen_item_ids = std::collections::HashSet::new();
    for item in &manifest.items {
        if !seen_item_ids.insert(item.item_id.clone()) {
            return Err(AppError::Manifest(format!(
                "duplicate itemId {}",
                item.item_id
            )));
        }
        if item.platform != "youtube" {
            return Err(AppError::Manifest(format!(
                "unsupported platform {}",
                item.platform
            )));
        }
        validate_youtube_url(&item.url)?;
        crate::path_safety::assert_safe_filename(&item.filename)?;
    }

    for archive in &manifest.archives {
        crate::path_safety::assert_safe_filename(&archive.zip_filename)?;
        for id in &archive.item_ids {
            if !seen_item_ids.contains(id) {
                return Err(AppError::Manifest(format!(
                    "archive references unknown itemId {id}"
                )));
            }
        }
    }

    let keys = load_public_keys(keys_path)?;
    let key = keys
        .iter()
        .find(|k| k.key_id == manifest.signature.key_id)
        .ok_or_else(|| {
            AppError::Manifest(format!("unknown keyId {}", manifest.signature.key_id))
        })?;
    if key.algorithm != "Ed25519" || manifest.signature.algorithm != "Ed25519" {
        return Err(AppError::Manifest("unsupported algorithm".into()));
    }
    if key.public_key_base64 == "REPLACE_AFTER_KEYGEN" {
        return Err(AppError::Manifest(
            "development public key placeholder not replaced — run scripts/generate-dev-keys.mjs"
                .into(),
        ));
    }

    let mut signing_value = value;
    if let Value::Object(map) = &mut signing_value {
        map.remove("signature");
    }
    let canonical = serde_jcs::to_string(&signing_value)
        .map_err(|e| AppError::Manifest(format!("JCS canonicalize failed: {e}")))?;

    let pk_bytes = base64::engine::general_purpose::STANDARD
        .decode(key.public_key_base64.trim())
        .map_err(|e| AppError::Manifest(format!("public key base64: {e}")))?;
    let pk_array: [u8; 32] = pk_bytes
        .try_into()
        .map_err(|_| AppError::Manifest("public key must be 32 bytes".into()))?;
    let verifying = VerifyingKey::from_bytes(&pk_array)
        .map_err(|e| AppError::Manifest(format!("invalid public key: {e}")))?;

    let sig_bytes = base64::engine::general_purpose::STANDARD
        .decode(manifest.signature.value.trim())
        .map_err(|_| AppError::SignatureInvalid)?;
    let sig_array: [u8; 64] = sig_bytes
        .try_into()
        .map_err(|_| AppError::SignatureInvalid)?;
    let signature = Signature::from_bytes(&sig_array);

    verifying
        .verify(canonical.as_bytes(), &signature)
        .map_err(|_| AppError::SignatureInvalid)?;

    Ok(manifest)
}

fn validate_schema(manifest: &Manifest) -> AppResult<()> {
    if manifest.version != SUPPORTED_VERSION {
        return Err(AppError::Manifest(format!(
            "unsupported manifest version {}",
            manifest.version
        )));
    }
    if manifest.items.is_empty() {
        return Err(AppError::Manifest("manifest has no items".into()));
    }
    if manifest.items.len() > 100 {
        return Err(AppError::Manifest("manifest exceeds 100 items".into()));
    }
    if manifest.archives.is_empty() {
        return Err(AppError::Manifest("manifest has no archives".into()));
    }
    if manifest.callback.status_url.is_empty() || manifest.callback.status_token.len() < 16 {
        return Err(AppError::Manifest("invalid callback credentials".into()));
    }
    Ok(())
}

fn validate_expiry(manifest: &Manifest, now: DateTime<Utc>) -> AppResult<()> {
    if now + CLOCK_SKEW < manifest.context.created_at {
        return Err(AppError::Manifest(
            "manifest createdAt is too far in the future".into(),
        ));
    }
    if now > manifest.context.expires_at + CLOCK_SKEW {
        return Err(AppError::ManifestExpired);
    }
    Ok(())
}

/// Fixed cross-language unsigned payload (mirrors TS `TEST_VECTOR_UNSIGNED_PAYLOAD`).
#[cfg(test)]
pub fn test_vector_unsigned_json() -> Value {
    serde_json::json!({
        "version": 1,
        "context": {
            "jobId": "11111111-1111-4111-8111-111111111111",
            "contestId": "22222222-2222-4222-8222-222222222222",
            "userId": "33333333-3333-4333-8333-333333333333",
            "namingPattern": "views_username",
            "createdAt": "2026-09-05T00:00:00.000Z",
            "expiresAt": "2026-09-05T01:00:00.000Z"
        },
        "archives": [{
            "archiveId": "44444444-4444-4444-8444-444444444444",
            "zipFilename": "contest_part_1_of_1.zip",
            "itemIds": ["55555555-5555-4555-8555-555555555555"]
        }],
        "items": [{
            "itemId": "55555555-5555-4555-8555-555555555555",
            "submissionId": "66666666-6666-4666-8666-666666666666",
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "filename": "000000012345_creator.mp4",
            "platform": "youtube"
        }],
        "callback": {
            "statusUrl": "https://example.com/api/admin/bulk-download/desktop-status",
            "statusToken": "test.status.token.placeholder.value"
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};
    use rand::rngs::OsRng;

    #[test]
    fn test_vector_jcs_is_stable() {
        let v = test_vector_unsigned_json();
        let a = serde_jcs::to_string(&v).unwrap();
        let b = serde_jcs::to_string(&v).unwrap();
        assert_eq!(a, b);
        assert!(a.contains("\"version\":1"));
        assert!(a.contains("000000012345_creator.mp4"));
    }

    #[test]
    fn sign_and_verify_roundtrip() {
        let mut csprng = OsRng;
        let signing = SigningKey::generate(&mut csprng);
        let verifying = signing.verifying_key();
        let pk_b64 = base64::engine::general_purpose::STANDARD.encode(verifying.as_bytes());

        let dir = tempfile::tempdir().unwrap();
        let keys_path = dir.path().join("keys.json");
        fs::write(
            &keys_path,
            serde_json::json!({
                "keys": [{
                    "keyId": "test-1",
                    "algorithm": "Ed25519",
                    "publicKeyBase64": pk_b64
                }]
            })
            .to_string(),
        )
        .unwrap();

        let mut unsigned = test_vector_unsigned_json();
        // Extend expiry so validation passes at runtime.
        if let Value::Object(map) = &mut unsigned {
            if let Some(Value::Object(ctx)) = map.get_mut("context") {
                ctx.insert(
                    "expiresAt".into(),
                    Value::String((Utc::now() + Duration::hours(1)).to_rfc3339()),
                );
                ctx.insert(
                    "createdAt".into(),
                    Value::String(Utc::now().to_rfc3339()),
                );
            }
        }
        let canonical = serde_jcs::to_string(&unsigned).unwrap();
        let sig = signing.sign(canonical.as_bytes());
        let sig_b64 = base64::engine::general_purpose::STANDARD.encode(sig.to_bytes());

        let mut signed = unsigned;
        if let Value::Object(map) = &mut signed {
            map.insert(
                "signature".into(),
                serde_json::json!({
                    "keyId": "test-1",
                    "algorithm": "Ed25519",
                    "value": sig_b64
                }),
            );
        }

        let raw = serde_json::to_string(&signed).unwrap();
        let verified = verify_manifest_json(&raw, &keys_path).unwrap();
        assert_eq!(verified.version, 1);
        assert_eq!(verified.items.len(), 1);
        assert_eq!(verified.items[0].filename, "000000012345_creator.mp4");
    }

    #[test]
    fn rejects_tampered_filename() {
        let mut csprng = OsRng;
        let signing = SigningKey::generate(&mut csprng);
        let verifying = signing.verifying_key();
        let pk_b64 = base64::engine::general_purpose::STANDARD.encode(verifying.as_bytes());

        let dir = tempfile::tempdir().unwrap();
        let keys_path = dir.path().join("keys.json");
        fs::write(
            &keys_path,
            serde_json::json!({
                "keys": [{
                    "keyId": "test-1",
                    "algorithm": "Ed25519",
                    "publicKeyBase64": pk_b64
                }]
            })
            .to_string(),
        )
        .unwrap();

        let mut unsigned = test_vector_unsigned_json();
        if let Value::Object(map) = &mut unsigned {
            if let Some(Value::Object(ctx)) = map.get_mut("context") {
                ctx.insert(
                    "expiresAt".into(),
                    Value::String((Utc::now() + Duration::hours(1)).to_rfc3339()),
                );
                ctx.insert(
                    "createdAt".into(),
                    Value::String(Utc::now().to_rfc3339()),
                );
            }
        }
        let canonical = serde_jcs::to_string(&unsigned).unwrap();
        let sig = signing.sign(canonical.as_bytes());
        let sig_b64 = base64::engine::general_purpose::STANDARD.encode(sig.to_bytes());

        let mut signed = unsigned;
        if let Value::Object(map) = &mut signed {
            map.insert(
                "signature".into(),
                serde_json::json!({
                    "keyId": "test-1",
                    "algorithm": "Ed25519",
                    "value": sig_b64
                }),
            );
            if let Some(Value::Array(items)) = map.get_mut("items") {
                if let Some(Value::Object(item)) = items.get_mut(0) {
                    item.insert("filename".into(), Value::String("evil.mp4".into()));
                }
            }
        }

        let raw = serde_json::to_string(&signed).unwrap();
        let err = verify_manifest_json(&raw, &keys_path).unwrap_err();
        assert!(matches!(
            err,
            AppError::SignatureInvalid | AppError::Manifest(_)
        ));
    }
}
