# Copyright (c) 2026 OceanBase.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Strict, shell-free loading for PowerContext environment files."""

from __future__ import annotations

import os
import re
import shlex
from collections.abc import Iterator, Mapping, MutableMapping
from contextlib import contextmanager
from pathlib import Path

_ENVIRONMENT_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_SENTINEL = "\x00"


class EnvironmentFileError(ValueError):
    """Report an environment document that cannot be loaded safely."""


def parse_environment(content: str, *, source: str = "environment") -> dict[str, str]:
    """Parse simple shell-compatible assignments without evaluating shell code.

    A ``#`` only starts a comment at an unquoted word boundary, so values such as
    ``TOKEN=abc#123`` keep their full content:

        >>> parse_environment("TOKEN=abc#123\\nURL=https://example.com/#frag # comment\\n")
        {'TOKEN': 'abc#123', 'URL': 'https://example.com/#frag'}
    """

    environment: dict[str, str] = {}
    for line_number, line in enumerate(content.splitlines(), start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("export "):
            stripped = stripped.removeprefix("export ").lstrip()
        try:
            processed = _replace_escaped_spaces(stripped)
            tokens = shlex.split(_strip_comment(processed), posix=True)
        except ValueError as error:
            raise EnvironmentFileError(  # noqa: TRY003
                f"invalid assignment at {source}:{line_number}: {error}"
            ) from error
        if not tokens:
            continue
        if len(tokens) != 1 or "=" not in tokens[0]:
            raise EnvironmentFileError(f"invalid assignment at {source}:{line_number}")  # noqa: TRY003
        name, value = tokens[0].split("=", maxsplit=1)
        value = value.replace(_SENTINEL, " ")
        if _ENVIRONMENT_NAME.fullmatch(name) is None:
            raise EnvironmentFileError(  # noqa: TRY003
                f"invalid environment name at {source}:{line_number}: {name!r}"
            )
        if name in environment:
            raise EnvironmentFileError(  # noqa: TRY003
                f"duplicate environment name at {source}:{line_number}: {name}"
            )
        environment[name] = value
    return environment


def _strip_comment(line: str) -> str:
    """Remove a trailing comment while preserving ``#`` inside values and quotes.

    A ``#`` only starts a comment at an unquoted word boundary. A preceding
    backslash escapes the immediately following character, so
    ``TOKEN=abc\\ #123`` keeps its full value.
    """

    quote = ""
    escaped = False
    for index, character in enumerate(line):
        if escaped:
            escaped = False
        elif quote:
            if character == "\\" and quote == '"':
                escaped = True
            elif character == quote:
                quote = ""
        elif character in {"'", '"'}:
            quote = character
        elif character == "#" and (index == 0 or line[index - 1] in {" ", "\t"}):
            return line[:index]
    return line


def _replace_escaped_spaces(line: str) -> str:
    """Replace ``\\ `` (backslash-space) with a sentinel that survives ``shlex.split``."""

    result: list[str] = []
    quote = ""
    escaped = False
    chars = list(line)
    index = 0
    while index < len(chars):
        character = chars[index]
        if escaped:
            escaped = False
            result.append(character)
        elif quote:
            if character == "\\" and quote == '"':
                escaped = True
                result.append(character)
            elif character == quote:
                quote = ""
                result.append(character)
            else:
                result.append(character)
        elif character == "\\":
            next_index = index + 1
            if next_index < len(chars) and chars[next_index] == " ":
                result.append(_SENTINEL)
                index += 2
                continue
            result.append(character)
        elif character in {"'", '"'}:
            quote = character
            result.append(character)
        else:
            result.append(character)
        index += 1
    return "".join(result)


def read_environment_file(path: Path) -> dict[str, str]:
    """Read and parse one UTF-8 environment file."""

    return parse_environment(path.read_text(encoding="utf-8"), source=str(path))


def apply_environment_file(
    path: Path,
    *,
    target: MutableMapping[str, str] | None = None,
    override: bool = False,
) -> Mapping[str, str]:
    """Load assignments into a process-like mapping, preserving existing values by default."""

    destination = os.environ if target is None else target
    loaded = read_environment_file(path)
    for name, value in loaded.items():
        if override or name not in destination:
            destination[name] = value
    return loaded


@contextmanager
def environment_file_context(path: Path, *, override: bool = False) -> Iterator[Mapping[str, str]]:
    """Apply a file for one process scope, then restore every affected value."""

    loaded = read_environment_file(path)
    with environment_context(loaded, override=override):
        yield loaded


@contextmanager
def environment_context(values: Mapping[str, str], *, override: bool = False) -> Iterator[None]:
    """Apply parsed values for one process scope, then restore every affected value."""

    loaded = dict(values)
    affected = {name for name in loaded if override or name not in os.environ}
    original = {name: os.environ.get(name) for name in affected}
    try:
        for name in affected:
            os.environ[name] = loaded[name]
        yield
    finally:
        for name, value in original.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value


__all__ = [
    "EnvironmentFileError",
    "apply_environment_file",
    "environment_context",
    "environment_file_context",
    "parse_environment",
    "read_environment_file",
]
