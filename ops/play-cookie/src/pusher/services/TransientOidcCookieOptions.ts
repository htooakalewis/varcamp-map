import type { CookieOptions, Request } from "express";
import { PUSHER_URL } from "../enums/EnvironmentVariable";

// Only the trusted deployment URL or native TLS controls these transient cookies.
function configuredHttps(): boolean {
    try {
        return new URL(PUSHER_URL).protocol === "https:";
    } catch {
        return false;
    }
}

const publicHttps = configuredHttps();

export function transientOidcCookieOptions(req: Request): CookieOptions {
    return { httpOnly: true, secure: publicHttps || req.secure };
}
