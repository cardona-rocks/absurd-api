import { createHash, createHmac } from 'crypto';

/**
 * Cliente S3 mínimo con firma AWS Signature V4.
 *
 * Solo hacen falta tres operaciones sobre objetos sueltos (subir, leer, borrar),
 * así que se firma a mano en vez de arrastrar el SDK de AWS entero. Como la
 * firma está completamente especificada, se puede comprobar contra los vectores
 * de prueba oficiales de AWS — cosa que con el SDK no podríamos hacer aquí.
 *
 * Funciona con cualquier almacenamiento compatible con S3 (el bucket de
 * Railway, MinIO, R2, S3…) porque usa URLs de tipo path:
 *   https://endpoint/bucket/clave
 */

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const ALGORITHM = 'AWS4-HMAC-SHA256';
const SERVICE = 's3';

const sha256Hex = (data: string | Buffer) =>
  createHash('sha256').update(data).digest('hex');

const hmac = (key: string | Buffer, data: string) =>
  createHmac('sha256', key).update(data, 'utf8').digest();

/**
 * Codificación de URI que exige AWS: solo quedan sin escapar los caracteres no
 * reservados. `encodeURIComponent` deja pasar `!'()*`, que AWS sí espera
 * escapados, así que no sirve.
 */
export function uriEncode(value: string, encodeSlash = true): string {
  let out = '';
  for (const byte of Buffer.from(value, 'utf8')) {
    const ch = String.fromCharCode(byte);
    if (/[A-Za-z0-9\-._~]/.test(ch)) {
      out += ch;
    } else if (ch === '/' && !encodeSlash) {
      out += '/';
    } else {
      out += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
    }
  }
  return out;
}

/** Marca temporal en los dos formatos que pide la firma. */
export function amzDates(now = new Date()) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

export interface SignedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
}

/**
 * Firma una petición. Se expone aparte de `send` para poder comprobarla contra
 * los vectores oficiales sin tocar la red.
 */
export function signRequest(params: {
  config: S3Config;
  method: string;
  /** Ruta absoluta ya con el bucket, p. ej. /mi-bucket/avatars/x.png */
  path: string;
  headers: Record<string, string>;
  payload: Buffer | string;
  now?: Date;
}): SignedRequest {
  const { config, method, path, payload } = params;
  const { amzDate, dateStamp } = amzDates(params.now ?? new Date());

  const host = new URL(config.endpoint).host;
  const payloadHash = sha256Hex(payload);

  const headers: Record<string, string> = {
    ...params.headers,
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };

  // Cabeceras canónicas: nombre en minúsculas, valor recortado, ordenadas.
  const sortedNames = Object.keys(headers)
    .map((h) => h.toLowerCase())
    .sort();
  const lowerHeaders = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()]),
  );
  const canonicalHeaders =
    sortedNames.map((n) => `${n}:${lowerHeaders[n]}`).join('\n') + '\n';
  const signedHeaders = sortedNames.join(';');

  const canonicalUri = uriEncode(path, false);

  const canonicalRequest = [
    method,
    canonicalUri,
    '', // sin query en ninguna de las operaciones que usamos
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${config.region}/${SERVICE}/aws4_request`;
  const stringToSign = [
    ALGORITHM,
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region), SERVICE),
    'aws4_request',
  );
  const signature = createHmac('sha256', signingKey)
    .update(stringToSign, 'utf8')
    .digest('hex');

  return {
    url: `${config.endpoint.replace(/\/$/, '')}${canonicalUri}`,
    method,
    headers: {
      ...headers,
      Authorization:
        `${ALGORITHM} Credential=${config.accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

export class S3Error extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
  }
}

/** Cliente de objetos: subir, descargar y borrar. */
export class S3Client {
  constructor(private readonly config: S3Config) {}

  private objectPath(key: string): string {
    return `/${this.config.bucket}/${key.replace(/^\/+/, '')}`;
  }

  /** URL pública del objeto (solo sirve si el bucket es de lectura abierta). */
  publicUrl(key: string): string {
    return `${this.config.endpoint.replace(/\/$/, '')}${uriEncode(this.objectPath(key), false)}`;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const signed = signRequest({
      config: this.config,
      method: 'PUT',
      path: this.objectPath(key),
      headers: {
        'content-type': contentType,
        'content-length': String(body.length),
      },
      payload: body,
    });

    const res = await fetch(signed.url, {
      method: 'PUT',
      headers: signed.headers,
      body: new Uint8Array(body),
    });

    if (!res.ok) {
      throw new S3Error(
        `No se pudo subir "${key}" al bucket (${res.status})`,
        res.status,
        await res.text().catch(() => ''),
      );
    }
  }

  async get(
    key: string,
  ): Promise<{ body: Buffer; contentType: string } | null> {
    const signed = signRequest({
      config: this.config,
      method: 'GET',
      path: this.objectPath(key),
      headers: {},
      payload: '',
    });

    const res = await fetch(signed.url, {
      method: 'GET',
      headers: signed.headers,
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      throw new S3Error(
        `No se pudo leer "${key}" del bucket (${res.status})`,
        res.status,
        await res.text().catch(() => ''),
      );
    }

    return {
      body: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get('content-type') ?? 'application/octet-stream',
    };
  }

  async delete(key: string): Promise<void> {
    const signed = signRequest({
      config: this.config,
      method: 'DELETE',
      path: this.objectPath(key),
      headers: {},
      payload: '',
    });

    const res = await fetch(signed.url, {
      method: 'DELETE',
      headers: signed.headers,
    });

    // 404 al borrar no es un problema: el objeto ya no está.
    if (!res.ok && res.status !== 404) {
      throw new S3Error(
        `No se pudo borrar "${key}" del bucket (${res.status})`,
        res.status,
        await res.text().catch(() => ''),
      );
    }
  }

  /** Prueba de escritura y borrado, para el diagnóstico del panel. */
  async check(): Promise<void> {
    const key = `.write-test-${Date.now()}`;
    await this.put(key, Buffer.from('ok'), 'text/plain');
    await this.delete(key);
  }
}
