import { registerLumiProtocol } from "./_protocols/lumi";
import { registerLumiInternalProtocol } from "./_protocols/lumi-internal";
import { registerLumiExternalProtocol } from "./_protocols/lumi-external";
import { protocol, Session } from "electron";
import type { CustomProtocol } from "./types";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "lumi",
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: false,
      allowServiceWorkers: false,
      supportFetchAPI: false,
      corsEnabled: true,
      stream: false,
      codeCache: true
    }
  },
  {
    scheme: "lumi-internal",
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: false,
      allowServiceWorkers: false,
      supportFetchAPI: false,
      corsEnabled: true,
      stream: false,
      codeCache: true
    }
  },
  {
    scheme: "lumi-external",
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: false,
      allowServiceWorkers: false,
      supportFetchAPI: false,
      corsEnabled: true,
      stream: true,
      codeCache: true
    }
  }
]);

// Register protocols for normal sessions
export function registerProtocolsWithSession(session: Session, protocols: CustomProtocol[]) {
  const protocol = session.protocol;

  if (protocols.includes("lumi")) {
    registerLumiProtocol(protocol);
  }
  if (protocols.includes("lumi-internal")) {
    registerLumiInternalProtocol(protocol);
  }
  if (protocols.includes("lumi-external")) {
    registerLumiExternalProtocol(protocol);
  }
}
