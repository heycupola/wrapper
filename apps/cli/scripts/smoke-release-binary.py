#!/usr/bin/env python3
"""Confirm a native release binary can start its bundled PTY helper."""

from __future__ import annotations

import argparse
import os
import signal
import subprocess
import tempfile
import time
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("binary", type=Path)
    args = parser.parse_args()
    binary = args.binary.resolve()

    with tempfile.TemporaryDirectory(prefix="wrapper-release-smoke-") as home:
        env = {
            **os.environ,
            "HOME": home,
            "NODE_ENV": "production",
            "SHELL": "/bin/sh",
            "WRAPPER_LOG": "off",
        }
        process = subprocess.Popen(
            [str(binary), "shell-host", "--shell", "/bin/sh"],
            env=env,
            start_new_session=True,
            stderr=subprocess.PIPE,
            stdout=subprocess.PIPE,
        )
        try:
            time.sleep(1)
            exit_code = process.poll()
            if exit_code is not None:
                stdout, stderr = process.communicate()
                raise SystemExit(
                    f"release binary exited before PTY smoke completed ({exit_code})\n"
                    f"stdout:\n{stdout.decode(errors='replace')}\n"
                    f"stderr:\n{stderr.decode(errors='replace')}"
                )

            os.killpg(process.pid, signal.SIGTERM)
            process.communicate(timeout=10)
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=5)

    print(f"verified native PTY startup: {binary}")


if __name__ == "__main__":
    main()
