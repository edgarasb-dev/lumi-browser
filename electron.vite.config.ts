import { resolve } from "path";
import { defineConfig } from "electron-vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { generateRoutes } from "./scripts/frontend-routes-generator/generator";

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
  "@": resolve("src/renderer/src"),
  ...(isProductionBuild()
    ? {
        "@phosphor-icons/react": resolve("node_modules/@phosphor-icons/react/dist/index.cjs.js"),
        "lucide-react": resolve("node_modules/lucide-react/dist/cjs/lucide-react.js")
      }
    : {})
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
        external: ["electron", /^electron\/.*/, "@electron-webauthn/macos", "objc-js"]
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
    }
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
