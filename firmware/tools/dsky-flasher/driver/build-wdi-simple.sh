#!/bin/sh
# Rebuilds wdi-simple.exe: libwdi (Zadig's engine) as a command line tool
# that installs WinUSB for the USBasp, without Zadig's window.
#
# The patch makes it Windows 8+ only: WinUSB ships with the OS there, so the
# WDK coinstallers libwdi normally embeds are left out of the INF and catalog.
#
# Needs git and llvm-mingw (https://github.com/mstorsjo/llvm-mingw) on PATH.
set -e
here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
git clone -q --depth 1 --branch v1.5.1 https://github.com/pbatard/libwdi.git "$work"
cd "$work"
git apply "$here/libwdi-v1.5.1-dsky.patch"
CC=x86_64-w64-mingw32-clang
(cd libwdi &&
  $CC -O2 -I.. -D_WIN64 -static installer.c -o installer_x64.exe -lsetupapi -lnewdev -lole32 &&
  $CC -O2 -I.. embedder.c -o embedder.exe &&
  ./embedder.exe embedded.h)
$CC -O2 -Wno-everything -I. -Ilibwdi -Iexamples/getopt -static \
  libwdi/logging.c libwdi/tokenizer.c libwdi/vid_data.c libwdi/pki.c libwdi/libwdi_dlg.c libwdi/libwdi.c \
  examples/wdi-simple.c examples/getopt/getopt.c examples/getopt/getopt1.c \
  -o "$here/wdi-simple.exe" -lsetupapi -lole32 -lntdll -lnewdev -lcomctl32 -lshlwapi -luuid
rm -rf "$work"
echo "built $here/wdi-simple.exe"
