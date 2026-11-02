import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { ESLint } from "eslint";
import { clearCaches, parseAndGenerateServices } from "@typescript-eslint/typescript-estree";

const configFile = fileURLToPath(new URL("../eslint.config.mjs", import.meta.url));

async function fixture(t, files) {
  const root = await mkdtemp(join(tmpdir(), "command-lab-matchers-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [path, source] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), source);
  }
  return root;
}

test("the app's ESLint config enumerates nested sources and excludes generated files", async (t) => {
  const source = "export const value = 1;\n";
  const included = ["src/main.ts", "src/.hidden.ts", "src/components/deep/widget.tsx", "tools/check.mjs"];
  const ignored = ["src/routeTree.gen.ts", "dist/bundle.js", ".output/server.js", "node_modules/example/index.ts"];
  const root = await fixture(t, Object.fromEntries([...included, ...ignored].map((path) => [path, source])));
  const eslint = new ESLint({ cwd: root, overrideConfigFile: configFile });

  const results = await eslint.lintFiles(["{src,tools}/**/*.{ts,tsx,mjs}"]);
  assert.deepEqual(results.map(({ filePath }) => filePath).sort(), included.map((path) => join(root, path)).sort());
  assert.equal(results.reduce((count, result) => count + result.errorCount, 0), 0);
  for (const path of ignored) assert.equal(await eslint.isPathIgnored(join(root, path)), true, path);
  assert.equal(await eslint.isPathIgnored(join(root, "src/main.ts")), false);

  const nested = await eslint.lintFiles(["src/**/components/**/*.tsx"]);
  assert.deepEqual(nested.map(({ filePath }) => filePath), [join(root, "src/components/deep/widget.tsx")]);
});

test("TypeScript project-service globs admit the intended dotfile and reject other folders", async (t) => {
  const source = "export const value: number = 1;\n";
  const root = await fixture(t, {
    "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true }, include: ["src/**/*.ts"] }),
    "src/included.ts": source,
    "config/.tools.ts": source,
    "other/.tools.ts": source,
  });
  t.after(clearCaches);
  const options = {
    tsconfigRootDir: root,
    projectService: { allowDefaultProject: ["config/*.ts"] },
  };
  const parsed = parseAndGenerateServices(source, { ...options, filePath: join(root, "config/.tools.ts") });
  assert.ok(parsed.services.program, "the matching file receives type information");
  assert.throws(
    () => parseAndGenerateServices(source, { ...options, filePath: join(root, "other/.tools.ts") }),
    /does not match/,
  );
});
