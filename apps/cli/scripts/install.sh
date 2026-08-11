#!/usr/bin/env bash
set -euo pipefail

error() {
  printf 'wrapper installer: %s\n' "$*" >&2
}

die() {
  error "$*"
  exit 1
}

REPO="${WRAPPER_RELEASE_REPO:-heycupola/wrapper}"
VERSION="${WRAPPER_VERSION:-latest}"

if [ -z "${HOME:-}" ]; then
  die "HOME is not set; set HOME before running the installer"
fi
if [[ ! "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  die "WRAPPER_RELEASE_REPO must use the owner/repository format (got: ${REPO})"
fi

INSTALL_DIR="${WRAPPER_INSTALL_DIR:-${HOME}/.wrapper}"
BIN_DIR="${INSTALL_DIR}/bin"

missing_commands=()
for required in curl tar grep sed uname mktemp mkdir chmod cp mv rm; do
  if ! command -v "$required" >/dev/null 2>&1; then
    missing_commands+=("$required")
  fi
done
if [ "${#missing_commands[@]}" -gt 0 ]; then
  die "missing required command(s): ${missing_commands[*]}"
fi

if command -v sha256sum >/dev/null 2>&1; then
  checksum_tool="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
  checksum_tool="shasum"
else
  die "missing checksum tool: install sha256sum or shasum"
fi

os="$(uname -s)"
arch="$(uname -m)"
case "${os}/${arch}" in
Darwin/arm64 | Darwin/aarch64)
  platform="darwin-arm64"
  helper="wrapper-pty-helper-aarch64-macos-none"
  ;;
Darwin/x86_64 | Darwin/amd64)
  platform="darwin-x86_64"
  helper="wrapper-pty-helper-x86_64-macos-none"
  ;;
Linux/arm64 | Linux/aarch64)
  platform="linux-arm64"
  helper="wrapper-pty-helper-aarch64-linux-musl"
  ;;
Linux/x86_64 | Linux/amd64)
  platform="linux-x86_64"
  helper="wrapper-pty-helper-x86_64-linux-musl"
  ;;
*)
  die "unsupported platform: ${os} ${arch}; supported targets are macOS/Linux on arm64 or x86_64"
  ;;
esac

if [ "$VERSION" = "latest" ]; then
  latest_url="https://api.github.com/repos/${REPO}/releases/latest"
  if ! latest_release="$(curl --fail --silent --show-error --location --retry 2 "$latest_url")"; then
    die "could not query ${latest_url}; the repository may not have a published release yet"
  fi
  VERSION="$(
    printf '%s\n' "$latest_release" |
      sed -n '/"tag_name"/ { s/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p; q; }'
  )"
  if [ -z "$VERSION" ]; then
    die "GitHub's latest-release response did not contain a tag_name"
  fi
elif [[ "$VERSION" != v* ]]; then
  VERSION="v${VERSION}"
fi

if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]]; then
  die "invalid Wrapper version '${VERSION}'; expected a tag such as v0.1.0"
fi

archive="wrapper-${platform}.tar.gz"
base="https://github.com/${REPO}/releases/download/${VERSION}"
if ! tmp_dir="$(mktemp -d 2>/dev/null)"; then
  die "could not create a temporary directory"
fi
wrapper_tmp=""
helper_tmp=""
cleanup() {
  rm -rf "$tmp_dir"
  [ -z "$wrapper_tmp" ] || rm -f "$wrapper_tmp"
  [ -z "$helper_tmp" ] || rm -f "$helper_tmp"
}
trap cleanup EXIT

sha256_of() {
  local output
  if [ "$checksum_tool" = "sha256sum" ]; then
    output="$(sha256sum "$1")" || die "sha256sum failed for $1"
  else
    output="$(shasum -a 256 "$1")" || die "shasum failed for $1"
  fi
  printf '%s\n' "${output%% *}"
}

download() {
  local url="$1"
  local destination="$2"
  if ! curl --fail --silent --show-error --location --retry 2 "$url" -o "$destination"; then
    die "failed to download ${url}"
  fi
}

echo "Downloading ${base}/${archive}"
download "${base}/${archive}" "${tmp_dir}/${archive}"

