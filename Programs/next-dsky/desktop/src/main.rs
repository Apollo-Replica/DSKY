// Next DSKY desktop app for Windows.
//
// A native window (WebView2, the Edge engine built into Windows) around the
// DSKY server. The server is the same Node code as on the Orange Pi, bundled
// as server/server.cjs and run by the node runtime shipped next to this exe,
// hidden (no console). Its output goes to a log file and to the Logs window
// (View > Logs, Ctrl+L), which only opens on demand.

#![windows_subsystem = "windows"]

use std::collections::VecDeque;
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Read, Write};
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

use muda::{accelerator::Accelerator, Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
use tao::dpi::{LogicalSize, PhysicalPosition, PhysicalSize};
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoopBuilder, EventLoopProxy};
use tao::platform::windows::{EventLoopBuilderExtWindows, IconExtWindows, WindowExtWindows};
use tao::window::{Fullscreen, Icon, Window, WindowBuilder};
use windows_sys::Win32::Foundation::{GetLastError, ERROR_ALREADY_EXISTS};
use windows_sys::Win32::System::SystemInformation::GetLocalTime;
use windows_sys::Win32::System::Threading::CreateMutexW;
use windows_sys::Win32::UI::Shell::ShellExecuteW;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    FindWindowW, MessageBoxW, SetForegroundWindow, ShowWindow, TranslateAcceleratorW, MB_ICONERROR,
    MB_ICONINFORMATION, MB_OK, MSG, SW_RESTORE, SW_SHOWNORMAL, WM_KEYDOWN, WM_SYSKEYDOWN,
};
use wry::{NewWindowResponse, WebContext, WebView, WebViewBuilder};

const APP_NAME: &str = "Next DSKY";
const LOGS_TITLE: &str = "Next DSKY – Logs";
const VERSION: &str = match option_env!("DSKY_VERSION") {
    Some(v) => v,
    None => "dev",
};
const REPO_URL: &str = "https://github.com/Apollo-Replica/DSKY";
const DISCORD_URL: &str = "https://discord.gg/CHZaYj5UNu";
const WEBVIEW2_URL: &str = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";
const SERVER_EXE: &str = "next-dsky-server.exe";
const PREFERRED_PORT: &str = "3000";
const MAX_LOG_LINES: usize = 5000;
const MAX_LOG_BYTES: u64 = 5 * 1024 * 1024;
const LOGS_HTML: &str = include_str!("../logs.html");
const LOADING_HTML: &str = r#"<!doctype html><html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#4ade80;font:14px Consolas,monospace">Starting…</body></html>"#;

enum UserEvent {
    ServerReady(String),
    ServerExited(String),
    Log(String),
    Menu(MenuEvent),
    LogsIpc(String),
    Escape,
}

// ------------------------------------------------------------------ helpers

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

fn message_box(text: &str, error: bool) {
    let flags = MB_OK | if error { MB_ICONERROR } else { MB_ICONINFORMATION };
    unsafe { MessageBoxW(std::ptr::null_mut(), wide(text).as_ptr(), wide(APP_NAME).as_ptr(), flags) };
}

/// Opens a URL in the default browser, or a folder in Explorer.
fn shell_open(target: &str) {
    unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            wide("open").as_ptr(),
            wide(target).as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            SW_SHOWNORMAL,
        )
    };
}

fn timestamp() -> String {
    let t = unsafe {
        let mut t = std::mem::zeroed();
        GetLocalTime(&mut t);
        t
    };
    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}.{:03}",
        t.wYear, t.wMonth, t.wDay, t.wHour, t.wMinute, t.wSecond, t.wMilliseconds
    )
}

fn env_dir(var: &str) -> PathBuf {
    std::env::var_os(var).map(PathBuf::from).unwrap_or_else(std::env::temp_dir)
}

// ------------------------------------------------------------------ log

struct Log {
    lines: Mutex<VecDeque<String>>,
    file: Mutex<Option<File>>,
    path: PathBuf,
}

