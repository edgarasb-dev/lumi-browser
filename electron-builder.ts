import type { Configuration } from "electron-builder";

// Helper Functions //
/**
 * Get the custom app version from environment variables.
 * @returns The custom app version from environment variables, or undefined if not provided
 */
function getCustomAppVersion(): string | undefined {
  return process.env.CUSTOM_APP_VERSION;
}

// Options //
const customAppVersion = getCustomAppVersion();
if (customAppVersion) {
  console.log(`Using custom version: ${customAppVersion}`);
}

// Main Configuration //
const electronBuilderConfig: Configuration = {
  appId: "dev.lumi.browser",
  productName: "Lumi",
  ...(customAppVersion && { buildVersion: customAppVersion, extraMetadata: { version: customAppVersion } }),
  directories: {
    output: "dist",
    buildResources: "build"
  },
  files: [
    "!**/.vscode/*",
    "!build/**",
    "!src/*",
    "!electron.vite.config.{js,ts,mjs,cjs}",
    "!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc,dev-app-update.yml}",
    "!{CHANGELOG.md,README.md,CONTRIBUTING.md,docs/**}",
    "!{scripts/**}",
    "!node_modules/@phosphor-icons/**",
    "!node_modules/objcjs-types/**",
    "!node_modules/lucide-react/**",
    "!**/*.{map,d.ts,md,markdown}",
    "!**/node_modules/drizzle-orm/{mysql-core,gel-core,planetscale-serverless,neon-serverless,op-sqlite,expo-sqlite,durable-sqlite,bun-sqlite,libsql}/**",
    "!**/node_modules/better-sqlite3/deps/**",
    "!**/node_modules/better-sqlite3/src/**",
    "!**/node_modules/better-sqlite3/build/Release/obj/**",
    "!**/node_modules/better-sqlite3/build/Release/obj.target/**"
  ],
  protocols: [
    {
      name: "HyperText Transfer Protocol",
      schemes: ["http", "https"]
    }
  ],
  fileAssociations: [
    {
      ext: "htm",
      name: "HyperText Markup File",
      role: "Viewer"
    },
    {
      ext: "html",
      description: "HTML Document",
      role: "Viewer"
    },
    {
      ext: "mhtml",
      description: "MHTML Document",
      role: "Viewer"
    },
    {
      ext: "shtml",
      name: "HyperText Markup File",
      role: "Viewer"
    },
    {
      ext: "xhtml",
      name: "Extensible HyperText Markup File",
      role: "Viewer"
    },
    {
      ext: "xhtm",
      name: "Extensible HyperText Markup File",
      role: "Viewer"
    },
    {
      ext: "pdf",
      description: "PDF Document",
      role: "Viewer"
    }
  ],
  asarUnpack: ["assets/**", "node_modules/@img/**"],
  extraResources: [
    {
      from: "drizzle",
      to: "drizzle"
    }
  ],
  win: {
    executableName: "lumi",
    artifactName: "Lumi-v${version}-win-${arch}.${ext}",
    verifyUpdateCodeSignature: false
  },
  nsis: {
    artifactName: "Lumi-v${version}-setup.${ext}",
    shortcutName: "${productName}",
    uninstallDisplayName: "${productName}",
    createDesktopShortcut: "always"
  },
  mac: {
    artifactName: "Lumi-v${version}-${arch}-mac.${ext}",
    category: "public.app-category.productivity",
    entitlements: "./build/entitlements.mac.plist",
    notarize: Boolean(process.env.APPLE_API_KEY_DATA || process.env.APPLE_ID || process.env.APPLE_API_KEY),
    ...(process.env.CSC_LINK || process.env.CSC_NAME || process.env.CSC_KEY_PASSWORD
      ? { provisioningProfile: "build/profile.provisionprofile" }
      : { identity: null }),
    binaries: ["Contents/PlugIns/DockTilePlugIn.plugin"],
    extendInfo: {
      CFBundleIconName: "AppIcon",
      NSUserActivityTypes: ["NSUserActivityTypeBrowsingWeb"],
      NSDockTilePlugIn: "DockTilePlugIn.plugin"
    }
  },
  dmg: {
    artifactName: "Lumi-v${version}-${arch}.${ext}",
    background: "./build/dmg-background.tiff",
    icon: "./build/icon.icns"
  },
  linux: {
    target: ["AppImage", "deb"],
    category: "Network;WebBrowser;",
    executableArgs: ["--ozone-platform-hint=auto"],
    icon: "icon.png"
  },
  appImage: {
    artifactName: "Lumi-v${version}-${arch}.${ext}"
  },
  npmRebuild: false,
  publish: {
    provider: "github",
    owner: "edgarasb-dev",
    repo: "lumi-browser",
    releaseType: "prerelease"
  },
  electronDist: "node_modules/electron/dist",
  afterPack: "./build/hooks/afterPack.js",
  afterSign: "./build/hooks/afterSign.js"
};

export default electronBuilderConfig;
