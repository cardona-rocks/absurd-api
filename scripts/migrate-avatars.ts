/**
 * Migra los avatares al nuevo esquema del panel.
 *
 *   npm run migrate:avatars           # aplica los cambios
 *   npm run migrate:avatars -- --dry  # solo enseña lo que haría
 *
 * Qué hace:
 *  0. Rellena `slug` en los avatares que no lo tengan (los creados antes de que
 *     el campo existiera). Sin él, cualquier guardado falla con
 *     "Path `slug` is required".
 *  1. `rarity` (comun/raro/epico/legendario) pasa a `category` (Basic/Rare/…).
 *  2. Los sprites antiguos (profile, base.frontView, base.backView) pasan a la
 *     nueva estructura front/back/default como listas de imágenes.
 *  3. Añade los campos nuevos con valores por defecto.
 *
 * Es idempotente: los documentos ya migrados se saltan.
 */
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { uniqueSlug } from '../src/common/slug';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('Falta MONGODB_URI.');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry');

const RARITY_TO_CATEGORY: Record<string, string> = {
  comun: 'Basic',
  raro: 'Rare',
  epico: 'Epic',
  legendario: 'Legendary',
  legend: 'Legendary',
};

/** Documento antiguo, tal y como estaba antes del panel. */
interface LegacyAvatar {
  _id: mongoose.Types.ObjectId;
  name?: string;
  slug?: string;
  rarity?: string;
  category?: string;
  description?: string;
  sprites?: {
    profile?: unknown;
    base?: { frontView?: unknown; backView?: unknown };
    front?: unknown;
    back?: unknown;
  };
}

/** Convierte lo que hubiera antes en una lista de imágenes nueva. */
function toImages(value: unknown): { url: string; filename: string; order: number }[] {
  const urls: string[] = Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v.length > 0)
    : typeof value === 'string' && value.length > 0
      ? [value]
      : [];

  return urls.map((url, order) => ({
    url,
    // Los sprites antiguos eran URLs externas: no hay fichero local que borrar.
    filename: '',
    order,
  }));
}

async function run() {
  // `connect` devuelve la instancia de Mongoose. Hay que sacar la conexión de
  // ahí: con `import * as mongoose`, `mongoose.connection` llega undefined
  // porque solo es una propiedad de la exportación por defecto, no un export
  // con nombre. `connect` y `model` sí lo son, por eso el resto funciona.
  const instance = await mongoose.connect(MONGODB_URI!);
  console.log(`Conectado a MongoDB.${DRY_RUN ? ' (simulación)' : ''}`);

  const collection = instance.connection.collection('avatars');
  const docs = (await collection.find({}).toArray()) as unknown as LegacyAvatar[];

  // --- Paso 0: slugs que faltan -------------------------------------------
  const taken = new Set(
    docs
      .map((d) => d.slug)
      .filter((s): s is string => typeof s === 'string' && s.length > 0),
  );
  const sinSlug = docs.filter((d) => !d.slug);

  for (const doc of sinSlug) {
    const slug = uniqueSlug(doc.name ?? '', taken);
    console.log(`slug: "${doc.name ?? doc._id.toString()}" → "${slug}"`);
    if (!DRY_RUN) {
      await collection.updateOne({ _id: doc._id }, { $set: { slug } });
    }
    doc.slug = slug;
  }
  if (sinSlug.length) {
    console.log(`${sinSlug.length} slug(s) asignados.\n`);
  }

  let migrated = 0;
  let skipped = 0;

  for (const doc of docs) {
    // Ya tiene la forma nueva: nada que hacer.
    const alreadyNew =
      typeof doc.category === 'string' && Array.isArray(doc.sprites?.front);
    if (alreadyNew) {
      skipped++;
      continue;
    }

    const category =
      (doc.rarity && RARITY_TO_CATEGORY[doc.rarity]) ?? 'Basic';

    const front = toImages(doc.sprites?.front ?? doc.sprites?.base?.frontView);
    const back = toImages(doc.sprites?.back ?? doc.sprites?.base?.backView);
    const byDefault = toImages(doc.sprites?.profile);

    const update = {
      $set: {
        category,
        description: doc.description ?? '',
        hidden: false,
        retired: false,
        sprites: { front, back, default: byDefault, win: [], lose: [] },
      },
      $unset: { rarity: '' },
    };

    console.log(
      `${doc.slug ?? doc._id.toString()}: rarity="${doc.rarity ?? '—'}" → category="${category}"` +
        `  [front:${front.length} back:${back.length} default:${byDefault.length}]`,
    );

    if (!DRY_RUN) {
      await collection.updateOne({ _id: doc._id }, update);
    }
    migrated++;
  }

  console.log(
    `\n${migrated} avatar(es) migrados, ${skipped} ya estaban al día, ` +
      `${sinSlug.length} slug(s) rellenados.` +
      (DRY_RUN ? ' Nada se ha escrito (--dry).' : ''),
  );

  if (!DRY_RUN && migrated > 0) {
    console.log(
      'Recuerda subir imágenes de Frente y Espalda desde el panel: los avatares\n' +
        'visibles las necesitan para poder dibujarse en combate.',
    );
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('La migración falló:', err);
  process.exit(1);
});
