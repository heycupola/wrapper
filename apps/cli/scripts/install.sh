#!/usr/bin/env bash
set -euo pipefail

REPO="${WRAPPER_RELEASE_REPO:-heycupola/wrapper}"
VERSION="${WRAPPER_VERSION:-latest}"
INSTALL_DIR="${WRAPPER_INSTALL_DIR:-$HOME/.wrapper/bin}"

detect_platform() {
  local os arch
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"
  case "$os" in
    darwin)
      if [ "$arch" = "arm64" ]; then
        echo "darwin-arm64"
      else
        echo "darwin-x86_64"
      fi
      ;;
    linux)
      echo "linux-x86_64"
      ;;
    *)
      echo "unsupported"
      ;;
  esac
}

platform="$(detect_platform)"
if [ "$platform" = "unsupported" ]; then
  echo "Unsupported platform: $(uname -s) $(uname -m)"
  exit 1
fi

if [ "$VERSION" = "latest" ]; then
  VERSION="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | python3 -c 'import json,sys; print(json.load(sys.stdin)["tag_name"])')"
fi

archive="wrapper-${platform}.tar.gz"
url="https://github.com/${REPO}/releases/download/${VERSION}/${archive}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

echo "Downloading ${url}"
curl -fsSL "$url" -o "${tmp_dir}/${archive}"
mkdir -p "$INSTALL_DIR"
tar -xzf "${tmp_dir}/${archive}" -C "$INSTALL_DIR"
chmod +x "${INSTALL_DIR}/bin/wrapper" || true

echo "Installed Wrapper into ${INSTALL_DIR}"
echo "Add to PATH:"
echo "  export PATH=\"${INSTALL_DIR}/bin:\$PATH\""
