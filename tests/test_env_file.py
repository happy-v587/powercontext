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

import pytest

from powercontext.cli.env_file import EnvironmentFileError, parse_environment


def test_hash_inside_a_value_is_preserved() -> None:
    assert parse_environment("TOKEN=abc#123\n") == {"TOKEN": "abc#123"}


def test_comment_after_an_assignment_is_removed() -> None:
    assert parse_environment("TOKEN=abc # trailing comment\n") == {"TOKEN": "abc"}


def test_quoted_values_keep_hashes_and_spaces() -> None:
    content = 'TOKEN="#not a comment"\nOTHER=plain#tag\n'
    assert parse_environment(content) == {"TOKEN": "#not a comment", "OTHER": "plain#tag"}


def test_url_fragment_assignment_survives() -> None:
    assert parse_environment("URL=https://example.com/page#section\n") == {"URL": "https://example.com/page#section"}


def test_export_prefix_keeps_hash_values() -> None:
    assert parse_environment("export BEARER=token#a1\n") == {"BEARER": "token#a1"}


def test_full_line_comments_are_ignored() -> None:
    content = "# leading comment\n\nTOKEN=value # explanation\n"
    assert parse_environment(content) == {"TOKEN": "value"}


def test_value_may_start_with_hash_like_shell() -> None:
    assert parse_environment("TOKEN=#literal\n") == {"TOKEN": "#literal"}


def test_unterminated_quote_is_rejected() -> None:
    with pytest.raises(EnvironmentFileError, match="invalid assignment"):
        parse_environment('TOKEN="unterminated\n')