impl Log {
    fn open(dir: &Path) -> Log {
        let path = dir.join("next-dsky.log");
        let _ = fs::create_dir_all(dir);
        if fs::metadata(&path).map(|m| m.len() > MAX_LOG_BYTES).unwrap_or(false) {
            let _ = fs::rename(&path, dir.join("next-dsky.log.old"));
        }
        let file = OpenOptions::new().create(true).append(true).open(&path).ok();
        Log { lines: Mutex::new(VecDeque::new()), file: Mutex::new(file), path }
    }

    /// Stores a line and returns it with its timestamp.
    fn add(&self, level: &str, text: &str) -> String {
        let tag = if level.is_empty() { String::new() } else { format!("{level} ") };
        let line = format!("{} {tag}{text}", timestamp());
        if let Some(f) = self.file.lock().unwrap().as_mut() {
            let _ = writeln!(f, "{line}");
        }
        let mut lines = self.lines.lock().unwrap();
        lines.push_back(line.clone());
        while lines.len() > MAX_LOG_LINES {
            lines.pop_front();
        }
        line
    }

    fn all(&self) -> Vec<String> {
        self.lines.lock().unwrap().iter().cloned().collect()
    }
}

// ------------------------------------------------------------------ server

struct Paths {
    server_dir: PathBuf,
    data_dir: PathBuf,
    webview_dir: PathBuf,
}

fn paths() -> Paths {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(Path::to_path_buf))
        .unwrap_or_default();
    // NEXT_DSKY_SERVER_DIR lets a dev build use a staged server folder.
    let server_dir = std::env::var_os("NEXT_DSKY_SERVER_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| exe_dir.join("server"));
    Paths {
        server_dir,
        // Settings and logs (roaming, kept across updates and uninstalls).
        data_dir: env_dir("APPDATA").join(APP_NAME),
        // WebView2's own cache: local, not roaming.
        webview_dir: env_dir("LOCALAPPDATA").join(APP_NAME).join("WebView2"),
    }
}

/// Reads a child pipe line by line (bytes, so odd encodings can't stop it).
fn pump<R: Read + Send + 'static>(pipe: R, stderr: bool, proxy: EventLoopProxy<UserEvent>) {
    thread::spawn(move || {
        let mut reader = BufReader::new(pipe);
        let mut buf = Vec::new();
        loop {
            buf.clear();
            match reader.read_until(b'\n', &mut buf) {
                Ok(0) | Err(_) => break,
                Ok(_) => {
                    let line = String::from_utf8_lossy(&buf).trim_end().to_string();
                    if line.is_empty() {
                        continue;
                    }
                    if let Some(url) = line.strip_prefix("> Ready on ") {
                        let _ = proxy.send_event(UserEvent::ServerReady(url.trim().to_string()));
                    }
                    let level = if !stderr {
                        ""
                    } else if line.to_lowercase().contains("error") {
                        "ERROR"
                    } else {
                        "WARN"
                    };
                    let _ = proxy.send_event(UserEvent::Log(format!("{level}\u{1}{line}")));
                }
            }
        }
    });
}

/// Puts the server in a job object that kills it when the app's handle closes,
/// so it dies with the app even if the app crashes or is killed.
fn kill_with_app(child: &Child) {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation, SetInformationJobObject,
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };
    unsafe {
        // The handle is left open on purpose: it closes when this process ends.
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if job.is_null() {
            return;
        }
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const _,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );
        AssignProcessToJobObject(job, child.as_raw_handle() as _);
    }
}

fn start_server(p: &Paths, proxy: &EventLoopProxy<UserEvent>) -> Result<Child, String> {
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let node = p.server_dir.join(SERVER_EXE);
    let script = p.server_dir.join("server.cjs");
    let mut child = Command::new(&node)
        .arg(&script)
        .arg("--data-dir")
        .arg(&p.data_dir)
        .args(["--port", PREFERRED_PORT, "--any-port"])
        .current_dir(&p.server_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("Could not start {}: {e}", node.display()))?;
    kill_with_app(&child);
    pump(child.stdout.take().unwrap(), false, proxy.clone());
    pump(child.stderr.take().unwrap(), true, proxy.clone());
    Ok(child)
}

