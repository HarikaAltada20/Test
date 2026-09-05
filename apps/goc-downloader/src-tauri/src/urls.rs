use crate::error::{AppError, AppResult};
use url::Url;

const ALLOWED_HOSTS: &[&str] = &[
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
];

/// Validate that a URL uses https and an exact allowed YouTube host.
pub fn validate_youtube_url(raw: &str) -> AppResult<Url> {
    let url = Url::parse(raw.trim()).map_err(|e| AppError::UrlNotAllowed(e.to_string()))?;
    if url.scheme() != "https" {
        return Err(AppError::UrlNotAllowed(
            "only https YouTube URLs are allowed".into(),
        ));
    }
    let host = url
        .host_str()
        .ok_or_else(|| AppError::UrlNotAllowed("missing host".into()))?;
    if !ALLOWED_HOSTS.contains(&host) {
        return Err(AppError::UrlNotAllowed(format!(
            "host not allowed: {host}"
        )));
    }
    // Reject userinfo / credentials
    if !url.username().is_empty() || url.password().is_some() {
        return Err(AppError::UrlNotAllowed(
            "credentials in URL not allowed".into(),
        ));
    }
    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_exact_hosts() {
        for u in [
            "https://youtube.com/watch?v=dQw4w9WgXcQ",
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
        ] {
            assert!(validate_youtube_url(u).is_ok(), "{u}");
        }
    }

    #[test]
    fn rejects_other_hosts() {
        assert!(validate_youtube_url("https://music.youtube.com/watch?v=x").is_err());
        assert!(validate_youtube_url("https://evil.com/?u=youtube.com").is_err());
        assert!(validate_youtube_url("https://www.youtube.com.evil.com/").is_err());
    }

    #[test]
    fn rejects_http_and_credentials() {
        assert!(validate_youtube_url("http://www.youtube.com/watch?v=x").is_err());
        assert!(validate_youtube_url("https://user:pass@www.youtube.com/watch?v=x").is_err());
    }
}
