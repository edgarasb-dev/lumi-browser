import type { StaticDomainInfo } from "./types";

export const STATIC_DOMAINS: StaticDomainInfo[] = [
  // lumi-internal
  {
    protocol: "lumi-internal",
    hostname: "main-ui",
    actual: {
      type: "route",
      route: "main-ui"
    }
  },
  {
    protocol: "lumi-internal",
    hostname: "popup-ui",
    actual: {
      type: "route",
      route: "popup-ui"
    }
  },
  {
    protocol: "lumi-internal",
    hostname: "settings",
    actual: {
      type: "route",
      route: "settings"
    }
  },
  {
    protocol: "lumi-internal",
    hostname: "omnibox",
    actual: {
      type: "route",
      route: "omnibox"
    }
  },
  {
    protocol: "lumi-internal",
    hostname: "onboarding",
    actual: {
      type: "route",
      route: "onboarding"
    }
  },

  // lumi
  {
    protocol: "lumi",
    hostname: "new-tab",
    actual: {
      type: "route",
      route: "new-tab"
    }
  },
  {
    protocol: "lumi",
    hostname: "error",
    actual: {
      type: "route",
      route: "error"
    }
  },
  {
    protocol: "lumi",
    hostname: "about",
    actual: {
      type: "route",
      route: "about"
    }
  },
  {
    protocol: "lumi",
    hostname: "games",
    actual: {
      type: "route",
      route: "games"
    }
  },
  {
    protocol: "lumi",
    hostname: "omnibox",
    actual: {
      type: "route",
      route: "omnibox-debug"
    }
  },
  {
    protocol: "lumi",
    hostname: "extensions",
    actual: {
      type: "route",
      route: "extensions"
    }
  },
  {
    protocol: "lumi",
    hostname: "history",
    actual: {
      type: "route",
      route: "history"
    }
  },
  {
    protocol: "lumi",
    hostname: "bangs",
    actual: {
      type: "route",
      route: "bangs"
    }
  },
  {
    protocol: "lumi",
    hostname: "pdf-viewer",
    actual: {
      type: "route",
      route: "pdf-viewer"
    }
  },

  // lumi-external
  {
    protocol: "lumi-external",
    // Dino Game - Taken from https://github.com/yell0wsuit/chrome-dino-enhanced
    hostname: "dino.chrome.game",
    actual: {
      type: "subdirectory",
      subdirectory: "chrome-dino-game"
    }
  },
  {
    protocol: "lumi-external",
    // Surf Game (v1) - Taken From https://github.com/yell0wsuit/ms-edge-letssurf
    hostname: "v1.surf.edge.game",
    actual: {
      type: "subdirectory",
      subdirectory: "edge-surf-game-v1"
    }
  },
  {
    protocol: "lumi-external",
    // Surf Game (v2) - Taken from https://github.com/yell0wsuit/ms-edge-surf-2
    hostname: "v2.surf.edge.game",
    actual: {
      type: "subdirectory",
      subdirectory: "edge-surf-game-v2"
    }
  }
];
