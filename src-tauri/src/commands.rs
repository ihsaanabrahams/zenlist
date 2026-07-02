use crate::{models::MemoState, storage};
use rfd::{MessageButtons, MessageDialog, MessageDialogResult, MessageLevel};
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn load_memo(app: AppHandle) -> Result<MemoState, String> {
  storage::load_memo(&app)
}

#[tauri::command]
pub fn save_memo(app: AppHandle, memo: MemoState) -> Result<MemoState, String> {
  storage::save_memo(&app, memo)
}

#[tauri::command]
pub fn reset_memo(app: AppHandle) -> Result<MemoState, String> {
  storage::save_memo(&app, MemoState::blank_today())
}

#[tauri::command]
pub fn confirm_clear() -> Result<bool, String> {
  let result = MessageDialog::new()
    .set_level(MessageLevel::Warning)
    .set_title("zenlist")
    .set_description("Clear all five tasks?")
    .set_buttons(MessageButtons::OkCancelCustom("Clear".to_string(), "Cancel".to_string()))
    .show();

  Ok(matches!(result, MessageDialogResult::Custom(label) if label == "Clear"))
}

#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), String> {
  if let Some(window) = app.get_webview_window("main") {
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
  }

  Ok(())
}

#[tauri::command]
pub fn is_window_pinned(app: AppHandle) -> Result<bool, String> {
  if let Some(window) = app.get_webview_window("main") {
    return window.is_always_on_top().map_err(|error| error.to_string());
  }

  Ok(false)
}

#[tauri::command]
pub fn set_window_pinned(app: AppHandle, pinned: bool) -> Result<bool, String> {
  if let Some(window) = app.get_webview_window("main") {
    window
      .set_always_on_top(pinned)
      .map_err(|error| error.to_string())?;
    return window.is_always_on_top().map_err(|error| error.to_string());
  }

  Ok(false)
}

#[tauri::command]
pub fn quit_app(app: AppHandle) -> Result<(), String> {
  app.exit(0);
  Ok(())
}
