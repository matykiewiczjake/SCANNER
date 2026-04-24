export const SESSION_COOKIE = "ms_session";

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export function verifyPassword(input: string): boolean {
  const expected = process.env.DASHBOARD_PASSWORD ?? "";
  if (!expected) return false;
  return timingSafeEqualStr(input, expected);
}

async function hmacToken(): Promise<string> {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) throw new Error("DASHBOARD_PASSWORD is not set");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pw),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("valid")
  );
  return toHex(sig);
}

export async function createSessionCookie(): Promise<string> {
  return hmacToken();
}

export async function isValidSessionCookie(
  value: string | undefined
): Promise<boolean> {
  if (!value) return false;
  try {
    const expected = await hmacToken();
    return timingSafeEqualStr(value, expected);
  } catch {
    return false;
  }
}
