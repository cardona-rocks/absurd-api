/**
 * Siembra el modo campaña: bestiario y plantilla de niveles.
 *
 *   npm run seed:campaign            # aplica los cambios
 *   npm run seed:campaign -- --dry   # sólo enseña lo que haría
 *   npm run seed:campaign -- --force # además, reescribe lo ya sembrado
 *
 * Qué crea:
 *  1. Los enemigos: avatares de categoría `Enemy`, repartidos en común, élite y
 *     jefe y escalonados por nivel para que el bestiario se renueve solo según
 *     avanza la campaña.
 *  2. Las 20 ranuras del ciclo, tal cual las pide el diseño (ver
 *     `src/common/constants/campaign.ts`).
 *
 * Es idempotente: se reconoce lo ya sembrado por el `slug` y por la ranura, así
 * que se puede ejecutar tantas veces como haga falta. Sin `--force` no pisa
 * nada de lo que se haya editado a mano en el panel.
 */
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { DEFAULT_CYCLE } from '../src/common/constants/campaign';
import { COUNTER_RATE_BY_CLASS } from '../src/common/constants/campaign';
import type { EnemyClass } from '../src/common/constants/catalog';
import { slugify } from '../src/common/slug';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('Falta MONGODB_URI. Copia .env.example a .env.');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');

interface EnemySeed {
  name: string;
  class: EnemyClass;
  level: number;
  hearts: number;
  tagline: string;
  description: string;
}

/**
 * El bestiario.
 *
 * Los niveles están escalonados para cubrir los primeros ciclos: la campaña
 * elige, dentro de la clase que toca, los enemigos de nivel más cercano al que
 * se está jugando. Con esto el nivel 3 y el 43 plantean el mismo combate pero
 * con criaturas distintas, sin tocar la plantilla.
 */
