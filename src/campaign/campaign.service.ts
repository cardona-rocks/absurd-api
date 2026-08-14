import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CampaignLevel,
  CampaignLevelDocument,
} from './schemas/campaign-level.schema';
import {
  CampaignRun,
  CampaignRunDocument,
  RunEnemySchema,
} from './schemas/campaign-run.schema';
import {
  planLevel,
  planRange,
  normalizeLevel,
  pickFromPool,
} from './level-plan';
import type { LevelPlan } from './level-plan';
import { pickEnemyChoice } from './enemy-ai';
import { AvatarsService } from '../avatars/avatars.service';
import { UsersService } from '../users/users.service';
import { PowerUpsService } from '../powerups/powerups.service';
import { AchievementsService } from '../achievements/achievements.service';
import { Avatar, AvatarDocument } from '../avatars/schemas/avatar.schema';
import {
  CAMPAIGN_MAX_ROUNDS,
  campaignReward,
  COUNTER_RATE_BY_CLASS,
  LAST_MOVE_WEIGHT_BY_CLASS,
} from '../common/constants/campaign';
import {
  CHOICES,
  DOUBLE_OR_NOTHING_MULTIPLIER,
  MAX_EQUIPPED_POWERUPS,
  PRE_MATCH_POWERUPS,
  resolveRound,
} from '../common/constants/game';
import type { Choice, PowerUpId } from '../common/constants/game';

