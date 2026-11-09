//! Desktop shell for Offline Preset Editor for Dante.
//!
//! The editor itself is the HTML/JS page in ../src/index.html (the same file that runs in a browser).
//! This Rust side gives it what a web page can't have:
//!   * a native menu bar (File / Edit / View / Window)
//!   * native Open / Save / Save As dialogs and direct file reads and writes
//!   * native "are you sure?" dialogs
//!   * files opened from Finder / Explorer ("Open With", dragging onto the icon, or onto the window)
//!   * a prompt before closing with unsaved changes
//!
//! The page calls the #[tauri::command] functions below with window.__TAURI__.core.invoke(...)
//! and listens for the events "menu", "open-paths" and "close-requested".

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::menu::{AboutMetadataBuilder, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, RunEvent, WebviewWindow, WindowEvent};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

/// Files we were asked to open before the page was ready, and whether the page is listening yet.
#[derive(Default)]
struct AppState {
    pending: Mutex<Vec<String>>,
    ready: AtomicBool,
}

// ---------- commands called from the page ----------

/// Show the native Open dialog. Returns the chosen path, or None if cancelled.
#[tauri::command]
async fn open_dialog(app: AppHandle, dir: Option<String>) -> Result<Option<String>, String> {
    let mut d = app
        .dialog()
        .file()
        .set_title("Open Dante preset")
        .add_filter("Dante preset", &["xml"]);
    if let Some(dir) = dir {
        d = d.set_directory(dir);
    }
    match d.blocking_pick_file() {
        None => Ok(None),
        Some(fp) => Ok(Some(fp.into_path().map_err(|e| e.to_string())?.to_string_lossy().into_owned())),
    }
}

/// Show the native Save dialog. Returns the chosen path, or None if cancelled.
#[tauri::command]
async fn save_dialog(app: AppHandle, suggested: String, dir: Option<String>) -> Result<Option<String>, String> {
    let mut d = app
        .dialog()
        .file()
        .set_title("Save Dante preset")
        .add_filter("Dante preset", &["xml"])
        .set_file_name(suggested);
    if let Some(dir) = dir {
        d = d.set_directory(dir);
    }
    match d.blocking_save_file() {
        None => Ok(None),
        Some(fp) => Ok(Some(fp.into_path().map_err(|e| e.to_string())?.to_string_lossy().into_owned())),
    }
}

#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("{e}"))
}

/// Write via a temporary file and rename, so a failed save never leaves a half-written preset.
#[tauri::command]
async fn write_file(path: String, contents: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    let mut tmp = target.clone();
    tmp.set_extension("xml.saving");
    std::fs::write(&tmp, contents.as_bytes()).map_err(|e| format!("{e}"))?;
    std::fs::rename(&tmp, &target).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        format!("{e}")
    })
}

/// Native OK / Cancel question. Returns true for OK.
#[tauri::command]
async fn ask_dialog(app: AppHandle, message: String) -> bool {
    app.dialog()
        .message(message)
        .title("Offline Preset Editor for Dante")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancel)
        .blocking_show()
}

#[tauri::command]
fn set_title(window: WebviewWindow, title: String) -> Result<(), String> {
    window.set_title(&title).map_err(|e| e.to_string())
}

/// The page calls this once it is listening. Returns any files the app was launched with.
#[tauri::command]
fn frontend_ready(state: tauri::State<AppState>) -> Vec<String> {
    state.ready.store(true, Ordering::SeqCst);
    std::mem::take(&mut *state.pending.lock().unwrap())
}

/// Called by the page after the user has agreed to close.
#[tauri::command]
fn close_app(app: AppHandle) {
    app.exit(0);
}

// ---------- helpers ----------

/// Send files to the page, or keep them until it is ready.
fn deliver_paths(app: &AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    let state = app.state::<AppState>();
    if state.ready.load(Ordering::SeqCst) {
        let _ = app.emit("open-paths", paths);
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.set_focus();
        }
    } else {
        state.pending.lock().unwrap().extend(paths);
    }
}

