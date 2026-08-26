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

from __future__ import annotations

from pathlib import Path

import pytest
from typer.testing import CliRunner

import powercontext.cli.config as config_cli


def test_init_asks_for_protocol_endpoint_key_and_plain_model_name(tmp_path: Path) -> None:
    environment = tmp_path / ".env"

    result = CliRunner().invoke(
        config_cli.app,
        ["init", "--output", str(environment)],
        input="\n\n\n\nshared-secret\n\n\n\n\n\n",
    )

    assert result.exit_code == 0
    assert "PowerContext configuration" in result.output
    assert "Generation API protocol" in result.output
    assert "Generation API Base URL" in result.output
    assert "Generation API key" in result.output
    assert "Generation model" in result.output
    assert "Generation model identifier" not in result.output
    assert "environment variable name" not in result.output
    assert "Alibaba Cloud" not in result.output
    assert "OpenRouter" not in result.output
    assert "Configuration" in result.output
    assert "Supported Coding Agents (choose one)" in result.output
    for name, setup, launch in config_cli.AGENTS.values():
        assert name in result.output
        assert setup in result.output
        assert launch in result.output
    values = config_cli.parse_environment(environment.read_text(encoding="utf-8"))
    assert values["OPENAI_API_KEY"] == "shared-secret"
    assert values["OPENAI_BASE_URL"] == "https://api.openai.com/v1"
    assert values["POWERCONTEXT_SERVER_INFERENCE_GENERATION_MODEL"] == "openai-chat:gpt-4.1-mini"


def test_arbitrary_model_providers_and_environment_variables_are_not_rejected() -> None:
    configuration = _configuration(
        generation=config_cli.ModelSelection(
            model="bedrock:anthropic.claude-sonnet",
            environment=(
                config_cli.ProviderVariable("AWS_PROFILE", "development"),
                config_cli.ProviderVariable("AWS_REGION", "us-west-2"),
            ),
        ),
        embedding=config_cli.ModelSelection(
            model="voyage:voyage-3",
            environment=(config_cli.ProviderVariable("VOYAGE_API_KEY", "voyage-secret"),),
        ),
    )

    config_cli.validate_configuration(configuration)
    values = config_cli.render_environment(configuration)

    assert values["POWERCONTEXT_SERVER_INFERENCE_GENERATION_MODEL"] == "bedrock:anthropic.claude-sonnet"
    assert values["AWS_PROFILE"] == "development"
    assert values["AWS_REGION"] == "us-west-2"
    assert values["VOYAGE_API_KEY"] == "voyage-secret"


def test_init_validate_and_show_round_trip_managed_environment(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    environment = tmp_path / ".env"
    initial = _configuration()
    monkeypatch.setattr(config_cli, "collect_configuration", lambda **_kwargs: initial)
    runner = CliRunner()
    generated = runner.invoke(
        config_cli.app,
        ["init", "--output", str(environment)],
        input="\n",
    )

    assert generated.exit_code == 0
    assert environment.stat().st_mode & 0o777 == 0o600
    generated_text = environment.read_text(encoding="utf-8")
    assert config_cli.MANAGED_BEGIN in generated_text
    assert "# generation-environment=OPENAI_API_KEY" in generated_text

    validated = runner.invoke(config_cli.app, ["validate", "--env-file", str(environment)])
    shown = runner.invoke(config_cli.app, ["show", "--env-file", str(environment)])
    assert validated.exit_code == 0
    assert "Configuration is valid" in validated.output
    assert shown.exit_code == 0
    assert "OPENAI_API_KEY=<redacted>" in shown.output
    assert "initial-secret" not in shown.output


def test_init_refuses_to_replace_an_existing_environment_without_force(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    environment = tmp_path / ".env"
    environment.write_text("EXISTING=value\n", encoding="utf-8")
    monkeypatch.setattr(config_cli, "collect_configuration", lambda **_kwargs: _configuration())

    result = CliRunner().invoke(config_cli.app, ["init", "--output", str(environment)])

    assert result.exit_code == 2
    assert "already exists" in result.output
    assert environment.read_text(encoding="utf-8") == "EXISTING=value\n"


def test_environment_parser_rejects_duplicate_assignments() -> None:
    with pytest.raises(config_cli.EnvironmentFileError, match="duplicate environment name"):
        config_cli.parse_environment("VALUE=one\nVALUE=two\n")


def test_validate_reports_invalid_numeric_values_without_a_traceback(tmp_path: Path) -> None:
    environment = tmp_path / ".env"
    content = config_cli.update_environment_document("", _configuration()).replace(
        "POWERCONTEXT_SERVER_RUNTIME_SCHEDULE_SECONDS=60",
        "POWERCONTEXT_SERVER_RUNTIME_SCHEDULE_SECONDS=invalid",
    )
    environment.write_text(content, encoding="utf-8")

    result = CliRunner().invoke(config_cli.app, ["validate", "--env-file", str(environment)])

    assert result.exit_code == 2
    assert "POWERCONTEXT_SERVER_RUNTIME_SCHEDULE_SECONDS must be an integer" in result.output
    assert "Traceback" not in result.output


def _configuration(
    *,
    generation: config_cli.ModelSelection | None = None,
    embedding: config_cli.ModelSelection | None = None,
) -> config_cli.GeneratedConfiguration:
    shared = (config_cli.ProviderVariable("OPENAI_API_KEY", "initial-secret"),)
    return config_cli.GeneratedConfiguration(
        config_version=1,
        scope_id="project:quickstart",
        display_name="Quick Start",
        generation=generation or config_cli.ModelSelection("openai:gpt-4.1-mini", shared),
        embedding=embedding or config_cli.ModelSelection("openai:text-embedding-3-small", shared),
        embedding_profile_id="openai-text-embedding-3-small-1536-unit-v1",
        embedding_dimension=1536,
        database_kind="sqlite",
        database_url=None,
        database_path=None,
        schedule_seconds=60,
    )
