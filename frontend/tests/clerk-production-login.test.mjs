import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const frontendRoot = resolve(repoRoot, "frontend");

test("Clerk login and signup use optional catch-all App Router routes", () => {
  assert.equal(
    existsSync(
      resolve(frontendRoot, "app/(auth)/login/[[...sign-in]]/page.tsx"),
    ),
    true,
  );
  assert.equal(
    existsSync(
      resolve(frontendRoot, "app/(auth)/signup/[[...sign-up]]/page.tsx"),
    ),
    true,
  );
  assert.equal(
    existsSync(resolve(frontendRoot, "app/(auth)/login/page.tsx")),
    false,
  );
  assert.equal(
    existsSync(resolve(frontendRoot, "app/(auth)/signup/page.tsx")),
    false,
  );
});

test("production build manifest exposes nested Clerk auth routes", () => {
  const manifestPath = resolve(
    frontendRoot,
    ".next/server/app-paths-manifest.json",
  );
  assert.equal(
    existsSync(manifestPath),
    true,
    "run `pnpm --filter frontend build` before this test",
  );

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.ok(manifest["/(auth)/login/[[...sign-in]]/page"]);
  assert.ok(manifest["/(auth)/signup/[[...sign-up]]/page"]);
  assert.equal(manifest["/(auth)/login/page"], undefined);
  assert.equal(manifest["/(auth)/signup/page"], undefined);
});

test("production CSP allows Clerk login assets and API calls", () => {
  const nextConfig = readFileSync(
    resolve(frontendRoot, "next.config.ts"),
    "utf8",
  );

  for (const source of [
    "https://clerk.omnidial.io",
    "https://accounts.omnidial.io",
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://js.clerk.com",
    "https://api.clerk.com",
    "https://img.clerk.com",
  ]) {
    assert.ok(nextConfig.includes(source), `${source} missing from CSP`);
  }

  assert.match(nextConfig, /script-src[^`]+clerkScriptSources/s);
  assert.match(nextConfig, /connect-src[^`]+clerkConnectSources/s);
  assert.match(nextConfig, /frame-src[^`]+clerkFrameSources/s);
  assert.match(nextConfig, /img-src[^`]+clerkImageSources/s);
});
