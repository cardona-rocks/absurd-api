import {
  createHash,
  createPublicKey,
  verify as verifySignature,
  type JsonWebKey,
} from 'crypto';
import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const APPLE_ISS = 'https://appleid.apple.com';
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const KEYS_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_SEC = 60;

/** Audiences que esta app emite de verdad: build propio y Expo Go. */
const BUILTIN_AUDIENCES = [
  'com.cardona.rocks.absurd',
  'host.exp.Exponent',
];

interface AppleJwk {
  kty: string;
  kid: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
}

export interface AppleIdentity {
  id: string;
  email?: string;
  name?: string;
}

let cachedKeys: { fetchedAt: number; keys: AppleJwk[] } | null = null;

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function nonceMatches(tokenNonce: string, nonce: string): boolean {
  const hashedHex = sha256Hex(nonce);
  const hashedB64 = createHash('sha256').update(nonce).digest('base64');
  const hashedB64url = createHash('sha256').update(nonce).digest('base64url');
  return (
    tokenNonce === nonce ||
    tokenNonce === hashedHex ||
    tokenNonce === hashedHex.toUpperCase() ||
    tokenNonce === hashedB64 ||
    tokenNonce === hashedB64url
  );
}

function decodeJwtPart(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
}

function audienceOf(aud: unknown): string[] {
  if (typeof aud === 'string') return [aud];
  if (Array.isArray(aud)) return aud.map(String);
  return [];
}

/**
 * Comprueba el identity token nativo de Sign in with Apple.
 * No hace falta TEAM_ID / KEY_ID / PRIVATE_KEY: eso es para el flujo web.
 */
@Injectable()
export class AppleTokenService {
  private readonly logger = new Logger(AppleTokenService.name);

  constructor(private configService: ConfigService) {}

  async verify(
    identityToken: string,
    nonce: string,
    fullName?: string,
  ): Promise<AppleIdentity> {
    const audiences = this.audiences();
    const parts = identityToken.split('.');
    if (parts.length !== 3) {
      this.reject('token malformado');
    }

    let header: Record<string, unknown>;
    let payload: Record<string, unknown>;
    try {
      header = decodeJwtPart(parts[0]);
      payload = decodeJwtPart(parts[1]);
    } catch {
      this.reject('token no es un JWT');
    }

    const kid = typeof header.kid === 'string' ? header.kid : '';
    const alg = header.alg;
    if (!kid || (alg != null && alg !== 'RS256')) {
      this.reject(`cabecera inválida kid=${kid} alg=${String(alg)}`);
    }

    let keys: AppleJwk[];
    try {
      keys = await this.getAppleKeys();
    } catch (e) {
      this.logger.error(
        `No se pudieron bajar las claves de Apple: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      this.reject('claves de Apple no disponibles');
    }

    const jwk = keys.find((k) => k.kid === kid);
    if (!jwk) {
      this.reject(`kid ${kid} no está en el JWKS de Apple`);
    }

    const signed = Buffer.from(`${parts[0]}.${parts[1]}`);
    const signature = Buffer.from(parts[2], 'base64url');
    const key = createPublicKey({
      key: jwk as unknown as JsonWebKey,
      format: 'jwk',
    });
    if (!verifySignature('sha256', signed, key, signature)) {
      this.reject('firma inválida');
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = typeof payload.exp === 'number' ? payload.exp : 0;
    const iss = typeof payload.iss === 'string' ? payload.iss : '';
    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    const tokenAud = audienceOf(payload.aud);
    const audOk = tokenAud.some((value) => audiences.includes(value));

    if (!sub) this.reject('sin sub');
    if (iss !== APPLE_ISS) this.reject(`iss inesperado: ${iss}`);
    if (!audOk) {
      this.reject(
        `aud no coincide. token=${tokenAud.join(',') || '(vacío)'} aceptados=${audiences.join(',')}`,
      );
    }
    if (exp + CLOCK_SKEW_SEC < now) {
      this.reject(`token caducado exp=${exp} now=${now}`);
    }

    const tokenNonce = typeof payload.nonce === 'string' ? payload.nonce : '';
    // Expo Go a veces no mete el nonce en el JWT; la firma ya prueba que es de Apple.
    if (tokenNonce && !nonceMatches(tokenNonce, nonce)) {
      this.reject('nonce no coincide');
    }

    const email =
      typeof payload.email === 'string' && payload.email
        ? payload.email
        : undefined;

    return { id: sub, email, name: fullName?.trim() || undefined };
  }

  private audiences(): string[] {
    const extra = this.configService
      .get<string>('APPLE_CLIENT_ID', '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    return [...new Set([...BUILTIN_AUDIENCES, ...extra])];
  }

  private reject(reason: string): never {
    this.logger.warn(`Apple identity token rechazado: ${reason}`);
    throw new UnauthorizedException('No pudimos validar tu cuenta de Apple');
  }

  private async getAppleKeys(): Promise<AppleJwk[]> {
    if (cachedKeys && Date.now() - cachedKeys.fetchedAt < KEYS_TTL_MS) {
      return cachedKeys.keys;
    }
    const res = await fetch(APPLE_KEYS_URL);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const body = (await res.json()) as { keys?: AppleJwk[] };
    const keys = body.keys ?? [];
    if (!keys.length) throw new Error('JWKS vacío');
    cachedKeys = { fetchedAt: Date.now(), keys };
    return keys;
  }
}
