import { createHash } from "crypto";

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
 * Generate a unique identifier
 */
export function generateUID(): string {
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
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }

  return obj;
}
