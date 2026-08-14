import { Prop, Schema } from '@nestjs/mongoose';
import { ENEMY_CLASSES } from '../../common/constants/catalog';
import type { EnemyClass } from '../../common/constants/catalog';

/**
 * Datos que sólo tienen sentido en un avatar de categoría `Enemy`.
 *
 * Va como subdocumento y no como colección aparte para reutilizar tal cual el
 * catálogo, el gestor de sprites y las subidas del panel: un enemigo es un
 * avatar más, sólo que del sistema.
 */
@Schema({ _id: false })
export class EnemySchema {
  /**
   * Nivel de campaña para el que está pensado. La campaña elige, entre los
   * enemigos de la clase que toca, los de nivel más cercano al que se juega.
   */
  @Prop({ default: 1, min: 1 })
  level: number;

  /** Corazones por defecto. El nivel puede pedir otros distintos. */
  @Prop({ default: 3, min: 1, max: 12 })
  hearts: number;

  @Prop({ enum: ENEMY_CLASSES, default: 'Basic' })
  class: EnemyClass;

  /**
   * Cuánto lee las manías del jugador, de 0 a 1.
   *
   * 0 es puro azar; 1 responde siempre a lo que el jugador más repite. Los
   * valores por defecto de cada clase están en `campaign.ts`; esto permite
   * afinar un enemigo concreto desde el panel.
   */
  @Prop({ type: Number, default: null, min: 0, max: 1 })
  counterRate: number | null;
}
