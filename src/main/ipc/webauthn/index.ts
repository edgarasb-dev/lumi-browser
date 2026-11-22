import { getWebauthnAddon } from "@/ipc/webauthn/module";
import { isPublicSuffix } from "@/ipc/webauthn/psl-check";
import { BrowserWindow, ipcMain, type IpcMainInvokeEvent, type IpcMainEvent } from "electron";
import type {
  AssertCredentialErrorCodes,
  AssertCredentialResult,
  CreateCredentialErrorCodes,
  CreateCredentialResult
} from "~/types/fido2-types";
import type { WebauthnSupportMode } from "~/types/passkey";
import "./conditional";

/**
 * Convert a BufferSource (ArrayBuffer | ArrayBufferView) to a Node/Bun Buffer.
 * Zero-copy when possible (shares memory with the underlying ArrayBuffer).
 */
export function bufferSourceToBuffer(src: BufferSource): Buffer {
  if (Buffer.isBuffer(src)) return src;

  // ArrayBuffer / SharedArrayBuffer
  if (src instanceof ArrayBuffer || (typeof SharedArrayBuffer !== "undefined" && src instanceof SharedArrayBuffer)) {
    return Buffer.from(src);
  }

  // ArrayBufferView: Uint8Array, DataView, etc.
  // (DataView is also an ArrayBufferView)
  if (ArrayBuffer.isView(src)) {
    return Buffer.from(src.buffer, src.byteOffset, src.byteLength);
  }

  throw new TypeError("Expected BufferSource (ArrayBuffer or ArrayBufferView)");
}

ipcMain.handle(
  "webauthn:create",
  async (
    event,
    options: CredentialCreationOptions | undefined
  ): Promise<CreateCredentialResult | CreateCredentialErrorCodes | null> => {
    const webauthn = await getWebauthnAddon();
    if (!webauthn) {
      return "NotSupportedError";
    }

    if (!options) {
      return null;
    }

    const publicKeyOptions = options.publicKey;

    const senderFrame = event.senderFrame;
    if (!senderFrame) {
      return null;
    }

    const topFrame = senderFrame.top;
    if (!topFrame) {
      // Some weird case where the top frame is not available, its unsafe to continue
      return null;
    }

    const currentOrigin = senderFrame.origin;
    if (!currentOrigin) {
      return null;
    }

    const isMainFrame = topFrame === senderFrame;
    let topFrameOrigin: string | undefined;
    if (!isMainFrame) {
      topFrameOrigin = topFrame.origin;
    }

    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      return null;
    }

    const result = await webauthn.createCredential(publicKeyOptions, {
      currentOrigin,
      topFrameOrigin,
      isPublicSuffix,
      nativeWindowHandle: win.getNativeWindowHandle()
    });

    if (result.success === false) {
      return result.error;
    }

    // types error in electron-webauthn (TODO: fix this)
    // result.data.extensions.prf.first should be `string`, but its `string | undefined` in the package types
    return result.data as CreateCredentialResult;
  }
);

export async function handleGetCredential(
  event: IpcMainInvokeEvent | IpcMainEvent,
  options: CredentialRequestOptions | undefined
): Promise<AssertCredentialResult | AssertCredentialErrorCodes | null> {
  const webauthn = await getWebauthnAddon();
  if (!webauthn) {
    return "NotSupportedError";
  }

  if (!options) {
    return null;
  }

  const publicKeyOptions = options.publicKey;

  // Conditional mediation handled by `webauthn/conditional.ts`, this should never happen
  if (options.mediation === "conditional") {
    return "NotSupportedError";
  }

  const senderFrame = event.senderFrame;
  if (!senderFrame) {
    return null;
  }

  const topFrame = senderFrame.top;
  if (!topFrame) {
    // Some weird case where the top frame is not available, its unsafe to continue
    return null;
  }

  const currentOrigin = senderFrame.origin;
  if (!currentOrigin) {
    return null;
  }

  const isMainFrame = topFrame === senderFrame;
  let topFrameOrigin: string | undefined;
  if (!isMainFrame) {
    topFrameOrigin = topFrame.origin;
  }

  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    return null;
  }

  const result = await webauthn.getCredential(publicKeyOptions, {
    currentOrigin,
    topFrameOrigin,
    isPublicSuffix,
    nativeWindowHandle: win.getNativeWindowHandle()
  });

  if (result.success === false) {
    return result.error;
  }

  return {
    ...result.data,
    userHandle: result.data.userHandle ?? ""
  };
}

ipcMain.handle("webauthn:get", async (event, options: CredentialRequestOptions | undefined) => {
  return handleGetCredential(event, options);
});

ipcMain.handle("webauthn:is-available", async (): Promise<boolean> => {
  const webauthn = await getWebauthnAddon();
  return Boolean(webauthn);
});

ipcMain.handle("webauthn:get-support-mode", async (): Promise<WebauthnSupportMode> => {
  const webauthn = await getWebauthnAddon();
  if (webauthn) {
    return "macos-native";
  }

  // Unentitled Electron macOS builds cannot access Apple AuthenticationServices
  // passkey APIs and Electron has no built-in Chrome WebAuthn modal delegate on macOS.
  if (process.platform === "darwin") {
    return "unsupported";
  }

  return "chromium";
});
