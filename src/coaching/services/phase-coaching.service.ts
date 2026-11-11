// src/coaching/services/phase-coaching.service.ts
import { Injectable } from '@nestjs/common';
import type {
  CoachingAdvice,
  GamePhase,
  WinConditionAnalysis,
} from '../interfaces/coaching.interface.js';
import type { ProcessedGameState } from '../../gsi/interfaces/processed-game-state.interface.js';
import {
  countReadyUltimates,
  getEnemyBuildings,
  getExpectedCS,
  getLowHealthTowers,
  hasAnyItemInState,
} from '../utils/team-metrics.js';

/**
 * لایه‌ی استراتژیک فاز بازی: توصیه‌ها را با شرط برد ترکیب می‌کند.
 */
@Injectable()
export class PhaseCoachingService {
  public getAdvice(
    state: ProcessedGameState,
    phase: GamePhase,
    winCondition: WinConditionAnalysis | null,
  ): CoachingAdvice | null {
    switch (phase) {
      case 'laning':
        return this.laningPhaseAdvice(state, winCondition);
      case 'midgame':
        return this.midgameAdvice(state, winCondition);
      case 'lategame':
        return this.lategameAdvice(state);
      default:
        return null;
    }
  }

  private laningPhaseAdvice(
    state: ProcessedGameState,
    winCondition: WinConditionAnalysis | null,
  ): CoachingAdvice | null {
    const gameTime = state.gameTime;
    const expectedCS = getExpectedCS(gameTime);

    if (expectedCS && state.player.lastHits < expectedCS * 0.7) {
      return this.advice(
        state,
        'HIGH',
        `CS: ${state.player.lastHits}/${expectedCS} - روی فارم تمرکز کن، برای تایمینگ پوش گلد لازم داری`,
        'farm',
      );
    }

    if (gameTime >= 240 && gameTime <= 260) {
      return this.advice(
        state,
        'MEDIUM',
        'وارد آب ۴ دقیقه اسپاون می‌شود - برای XP و گلد بگیر',
        'rune_timing',
      );
    }

    if (gameTime >= 290 && gameTime <= 310) {
      return this.advice(
        state,
        'MEDIUM',
        'نزدیک ۵ دقیقه - اولین شب بازی شروع می‌شود (پاور اسپایک Night Stalker)',
        'timing_window',
      );
    }

    if (winCondition?.primaryCondition === 'earlyPush') {
      const lowT1 = getLowHealthTowers(getEnemyBuildings(state), 50).find(
        (tower) => tower.name.includes('t1'),
      );

      if (lowT1 && state.hero.healthPercent > 50) {
        return this.advice(
          state,
          'HIGH',
          'T1 دشمن جان کم دارد - با موج بعدی گروهی تمامش کنید (استراتژی پوش زودهنگام)',
          'tower_opportunity',
        );
      }
    }

    if (state.hero.level === 6 && countReadyUltimates(state) > 0) {
      return this.advice(
        state,
        'MEDIUM',
        'لول ۶ - آنلتی آماده است، دنبال کیل یا آبجکتیو باش',
        'timing_window',
      );
    }

    return null;
  }

  private midgameAdvice(
    state: ProcessedGameState,
    winCondition: WinConditionAnalysis | null,
  ): CoachingAdvice | null {
    const gameTime = state.gameTime;

    if (gameTime >= 900 && gameTime <= 1200) {
      const hasBKB = hasAnyItemInState(state, 'black_king_bar');

      if (!hasBKB && winCondition?.keyItems.includes('black_king_bar')) {
        const goldNeeded = 3975 - state.player.gold;
        if (goldNeeded > 0 && goldNeeded < 1000) {
          const etaSeconds =
            state.player.gpm > 0
              ? Math.ceil((goldNeeded / state.player.gpm) * 60)
              : undefined;
          const etaText = etaSeconds ? `${etaSeconds} ثانیه` : 'کمی';

          return this.advice(
            state,
            'HIGH',
            `BKB حدود ${etaText} دیگر - فارم کن، بعد از کامل شدن گروه شو`,
            'farm',
          );
        }
      }
    }

    if (
      gameTime >= 1200 &&
      gameTime <= 1800 &&
      !state.roshan.alive &&
      state.roshan.respawnTime
    ) {
      const timeUntilRespawn = state.roshan.respawnTime - gameTime;
      if (timeUntilRespawn < 120 && timeUntilRespawn > 0) {
        return this.advice(
          state,
          'HIGH',
          `روشان ${Math.floor(timeUntilRespawn)} ثانیه دیگر اسپاون می‌شود - آماده‌ی گرفتن آیجیس باش`,
          'roshan',
        );
      }
    }

    const lowT2 = getLowHealthTowers(getEnemyBuildings(state), 40).find(
      (tower) => tower.name.includes('t2'),
    );

    if (lowT2 && state.hero.healthPercent > 60) {
      return this.advice(
        state,
        'HIGH',
        `T2 دشمن روی ${Math.floor(lowT2.healthPercent)}% است - گروهی تمامش کنید`,
        'push',
      );
    }

    return null;
  }

  private lategameAdvice(state: ProcessedGameState): CoachingAdvice | null {
    const enemyBuildings = getEnemyBuildings(state);
    const ancient = enemyBuildings.ancient;

    if (
      ancient &&
      !ancient.destroyed &&
      ancient.healthPercent > 0 &&
      ancient.healthPercent < 50
    ) {
      return this.advice(
        state,
        'GAME_ENDING',
        `Ancient دشمن روی ${Math.floor(ancient.healthPercent)}% است - همین حالا تمامش کن`,
        'end_game',
      );
    }

    const aliveT3s = (enemyBuildings.t3 ?? []).filter(
      (tower) => !tower.destroyed,
    );
    const aliveBarracks = (enemyBuildings.barracks ?? []).filter(
      (barracks) => !barracks.destroyed,
    );

    if (aliveT3s.length === 0 && aliveBarracks.length > 0) {
      return this.advice(
        state,
        'CRITICAL',
        'T3ها افتاده‌اند - رکس را بزن و مگاکریپ بساز، بعد بازی را تمام کن',
        'highground',
      );
    }

    const deadCoresNoBuyback = state.enemies.filter(
      (enemy) =>
        !enemy.alive &&
        !enemy.buybackAvailable &&
        enemy.netWorth > state.player.netWorth * 0.7,
    );

    if (deadCoresNoBuyback.length > 0) {
      return this.advice(
        state,
        'GAME_ENDING',
        'کری دشمن مرده و بای‌بک ندارد - این پنجره‌ی تمام کردن بازی است',
        'end_game',
      );
    }

    return null;
  }

  private advice(
    state: ProcessedGameState,
    priority: CoachingAdvice['priority'],
    message: string,
    action: string,
  ): CoachingAdvice {
    return {
      priority,
      message,
      action,
      timestamp: Date.now(),
      gameTime: state.gameTime,
    };
  }
}
