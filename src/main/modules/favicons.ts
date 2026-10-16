// Store Favicons in a SQLite database
// This is used to provide a cache before visiting a page
// Should be 32x32px

import path from "path";
import Database from "better-sqlite3";
import { net, Session } from "electron";
import { createHash } from "crypto";
import { LUMI_DATA_DIR } from "./paths";
import sharp from "sharp";
import { debugError, debugPrint } from "./output";
import { FLAGS } from "@/modules/flags";
import { parseICO } from "icojs";

const dbPath = path.join(LUMI_DATA_DIR, "favicons.db");
let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("cache_size = -64000");
    db.pragma("busy_timeout = 3000");

    db.exec(`
      CREATE TABLE IF NOT EXISTS favicons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL,
        last_update INTEGER,
        last_requested INTEGER,
        favicon BLOB NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_favicons_hash ON favicons(hash);

      CREATE TABLE IF NOT EXISTS favicon_urls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        icon_id INTEGER REFERENCES favicons(id)
      );
      CREATE INDEX IF NOT EXISTS idx_favicon_urls_url ON favicon_urls(url);
    `);
  }
  return db;
}

// Maximum concurrent favicon processing operations
const MAX_CONCURRENT_OPERATIONS = 3;
let activeOperations = 0;
const operationQueue: (() => Promise<void>)[] = [];

// Process the operation queue
async function processQueue() {
  if (operationQueue.length === 0 || activeOperations >= MAX_CONCURRENT_OPERATIONS) {
    return;
  }

  activeOperations++;
  const operation = operationQueue.shift();

  try {
    await operation!();
  } catch (error) {
    debugError("FAVICONS", "Error in queued operation:", error);
  } finally {
    activeOperations--;
    // Process next operation in queue
    processQueue();
  }
}

let databaseInitialized = false;
let resolveDatabaseInitialized: () => void = () => {
  databaseInitialized = true;
};
const whenDatabaseInitialized = new Promise<void>((resolve) => {
  if (databaseInitialized) {
    resolve();
  } else {
    resolveDatabaseInitialized = resolve;
  }
});

/**
 * Initialize the database
 */
async function initDatabase() {
  try {
    debugPrint("FAVICONS", "Starting database initialization...");
    getDb();
    debugPrint("FAVICONS", "Favicons database initialized");

    debugPrint("FAVICONS", "Running cleanup of old favicons...");
    await cleanupOldFavicons();
    debugPrint("FAVICONS", "Cleanup completed");

    resolveDatabaseInitialized();
    debugPrint("FAVICONS", "Database initialized successfully");
  } catch (err) {
    debugError("FAVICONS", "Failed to initialize favicon database:", err);
    throw err;
  }
}

// Initialize the database with retries
let retryCount = 0;
const maxRetries = 3;

async function initDatabaseWithRetry() {
  try {
    debugPrint("FAVICONS", `Starting database initialization attempt ${retryCount + 1}/${maxRetries + 1}`);
    await initDatabase();
  } catch {
    retryCount++;
    if (retryCount < maxRetries) {
      debugPrint("FAVICONS", `Retrying database initialization (attempt ${retryCount + 1}/${maxRetries + 1})...`);
      setTimeout(initDatabaseWithRetry, 1000 * retryCount); // Exponential backoff
    } else {
      debugError("FAVICONS", "Failed to initialize database after multiple attempts");
      // Resolve to prevent app from hanging, but in failed state
      resolveDatabaseInitialized();
    }
  }
}

// Start initialization
debugPrint("FAVICONS", "Starting database initialization process");
initDatabaseWithRetry();

/**
 * Converts an image file to a Sharp object ready for further processing
 * Uses icojs to parse ICO files before returning a Sharp object.
 * @param faviconData The image file data
 * @param url The URL for logging purposes
 * @param isIco Whether the image is an ICO file
 * @returns A Sharp object
 */
