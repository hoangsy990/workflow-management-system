import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  apiRequest,
  clearApiCache,
  getApiUrl,
  getStoredSession,
  hydrateStoredSession,
  setApiUrl,
  setStoredSession,
  setStoredSessionAsync
} from "./client";
import { resetSessionTextCacheForTest } from "./session-storage";

const storage = new Map<string, string>();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

beforeEach(() => {
  storage.clear();
  clearApiCache();
  resetSessionTextCacheForTest();
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: undefined
  });

  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key)
    }
  });
  Object.defineProperty(globalThis, "localStorage", {
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
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/auth/refresh");
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get("Authorization")).toBe("Bearer fresh-access-token");
    expect(getStoredSession()?.accessToken).toBe("fresh-access-token");
  });

  it("allows overriding the API URL for native or remote testing", async () => {
    setApiUrl("http://192.168.10.238:8099/api/v1/");
    expect(getApiUrl()).toBe("http://192.168.10.238:8099/api/v1");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ ok: true }));
    await expect(apiRequest<{ ok: true }>("/health-check")).resolves.toEqual({ ok: true });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://192.168.10.238:8099/api/v1/health-check");
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

  it("refreshes before retrying a protected attachment download", async () => {
    setStoredSession({ accessToken: "expired-access-token", refreshToken: "valid-refresh-token" });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "REQUEST_ERROR", message: "Authorization token expired" } }, 401)
      )
      .mockResolvedValueOnce(jsonResponse({ accessToken: "fresh-access-token" }))
      .mockResolvedValueOnce(
        new Response("file-content", {
          status: 200,
          headers: { "Content-Disposition": 'attachment; filename="bao-cao.pdf"' }
        })
      );

    const result = await api.downloadAttachment("attachment-id");

    expect(await result.blob.text()).toBe("file-content");
    expect(result.filename).toBe("bao-cao.pdf");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get("Authorization")).toBe("Bearer fresh-access-token");
  });

  it("caches reference data requests in memory", async () => {
    const categories = [{ id: "cat-1", name: "Dự án" }];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(categories));

    await expect(api.taskCategories()).resolves.toEqual(categories);
    await expect(api.taskCategories()).resolves.toEqual(categories);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/task-categories");
  });

  it("invalidates cached departments after a department mutation", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse([{ id: "dep-1", name: "Kinh doanh" }]))
      .mockResolvedValueOnce(jsonResponse({ id: "dep-2", name: "Vận hành" }))
      .mockResolvedValueOnce(jsonResponse([{ id: "dep-1", name: "Kinh doanh" }, { id: "dep-2", name: "Vận hành" }]));

    await expect(api.departments()).resolves.toHaveLength(1);
    await expect(api.saveDepartment({ name: "Vận hành" })).resolves.toMatchObject({ id: "dep-2" });
    await expect(api.departments()).resolves.toHaveLength(2);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("uses the native secure session bridge when it is available", async () => {
    const secureStore = { value: null as string | null };
    const bridge = {
      get: vi.fn(() => secureStore.value),
      set: vi.fn((value: string | null) => {
        secureStore.value = value;
      }),
      remove: vi.fn(() => {
        secureStore.value = null;
      })
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { __WORKFLOW_SECURE_SESSION__: bridge }
    });

    await setStoredSessionAsync({ accessToken: "native-access", refreshToken: "native-refresh" });

    expect(storage.get("workflow.session")).toBeUndefined();
    expect(bridge.set).toHaveBeenCalledTimes(1);
    expect(secureStore.value).toContain("native-access");
    await expect(hydrateStoredSession()).resolves.toEqual({ accessToken: "native-access", refreshToken: "native-refresh" });

    await setStoredSessionAsync(null);
    expect(bridge.remove).toHaveBeenCalledTimes(1);
    expect(getStoredSession()).toBeNull();
  });
});
