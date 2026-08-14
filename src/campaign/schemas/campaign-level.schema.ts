import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { LEVEL_KINDS } from '../../common/constants/campaign';
import type { LevelKind } from '../../common/constants/campaign';
import { ENEMY_CLASSES } from '../../common/constants/catalog';
import type { EnemyClass } from '../../common/constants/catalog';

export type CampaignLevelDocument = CampaignLevel & Document;

/**
 * Configuración de un nivel de campaña.
 *
 * Un mismo documento sirve para dos cosas según `level`:
 *
 * - `level: null` → plantilla de una de las 20 ranuras del ciclo. Vale para
 *   todos los niveles que caen en esa ranura: el 3, el 23, el 43…
 * - `level: 47`   → excepción para ese nivel exacto. Manda sobre la plantilla.
 *
 * Con esto la campaña es infinita sin guardar filas infinitas, y aun así se
 * puede hacer especial un nivel concreto desde el panel.
 */
@Schema({ timestamps: true })
export class CampaignLevel {
  /** Ranura del ciclo, de 1 a 20. */
  @Prop({ required: true, min: 1, max: 20 })
  slot: number;

  /** Nivel absoluto si es una excepción; null si es plantilla del ciclo. */
  @Prop({ type: Number, default: null, min: 1 })
  level: number | null;

  /** Nombre que ve el jugador. Vacío usa uno automático ("Nivel 7"). */
  @Prop({ default: '', trim: true })
  name: string;

  @Prop({ enum: LEVEL_KINDS, default: 'basic' })
  kind: LevelKind;

  /** Clase de enemigo que sale en este nivel. */
  @Prop({ enum: ENEMY_CLASSES, default: 'Basic' })
  enemyClass: EnemyClass;

  /** Cuántos enemigos hay que tumbar, uno tras otro. */
  @Prop({ default: 1, min: 1, max: 5 })
  enemyCount: number;

  /**
   * Corazones de cada enemigo, en orden. Si tiene menos entradas que enemigos,
   * los que sobran repiten el último valor.
   */
  @Prop({ type: [Number], default: [3] })
  heartsPerEnemy: number[];

  /**
   * Corazones en los ciclos pares (niveles 21-40, 61-80…).
   *
   * Es como se representa la horquilla del diseño —"élite con 4 o 5", "jefe con
   * 6 o 7"— sin recurrir al azar: la segunda vuelta aprieta un punto más.
   * Vacío significa que la ranura no varía entre ciclos.
   */
  @Prop({ type: [Number], default: [] })
  heartsPerEnemyAlt: number[];

  @Prop({ default: 3, min: 1, max: 10 })
  playerHearts: number;

  /**
   * Enemigos concretos que salen en este nivel, en orden.
   *
   * Vacío deja elegir a la campaña entre los de la clase que toca, por
   * cercanía de nivel: así el bestiario se renueva solo según se avanza sin
   * tener que fijar nada a mano.
   */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Avatar' }], default: [] })
  enemies: Types.ObjectId[];

  /** Desactiva una excepción sin borrarla. */
  @Prop({ default: true })
  enabled: boolean;

  /** Nota del equipo, nunca se enseña al jugador. */
  @Prop({ default: '' })
  notes: string;
}

export const CampaignLevelSchema = SchemaFactory.createForClass(CampaignLevel);

// Una sola plantilla por ranura y una sola excepción por nivel. El índice
// parcial deja convivir las 20 plantillas (level: null) con las excepciones.
CampaignLevelSchema.index(
  { slot: 1 },
  { unique: true, partialFilterExpression: { level: null } },
);
CampaignLevelSchema.index(
  { level: 1 },
  { unique: true, partialFilterExpression: { level: { $type: 'number' } } },
);
