import fs from "fs/promises";
import os from "os";
import path from "path";
import type { BrowserDefinition } from "./types";

const HOME = os.homedir();
const MAC_APP_SUPPORT = path.join(HOME, "Library", "Application Support");
const MAC_LIB = path.join(HOME, "Library");
const WIN_LOCAL = process.env.LOCALAPPDATA || path.join(HOME, "AppData", "Local");
const WIN_ROAMING = process.env.APPDATA || path.join(HOME, "AppData", "Roaming");
const LINUX_CONFIG = process.env.XDG_CONFIG_HOME || path.join(HOME, ".config");
const LINUX_FLATPAK = path.join(HOME, ".var", "app");

export const BROWSER_REGISTRY: BrowserDefinition[] = [
  // --- Apple & WebKit Family ---
  {
    id: "safari",
    name: "Safari",
    family: "safari",
    paths: {
      darwin: [path.join(MAC_LIB, "Safari")]
    }
  },
  {
    id: "safari-tp",
    name: "Safari Technology Preview",
    family: "safari",
    paths: {
      darwin: [path.join(MAC_LIB, "SafariTechnologyPreview")]
    }
  },
  {
    id: "orion",
    name: "Orion",
    family: "orion",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Orion", "Defaults"), path.join(MAC_APP_SUPPORT, "Orion")]
    }
  },
  {
    id: "duckduckgo",
    name: "DuckDuckGo",
    family: "duckduckgo",
    paths: {
      darwin: [
        path.join(
          MAC_LIB,
          "Containers",
          "com.duckduckgo.macos.browser",
          "Data",
          "Library",
          "Application Support",
          "DuckDuckGo"
        )
      ],
      win32: [path.join(WIN_LOCAL, "Packages", "DuckDuckGo.DesktopBrowser_*", "LocalState", "EBWebView")]
    }
  },

  // --- Chromium Family ---
  {
    id: "chrome",
    name: "Google Chrome",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Google", "Chrome")],
      win32: [path.join(WIN_LOCAL, "Google", "Chrome", "User Data")],
      linux: [
        path.join(LINUX_CONFIG, "google-chrome"),
        path.join(LINUX_FLATPAK, "com.google.Chrome", "config", "google-chrome")
      ]
    }
  },
  {
    id: "chrome-beta",
    name: "Google Chrome Beta",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Google", "Chrome Beta")],
      win32: [path.join(WIN_LOCAL, "Google", "Chrome Beta", "User Data")],
      linux: [path.join(LINUX_CONFIG, "google-chrome-beta")]
    }
  },
  {
    id: "chrome-dev",
    name: "Google Chrome Dev",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Google", "Chrome Dev")],
      win32: [path.join(WIN_LOCAL, "Google", "Chrome Dev", "User Data")],
      linux: [path.join(LINUX_CONFIG, "google-chrome-unstable")]
    }
  },
  {
    id: "chrome-canary",
    name: "Google Chrome Canary",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Google", "Chrome Canary")],
      win32: [path.join(WIN_LOCAL, "Google", "Chrome SxS", "User Data")]
    }
  },
  {
    id: "arc",
    name: "Arc",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Arc", "User Data")],
      win32: [
        path.join(WIN_LOCAL, "Packages", "TheBrowserCompany.Arc_*", "LocalCache", "Local", "Arc", "User Data"),
        path.join(WIN_LOCAL, "Arc", "User Data")
      ]
    }
  },
  {
    id: "dia",
    name: "Dia",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Dia", "User Data")],
      win32: [path.join(WIN_LOCAL, "Dia", "User Data")]
    }
  },
  {
    id: "comet",
    name: "Perplexity Comet",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Comet")],
      win32: [path.join(WIN_LOCAL, "Perplexity", "Comet", "User Data"), path.join(WIN_LOCAL, "Comet", "User Data")]
    }
  },
  {
    id: "atlas",
    name: "ChatGPT Atlas",
    family: "chromium",
    paths: {
      darwin: [
        path.join(MAC_APP_SUPPORT, "com.openai.atlas", "browser-data", "host"),
        path.join(MAC_APP_SUPPORT, "com.openai.atlas"),
        path.join(MAC_APP_SUPPORT, "OpenAI", "Atlas")
      ]
    }
  },
  {
    id: "brave",
    name: "Brave",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "BraveSoftware", "Brave-Browser")],
      win32: [path.join(WIN_LOCAL, "BraveSoftware", "Brave-Browser", "User Data")],
      linux: [
        path.join(LINUX_CONFIG, "BraveSoftware", "Brave-Browser"),
        path.join(LINUX_FLATPAK, "com.brave.Browser", "config", "BraveSoftware", "Brave-Browser")
      ]
    }
  },
  {
    id: "brave-beta",
    name: "Brave Beta",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "BraveSoftware", "Brave-Browser-Beta")],
      win32: [path.join(WIN_LOCAL, "BraveSoftware", "Brave-Browser-Beta", "User Data")],
      linux: [path.join(LINUX_CONFIG, "BraveSoftware", "Brave-Browser-Beta")]
    }
  },
  {
    id: "brave-nightly",
    name: "Brave Nightly",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "BraveSoftware", "Brave-Browser-Nightly")],
      win32: [path.join(WIN_LOCAL, "BraveSoftware", "Brave-Browser-Nightly", "User Data")],
      linux: [path.join(LINUX_CONFIG, "BraveSoftware", "Brave-Browser-Nightly")]
    }
  },
  {
    id: "edge",
    name: "Microsoft Edge",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Microsoft Edge")],
      win32: [path.join(WIN_LOCAL, "Microsoft", "Edge", "User Data")],
      linux: [
        path.join(LINUX_CONFIG, "microsoft-edge"),
        path.join(LINUX_FLATPAK, "com.microsoft.Edge", "config", "microsoft-edge")
      ]
    }
  },
  {
    id: "edge-beta",
    name: "Microsoft Edge Beta",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Microsoft Edge Beta")],
      win32: [path.join(WIN_LOCAL, "Microsoft", "Edge Beta", "User Data")],
      linux: [path.join(LINUX_CONFIG, "microsoft-edge-beta")]
    }
  },
  {
    id: "edge-dev",
    name: "Microsoft Edge Dev",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Microsoft Edge Dev")],
      win32: [path.join(WIN_LOCAL, "Microsoft", "Edge Dev", "User Data")],
      linux: [path.join(LINUX_CONFIG, "microsoft-edge-dev")]
    }
  },
  {
    id: "edge-canary",
    name: "Microsoft Edge Canary",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Microsoft Edge Canary")],
      win32: [path.join(WIN_LOCAL, "Microsoft", "Edge SxS", "User Data")]
    }
  },
  {
    id: "vivaldi",
    name: "Vivaldi",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Vivaldi")],
      win32: [path.join(WIN_LOCAL, "Vivaldi", "User Data")],
      linux: [path.join(LINUX_CONFIG, "vivaldi"), path.join(LINUX_FLATPAK, "com.vivaldi.Vivaldi", "config", "vivaldi")]
    }
  },
  {
    id: "opera",
    name: "Opera",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "com.operasoftware.Opera")],
      win32: [path.join(WIN_ROAMING, "Opera Software", "Opera Stable")],
      linux: [path.join(LINUX_CONFIG, "opera"), path.join(LINUX_FLATPAK, "com.opera.Opera", "config", "opera")]
    }
  },
  {
    id: "opera-gx",
    name: "Opera GX",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "com.operasoftware.OperaGX")],
      win32: [path.join(WIN_ROAMING, "Opera Software", "Opera GX Stable")]
    }
  },
  {
    id: "opera-air",
    name: "Opera Air",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "com.operasoftware.OperaAir")],
      win32: [path.join(WIN_ROAMING, "Opera Software", "Opera Air Stable")]
    }
  },
  {
    id: "chromium",
    name: "Chromium",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Chromium")],
      win32: [path.join(WIN_LOCAL, "Chromium", "User Data")],
      linux: [
        path.join(LINUX_CONFIG, "chromium"),
        path.join(HOME, "snap", "chromium", "common", "chromium"),
        path.join(LINUX_FLATPAK, "org.chromium.Chromium", "config", "chromium")
      ]
    }
  },
  {
    id: "helium",
    name: "Helium",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "net.imput.helium"), path.join(MAC_APP_SUPPORT, "Helium")],
      win32: [path.join(WIN_LOCAL, "imput", "Helium", "User Data"), path.join(WIN_LOCAL, "Helium", "User Data")],
      linux: [path.join(LINUX_CONFIG, "net.imput.helium"), path.join(LINUX_CONFIG, "helium")]
    }
  },
  {
    id: "thorium",
    name: "Thorium",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Thorium")],
      win32: [path.join(WIN_LOCAL, "Thorium", "User Data")],
      linux: [path.join(LINUX_CONFIG, "thorium")]
    }
  },
  {
    id: "ungoogled-chromium",
    name: "Ungoogled Chromium",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Ungoogled Chromium")],
      win32: [path.join(WIN_LOCAL, "ungoogled-chromium", "User Data")],
      linux: [
        path.join(LINUX_CONFIG, "ungoogled-chromium"),
        path.join(LINUX_FLATPAK, "io.github.ungoogled_software.ungoogled_chromium", "config", "chromium")
      ]
    }
  },
  {
    id: "whale",
    name: "Naver Whale",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Naver", "Whale")],
      win32: [path.join(WIN_LOCAL, "Naver", "Naver Whale", "User Data")],
      linux: [path.join(LINUX_CONFIG, "naver-whale")]
    }
  },
  {
    id: "yandex",
    name: "Yandex Browser",
    family: "chromium",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Yandex", "YandexBrowser")],
      win32: [path.join(WIN_LOCAL, "Yandex", "YandexBrowser", "User Data")],
      linux: [path.join(LINUX_CONFIG, "yandex-browser")]
    }
  },

  // --- Gecko / Firefox Family ---
  {
    id: "firefox",
    name: "Mozilla Firefox",
    family: "gecko",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Firefox")],
      win32: [path.join(WIN_ROAMING, "Mozilla", "Firefox")],
      linux: [
        path.join(HOME, ".mozilla", "firefox"),
        path.join(HOME, "snap", "firefox", "common", ".mozilla", "firefox"),
        path.join(LINUX_FLATPAK, "org.mozilla.firefox", ".mozilla", "firefox")
      ]
    }
  },
  {
    id: "zen",
    name: "Zen Browser",
    family: "gecko",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "zen"), path.join(MAC_APP_SUPPORT, "Zen")],
      win32: [path.join(WIN_ROAMING, "zen")],
      linux: [
        path.join(HOME, ".zen"),
        path.join(LINUX_FLATPAK, "app.zen_browser.zen", ".zen"),
        path.join(LINUX_FLATPAK, "io.github.zen_browser.zen", ".zen")
      ]
    }
  },
  {
    id: "librewolf",
    name: "LibreWolf",
    family: "gecko",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "LibreWolf"), path.join(MAC_APP_SUPPORT, "librewolf")],
      win32: [path.join(WIN_ROAMING, "librewolf"), path.join(WIN_ROAMING, "LibreWolf")],
      linux: [path.join(HOME, ".librewolf"), path.join(LINUX_FLATPAK, "io.gitlab.librewolf-community", ".librewolf")]
    }
  },
  {
    id: "waterfox",
    name: "Waterfox",
    family: "gecko",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Waterfox")],
      win32: [path.join(WIN_ROAMING, "Waterfox")],
      linux: [path.join(HOME, ".waterfox"), path.join(LINUX_FLATPAK, "net.waterfox.waterfox", ".waterfox")]
    }
  },
  {
    id: "floorp",
    name: "Floorp",
    family: "gecko",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Floorp")],
      win32: [path.join(WIN_ROAMING, "Floorp")],
      linux: [path.join(HOME, ".floorp"), path.join(LINUX_FLATPAK, "one.ablaze.floorp", ".floorp")]
    }
  },
  {
    id: "mullvad",
    name: "Mullvad Browser",
    family: "gecko",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Mullvad", "MullvadBrowser")],
      win32: [path.join(WIN_ROAMING, "Mullvad", "MullvadBrowser")],
      linux: [path.join(HOME, ".mullvad", "mullvadbrowser")]
    }
  },
  {
    id: "tor",
    name: "Tor Browser",
    family: "gecko",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "TorBrowser-Data", "Browser")],
      win32: [
        path.join(WIN_LOCAL, "Tor Browser", "Browser", "TorBrowser", "Data", "Browser"),
        path.join(HOME, "Desktop", "Tor Browser", "Browser", "TorBrowser", "Data", "Browser")
      ],
      linux: [
        path.join(
          HOME,
          ".local",
          "share",
          "torbrowser",
          "tbb",
          "x86_64",
          "tor-browser",
          "Browser",
          "TorBrowser",
          "Data",
          "Browser"
        ),
        path.join(HOME, "tor-browser", "Browser", "TorBrowser", "Data", "Browser")
      ]
    }
  },

  // --- Electron / Flow Browser ---
  {
    id: "flow",
    name: "Flow Browser",
    family: "flow",
    paths: {
      darwin: [path.join(MAC_APP_SUPPORT, "Flow"), path.join(MAC_APP_SUPPORT, "flow-browser")],
      win32: [path.join(WIN_ROAMING, "Flow"), path.join(WIN_ROAMING, "flow-browser")],
      linux: [path.join(LINUX_CONFIG, "Flow"), path.join(LINUX_CONFIG, "flow-browser")]
    }
  }
];

/**
 * Expands wildcards (such as Windows UWP package suffixes like `TheBrowserCompany.Arc_*`)
 * into concrete filesystem paths that currently exist on disk.
 */
export async function resolveBrowserRootDirs(def: BrowserDefinition): Promise<string[]> {
  const platformKey = process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "win32" : "linux";
  const templates = def.paths[platformKey] ?? [];
  const resolved: string[] = [];

  for (const templatePath of templates) {
    if (!templatePath.includes("*")) {
      resolved.push(templatePath);
      continue;
    }

    const parts = templatePath.split(path.sep);
    const wildcardIdx = parts.findIndex((part) => part.includes("*"));
    if (wildcardIdx <= 0) continue;

    const baseDir = parts.slice(0, wildcardIdx).join(path.sep) || path.sep;
    const prefix = parts[wildcardIdx].split("*")[0];
    const suffixParts = parts.slice(wildcardIdx + 1);

    try {
      const entries = await fs.readdir(baseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith(prefix)) {
          resolved.push(path.join(baseDir, entry.name, ...suffixParts));
        }
      }
    } catch {
      // ignore inaccessible package directories
    }
  }

  return resolved;
}
