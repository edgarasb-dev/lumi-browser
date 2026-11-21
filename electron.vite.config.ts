import { copyFileSync, mkdirSync } from "fs";
import { createRequire } from "module";
import { basename, resolve } from "path";
import { defineConfig } from "electron-vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { generateRoutes } from "./scripts/frontend-routes-generator/generator";

const require = createRequire(import.meta.url);

/**
 * Bundled `electron-chrome-web-store` and `electron-chrome-extensions` resolve their preload
 * scripts relative to `__dirname` when packaged in ASAR. Copying them beside the main bundle
 * guarantees Chrome Web Store and extension APIs load cleanly in release builds.
 */
function copyExtensionPreloadsPlugin() {
  const preloadIds = ["electron-chrome-web-store/preload", "electron-chrome-extensions/preload"];
  return {
    name: "copy-extension-preloads",
    writeBundle(options: { dir?: string }) {
      const outDir = options.dir ? resolve(options.dir) : resolve("out/main");
      mkdirSync(outDir, { recursive: true });
      for (const id of preloadIds) {
        const src = require.resolve(id);
        copyFileSync(src, resolve(outDir, basename(src)));
      }
    }
  };
}

const routes = await generateRoutes();

function isProductionBuild() {
  return process.env.PRODUCTION_BUILD === "true";
}

const babelPlugin =
  process.env.ENABLE_REACT_COMPILER === "true" && isProductionBuild()
    ? (await import("@rolldown/plugin-babel")).default({
        presets: [reactCompilerPreset()]
      })
    : null;

const mainAliases: Record<string, string> = {
  "@": resolve("src/main")
};

const rendererAliases: Record<string, string> = {
  "@": resolve("src/renderer/src")
};

const sharedAliases: Record<string, string> = {
  "~": resolve("src/shared")
};

const commonOptions = {
  build: {
    minify: isProductionBuild() ? "esbuild" : false
  }
} as const;

export default defineConfig({
  main: {
    ...commonOptions,
    build: {
      ...commonOptions.build,
      rollupOptions: {
        external: [
          "electron",
          /^electron\/.*/,
          "better-sqlite3",
          "bindings",
          "sharp",
          "node-gyp-build",
          "@electron-webauthn/macos",
          "objc-js"
        ]
      },
      externalizeDeps: {
        exclude: [
          "@ghostery/adblocker-electron",
          "@phosphor-icons/core",
          "arktype",
          "electron-context-menu",
          "electron-chrome-web-store",
          "electron-chrome-extensions",
          "electron-updater",
          "electron-webauthn",
          "icojs",
          "mime-types",
          "posthog-node",
          "tldts",
          "hono",
          "objcjs-types"
        ],
        include: ["objc-js", "better-sqlite3", "sharp", "@electron-webauthn/macos"]
      }
    },
    resolve: {
      alias: {
        ...mainAliases,
        ...sharedAliases
      }
    },
    plugins: [copyExtensionPreloadsPlugin()]
  },
  preload: {
    ...commonOptions,
    build: {
      ...commonOptions.build,
      externalizeDeps: { exclude: ["electron-chrome-extensions"] }
    },
    resolve: {
      alias: {
        ...mainAliases,
        ...sharedAliases
      }
    }
  },
  renderer: {
    ...commonOptions,
    resolve: {
      alias: {
        ...rendererAliases,
        ...sharedAliases
      }
    },
    build: {
      ...commonOptions.build,
      rollupOptions: {
        input: {
          ...routes
        }
      }
    },
    plugins: [react(), ...(babelPlugin ? [babelPlugin] : []), tailwindcss()]
  }
});
