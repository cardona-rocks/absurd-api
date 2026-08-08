import { PowerUpId } from '../common/constants/game';

export interface PowerUpDefinition {
  id: PowerUpId;
  /** Nombre del icono (Material Symbols) usado por la app. */
  icon: string;
  name: string;
  price: number;
  /** '' para tinta negra, 'red' para acento rojo. */
  tone: '' | 'red';
  desc: string;
  /** Si se activa al empezar el combate en vez de durante una ronda. */
  preMatch: boolean;
}

/**
 * Catálogo fijo de power ups. Vive en código porque las reglas de cada uno
 * están implementadas en el motor de combate, no en datos.
 */
export const POWERUPS: PowerUpDefinition[] = [
  {
    id: 'escudo',
    icon: 'shield',
    name: 'Escudo Absurdo',
    price: 300,
    tone: '',
    desc: 'Bloquea el próximo corazón que perderías. Cobardía estratégica.',
    preMatch: false,
  },
  {
    id: 'critico',
    icon: 'bolt',
    name: 'Golpe Crítico',
    price: 500,
    tone: 'red',
    desc: 'Ganas la siguiente ronda sí o sí. Sin importar qué juegue el rival.',
    preMatch: false,
  },
  {
    id: 'vida',
    icon: 'favorite',
    name: 'Vida Extra',
    price: 700,
    tone: 'red',
    desc: 'Empiezas el combate con 4 corazones en vez de 3.',
    preMatch: true,
  },
  {
    id: 'revelar',
    icon: 'visibility',
    name: 'Ojo Chismoso',
    price: 450,
    tone: '',
    desc: 'Espía la jugada del rival una vez por combate. Trampa elegante.',
    preMatch: false,
  },
  {
    id: 'curita',
    icon: 'healing',
    name: 'Curita Mágica',
    price: 400,
    tone: '',
    desc: 'Recupera 1 corazón a mitad del combate. Drama recuperado.',
    preMatch: false,
  },
  {
    id: 'doble',
    icon: 'casino',
    name: 'Doble o Nada',
    price: 600,
    tone: 'red',
    desc: 'Si ganas cobras el doble de créditos. Si pierdes no cobras nada.',
    preMatch: true,
  },
];

export const POWERUP_MAP: Record<string, PowerUpDefinition> = Object.fromEntries(
  POWERUPS.map((p) => [p.id, p]),
);

export function getPowerUp(id: string): PowerUpDefinition | undefined {
  return POWERUP_MAP[id];
}