async function processIconImage(faviconData: Buffer, url: string, isIco: boolean): Promise<sharp.Sharp | null> {
  try {
    if (isIco) {
      debugPrint("FAVICONS", `Processing ICO file with icojs and sharp for ${url}`);

      const images = await parseICO(faviconData, "image/png");
      if (images.length === 0) {
        debugError("FAVICONS", `No images found in ICO file for ${url}`);
        return null;
      }
      const largestImage = images.reduce((prev, curr) => {
        return prev.width * prev.height >= curr.width * curr.height ? prev : curr;
      });
      return sharp(largestImage.buffer);
    } else {
      return sharp(faviconData);
    }
  } catch (err) {
    debugError("FAVICONS", "Error processing image:", err);
    // If processing fails, return null
    return null;
  }
}

/**
 * Detect image type from buffer content instead of relying on URL extension
 * @param buffer The image buffer data
 * @returns Object containing image type information
 */
async function detectImageType(buffer: Buffer): Promise<{ isIco: boolean; isValid: boolean }> {
  // Simple mime type detection based on magic numbers
  if (buffer.length < 4) {
    return { isIco: false, isValid: false };
  }

  // Check for ICO header - should start with 00 00 01 00
  if (buffer[0] === 0 && buffer[1] === 0 && buffer[2] === 1 && buffer[3] === 0) {
    return { isIco: true, isValid: true };
  }

  // Check for PNG header - should start with 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { isIco: false, isValid: true };
  }

  // Check for JPEG header - should start with FF D8
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return { isIco: false, isValid: true };
  }

  // Check for GIF header - should start with GIF8
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return { isIco: false, isValid: true };
  }

  // Check for SVG - should contain "<svg" somewhere in the first few bytes
  const svgCheck = buffer.slice(0, Math.min(buffer.length, 100)).toString().toLowerCase();
  if (svgCheck.includes("<svg")) {
    return { isIco: false, isValid: true };
  }

  // Unknown format but attempt to process anyway
  return { isIco: false, isValid: true };
}

/**
 * Fetches a favicon from a URL with timeout
 * @param faviconURL The URL to fetch the favicon from
 * @returns A Promise resolving to a Buffer containing the favicon data
 */