echo "Verifying checksum"
download "${base}/checksums.txt" "${tmp_dir}/checksums.txt"
expected=""
while read -r checksum filename _; do
  filename="${filename#\*}"
  if [ "$filename" = "$archive" ]; then
    if [ -n "$expected" ]; then
      die "checksums.txt contains more than one checksum for ${archive}"
    fi
    expected="$checksum"
  fi
done <"${tmp_dir}/checksums.txt"
if [ -z "$expected" ]; then
  die "checksums.txt does not contain ${archive}"
fi
if [[ ! "$expected" =~ ^[0-9a-fA-F]{64}$ ]]; then
  die "checksums.txt contains an invalid SHA-256 for ${archive}"
fi
actual="$(sha256_of "${tmp_dir}/${archive}")"
if [ "$expected" != "$actual" ]; then
  error "checksum mismatch for ${archive}"
  error "expected: ${expected}"
  error "actual:   ${actual}"
  exit 1
fi

if ! tar -tvzf "${tmp_dir}/${archive}" >"${tmp_dir}/archive-list.txt"; then
  die "could not read ${archive}"
fi
seen_wrapper=0
seen_helper=0
while IFS= read -r listing; do
  entry_type="${listing:0:1}"
  entry="${listing##* }"
  case "${entry_type}:${entry}" in
  "d:." | "d:./" | "d:bin" | "d:bin/" | "d:./bin" | "d:./bin/")
    ;;
  "-:bin/wrapper" | "-:./bin/wrapper")
    seen_wrapper=$((seen_wrapper + 1))
    ;;
  "-:bin/${helper}" | "-:./bin/${helper}")
    seen_helper=$((seen_helper + 1))
    ;;
  *)
    die "${archive} contains an unexpected or unsafe entry: ${entry}"
    ;;
  esac
done <"${tmp_dir}/archive-list.txt"
if [ "$seen_wrapper" -ne 1 ] || [ "$seen_helper" -ne 1 ]; then
  die "${archive} must contain exactly bin/wrapper and bin/${helper}"
fi

mkdir -p "${tmp_dir}/extracted"
if ! tar -xzf "${tmp_dir}/${archive}" -C "${tmp_dir}/extracted"; then
  die "could not extract ${archive}"
fi
if [ ! -f "${tmp_dir}/extracted/bin/wrapper" ] ||
  [ -L "${tmp_dir}/extracted/bin/wrapper" ] ||
  [ ! -f "${tmp_dir}/extracted/bin/${helper}" ] ||
  [ -L "${tmp_dir}/extracted/bin/${helper}" ]; then
  die "${archive} did not extract the expected regular files"
fi

mkdir -p "$BIN_DIR"
wrapper_tmp="${BIN_DIR}/.wrapper.new.$$"
helper_tmp="${BIN_DIR}/.${helper}.new.$$"
cp "${tmp_dir}/extracted/bin/wrapper" "$wrapper_tmp"
cp "${tmp_dir}/extracted/bin/${helper}" "$helper_tmp"
chmod 755 "$wrapper_tmp" "$helper_tmp"
mv -f "$wrapper_tmp" "${BIN_DIR}/wrapper"
wrapper_tmp=""
mv -f "$helper_tmp" "${BIN_DIR}/${helper}"
helper_tmp=""

echo "Installed Wrapper into ${INSTALL_DIR}"
if [[ ":$PATH:" != *":${BIN_DIR}:"* ]]; then
  shell_name="${SHELL##*/}"
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
    mkdir -p "${profile%/*}"
    path_line="fish_add_path ${BIN_DIR}"
    ;;
  *) profile="$HOME/.profile" ;;
  esac
  path_line="${path_line:-export PATH=\"${BIN_DIR}:\$PATH\"}"
  if ! grep -Fqx "$path_line" "$profile" 2>/dev/null; then
    printf "\n%s\n" "$path_line" >>"$profile"
  fi
  echo "Added ${BIN_DIR} to PATH in ${profile}"
  echo "Restart your shell or run: source ${profile}"
fi

echo "Run 'wrapper auth login' to get started."
