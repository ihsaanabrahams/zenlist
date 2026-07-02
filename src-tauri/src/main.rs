#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod icons;
mod models;
mod storage;

use tauri::{menu::MenuItem, tray::TrayIconEvent, Manager};

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      commands::load_memo,
      commands::save_memo,
      commands::reset_memo,
      commands::confirm_clear,
      commands::show_main_window,
      commands::is_window_pinned,
      commands::set_window_pinned,
      commands::quit_app,
    ])
    .setup(|app| {
      let show_item = MenuItem::new(app.handle(), "Show zenlist", true, None::<&str>)?;
      let quit_item = MenuItem::new(app.handle(), "Quit", true, None::<&str>)?;
      let menu = tauri::menu::Menu::with_items(app.handle(), &[&show_item, &quit_item])?;

      tauri::tray::TrayIconBuilder::new()
        .icon(icons::tray_icon())
        .tooltip("zenlist")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |tray_app, event| {
          if event.id() == show_item.id() {
            if let Some(window) = tray_app.get_webview_window("main") {
              let _ = window.show();
              let _ = window.set_focus();
            }
          }

          if event.id() == quit_item.id() {
            tray_app.exit(0);
          }
        })
        .on_tray_icon_event(move |tray_app, event| {
          if let TrayIconEvent::Click { button, .. } = event {
            if button == tauri::tray::MouseButton::Left {
              if let Some(window) = tray_app.app_handle().get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
              }
            }
          }
        })
        .build(app)?;

      if let Some(window) = app.get_webview_window("main") {
        window.set_decorations(false)?;
        window.set_resizable(false)?;
        window.set_skip_taskbar(true)?;
        window.set_shadow(true)?;
        window.set_maximizable(false)?;
        window.set_minimizable(false)?;
        window.show()?;

        let window_ref = window.clone();
        window.on_window_event(move |event| {
          if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window_ref.hide();
          }
        });
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running Zen Memo");
}
