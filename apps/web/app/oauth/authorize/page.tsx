import { getToken, isAuthenticated } from "../../../lib/auth-server";
import { DeviceAuthorizeClient } from "./authorize-client";

export default async function DeviceAuthorizePage() {
  const [authenticated, token] = await Promise.all([isAuthenticated(), getToken()]);

  return (
    <div className="page">
      <main className="content">
        <h1 className="authTitle">Device Authorization</h1>
        <p className="description">
          Enter the user code shown in your CLI session, then approve or deny access for this
          device.
        </p>
        <DeviceAuthorizeClient authenticated={authenticated} initialToken={token ?? null} />
      </main>
    </div>
  );
}
