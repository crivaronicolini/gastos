import { cloudflareClient } from "better-auth-cloudflare/client";
import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient({
  plugins: [cloudflareClient()], // includes geolocation and R2 file features (if configured)
});

export default authClient;
