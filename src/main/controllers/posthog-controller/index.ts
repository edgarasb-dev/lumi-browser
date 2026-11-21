// This controller handles PostHog events and exceptions.

import ErrorTracking from "./posthog-error-capture-sdk";
import { app } from "electron";
import { PostHog } from "posthog-node";
import { _getPosthogIdentifier } from "./identify";

class PosthogController {
  /**
   * The PostHog client.
   */
  private client: PostHog;

  /**
   * Whether the PostHog identifier is ready.
   */
  public isIdentifierReady: boolean = false;

  constructor() {
    const enableExceptionAutocapture = app.isPackaged;

    this.client = new PostHog("phc_P8uPRRW5eJj8vMmgMlsgoOmmeNZ9NxBHN6COZQndvfZ", {
      host: "https://eu.i.posthog.com",
      disableGeoip: false,
      enableExceptionAutocapture
    });

    // Defer PostHog identifier lookup, exception SDK setup, and boot ping until after cold launch
    void app.whenReady().then(() => {
      setTimeout(() => {
        void this.initializeTelemetry();
      }, 2500);
    });

    // Shutdown client on app quit
    app.on("before-quit", () => {
      this.client.shutdown();
    });
  }

  private async initializeTelemetry(): Promise<void> {
    try {
      const identifier = await this.getPosthogIdentifier();
      this.isIdentifierReady = true;

      this.client.identify({
        distinctId: identifier,
        properties: {
          ...this.getAppInfoForPosthog()
        }
      });

      new ErrorTracking(this.client, {
        fallbackDistinctId: identifier,
        enableExceptionAutocapture: true
      });

      await this.captureEvent("app-started");
    } catch {
      // Ignore startup telemetry failures
    }
  }

  /**
   * Get the PostHog identifier.
   * @returns The PostHog identifier.
   */
  public async getPosthogIdentifier(): Promise<string> {
    return await _getPosthogIdentifier();
  }

  /**
   * Capture an event.
   * @param event - The event to capture.
   * @param properties - The properties to capture.
   */
  public async captureEvent(event: string, properties?: Record<string, unknown>): Promise<void> {
    const identifier = await this.getPosthogIdentifier();
    this.client.capture({
      distinctId: identifier,
      event,
      properties: {
        ...properties
      }
    });
  }

  /**
   * Capture an exception.
   * @param error - The error to capture.
   * @param properties - The properties to capture.
   */
  public async captureException(error: string, properties?: Record<string, unknown>): Promise<void> {
    const identifier = await this.getPosthogIdentifier();
    this.client.captureException(error, identifier, {
      ...properties
    });
  }

  /**
   * Get the app info for PostHog.
   * @returns The app info for PostHog.
   */
  private getAppInfoForPosthog() {
    return {
      version: app.getVersion(),
      platform: process.platform,
      environment: process.env.NODE_ENV
    };
  }
}

export const posthogController = new PosthogController();
