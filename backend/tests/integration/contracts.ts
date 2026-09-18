import { expect } from "vitest";
import type { Response } from "supertest";

export type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);

export const objectValue = (value: unknown): JsonObject => {
  expect(isObject(value)).toBe(true);
  if (!isObject(value)) {
    throw new Error("Expected JSON object");
  }
  return value;
};

export const stringValue = (value: unknown): string => {
  expect(typeof value).toBe("string");
  if (typeof value !== "string") {
    throw new Error("Expected string");
  }
  return value;
};

export const arrayValue = (value: unknown): unknown[] => {
  expect(Array.isArray(value)).toBe(true);
  if (!Array.isArray(value)) {
    throw new Error("Expected JSON array");
  }
  return value;
};

export const responseObject = (response: Response): JsonObject => objectValue(response.body as unknown);

export const expectRequestId = (response: Response): string => {
  const body = responseObject(response);
  const requestId = stringValue(body["requestId"]);
  expect(response.headers["x-request-id"]).toBe(requestId);
  expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu);
  return requestId;
};

export const successData = (response: Response): JsonObject => {
  const body = responseObject(response);
  expect(body["success"]).toBe(true);
  expectRequestId(response);
  return objectValue(body["data"]);
};

export const successValue = (response: Response): unknown => {
  const body = responseObject(response);
  expect(body["success"]).toBe(true);
  expectRequestId(response);
  return body["data"];
};

export const expectError = (response: Response, status: number, code: string): JsonObject => {
  expect(response.status).toBe(status);
  const body = responseObject(response);
  expect(body["success"]).toBe(false);
  expectRequestId(response);
  const error = objectValue(body["error"]);
  expect(error["code"]).toBe(code);
  expect(typeof error["message"]).toBe("string");
  expect(arrayValue(error["details"])).toBeDefined();
  return error;
};

export const expectUserDto = (value: unknown): JsonObject => {
  const user = objectValue(value);
  expect(Object.keys(user).sort()).toEqual(["createdAt", "email", "id", "isActive", "name", "role", "updatedAt"].sort());
  stringValue(user["id"]);
  stringValue(user["name"]);
  stringValue(user["email"]);
  stringValue(user["role"]);
  expect(typeof user["isActive"]).toBe("boolean");
  stringValue(user["createdAt"]);
  stringValue(user["updatedAt"]);
  return user;
};

export const refreshCookie = (response: Response): string => {
  const raw = response.headers["set-cookie"];
  expect(Array.isArray(raw)).toBe(true);
  if (!Array.isArray(raw)) {
    throw new Error("Expected refresh cookie");
  }
  const cookie = raw.find((value) => value.startsWith("floodready_refresh="));
  expect(cookie).toBeDefined();
  if (cookie === undefined) {
    throw new Error("Expected refresh cookie");
  }
  const separator = cookie.indexOf(";");
  return separator === -1 ? cookie : cookie.slice(0, separator);
};

export const setCookieHeaders = (response: Response): string[] => {
  const raw = response.headers["set-cookie"];
  expect(Array.isArray(raw)).toBe(true);
  if (!Array.isArray(raw)) {
    throw new Error("Expected Set-Cookie headers");
  }
  return raw;
};

export const authData = (response: Response): { accessToken: string; user: JsonObject } => {
  const data = successData(response);
  const accessToken = stringValue(data["accessToken"]);
  expect(data["tokenType"]).toBe("Bearer");
  expect(data["expiresInSeconds"]).toBe(900);
  return { accessToken, user: expectUserDto(data["user"]) };
};

export const bearer = (accessToken: string): { Authorization: string } => ({ Authorization: `Bearer ${accessToken}` });
