use crate::models::MemoState;
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

const STORAGE_FILE: &str = "memo.json";

pub fn memo_path(app: &AppHandle) -> Result<PathBuf, String> {
  let app_data_dir = app
    .path()
    .app_data_dir()
    .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;

  fs::create_dir_all(&app_data_dir)
    .map_err(|error| format!("Failed to create app data directory: {error}"))?;

  Ok(app_data_dir.join(STORAGE_FILE))
}

pub fn load_memo(app: &AppHandle) -> Result<MemoState, String> {
  let path = memo_path(app)?;

  if !path.exists() {
    let memo = MemoState::blank_today();
    save_memo(app, memo.clone())?;
    return Ok(memo);
  }

  let contents = fs::read_to_string(&path)
    .map_err(|error| format!("Failed to read memo file {}: {error}", path.display()))?;

  let memo = serde_json::from_str::<MemoState>(&contents)
    .map_err(|error| format!("Failed to parse memo file {}: {error}", path.display()))?
    .normalize();

  save_memo(app, memo.clone())?;
  Ok(memo)
}

pub fn save_memo(app: &AppHandle, memo: MemoState) -> Result<MemoState, String> {
  let path = memo_path(app)?;
  let memo = memo.normalize();
  let json = serde_json::to_string_pretty(&memo)
    .map_err(|error| format!("Failed to serialize memo state: {error}"))?;

  fs::write(&path, json)
    .map_err(|error| format!("Failed to write memo file {}: {error}", path.display()))?;

  Ok(memo)
}
