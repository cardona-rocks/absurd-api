import {
  createHash,
  createPublicKey,
  createVerify,
  type JsonWebKey,
  type KeyObject,
} from 'crypto';
import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const APPLE_ISS = 'https://appleid.apple.com';
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const KEYS_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_SEC = 5;

interface AppleJwk {
  kty: string;
  kid: string;
  n: string;
  e: string;
}

export interface AppleIdentity {
  id: string;
  email?: string;
  name?: string;
}

let cachedKeys: { fetchedAt: number; keys: AppleJwk[] } | null = null;

function fail(): never {
  throw new UnauthorizedException('No pudimos validar tu cuenta de Apple');
}

function b64urlToBuf(input: string): Buffer {
  const pad = '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function decodeJwtPart(part: string): Record<string, unknown> {
  try {
    return JSON.parse(b64urlToBuf(part).toString('utf8')) as Record<string, unknown>;
  } catch {
    return fail();
  }
}

function keyFromJwk(jwk: AppleJwk): KeyObject {
  return createPublicKey({
    key: { kty: jwk.kty, n: jwk.n, e: jwk.e } as JsonWebKey,
    format: 'jwk',
  });
}

function verifyRs256(token: string, key: KeyObject): boolean {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) return false;
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${header}.${payload}`);
  verifier.end();
  return verifier.verify(key, b64urlToBuf(signature));
}

function nonceMatches(tokenNonce: string, nonce: string): boolean {
  const hashedHex = createHash('sha256').update(nonce).digest('hex');
  const hashedB64 = createHash('sha256').update(nonce).digest('base64');
  const hashedB64url = createHash('sha256').update(nonce).digest('base64url');
  return (
    tokenNonce === nonce ||
    tokenNonce === hashedHex ||
    tokenNonce === hashedB64 ||
    tokenNonce === hashedB64url
  );
}

/**
 * Comprueba el identity token nativo de Sign in with Apple.
 * No hace falta TEAM_ID / KEY_ID / PRIVATE_KEY: eso es para el flujo web.
 */
@Injectable()
export class AppleTokenService {
  constructor(private configService: ConfigService) {}

  async verify(
    identityToken: string,
    nonce: string,
    fullName?: string,
  ): Promise<AppleIdentity> {
    const audiences = this.configService
      .get<string>('APPLE_CLIENT_ID', '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (!audiences.length) fail();

    const parts = identityToken.split('.');
    if (parts.length !== 3) fail();

    const header = decodeJwtPart(parts[0]);
    const kid = typeof header.kid === 'string' ? header.kid : '';
    if (!kid || header.alg !== 'RS256') fail();

    const jwk = (await this.getAppleKeys()).find((k) => k.kid === kid);
    if (!jwk || !verifyRs256(identityToken, keyFromJwk(jwk))) fail();

    const payload = decodeJwtPart(parts[1]);
    const now = Math.floor(Date.now() / 1000);
    const exp = typeof payload.exp === 'number' ? payload.exp : 0;
    const iss = typeof payload.iss === 'string' ? payload.iss : '';
    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    const aud = payload.aud;
    const audOk =
      typeof aud === 'string'
        ? audiences.includes(aud)
        : Array.isArray(aud) &&
          aud.some((value) => audiences.includes(String(value)));

    if (!sub || iss !== APPLE_ISS || !audOk || exp + CLOCK_SKEW_SEC < now) {
      fail();
    }

    const tokenNonce = typeof payload.nonce === 'string' ? payload.nonce : '';
    if (!nonceMatches(tokenNonce, nonce)) fail();

    const email =
      typeof payload.email === 'string' && payload.email
        ? payload.email
        : undefined;

    return { id: sub, email, name: fullName?.trim() || undefined };
  }

  private async getAppleKeys(): Promise<AppleJwk[]> {
    if (cachedKeys && Date.now() - cachedKeys.fetchedAt < KEYS_TTL_MS) {
      return cachedKeys.keys;
    }
    const res = await fetch(APPLE_KEYS_URL);
    if (!res.ok) fail();
    const body = (await res.json()) as { keys?: AppleJwk[] };
    const keys = body.keys ?? [];
    if (!keys.length) fail();
    cachedKeys = { fetchedAt: Date.now(), keys };
    return keys;
  }
}
