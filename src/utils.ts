import { createHash, randomUUID } from "crypto";

/**
 * Hash a string using SHA-1
 */
export function hasher(data: string): string {
  if (typeof data === "string") {
    const hash = createHash("sha1");
    hash.update(data);
    return hash.digest("hex");
  }
  throw new Error("Data must be a string");
}

/**
 * Replace dots with underscores and vice versa
 */
export function replacer(
  data: string,
  dotToUnderscore: boolean = true
): string {
  if (typeof data === "string") {
    if (dotToUnderscore) {
      return data.replace(/\./g, "_");
    } else {
      return data.replace(/_/g, ".");
    }
  }
  throw new Error("Data must be a string");
}

/**
 * Generate a unique identifier using crypto.randomUUID
 * Supports Node.js 14.17+ and modern browsers (Chrome 92+, Firefox 95+, Safari 15.4+)
 */
export function generateUID(): string {
  // Use crypto.randomUUID if available (Node.js 14.17+ and modern browsers)
  if (typeof randomUUID === "function") {
    return randomUUID();
  }

  // Browser global crypto.randomUUID
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Final fallback for very old environments
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15) +
    Date.now().toString(36)
  );
}
/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as T;
  }

  if (typeof obj === "object") {
    const cloned = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }

  return obj;
}
