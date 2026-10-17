const VALID_TYPES = new Set(["skill", "artifact"]);
const SAFE_NAME = /^[a-z0-9][a-z0-9-]*\.(md|json)$/;
const SAFE_AUTHOR = /^[a-z0-9][a-z0-9-]*$/;

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Team-Auth",
  };
}

function jsonResponse(body, status, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

function githubHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_PAT}`,
    "User-Agent": "skill-hub-gateway",
    Accept: "application/vnd.github+json",
  };
}

function assetPath(author, type, filename) {
  return `registry/${author}/${type}s/${filename}`;
}

async function getExistingSha(env, path) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH}`;
  const res = await fetch(url, { headers: githubHeaders(env) });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);

  const data = await res.json();
  return data.sha;
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

async function handleUpsert(request, env) {
  const body = await request.json();
  const { author, type, filename, content } = body;

  if (!SAFE_AUTHOR.test(author || "")) {
    return jsonResponse({ error: "invalid author" }, 400, env);
  }
  if (!VALID_TYPES.has(type)) {
    return jsonResponse({ error: "invalid type" }, 400, env);
  }
  if (!SAFE_NAME.test(filename || "")) {
    return jsonResponse({ error: "invalid filename" }, 400, env);
  }
  if (typeof content !== "string" || content.length === 0) {
    return jsonResponse({ error: "missing content" }, 400, env);
  }

  const path = assetPath(author, type, filename);
  const sha = await getExistingSha(env, path);

  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...githubHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: sha ? `chore(registry): update ${path}` : `feat(registry): add ${path}`,
      content: toBase64(content),
      branch: env.GITHUB_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return jsonResponse({ error: "github commit failed", detail }, 502, env);
  }

  return jsonResponse({ ok: true, path }, sha ? 200 : 201, env);
}

async function handleDelete(request, env) {
  const body = await request.json();
  const { author, type, filename } = body;

  if (!SAFE_AUTHOR.test(author || "")) {
    return jsonResponse({ error: "invalid author" }, 400, env);
  }
  if (!VALID_TYPES.has(type)) {
    return jsonResponse({ error: "invalid type" }, 400, env);
  }
  if (!SAFE_NAME.test(filename || "")) {
    return jsonResponse({ error: "invalid filename" }, 400, env);
  }

  const path = assetPath(author, type, filename);
  const sha = await getExistingSha(env, path);

  if (!sha) {
    return jsonResponse({ error: "not found" }, 404, env);
  }

  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { ...githubHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `chore(registry): remove ${path}`,
      sha,
      branch: env.GITHUB_BRANCH,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return jsonResponse({ error: "github delete failed", detail }, 502, env);
  }

  return jsonResponse({ ok: true, path }, 200, env);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    if (url.pathname !== "/api/asset") {
      return jsonResponse({ error: "not found" }, 404, env);
    }

    if (request.headers.get("X-Team-Auth") !== env.TEAM_AUTH_SECRET) {
      return jsonResponse({ error: "unauthorized" }, 401, env);
    }

    try {
      if (request.method === "POST") return await handleUpsert(request, env);
      if (request.method === "DELETE") return await handleDelete(request, env);
    } catch (err) {
      return jsonResponse({ error: "unexpected error", detail: String(err) }, 500, env);
    }

    return jsonResponse({ error: "method not allowed" }, 405, env);
  },
};
