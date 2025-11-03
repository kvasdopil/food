import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdminClient";

export type AuthResult =
  | { authorized: true; userId?: string; userEmail?: string }
  | { authorized: false; error: string };

/**
 * Authenticates a request using either:
 * 1. EDIT_TOKEN (for scripts/automation) - if provided and matches
 * 2. Supabase session token (for logged-in users)
 *
 * Optionally checks if the user is in an allowed list.
 *
 * @param request - The Next.js request object
 * @param options - Configuration options
 * @returns AuthResult indicating if the request is authorized
 */
export async function authenticateRequest(
  request: NextRequest,
  options?: {
    allowedEmails?: string[];
    allowedUserIds?: string[];
    requireAuth?: boolean;
  },
): Promise<AuthResult> {
  const editToken = process.env.EDIT_TOKEN;
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const tokenMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  const providedToken = tokenMatch ? tokenMatch[1].trim() : null;

  // Check EDIT_TOKEN first (for scripts/automation)
  if (editToken && providedToken === editToken) {
    return { authorized: true };
  }

  // Check Supabase session token
  if (!supabaseAdmin) {
    return {
      authorized: false,
      error: "Server is not configured for authentication",
    };
  }

  if (!providedToken) {
    if (options?.requireAuth !== false) {
      return {
        authorized: false,
        error: "No authorization token provided",
      };
    }
    // If requireAuth is false, allow anonymous requests
    return { authorized: true };
  }

  try {
    // Verify the Supabase session token
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(providedToken);

    if (error || !user) {
      return {
        authorized: false,
        error: "Invalid or expired session token",
      };
    }

    // Check allowed emails if provided
    if (options?.allowedEmails && options.allowedEmails.length > 0) {
      const userEmail = user.email?.toLowerCase();
      if (!userEmail || !options.allowedEmails.some((email) => email.toLowerCase() === userEmail)) {
        return {
          authorized: false,
          error: "User email not authorized",
        };
      }
    }

    // Check allowed user IDs if provided
    if (options?.allowedUserIds && options.allowedUserIds.length > 0) {
      if (!options.allowedUserIds.includes(user.id)) {
        return {
          authorized: false,
          error: "User not authorized",
        };
      }
    }

    return {
      authorized: true,
      userId: user.id,
      userEmail: user.email,
    };
  } catch (error) {
    console.error("Auth verification error:", error);
    return {
      authorized: false,
      error: "Failed to verify authentication",
    };
  }
}

/**
 * Get the Supabase session token from a request header.
 * This is a helper for extracting the token.
 */
export function getSessionTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const tokenMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  return tokenMatch ? tokenMatch[1].trim() : null;
}