/// Menu shortcuts (Ctrl+L, F11, ...) while the page has the keyboard focus:
/// WebView2 handles keys in its own process, so each key press is passed
/// through the menu's accelerator table here. Esc is reported for full screen.
fn forward_menu_shortcuts(webview: &WebView, hwnd: isize, menu: Menu, proxy: EventLoopProxy<UserEvent>) {
    use webview2_com::AcceleratorKeyPressedEventHandler;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_KEY_EVENT_KIND, COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN, COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN,
    };
    use wry::WebViewExtWindows;
    const VK_ESCAPE: u32 = 0x1B;

    let handler = AcceleratorKeyPressedEventHandler::create(Box::new(move |_, args| {
        let Some(args) = args else { return Ok(()) };
        let mut kind = COREWEBVIEW2_KEY_EVENT_KIND::default();
        unsafe { args.KeyEventKind(&mut kind)? };
        let message = if kind == COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN {
            WM_KEYDOWN
        } else if kind == COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN {
            WM_SYSKEYDOWN
        } else {
            return Ok(());
        };
        let (mut vk, mut lparam) = (0u32, 0i32);
        unsafe {
            args.VirtualKey(&mut vk)?;
            args.KeyEventLParam(&mut lparam)?;
        }
        if vk == VK_ESCAPE {
            let _ = proxy.send_event(UserEvent::Escape);
            return Ok(());
        }
        let msg = MSG {
            hwnd: hwnd as _,
            message,
            wParam: vk as usize,
            lParam: lparam as isize,
            time: 0,
            pt: windows_sys::Win32::Foundation::POINT { x: 0, y: 0 },
        };
        if unsafe { TranslateAcceleratorW(hwnd as _, menu.haccel() as _, &msg) } != 0 {
            unsafe { args.SetHandled(true)? };
        }
        Ok(())
    }));
    let mut token = 0i64;
    unsafe {
        let _ = webview.controller().add_AcceleratorKeyPressed(&handler, &mut token);
    }
}

// ------------------------------------------------------------------ window state

fn load_bounds(file: &Path) -> Option<(i32, i32, u32, u32, bool)> {
    let v: serde_json::Value = serde_json::from_str(&fs::read_to_string(file).ok()?).ok()?;
    Some((
        v["x"].as_i64()? as i32,
        v["y"].as_i64()? as i32,
        v["width"].as_u64()? as u32,
        v["height"].as_u64()? as u32,
        v["maximized"].as_bool().unwrap_or(false),
    ))
}

fn save_bounds(file: &Path, window: &Window) {
    if window.is_minimized() || window.fullscreen().is_some() {
        return;
    }
    let (Ok(pos), size) = (window.outer_position(), window.inner_size()) else { return };
    let v = serde_json::json!({
        "x": pos.x, "y": pos.y, "width": size.width, "height": size.height,
        "maximized": window.is_maximized(),
    });
    let _ = fs::write(file, v.to_string());
}

// ------------------------------------------------------------------ main

struct MenuIds {
    open_browser: MenuItem,
    open_settings: MenuItem,
    exit: MenuItem,
    logs: MenuItem,
    reload: MenuItem,
    fullscreen: MenuItem,
    zoom_in: MenuItem,
    zoom_out: MenuItem,
    zoom_reset: MenuItem,
    devtools: MenuItem,
    github: MenuItem,
    discord: MenuItem,
    about: MenuItem,
}

fn item(text: &str, accel: Option<&str>) -> MenuItem {
    MenuItem::new(text, true, accel.and_then(|a| a.parse::<Accelerator>().ok()))
}

