#!/usr/bin/env bash
set -euo pipefail

REPO="${WRAPPER_RELEASE_REPO:-heycupola/wrapper}"
VERSION="${WRAPPER_VERSION:-latest}"
INSTALL_DIR="${WRAPPER_INSTALL_DIR:-$HOME/.wrapper}"
BIN_DIR="${INSTALL_DIR}/bin"

for required in curl tar grep sed uname; do
  if ! command -v "$required" >/dev/null 2>&1; then
    echo "Required command not found: $required" >&2
    exit 1
  fi
done

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
      if [ "$arch" = "x86_64" ] || [ "$arch" = "amd64" ]; then
        echo "linux-x86_64"
      else
        echo "unsupported"
      fi
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
  VERSION="$(
    curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
      | grep '"tag_name"' \
      | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' \
      | head -1
  )"
fi
if [ -z "$VERSION" ]; then
  echo "Could not determine the latest Wrapper version" >&2
  exit 1
fi

archive="wrapper-${platform}.tar.gz"
base="https://github.com/${REPO}/releases/download/${VERSION}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d' ' -f1
  else
    echo "Neither sha256sum nor shasum is available for integrity verification" >&2
    exit 1
  fi
}

echo "Downloading ${base}/${archive}"
curl -fsSL "${base}/${archive}" -o "${tmp_dir}/${archive}"

echo "Verifying checksum"
curl -fsSL "${base}/checksums.txt" -o "${tmp_dir}/checksums.txt"
expected="$(grep " ${archive}\$" "${tmp_dir}/checksums.txt" | cut -d' ' -f1)"
if [ -z "$expected" ]; then
  echo "No checksum found for ${archive} in checksums.txt; aborting" >&2
  exit 1
fi
actual="$(sha256_of "${tmp_dir}/${archive}")"
if [ "$expected" != "$actual" ]; then
  echo "Checksum mismatch for ${archive}" >&2
  echo "  expected: ${expected}" >&2
  echo "  actual:   ${actual}" >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"
tar -xzf "${tmp_dir}/${archive}" -C "$INSTALL_DIR"
chmod +x "${BIN_DIR}/wrapper" || true

echo "Installed Wrapper into ${INSTALL_DIR}"
if [[ ":$PATH:" != *":${BIN_DIR}:"* ]]; then
  shell_name="$(basename "${SHELL:-}")"
  case "$shell_name" in
    zsh) profile="$HOME/.zshrc" ;;
    bash)
      if [ -f "$HOME/.bash_profile" ]; then
        profile="$HOME/.bash_profile"
      else
        profile="$HOME/.bashrc"
      fi
      ;;
    fish)
      profile="$HOME/.config/fish/config.fish"
      mkdir -p "$(dirname "$profile")"
      path_line="fish_add_path ${BIN_DIR}"
      ;;
    *) profile="$HOME/.profile" ;;
  esac
  path_line="${path_line:-export PATH=\"${BIN_DIR}:\$PATH\"}"
  if ! grep -Fqx "$path_line" "$profile" 2>/dev/null; then
    printf "\n%s\n" "$path_line" >> "$profile"
  fi
  echo "Added ${BIN_DIR} to PATH in ${profile}"
  echo "Restart your shell or run: source ${profile}"
fi

echo "Run 'wrapper auth login' to get started."
