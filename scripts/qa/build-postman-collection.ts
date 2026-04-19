/**
 * scripts/qa/build-postman-collection.ts
 *
 * Wave 11 (2026-04-18). Converts `docs/api/openapi-v1.yaml` into a
 * Postman Collection v2.1.0 JSON document and writes it to
 * `data/api/v1/postman.json`. Customers download the collection,
 * import into Postman/Insomnia/Bruno, and have every documented
 * endpoint pre-wired with auth, params, and example bodies.
 *
 * Anti-weakening
 * --------------
 * - The generator MUST cover every operation in the OpenAPI spec.
 *   The Wave 11 contract test (`tests/contract/pillar-j-postman.spec.ts`)
 *   asserts parity. Adding a new endpoint to the spec without
 *   regenerating the collection MUST fail CI.
 * - The collection MUST use a Postman *variable* for the bearer key
 *   (`{{api_key}}`) — the generator MUST NOT bake any real or
 *   placeholder credential into the JSON.
 * - The collection MUST use a Postman *variable* for the base URL
 *   (`{{base_url}}`) so customers point it at staging/prod by
 *   editing one field.
 * - The script writes to `data/api/v1/postman.json`, NOT to
 *   `docs/api/` and NOT to `public/api/v1/`. The contract is "the
 *   route handler at `src/app/api/v1/postman.json/route.ts` serves
 *   it with ETag + Content-Disposition" — putting the file in
 *   `public/` would create a Next.js static-vs-route conflict at
 *   the same URL and 500 every download (DEF-0013, fixed in the
 *   same commit). The file is a build artifact, not source
 *   documentation.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { load as loadYaml } from "js-yaml";

interface OpenApiOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: Array<{
    name: string;
    in: "query" | "path" | "header" | "cookie";
    required?: boolean;
    description?: string;
    schema?: { type?: string; default?: unknown; example?: unknown };
  }>;
  requestBody?: {
    content?: Record<string, { schema?: unknown; example?: unknown }>;
  };
}

interface OpenApiSpec {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, Record<string, OpenApiOperation>>;
}

interface PostmanRequestUrl {
  raw: string;
  host: string[];
  path: string[];
  query?: Array<{ key: string; value: string; description?: string; disabled?: boolean }>;
  variable?: Array<{ key: string; value?: string; description?: string }>;
}

interface PostmanRequest {
  method: string;
  header: Array<{ key: string; value: string; type?: string }>;
  url: PostmanRequestUrl;
  description?: string;
  body?: { mode: "raw"; raw: string; options?: { raw: { language: "json" } } };
  auth?: { type: "bearer"; bearer: Array<{ key: string; value: string; type: "string" }> };
}

interface PostmanItem {
  name: string;
  request: PostmanRequest;
  response: unknown[];
}

interface PostmanFolder {
  name: string;
  description?: string;
  item: PostmanItem[];
}

interface PostmanCollection {
  info: {
    name: string;
    description: string;
    schema: string;
    _postman_id?: string;
    version?: string;
  };
  auth: { type: "bearer"; bearer: Array<{ key: string; value: string; type: "string" }> };
  variable: Array<{ key: string; value: string; type: "string"; description?: string }>;
  item: PostmanFolder[];
}

const REPO_ROOT = process.cwd();
const SPEC_PATH = join(REPO_ROOT, "docs", "api", "openapi-v1.yaml");
const OUT_PATH = join(REPO_ROOT, "data", "api", "v1", "postman.json");

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
]);

function templateOpenApiPathToPostman(p: string): {
  segments: string[];
  variables: Array<{ key: string; value: string }>;
} {
  const variables: Array<{ key: string; value: string }> = [];
  const segments = p
    .replace(/^\//, "")
    .split("/")
    .map((seg) => {
      const m = /^\{(.+)\}$/.exec(seg);
      if (m) {
        variables.push({ key: m[1]!, value: `<${m[1]!}>` });
        return `:${m[1]}`;
      }
      return seg;
    });
  return { segments, variables };
}

function buildItem(
  operationName: string,
  method: string,
  pathTemplate: string,
  op: OpenApiOperation,
): PostmanItem {
  const { segments, variables } = templateOpenApiPathToPostman(pathTemplate);
  const url: PostmanRequestUrl = {
    raw: `{{base_url}}${pathTemplate.replace(/\{(.+?)\}/g, ":$1")}`,
    host: ["{{base_url}}"],
    path: segments,
  };

  const queryParams = (op.parameters ?? []).filter((p) => p.in === "query");
  if (queryParams.length > 0) {
    url.query = queryParams.map((q) => ({
      key: q.name,
      value:
        q.schema?.example !== undefined
          ? String(q.schema.example)
          : q.schema?.default !== undefined
            ? String(q.schema.default)
            : "",
      description: q.description,
      disabled: !q.required,
    }));
  }
  if (variables.length > 0) {
    url.variable = variables.map((v) => ({
      key: v.key,
      value: v.value,
      description: `Path variable derived from OpenAPI {${v.key}}.`,
    }));
  }

  const request: PostmanRequest = {
    method: method.toUpperCase(),
    header: [
      { key: "Accept", value: "application/json", type: "text" },
    ],
    url,
    description: op.description ?? op.summary,
  };

  const body = op.requestBody?.content?.["application/json"];
  if (body) {
    let raw = "";
    if (body.example !== undefined) {
      raw = JSON.stringify(body.example, null, 2);
    } else {
      raw = "{}";
    }
    request.body = {
      mode: "raw",
      raw,
      options: { raw: { language: "json" } },
    };
    request.header.push({ key: "Content-Type", value: "application/json", type: "text" });
  }

  return {
    name: operationName,
    request,
    response: [],
  };
}

function build(): PostmanCollection {
  const yamlText = readFileSync(SPEC_PATH, "utf-8");
  const spec = loadYaml(yamlText) as OpenApiSpec;

  if (!spec || typeof spec !== "object" || !spec.paths) {
    throw new Error(`OpenAPI spec at ${SPEC_PATH} did not parse to an object with .paths`);
  }

  const folderByTag = new Map<string, PostmanFolder>();

  for (const [pathTemplate, ops] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(ops)) {
      if (!HTTP_METHODS.has(method)) continue;
      const tag = op.tags?.[0] ?? "default";
      let folder = folderByTag.get(tag);
      if (!folder) {
        folder = { name: tag, item: [] };
        folderByTag.set(tag, folder);
      }
      const opName =
        op.operationId ??
        `${method.toUpperCase()} ${pathTemplate}`;
      folder.item.push(buildItem(opName, method, pathTemplate, op));
    }
  }

  const folders = [...folderByTag.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const f of folders) {
    f.item.sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    info: {
      name: `${spec.info.title} (v${spec.info.version})`,
      description: [
        spec.info.description?.trim() ?? "",
        "",
        "Auto-generated from `docs/api/openapi-v1.yaml`.",
        "Do not hand-edit — regenerate via `npm run postman:gen`.",
      ]
        .filter((s) => s !== null && s !== undefined)
        .join("\n"),
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      version: spec.info.version,
    },
    auth: {
      type: "bearer",
      bearer: [{ key: "token", value: "{{api_key}}", type: "string" }],
    },
    variable: [
      {
        key: "base_url",
        value: "https://your-host",
        type: "string",
        description: "Base URL of your environment, no trailing slash.",
      },
      {
        key: "api_key",
        value: "",
        type: "string",
        description: "Bearer API key. Issued via /admin/api-keys.",
      },
    ],
    item: folders,
  };
}

function main(): number {
  const collection = build();
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(collection, null, 2) + "\n", "utf-8");
  const opCount = collection.item.reduce((n, f) => n + f.item.length, 0);
  console.log(
    `postman:gen OK — ${opCount} operations in ${collection.item.length} folders -> ${OUT_PATH}`,
  );
  return 0;
}

if (require.main === module) {
  process.exit(main());
}

export { build };
