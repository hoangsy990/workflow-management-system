import { Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { api, ApiUser, getApiUrl, setApiUrl, setStoredSession } from "../api/client";

export function Login({ onLogin }: { onLogin: (user: ApiUser) => void }) {
  const [email, setEmail] = useState("admin@workflow.local");
  const [password, setPassword] = useState("Admin@123456");
  const [apiUrl, setApiUrlInput] = useState(getApiUrl());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      setApiUrl(apiUrl);
      const result = await api.login(email, password, "Web");
      setStoredSession({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      onLogin(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div>
          <p className="eyebrow">WorkFlow Management System</p>
          <h1>Đăng nhập</h1>
        </div>
        <form onSubmit={submit} className="form-stack">
          <label>
            Email
            <input
              data-testid="login-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
            />
          </label>
          <label>
            Mật khẩu
            <input
              data-testid="login-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
            />
          </label>
          <label>
            Địa chỉ API
            <input
              data-testid="login-api-url"
              value={apiUrl}
              onChange={(event) => setApiUrlInput(event.target.value)}
              placeholder="/api/v1 hoặc http://host:8099/api/v1"
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" data-testid="login-submit" type="submit" disabled={loading}>
            {loading && <Loader2 className="spin" size={16} />}
            Đăng nhập
          </button>
        </form>
        <div className="demo-lines">
          <span>Admin: admin@workflow.local / Admin@123456</span>
          <span>Quản lý: manager@workflow.local / Manager@123456</span>
        </div>
      </section>
    </main>
  );
}