export interface RunView {
  run: CampaignRunDocument;
  /** La última ronda resuelta, si esta llamada resolvió alguna. */
  round: CampaignRunDocument['rounds'][number] | null;
  /** El enemigo cayó y entra el siguiente: la app encadena la animación. */
  enemyDefeated: boolean;
  gameOver: boolean;
  unlocked: { id: string; name: string; reward: number }[];
}

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);

  constructor(
    @InjectModel(CampaignLevel.name)
    private levelModel: Model<CampaignLevelDocument>,
    @InjectModel(CampaignRun.name)
    private runModel: Model<CampaignRunDocument>,
    @InjectModel(Avatar.name) private avatarModel: Model<AvatarDocument>,
    private avatarsService: AvatarsService,
    private usersService: UsersService,
    private powerUpsService: PowerUpsService,
    private achievementsService: AchievementsService,
  ) {}

  // ------------------------------------------------------------- niveles

  /**
   * Configuración de niveles.
   *
   * Son 20 plantillas más las excepciones que haya: caben de sobra en memoria y
   * se leen en cada plan para que un cambio del panel se note al instante.
   */
  private async configs() {
    return this.levelModel.find().lean().exec();
  }

  /** Qué se va a encontrar el jugador en un nivel concreto. */
  async planFor(level: number): Promise<LevelPlan> {
    return planLevel(level, await this.configs());
  }

  /**
   * El mapa: el nivel al que ha llegado el jugador y los siguientes.
   *
   * No se listan "todos" los niveles porque no hay final; se devuelve una
   * ventana alrededor de donde está, que es lo que la app puede pintar.
   */
  async map(userId: string, count = 12) {
    const user = await this.usersService.getOrThrow(userId);
    const progress = user.campaign;
    const from = Math.max(1, progress.level - 1);
    const configs = await this.configs();

    return {
      progress: {
        level: progress.level,
        cleared: progress.cleared,
        wins: progress.wins,
        loses: progress.loses,
        bestLevel: progress.bestLevel,
      },
      levels: planRange(from, count, configs).map((p) => ({
        ...p,
        // Se puede entrar a cualquier nivel ya alcanzado, para repetirlo.
        unlocked: p.level <= progress.level,
        cleared: p.level < progress.level,
      })),
    };
  }

  // ------------------------------------------------------------ combate

  /** El intento en curso, si lo hay. */
  async active(userId: string): Promise<CampaignRunDocument | null> {
    return this.runModel
      .findOne({ userId: new Types.ObjectId(userId), status: 'In progress' })
      .populate('enemies.avatarId', 'name slug category sprites enemy')
      .exec();
  }

  async getRun(runId: string, userId: string): Promise<CampaignRunDocument> {
    if (!Types.ObjectId.isValid(runId)) {
      throw new NotFoundException('Ese combate no existe');
    }
    const run = await this.runModel
      .findById(runId)
      .populate('enemies.avatarId', 'name slug category sprites enemy')
      .exec();
    if (!run) throw new NotFoundException('Ese combate no existe');
    if (run.userId.toString() !== userId) {
      throw new ForbiddenException('Ese combate no es tuyo');
    }
    return run;
  }

  /**
   * Reparte los enemigos de un nivel.
   *
   * Si el panel fijó cuáles salen, se respetan tal cual. Si no, se toman los de
   * la clase que toca más cercanos al nivel, rotando por el número de nivel
   * para que dos niveles seguidos no saquen siempre a la misma criatura.
   */
  private async castEnemies(plan: LevelPlan): Promise<AvatarDocument[]> {
    const picked: AvatarDocument[] = [];

    for (const id of plan.enemyIds) {
      const enemy = await this.avatarsService.findById(id);
      if (enemy) picked.push(enemy);
    }

    if (picked.length >= plan.enemyCount) {
      return picked.slice(0, plan.enemyCount);
    }

    const pool = await this.avatarsService.findEnemies(
      plan.enemyClass,
      plan.level,
    );
    if (!pool.length) {
      throw new BadRequestException(
        `No hay enemigos de clase ${plan.enemyClass} en el catálogo. ` +
          'Ejecuta `npm run seed:campaign` o créalos desde el panel.',
      );
    }

    // Los candidatos vienen ordenados por cercanía de nivel; el reparto rota
    // entre los más cercanos para dar variedad sin salirse de la dificultad.
    const faltan = plan.enemyCount - picked.length;
    return [...picked, ...pickFromPool(pool, faltan, plan.level)];
  }

  /** Empieza (o retoma) el intento de un nivel. */
  async start(
    userId: string,
    level: number,
    powerUps: PowerUpId[] = [],
  ): Promise<CampaignRunDocument> {
    const user = await this.usersService.getOrThrow(userId);
    const target = normalizeLevel(level);

    // Sólo se entra a niveles ya alcanzados: no se puede saltar al 50 a dedo.
    if (target > user.campaign.level) {
      throw new BadRequestException(
        `Todavía no has llegado al nivel ${target}. Vas por el ${user.campaign.level}.`,
      );
    }

    // Un intento a la vez. Si quedó uno colgado, se abandona antes de abrir otro.
    const running = await this.active(userId);
    if (running) {
      if (running.level === target) return running;
      running.status = 'Abandoned';
      running.endReason = 'forfeit';
      running.finishedAt = new Date();
      await running.save();
    }

    const plan = await this.planFor(target);
    const cast = await this.castEnemies(plan);

    const equipped = await this.validatePowerUps(userId, powerUps);
    const extraHearts = equipped.includes('vida') ? 1 : 0;

    const enemies: RunEnemySchema[] = cast.map((a, i) => ({
      avatarId: a._id,
      name: a.name,
      slug: a.slug,
      class: a.enemy?.class ?? plan.enemyClass,
      hearts: plan.hearts[i],
      maxHearts: plan.hearts[i],
      // El valor del enemigo manda; si no lo tiene, el de su clase.
      counterRate:
        a.enemy?.counterRate ??
        COUNTER_RATE_BY_CLASS[a.enemy?.class ?? plan.enemyClass],
      defeated: false,
    }));

    const run = await this.runModel.create({
      userId: new Types.ObjectId(userId),
      level: plan.level,
      slot: plan.slot,
      cycle: plan.cycle,
      kind: plan.kind,
      levelName: plan.name,
      playerHearts: plan.playerHearts + extraHearts,
      playerMaxHearts: plan.playerHearts + extraHearts,
      enemies,
      equippedPowerUps: equipped,
      // Rejugar un nivel ya superado paga menos: se decide aquí, no al acabar.
      firstClear: plan.level >= user.campaign.level,
    });

    return this.getRun(run._id.toString(), userId);
  }

  /** Comprueba que el jugador tiene los power ups que dice equipar. */
  private async validatePowerUps(
    userId: string,
    powerUps: PowerUpId[],
  ): Promise<PowerUpId[]> {
    const unique = [...new Set(powerUps)].slice(0, MAX_EQUIPPED_POWERUPS);
    const owned: PowerUpId[] = [];

    for (const id of unique) {
      if (await this.powerUpsService.has(userId, id)) owned.push(id);
    }

    // Los de antes del combate se gastan al equiparlos; el resto, al usarlos.
    for (const id of owned) {
      if (PRE_MATCH_POWERUPS.includes(id)) {
        await this.powerUpsService.consume(userId, id);
      }
    }
    return owned;
  }

  /** Juega una ronda: el jugador tira, el enemigo responde y se resuelve. */
  async play(runId: string, userId: string, choice: Choice): Promise<RunView> {
    if (!CHOICES.includes(choice)) {
      throw new BadRequestException('Jugada inválida');
    }

    const run = await this.getRun(runId, userId);
    if (run.status !== 'In progress') {
      throw new BadRequestException('Ese combate ya terminó');
    }

    const enemy = run.enemies[run.currentEnemy];
    if (!enemy) throw new BadRequestException('Ese combate no tiene enemigo');

    // El enemigo decide mirando sólo lo que ya pasó: nunca ve la jugada actual.
    const history = run.rounds.map((r) => r.playerChoice);
    const enemyChoice = pickEnemyChoice(
      {
        counterRate: enemy.counterRate,
        lastMoveWeight: LAST_MOVE_WEIGHT_BY_CLASS[enemy.class],
      },
      history,
    );

    const natural = resolveRound(choice, enemyChoice);
    let winner: 'player' | 'enemy' | 'draw' =
      natural === 'player1'
        ? 'player'
        : natural === 'player2'
          ? 'enemy'
          : 'draw';
    let altered = false;

    // Golpe crítico: fuerza la ronda a favor del jugador.
    if (run.criticalArmed) {
      winner = 'player';
      altered = true;
      run.criticalArmed = false;
    }

    if (winner === 'enemy') {
      if (run.shieldActive) {
        run.shieldActive = false;
        altered = true;
      } else {
        run.playerHearts = Math.max(0, run.playerHearts - 1);
      }
    } else if (winner === 'player') {
      enemy.hearts = Math.max(0, enemy.hearts - 1);
    }

    run.rounds.push({
      enemyIndex: run.currentEnemy,
      playerChoice: choice,
      enemyChoice,
      winner,
      playerHearts: run.playerHearts,
      enemyHearts: enemy.hearts,
      altered,
      playedAt: new Date(),
    });
    const round = run.rounds[run.rounds.length - 1];

    // ¿Cayó este enemigo? En un gauntlet entra el siguiente con el jugador tal
    // como quedó: los corazones perdidos no se recuperan entre enemigos.
    let enemyDefeated = false;
    if (enemy.hearts <= 0) {
      enemy.defeated = true;
      enemyDefeated = true;
      if (run.currentEnemy < run.enemies.length - 1) run.currentEnemy += 1;
    }

    const allDown = run.enemies.every((e) => e.defeated);
    const playerDown = run.playerHearts <= 0;
    const roundLimit = run.rounds.length >= CAMPAIGN_MAX_ROUNDS;

    if (allDown || playerDown || roundLimit) {
      return this.finish(
        run,
        allDown && !playerDown,
        playerDown || allDown ? 'hearts' : 'round-limit',
        round,
        enemyDefeated,
      );
    }

    await run.save();
    return {
      run: await this.getRun(runId, userId),
      round,
      enemyDefeated,
      gameOver: false,
      unlocked: [],
    };
  }

  /** Activa un power up en mitad del combate. */
  async usePowerUp(
    runId: string,
    userId: string,
    powerUpId: PowerUpId,
  ): Promise<{ run: CampaignRunDocument; revealed?: Choice | null }> {
    const run = await this.getRun(runId, userId);
    if (run.status !== 'In progress') {
      throw new BadRequestException('Ese combate ya terminó');
    }
    if (!run.equippedPowerUps.includes(powerUpId)) {
      throw new BadRequestException('No equipaste ese power up');
    }
    if (run.usedPowerUps.includes(powerUpId)) {
      throw new BadRequestException('Ya usaste ese power up');
    }
    if (!(await this.powerUpsService.consume(userId, powerUpId))) {
      throw new BadRequestException('No te quedan unidades de ese power up');
    }

    run.usedPowerUps.push(powerUpId);
    let revealed: Choice | null | undefined;

    switch (powerUpId) {
      case 'escudo':
        run.shieldActive = true;
        break;
      case 'critico':
        run.criticalArmed = true;
        break;
      case 'curita':
        run.playerHearts = Math.min(run.playerMaxHearts, run.playerHearts + 1);
        break;
      case 'revelar': {
        // En campaña el enemigo aún no ha elegido —decide cuando el jugador
        // tira—, así que se enseña a qué tiende: la respuesta a su manía.
        const enemy = run.enemies[run.currentEnemy];
        revealed = pickEnemyChoice(
          {
            counterRate: enemy?.counterRate ?? 0,
            lastMoveWeight: LAST_MOVE_WEIGHT_BY_CLASS[enemy?.class ?? 'Basic'],
          },
          run.rounds.map((r) => r.playerChoice),
        );
        break;
      }
      default:
        throw new BadRequestException('Ese power up no se activa en combate');
    }

    await run.save();
    return { run: await this.getRun(runId, userId), revealed };
  }

  /** Abandona: cuenta como derrota, sin premio de consolación. */
  async forfeit(runId: string, userId: string): Promise<RunView> {
    const run = await this.getRun(runId, userId);
    if (run.status !== 'In progress') {
      throw new BadRequestException('Ese combate ya terminó');
    }
    return this.finish(run, false, 'forfeit', null, false);
  }

  /** Cierra el intento: premio, progreso y logros. */
  private async finish(
    run: CampaignRunDocument,
    won: boolean,
    reason: 'hearts' | 'round-limit' | 'forfeit',
    round: RunView['round'],
    enemyDefeated: boolean,
  ): Promise<RunView> {
    // Sin corazones no se gana por límite de rondas: gana quien siga en pie.
    const survived = run.playerHearts > 0;
    const cleared = won && survived;

    run.status = 'Complete';
    run.won = cleared;
    run.endReason = reason;
    run.finishedAt = new Date();

    const roundsWon = run.rounds.filter((r) => r.winner === 'player').length;

    let credits =
      reason === 'forfeit'
        ? 0
        : campaignReward({
            kind: run.kind,
            roundsWon,
            won: cleared,
            firstClear: run.firstClear,
          });

    // Doble o Nada también vale en campaña: el doble si ganas, nada si no.
    if (run.equippedPowerUps.includes('doble')) {
      credits = cleared ? credits * DOUBLE_OR_NOTHING_MULTIPLIER : 0;
    }
    run.creditsEarned = credits;
    await run.save();

    const userId = run.userId.toString();
    await this.usersService.applyCampaignResult(userId, {
      level: run.level,
      won: cleared,
      credits,
    });

    // Los logros miran las estadísticas globales; la campaña suma créditos
    // ganados, así que conviene revisarlos igual que tras un combate PvP.
    let unlocked: RunView['unlocked'] = [];
    try {
      const gained = await this.achievementsService.sync(userId);
      unlocked = gained.map((a) => ({
        id: a.id,
        name: a.name,
        reward: a.reward,
      }));
    } catch (e) {
      this.logger.error(
        `No se pudieron revisar los logros: ${(e as Error).message}`,
      );
    }

    return {
      run: await this.getRun(run._id.toString(), userId),
      round,
      enemyDefeated,
      gameOver: true,
      unlocked,
    };
  }

  /** Historial de intentos, para la pantalla de progreso. */
  async history(userId: string, limit = 20) {
    return this.runModel
      .find({ userId: new Types.ObjectId(userId), status: 'Complete' })
      .sort({ finishedAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 50))
      .exec();
  }
}
