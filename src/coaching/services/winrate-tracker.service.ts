// src/coaching/services/winrate-tracker.service.ts
import { Injectable } from '@nestjs/common';
import type { ProcessedGameState } from '../../gsi/interfaces/processed-game-state.interface.js';

export interface CombatRecord {
  timestamp: number;
  gameTime: number;
  yourHero: string;
  enemyHero: string;
  predictedWinProb: number;
  actualOutcome?: 'win' | 'loss' | 'draw';
  factors: string[];
}

/**
 * پیش‌بینی‌های نبرد را ثبت می‌کند و وین‌ریت/دقت پیش‌بینی را محاسبه می‌کند.
 */
@Injectable()
export class WinrateTrackerService {
  private combatHistory: CombatRecord[] = [];
  private readonly maxHistory = 100;

  public recordPrediction(
    state: ProcessedGameState,
    enemyHero: string,
    predictedWinProb: number,
    factors: string[],
  ): void {
    this.combatHistory.push({
      timestamp: Date.now(),
      gameTime: state.gameTime,
      yourHero: state.hero.name,
      enemyHero,
      predictedWinProb,
      factors,
    });

    if (this.combatHistory.length > this.maxHistory) {
      this.combatHistory.shift();
    }
  }

  public recordOutcome(outcome: 'win' | 'loss' | 'draw'): void {
    const lastRecord = this.combatHistory[this.combatHistory.length - 1];
    if (lastRecord && !lastRecord.actualOutcome) {
      lastRecord.actualOutcome = outcome;
    }
  }

  public getOverallWinrate(): number {
    const completed = this.combatHistory.filter(
      (record) => record.actualOutcome !== undefined,
    );
    if (completed.length === 0) {
      return 0;
    }

    const wins = completed.filter(
      (record) => record.actualOutcome === 'win',
    ).length;
    return wins / completed.length;
  }

  public getWinrateVsHero(heroName: string): number {
    if (!heroName) {
      return 0;
    }

    const vsHero = this.combatHistory.filter(
      (record) =>
        record.enemyHero.toLowerCase().includes(heroName.toLowerCase()) &&
        record.actualOutcome !== undefined,
    );

    if (vsHero.length === 0) {
      return 0;
    }

    const wins = vsHero.filter(
      (record) => record.actualOutcome === 'win',
    ).length;
    return wins / vsHero.length;
  }

  public getPredictionAccuracy(): number {
    const completed = this.combatHistory.filter(
      (record) => record.actualOutcome !== undefined,
    );
    if (completed.length === 0) {
      return 0;
    }

    let correct = 0;
    for (const record of completed) {
      const predictedWin = record.predictedWinProb > 0.5;
      const actualWin = record.actualOutcome === 'win';
      if (predictedWin === actualWin) {
        correct += 1;
      }
    }

    return correct / completed.length;
  }

  public getRecentHistory(count = 10): CombatRecord[] {
    return this.combatHistory.slice(-count);
  }

  public clear(): void {
    this.combatHistory = [];
  }
}
