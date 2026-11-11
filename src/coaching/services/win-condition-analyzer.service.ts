// src/coaching/services/win-condition-analyzer.service.ts
import { Injectable } from '@nestjs/common';
import type {
  WinCondition,
  WinConditionAnalysis,
} from '../interfaces/coaching.interface.js';
import type { ProcessedGameState } from '../../gsi/interfaces/processed-game-state.interface.js';
import { WIN_CONDITIONS } from '../config/coaching.constants.js';

/**
 * ترکیب تیمی را تحلیل می‌کند و بهترین شرط برد (Win Condition) را تعیین می‌کند.
 * تمرکز اصلی: «سریع‌ترین راه برای زدن Ancient».
 */
@Injectable()
export class WinConditionAnalyzerService {
  public analyze(state: ProcessedGameState): WinConditionAnalysis {
    const teamHeroes = this.extractTeamHeroes(state);
    const enemyHeroes = this.extractEnemyHeroes(state);

    const scores: Record<Exclude<WinCondition, 'unknown'>, number> = {
      earlyPush: this.scoreEarlyPush(teamHeroes, enemyHeroes),
      timingPush: this.scoreTimingPush(teamHeroes),
      splitPush: this.scoreSplitPush(teamHeroes),
      highgroundSiege: this.scoreHighgroundSiege(teamHeroes),
      outscale: this.scoreOutscale(teamHeroes, enemyHeroes),
    };

    const entries = Object.entries(scores) as Array<
      [Exclude<WinCondition, 'unknown'>, number]
    >;
    entries.sort(([, a], [, b]) => b - a);

    const [topCondition, topScore] = entries[0];
    const primaryCondition: WinCondition =
      topScore > 0 ? topCondition : 'unknown';
    const conditionData =
      primaryCondition === 'unknown'
        ? WIN_CONDITIONS.timingPush
        : WIN_CONDITIONS[primaryCondition];

    return {
      primaryCondition,
      confidence: Math.min(topScore / 10, 1),
      timing: conditionData.timing,
      strategy: conditionData.strategy,
      heroes: teamHeroes,
      keyItems: conditionData.keyItems,
      pushTiming: this.calculatePushTiming(primaryCondition, state),
    };
  }

  /**
   * آیا الان در پنجره‌ی تایمینگ همان شرط برد هستیم؟
   */
  public validateWinCondition(
    analysis: WinConditionAnalysis,
    state: ProcessedGameState,
  ): boolean {
    const gameTime = state.gameTime;

    if (
      gameTime < analysis.pushTiming - 60 ||
      gameTime > analysis.pushTiming + 600
    ) {
      return false;
    }

    if (analysis.keyItems.length === 0) {
      return true;
    }

    return analysis.keyItems.some((itemName) =>
      state.items.allItems.some((item) =>
        item.name.toLowerCase().includes(itemName.toLowerCase()),
      ),
    );
  }

  private extractTeamHeroes(state: ProcessedGameState): string[] {
    const heroName = this.normalizeHeroName(state.hero.name);
    return heroName && heroName !== 'unknown' ? [heroName] : [];
  }

  private extractEnemyHeroes(state: ProcessedGameState): string[] {
    return state.enemies
      .filter((enemy) => enemy.heroName && enemy.visible)
      .map((enemy) => this.normalizeHeroName(enemy.heroName!));
  }

  private scoreEarlyPush(teamHeroes: string[], enemyHeroes: string[]): number {
    let score =
      teamHeroes.filter((hero) =>
        this.matchesAny(hero, WIN_CONDITIONS.earlyPush.heroes),
      ).length * 3;

    const lateGameEnemies = enemyHeroes.filter((hero) =>
      this.matchesAny(hero, WIN_CONDITIONS.outscale.heroes),
    );
    if (lateGameEnemies.length >= 2) {
      score += 2;
    }

    return score;
  }

  private scoreTimingPush(teamHeroes: string[]): number {
    return (
      teamHeroes.filter((hero) =>
        this.matchesAny(hero, WIN_CONDITIONS.timingPush.heroes),
      ).length * 2
    );
  }

  private scoreSplitPush(teamHeroes: string[]): number {
    return (
      teamHeroes.filter((hero) =>
        this.matchesAny(hero, WIN_CONDITIONS.splitPush.heroes),
      ).length * 3
    );
  }

  private scoreHighgroundSiege(teamHeroes: string[]): number {
    return (
      teamHeroes.filter((hero) =>
        this.matchesAny(hero, WIN_CONDITIONS.highgroundSiege.heroes),
      ).length * 2
    );
  }

  private scoreOutscale(teamHeroes: string[], enemyHeroes: string[]): number {
    let score =
      teamHeroes.filter((hero) =>
        this.matchesAny(hero, WIN_CONDITIONS.outscale.heroes),
      ).length * 2;

    const earlyPushEnemies = enemyHeroes.filter((hero) =>
      this.matchesAny(hero, WIN_CONDITIONS.earlyPush.heroes),
    );
    if (earlyPushEnemies.length >= 2) {
      score -= 2;
    }

    return Math.max(score, 0);
  }

  private calculatePushTiming(
    condition: WinCondition,
    state: ProcessedGameState,
  ): number {
    const gameTime = state.gameTime;

    switch (condition) {
      case 'earlyPush':
        return Math.max(300, gameTime + 120);
      case 'timingPush':
        return Math.max(900, gameTime + 300);
      case 'splitPush':
        return gameTime;
      case 'highgroundSiege':
        return Math.max(1500, gameTime + 300);
      case 'outscale':
        return Math.max(2100, gameTime + 600);
      default:
        return gameTime + 300;
    }
  }

  private normalizeHeroName(heroName: string): string {
    return heroName
      .toLowerCase()
      .replace('npc_dota_hero_', '')
      .replace(/_/g, '');
  }

  private matchesAny(heroName: string, candidates: string[]): boolean {
    return candidates.some((candidate) => {
      const normalized = this.normalizeHeroName(candidate);
      return (
        heroName === normalized ||
        heroName.includes(normalized) ||
        normalized.includes(heroName)
      );
    });
  }
}