const ENEMIES: EnemySeed[] = [
  // ---------------------------------------------------------------- comunes
  {
    name: 'Calcetín Desparejado',
    class: 'Basic',
    level: 1,
    hearts: 3,
    tagline: 'Perdió a su hermano en la lavadora',
    description: 'Lleva años buscando venganza. Y a su par.',
  },
  {
    name: 'Tostada Caída',
    class: 'Basic',
    level: 2,
    hearts: 3,
    tagline: 'Siempre del lado de la mantequilla',
    description: 'La gravedad la humilló una vez. Ahora humilla ella.',
  },
  {
    name: 'Paraguas del Revés',
    class: 'Basic',
    level: 4,
    hearts: 3,
    tagline: 'Un fracaso estructural con orgullo',
    description: 'No protege de nada, pero da mucho miedo cuando se abre.',
  },
  {
    name: 'Cable Enredado',
    class: 'Basic',
    level: 6,
    hearts: 2,
    tagline: 'Estaba recto hace diez segundos',
    description: 'Nadie sabe cómo lo hace. Él tampoco.',
  },
  {
    name: 'Silla Coja',
    class: 'Basic',
    level: 8,
    hearts: 3,
    tagline: 'Cuatro patas, tres de acuerdo',
    description: 'Espera pacientemente a que te confíes.',
  },
  {
    name: 'Bolígrafo Sin Tinta',
    class: 'Basic',
    level: 11,
    hearts: 3,
    tagline: 'Funciona sólo cuando no lo necesitas',
    description: 'Ha rayado más papeles que un auditor.',
  },
  {
    name: 'Wifi de Una Raya',
    class: 'Basic',
    level: 13,
    hearts: 3,
    tagline: 'Conectado, sin internet',
    description: 'Su ataque especial es cargar al 99%.',
  },
  {
    name: 'Chicle en la Suela',
    class: 'Basic',
    level: 16,
    hearts: 3,
    tagline: 'Compromiso a largo plazo',
    description: 'No te suelta. Nunca te ha soltado.',
  },
  {
    name: 'Despertador Cinco Minutos',
    class: 'Basic',
    level: 18,
    hearts: 3,
    tagline: 'Te ha mentido 40 veces esta semana',
    description: 'Negocia contigo y siempre gana él.',
  },
  {
    name: 'Carrito con Rueda Loca',
    class: 'Basic',
    level: 22,
    hearts: 3,
    tagline: 'Va donde quiere, no donde vas',
    description: 'El pasillo del supermercado es su ring.',
  },
  {
    name: 'Bolsa Dentro de Bolsa',
    class: 'Basic',
    level: 25,
    hearts: 3,
    tagline: 'Recursión doméstica',
    description: 'Contiene multitudes. Literalmente.',
  },
  {
    name: 'Táper Sin Tapa',
    class: 'Basic',
    level: 28,
    hearts: 3,
    tagline: 'Su otra mitad está en otra dimensión',
    description: 'Guarda cosas por pura fe.',
  },
  {
    name: 'Pestaña 47',
    class: 'Basic',
    level: 32,
    hearts: 3,
    tagline: 'Está sonando música en alguna parte',
    description: 'Nadie recuerda haberla abierto. Nadie se atreve a cerrarla.',
  },
  {
    name: 'Ticket Ilegible',
    class: 'Basic',
    level: 36,
    hearts: 3,
    tagline: 'La prueba se borró sola',
    description: 'Defiende su inocencia con papel térmico.',
  },

  // ------------------------------------------------------------------ élite
  {
    name: 'Impresora Atascada',
    class: 'Elite',
    level: 10,
    hearts: 4,
    tagline: 'Papel atascado. No hay papel atascado.',
    description:
      'Lleva desde 2004 esperando este momento. Tiene tinta de sobra.',
  },
  {
    name: 'Cargador de Otro Móvil',
    class: 'Elite',
    level: 20,
    hearts: 5,
    tagline: 'Casi encaja. Casi.',
    description: 'La decepción hecha conector. Golpea donde más duele: al 3%.',
  },
  {
    name: 'Aire Acondicionado Rebelde',
    class: 'Elite',
    level: 30,
    hearts: 4,
    tagline: 'Diecisiete grados o nada',
    description: 'Nadie sabe quién tiene el mando. Él sí.',
  },
  {
    name: 'Formulario Obligatorio',
    class: 'Elite',
    level: 40,
    hearts: 5,
    tagline: 'Campo requerido: campo requerido',
    description: 'Se reinicia entero cada vez que te equivocas en uno.',
  },
  {
    name: 'Cita a las 8 de la Mañana',
    class: 'Elite',
    level: 50,
    hearts: 4,
    tagline: 'Con transbordo',
    description:
      'Está en tu calendario desde hace meses. Te lo recuerda ahora.',
  },
  {
    name: 'Grupo Familiar Activo',
    class: 'Elite',
    level: 60,
    hearts: 5,
    tagline: '247 mensajes sin leer',
    description: 'Ataca en oleadas. Y con buenos días animados.',
  },

  // ------------------------------------------------------------------ jefes
  {
    name: 'El Lunes',
    class: 'Boss',
    level: 20,
    hearts: 6,
    tagline: 'Vuelve cada semana, sin falta',
    description: 'El jefe final que nunca se queda derrotado. Siempre regresa.',
  },
  {
    name: 'La Declaración de la Renta',
    class: 'Boss',
    level: 40,
    hearts: 7,
    tagline: 'Resultado: a ingresar',
    description: 'Conoce tus movimientos mejor que tú. Todos ellos.',
  },
  {
    name: 'El Grupo de Trabajo',
    class: 'Boss',
    level: 60,
    hearts: 6,
    tagline: 'Cinco integrantes, uno trabajando',
    description: 'Ataca con reuniones que podrían haber sido un correo.',
  },
  {
    name: 'La Mudanza',
    class: 'Boss',
    level: 80,
    hearts: 7,
    tagline: 'El sofá no pasa por la puerta',
    description: 'Te obliga a decidir qué parte de tu vida cabe en una caja.',
  },
  {
    name: 'El Domingo por la Tarde',
    class: 'Boss',
    level: 100,
    hearts: 7,
    tagline: 'La melancolía a las 19:30',
    description: 'No pega fuerte. Pega hondo.',
  },
];

