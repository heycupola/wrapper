#!/usr/bin/env python3
"""Validate the exact, safe layout of a Wrapper CLI release archive."""

from __future__ import annotations

import argparse
import sys
import tarfile
from pathlib import PurePosixPath


def normalize(name: str) -> str:
    while name.startswith("./"):
        name = name[2:]
    name = name.rstrip("/")
    if name == ".":
        return ""

    path = PurePosixPath(name)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise ValueError(f"unsafe archive path: {name!r}")
    return path.as_posix()


def verify(archive: str, helper: str) -> None:
    expected_files = {"bin/wrapper", f"bin/{helper}"}
    expected_directories = {"", "bin"}
    files: set[str] = set()
    directories: set[str] = set()

    try:
        with tarfile.open(archive, mode="r:gz") as bundle:
            for member in bundle.getmembers():
                name = normalize(member.name)
                if member.isdir():
                    if name not in expected_directories or name in directories:
                        raise ValueError(f"unexpected directory entry: {member.name!r}")
                    directories.add(name)
                    continue

                if not member.isfile():
                    raise ValueError(f"non-regular archive entry: {member.name!r}")
                if name not in expected_files or name in files:
                    raise ValueError(f"unexpected file entry: {member.name!r}")
                if member.mode & 0o111 == 0:
                    raise ValueError(f"release file is not executable: {member.name!r}")
                files.add(name)
    except (OSError, tarfile.TarError, ValueError) as error:
        raise SystemExit(f"{archive}: {error}") from error

    if files != expected_files:
        missing = ", ".join(sorted(expected_files - files))
        raise SystemExit(f"{archive}: missing release file(s): {missing}")
    if "bin" not in directories:
        raise SystemExit(f"{archive}: missing bin directory entry")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("archive")
    parser.add_argument("helper")
    args = parser.parse_args()
    verify(args.archive, args.helper)
    print(f"verified {args.archive}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
