import { Auth, type AuthConfig } from "@auth/core";
import MicrosoftEntraID from "@auth/core/providers/microsoft-entra-id";

export const UOFT_TENANT_ID = "78aac226-2f03-4b4d-9037-b46d56c55210";
export const AUTH_BASE_PATH = "/api/auth";

export type AuthEnvironment = {
  [key: string]: string | undefined;
  AUTH_SECRET?: string;
  AUTH_MICROSOFT_ENTRA_ID_ID?: string;
  AUTH_MICROSOFT_ENTRA_ID_SECRET?: string;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

export type AuthSession = { user: AuthUser; expires: string };

type GraphUser = {
  id: string;
  displayName: string | null;
  mail: string | null;
  userPrincipalName: string;
  userType: "Member" | "Guest";
};

export function isAuthConfigured(env: AuthEnvironment): boolean {
  return Boolean(
    env.AUTH_SECRET &&
      env.AUTH_MICROSOFT_ENTRA_ID_ID &&
      env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
  );
}

export function createAuthConfig(env: AuthEnvironment): AuthConfig {
  return {
    basePath: AUTH_BASE_PATH,
    trustHost: true,
    secret: env.AUTH_SECRET,
    providers: [
      MicrosoftEntraID({
        clientId: env.AUTH_MICROSOFT_ENTRA_ID_ID,
        clientSecret: env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
        issuer: `https://login.microsoftonline.com/${UOFT_TENANT_ID}/v2.0`,
        authorization: {
          params: {
            scope: "openid profile email User.Read",
            prompt: "select_account",
          },
        },
        checks: ["pkce", "state", "nonce"],
        profile(profile) {
          return { id: `${profile.tid}:${profile.oid}`, name: profile.name };
        },
      }),
    ],
    session: { strategy: "jwt", maxAge: 60 * 60 },
    pages: { signIn: "/repo", error: "/repo" },
    callbacks: {
      async signIn({ account, profile, user }) {
        if (
          profile?.tid !== UOFT_TENANT_ID ||
          typeof profile.oid !== "string"
        ) {
          return false;
        }

        const response = await fetch(
          "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,userType",
          { headers: { Authorization: `Bearer ${account!.access_token}` } },
        );
        if (!response.ok) {
          throw new Error(`Microsoft Graph profile request failed: ${response.status}`);
        }

        const graph: GraphUser = await response.json();
        if (
          graph.userType !== "Member" ||
          graph.id !== profile.oid ||
          !graph.mail
        ) {
          return false;
        }

        // The primary mail address and sign-in username can differ.
        user.email = graph.mail;
        user.name = graph.displayName;
        return true;
      },
      jwt({ token, user, account }) {
        return account
          ? {
              sub: account.providerAccountId,
              email: user.email,
              name: user.name,
            }
          : { sub: token.sub, email: token.email, name: token.name };
      },
      session({ session, token }) {
        return {
          expires: session.expires,
          user: {
            id: token.sub!,
            email: token.email!,
            name: token.name ?? null,
          },
        };
      },
    },
  };
}

export function handleAuth(request: Request, env: AuthEnvironment): Promise<Response> {
  if (!isAuthConfigured(env)) {
    return Promise.resolve(
      Response.json(
        { error: "sign-in unavailable: microsoft registration is not configured" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      ),
    );
  }
  return Auth(request, createAuthConfig(env));
}

export async function getSession(
  request: Request,
  env: AuthEnvironment,
): Promise<AuthSession | null> {
  if (!isAuthConfigured(env)) return null;
  const response = await handleAuth(
    new Request(new URL(`${AUTH_BASE_PATH}/session`, request.url), {
      headers: { Cookie: request.headers.get("cookie") ?? "" },
    }),
    env,
  );
  return response.json();
}
