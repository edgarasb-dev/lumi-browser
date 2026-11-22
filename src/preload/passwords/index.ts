import { ipcRenderer } from "electron";
import type { FilledCredentialPayload, SiteAutofillSuggestionsResult, SiteCredentialMatch } from "~/types/passwords";

let patched = false;

function isWebHttpPage(): boolean {
  try {
    return window.location.protocol === "http:" || window.location.protocol === "https:";
  } catch {
    return false;
  }
}

function isElementVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function isPasswordField(el: EventTarget | null): boolean {
  return (
    el instanceof HTMLInputElement &&
    el.type.toLowerCase() === "password" &&
    !el.readOnly &&
    !el.disabled &&
    el.autocomplete !== "off"
  );
}

function getNearbyRoot(el: HTMLElement): HTMLElement {
  if (el instanceof HTMLInputElement && el.form) return el.form;
  let cur: HTMLElement | null = el.parentElement;
  for (let depth = 0; depth < 5 && cur; depth++) {
    if (cur.querySelector('input[type="password"]')) return cur;
    cur = cur.parentElement;
  }
  return document.body ?? document.documentElement;
}

function isUsernameFieldCandidate(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLInputElement) || el.readOnly || el.disabled) return false;
  const type = el.type.toLowerCase();
  if (type !== "text" && type !== "email" && type !== "tel" && type !== "") return false;
  if (el.autocomplete === "off") return false;

  const ac = (el.autocomplete || "").toLowerCase();
  if (ac.includes("username") || ac.includes("email")) return true;

  const root = getNearbyRoot(el);
  const pw = root.querySelector('input[type="password"]');
  return pw instanceof HTMLInputElement && isElementVisible(pw);
}

function findUsernameInputFor(pwOrFormRoot: HTMLElement, anchorPassword?: HTMLInputElement): HTMLInputElement | null {
  const inputs = Array.from(pwOrFormRoot.querySelectorAll("input")).filter(
    (inp): inp is HTMLInputElement =>
      inp !== anchorPassword &&
      !inp.disabled &&
      !inp.readOnly &&
      isElementVisible(inp) &&
      ["text", "email", "tel", ""].includes(inp.type.toLowerCase())
  );

  // Prefer explicit autocomplete=username/email first
  const explicit = inputs.find((i) => {
    const ac = (i.autocomplete || "").toLowerCase();
    return ac.includes("username") || ac.includes("email");
  });
  if (explicit) return explicit;

  // Fallback to hint attributes or last text/email input appearing before anchorPassword
  const hinted = inputs.find((i) =>
    /user|email|login|account/i.test(`${i.name} ${i.id} ${i.placeholder} ${i.getAttribute("aria-label") ?? ""}`)
  );
  if (hinted) return hinted;

  if (anchorPassword) {
    const before = inputs.filter((i) =>
      Boolean(i.compareDocumentPosition(anchorPassword) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
    if (before.length > 0) return before[before.length - 1]!;
  }
  return inputs[0] ?? null;
}

function findPasswordInputFor(el: HTMLInputElement): HTMLInputElement | null {
  if (el.type.toLowerCase() === "password") return el;
  const root = getNearbyRoot(el);
  const pws = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="password"]')).filter(
    (p) => !p.disabled && !p.readOnly && isElementVisible(p)
  );
  return pws[0] ?? null;
}

