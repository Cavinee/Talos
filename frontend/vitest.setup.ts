import "@testing-library/jest-dom";
import { readFileSync } from "fs";
import Module from "module";
import { transform } from "sucrase";

import { resolve as resolvePath } from "path";

const FRONTEND_ROOT = resolvePath(import.meta.dirname, ".");

// Allow require('./foo') to resolve .tsx/.ts files and @/ aliases so that
// tests can use deferred require() for lazy loading after vi.spyOn/vi.mock.
// Uses sucrase (no native dependency issues in jsdom environment).
const _resolveFilename = (Module as any)._resolveFilename.bind(Module);
(Module as any)._resolveFilename = function (
  request: string,
  parent: NodeModule | null,
  isMain: boolean,
  options: unknown
) {
  // Resolve @/ alias
  const resolved = request.startsWith("@/")
    ? resolvePath(FRONTEND_ROOT, request.slice(2))
    : request;

  // Try with TypeScript extensions if bare import fails
  const candidates = [resolved];
  if (!resolved.match(/\.[jt]sx?$/)) {
    candidates.push(...[".tsx", ".ts", ".jsx", ".js"].map((e) => resolved + e));
  }

  for (const candidate of candidates) {
    try {
      return _resolveFilename(candidate, parent, isMain, options);
    } catch {
      // continue
    }
  }
  throw new Error(`Cannot find module '${request}'`);
};

for (const ext of [".tsx", ".ts"] as const) {
  (require as any).extensions[ext] = function (
    module: NodeModule & { _compile: (code: string, filename: string) => void },
    filename: string
  ) {
    const content = readFileSync(filename, "utf8");
    const result = transform(content, {
      transforms: ["typescript", "jsx", "imports"],
      jsxRuntime: "automatic",
      production: false,
    });
    module._compile(result.code, filename);
  };
}

if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 0)) as typeof requestAnimationFrame;
}

if (!globalThis.cancelAnimationFrame) {
  globalThis.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
}
