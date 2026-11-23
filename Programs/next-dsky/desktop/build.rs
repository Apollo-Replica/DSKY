// Embeds the icon, the manifest and the file details (version, name) shown by
// Explorer, Task Manager and the firewall prompt.

use std::{env, fs, path::Path, path::PathBuf};

fn main() {
    println!("cargo:rerun-if-changed=app.rc.in");
    println!("cargo:rerun-if-changed=app.manifest");
    println!("cargo:rerun-if-changed=../windows/dsky.ico");
    println!("cargo:rerun-if-env-changed=DSKY_VERSION");

    let version = env::var("DSKY_VERSION").unwrap_or_else(|_| "0.0.0".into());
    // VERSIONINFO wants four numbers: 0.4.1-3-gabc -> 0,4,1,0
    let mut nums: Vec<u16> = version
        .split(|c: char| !c.is_ascii_digit())
        .take(3)
        .map(|n| n.parse().unwrap_or(0))
        .collect();
    nums.resize(4, 0);
    let commas = nums.iter().map(|n| n.to_string()).collect::<Vec<_>>().join(",");

    // Paths inside .rc strings: forward slashes work for both rc.exe and windres.
    let rc_path = |p: &Path| p.display().to_string().replace('\\', "/");
    let here = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let icon = here.join("..").join("windows").join("dsky.ico");
    let manifest = here.join("app.manifest");

    let rc = fs::read_to_string(here.join("app.rc.in"))
        .unwrap()
        .replace("@ICON@", &rc_path(&icon))
        .replace("@MANIFEST@", &rc_path(&manifest))
        .replace("@VERSION_COMMAS@", &commas)
        .replace("@VERSION@", &version);
    let out = PathBuf::from(env::var("OUT_DIR").unwrap()).join("app.rc");
    fs::write(&out, rc).unwrap();
    embed_resource::compile(&out, embed_resource::NONE).manifest_required().unwrap();
}
