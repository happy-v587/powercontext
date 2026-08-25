/*
 * Copyright (c) 2026 OceanBase.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

//#region src/errors.ts
const REQUEST_ID_HEADER = "X-PowerContext-Request-ID";
const MAX_RESPONSE_BYTES = 1048576;
const PLUGIN_NAME = "powercontext-opencode";
const PLUGIN_VERSION = "0.0.1";
const PLUGIN_USER_AGENT = `${PLUGIN_NAME}/${PLUGIN_VERSION}`;
var ClientError = class extends Error {
	requestId;
	constructor(message, requestId) {
		super(message);
		this.name = new.target.name;
		this.requestId = requestId;
	}
};
var UnavailableError = class extends ClientError {
	path;
	constructor(path, cause) {
		super(`request to ${path} failed`);
		this.path = path;
		this.cause = cause;
	}
};
var InvalidResponseError = class extends ClientError {
	constructor(path, requestId) {
		super(`response from ${path} violated the API schema`, requestId);
		this.path = path;
	}
};
var UnknownOperationError = class extends ClientError {
	constructor(operationId) {
		super(`unknown PowerContext operation: ${operationId}`);
		this.operationId = operationId;
	}
};
var ServerResponseError = class extends ClientError {
	statusCode;
	code;
	serverMessage;
	constructor(options) {
		super(`PowerContext returned HTTP ${options.statusCode}${options.code ? ` (${options.code})` : ""}`, options.requestId);
		this.statusCode = options.statusCode;
		this.code = options.code;
		this.serverMessage = options.message;
	}
};

//#endregion
//#region src/operations.generated.ts
const OPERATIONS = {
	get_liveness: {
		method: "GET",
		path: "/health/live",
		location: null,
		scope: false
	},
	get_readiness: {
		method: "GET",
		path: "/health/ready",
		location: null,
		scope: false
	},
	get_capabilities: {
		method: "GET",
		path: "/v1/capabilities",
		location: null,
		scope: false
	},
	capture_content_source: {
		method: "POST",
		path: "/v1/sources/content",
		location: "body",
		scope: true
	},
	prepare_context: {
		method: "POST",
		path: "/v1/context/prepare",
		location: "body",
		scope: true
	},
	create_work_contract: {
		method: "POST",
		path: "/v1/work/contracts/create",
		location: "body",
		scope: true
	},
	handoff_current_work: {
		method: "POST",
		path: "/v1/work/handoffs/prepare-current",
		location: "body",
		scope: true
	},
	acknowledge_handoff: {
		method: "POST",
		path: "/v1/work/handoffs/acknowledge",
		location: "body",
		scope: true
	},
	record_task_outcome: {
		method: "POST",
		path: "/v1/work/outcomes/record",
		location: "body",
		scope: true
	},
	activate_handoff: {
		method: "POST",
		path: "/v1/handoff/activate",
		location: "body",
		scope: true
	},
	prepare_handoff: {
		method: "POST",
		path: "/v1/handoff/prepare",
		location: "body",
		scope: true
	},
	finalize_handoff: {
		method: "POST",
		path: "/v1/handoff/finalize",
		location: "body",
		scope: true
	},
	commit_handoff: {
		method: "POST",
		path: "/v1/handoff/commit",
		location: "body",
		scope: true
	},
	continue_handoff: {
		method: "POST",
		path: "/v1/handoff/continue",
		location: "body",
		scope: true
	},
	flush_memory: {
		method: "POST",
		path: "/v1/memory/flush",
		location: "body",
		scope: true
	},
	remember_memory: {
		method: "POST",
		path: "/v1/memory/remember",
		location: "body",
		scope: true
	},
	search_memory: {
		method: "POST",
		path: "/v1/memory/search",
		location: "body",
		scope: true
	},
	list_memory_entries: {
		method: "POST",
		path: "/v1/memory/entries/list",
		location: "body",
		scope: true
	},
	get_memory_entry: {
		method: "POST",
		path: "/v1/memory/entries/get",
		location: "body",
		scope: true
	},
	revise_memory_entry: {
		method: "POST",
		path: "/v1/memory/entries/revise",
		location: "body",
		scope: true
	},
	retire_memory_entry: {
		method: "POST",
		path: "/v1/memory/entries/retire",
		location: "body",
		scope: true
	},
	list_memory_changes: {
		method: "POST",
		path: "/v1/memory/changes",
		location: "body",
		scope: true
	},
	propose_experience: {
		method: "POST",
		path: "/v1/experience/propose",
		location: "body",
		scope: true
	},
	generate_experience: {
		method: "POST",
		path: "/v1/experience/generate",
		location: "body",
		scope: true
	},
	get_experience: {
		method: "POST",
		path: "/v1/experience/get",
		location: "body",
		scope: true
	},
	propose_skill: {
		method: "POST",
		path: "/v1/skill/propose",
		location: "body",
		scope: true
	},
	generate_skill: {
		method: "POST",
		path: "/v1/skill/generate",
		location: "body",
		scope: true
	},
	get_skill: {
		method: "POST",
		path: "/v1/skill/get",
		location: "body",
		scope: true
	},
	scan_external_skills: {
		method: "POST",
		path: "/v1/external-skills/scan",
		location: "body",
		scope: true
	},
	list_external_skills: {
		method: "POST",
		path: "/v1/external-skills/list",
		location: "body",
		scope: true
	},
	resolve_external_skill: {
		method: "POST",
		path: "/v1/external-skills/resolve",
		location: "body",
		scope: true
	},
	import_external_skill: {
		method: "POST",
		path: "/v1/external-skills/import",
		location: "body",
		scope: true
	},
	list_artifact_candidates: {
		method: "POST",
		path: "/v1/artifact-candidates/list",
		location: "body",
		scope: true
	},
	get_artifact_candidate: {
		method: "POST",
		path: "/v1/artifact-candidates/get",
		location: "body",
		scope: true
	},
	approve_artifact_candidate: {
		method: "POST",
		path: "/v1/artifact-candidates/approve",
		location: "body",
		scope: true
	},
	reject_artifact_candidate: {
		method: "POST",
		path: "/v1/artifact-candidates/reject",
		location: "body",
		scope: true
	},
	revise_artifact_candidate: {
		method: "POST",
		path: "/v1/artifact-candidates/revise",
		location: "body",
		scope: true
	},
	get_stats: {
		method: "GET",
		path: "/v1/stats",
		location: "query",
		scope: true
	},
	create_handoff_report_project: {
		method: "POST",
		path: "/v1/handoff-reports/projects/create",
		location: "body",
		scope: false
	},
	list_handoff_report_projects: {
		method: "POST",
		path: "/v1/handoff-reports/projects/list",
		location: "body",
		scope: false
	},
	get_handoff_report_project: {
		method: "POST",
		path: "/v1/handoff-reports/projects/get",
		location: "body",
		scope: false
	},
	update_handoff_report_project: {
		method: "POST",
		path: "/v1/handoff-reports/projects/update",
		location: "body",
		scope: false
	},
	register_handoff_report_workstream: {
		method: "POST",
		path: "/v1/handoff-reports/workstreams/register",
		location: "body",
		scope: true
	},
	list_handoff_report_workstreams: {
		method: "POST",
		path: "/v1/handoff-reports/workstreams/list",
		location: "body",
		scope: false
	},
	update_handoff_report_workstream: {
		method: "POST",
		path: "/v1/handoff-reports/workstreams/update",
		location: "body",
		scope: false
	},
	get_handoff_report: {
		method: "POST",
		path: "/v1/handoff-reports/get",
		location: "body",
		scope: false
	},
	record_handoff_report_activity: {
		method: "POST",
		path: "/v1/handoff-reports/activities/record",
		location: "body",
		scope: true
	},
	list_handoff_report_activities: {
		method: "POST",
		path: "/v1/handoff-reports/activities/list",
		location: "body",
		scope: false
	},
	purge_handoff_report_activities: {
		method: "POST",
		path: "/v1/handoff-reports/activities/purge",
		location: "body",
		scope: false
	},
	get_handoff_report_workspace: {
		method: "POST",
		path: "/v1/handoff-reports/workspace-bindings/get",
		location: "body",
		scope: false
	},
	attach_handoff_report_workspace: {
		method: "POST",
		path: "/v1/handoff-reports/workspace-bindings/attach",
		location: "body",
		scope: false
	},
	detach_handoff_report_workspace: {
		method: "POST",
		path: "/v1/handoff-reports/workspace-bindings/detach",
		location: "body",
		scope: false
	}
};
const OPERATION_IDS = Object.keys(OPERATIONS);

//#endregion
//#region src/client.ts
function combineSignals(signals) {
	if (signals.length === 1) return signals[0];
	if (typeof AbortSignal.any === "function") return AbortSignal.any([...signals]);
	const controller = new AbortController();
	for (const signal of signals) if (signal.aborted) controller.abort(signal.reason);
	else signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
	return controller.signal;
}
function createTimeoutSignal(timeoutMs) {
	if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(timeoutMs);
	const controller = new AbortController();
	setTimeout(() => controller.abort(), timeoutMs).unref();
	return controller.signal;
}
async function readLimitedBody(response) {
	const declared = response.headers.get("content-length");
	const parsedLength = declared === null ? void 0 : Number(declared);
	const declaredBytes = parsedLength !== void 0 && Number.isFinite(parsedLength) && parsedLength >= 0 ? parsedLength : void 0;
	if (declaredBytes !== void 0 && declaredBytes > MAX_RESPONSE_BYTES) {
		try {
			await response.body?.cancel();
		} catch {}
		throw new InvalidResponseError("/");
	}
	if (!response.body) return new Uint8Array();
	const reader = response.body.getReader();
	const chunks = [];
	let length = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value?.byteLength) continue;
			if (length + value.byteLength > MAX_RESPONSE_BYTES) {
				try {
					await reader.cancel();
				} catch {}
				throw new InvalidResponseError("/");
			}
			chunks.push(value);
			length += value.byteLength;
			if (declaredBytes === void 0 && length === MAX_RESPONSE_BYTES) {
				try {
					await reader.cancel();
				} catch {}
				throw new InvalidResponseError("/");
			}
		}
	} finally {
		reader.releaseLock();
	}
	const body = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return body;
}
function queryString(payload) {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(payload ?? {})) if (value !== void 0 && value !== null) params.set(key, String(value));
	const encoded = params.toString();
	return encoded ? `?${encoded}` : "";
}
var PowerContextClient = class {
	fetchImpl;
	constructor(options) {
		this.options = options;
		this.fetchImpl = options.fetch ?? fetch;
	}
	async request(id, payload, signal) {
		if (!(id in OPERATIONS)) throw new UnknownOperationError(id);
		const spec = OPERATIONS[id];
		try {
			const response = await this.fetchImpl(this.url(spec, payload), this.init(spec, payload, signal));
			if (response.status >= 300 && response.status < 400) throw new InvalidResponseError(spec.path);
			const bytes = await readLimitedBody(response);
			const requestId = response.headers.get(REQUEST_ID_HEADER) ?? void 0;
			if (!response.ok) {
				let error = {};
				try {
					error = JSON.parse(Buffer.from(bytes).toString("utf8"));
				} catch {}
				throw new ServerResponseError({
					statusCode: response.status,
					requestId,
					code: error.error?.code,
					message: error.error?.message
				});
			}
			try {
				return {
					kind: "json",
					value: JSON.parse(Buffer.from(bytes).toString("utf8")),
					status: response.status,
					requestId
				};
			} catch {
				throw new InvalidResponseError(spec.path, requestId);
			}
		} catch (error) {
			if (error instanceof ServerResponseError || error instanceof InvalidResponseError || error instanceof UnknownOperationError) throw error;
			throw new UnavailableError(spec.path, error);
		}
	}
	url(spec, payload) {
		const query = spec.location === "query" ? queryString(payload) : "";
		return `${this.options.baseUrl.replace(/\/+$/, "")}${spec.path}${query}`;
	}
	init(spec, payload, signal) {
		const headers = {
			Accept: "application/json",
			"User-Agent": PLUGIN_USER_AGENT
		};
		if (this.options.authorization) headers.Authorization = this.options.authorization;
		const signals = [createTimeoutSignal(this.options.requestTimeoutMs)];
		if (signal) signals.push(signal);
		const init = {
			method: spec.method,
			headers,
			redirect: "manual",
			signal: combineSignals(signals)
		};
		if (spec.method === "POST" && spec.location === "body") {
			headers["Content-Type"] = "application/json";
			init.body = JSON.stringify(payload ?? {});
		}
		return init;
	}
};

//#endregion
//#region src/secrets.ts
const SECRET_PATTERNS = [
	/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/giu,
	/(?<![\w-])["']?\b(?:api[_ -]?key|access[_ -]?key|client[_ -]?secret|secret(?:[_ -]?key)?|password|passwd|passphrase|token|authorization|cookie)\b["']?\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|`[^`\r\n]*`|[^\s,;}\]]+)/giu,
	/(?<![\w-])bearer\s+[A-Za-z0-9._~+/=-]{8,}(?![\w-])/giu,
	/(?<![\w-])(?:sk-[A-Za-z0-9][A-Za-z0-9_-]{7,}|github_pat_[A-Za-z0-9_]{8,}|gh[pousr]_[A-Za-z0-9_]{8,}|xox[baprs]-[A-Za-z0-9-]{8,})(?![\w-])/giu
];
function scrubSecrets(text) {
	return SECRET_PATTERNS.reduce((value, pattern) => value.replace(pattern, "[REDACTED]"), text);
}
function containsSecret(text) {
	return scrubSecrets(text) !== text;
}

//#endregion
//#region src/invoke.ts
const WRITE_OPERATIONS = new Set([
	"remember_memory",
	"capture_content_source",
	"revise_memory_entry",
	"retire_memory_entry",
	"activate_handoff",
	"commit_handoff",
	"generate_experience",
	"generate_skill"
]);
function operationMutates(id) {
	return WRITE_OPERATIONS.has(id);
}
function hasSecret(value) {
	if (typeof value === "string") return containsSecret(value);
	if (Array.isArray(value)) return value.some(hasSecret);
	return Boolean(value && typeof value === "object" && Object.values(value).some(hasSecret));
}
function errorResult(error) {
	if (error instanceof ServerResponseError) {
		if (error.statusCode === 401) return {
			ok: false,
			code: "authentication_failed",
			message: "PowerContext authentication failed.",
			status: 401
		};
		if (error.statusCode === 409) return {
			ok: false,
			code: error.code ?? "conflict",
			message: error.serverMessage ?? "Citation conflict; refresh and retry once.",
			status: 409,
			request_id: error.requestId
		};
		return {
			ok: false,
			code: error.code ?? (error.statusCode === 404 ? "not_found" : "invalid_request"),
			message: error.serverMessage ?? `PowerContext returned HTTP ${error.statusCode}.`,
			status: error.statusCode,
			request_id: error.requestId
		};
	}
	if (error instanceof UnknownOperationError) return {
		ok: false,
		code: "unknown_operation",
		message: error.message
	};
	return {
		ok: false,
		code: "unavailable",
		message: "PowerContext is unavailable; continue the task."
	};
}
async function invokeOperation(client, operationId, payload, scopeId, signal) {
	const body = OPERATIONS[operationId].scope ? {
		...payload,
		scope_id: scopeId
	} : payload;
	if (operationMutates(operationId) && hasSecret(body)) return {
		ok: false,
		code: "secret_rejected",
		message: "Refused to send secret-like content to PowerContext."
	};
	try {
		const result = await client.request(operationId, body, signal);
		return {
			ok: true,
			status: result.status,
			request_id: result.requestId,
			data: result.value
		};
	} catch (error) {
		return errorResult(error);
	}
}

//#endregion
//#region src/commands.ts
const PC_COMMAND_USAGE = "doctor | search <query> | remember <text> | flush | review | stats | capabilities | skills scan";
function formatResult(result) {
	return JSON.stringify(result, null, 2);
}
function asResult(result) {
	return {
		kind: result.ok ? "success" : "error",
		text: formatResult(result)
	};
}
async function call(runtime, scopeId, operationId, payload, signal) {
	return asResult(await invokeOperation(runtime.client, operationId, payload, scopeId, signal));
}
async function handleReview(tokens, runtime, scopeId, signal) {
	const action = tokens[1];
	if (!action) return call(runtime, scopeId, "list_artifact_candidates", { status: "pending" }, signal);
	if (action === "approve") {
		const candidateId = tokens[2];
		const version = Number(tokens[3]);
		if (!candidateId || !Number.isInteger(version)) return {
			kind: "error",
			text: "Usage: /pc review approve <candidate_id> <expected_version>"
		};
		return call(runtime, scopeId, "approve_artifact_candidate", {
			candidate_id: candidateId,
			expected_version: version
		}, signal);
	}
	if (action === "reject") {
		const candidateId = tokens[2];
		const version = Number(tokens[3]);
		const reason = tokens.slice(4).join(" ");
		if (!candidateId || !Number.isInteger(version) || !reason) return {
			kind: "error",
			text: "Usage: /pc review reject <candidate_id> <expected_version> <reason>"
		};
		return call(runtime, scopeId, "reject_artifact_candidate", {
			candidate_id: candidateId,
			expected_version: version,
			reason
		}, signal);
	}
	return {
		kind: "error",
		text: "Usage: /pc review [approve|reject] ..."
	};
}
async function handleDoctor(runtime, scopeId, signal) {
	const live = await invokeOperation(runtime.client, "get_liveness", {}, scopeId, signal);
	const ready = await invokeOperation(runtime.client, "get_readiness", {}, scopeId, signal);
	const ok = live.ok && ready.ok;
	return {
		kind: ok ? "success" : "error",
		text: formatResult({
			ok,
			data: {
				live,
				ready
			}
		})
	};
}
async function handlePcCommand(rawInput, runtime, scopeId, signal) {
	const tokens = rawInput.trim().split(/\s+/).filter(Boolean);
	const command = tokens[0];
	if (!command) return {
		kind: "success",
		text: `scope=${scopeId}\nbaseUrl=${runtime.config.baseUrl}\nUse /pc doctor to check Server readiness.`
	};
	if (command === "doctor") return handleDoctor(runtime, scopeId, signal);
	if (command === "search") {
		const query = tokens.slice(1).join(" ");
		if (!query) return {
			kind: "error",
			text: "Usage: /pc search <query>"
		};
		return call(runtime, scopeId, "search_memory", {
			query,
			limit: 8,
			mode: "auto"
		}, signal);
	}
	if (command === "remember") {
		const text = tokens.slice(1).join(" ");
		if (!text) return {
			kind: "error",
			text: "Usage: /pc remember <text>"
		};
		return call(runtime, scopeId, "remember_memory", {
			kind: "agent-note",
			text
		}, signal);
	}
	if (command === "flush") return call(runtime, scopeId, "flush_memory", {}, signal);
	if (command === "review") return handleReview(tokens, runtime, scopeId, signal);
	if (command === "stats") return call(runtime, scopeId, "get_stats", {}, signal);
	if (command === "capabilities") return call(runtime, scopeId, "get_capabilities", {}, signal);
	if (command === "skills") {
		if (tokens[1] === "scan") return call(runtime, scopeId, "scan_external_skills", {}, signal);
		return {
			kind: "error",
			text: "Usage: /pc skills scan"
		};
	}
	return {
		kind: "error",
		text: `Unknown /pc subcommand. Try ${PC_COMMAND_USAGE}.`
	};
}

//#endregion
//#region src/config.ts
const DEFAULTS = {
	baseUrl: "http://127.0.0.1:8000",
	scopeId: void 0,
	authorization: void 0,
	capturePrompts: true,
	requestTimeoutMs: 1e3,
	httpBudgetMs: 4e3,
	maxBytes: 8e3,
	flushOnCapture: false,
	flushMaxCalls: 4
};
function envString(env, name) {
	return env[name]?.trim() || void 0;
}
function envBoolean(env, name) {
	const value = envString(env, name)?.toLowerCase();
	if (!value) return void 0;
	if ([
		"1",
		"true",
		"yes",
		"on"
	].includes(value)) return true;
	if ([
		"0",
		"false",
		"no",
		"off"
	].includes(value)) return false;
	throw new Error(`${name} must be a boolean`);
}
function envInteger(env, name, fallback, minimum, maximum) {
	const raw = envString(env, name);
	if (!raw) return fallback;
	const value = Number(raw);
	if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
	return value;
}
function normalizeBaseUrl(value) {
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error("POWERCONTEXT_OPENCODE_BASE_URL must be a valid HTTP(S) URL");
	}
	if (!["http:", "https:"].includes(url.protocol)) throw new Error("POWERCONTEXT_OPENCODE_BASE_URL must use HTTP or HTTPS");
	if (url.username || url.password || url.search || url.hash) throw new Error("POWERCONTEXT_OPENCODE_BASE_URL must not contain credentials, a query, or a fragment");
	const loopback = [
		"localhost",
		"127.0.0.1",
		"[::1]"
	].includes(url.hostname);
	if (url.protocol === "http:" && !loopback) throw new Error("POWERCONTEXT_OPENCODE_BASE_URL must use HTTPS outside loopback");
	return url.toString().replace(/\/+$/, "");
}
function resolveConfig(env = process.env) {
	const requestTimeoutMs = envInteger(env, "POWERCONTEXT_OPENCODE_REQUEST_TIMEOUT_MS", DEFAULTS.requestTimeoutMs, 50, 3e4);
	const httpBudgetMs = envInteger(env, "POWERCONTEXT_OPENCODE_HTTP_BUDGET_MS", DEFAULTS.httpBudgetMs, 100, 6e4);
	if (requestTimeoutMs > httpBudgetMs) throw new Error("POWERCONTEXT_OPENCODE_REQUEST_TIMEOUT_MS must not exceed POWERCONTEXT_OPENCODE_HTTP_BUDGET_MS");
	return {
		baseUrl: normalizeBaseUrl(envString(env, "POWERCONTEXT_OPENCODE_BASE_URL") ?? DEFAULTS.baseUrl),
		scopeId: envString(env, "POWERCONTEXT_OPENCODE_SCOPE_ID"),
		authorization: envString(env, "POWERCONTEXT_OPENCODE_AUTHORIZATION"),
		capturePrompts: envBoolean(env, "POWERCONTEXT_OPENCODE_CAPTURE_PROMPTS") ?? DEFAULTS.capturePrompts,
		requestTimeoutMs,
		httpBudgetMs,
		maxBytes: envInteger(env, "POWERCONTEXT_OPENCODE_MAX_BYTES", DEFAULTS.maxBytes, 512, 32768),
		flushOnCapture: envBoolean(env, "POWERCONTEXT_OPENCODE_FLUSH_ON_CAPTURE") ?? DEFAULTS.flushOnCapture,
		flushMaxCalls: envInteger(env, "POWERCONTEXT_OPENCODE_FLUSH_MAX_CALLS", DEFAULTS.flushMaxCalls, 1, 16)
	};
}

//#endregion
//#region src/scope.ts
const MAX_SCOPE_LENGTH = 256;
const SCP_REMOTE = /^(?:[^@/\s]+@)?(?<host>[^:/\s]+):(?<path>.+)$/;
function bounded(prefix, value) {
	const candidate = `${prefix}:${value}`;
	return candidate.length <= MAX_SCOPE_LENGTH ? candidate : `${prefix}:sha256:${createHash("sha256").update(value).digest("hex")}`;
}
function normalizePath(path) {
	let normalized = path.replaceAll("\\", "/").split("/").filter(Boolean).join("/");
	if (normalized.endsWith(".git")) normalized = normalized.slice(0, -4);
	return normalized.replace(/\/+$/, "");
}
function normalizeGitRemote(remote) {
	const value = remote.trim();
	if (!value) return void 0;
	const scpMatch = !value.includes("://") ? value.match(SCP_REMOTE) : null;
	if (scpMatch?.groups?.host && scpMatch.groups.path) {
		const path = normalizePath(scpMatch.groups.path);
		return path ? `${scpMatch.groups.host.toLowerCase()}/${path}` : void 0;
	}
	try {
		const parsed = new URL(value);
		if (![
			"http:",
			"https:",
			"ssh:",
			"git:"
		].includes(parsed.protocol) || !parsed.hostname) return void 0;
		const host = parsed.port ? `${parsed.hostname.toLowerCase()}:${parsed.port}` : parsed.hostname.toLowerCase();
		const path = normalizePath(parsed.pathname);
		return path ? `${host}/${path}` : void 0;
	} catch {
		return;
	}
}
function spawnGit(cwd, args) {
	return new Promise((finish) => {
		const child = spawn("git", args, {
			cwd,
			windowsHide: true
		});
		const chunks = [];
		let settled = false;
		const done = (value) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			finish(value);
		};
		const timer = setTimeout(() => {
			child.kill();
			done(void 0);
		}, 2e3);
		timer.unref();
		child.stdout.on("data", (chunk) => chunks.push(chunk));
		child.on("error", () => done(void 0));
		child.on("close", (code) => done(code === 0 ? Buffer.concat(chunks).toString("utf8").trim() || void 0 : void 0));
	});
}
async function deriveScopeId(cwd, options = {}) {
	if (options.configuredScopeId) {
		const explicit = options.configuredScopeId;
		return explicit.length <= MAX_SCOPE_LENGTH ? explicit : `sha256:${createHash("sha256").update(explicit).digest("hex")}`;
	}
	const git = options.git ?? spawnGit;
	const root = resolve(await git(cwd, ["rev-parse", "--show-toplevel"]) || cwd);
	const remote = await git(root, [
		"config",
		"--get",
		"remote.origin.url"
	]);
	const normalized = remote ? normalizeGitRemote(remote) : void 0;
	return normalized ? bounded("git", normalized) : `local:${createHash("sha256").update(root).digest("hex")}`;
}

//#endregion
//#region src/tui.ts
const COMMAND_NAME = "powercontext.pc";
function currentDirectory(api) {
	const route = api.route.current;
	if (route.name === "session" && "params" in route && route.params && typeof route.params.sessionID === "string") return api.state.session.get(route.params.sessionID)?.directory;
	return api.state.path.directory?.trim() || void 0;
}
function showResult(api, result) {
	const DialogAlert = api.ui.DialogAlert;
	api.ui.dialog.setSize("large");
	api.ui.dialog.replace(() => DialogAlert({
		title: result.kind === "success" ? "PowerContext" : "PowerContext error",
		message: result.text,
		onConfirm: () => api.ui.dialog.clear()
	}));
}
async function runCommand(api, runtime, rawInput) {
	api.ui.dialog.clear();
	try {
		const cwd = currentDirectory(api);
		if (!cwd && !runtime.config.scopeId) {
			showResult(api, {
				kind: "error",
				text: "PowerContext could not resolve the current OpenCode project directory."
			});
			return;
		}
		showResult(api, await handlePcCommand(rawInput, runtime, await deriveScopeId(cwd ?? "", { configuredScopeId: runtime.config.scopeId }), api.lifecycle.signal));
	} catch {
		showResult(api, {
			kind: "error",
			text: "PowerContext is unavailable; continue normal work."
		});
	}
}
function showCommandPrompt(api, runtime) {
	const DialogPrompt = api.ui.DialogPrompt;
	api.ui.dialog.setSize("large");
	api.ui.dialog.replace(() => DialogPrompt({
		title: "PowerContext /pc",
		placeholder: PC_COMMAND_USAGE,
		onConfirm: (value) => void runCommand(api, runtime, value),
		onCancel: () => api.ui.dialog.clear()
	}));
}
const PowerContextTuiPlugin = async (api) => {
	let config;
	try {
		config = resolveConfig();
	} catch (error) {
		api.ui.toast({
			variant: "error",
			title: "PowerContext",
			message: `configuration rejected: ${String(error)}`
		});
		return;
	}
	const runtime = {
		config,
		client: new PowerContextClient({
			baseUrl: config.baseUrl,
			authorization: config.authorization,
			requestTimeoutMs: config.requestTimeoutMs
		})
	};
	api.keymap.registerLayer({ commands: [{
		name: COMMAND_NAME,
		title: "PowerContext command",
		category: "PowerContext",
		namespace: "palette",
		slashName: "pc",
		slashAliases: ["powercontext"],
		run: () => showCommandPrompt(api, runtime)
	}] });
};
const plugin = {
	id: PLUGIN_NAME,
	tui: PowerContextTuiPlugin
};
var tui_default = plugin;

//#endregion
export { PowerContextTuiPlugin, tui_default as default };
