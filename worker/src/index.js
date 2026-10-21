const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;

// POC-only stand-in for real identity. Maps a dev header to a fixed
// name/email - swap this for real Google ID token verification later
// (see NOTES.md "Build order decision"). Anyone can set this header
// right now, so nothing behind it is actually secure yet.
const DEV_USERS = {
  ayman: { name: "Ayman Siddiki", email: "ayman@example.com" },
  dana: { name: "Dana Whitfield", email: "dana@example.com" },
  guest: { name: "Guest User", email: "guest@example.com" },
};

const ADMIN_IDS = new Set(["ayman"]);

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Dev-User",
  };
}

function jsonResponse(body, status, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

async function resolveIdentity(request, env) {
  const devId = request.headers.get("X-Dev-User");
  const devUser = devId && DEV_USERS[devId];
  if (!devUser) return null;

  const person = await env.DB.prepare("SELECT * FROM people WHERE email = ?")
    .bind(devUser.email)
    .first();

  return {
    id: devId,
    name: devUser.name,
    email: devUser.email,
    isContributor: Boolean(person),
    isAdmin: ADMIN_IDS.has(devId),
    authorId: person ? person.id : null,
  };
}

function slugify(text) {
  const slug = text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

async function getCatalog(env) {
  const people = (await env.DB.prepare("SELECT * FROM people ORDER BY name").all()).results;
  const skills = (await env.DB.prepare("SELECT * FROM skills ORDER BY title").all()).results;
  const artifacts = (await env.DB.prepare("SELECT * FROM artifacts ORDER BY title").all()).results;

  return people.map(person => ({
    id: person.id,
    name: person.name,
    role: person.role,
    focus: person.focus,
    skills: skills
      .filter(s => s.author === person.id)
      .map(s => ({
        id: s.id,
        title: s.title,
        description: s.description,
        tags: JSON.parse(s.tags),
      })),
    artifacts: artifacts
      .filter(a => a.author === person.id)
      .map(a => ({
        id: a.id,
        title: a.title,
        description: a.description,
        url: a.url,
      })),
  }));
}

function skillToMarkdown(skill) {
  const tags = JSON.parse(skill.tags);
  return `---\ntitle: ${skill.title}\ndescription: ${skill.description}\ntags: [${tags.join(", ")}]\n---\n\n${skill.body}\n`;
}

async function handleContent(url, env) {
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");

  if (type !== "skill" || !id) {
    return jsonResponse({ error: "invalid content request" }, 400, env);
  }

  const skill = await env.DB.prepare("SELECT * FROM skills WHERE id = ?").bind(id).first();
  if (!skill) return jsonResponse({ error: "not found" }, 404, env);

  return new Response(skillToMarkdown(skill), {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${id}.md"`,
      ...corsHeaders(env),
    },
  });
}

async function handleUpsert(request, env, identity) {
  if (!identity) return jsonResponse({ error: "sign-in required" }, 401, env);

  const body = await request.json();
  const { intent, type, id, title, description } = body;

  if (!["skill", "artifact"].includes(type)) {
    return jsonResponse({ error: "invalid type" }, 400, env);
  }
  if (!["create", "update"].includes(intent)) {
    return jsonResponse({ error: "invalid intent" }, 400, env);
  }
  if (!title || !title.trim()) {
    return jsonResponse({ error: "title required" }, 400, env);
  }

  const table = type === "skill" ? "skills" : "artifacts";

  if (intent === "update") {
    if (!id) return jsonResponse({ error: "id required for update" }, 400, env);

    const existing = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
    if (!existing) return jsonResponse({ error: "not found" }, 404, env);
    if (existing.author !== identity.authorId) {
      return jsonResponse({ error: "you can only edit your own content" }, 403, env);
    }

    if (type === "skill") {
      const tags = JSON.stringify(body.tags || []);
      await env.DB.prepare(
        "UPDATE skills SET title = ?, description = ?, tags = ?, body = ? WHERE id = ?"
      ).bind(title, description || "", tags, body.body || "", id).run();
    } else {
      await env.DB.prepare(
        "UPDATE artifacts SET title = ?, description = ?, url = ? WHERE id = ?"
      ).bind(title, description || "", body.url || "", id).run();
    }

    return jsonResponse({ ok: true, id }, 200, env);
  }

  // intent === "create"
  if (!identity.isContributor) {
    return jsonResponse({ error: "not a contributor yet - request access first" }, 403, env);
  }

  const newId = slugify(title);
  const existing = await env.DB.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(newId).first();
  if (existing) {
    return jsonResponse({ error: "something with this title already exists - pick a different title" }, 409, env);
  }

  if (type === "skill") {
    const tags = JSON.stringify(body.tags || []);
    await env.DB.prepare(
      "INSERT INTO skills (id, author, title, description, tags, body) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(newId, identity.authorId, title, description || "", tags, body.body || "").run();
  } else {
    await env.DB.prepare(
      "INSERT INTO artifacts (id, author, title, description, url) VALUES (?, ?, ?, ?, ?)"
    ).bind(newId, identity.authorId, title, description || "", body.url || "").run();
  }

  return jsonResponse({ ok: true, id: newId }, 201, env);
}

async function handleDelete(request, env, identity) {
  if (!identity) return jsonResponse({ error: "sign-in required" }, 401, env);

  const { type, id } = await request.json();
  if (!["skill", "artifact"].includes(type) || !id) {
    return jsonResponse({ error: "invalid request" }, 400, env);
  }

  const table = type === "skill" ? "skills" : "artifacts";
  const existing = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
  if (!existing) return jsonResponse({ error: "not found" }, 404, env);
  if (existing.author !== identity.authorId) {
    return jsonResponse({ error: "you can only remove your own content" }, 403, env);
  }

  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  return jsonResponse({ ok: true, id }, 200, env);
}

async function handleContributorRequest(request, env, identity) {
  if (!identity) return jsonResponse({ error: "sign-in required" }, 401, env);
  if (identity.isContributor) {
    return jsonResponse({ error: "already a contributor" }, 400, env);
  }

  const existing = await env.DB.prepare(
    "SELECT id FROM contributor_requests WHERE email = ? AND status = 'pending'"
  ).bind(identity.email).first();
  if (existing) {
    return jsonResponse({ ok: true, alreadyPending: true }, 200, env);
  }

  await env.DB.prepare(
    "INSERT INTO contributor_requests (name, email) VALUES (?, ?)"
  ).bind(identity.name, identity.email).run();

  return jsonResponse({ ok: true }, 201, env);
}

async function handleAdminRequests(env, identity) {
  if (!identity || !identity.isAdmin) return jsonResponse({ error: "admin only" }, 403, env);

  const requests = (await env.DB.prepare(
    "SELECT * FROM contributor_requests WHERE status = 'pending' ORDER BY created_at"
  ).all()).results;

  return jsonResponse({ requests }, 200, env);
}

async function handleAdminApprove(request, env, identity) {
  if (!identity || !identity.isAdmin) return jsonResponse({ error: "admin only" }, 403, env);

  const { requestId, role, focus } = await request.json();
  const req = await env.DB.prepare(
    "SELECT * FROM contributor_requests WHERE id = ? AND status = 'pending'"
  ).bind(requestId).first();

  if (!req) return jsonResponse({ error: "request not found or already resolved" }, 404, env);

  const personId = slugify(req.name);
  await env.DB.prepare(
    "INSERT INTO people (id, name, role, focus, email) VALUES (?, ?, ?, ?, ?)"
  ).bind(personId, req.name, role || "", focus || "", req.email).run();

  await env.DB.prepare(
    "UPDATE contributor_requests SET status = 'approved' WHERE id = ?"
  ).bind(requestId).run();

  return jsonResponse({ ok: true, personId }, 200, env);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    try {
      const identity = await resolveIdentity(request, env);

      if (url.pathname === "/api/catalog" && request.method === "GET") {
        return jsonResponse(await getCatalog(env), 200, env);
      }

      if (url.pathname === "/api/content" && request.method === "GET") {
        return await handleContent(url, env);
      }

      if (url.pathname === "/api/whoami" && request.method === "GET") {
        return jsonResponse({ identity }, 200, env);
      }

      if (url.pathname === "/api/asset" && request.method === "POST") {
        return await handleUpsert(request, env, identity);
      }

      if (url.pathname === "/api/asset" && request.method === "DELETE") {
        return await handleDelete(request, env, identity);
      }

      if (url.pathname === "/api/contributor-request" && request.method === "POST") {
        return await handleContributorRequest(request, env, identity);
      }

      if (url.pathname === "/api/admin/requests" && request.method === "GET") {
        return await handleAdminRequests(env, identity);
      }

      if (url.pathname === "/api/admin/approve" && request.method === "POST") {
        return await handleAdminApprove(request, env, identity);
      }

      return jsonResponse({ error: "not found" }, 404, env);
    } catch (err) {
      return jsonResponse({ error: "unexpected error", detail: String(err) }, 500, env);
    }
  },
};
