// src/coaching/services/midgame-coach.service.ts
import { Injectable } from '@nestjs/common';
import type { CoachingAdvice } from '../interfaces/coaching.interface.js';
import type { ProcessedGameState } from '../../gsi/interfaces/processed-game-state.interface.js';
import {
  countAliveEnemies,
  countDeadEnemies,
  countReadyUltimates,
  getEnemyBuildings,
  getEnemyNetWorth,
  getLowHealthTowers,
  hasAnyItemInState,
} from '../utils/team-metrics.js';

/**
 * کوچ مید‌گیم (۱۰ تا ۳۰ دقیقه): آبجکتیو، فایت تیمی، پاور اسپایک و راندمان فارم.
 */
@Injectable()
export class MidgameCoachService {
  private lastAdviceByType = new Map<string, number>();
  private readonly cooldownMs = 45000;

  public getAdvice(state: ProcessedGameState): CoachingAdvice | null {
    if (state.gameTime < 600 || state.gameTime > 1800) {
      return null;
    }

    return (
      this.checkObjectives(state) ??
      this.checkTeamfights(state) ??
      this.checkPowerSpikes(state) ??
      this.checkFarmEfficiency(state)
    );
  }

  public clear(): void {
    this.lastAdviceByType.clear();
  }

  private checkObjectives(state: ProcessedGameState): CoachingAdvice | null {
    const enemyBuildings = getEnemyBuildings(state);
    const deadEnemies = countDeadEnemies(state);
    const lowTowers = getLowHealthTowers(enemyBuildings, 50).filter(
      (tower) =>
        (enemyBuildings.t1 ?? []).includes(tower) ||
        (enemyBuildings.t2 ?? []).includes(tower),
    );

    if (lowTowers.length > 0 && deadEnemies >= 2 && state.hero.alive) {
      return this.build(
        state,
        'push_tower',
        'HIGH',
        `همین حالا ${lowTowers[0].name} را بزن - ${deadEnemies} نفر از دشمن مرده‌اند`,
        'push',
      );
    }

    if (
      state.roshan.alive &&
      deadEnemies >= 2 &&
      countAliveEnemies(state) <= 2
    ) {
      const hasVision = hasAnyItemInState(state, ['ward', 'gem']);

      return hasVision
        ? this.build(
            state,
            'roshan',
            'HIGH',
            'روشان آزاد است - ۲+ نفر مرده‌اند، آیجیس را بگیر',
            'roshan',
          )
        : this.build(
            state,
            'roshan_vision',
            'MEDIUM',
            'روشان آزاد است ولی دید نداری - اول وارد بگذار بعد برو',
            'ward',
          );
    }

    return null;
  }

  private checkTeamfights(state: ProcessedGameState): CoachingAdvice | null {
    const aliveEnemies = countAliveEnemies(state);
    if (aliveEnemies === 0) {
      return null;
    }

    const ultimatesReady = countReadyUltimates(state);
    const alliesNearby = state.team.players.length;

    if (aliveEnemies >= 3 && alliesNearby >= 4 && ultimatesReady >= 2) {
      return this.build(
        state,
        'teamfight',
        'HIGH',
        'برتری فایت تیمی - ۲+ آنلتی آماده است، فایت را فورس کن',
        'fight',
      );
    }

    if (
      hasAnyItemInState(state, 'black_king_bar') &&
      state.hero.healthPercent < 60
    ) {
      return this.build(
        state,
        'bkb_usage',
        'MEDIUM',
        'جان کم داری و BKB داری - اگر استن می‌خوری BKB بزن',
        'item_usage',
      );
    }

    return null;
  }

  private checkPowerSpikes(state: ProcessedGameState): CoachingAdvice | null {
    const hero = state.hero;
    const gameTime = state.gameTime;

    if (hero.level === 12 && gameTime < 1800) {
      return this.build(
        state,
        'level_12',
        'MEDIUM',
        'تالنت لول ۱۲ باز شد - قدرتت بیشتر شد، دنبال پلی باش',
        'power_spike',
      );
    }

    if (
      hasAnyItemInState(state, 'black_king_bar') &&
      gameTime >= 1200 &&
      gameTime <= 1500
    ) {
      return this.build(
        state,
        'bkb_timing',
        'HIGH',
        'تایمینگ BKB - گروه شو و پوش بده، این پنجره‌ی توست',
        'push',
      );
    }

    if (
      hasAnyItemInState(state, 'blink') &&
      gameTime >= 600 &&
      gameTime <= 1200
    ) {
      const needsBlink = [
        'axe',
        'centaur',
        'tide',
        'enigma',
        'earthshaker',
      ].some((name) => hero.name.toLowerCase().includes(name));

      if (needsBlink) {
        return this.build(
          state,
          'blink_timing',
          'HIGH',
          'بلینک کامل شد - پلی بساز و کری‌های دشمن را شکار کن',
          'initiate',
        );
      }
    }

    return null;
  }

  private checkFarmEfficiency(
    state: ProcessedGameState,
  ): CoachingAdvice | null {
    if (state.enemies.length < 4) {
      return null;
    }

    const delta = state.team.netWorth - getEnemyNetWorth(state);

    if (delta < -3000 && state.gameTime < 1800) {
      return this.build(
        state,
        'behind_farm',
        'MEDIUM',
        'از نظر گلد عقبی - امن فارم کن و فایت ریسکی نده',
        'farm',
      );
    }

    if (delta > 5000 && state.player.lastHits > 0 && state.gameTime < 1500) {
      return this.build(
        state,
        'ahead_push',
        'LOW',
        'برتری بزرگ - فارم را قطع کن، گروه شو و آبجکتیو بزن',
        'group',
      );
    }

    return null;
  }

  private build(
    state: ProcessedGameState,
    type: string,
    priority: CoachingAdvice['priority'],
    message: string,
    action: string,
  ): CoachingAdvice | null {
    const now = Date.now();
    const last = this.lastAdviceByType.get(type) ?? 0;
    if (now - last < this.cooldownMs) {
      return null;
    }

    this.lastAdviceByType.set(type, now);

    return {
      priority,
      message,
      action,
      timestamp: now,
      gameTime: state.gameTime,
    };
  }
}