/// Ask the page whether it's OK to close (it checks for unsaved changes).
/// If the page isn't running for some reason, just close.
fn request_close(app: &AppHandle) -> bool {
    if app.state::<AppState>().ready.load(Ordering::SeqCst) {
        let _ = app.emit("close-requested", ());
        true // handled by the page
    } else {
        false
    }
}

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let item = |id: &str, text: &str, accel: Option<&str>| MenuItem::with_id(app, id, text, true, accel);

    let file = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &item("new", "New Preset…", Some("CmdOrCtrl+N"))?,
            &item("open", "Open…", Some("CmdOrCtrl+O"))?,
            &PredefinedMenuItem::separator(app)?,
            &item("save", "Save", Some("CmdOrCtrl+S"))?,
            &item("save_as", "Save As…", Some("CmdOrCtrl+Shift+S"))?,
            &item("revert", "Revert to Saved", None)?,
            &PredefinedMenuItem::separator(app)?,
            &item("copy_xml", "Copy Preset XML", None)?,
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::separator(app)?,
            #[cfg(not(target_os = "macos"))]
            &item("quit", "Exit", None)?,
        ],
    )?;

    // Without an Edit menu, copy / paste / select all don't work in text boxes on macOS.
    let edit = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    let view = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &item("overview", "Routing Overview", Some("CmdOrCtrl+1"))?,
            &item("add_devices", "Add Devices…", Some("CmdOrCtrl+Shift+N"))?,
        ],
    )?;

    let window = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            #[cfg(target_os = "macos")]
            &PredefinedMenuItem::fullscreen(app, None)?,
        ],
    )?;

    let about = AboutMetadataBuilder::new()
        .name(Some("Offline Preset Editor for Dante"))
        .version(Some(env!("CARGO_PKG_VERSION")))
        .comments(Some("Offline editor for Dante Controller presets.\nNot affiliated with Audinate."))
        .build();

    #[cfg(target_os = "macos")]
    {
        let app_menu = Submenu::with_items(
            app,
            "Offline Preset Editor for Dante",
            true,
            &[
                &PredefinedMenuItem::about(app, Some("About Offline Preset Editor for Dante"), Some(about))?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::services(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::hide(app, None)?,
                &PredefinedMenuItem::hide_others(app, None)?,
                &PredefinedMenuItem::show_all(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                // our own Quit, so unsaved changes are checked first
                &item("quit", "Quit Offline Preset Editor for Dante", Some("CmdOrCtrl+Q"))?,
            ],
        )?;
        Menu::with_items(app, &[&app_menu, &file, &edit, &view, &window])
    }
    #[cfg(not(target_os = "macos"))]
    {
        let help = Submenu::with_items(
            app,
            "Help",
            true,
            &[&PredefinedMenuItem::about(app, Some("About Offline Preset Editor for Dante"), Some(about))?],
        )?;
        Menu::with_items(app, &[&file, &edit, &view, &window, &help])
    }
}

/// Files passed on the command line (Windows "Open with", or dropping a file onto the .exe).
fn startup_args() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|a| !a.starts_with('-') && std::path::Path::new(a).is_file())
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .menu(build_menu)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if id == "quit" {
                if !request_close(app) {
                    app.exit(0);
                }
            } else {
                let _ = app.emit("menu", id);
            }
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                if request_close(window.app_handle()) {
                    api.prevent_close();
                }
            }
            WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) => {
                let paths: Vec<String> = paths.iter().map(|p| p.to_string_lossy().into_owned()).collect();
                deliver_paths(window.app_handle(), paths);
            }
            _ => {}
        })
        .setup(|app| {
            let args = startup_args();
            app.state::<AppState>().pending.lock().unwrap().extend(args);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_dialog,
            save_dialog,
            read_file,
            write_file,
            ask_dialog,
            set_title,
            frontend_ready,
            close_app
        ])
        .build(tauri::generate_context!())
        .expect("error while building Offline Preset Editor for Dante");

    app.run(|app, event| match event {
        // Finder "Open With" / double-click on macOS
        #[cfg(target_os = "macos")]
        RunEvent::Opened { urls } => {
            let paths = urls
                .into_iter()
                .filter_map(|u| u.to_file_path().ok())
                .map(|p| p.to_string_lossy().into_owned())
                .collect();
            deliver_paths(app, paths);
        }
        // Dock "Quit" on macOS: check for unsaved changes first
        RunEvent::ExitRequested { api, code, .. } => {
            if code.is_none() && request_close(app) {
                api.prevent_exit();
            }
        }
        _ => {}
    });
}
