/**
 * Portfolio Admin — secure backend
 * Holds the GitHub token and admin password hash as Worker secrets.
 * The frontend (admin.html) never sees either.
 *
 * Routes:
 *   POST /login    { password }                -> { token }
 *   POST /publish  { token, message, files[] }  -> { ok, commit }
 *
 * Required secrets (set with `wrangler secret put <NAME>` or in the
 * Cloudflare dashboard under Settings > Variables):
 *   GITHUB_TOKEN          fine-grained PAT, Contents: Read & write, on the one repo only
 *   GITHUB_OWNER          your GitHub username
 *   GITHUB_REPO           the repo name GitHub Pages serves from
 *   GITHUB_BRANCH         e.g. "main"
 *   ADMIN_PASSWORD_SHA256 hex SHA-256 of your chosen admin password
 *   SESSION_SECRET        any long random string, used to sign session tokens
 *   ALLOWED_ORIGIN         e.g. "https://syedburhanss.online"
 */

export default {
  async fetch(req, env) {
    const origin = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(req.url);
    try {
      if (req.method === 'POST' && url.pathname === '/login') return await handleLogin(req, env, cors);
      if (req.method === 'POST' && url.pathname === '/publish') return await handlePublish(req, env, cors);
      return json({ error: 'not found' }, 404, cors);
    } catch (e) {
      return json({ error: e.message || 'server error' }, 500, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json', ...cors } });
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(key, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* ---------- login: verify password, issue a short-lived signed token ---------- */
async function handleLogin(req, env, cors) {
  const { password } = await req.json();
  if (!password) return json({ error: 'password required' }, 400, cors);
  const hash = await sha256Hex(password);
  if (!timingSafeEqual(hash, env.ADMIN_PASSWORD_SHA256)) {
    await new Promise((r) => setTimeout(r, 400)); // slow down brute force a little
    return json({ error: 'invalid password' }, 401, cors);
  }
  const exp = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
  const payload = String(exp);
  const sig = await hmacHex(env.SESSION_SECRET, payload);
  return json({ token: payload + '.' + sig }, 200, cors);
}

async function verifyToken(token, env) {
  if (!token || token.indexOf('.') === -1) return false;
  const [payload, sig] = token.split('.');
  const expected = await hmacHex(env.SESSION_SECRET, payload);
  if (!timingSafeEqual(sig, expected)) return false;
  return Number(payload) > Date.now();
}

/* ---------- publish: atomic multi-file commit via the Git Data API ---------- */
async function handlePublish(req, env, cors) {
  const body = await req.json();
  const { token, message, files } = body;
  if (!(await verifyToken(token, env))) return json({ error: 'unauthorized' }, 401, cors);
  if (!Array.isArray(files) || files.length === 0) return json({ error: 'no files to publish' }, 400, cors);

  const owner = env.GITHUB_OWNER, repo = env.GITHUB_REPO, branch = env.GITHUB_BRANCH || 'main';
  const gh = (path, opts) => fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'portfolio-admin-worker',
      'Content-Type': 'application/json',
      ...(opts && opts.headers),
    },
  });

  // 1. current branch head commit
  const refRes = await gh(`/git/ref/heads/${branch}`);
  if (!refRes.ok) return json({ error: 'failed to read branch ref: ' + (await refRes.text()) }, 502, cors);
  const refData = await refRes.json();
  const baseCommitSha = refData.object.sha;

  // 2. base tree
  const commitRes = await gh(`/git/commits/${baseCommitSha}`);
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  // 3. create a blob per file
  const treeEntries = [];
  for (const f of files) {
    const blobRes = await gh('/git/blobs', { method: 'POST', body: JSON.stringify({ content: f.content_base64, encoding: 'base64' }) });
    if (!blobRes.ok) return json({ error: 'blob failed for ' + f.path + ': ' + (await blobRes.text()) }, 502, cors);
    const blob = await blobRes.json();
    treeEntries.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  // 4. new tree
  const treeRes = await gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }) });
  if (!treeRes.ok) return json({ error: 'tree failed: ' + (await treeRes.text()) }, 502, cors);
  const treeData = await treeRes.json();

  // 5. new commit
  const newCommitRes = await gh('/git/commits', {
    method: 'POST',
    body: JSON.stringify({ message: message || 'Update portfolio content', tree: treeData.sha, parents: [baseCommitSha] }),
  });
  if (!newCommitRes.ok) return json({ error: 'commit failed: ' + (await newCommitRes.text()) }, 502, cors);
  const newCommit = await newCommitRes.json();

  // 6. move branch pointer
  const updateRefRes = await gh(`/git/refs/heads/${branch}`, { method: 'PATCH', body: JSON.stringify({ sha: newCommit.sha }) });
  if (!updateRefRes.ok) return json({ error: 'ref update failed: ' + (await updateRefRes.text()) }, 502, cors);

  return json({ ok: true, commit: newCommit.sha }, 200, cors);
}
