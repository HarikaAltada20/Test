use crate::error::{AppError, AppResult, ConflictPolicy, JobStatus, QualityPreference};
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadItem {
    pub id: String,
    pub job_id: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub status: JobStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stage: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bytes_downloaded: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bytes_total: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speed_bps: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub eta_seconds: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: String,
    pub kind: String,
    pub status: JobStatus,
    pub destination: String,
    pub quality: QualityPreference,
    pub conflict: ConflictPolicy,
    pub create_zip: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_label: Option<String>,
    pub item_count: u32,
    pub completed_count: u32,
    pub failed_count: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub items: Option<Vec<DownloadItem>>,
}

pub struct Db {
    path: PathBuf,
}

impl Db {
    pub fn open(path: impl AsRef<Path>) -> AppResult<Self> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let db = Self { path };
        db.with_conn(|conn| {
            conn.execute_batch(
                r#"
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    kind TEXT NOT NULL,
                    status TEXT NOT NULL,
                    destination TEXT NOT NULL,
                    quality TEXT NOT NULL,
                    conflict TEXT NOT NULL,
                    create_zip INTEGER NOT NULL,
                    source_label TEXT,
                    item_count INTEGER NOT NULL,
                    completed_count INTEGER NOT NULL,
                    failed_count INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS items (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL,
                    url TEXT NOT NULL,
                    title TEXT,
                    status TEXT NOT NULL,
                    stage TEXT,
                    output_path TEXT,
                    bytes_downloaded INTEGER,
                    bytes_total INTEGER,
                    speed_bps INTEGER,
                    eta_seconds INTEGER,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(job_id) REFERENCES jobs(id)
                );
                "#,
            )?;
            Ok(())
        })?;
        db.recover_interrupted()?;
        db.reconcile_completed_manifest_outputs()?;
        Ok(db)
    }

    fn with_conn<T>(&self, f: impl FnOnce(&Connection) -> AppResult<T>) -> AppResult<T> {
        let conn = Connection::open(&self.path)?;
        f(&conn)
    }

    /// On restart, convert interrupted active jobs/items to resumable pending.
    pub fn recover_interrupted(&self) -> AppResult<usize> {
        self.with_conn(|conn| {
            let now = Utc::now().to_rfc3339();
            let jobs = conn.execute(
                "UPDATE jobs SET status = 'resumable', updated_at = ?1 WHERE status IN ('running', 'paused')",
                params![now],
            )?;
            let items = conn.execute(
                "UPDATE items SET status = 'pending', stage = NULL, updated_at = ?1 WHERE status IN ('running', 'paused')",
                params![now],
            )?;
            Ok(jobs + items)
        })
    }

    pub fn insert_job(&self, job: &Job, items: &[DownloadItem]) -> AppResult<()> {
        self.with_conn(|conn| {
            let tx = conn.unchecked_transaction()?;
            tx.execute(
                r#"INSERT INTO jobs (
                    id, kind, status, destination, quality, conflict, create_zip,
                    source_label, item_count, completed_count, failed_count, created_at, updated_at
                ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)"#,
                params![
                    job.id,
                    job.kind,
                    job.status.as_str(),
                    job.destination,
                    job.quality.as_str(),
                    job.conflict.as_str(),
                    job.create_zip as i64,
                    job.source_label,
                    job.item_count,
                    job.completed_count,
                    job.failed_count,
                    job.created_at.to_rfc3339(),
                    job.updated_at.to_rfc3339(),
                ],
            )?;
            for item in items {
                tx.execute(
                    r#"INSERT INTO items (
                        id, job_id, url, title, status, stage, output_path,
                        bytes_downloaded, bytes_total, speed_bps, eta_seconds, error,
                        created_at, updated_at
                    ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)"#,
                    params![
                        item.id,
                        item.job_id,
                        item.url,
                        item.title,
                        item.status.as_str(),
                        item.stage,
                        item.output_path,
                        item.bytes_downloaded.map(|v| v as i64),
                        item.bytes_total.map(|v| v as i64),
                        item.speed_bps.map(|v| v as i64),
                        item.eta_seconds.map(|v| v as i64),
                        item.error,
                        item.created_at.to_rfc3339(),
                        item.updated_at.to_rfc3339(),
                    ],
                )?;
            }
            tx.commit()?;
            Ok(())
        })
    }

    pub fn list_jobs(&self) -> AppResult<Vec<Job>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, kind, status, destination, quality, conflict, create_zip, source_label,
                        item_count, completed_count, failed_count, created_at, updated_at
                 FROM jobs ORDER BY updated_at DESC",
            )?;
            let rows = stmt.query_map([], map_job)?.collect::<Result<Vec<_>, _>>()?;
            Ok(rows)
        })
    }

    pub fn get_job(&self, id: &str) -> AppResult<Job> {
        self.with_conn(|conn| {
            let mut job = conn
                .query_row(
                    "SELECT id, kind, status, destination, quality, conflict, create_zip, source_label,
                            item_count, completed_count, failed_count, created_at, updated_at
                     FROM jobs WHERE id = ?1",
                    params![id],
                    map_job,
                )
                .map_err(|_| AppError::NotFound(format!("job {id}")))?;
            let mut stmt = conn.prepare(
                "SELECT id, job_id, url, title, status, stage, output_path, bytes_downloaded,
                        bytes_total, speed_bps, eta_seconds, error, created_at, updated_at
                 FROM items WHERE job_id = ?1 ORDER BY created_at ASC",
            )?;
            let items = stmt
                .query_map(params![id], map_item)?
                .collect::<Result<Vec<_>, _>>()?;
            job.items = Some(items);
            Ok(job)
        })
    }

    pub fn update_job_status(&self, id: &str, status: JobStatus) -> AppResult<()> {
        self.with_conn(|conn| {
            let n = conn.execute(
                "UPDATE jobs SET status = ?1, updated_at = ?2 WHERE id = ?3",
                params![status.as_str(), Utc::now().to_rfc3339(), id],
            )?;
            if n == 0 {
                return Err(AppError::NotFound(format!("job {id}")));
            }
            Ok(())
        })
    }

    /// Persist one terminal item result and atomically recalculate job counters.
    pub fn finish_item(
        &self,
        job_id: &str,
        item_id: &str,
        status: JobStatus,
        output_path: Option<&Path>,
        error: Option<&str>,
    ) -> AppResult<()> {
        if !matches!(status, JobStatus::Completed | JobStatus::Failed) {
            return Err(AppError::Database(
                "finish_item requires completed or failed status".into(),
            ));
        }

        self.with_conn(|conn| {
            let tx = conn.unchecked_transaction()?;
            let now = Utc::now().to_rfc3339();
            let output = output_path.map(|path| path.to_string_lossy().into_owned());
            let changed = tx.execute(
                r#"UPDATE items
                   SET status = ?1,
                       stage = ?2,
                       output_path = ?3,
                       error = ?4,
                       updated_at = ?5
                   WHERE id = ?6 AND job_id = ?7"#,
                params![
                    status.as_str(),
                    if status == JobStatus::Completed {
                        "done"
                    } else {
                        "error"
                    },
                    output,
                    error,
                    now,
                    item_id,
                    job_id,
                ],
            )?;
            if changed == 0 {
                return Err(AppError::NotFound(format!(
                    "item {item_id} in job {job_id}"
                )));
            }

            tx.execute(
                r#"UPDATE jobs
                   SET completed_count = (
                         SELECT COUNT(*) FROM items
                         WHERE job_id = ?1 AND status = 'completed'
                       ),
                       failed_count = (
                         SELECT COUNT(*) FROM items
                         WHERE job_id = ?1 AND status = 'failed'
                       ),
                       updated_at = ?2
                   WHERE id = ?1"#,
                params![job_id, now],
            )?;
            tx.commit()?;
            Ok(())
        })
    }

    /// Repair legacy completed manifest jobs created before per-item results
    /// were persisted. Exact manifest filenames let us verify completed files
    /// without guessing.
    pub fn reconcile_completed_manifest_outputs(&self) -> AppResult<usize> {
        let jobs = self.list_jobs()?;
        let mut repaired = 0;

        for job in jobs {
            if job.kind != "manifest" || job.status != JobStatus::Completed {
                continue;
            }
            let loaded = self.get_job(&job.id)?;
            for item in loaded.items.unwrap_or_default() {
                if item.status == JobStatus::Completed {
                    continue;
                }
                let Some(filename) = item.title.as_deref() else {
                    continue;
                };
                let output = Path::new(&job.destination).join(filename);
                if output.is_file() {
                    self.finish_item(
                        &job.id,
                        &item.id,
                        JobStatus::Completed,
                        Some(&output),
                        None,
                    )?;
                    repaired += 1;
                }
            }
        }

        Ok(repaired)
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

fn map_job(row: &rusqlite::Row<'_>) -> rusqlite::Result<Job> {
    Ok(Job {
        id: row.get(0)?,
        kind: row.get(1)?,
        status: JobStatus::parse(&row.get::<_, String>(2)?),
        destination: row.get(3)?,
        quality: QualityPreference::parse(&row.get::<_, String>(4)?),
        conflict: ConflictPolicy::parse(&row.get::<_, String>(5)?),
        create_zip: row.get::<_, i64>(6)? != 0,
        source_label: row.get(7)?,
        item_count: row.get::<_, i64>(8)? as u32,
        completed_count: row.get::<_, i64>(9)? as u32,
        failed_count: row.get::<_, i64>(10)? as u32,
        created_at: parse_dt(&row.get::<_, String>(11)?),
        updated_at: parse_dt(&row.get::<_, String>(12)?),
        items: None,
    })
}

fn map_item(row: &rusqlite::Row<'_>) -> rusqlite::Result<DownloadItem> {
    Ok(DownloadItem {
        id: row.get(0)?,
        job_id: row.get(1)?,
        url: row.get(2)?,
        title: row.get(3)?,
        status: JobStatus::parse(&row.get::<_, String>(4)?),
        stage: row.get(5)?,
        output_path: row.get(6)?,
        bytes_downloaded: row.get::<_, Option<i64>>(7)?.map(|v| v as u64),
        bytes_total: row.get::<_, Option<i64>>(8)?.map(|v| v as u64),
        speed_bps: row.get::<_, Option<i64>>(9)?.map(|v| v as u64),
        eta_seconds: row.get::<_, Option<i64>>(10)?.map(|v| v as u64),
        error: row.get(11)?,
        created_at: parse_dt(&row.get::<_, String>(12)?),
        updated_at: parse_dt(&row.get::<_, String>(13)?),
    })
}

fn parse_dt(s: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(s)
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now())
}