async function main() {
  const instance = await mongoose.connect(MONGODB_URI!);
  const db = instance.connection;
  const avatars = db.collection('avatars');
  const levels = db.collection('campaignlevels');

  console.log(
    `\nSembrando campaña${DRY_RUN ? ' (simulación)' : ''}${FORCE ? ' [--force]' : ''}\n`,
  );

  // ------------------------------------------------------------- enemigos
  let created = 0;
  let updated = 0;
  let untouched = 0;
  const idBySlug = new Map<string, unknown>();

  for (const [i, e] of ENEMIES.entries()) {
    const slug = slugify(e.name);
    const existing = await avatars.findOne({ slug });

    const doc = {
      name: e.name,
      slug,
      description: e.description,
      tagline: e.tagline,
      ability: '',
      category: 'Enemy',
      // Los enemigos no se venden ni se listan: son del sistema.
      price: 0,
      hidden: true,
      retired: false,
      order: 1000 + i,
      enemy: {
        level: e.level,
        hearts: e.hearts,
        class: e.class,
        counterRate: COUNTER_RATE_BY_CLASS[e.class],
      },
    };

    if (!existing) {
      console.log(
        `  + ${e.class.padEnd(5)} Lv${String(e.level).padStart(3)}  ${e.name}`,
      );
      if (!DRY_RUN) {
        const r = await avatars.insertOne({
          ...doc,
          sprites: { front: [], back: [], default: [], win: [], lose: [] },
          weapons: {},
          stats: { wins: 0, loses: 0, draws: 0 },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        idBySlug.set(slug, r.insertedId);
      }
      created++;
    } else if (FORCE) {
      console.log(`  ~ ${e.name} (reescrito)`);
      if (!DRY_RUN) {
        // Las imágenes subidas nunca se tocan: sólo los datos de ficha.
        await avatars.updateOne(
          { _id: existing._id },
          { $set: { ...doc, updatedAt: new Date() } },
        );
      }
      idBySlug.set(slug, existing._id);
      updated++;
    } else {
      idBySlug.set(slug, existing._id);
      untouched++;
    }
  }

  console.log(
    `\n  Enemigos: ${created} nuevos, ${updated} actualizados, ${untouched} sin tocar.`,
  );

  // -------------------------------------------------------------- niveles
  let slotsCreated = 0;
  let slotsKept = 0;

  for (const spec of DEFAULT_CYCLE) {
    const existing = await levels.findOne({ slot: spec.slot, level: null });

    const doc = {
      slot: spec.slot,
      level: null,
      name: spec.name,
      kind: spec.kind,
      enemyClass: spec.enemyClass,
      enemyCount: spec.enemyCount,
      heartsPerEnemy: spec.heartsPerEnemy,
      heartsPerEnemyAlt: spec.heartsPerEnemyAlt,
      playerHearts: spec.playerHearts,
      // Sin enemigos fijados, la campaña los elige por cercanía de nivel.
      enemies: [],
      enabled: true,
      notes: '',
    };

    if (!existing) {
      const hearts = spec.heartsPerEnemy.join('/');
      const alt = spec.heartsPerEnemyAlt.length
        ? ` (ciclos pares: ${spec.heartsPerEnemyAlt.join('/')})`
        : '';
      console.log(
        `  + Ranura ${String(spec.slot).padStart(2)}  ${spec.kind.padEnd(8)} ` +
          `${spec.enemyCount}× ${spec.enemyClass.padEnd(5)} ${hearts}♥${alt}`,
      );
      if (!DRY_RUN) {
        await levels.insertOne({
          ...doc,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      slotsCreated++;
    } else if (FORCE) {
      if (!DRY_RUN) {
        await levels.updateOne(
          { _id: existing._id },
          { $set: { ...doc, updatedAt: new Date() } },
        );
      }
      console.log(`  ~ Ranura ${spec.slot} (reescrita)`);
      slotsCreated++;
    } else {
      slotsKept++;
    }
  }

  console.log(
    `\n  Niveles: ${slotsCreated} escritos, ${slotsKept} ya estaban ` +
      '(usa --force para reescribirlos).',
  );

  if (DRY_RUN) {
    console.log('\nSimulación: no se guardó nada.\n');
  } else {
    console.log('\nListo. Sube las imágenes de los enemigos desde el panel.\n');
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('\nLa siembra falló:', e instanceof Error ? e.message : e);
  process.exit(1);
});
