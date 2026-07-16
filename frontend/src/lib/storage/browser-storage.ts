"use client";

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function readBrowserJson<T>(key: string): T | null {
  try {
    const value = storage()?.getItem(key);
    return value === null || value === undefined ? null : JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function writeBrowserJson(key: string, value: unknown): void {
  try {
    storage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Browser storage is a convenience only; the page still works in private mode.
  }
}

export function removeBrowserValue(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // Browser storage is a convenience only; the page still works in private mode.
  }
}