async function fetchFavicon(faviconURL: string, session?: Session): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const request = net.request({
      url: faviconURL,
      session: session
    });

    const data: Buffer[] = [];

    // Set up timeout
    const timeoutId = setTimeout(() => {
      request.abort();
      reject(new Error(`Request timed out for ${faviconURL}`));
    }, 5000);

    request.on("response", (response) => {
      clearTimeout(timeoutId);

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch favicon: ${response.statusCode}`));
        return;
      }

      response.on("data", (chunk) => {
        data.push(Buffer.from(chunk));
      });

      response.on("end", () => {
        resolve(Buffer.concat(data));
      });

      response.on("error", (error) => {
        reject(error);
      });
    });

    request.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    request.end();
  });
}

/**
 * Stores a favicon in the database or updates an existing one
 * @param imageHash The hash of the favicon content
 * @param resizedImageBuffer The favicon image data
 * @param url The URL the favicon belongs to
 * @returns The ID of the favicon in the database
 */
function storeFaviconInDb(imageHash: string, resizedImageBuffer: Buffer, url: string): number {
  const database = getDb();
  const now = Date.now();

  const storeTx = database.transaction(() => {
    const existingFavicon = database.prepare("SELECT id FROM favicons WHERE hash = ? LIMIT 1").get(imageHash) as
      | { id: number }
      | undefined;

    let iconId: number;
    if (existingFavicon) {
      iconId = existingFavicon.id;
      database.prepare("UPDATE favicons SET last_update = ? WHERE id = ?").run(now, iconId);
    } else {
      const info = database
        .prepare("INSERT INTO favicons (hash, favicon, last_update, last_requested) VALUES (?, ?, ?, ?)")
        .run(imageHash, resizedImageBuffer, now, now);
      iconId = Number(info.lastInsertRowid);
    }

    const existingUrl = database.prepare("SELECT id FROM favicon_urls WHERE url = ? LIMIT 1").get(url) as
      | { id: number }
      | undefined;

    if (existingUrl) {
      database.prepare("UPDATE favicon_urls SET icon_id = ? WHERE url = ?").run(iconId, url);
    } else {
      database.prepare("INSERT INTO favicon_urls (url, icon_id) VALUES (?, ?)").run(url, iconId);
    }

    return iconId;
  });

  return storeTx();
}

/**
 * Normalizes a URL by ensuring it has a trailing slash, removing www, and converting https to http
 * This normalization is only used for favicon caching and retrieval, not for actual requests.
 * Converting https to http is safe here since we're only using it as a cache key and not making
 * any actual network requests with the normalized URL.
 *
 * @param url The URL to normalize
 * @returns The normalized URL with a trailing slash
 */
export function normalizeURL(url: string): string {
  try {
    const parsedURL = new URL(url);

    // Remove www from hostname if present
    if (parsedURL.hostname.startsWith("www.")) {
      parsedURL.hostname = parsedURL.hostname.slice(4);
    }

    // Convert https to http for consistency in cache keys
    if (parsedURL.protocol === "https:") {
      parsedURL.protocol = "http:";
    }

    // Add trailing slash to pathname if it doesn't have one and isn't empty
    if (parsedURL.pathname && parsedURL.pathname !== "/" && !parsedURL.pathname.endsWith("/")) {
      parsedURL.pathname = `${parsedURL.pathname}/`;
    }

    // Remove query params from the URL
    parsedURL.search = "";

    // Remove hash from the URL
    parsedURL.hash = "";

    // Remove the path from the URL if the flag is enabled
    if (FLAGS.FAVICONS_REMOVE_PATH) {
      parsedURL.pathname = "";
    }

    return parsedURL.toString();
  } catch (error) {
    // If URL parsing fails, just return the original URL
    console.error(`Failed to normalize URL: ${url}`, error);
    return url;
  }
}

/**
 * Fetches and processes a favicon from the given URL
 * @param url The page URL
 * @param faviconURL The URL of the favicon
 */
export function cacheFavicon(url: string, faviconURL: string, session?: Session): void {
  // Normalize the URL
  const normalizedURL = normalizeURL(url);

  // Queue the operation to limit concurrency
  operationQueue.push(async () => {
    await whenDatabaseInitialized;

    try {
      // Fetch the favicon
      const faviconData = await fetchFavicon(faviconURL, session);

      // Check if we got valid data
      if (!faviconData || faviconData.length === 0) {
        debugPrint("FAVICONS", `Empty favicon data for ${normalizedURL}`);
        return;
      }

      // Detect image type from content
      const { isIco, isValid } = await detectImageType(faviconData);

      if (!isValid) {
        debugPrint("FAVICONS", `Invalid image data for ${normalizedURL}`);
        return;
      }

      // Process the image and get a Sharp object
      const sharpObj = await processIconImage(faviconData, normalizedURL, isIco);
      if (!sharpObj) {
        debugError("FAVICONS", `Failed to process image for ${normalizedURL}`);
        return;
      }

      // Resize the image and convert to PNG in a single operation
      const resizedImageBuffer = await sharpObj
        .resize(32, 32, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        })
        .png()
        .toBuffer();

      // Generate content hash
      const imageHash = createHash("md5").update(resizedImageBuffer).digest("hex");

      // Store in database
      storeFaviconInDb(imageHash, resizedImageBuffer, normalizedURL);

      debugPrint(
        "FAVICONS",
        `Cached ${isIco ? "ICO→PNG" : "original"} favicon for ${normalizedURL} with hash ${imageHash}`
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("ClientRequest only supports http: and https: protocols")) {
        // Ignore, this is expected.
        // It just means that it cannot cache the favicons of custom protocols.
        return;
      }
      debugError("FAVICONS", "Error caching favicon:", error);
    }
  });

  // Start processing the queue
  processQueue();
}

/**
 * Retrieves a favicon for a given URL
 * @param url The URL to get the favicon for
 * @returns The favicon data as a Buffer, or null if not found
 */
export async function getFavicon(url: string): Promise<Buffer | null> {
  await whenDatabaseInitialized;
  // Normalize the URL
  const normalizedURL = normalizeURL(url);

  try {
    const database = getDb();
    const getTx = database.transaction(() => {
      // Look up the favicon in the database
      const row = database
        .prepare(
          `
          SELECT f.favicon, f.id
          FROM favicon_urls u
          JOIN favicons f ON u.icon_id = f.id
          WHERE u.url = ?
          LIMIT 1
        `
        )
        .get(normalizedURL) as { favicon: Buffer; id: number } | undefined;

      if (row && row.favicon) {
        // Update last_requested time
        database.prepare("UPDATE favicons SET last_requested = ? WHERE id = ?").run(Date.now(), row.id);

        return row.favicon;
      }

      return null;
    });

    return getTx();
  } catch (error) {
    debugError("FAVICONS", "Error getting favicon:", error);
    return null;
  }
}

/**
 * Checks if a favicon exists for a given URL
 * @param url The URL to check
 * @returns True if a favicon exists, false otherwise
 */
export async function hasFavicon(url: string): Promise<boolean> {
  await whenDatabaseInitialized;
  // Normalize the URL
  const normalizedURL = normalizeURL(url);

  try {
    const database = getDb();
    const row = database.prepare("SELECT COUNT(*) as count FROM favicon_urls WHERE url = ?").get(normalizedURL) as
      | { count: number }
      | undefined;
    return (row && Number(row.count) > 0) ?? false;
  } catch (error) {
    debugError("FAVICONS", "Error checking favicon:", error);
    return false;
  }
}

/**
 * Gets a data URL for a favicon
 * @param url The URL to get the favicon for
 * @returns A data URL containing the favicon, or null if not found
 */
export async function getFaviconDataUrl(url: string): Promise<string | null> {
  await whenDatabaseInitialized;
  // Normalize the URL
  const normalizedURL = normalizeURL(url);

  try {
    const favicon = await getFavicon(normalizedURL);
    if (!favicon) {
      return null;
    }

    // Convert the favicon to a data URL
    return `data:image/png;base64,${favicon.toString("base64")}`;
  } catch (error) {
    debugError("FAVICONS", "Error getting favicon data URL:", error);
    return null;
  }
}

/**
 * Closes the favicons database connection.
 * Should be called during app shutdown to prevent SQLite handles from being
 * torn down unsafely by V8 garbage collection.
 */
export async function closeFaviconsDatabase(): Promise<void> {
  try {
    if (db) {
      db.close();
      db = null;
      debugPrint("FAVICONS", "Database connection closed");
    }
  } catch (err) {
    debugError("FAVICONS", "Error closing favicons database:", err);
  }
}

/**
 * Cleans up old favicons from the database
 * @param maxAge Maximum age in days before a favicon is considered old
 * @returns The number of favicons removed
 */
export async function cleanupOldFavicons(maxAge: number = 90): Promise<number> {
  try {
    debugPrint("FAVICONS", "Starting cleanup process...");

    // Calculate cutoff timestamp in milliseconds
    const cutoffDate = Date.now() - maxAge * 24 * 60 * 60 * 1000;
    debugPrint("FAVICONS", `Cleanup cutoff timestamp: ${cutoffDate}`);

    const database = getDb();

    const cleanupTx = database.transaction(() => {
      // Get favicon IDs that haven't been requested since the cutoff date
      debugPrint("FAVICONS", "Finding old favicons...");
      const oldRows = database.prepare("SELECT id FROM favicons WHERE last_requested < ?").all(cutoffDate) as {
        id: number;
      }[];

      debugPrint("FAVICONS", `Found ${oldRows.length} old favicons to remove`);

      if (oldRows.length === 0) {
        debugPrint("FAVICONS", "No old favicons to clean up");
        return 0;
      }

      const oldFaviconIds = oldRows.map((r) => r.id);
      const placeholders = oldFaviconIds.map(() => "?").join(",");

      // Remove favicon URL mappings for old favicons
      debugPrint("FAVICONS", "Removing old favicon URL mappings...");
      const deletedUrlMappings = database
        .prepare(`DELETE FROM favicon_urls WHERE icon_id IN (${placeholders})`)
        .run(...oldFaviconIds);
      debugPrint("FAVICONS", `Removed ${deletedUrlMappings.changes} URL mappings`);

      // Remove old favicons
      debugPrint("FAVICONS", "Removing old favicons...");
      const deletedCount = database.prepare(`DELETE FROM favicons WHERE id IN (${placeholders})`).run(...oldFaviconIds);

      debugPrint("FAVICONS", `Successfully removed ${deletedCount.changes} old favicons`);
      return deletedCount.changes;
    });

    return cleanupTx();
  } catch (error) {
    debugError("FAVICONS", "Error during favicon cleanup:", error);
    // Don't throw the error, just return 0 to allow initialization to continue
    return 0;
  }
}
