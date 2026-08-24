"""Install and diagnose the native OpenCode PowerContext plugin."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path
from shutil import which
from urllib.parse import unquote, urlparse
from uuid import uuid4

from powercontext.cli.git_source import InvalidGitHubSourceError, clone_github_source
from powercontext.cli.git_source import is_local_source as _is_local_source
from powercontext.cli.system import Diagnostic, DiagnosticStatus, SetupError
from powercontext.paths import powercontext_data_dir

OPENCODE_PLUGIN_NAME = "powercontext-opencode"
OPENCODE_PLUGIN_RELATIVE = Path("integrations") / "opencode" / "plugins" / "powercontext"
OPENCODE_BUNDLE = Path("lib") / "index.js"
OPENCODE_SKILL = Path("skills") / "project-context" / "SKILL.md"
SKILL_MANIFEST = ".powercontext.json"
MINIMUM_VERSION = (1, 18, 21)
_VERSION = re.compile(r"^(?P<major>\d+)\.(?P<minor>\d+)\.(?P<patch>\d+)")


@dataclass(frozen=True, slots=True)
class OpenCodeSetupResult:
    plugin: str
    plugin_path: str
    skill_path: str
    data_dir: str


def opencode_executable() -> str:
    """Return a subprocess-launchable OpenCode CLI path."""

    executable = which("opencode")
    if executable is None:
        raise SetupError.opencode_unavailable()
    return executable


def _version() -> str:
    value = _run_opencode("--version").strip()
    match = _VERSION.match(value)
    if match is None:
        raise SetupError.invalid_command_output([opencode_executable(), "--version"], "an invalid version")
    current = tuple(int(match.group(name)) for name in ("major", "minor", "patch"))
    if current[0] != 1 or current < MINIMUM_VERSION:
        raise SetupError.unsupported_opencode_version(value)
    return value


def install_opencode_plugin(*, source: str, ref: str) -> OpenCodeSetupResult:
    """Install the plugin and its owned global Skill from one checkout."""

    opencode_executable()
    _version()
    data_dir = powercontext_data_dir()
    try:
        data_dir.mkdir(parents=True, exist_ok=True)
    except OSError as error:
        raise SetupError.data_directory(data_dir, error) from error
    plugin_dir = resolve_opencode_plugin_dir(source=source, ref=ref)
    require_complete_plugin(plugin_dir)
    config_dir = opencode_config_dir()
    skill_target = config_dir / "skills" / "project-context"
    require_replaceable_skill(skill_target)
    _run_opencode("plugin", str(plugin_dir), "--global", "--force")
    _install_skill(plugin_dir / OPENCODE_SKILL.parent, skill_target)
    return OpenCodeSetupResult(
        plugin=OPENCODE_PLUGIN_NAME,
        plugin_path=str(plugin_dir),
        skill_path=str(skill_target),
        data_dir=str(data_dir),
    )


def resolve_opencode_plugin_dir(*, source: str, ref: str) -> Path:
    """Return the OpenCode package directory for a local checkout or Git ref."""

    if _is_local_source(source):
        return plugin_dir_from_checkout(Path(source).expanduser().resolve())
    return plugin_dir_from_checkout(_materialize_remote_checkout(source, ref))


def plugin_dir_from_checkout(root: Path) -> Path:
    if _is_opencode_plugin(root):
        return root
    plugin = root / OPENCODE_PLUGIN_RELATIVE
    if _is_opencode_plugin(plugin):
        return plugin
    raise SetupError.missing_opencode_plugin(root)


def require_complete_plugin(path: Path) -> None:
    if not (path / OPENCODE_BUNDLE).is_file() or not (path / OPENCODE_SKILL).is_file():
        raise SetupError.incomplete_opencode_plugin(path)


def checkout_target(ref: str) -> Path:
    root = (powercontext_data_dir() / "checkouts" / "opencode").resolve()
    if not ref or ref in {".", ".."} or "\x00" in ref:
        raise SetupError.invalid_opencode_ref(ref)
    target = (root / ref).resolve()
    try:
        target.relative_to(root)
    except ValueError as error:
        raise SetupError.invalid_opencode_ref(ref) from error
    if target == root:
        raise SetupError.invalid_opencode_ref(ref)
    return target


def opencode_config_dir() -> Path:
    output = _run_opencode("debug", "paths")
    for line in output.splitlines():
        key, separator, value = line.strip().partition(" ")
        if key == "config" and separator and value.strip():
            return Path(value.strip()).expanduser().resolve()
    raise SetupError.invalid_command_output([opencode_executable(), "debug", "paths"], "no config path")


def require_replaceable_skill(target: Path) -> None:
    if target.exists() and not _owned_skill(target):
        raise SetupError.opencode_skill_conflict(target)


def _install_skill(source: Path, target: Path) -> None:
    require_replaceable_skill(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    staging = target.parent / f".{target.name}.{uuid4().hex}.tmp"
    backup: Path | None = None
    try:
        shutil.copytree(source, staging)
        (staging / SKILL_MANIFEST).write_text(
            json.dumps({"schema": 1, "owner": "powercontext", "integration": "opencode"}, indent=2) + "\n",
            encoding="utf-8",
        )
        if target.exists():
            backup = target.parent / f".{target.name}.{uuid4().hex}.bak"
            os.replace(target, backup)
        try:
            os.replace(staging, target)
        except OSError:
            if backup is not None:
                os.replace(backup, target)
                backup = None
            raise
        if backup is not None:
            with suppress(OSError):
                shutil.rmtree(backup)
    except OSError as error:
        if staging.exists():
            shutil.rmtree(staging)
        if backup is not None and backup.exists() and not target.exists():
            with suppress(OSError):
                os.replace(backup, target)
        raise SetupError.command_unavailable(["install", "OpenCode", "Skill"], error) from error


def _owned_skill(path: Path) -> bool:
    try:
        payload = json.loads((path / SKILL_MANIFEST).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    return payload == {"schema": 1, "owner": "powercontext", "integration": "opencode"}


def _is_opencode_plugin(path: Path) -> bool:
    try:
        payload = json.loads((path / "package.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    return payload.get("name") == OPENCODE_PLUGIN_NAME


def _materialize_remote_checkout(source: str, ref: str) -> Path:
    target = checkout_target(ref)
    if _is_opencode_plugin(target) or _is_opencode_plugin(target / OPENCODE_PLUGIN_RELATIVE):
        return target
    if target.exists():
        shutil.rmtree(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        clone_github_source(source, ref, target)
    except InvalidGitHubSourceError:
        raise SetupError.invalid_opencode_source() from None
    return target


def _configured_plugin(output: str) -> bool:
    try:
        payload = json.loads(output)
    except ValueError:
        return False
    plugins = payload.get("plugin") if isinstance(payload, dict) else None
    if not isinstance(plugins, list):
        return False
    for entry in plugins:
        spec = entry[0] if isinstance(entry, list) and entry else entry
        if not isinstance(spec, str):
            continue
        parsed = urlparse(spec)
        raw = unquote(parsed.path) if parsed.scheme == "file" else spec
        path = Path(raw)
        if _is_opencode_plugin(path) or _is_opencode_plugin(path.parent):
            return True
    return False


def run_opencode_diagnostics() -> dict[str, Diagnostic]:
    """Collect model-free diagnostics for the optional OpenCode integration."""

    try:
        executable = opencode_executable()
        actual = _version()
    except SetupError as error:
        return {
            "opencode": Diagnostic(status=DiagnosticStatus.FAILED, detail=str(error)),
            "plugin": Diagnostic(status=DiagnosticStatus.SKIPPED, detail="not checked because OpenCode is unavailable"),
            "skill": Diagnostic(status=DiagnosticStatus.SKIPPED, detail="not checked because OpenCode is unavailable"),
        }
    try:
        config_dir = opencode_config_dir()
        configured = _configured_plugin(_run_opencode("debug", "config"))
    except SetupError as error:
        return {
            "opencode": Diagnostic(status=DiagnosticStatus.OK, detail=f"{executable} ({actual})"),
            "plugin": Diagnostic(status=DiagnosticStatus.FAILED, detail=str(error)),
            "skill": Diagnostic(status=DiagnosticStatus.SKIPPED, detail="not checked because config is unavailable"),
        }
    skill = config_dir / "skills" / "project-context"
    skill_ok = _owned_skill(skill) and (skill / "SKILL.md").is_file()
    return {
        "opencode": Diagnostic(status=DiagnosticStatus.OK, detail=f"{executable} ({actual})"),
        "plugin": Diagnostic(
            status=DiagnosticStatus.OK if configured else DiagnosticStatus.FAILED,
            detail=(
                f"{OPENCODE_PLUGIN_NAME} is configured"
                if configured
                else "PowerContext OpenCode plugin is not configured"
            ),
        ),
        "skill": Diagnostic(
            status=DiagnosticStatus.OK if skill_ok else DiagnosticStatus.FAILED,
            detail=(str(skill) if skill_ok else "PowerContext OpenCode Skill is not installed"),
        ),
    }


def _run_opencode(*arguments: str) -> str:
    command = [opencode_executable(), *arguments]
    try:
        completed = subprocess.run(  # noqa: S603 - arguments are passed directly to the fixed OpenCode executable.
            command,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )
    except (OSError, subprocess.SubprocessError) as error:
        raise SetupError.command_unavailable(command, error) from error
    if completed.returncode != 0:
        detail = (
            (completed.stderr or "").strip() or (completed.stdout or "").strip() or f"exit code {completed.returncode}"
        )
        raise SetupError.command_failed(command, detail)
    return completed.stdout or ""


__all__ = [
    "OPENCODE_PLUGIN_NAME",
    "OpenCodeSetupResult",
    "checkout_target",
    "install_opencode_plugin",
    "opencode_config_dir",
    "opencode_executable",
    "plugin_dir_from_checkout",
    "require_complete_plugin",
    "resolve_opencode_plugin_dir",
    "run_opencode_diagnostics",
]
