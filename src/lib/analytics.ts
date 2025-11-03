import { track } from "@vercel/analytics";

/**
 * Track API endpoint usage from client-side with user information
 * This should be called from the client when making API requests
 */
export function trackApiEndpoint(params: {
  endpoint: string;
  method: string;
  userId?: string;
  userEmail?: string;
  statusCode?: number;
  isProtected?: boolean;
}) {
  const { endpoint, method, userId, userEmail, statusCode, isProtected } = params;

  // Track the endpoint call as a custom event
  track("api_endpoint_called", {
    endpoint,
    method,
    status_code: statusCode?.toString() || "unknown",
    is_protected: isProtected ? "true" : "false",
    // Include user info if available (for protected endpoints)
    // Note: Email is hashed/anonymized by Vercel Analytics for privacy
    ...(userId && { user_id: userId }),
    ...(userEmail && { user_email: userEmail }),
  });
}

/**
 * Log API endpoint usage on the server side
 * This creates structured logs that appear in Vercel's logs dashboard
 */
export function logApiEndpoint(params: {
  endpoint: string;
  method: string;
  userId?: string;
  userEmail?: string;
  statusCode?: number;
  isProtected?: boolean;
}) {
  const { endpoint, method, userId, userEmail, statusCode, isProtected } = params;

  // Create structured log for Vercel dashboard
  const logData = {
    type: "api_endpoint",
    endpoint,
    method,
    status_code: statusCode,
    is_protected: isProtected,
    ...(userId && { user_id: userId }),
    ...(userEmail && { user_email: userEmail }),
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(logData));
}
