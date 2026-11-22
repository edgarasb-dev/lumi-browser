import { ipcRenderer, contextBridge, type IpcRendererEvent } from "electron";
import { generateID } from "../utils";

import type {
  AssertCredentialErrorCodes,
  AssertCredentialResult,
  CreateCredentialErrorCodes,
  CreateCredentialResult
} from "~/types/fido2-types";
import type { WebauthnSupportMode } from "~/types/passkey";
import { WebauthnUtils } from "./webauthn-utils";

let hasConditionalMediationLock = false;

async function handleConditionalMediation(options: CredentialRequestOptions) {
  if (hasConditionalMediationLock) {
    return "OperationError";
  }
  hasConditionalMediationLock = true;

  const operationId = generateID();
  const publicKeyRequestOptions = options.publicKey;
  ipcRenderer.send("webauthn:start-conditional-mediation", operationId, publicKeyRequestOptions);

  const { resolve, promise } = Promise.withResolvers<AssertCredentialResult | AssertCredentialErrorCodes | null>();

  const abortSignal = options.signal;
  if (abortSignal) {
    const onAbort = () => {
      ipcRenderer.send("webauthn:cancel-conditional-mediation", operationId);
      resolve("AbortError");
    };

    if (abortSignal.aborted) {
      onAbort();
    } else {
      try {
        abortSignal.addEventListener("abort", onAbort, { once: true });
      } catch (error) {
        console.error("error adding abort listener", error);
      }
    }
  }

  const onConditionalMediationResult = (
    _event: IpcRendererEvent,
    opId: string,
    result: AssertCredentialResult | AssertCredentialErrorCodes | null
  ) => {
    if (opId !== operationId) {
      return;
    }
    resolve(result);
  };
  ipcRenderer.on("webauthn:conditional-mediation-result", onConditionalMediationResult);

  // Cleanup when the promise is resolved or rejected
  promise.finally(() => {
    hasConditionalMediationLock = false;
    ipcRenderer.off("webauthn:conditional-mediation-result", onConditionalMediationResult);
  });
  return await promise;
}

const abortControllers = new Map<string, AbortController>();
function createAbortSignal(abortId?: string) {
  if (typeof abortId !== "string") return null;

  const abortController = new AbortController();
  const abortSignal = abortController.signal;
  abortControllers.set(abortId, abortController);
  return abortSignal;
}