fn build_menu() -> (Menu, MenuIds) {
    let ids = MenuIds {
        open_browser: item("Open in &Browser", None),
        open_settings: item("Open &Settings Folder", None),
        exit: item("E&xit", Some("Alt+F4")),
        logs: item("&Logs", Some("CmdOrCtrl+L")),
        reload: item("&Reload", Some("F5")),
        fullscreen: item("&Full Screen", Some("F11")),
        zoom_in: item("Zoom &In", Some("CmdOrCtrl+=")),
        zoom_out: item("Zoom &Out", Some("CmdOrCtrl+-")),
        zoom_reset: item("&Actual Size", Some("CmdOrCtrl+0")),
        devtools: item("&Developer Tools", Some("CmdOrCtrl+Shift+I")),
        github: item("Project on &GitHub", None),
        discord: item("&Discord", None),
        about: item(&format!("&About {APP_NAME}"), None),
    };
    let sep = PredefinedMenuItem::separator;
    let file = Submenu::with_items("&File", true, &[&ids.open_browser, &ids.open_settings, &sep(), &ids.exit]).unwrap();
    let view = Submenu::with_items(
        "&View",
        true,
        &[
            &ids.logs, &sep(), &ids.reload, &ids.fullscreen, &sep(),
            &ids.zoom_reset, &ids.zoom_in, &ids.zoom_out, &sep(), &ids.devtools,
        ],
    )
    .unwrap();
    let help = Submenu::with_items("&Help", true, &[&ids.github, &ids.discord, &sep(), &ids.about]).unwrap();
    (Menu::with_items(&[&file, &view, &help]).unwrap(), ids)
}

/// Only one copy runs; a second launch brings the first one to the front.
fn single_instance() -> bool {
    unsafe {
        CreateMutexW(std::ptr::null(), 1, wide("Local\\NextDSKY-7C1B0F5E").as_ptr());
        if GetLastError() == ERROR_ALREADY_EXISTS {
            let hwnd = FindWindowW(std::ptr::null(), wide(APP_NAME).as_ptr());
            if !hwnd.is_null() {
                ShowWindow(hwnd, SW_RESTORE);
                SetForegroundWindow(hwnd);
            }
            return false;
        }
    }
    true
}