pub fn new_job_id() -> String {
    Uuid::new_v4().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn recovers_interrupted_active_to_resumable() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("jobs.db");
        let db = Db::open(&db_path).unwrap();
        let now = Utc::now();
        let job = Job {
            id: "job-1".into(),
            kind: "manual".into(),
            status: JobStatus::Running,
            destination: dir.path().to_string_lossy().into(),
            quality: QualityPreference::Best,
            conflict: ConflictPolicy::Rename,
            create_zip: false,
            source_label: None,
            item_count: 1,
            completed_count: 0,
            failed_count: 0,
            created_at: now,
            updated_at: now,
            items: None,
        };
        let item = DownloadItem {
            id: "item-1".into(),
            job_id: "job-1".into(),
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ".into(),
            title: None,
            status: JobStatus::Running,
            stage: Some("downloading".into()),
            output_path: None,
            bytes_downloaded: Some(100),
            bytes_total: Some(1000),
            speed_bps: None,
            eta_seconds: None,
            error: None,
            created_at: now,
            updated_at: now,
        };
        db.insert_job(&job, &[item]).unwrap();

        // Simulate restart recovery
        let recovered = db.recover_interrupted().unwrap();
        assert!(recovered >= 2);
        let loaded = db.get_job("job-1").unwrap();
        assert_eq!(loaded.status, JobStatus::Resumable);
        let items = loaded.items.unwrap();
        assert_eq!(items[0].status, JobStatus::Pending);
    }

    #[test]
    fn terminal_item_updates_job_counters() {
        let dir = tempdir().unwrap();
        let db = Db::open(dir.path().join("jobs.db")).unwrap();
        let now = Utc::now();
        let job = Job {
            id: "job-counts".into(),
            kind: "manual".into(),
            status: JobStatus::Running,
            destination: dir.path().to_string_lossy().into(),
            quality: QualityPreference::Best,
            conflict: ConflictPolicy::Rename,
            create_zip: false,
            source_label: None,
            item_count: 2,
            completed_count: 0,
            failed_count: 0,
            created_at: now,
            updated_at: now,
            items: None,
        };
        let make_item = |id: &str| DownloadItem {
            id: id.into(),
            job_id: job.id.clone(),
            url: format!("https://www.youtube.com/watch?v={id}"),
            title: None,
            status: JobStatus::Pending,
            stage: None,
            output_path: None,
            bytes_downloaded: None,
            bytes_total: None,
            speed_bps: None,
            eta_seconds: None,
            error: None,
            created_at: now,
            updated_at: now,
        };
        db.insert_job(&job, &[make_item("item-1"), make_item("item-2")])
            .unwrap();

        let output = dir.path().join("video.mp4");
        db.finish_item(
            &job.id,
            "item-1",
            JobStatus::Completed,
            Some(&output),
            None,
        )
        .unwrap();
        db.finish_item(
            &job.id,
            "item-2",
            JobStatus::Failed,
            None,
            Some("network error"),
        )
        .unwrap();

        let loaded = db.get_job(&job.id).unwrap();
        assert_eq!(loaded.completed_count, 1);
        assert_eq!(loaded.failed_count, 1);
        let items = loaded.items.unwrap();
        assert_eq!(items[0].status, JobStatus::Completed);
        assert_eq!(items[1].status, JobStatus::Failed);
    }

    #[test]
    fn repairs_legacy_manifest_counts_from_exact_files() {
        let dir = tempdir().unwrap();
        let db = Db::open(dir.path().join("jobs.db")).unwrap();
        let now = Utc::now();
        let filename = "000000123456_creator.mp4";
        std::fs::write(dir.path().join(filename), b"test video").unwrap();
        let job = Job {
            id: "legacy-manifest".into(),
            kind: "manifest".into(),
            status: JobStatus::Completed,
            destination: dir.path().to_string_lossy().into(),
            quality: QualityPreference::Best,
            conflict: ConflictPolicy::Rename,
            create_zip: false,
            source_label: None,
            item_count: 1,
            completed_count: 0,
            failed_count: 0,
            created_at: now,
            updated_at: now,
            items: None,
        };
        let item = DownloadItem {
            id: "legacy-item".into(),
            job_id: job.id.clone(),
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ".into(),
            title: Some(filename.into()),
            status: JobStatus::Pending,
            stage: None,
            output_path: None,
            bytes_downloaded: None,
            bytes_total: None,
            speed_bps: None,
            eta_seconds: None,
            error: None,
            created_at: now,
            updated_at: now,
        };
        db.insert_job(&job, &[item]).unwrap();

        assert_eq!(db.reconcile_completed_manifest_outputs().unwrap(), 1);
        let loaded = db.get_job(&job.id).unwrap();
        assert_eq!(loaded.completed_count, 1);
        assert_eq!(
            loaded.items.unwrap()[0].status,
            JobStatus::Completed
        );
    }
}
