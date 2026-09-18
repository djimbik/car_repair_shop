"""One-command local launcher. Only Python 3.11+ and Node.js 22+ are required."""

from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / ".local"
WINDOWS = os.name == "nt"


def run(command: list[str], cwd: Path):
    subprocess.run(command, cwd=cwd, check=True)


def free_port(port: int):
    with socket.socket() as sock:
        try:
            sock.bind(("127.0.0.1", port))
        except OSError as error:
            raise RuntimeError(f"Port {port} is busy. Stop the existing server and try again.") from error


def install_if_changed(source: Path, stamp: Path, exists: Path, command: list[str], cwd: Path):
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if not exists.exists() or not stamp.exists() or stamp.read_text() != digest:
        run(command, cwd)
        stamp.write_text(digest)


def stop(process: subprocess.Popen):
    if process.poll() is not None:
        return
    if WINDOWS:
        subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        os.killpg(process.pid, signal.SIGTERM)
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        if WINDOWS:
            process.kill()
        else:
            os.killpg(process.pid, signal.SIGKILL)


def ready(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            return response.status == 200
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    if sys.version_info < (3, 11):
        raise RuntimeError("Install Python 3.11 or newer.")
    npm = shutil.which("npm.cmd" if WINDOWS else "npm")
    node = shutil.which("node")
    if not npm or not node:
        raise RuntimeError("Install Node.js 22+ (including npm) and reopen the terminal.")
    major = int(subprocess.check_output([node, "--version"], text=True).strip().lstrip("v").split(".")[0])
    if major < 22:
        raise RuntimeError("Node.js 22 or newer is required.")
    free_port(3000)
    free_port(8000)
    LOCAL.mkdir(exist_ok=True)
    backend = ROOT / "backend"
    frontend = ROOT / "frontend"
    venv = backend / ".venv"
    python = venv / ("Scripts/python.exe" if WINDOWS else "bin/python")
    if not python.exists():
        run([sys.executable, "-m", "venv", str(venv)], backend)
    print("Preparing backend dependencies...", flush=True)
    # uv-created virtual environments may omit pip; ensurepip also works for those.
    result = subprocess.run([str(python), "-m", "pip", "--version"], capture_output=True)
    if result.returncode:
        run([str(python), "-m", "ensurepip"], backend)
    uvicorn = venv / ("Scripts/uvicorn.exe" if WINDOWS else "bin/uvicorn")
    install_if_changed(backend / "requirements.txt", LOCAL / "python.sha256", uvicorn,
                       [str(python), "-m", "pip", "install", "-r", "requirements.txt"], backend)
    print("Preparing frontend dependencies...", flush=True)
    next_cli = frontend / "node_modules/.bin" / ("next.cmd" if WINDOWS else "next")
    install_if_changed(frontend / "package-lock.json", LOCAL / "npm.sha256", next_cli,
                       [npm, "ci"], frontend)
    processes: list[subprocess.Popen] = []
    logs = []
    try:
        commands = [
            ("backend", backend, [str(python), "-m", "uvicorn", "app.main:app", "--reload",
                                  "--host", "127.0.0.1", "--port", "8000"]),
            ("frontend", frontend, [npm, "run", "dev"]),
        ]
        for name, cwd, command in commands:
            log = (LOCAL / f"{name}.log").open("w", encoding="utf-8")
            logs.append(log)
            options = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW} if WINDOWS else {"start_new_session": True}
            processes.append(subprocess.Popen(command, cwd=cwd, stdout=log, stderr=subprocess.STDOUT,
                                              env=dict(os.environ, NEXT_TELEMETRY_DISABLED="1"), **options))
        print("Starting ServiceFlow. First compilation may take a minute...", flush=True)
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            if any(process.poll() is not None for process in processes):
                raise RuntimeError(f"A server stopped. See logs in {LOCAL}")
            if ready("http://127.0.0.1:8000/api/health") and ready("http://127.0.0.1:3000"):
                break
            time.sleep(1)
        else:
            raise RuntimeError(f"Startup timed out. See logs in {LOCAL}")
        print("\nServiceFlow: http://localhost:3000\nAPI docs:    http://localhost:8000/docs\n"
              "Press Ctrl+C to stop both servers. Your data will be preserved.\n", flush=True)
        if not args.no_browser:
            webbrowser.open("http://localhost:3000")
        while all(process.poll() is None for process in processes):
            time.sleep(1)
        raise RuntimeError(f"A server stopped. See logs in {LOCAL}")
    finally:
        for process in reversed(processes):
            stop(process)
        for log in logs:
            log.close()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nServers stopped. Data preserved.")
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(f"\nError: {error}", file=sys.stderr)
        sys.exit(1)