fn main() {
    if !single_instance() {
        return;
    }
    let p = paths();
    let _ = fs::create_dir_all(&p.data_dir);
    let log = Arc::new(Log::open(&p.data_dir.join("logs")));
    log.add("", &format!("{APP_NAME} {VERSION} starting"));

    let (menu, ids) = build_menu();
    let mut builder = EventLoopBuilder::<UserEvent>::with_user_event();
    {
        // Menu keyboard shortcuts (Ctrl+L, F11, ...). muda rebuilds its
        // accelerator table when the menu changes, so read it on every use.
        let menu = menu.clone();
        builder.with_msg_hook(move |msg| unsafe {
            let msg = msg as *const MSG;
            TranslateAcceleratorW((*msg).hwnd, menu.haccel() as _, msg) == 1
        });
    }
    let event_loop = builder.build();
    let proxy = event_loop.create_proxy();
    {
        let proxy = proxy.clone();
        MenuEvent::set_event_handler(Some(move |e| {
            let _ = proxy.send_event(UserEvent::Menu(e));
        }));
    }

    // Main window, at its last size and position.
    let bounds_file = p.data_dir.join("window.json");
    let mut wb = WindowBuilder::new()
        .with_title(APP_NAME)
        // Wider than 15:9, or the page hides its side toggles (FULL/SCR,
        // SOUND/MUTE, AMOLED/LCD): see .view-toggle in src/styles/clients.css.
        .with_inner_size(LogicalSize::new(1280.0, 720.0))
        .with_min_inner_size(LogicalSize::new(320.0, 360.0))
        .with_window_icon(Icon::from_resource(1, None).ok());
    let mut start_maximized = false;
    if let Some((x, y, w, h, max)) = load_bounds(&bounds_file) {
        let on_screen = event_loop.available_monitors().any(|m| {
            let (mp, ms) = (m.position(), m.size());
            x + 50 >= mp.x && y + 20 >= mp.y && x + 50 < mp.x + ms.width as i32 && y + 20 < mp.y + ms.height as i32
        });
        if on_screen && w >= 320 && h >= 360 {
            wb = wb.with_position(PhysicalPosition::new(x, y)).with_inner_size(PhysicalSize::new(w, h));
        }
        start_maximized = max;
    }
    let window = wb.with_maximized(start_maximized).build(&event_loop).expect("window");
    unsafe {
        let _ = menu.init_for_hwnd(window.hwnd());
    }

    // The DSKY's own pages stay in the window; any other link opens in the browser.
    let server_url = Arc::new(Mutex::new(String::new()));
    let is_own = {
        let server_url = server_url.clone();
        move |url: &str| {
            let base = server_url.lock().unwrap();
            !base.is_empty() && (url == *base || url.starts_with(&format!("{base}/")))
        }
    };
    let mut web_context = WebContext::new(Some(p.webview_dir.clone()));
    let nav_own = is_own.clone();
    let webview = match WebViewBuilder::new_with_web_context(&mut web_context)
        .with_html(LOADING_HTML)
        .with_background_color((0, 0, 0, 255))
        // The DSKY makes its sounds straight away; the page has its own mute button.
        .with_autoplay(true)
        .with_devtools(true)
        .with_navigation_handler(move |url| {
            if !url.starts_with("http") || nav_own(&url) {
                return true;
            }
            shell_open(&url);
            false
        })
        .with_new_window_req_handler(|url, _features| {
            if url.starts_with("http") {
                shell_open(&url);
            }
            NewWindowResponse::Deny
        })
        .build(&window)
    {
        Ok(w) => w,
        Err(e) => {
            log.add("ERROR", &format!("WebView2 could not start: {e}"));
            message_box(
                &format!(
                    "{APP_NAME} needs the Microsoft Edge WebView2 Runtime, which comes with Windows 10 and 11.\n\n\
                     It will open its download page now; install it and start {APP_NAME} again.\n\n({e})"
                ),
                true,
            );
            shell_open(WEBVIEW2_URL);
            return;
        }
    };

    forward_menu_shortcuts(&webview, window.hwnd(), menu.clone(), proxy.clone());

    let mut server = match start_server(&p, &proxy) {
        Ok(s) => s,
        Err(e) => {
            log.add("ERROR", &e);
            message_box(&format!("{e}\n\nLog: {}", log.path.display()), true);
            return;
        }
    };
    {
        // Watch for the server stopping on its own.
        let proxy = proxy.clone();
        let pid = server.id();
        thread::spawn(move || {
            use windows_sys::Win32::Foundation::{CloseHandle, WAIT_OBJECT_0};
            use windows_sys::Win32::System::Threading::{
                GetExitCodeProcess, OpenProcess, WaitForSingleObject, INFINITE, PROCESS_QUERY_LIMITED_INFORMATION,
                PROCESS_SYNCHRONIZE,
            };
            unsafe {
                let h = OpenProcess(PROCESS_SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
                if h.is_null() {
                    return;
                }
                if WaitForSingleObject(h, INFINITE) == WAIT_OBJECT_0 {
                    let mut code = 0u32;
                    GetExitCodeProcess(h, &mut code);
                    let _ = proxy.send_event(UserEvent::ServerExited(format!("exit code {code}")));
                }
                CloseHandle(h);
            }
        });
    }

    let main_id = window.id();
    let mut logs: Option<(Window, WebView)> = None;
    let mut zoom = 1.0f64;
    let mut ready = false;
    let mut quitting = false;

    event_loop.run(move |event, target, control_flow| {
        *control_flow = ControlFlow::Wait;
        let _ = &web_context;
        let logs_id = logs.as_ref().map(|(w, _)| w.id());

        let exit = |control_flow: &mut ControlFlow, quitting: &mut bool, server: &mut Child| {
            if !*quitting {
                *quitting = true;
                save_bounds(&bounds_file, &window);
                let _ = server.kill();
            }
            *control_flow = ControlFlow::Exit;
        };

        match event {
            Event::UserEvent(UserEvent::ServerReady(url)) => {
                if !ready {
                    ready = true;
                    *server_url.lock().unwrap() = url.clone();
                    let _ = webview.load_url(&url);
                }
            }
            Event::UserEvent(UserEvent::ServerExited(why)) => {
                if !quitting {
                    log.add("ERROR", &format!("The DSKY server stopped ({why})"));
                    message_box(
                        &format!(
                            "The DSKY server stopped ({why}).\n\nSee View > Logs or the log file:\n{}",
                            log.path.display()
                        ),
                        true,
                    );
                    exit(control_flow, &mut quitting, &mut server);
                }
            }
            Event::UserEvent(UserEvent::Log(raw)) => {
                let (level, text) = raw.split_once('\u{1}').unwrap_or(("", &raw));
                let line = log.add(level, text);
                if let Some((_, wv)) = &logs {
                    let _ = wv.evaluate_script(&format!("window.addLines({})", serde_json::json!([line])));
                }
            }
            Event::UserEvent(UserEvent::LogsIpc(msg)) => match msg.as_str() {
                "ready" => {
                    if let Some((_, wv)) = &logs {
                        let _ = wv.evaluate_script(&format!("window.setLines({})", serde_json::json!(log.all())));
                    }
                }
                "open-folder" => shell_open(&p.data_dir.join("logs").display().to_string()),
                _ => {}
            },
            Event::UserEvent(UserEvent::Menu(e)) => {
                let id = &e.id;
                if id == ids.exit.id() {
                    exit(control_flow, &mut quitting, &mut server);
                } else if id == ids.open_browser.id() {
                    let url = server_url.lock().unwrap().clone();
                    if !url.is_empty() {
                        shell_open(&url);
                    }
                } else if id == ids.open_settings.id() {
                    shell_open(&p.data_dir.display().to_string());
                } else if id == ids.logs.id() {
                    if let Some((w, _)) = &logs {
                        w.set_minimized(false);
                        w.set_focus();
                    } else {
                        let w = WindowBuilder::new()
                            .with_title(LOGS_TITLE)
                            .with_inner_size(LogicalSize::new(1000.0, 600.0))
                            .with_window_icon(Icon::from_resource(1, None).ok())
                            .build(target)
                            .expect("logs window");
                        let proxy = proxy.clone();
                        let wv = WebViewBuilder::new()
                            .with_html(LOGS_HTML)
                            .with_background_color((17, 17, 17, 255))
                            .with_ipc_handler(move |req| {
                                let _ = proxy.send_event(UserEvent::LogsIpc(req.body().clone()));
                            })
                            .build(&w);
                        match wv {
                            Ok(wv) => logs = Some((w, wv)),
                            Err(e) => {
                                log.add("ERROR", &format!("Logs window: {e}"));
                            }
                        }
                    }
                } else if id == ids.reload.id() {
                    let _ = webview.reload();
                } else if id == ids.fullscreen.id() {
                    if window.fullscreen().is_some() {
                        window.set_fullscreen(None);
                        unsafe { let _ = menu.show_for_hwnd(window.hwnd()); }
                    } else {
                        unsafe { let _ = menu.hide_for_hwnd(window.hwnd()); }
                        window.set_fullscreen(Some(Fullscreen::Borderless(None)));
                    }
                } else if id == ids.zoom_in.id() || id == ids.zoom_out.id() || id == ids.zoom_reset.id() {
                    zoom = if id == ids.zoom_reset.id() {
                        1.0
                    } else if id == ids.zoom_in.id() {
                        (zoom + 0.1).min(3.0)
                    } else {
                        (zoom - 0.1).max(0.3)
                    };
                    let _ = webview.zoom(zoom);
                } else if id == ids.devtools.id() {
                    webview.open_devtools();
                } else if id == ids.github.id() {
                    shell_open(REPO_URL);
                } else if id == ids.discord.id() {
                    shell_open(DISCORD_URL);
                } else if id == ids.about.id() {
                    message_box(
                        &format!(
                            "{APP_NAME} {VERSION}\n\nDSKY server: {}\nSettings: {}\n\n{REPO_URL}",
                            server_url.lock().unwrap(),
                            p.data_dir.display()
                        ),
                        false,
                    );
                }
            }
            Event::WindowEvent { window_id, event: WindowEvent::CloseRequested, .. } => {
                if window_id == main_id {
                    exit(control_flow, &mut quitting, &mut server);
                } else if Some(window_id) == logs_id {
                    logs = None;
                }
            }
            Event::UserEvent(UserEvent::Escape) => {
                // Esc leaves full screen (the menu with F11 is hidden there).
                if window.fullscreen().is_some() {
                    window.set_fullscreen(None);
                    unsafe { let _ = menu.show_for_hwnd(window.hwnd()); }
                }
            }
            _ => {}
        }
    });
}
