// src/coaching/services/laning-coach.service.ts
import { Injectable } from '@nestjs/common';
import type { CoachingAdvice } from '../interfaces/coaching.interface.js';
import type { ProcessedGameState } from '../../gsi/interfaces/processed-game-state.interface.js';
import {
  getExpectedCS,
  getEnemyBuildings,
  hasAnyItemInState,
} from '../utils/team-metrics.js';

/**
 * کوچ لینینگ (۰ تا ۱۰ دقیقه): تعادل کریپ، ترید، لست‌هیت، رون و اسپایک لول.
 */
@Injectable()
export class LaningCoachService {
  private lastAdviceByType = new Map<string, number>();
  private readonly cooldownMs = 30000;

  public getAdvice(state: ProcessedGameState): CoachingAdvice | null {
    if (state.gameTime > 600) {
      return null;
    }

    return (
      this.checkCreepEquilibrium(state) ??
      this.checkTrading(state) ??
      this.checkLastHitting(state) ??
      this.checkRuneControl(state) ??
      this.checkVision(state) ??
      this.checkPowerSpikes(state)
    );
  }

  public clear(): void {
    this.lastAdviceByType.clear();
  }

  private checkCreepEquilibrium(
    state: ProcessedGameState,
  ): CoachingAdvice | null {
    const minute = Math.floor(state.gameTime / 60);
    const second = state.gameTime % 60;

    if (second >= 44 && second <= 50 && minute < 5) {
      return this.build(
        state,
        'pull',
        'MEDIUM',
        'الان کریپ پول کن (0:44) - تعادل لاین را برهم بزن و XP دشمن را قطع کن',
        'pull',
      );
    }

    if (state.gameTime > -5 && state.gameTime < 5) {
      return this.build(
        state,
        'block',
        'LOW',
        'کریپ‌ها را بلاک کن - تعادل لاین را از ابتدا به نفع خودت کن',
        'block',
      );
    }

    return null;
  }

  private checkTrading(state: ProcessedGameState): CoachingAdvice | null {
    const enemies = state.enemies.filter(
      (enemy) => enemy.alive && enemy.visible,
    );
    if (enemies.length === 0) {
      return null;
    }

    if (state.hero.healthPercent < 40 && state.hero.alive) {
      return this.build(
        state,
        'low_hp',
        'HIGH',
        'جان کم داری - برگرد و هیل کن، ترید نکن',
        'retreat',
      );
    }

    const enemyLevel = enemies[0].level ?? state.hero.level;
    if (state.hero.level >= enemyLevel + 2 && state.hero.healthPercent > 60) {
      return this.build(
        state,
        'level_trade',
        'MEDIUM',
        'برتری لول داری - تهاجمی ترید کن، برنده‌ای',
        'trade',
      );
    }

    return null;
  }

  private checkLastHitting(state: ProcessedGameState): CoachingAdvice | null {
    const minute = Math.floor(state.gameTime / 60);
    const expectedCS = getExpectedCS(state.gameTime);
    const actualCS = state.player.lastHits;
    const csPercent = expectedCS > 0 ? (actualCS / expectedCS) * 100 : 0;

    if (csPercent < 70 && minute <= 10) {
      return this.build(
        state,
        'cs',
        'MEDIUM',
        `CS: ${actualCS}/${expectedCS} - روی لست‌هیت تمرکز کن، ${expectedCS - actualCS} کریپ عقبی`,
        'farm',
      );
    }

    return null;
  }

  private checkRuneControl(state: ProcessedGameState): CoachingAdvice | null {
    const minute = Math.floor(state.gameTime / 60);
    const second = state.gameTime % 60;

    if (minute % 2 === 0 && second <= 10 && minute <= 10) {
      return this.build(
        state,
        'power_rune',
        'MEDIUM',
        'پاور رون در حال اسپاون است - اگر امن است بگیر',
        'rune',
      );
    }

    return null;
  }

  private checkVision(state: ProcessedGameState): CoachingAdvice | null {
    const hasObserver = hasAnyItemInState(state, 'ward');

    if (!hasObserver && state.gameTime < 600 && state.gameTime > 60) {
      return this.build(
        state,
        'vision',
        'LOW',
        'Obs در بگیر - دید جلوی گنک را می‌گیرد',
        'ward',
      );
    }

    return null;
  }

  private checkPowerSpikes(state: ProcessedGameState): CoachingAdvice | null {
    if (state.hero.level === 6 && state.gameTime < 600) {
      const hasUltimate = Object.values(state.abilities).some(
        (ability) => ability.isUltimate && ability.level > 0,
      );

      if (hasUltimate) {
        return this.build(
          state,
          'level_6',
          'HIGH',
          'پاور اسپایک لول ۶ - آنلتی آماده است، دنبال کیل باش',
          'power_spike',
        );
      }
    }

    if (state.hero.level === 3 && state.gameTime < 300) {
      const enemyT1sAlive = (getEnemyBuildings(state).t1 ?? []).filter(
        (tower) => !tower.destroyed,
      ).length;

      if (enemyT1sAlive > 0) {
        return this.build(
          state,
          'level_3',
          'MEDIUM',
          'پاور اسپایک لول ۳ - تهاجمی شو، برتری داری',
          'power_spike',
        );
      }
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
