/**
 * Siembra el catálogo de avatares de A.b.s.u.r.d.
 *
 * Es idempotente: hace upsert por `slug`, así que se puede volver a correr sin
 * duplicar nada y sin borrar las estadísticas acumuladas.
 *
 *   npm run seed
 *
 * Los `slug` deben coincidir con los identificadores que usa la app para elegir
 * la ilustración de cada personaje.
 */
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error(
    'Falta MONGODB_URI. Copia .env.example a .env y pon tu cadena de conexión.',
  );
  process.exit(1);
}

// --------------------------------------------------------------- esquemas

const weaponSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    images: [String],
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const weaponsSchema = new mongoose.Schema(
  {
    rock: { type: weaponSchema, default: () => ({}) },
    paper: { type: weaponSchema, default: () => ({}) },
    scissors: { type: weaponSchema, default: () => ({}) },
  },
  { _id: false },
);

const attackWeaponSchema = new mongoose.Schema(
  {
    load: String,
    attack: [String],
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const attackSpritesSchema = new mongoose.Schema(
  {
    rock: { type: attackWeaponSchema, default: () => ({}) },
    paper: { type: attackWeaponSchema, default: () => ({}) },
    scissors: { type: attackWeaponSchema, default: () => ({}) },
  },
  { _id: false },
);

const baseSpritesSchema = new mongoose.Schema(
  { backView: [String], frontView: [String] },
  { _id: false },
);

const damageSpriteSchema = new mongoose.Schema(
  {
    id: String,
    image: String,
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const spriteImageSchema = new mongoose.Schema(
  {
    url: String,
    filename: { type: String, default: '' },
    order: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    size: { type: Number, default: 0 },
  },
  { _id: false },
);

const spritesSchema = new mongoose.Schema(
  {
    front: { type: [spriteImageSchema], default: [] },
    back: { type: [spriteImageSchema], default: [] },
    default: { type: [spriteImageSchema], default: [] },
    win: { type: [spriteImageSchema], default: [] },
    lose: { type: [spriteImageSchema], default: [] },
  },
  { _id: false },
);

const avatarStatsSchema = new mongoose.Schema(
  {
    wins: { type: Number, default: 0 },
    loses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
  },
  { _id: false },
);

const AvatarSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, default: '' },
    tagline: { type: String, default: '' },
    ability: { type: String, default: '' },
    category: {
      type: String,
      enum: ['Basic', 'Rare', 'Epic', 'Legendary', 'Hidden', 'Unique', 'Limited', 'Whalegrade'],
      default: 'Basic',
    },
    order: { type: Number, default: 0 },
    hidden: { type: Boolean, default: false },
    retired: { type: Boolean, default: false },
    weapons: { type: weaponsSchema, default: () => ({}) },
    sprites: { type: spritesSchema, default: () => ({}) },
    stats: { type: avatarStatsSchema, default: () => ({}) },
    price: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const Avatar = mongoose.model('Avatar', AvatarSchema);

// -------------------------------------------------------------- catálogo

interface SeedAvatar {
  slug: string;
  name: string;
  tagline: string;
  ability: string;
  category: 'Basic' | 'Rare' | 'Epic' | 'Legendary' | 'Hidden' | 'Unique' | 'Limited' | 'Whalegrade';
  price: number;
  /** Textos de las tres armas: [piedra, papel, tijera]. */
  weapons: [string, string, string];
}

/**
 * Los dos primeros son los dibujos reales; el resto son las criaturas del
 * prototipo. Si cambias un nombre en el diseño, cambia también el `slug`.
 */
const AVATARS: SeedAvatar[] = [
  {
    slug: 'melenas',
    name: 'El Melenas',
    tagline: 'Rey de nada en particular.',
    ability: 'Melena Intimidante',
    category: 'Legendary',
    price: 0,
    weapons: ['Zarpazo', 'Melena Envolvente', 'Tijeras de Peluquería'],
  },
  {
    slug: 'divorciado',
    name: 'El Divorciado',
    tagline: 'Firmó los papeles y ahora firma victorias.',
    ability: 'Papeleo Infinito',
    category: 'Legendary',
    price: 0,
    weapons: ['Puño de Ejecutivo', 'Acta de Divorcio', 'Corta-Corbatas'],
  },
  {
    slug: 'tostador',
    name: 'El Tostador',
    tagline: 'Nadie sabe cómo llegó aquí.',
    ability: 'Salto de Tostada',
    category: 'Basic',
    price: 250,
    weapons: ['Golpe de Bandeja', 'Servilleta', 'Rebanadora'],
  },
  {
    slug: 'cactus',
    name: 'Don Espinas',
    tagline: 'Abrazos no, gracias.',
    ability: 'Pinchazo Pasivo',
    category: 'Basic',
    price: 250,
    weapons: ['Maceta', 'Hoja Seca', 'Espina Doble'],
  },
  {
    slug: 'pulpo',
    name: 'El Multitasker',
    tagline: 'Ocho brazos, cero organización.',
    ability: 'Ventosa Persistente',
    category: 'Rare',
    price: 400,
    weapons: ['Puño Múltiple', 'Tinta Pegajosa', 'Pinza Naval'],
  },
  {
    slug: 'sofa',
    name: 'El Sofá',
    tagline: 'Lleva tres años en la misma posición.',
    ability: 'Comodidad Aplastante',
    category: 'Rare',
    price: 400,
    weapons: ['Cojinazo', 'Funda Extensible', 'Muelles Sueltos'],
  },
  {
    slug: 'burocrata',
    name: 'El Burócrata',
    tagline: 'Vuelva usted mañana.',
    ability: 'Trámite Eterno',
    category: 'Rare',
    price: 500,
    weapons: ['Sellazo', 'Formulario 27-B', 'Guillotina de Papel'],
  },
  {
    slug: 'mimo',
    name: 'El Mimo',
    tagline: 'Grita por dentro.',
    ability: 'Pared Invisible',
    category: 'Epic',
    price: 700,
    weapons: ['Caja Invisible', 'Pañuelo Infinito', 'Tijeras Imaginarias'],
  },
  {
    slug: 'gallina',
    name: 'La Ansiosa',
    tagline: 'Ya se arrepintió de su jugada.',
    ability: 'Duda Contagiosa',
    category: 'Epic',
    price: 800,
    weapons: ['Picotazo Nervioso', 'Pluma Temblorosa', 'Pico Afilado'],
  },
  {
    slug: 'notario',
    name: 'El Notario',
    tagline: 'Todo lo tuyo es suyo, legalmente.',
    ability: 'Cláusula Oculta',
    category: 'Legendary',
    price: 1200,
    weapons: ['Mazo Notarial', 'Contrato Blindado', 'Cortapapeles de Oro'],
  },
];

function weapon(title: string) {
  return { title, description: '', images: [], settings: {} };
}

async function run() {
  await mongoose.connect(MONGODB_URI!);
  console.log('Conectado a MongoDB.');

  let created = 0;
  let updated = 0;

  for (const [index, a] of AVATARS.entries()) {
    const existing = await Avatar.findOne({ slug: a.slug }).exec();
    // Solo tocamos los campos de catálogo: las stats acumuladas se respetan.
    const payload = {
      name: a.name,
      slug: a.slug,
      tagline: a.tagline,
      ability: a.ability,
      category: a.category,
      price: a.price,
      order: index,
      weapons: {
        rock: weapon(a.weapons[0]),
        paper: weapon(a.weapons[1]),
        scissors: weapon(a.weapons[2]),
      },
    };

    if (existing) {
      await Avatar.updateOne({ _id: existing._id }, { $set: payload }).exec();
      updated++;
    } else {
      await Avatar.create({ ...payload, sprites: {}, stats: {} });
      created++;
    }
  }

  console.log(`Avatares: ${created} creados, ${updated} actualizados.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('El seed falló:', err);
  process.exit(1);
});