function isNewPasswordContext(pw: HTMLInputElement | null): boolean {
  if (!pw) return false;
  const ac = (pw.autocomplete || "").toLowerCase();
  if (ac.includes("new-password")) return true;
  const root = getNearbyRoot(pw);
  const pwCount = root.querySelectorAll('input[type="password"]').length;
  if (pwCount >= 2) return true;
  const hint = `${pw.name} ${pw.id} ${pw.placeholder}`.toLowerCase();
  return /new|confirm|repeat|signup|register|create/.test(hint);
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export function tryPatchPasswords(): void {
  if (patched || !isWebHttpPage()) return;
  patched = true;

  let activeInput: HTMLInputElement | null = null;
  let hostEl: HTMLDivElement | null = null;
  let shadow: ShadowRoot | null = null;
  let listEl: HTMLDivElement | null = null;
  let currentCredentials: SiteCredentialMatch[] = [];
  let currentGeneratedPreview: string | null = null;
  let highlightedIndex = 0;

  let latestCandidate: {
    pwEl: HTMLInputElement | null;
    username: string;
    password: string;
  } = { pwEl: null, username: "", password: "" };
  let lastSubmittedSignature = "";
  let lastSubmittedAt = 0;

  function emitCandidate(username: string, password: string): void {
    if (!password) return;
    const trimmedUser = username.trim();
    const sig = `${trimmedUser}\u0000${password}`;
    const now = Date.now();
    if (sig === lastSubmittedSignature && now - lastSubmittedAt < 1500) {
      return;
    }
    lastSubmittedSignature = sig;
    lastSubmittedAt = now;
    ipcRenderer.send("passwords:page-candidate-submit", {
      username: trimmedUser,
      password
    });
  }

  function closePopup(): void {
    if (hostEl) {
      hostEl.style.display = "none";
    }
    activeInput = null;
    currentCredentials = [];
    currentGeneratedPreview = null;
  }

  function ensureOverlay(): ShadowRoot {
    if (shadow && hostEl && listEl) return shadow;

    hostEl = document.createElement("div");
    hostEl.setAttribute("data-lumi-pw-overlay", "true");
    hostEl.style.cssText =
      "position:fixed;z-index:2147483647;display:none;pointer-events:auto;margin:0;padding:0;border:0;background:transparent;";
    shadow = hostEl.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .card {
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
        min-width: 240px;
        max-width: 340px;
        background: rgba(255, 255, 255, 0.98);
        color: #111827;
        border: 1px solid rgba(15, 23, 42, 0.14);
        border-radius: 10px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.08);
        overflow: hidden;
        padding: 4px;
        box-sizing: border-box;
      }
      @media (prefers-color-scheme: dark) {
        .card {
          background: rgba(24, 24, 27, 0.98);
          color: #f4f4f5;
          border-color: rgba(255, 255, 255, 0.14);
          box-shadow: 0 14px 36px rgba(0, 0, 0, 0.55);
        }
      }
      .header {
        font-size: 11px;
        font-weight: 600;
        opacity: 0.6;
        padding: 5px 8px 4px;
        letter-spacing: 0.01em;
      }
      .item {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 9px;
        text-align: left;
        background: transparent;
        border: none;
        color: inherit;
        border-radius: 7px;
        padding: 7px 9px;
        cursor: pointer;
        font-size: 13px;
        box-sizing: border-box;
      }
      .item:hover, .item[data-active="true"] {
        background: rgba(99, 102, 241, 0.14);
      }
      .icon {
        width: 24px;
        height: 24px;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(99, 102, 241, 0.16);
        color: #6366f1;
        flex-shrink: 0;
        font-size: 13px;
      }
      @media (prefers-color-scheme: dark) {
        .icon {
          background: rgba(129, 140, 248, 0.2);
          color: #a5b4fc;
        }
      }
      .meta {
        min-width: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .primary {
        font-weight: 600;
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .secondary {
        font-size: 11px;
        opacity: 0.65;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11.5px;
      }
      .divider {
        height: 1px;
        background: rgba(128, 128, 128, 0.18);
        margin: 4px 6px;
      }
    `;
    const card = document.createElement("div");
    card.className = "card";
    listEl = document.createElement("div");
    card.appendChild(listEl);
    shadow.appendChild(style);
    shadow.appendChild(card);

    const mountTarget = document.documentElement ?? document.body;
    mountTarget.appendChild(hostEl);
    return shadow;
  }

  function positionOverlay(): void {
    if (!hostEl || !activeInput || hostEl.style.display === "none") return;
    if (!document.contains(activeInput) || !isElementVisible(activeInput)) {
      closePopup();
      return;
    }
    const rect = activeInput.getBoundingClientRect();
    const width = Math.max(240, Math.min(340, rect.width));
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const top = Math.min(rect.bottom + 4, window.innerHeight - 160);
    hostEl.style.left = `${Math.round(left)}px`;
    hostEl.style.top = `${Math.round(top)}px`;
    hostEl.style.width = `${Math.round(width)}px`;
  }

  async function applyCredentialFill(credentialId: string, anchor: HTMLInputElement): Promise<void> {
    const payload = (await ipcRenderer.invoke("passwords:page-fill", credentialId)) as FilledCredentialPayload | null;
    if (!payload) return;

    const pwEl = findPasswordInputFor(anchor);
    const root = pwEl ? getNearbyRoot(pwEl) : getNearbyRoot(anchor);
    const userEl = anchor.type.toLowerCase() !== "password" ? anchor : findUsernameInputFor(root, pwEl ?? undefined);

    if (userEl && payload.username) {
      setNativeInputValue(userEl, payload.username);
    }
    if (pwEl && payload.password) {
      setNativeInputValue(pwEl, payload.password);
    }
    closePopup();
  }

  async function applyGeneratedPassword(password: string, anchor: HTMLInputElement): Promise<void> {
    const pwEl = findPasswordInputFor(anchor);
    if (!pwEl) return;
    setNativeInputValue(pwEl, password);

    // Fill confirmation password input if present in same form
    const root = getNearbyRoot(pwEl);
    const allPws = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="password"]')).filter(
      (p) => !p.disabled && !p.readOnly && isElementVisible(p)
    );
    for (const extra of allPws) {
      if (extra !== pwEl) setNativeInputValue(extra, password);
    }

    const userEl = findUsernameInputFor(root, pwEl);
    latestCandidate = {
      pwEl,
      username: userEl?.value ?? "",
      password
    };
    closePopup();
  }

  function renderPopupItems(): void {
    if (!listEl || !hostEl || !activeInput) return;
    listEl.textContent = "";

    const totalItems = currentCredentials.length + (currentGeneratedPreview ? 1 : 0);
    if (totalItems === 0) {
      closePopup();
      return;
    }

    if (currentCredentials.length > 0) {
      const hdr = document.createElement("div");
      hdr.className = "header";
      hdr.textContent = "Saved Passwords";
      listEl.appendChild(hdr);

      currentCredentials.forEach((cred, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "item";
        btn.dataset.active = String(idx === highlightedIndex);

        const icon = document.createElement("span");
        icon.className = "icon";
        icon.textContent = "🔑";

        const meta = document.createElement("span");
        meta.className = "meta";

        const primary = document.createElement("span");
        primary.className = "primary";
        primary.textContent = cred.username || "(no username)";

        const secondary = document.createElement("span");
        secondary.className = "secondary";
        secondary.textContent = cred.host;

        meta.appendChild(primary);
        meta.appendChild(secondary);
        btn.appendChild(icon);
        btn.appendChild(meta);

        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (activeInput) void applyCredentialFill(cred.id, activeInput);
        });
        listEl!.appendChild(btn);
      });
    }

    if (currentGeneratedPreview) {
      if (currentCredentials.length > 0) {
        const div = document.createElement("div");
        div.className = "divider";
        listEl.appendChild(div);
      }

      const genIdx = currentCredentials.length;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "item";
      btn.dataset.active = String(genIdx === highlightedIndex);

      const icon = document.createElement("span");
      icon.className = "icon";
      icon.textContent = "✨";

      const meta = document.createElement("span");
      meta.className = "meta";

      const primary = document.createElement("span");
      primary.className = "primary";
      primary.textContent = "Use Strong Password";

      const secondary = document.createElement("span");
      secondary.className = "secondary mono";
      secondary.textContent = currentGeneratedPreview;

      meta.appendChild(primary);
      meta.appendChild(secondary);
      btn.appendChild(icon);
      btn.appendChild(meta);

      const previewVal = currentGeneratedPreview;
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeInput) void applyGeneratedPassword(previewVal, activeInput);
      });
      listEl.appendChild(btn);
    }

    hostEl.style.display = "block";
    positionOverlay();
  }

  async function handleInputFocused(target: HTMLInputElement): Promise<void> {
    const isPw = isPasswordField(target);
    const isUser = !isPw && isUsernameFieldCandidate(target);
    if (!isPw && !isUser) {
      closePopup();
      return;
    }

    const relatedPw = isPw ? target : findPasswordInputFor(target);
    const showGenerator = isPw && (isNewPasswordContext(relatedPw) || target.value.length === 0);

    const [suggestions, generated] = await Promise.all([
      ipcRenderer.invoke("passwords:page-suggestions") as Promise<SiteAutofillSuggestionsResult>,
      showGenerator ? (ipcRenderer.invoke("passwords:page-generate") as Promise<string | null>) : Promise.resolve(null)
    ]);

    if (document.activeElement !== target) return;

    const creds = suggestions.autofillEnabled ? suggestions.credentials : [];
    const shouldOfferGen =
      generated && isPw && (isNewPasswordContext(relatedPw) || creds.length === 0) ? generated : null;

    if (creds.length === 0 && !shouldOfferGen) {
      closePopup();
      return;
    }

    ensureOverlay();
    activeInput = target;
    currentCredentials = creds;
    currentGeneratedPreview = shouldOfferGen;
    highlightedIndex = 0;
    renderPopupItems();
  }

  window.addEventListener(
    "focusin",
    (e) => {
      if (e.target instanceof HTMLInputElement) {
        void handleInputFocused(e.target);
      } else {
        closePopup();
      }
    },
    true
  );

  window.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (isPasswordField(target)) {
        const root = getNearbyRoot(target);
        const userEl = findUsernameInputFor(root, target);
        latestCandidate = {
          pwEl: target,
          username: userEl?.value ?? latestCandidate.username,
          password: target.value
        };
      } else if (isUsernameFieldCandidate(target)) {
        const pwEl = findPasswordInputFor(target);
        latestCandidate = {
          pwEl: pwEl ?? latestCandidate.pwEl,
          username: target.value,
          password: pwEl?.value ?? latestCandidate.password
        };
      }
    },
    true
  );

  window.addEventListener(
    "keydown",
    (e) => {
      if (hostEl && hostEl.style.display === "block" && activeInput) {
        const total = currentCredentials.length + (currentGeneratedPreview ? 1 : 0);
        if (e.key === "Escape") {
          closePopup();
          return;
        }
        if (e.key === "ArrowDown" && total > 0) {
          e.preventDefault();
          highlightedIndex = (highlightedIndex + 1) % total;
          renderPopupItems();
          return;
        }
        if (e.key === "ArrowUp" && total > 0) {
          e.preventDefault();
          highlightedIndex = (highlightedIndex - 1 + total) % total;
          renderPopupItems();
          return;
        }
        if (e.key === "Enter" && total > 0 && highlightedIndex < total) {
          // Only intercept Enter when the user explicitly highlighted an option if field is empty,
          // so pressing Enter to submit a typed password still submits normally.
          if (activeInput.value.length === 0) {
            e.preventDefault();
            if (highlightedIndex < currentCredentials.length) {
              void applyCredentialFill(currentCredentials[highlightedIndex]!.id, activeInput);
            } else if (currentGeneratedPreview) {
              void applyGeneratedPassword(currentGeneratedPreview, activeInput);
            }
            return;
          }
        }
      }

      if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
        const pwEl = isPasswordField(e.target) ? e.target : findPasswordInputFor(e.target);
        if (pwEl && pwEl.value) {
          const root = getNearbyRoot(pwEl);
          const userEl = findUsernameInputFor(root, pwEl);
          emitCandidate(userEl?.value ?? latestCandidate.username, pwEl.value);
        } else if (latestCandidate.password) {
          emitCandidate(latestCandidate.username, latestCandidate.password);
        }
      }
    },
    true
  );

  window.addEventListener(
    "submit",
    (e) => {
      const form = e.target;
      if (form instanceof HTMLFormElement) {
        const pws = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="password"]')).filter((p) =>
          Boolean(p.value)
        );
        if (pws.length > 0) {
          const pwEl = pws[0]!;
          const userEl = findUsernameInputFor(form, pwEl);
          emitCandidate(userEl?.value ?? latestCandidate.username, pwEl.value);
          return;
        }
      }
      if (latestCandidate.password) {
        emitCandidate(latestCandidate.username, latestCandidate.password);
      }
    },
    true
  );

  window.addEventListener(
    "click",
    (e) => {
      if (!latestCandidate.password && !activeInput) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      const submitBtn = target.closest('button, input[type="submit"], [role="button"]');
      if (submitBtn) {
        const container = submitBtn.closest("form") ?? submitBtn.parentElement?.parentElement ?? document.body;
        const pws = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="password"]')).filter((p) =>
          Boolean(p.value)
        );
        if (pws.length > 0) {
          const pwEl = pws[0]!;
          const userEl = findUsernameInputFor(container as HTMLElement, pwEl);
          emitCandidate(userEl?.value ?? latestCandidate.username, pwEl.value);
          return;
        }
        // Fallback for SPAs whose submit button sits slightly outside the input wrapper
        if (latestCandidate.password && latestCandidate.pwEl && document.contains(latestCandidate.pwEl)) {
          emitCandidate(latestCandidate.username, latestCandidate.password);
        }
      }
    },
    true
  );

  window.addEventListener("beforeunload", () => {
    if (latestCandidate.password) {
      emitCandidate(latestCandidate.username, latestCandidate.password);
    }
  });

  window.addEventListener("mousedown", (e) => {
    if (!hostEl || hostEl.style.display === "none") return;
    if (e.target !== hostEl && e.target !== activeInput) {
      closePopup();
    }
  });
  window.addEventListener(
    "scroll",
    () => {
      if (hostEl && activeInput && hostEl.style.display !== "none") {
        positionOverlay();
      }
    },
    { capture: true, passive: true }
  );
  window.addEventListener(
    "resize",
    () => {
      if (hostEl && activeInput && hostEl.style.display !== "none") {
        positionOverlay();
      }
    },
    { capture: true, passive: true }
  );

  ipcRenderer.on("passwords:fill-active-frame", (_event, payload: { username: string; password: string }) => {
    const target =
      (activeInput && document.contains(activeInput) ? activeInput : null) ??
      (document.querySelector('input[type="password"]') as HTMLInputElement | null);
    if (!target) return;
    const pwEl = findPasswordInputFor(target) ?? (isPasswordField(target) ? target : null);
    const root = pwEl ? getNearbyRoot(pwEl) : getNearbyRoot(target);
    const userEl = findUsernameInputFor(root, pwEl ?? undefined);

    if (userEl && payload.username) setNativeInputValue(userEl, payload.username);
    if (pwEl && payload.password) setNativeInputValue(pwEl, payload.password);
    closePopup();
  });

  ipcRenderer.on("passwords:fill-generated-active-frame", (_event, password: string) => {
    const focused = document.activeElement instanceof HTMLInputElement ? document.activeElement : null;
    const pwEl =
      (focused && isPasswordField(focused) ? focused : null) ??
      (document.querySelector('input[type="password"]') as HTMLInputElement | null);
    if (!pwEl) return;
    void applyGeneratedPassword(password, pwEl);
  });
}
