/**
 * Base81 encoding using the full set of RFC-3986 fragment-safe characters.
 *
 * Gives ~5.4% fewer characters than base64url for the same byte payload by
 * using log2(81) ≈ 6.34 bits-per-char instead of base64's 6 bits-per-char.
 *
 * RFC 3986 §3.5 allows these characters in a URL fragment without percent-
 * encoding:
 *   ALPHA (52) + DIGIT (10) + unreserved extras: - . _ ~ (4)
 *   + sub-delims: ! $ & ' ( ) * + , ; = (11)
 *   + pchar extras: : @ (2)
 *   + fragment extras: / ? (2)
 *   = 81 total
 *
 * Leading zero bytes are preserved with leading 'A' characters (A = value 0).
 *
 * Prefix convention: callers must prepend a '~' marker byte to identify a
 * base81-encoded payload at the URL level (see deckEncoder / statsEncoder).
 * The '~' character is NOT in the base64url alphabet, making detection trivial.
 */

// 81 RFC-3986 fragment-safe characters (in a deterministic order)
export const BASE81_ALPHABET =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' +
    "-._~!$&'()*+,;=:@/?";
// 26 + 26 + 10 + 19 = 81 ✓

const BASE = BigInt(BASE81_ALPHABET.length); // 81n

// Reverse lookup: char → index (built once at module load)
const DECODE_MAP = new Map<string, bigint>();
for (let i = 0; i < BASE81_ALPHABET.length; i++) {
    DECODE_MAP.set(BASE81_ALPHABET[i], BigInt(i));
}

/**
 * Encode a Uint8Array as a base81 string.
 * Leading zero bytes are preserved as leading 'A' characters.
 */
export function toBase81(bytes: Uint8Array): string {
    if (bytes.length === 0) return '';

    // Count leading zero bytes
    let leadingZeros = 0;
    while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) leadingZeros++;

    // Convert all bytes to a single BigInt (big-endian)
    let n = 0n;
    for (const b of bytes) {
        n = (n << 8n) | BigInt(b);
    }

    // Encode via repeated division (produces base81 digits from least to most
    // significant, so we build the string in reverse)
    let encoded = '';
    while (n > 0n) {
        encoded = BASE81_ALPHABET[Number(n % BASE)] + encoded;
        n /= BASE;
    }

    // Prepend one 'A' (= 0) per leading zero byte
    return BASE81_ALPHABET[0].repeat(leadingZeros) + encoded;
}

/**
 * Decode a base81 string back to a Uint8Array.
 * Throws if any character is not in the alphabet.
 */
export function fromBase81(str: string): Uint8Array {
    if (str.length === 0) return new Uint8Array(0);

    // Count leading 'A' characters (each represents a leading zero byte)
    let leadingZeros = 0;
    while (leadingZeros < str.length && str[leadingZeros] === BASE81_ALPHABET[0]) {
        leadingZeros++;
    }

    // Decode the entire string to a BigInt
    let n = 0n;
    for (const c of str) {
        const idx = DECODE_MAP.get(c);
        if (idx === undefined) throw new Error(`Invalid base81 character: '${c}'`);
        n = n * BASE + idx;
    }

    // Convert BigInt back to bytes
    const bytes: number[] = [];
    while (n > 0n) {
        bytes.unshift(Number(n & 0xffn));
        n >>= 8n;
    }

    // Re-attach leading zero bytes
    const result = new Uint8Array(leadingZeros + bytes.length);
    if (bytes.length > 0) result.set(bytes, leadingZeros);
    return result;
}
