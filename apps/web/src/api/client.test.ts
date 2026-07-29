import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest, getStoredSession, setStoredSession } from "./client";

const storage = new Map<string, string>();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

beforeEach(() => {
  storage.clear();
  vi.restoreAllMocks();

  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key)
    }
  });
});

describe("apiRequest", () => {
  it("refreshes an expired access token and retries the original request", async () => {
    setStoredSession({ accessToken: "expired-access-token", refreshToken: "valid-refresh-token" });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "REQUEST_ERROR", message: "Authorization token expired" } }, 401)
      )
      .mockResolvedValueOnce(jsonResponse({ accessToken: "fresh-access-token" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(apiRequest<{ ok: true }>("/dashboard")).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://localhost:4000/api/v1/auth/refresh");
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get("Authorization")).toBe("Bearer fresh-access-token");
    expect(getStoredSession()?.accessToken).toBe("fresh-access-token");
  });

  it("clears the stored session when refresh token is rejected", async () => {
    setStoredSession({ accessToken: "expired-access-token", refreshToken: "revoked-refresh-token" });
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "REQUEST_ERROR", message: "Authorization token expired" } }, 401)
      )
      .mockResolvedValueOnce(jsonResponse({ error: { code: "UNAUTHORIZED", message: "Phiên đăng nhập đã hết hạn" } }, 401));

    await expect(apiRequest("/dashboard")).rejects.toThrow("Phiên đăng nhập đã hết hạn");
    expect(getStoredSession()).toBeNull();
  });
});
