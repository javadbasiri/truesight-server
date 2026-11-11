// src/coaching/services/lategame-coach.service.ts
import { Injectable } from '@nestjs/common';
import type { CoachingAdvice } from '../interfaces/coaching.interface.js';
import type { ProcessedGameState } from '../../gsi/interfaces/processed-game-state.interface.js';
import {
  countDeadEnemies,
  getEnemyBuildings,
  getEnemyNetWorth,
} from '../utils/team-metrics.js';

/**
 * کوچ لیت‌گیم (۳۰ دقیقه به بعد): هایگراند، بای‌بک و اجرای شرط برد.
 */
@Injectable()
export class LategameCoachService {
  private lastAdviceByType = new Map<string, number>();
  private readonly cooldownMs = 60000;

  public getAdvice(state: ProcessedGameState): CoachingAdvice | null {
    if (state.gameTime < 1800) {
      return null;
    }

    return (
      this.checkHighGround(state) ??
      this.checkBuybacks(state) ??
      this.checkWinConditions(state) ??
      this.checkDeathTimers(state)
    );
  }

  public clear(): void {
    this.lastAdviceByType.clear();
  }

  private checkHighGround(state: ProcessedGameState): CoachingAdvice | null {
    const enemyBuildings = getEnemyBuildings(state);
    const aliveT3s = (enemyBuildings.t3 ?? []).filter(
      (tower) => !tower.destroyed,
    );
    const aliveBarracks = (enemyBuildings.barracks ?? []).filter(
      (barracks) => !barracks.destroyed,
    );

    if (aliveT3s.length === 0 && aliveBarracks.length > 0) {
      const deadEnemies = countDeadEnemies(state);
      const hasAegis = state.roshan.aegisHolder === state.player.team;

      if (deadEnemies >= 2 || hasAegis) {
        return this.build(
          state,
          'rax_push',
          'CRITICAL',
          'فرصت هایگراند - T3ها افتاده‌اند، همین حالا رکس را بزن',
          'push',
        );
      }
    }

    const lowT3s = aliveT3s.filter(
      (tower) => tower.healthPercent > 0 && tower.healthPercent < 50,
    );

    if (lowT3s.length > 0) {
      return this.build(
        state,
        't3_low',
        'HIGH',
        `T3 روی ${Math.floor(lowT3s[0].healthPercent)}% است - تمامش کن و عقب نکش`,
        'push',
      );
    }

    return null;
  }

  private checkBuybacks(state: ProcessedGameState): CoachingAdvice | null {
    if (
      state.gameTime > 2400 &&
      state.hero.buybackAvailable &&
      state.hero.alive
    ) {
      const enemyT3sAlive = (getEnemyBuildings(state).t3 ?? []).filter(
        (tower) => !tower.destroyed,
      ).length;

      if (enemyT3sAlive === 0) {
        return this.build(
          state,
          'save_buyback',
          'HIGH',
          'بای‌بک را نگه دار - فقط برای دفاع از Ancient یا تمام کردن بازی استفاده کن',
          'save_buyback',
        );
      }
    }

    if (state.gameTime > 2400) {
      const enemiesNoBuyback = state.enemies.filter(
        (enemy) =>
          !enemy.buybackAvailable &&
          enemy.netWorth > state.team.netWorth * 0.15,
      );

      if (enemiesNoBuyback.length >= 1) {
        return this.build(
          state,
          'enemy_no_buyback',
          'CRITICAL',
          'کری دشمن بای‌بک ندارد - بکش و بازی را تمام کن',
          'end_game',
        );
      }
    }

    return null;
  }

  private checkWinConditions(state: ProcessedGameState): CoachingAdvice | null {
    if (state.enemies.length < 4) {
      return null;
    }

    const delta = state.team.netWorth - getEnemyNetWorth(state);

    if (
      delta > 15000 &&
      state.gameTime > 2400 &&
      countDeadEnemies(state) >= 2
    ) {
      return this.build(
        state,
        'massive_lead',
        'CRITICAL',
        'برتری عظیم + دشمن مرده - همین حالا بازی را تمام کن، فارم نکن',
        'end_game',
      );
    }

    return null;
  }

  private checkDeathTimers(state: ProcessedGameState): CoachingAdvice | null {
    if (state.gameTime > 3000) {
      return this.build(
        state,
        'ultra_late',
        'HIGH',
        'مرگ یعنی باختن بازی - فقط پیک‌آف بازی کن، ریسک نکن',
        'play_safe',
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
