export type ConditionalPasskeyRequestState = "started" | "processing";

export interface ConditionalPasskeyRequest {
  operationId: string;
  rpId: string;
  tabId: number | null;
  state: ConditionalPasskeyRequestState;
}

export type PasskeyAuthorizationStatus = "authorized" | "denied" | "notDetermined";

export type WebauthnSupportMode = "macos-native" | "chromium" | "unsupported";

export type PasskeyCredential = {
  id: string;
  rpId: string;
  userName: string;
  userHandle: string;
};
