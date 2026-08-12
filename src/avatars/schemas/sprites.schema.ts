import { Prop, Schema } from '@nestjs/mongoose';

/**
 * Un fotograma de sprite. Cada tipo admite varias imágenes para poder animar;
 * el orden lo marca `order`.
 */
@Schema({ _id: false })
export class SpriteImageSchema {
  /** Ruta pública servida por la API, p. ej. /uploads/avatars/abc.png */
  @Prop({ required: true })
  url: string;

  /** Nombre del fichero en disco, necesario para poder borrarlo. */
  @Prop({ default: '' })
  filename: string;

  @Prop({ default: 0 })
  order: number;

  @Prop({ default: 0 })
  width: number;

  @Prop({ default: 0 })
  height: number;

  @Prop({ default: 0 })
  size: number;

  @Prop({ default: () => new Date() })
  uploadedAt: Date;
}

/**
 * Juegos de sprites por estado. `front` y `back` son obligatorios para poder
 * dibujar el combate; el resto son opcionales.
 */
@Schema({ _id: false })
export class SpritesSchema {
  /** De frente: el rival en la esquina superior. */
  @Prop({ type: [SpriteImageSchema], default: [] })
  front: SpriteImageSchema[];

  /** De espaldas: tu personaje en la esquina inferior. */
  @Prop({ type: [SpriteImageSchema], default: [] })
  back: SpriteImageSchema[];

  /** Reposo, usado en tarjetas y menús. */
  @Prop({ type: [SpriteImageSchema], default: [] })
  default: SpriteImageSchema[];

  @Prop({ type: [SpriteImageSchema], default: [] })
  win: SpriteImageSchema[];

  @Prop({ type: [SpriteImageSchema], default: [] })
  lose: SpriteImageSchema[];
}
