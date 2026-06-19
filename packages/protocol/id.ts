import { customAlphabet } from "nanoid";
import type { SessionId } from "./session";

const SESSION_ID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZabcdefghjkmnpqrstvwxyz";
const SESSION_ID_LENGTH = 12;

const generate = customAlphabet(SESSION_ID_ALPHABET, SESSION_ID_LENGTH);

/**
 * Generate a fresh session id. Crockford-like alphabet (no I/L/O/U) so they
 * survive being dictated, copy/pasted, or shown on a phone screen.
 */
export function createSessionId(): SessionId {
  return generate();
}
