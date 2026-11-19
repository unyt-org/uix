/**
 * SECURITY: helpers that prevent path traversal and reading non-regular files
 * (e.g. /proc/self/fd/N pipes, sockets, devices) via the file server.
 */

const MAX_DECODE_ROUNDS = 5;
const FORBIDDEN_ROOTS = ["/proc", "/sys", "/dev"];

/**
 * Returns true if a request pathname is safe to map to the file system.
 * The path is percent-decoded repeatedly (multiple-encoding attacks like %252e%252e),
 * then rejected if it contains "." or ".." segments, backslashes or null bytes.
 * Paths are later resolved with URL semantics, where "%2e%2e" also counts as "..",
 * so the check must run on the fully decoded path.
 */
export function isSafeRequestPath(pathname: string): boolean {
    let decoded = pathname;
    let stable = false;
    for (let i = 0; i < MAX_DECODE_ROUNDS && !stable; i++) {
        let next: string;
        try {
            next = decodeURIComponent(decoded);
        }
        catch {
            return false; // malformed encoding
        }
        stable = next === decoded;
        decoded = next;
    }
    if (!stable) return false; // still encoded after MAX_DECODE_ROUNDS
    if (decoded.includes("\\") || decoded.includes("\0")) return false;
    return !decoded.split("/").some(segment => segment === ".." || segment === ".");
}

/**
 * Returns true if the path points to a regular file that may be served:
 * no directories, pipes, sockets or devices, and nothing under /proc, /sys or /dev
 * (also checked after resolving symlinks).
 */
export async function isServableFile(path: string): Promise<boolean> {
    try {
        if (isForbiddenSystemPath(path)) return false;
        const realPath = await Deno.realPath(path);
        if (isForbiddenSystemPath(realPath)) return false;
        const stat = await Deno.stat(realPath);
        return stat.isFile;
    }
    catch {
        return false;
    }
}

function isForbiddenSystemPath(path: string) {
    return FORBIDDEN_ROOTS.some(root => path === root || path.startsWith(root + "/"));
}