export function tryPatchPasskeys() {
  const SHOULD_PATCH_PASSKEYS = "navigator" in globalThis && "credentials" in globalThis.navigator;
  if (SHOULD_PATCH_PASSKEYS) {
    type PatchedCredentialsContainer = Pick<CredentialsContainer, "create"> & {
      get: (
        options: CredentialRequestOptions,
        abortId?: string
      ) => Promise<AssertCredentialErrorCodes | PublicKeyCredential | null>;
      abort: (abortId: string) => void;

      isAvailable: () => Promise<boolean>;
      getSupportMode: () => Promise<WebauthnSupportMode>;
      isConditionalMediationAvailable: () => Promise<boolean>;
    };

    let isWebauthnAddonAvailablePromise: Promise<boolean> | null = null;
    let webauthnSupportModePromise: Promise<WebauthnSupportMode> | null = null;

    const patchedCredentialsContainer: PatchedCredentialsContainer = {
      // @ts-expect-error: just not gonna bother with the error types
      create: async (options) => {
        const serialized: CreateCredentialResult | CreateCredentialErrorCodes | null = await ipcRenderer.invoke(
          "webauthn:create",
          options
        );

        if (!serialized) return null;
        if (typeof serialized === "string") {
          return serialized;
        }

        const publicKeyCredential = WebauthnUtils.mapCredentialRegistrationResult(serialized);
        return publicKeyCredential;
      },
      get: async (options, abortId?: string) => {
        const abortSignal = createAbortSignal(abortId);
        if (abortSignal) {
          options.signal = abortSignal;
        }

        let serialized: AssertCredentialResult | AssertCredentialErrorCodes | null;
        if (options && options.mediation === "conditional") {
          serialized = await handleConditionalMediation(options);
        } else {
          serialized = await ipcRenderer.invoke("webauthn:get", options);
        }

        if (abortId) {
          abortControllers.delete(abortId);
        }

        if (!serialized) return null;
        if (typeof serialized === "string") {
          return serialized;
        }

        const publicKeyCredential = WebauthnUtils.mapCredentialAssertResult(serialized);
        return publicKeyCredential;
      },
      abort: (abortId: string) => {
        const abortController = abortControllers.get(abortId);
        if (abortController) {
          abortController.abort();
          abortControllers.delete(abortId);
        }
      },
      isAvailable: async () => {
        if (isWebauthnAddonAvailablePromise) {
          return isWebauthnAddonAvailablePromise;
        }
        isWebauthnAddonAvailablePromise = ipcRenderer.invoke("webauthn:is-available");
        return isWebauthnAddonAvailablePromise;
      },
      getSupportMode: async () => {
        if (webauthnSupportModePromise) {
          return webauthnSupportModePromise;
        }
        webauthnSupportModePromise = ipcRenderer.invoke("webauthn:get-support-mode");
        return webauthnSupportModePromise;
      },
      isConditionalMediationAvailable: async () => {
        return true;
      }
    };
    contextBridge.exposeInMainWorld("electronCredentials", patchedCredentialsContainer);

    const tinyPasskeysScript = () => {
      if ("electronCredentials" in globalThis) {
        const patchedCredentials: typeof patchedCredentialsContainer = globalThis.electronCredentials;

        let supportModeCached: WebauthnSupportMode | null = null;
        let supportModePromise: Promise<WebauthnSupportMode> | null = null;

        function getSupportMode(): Promise<WebauthnSupportMode> {
          if (supportModeCached !== null) {
            return Promise.resolve(supportModeCached);
          }
          if (!supportModePromise) {
            supportModePromise = patchedCredentials
              .getSupportMode()
              .then((mode) => {
                supportModeCached = mode;
                return mode;
              })
              .catch(() => {
                supportModePromise = null;
                return "unsupported" as WebauthnSupportMode;
              });
          }
          return supportModePromise;
        }

        function throwWebauthnError(errorCode: CreateCredentialErrorCodes | AssertCredentialErrorCodes): never {
          switch (errorCode) {
            case "NotAllowedError":
              // Mirror Chromium's error message.
              throw new DOMException(
                "The operation either timed out or was not allowed. See: https://www.w3.org/TR/webauthn-2/#sctn-privacy-considerations-client.",
                "NotAllowedError"
              );
            case "SecurityError":
              throw new DOMException("The calling domain is not a valid domain.", "SecurityError");
            case "TypeError":
              throw new DOMException("Failed to parse arguments.", "TypeError");
            case "AbortError":
              throw new DOMException("The operation was aborted.", "AbortError");
            case "NotSupportedError":
              throw new DOMException("The user agent does not support this operation.", "NotSupportedError");
            case "InvalidStateError":
              throw new DOMException(
                "The user attempted to register an authenticator that contains one of the credentials already registered with the relying party.",
                "InvalidStateError"
              );
            case "OperationError":
              throw new DOMException("A request is already pending.", "OperationError");
          }
        }

        if ("navigator" in globalThis && "credentials" in globalThis.navigator) {
          const credentials = globalThis.navigator.credentials;
          const oldCredentialsCreate = credentials.create.bind(credentials);
          const oldCredentialsGet = credentials.get.bind(credentials);

          // navigator.credentials.create()
          credentials.create = async (options) => {
            if (options?.publicKey) {
              const mode = await getSupportMode();
              if (mode === "macos-native") {
                const result = await patchedCredentials.create(options);
                if (typeof result === "string") {
                  throwWebauthnError(result);
                }
                return result;
              }
              if (mode === "unsupported") {
                if (options.signal?.aborted) {
                  throwWebauthnError("AbortError");
                }
                throwWebauthnError("NotSupportedError");
              }
            }

            return await oldCredentialsCreate(options);
          };

          // navigator.credentials.get()
          credentials.get = async (options) => {
            if (options?.publicKey) {
              const mode = await getSupportMode();
              if (mode === "macos-native") {
                // Generate abort ID and run `patchedCredentials.get()`
                const abortId = crypto.randomUUID();
                const getPromise = patchedCredentials.get(options, abortId);

                // Handle abort signal
                const abortSignal = options.signal;
                if (abortSignal) {
                  const onAbort = () => {
                    patchedCredentials.abort(abortId);
                  };

                  try {
                    if (abortSignal.aborted) {
                      onAbort();
                    } else {
                      abortSignal.addEventListener("abort", onAbort, { once: true });
                    }
                  } catch (error) {
                    console.error("error adding abort listener", error);
                  }
                }

                // Wait for the operation to resolve
                const result = await getPromise;
                if (typeof result === "string") {
                  throwWebauthnError(result);
                }
                return result as PublicKeyCredential | null;
              }
              if (mode === "unsupported") {
                if (options.signal?.aborted) {
                  throwWebauthnError("AbortError");
                }
                throwWebauthnError("NotSupportedError");
              }
            }

            return await oldCredentialsGet(options);
          };
        }

        if ("PublicKeyCredential" in globalThis) {
          const PublicKeyCredentialCtor = globalThis.PublicKeyCredential as typeof PublicKeyCredential & {
            getClientCapabilities?: () => Promise<Record<string, boolean>>;
          };

          if ("isUserVerifyingPlatformAuthenticatorAvailable" in PublicKeyCredentialCtor) {
            const oldIsUserVerifyingPlatformAuthenticatorAvailable =
              PublicKeyCredentialCtor.isUserVerifyingPlatformAuthenticatorAvailable.bind(PublicKeyCredentialCtor);
            PublicKeyCredentialCtor.isUserVerifyingPlatformAuthenticatorAvailable = async () => {
              const mode = await getSupportMode();
              if (mode === "macos-native") {
                return await patchedCredentials.isAvailable();
              }
              if (mode === "unsupported") {
                return false;
              }
              return await oldIsUserVerifyingPlatformAuthenticatorAvailable();
            };
          }

          if ("isConditionalMediationAvailable" in PublicKeyCredentialCtor) {
            const oldIsConditionalMediationAvailable =
              PublicKeyCredentialCtor.isConditionalMediationAvailable.bind(PublicKeyCredentialCtor);
            PublicKeyCredentialCtor.isConditionalMediationAvailable = async () => {
              const mode = await getSupportMode();
              if (mode === "macos-native") {
                return await patchedCredentials.isConditionalMediationAvailable();
              }
              if (mode === "unsupported") {
                return false;
              }
              return await oldIsConditionalMediationAvailable();
            };
          }

          if (
            "getClientCapabilities" in PublicKeyCredentialCtor &&
            typeof PublicKeyCredentialCtor.getClientCapabilities === "function"
          ) {
            const oldGetClientCapabilities =
              PublicKeyCredentialCtor.getClientCapabilities.bind(PublicKeyCredentialCtor);
            PublicKeyCredentialCtor.getClientCapabilities = async () => {
              const mode = await getSupportMode();
              const caps = await oldGetClientCapabilities();
              if (mode === "unsupported") {
                return {
                  ...caps,
                  conditionalCreate: false,
                  conditionalGet: false,
                  hybridTransport: false,
                  immediateGet: false,
                  passkeyPlatformAuthenticator: false,
                  userVerifyingPlatformAuthenticator: false
                };
              }
              return caps;
            };
          }
        }

        delete globalThis.electronCredentials;
      }
    };
    contextBridge.executeInMainWorld({
      func: tinyPasskeysScript
    });
    return true;
  }
  return false;
}
