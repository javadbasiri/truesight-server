// src/coaching/services/combat-analyzer.service.ts
import { Injectable } from '@nestjs/common';
import type { CoachingAdvice } from '../interfaces/coaching.interface.js';
import type {
  ProcessedEnemy,
  ProcessedGameState,
} from '../../gsi/interfaces/processed-game-state.interface.js';
import { WinrateTrackerService } from './winrate-tracker.service.js';

interface CombatState {
  yourHero: {
    name: string;
    level: number;
    health: number;
    maxHealth: number;
    mana: number;
    maxMana: number;
    netWorth: number;
    items: string[];
    abilities: {
      name: string;
      ready: boolean;
      level: number;
      isUltimate: boolean;
    }[];
  };
  enemyHero: {
    level: number;
    netWorth: number;
    alive: boolean;
    visible: boolean;
    heroName?: string;
  };
  context: {
    alliesNearby: number;
    enemiesNearby: number;
  };
}

/**
 * تحلیل لحظه‌ای فایت: احتمال برد را تخمین می‌زند و می‌گوید بجنگ یا عقب بکش.
 */
@Injectable()
export class CombatAnalyzerService {
  private lastCombatAdvice = 0;
  private readonly combatAdviceCooldown = 5000;

  constructor(private readonly winrateTracker: WinrateTrackerService) {}

  public analyzeCombat(state: ProcessedGameState): CoachingAdvice | null {
    const now = Date.now();
    if (now - this.lastCombatAdvice < this.combatAdviceCooldown) {
      return null;
    }

    const visibleEnemies = state.enemies.filter(
      (enemy) => enemy.alive && enemy.visible,
    );
    if (visibleEnemies.length === 0) {
      return null;
    }

    for (const enemy of visibleEnemies) {
      const analysis = this.calculateWinProbability(
        this.buildCombatState(state, enemy),
      );

      this.winrateTracker.recordPrediction(
        state,
        enemy.heroName ?? enemy.name ?? 'unknown',
        analysis.winProbability,
        analysis.factors,
      );

      if (!analysis.shouldAdvise) {
        continue;
      }

      this.lastCombatAdvice = now;
      let message = analysis.advice;
      const winrate = this.winrateTracker.getWinrateVsHero(
        enemy.heroName ?? enemy.name ?? '',
      );
      if (winrate > 0) {
        message += ` (وین‌ریت تو مقابل این هیرو: ${Math.round(winrate * 100)}%)`;
      }

      return {
        priority: analysis.priority,
        message,
        action: 'combat_analysis',
        timestamp: now,
        gameTime: state.gameTime,
      };
    }

    return null;
  }

  public clear(): void {
    this.lastCombatAdvice = 0;
  }

  private buildCombatState(
    state: ProcessedGameState,
    enemy: ProcessedEnemy,
  ): CombatState {
    return {
      yourHero: {
        name: state.hero.name,
        level: state.hero.level,
        health: state.hero.health,
        maxHealth: state.hero.maxHealth,
        mana: state.hero.mana,
        maxMana: state.hero.maxMana,
        netWorth: state.player.netWorth,
        items: state.items.inventory.map((item) => item.name),
        abilities: Object.values(state.abilities).map((ability) => ({
          name: ability.name,
          ready: ability.ready,
          level: ability.level,
          isUltimate: ability.isUltimate,
        })),
      },
      enemyHero: {
        level: enemy.level ?? state.hero.level,
        netWorth: enemy.netWorth,
        alive: enemy.alive,
        visible: enemy.visible,
        heroName: enemy.heroName,
      },
      context: {
        alliesNearby: Math.max(1, state.team.players.length),
        enemiesNearby: state.enemies.filter(
          (entry) => entry.alive && entry.visible,
        ).length,
      },
    };
  }

  private calculateWinProbability(state: CombatState): {
    winProbability: number;
    shouldAdvise: boolean;
    priority: CoachingAdvice['priority'];
    advice: string;
    factors: string[];
  } {
    let winProbability = 0.5;
    const factors: string[] = [];

    const levelDiff = state.yourHero.level - state.enemyHero.level;
    if (levelDiff >= 3) {
      winProbability += 0.15;
      factors.push('برتری لول');
    } else if (levelDiff >= 2) {
      winProbability += 0.1;
      factors.push('برتری لول');
    } else if (levelDiff <= -3) {
      winProbability -= 0.2;
      factors.push('ضعف لول');
    } else if (levelDiff <= -2) {
      winProbability -= 0.15;
      factors.push('ضعف لول');
    }

    const netWorthDiff = state.yourHero.netWorth - state.enemyHero.netWorth;
    const netWorthDiffPercent =
      state.enemyHero.netWorth > 0
        ? (netWorthDiff / state.enemyHero.netWorth) * 100
        : 0;

    if (netWorthDiffPercent > 30) {
      winProbability += 0.15;
      factors.push('برتری آیتم');
    } else if (netWorthDiffPercent > 15) {
      winProbability += 0.1;
      factors.push('برتری آیتم');
    } else if (netWorthDiffPercent < -30) {
      winProbability -= 0.2;
      factors.push('ضعف آیتم');
    } else if (netWorthDiffPercent < -15) {
      winProbability -= 0.15;
      factors.push('ضعف آیتم');
    }

    const healthPercent =
      state.yourHero.maxHealth > 0
        ? (state.yourHero.health / state.yourHero.maxHealth) * 100
        : 100;

    if (healthPercent < 30) {
      winProbability -= 0.25;
      factors.push('جان کم');
    } else if (healthPercent < 50) {
      winProbability -= 0.15;
      factors.push('جان کم');
    } else if (healthPercent > 80) {
      winProbability += 0.1;
      factors.push('جان کامل');
    }

    const manaPercent =
      state.yourHero.maxMana > 0
        ? (state.yourHero.mana / state.yourHero.maxMana) * 100
        : 100;

    const hasUltimate = state.yourHero.abilities.some(
      (ability) => ability.isUltimate && ability.ready && ability.level > 0,
    );
    const readyAbilities = state.yourHero.abilities.filter(
      (ability) => ability.ready && ability.level > 0,
    ).length;

    if (hasUltimate) {
      winProbability += 0.15;
      factors.push('آنلتی آماده');
    }
    if (manaPercent < 20 && !hasUltimate) {
      winProbability -= 0.1;
      factors.push('مانای کم');
    }
    if (readyAbilities >= 3) {
      winProbability += 0.05;
    }

    const numberAdvantage =
      state.context.alliesNearby - state.context.enemiesNearby;
    if (numberAdvantage >= 2) {
      winProbability += 0.2;
      factors.push('برتری تعداد');
    } else if (numberAdvantage >= 1) {
      winProbability += 0.1;
      factors.push('برتری تعداد');
    } else if (numberAdvantage <= -2) {
      winProbability -= 0.25;
      factors.push('تعداد کمتر');
    } else if (numberAdvantage <= -1) {
      winProbability -= 0.15;
      factors.push('تعداد کمتر');
    }

    const hasBKB = state.yourHero.items.some((item) =>
      item.toLowerCase().includes('black_king_bar'),
    );
    const hasEscape = state.yourHero.items.some(
      (item) =>
        item.toLowerCase().includes('blink') ||
        item.toLowerCase().includes('force') ||
        item.toLowerCase().includes('shadow_blade'),
    );

    if (hasBKB) {
      winProbability += 0.1;
      factors.push('BKB آماده');
    }
    if (hasEscape && healthPercent < 50) {
      winProbability += 0.05;
    }

    const matchup = this.getHeroMatchupBonus(
      state.yourHero.name,
      state.enemyHero.heroName ?? '',
    );
    winProbability += matchup.bonus;
    if (matchup.reason) {
      factors.push(matchup.reason);
    }

    winProbability = Math.max(0, Math.min(1, winProbability));

    const winPercent = Math.round(winProbability * 100);
    let priority: CoachingAdvice['priority'] = 'LOW';
    if (winProbability < 0.25 || winProbability > 0.85) {
      priority = 'HIGH';
    } else if (winProbability < 0.4 || winProbability > 0.7) {
      priority = 'MEDIUM';
    }

    let advice = `شانس برد در این فایت: ${winPercent}%`;
    const factorText = factors.length > 0 ? ` (${factors.join('، ')})` : '';

    if (winProbability < 0.3) {
      advice = `شانس برد خیلی کم است (${winPercent}%)${factorText} - عقب بکش`;
    } else if (winProbability < 0.45) {
      advice = `ترید به ضررت است (${winPercent}%)${factorText} - با احتیاط بازی کن`;
    } else if (winProbability > 0.75) {
      advice = `ترید به نفع توست (${winPercent}%)${factorText} - این فایت را می‌بری`;
    } else if (winProbability > 0.6) {
      advice = `شانس خوب (${winPercent}%)${factorText} - برتری با توست`;
    } else {
      advice = `فایت برابر (${winPercent}%)${factorText} - به مهارت بستگی دارد`;
    }

    return {
      winProbability,
      shouldAdvise:
        winProbability < 0.35 || winProbability > 0.7 || factors.length > 0,
      priority,
      advice,
      factors,
    };
  }

  private getHeroMatchupBonus(
    yourHeroName: string,
    enemyHeroName: string,
  ): { bonus: number; reason?: string } {
    const yourHero = yourHeroName.toLowerCase();
    const enemyHero = enemyHeroName.toLowerCase();

    const favorableMatchups: Record<string, string[]> = {
      antimage: ['zeus', 'storm', 'queenofpain', 'tinker'],
      pudge: ['sniper', 'drow', 'crystal_maiden'],
      puck: ['melee'],
      storm_spirit: ['squishy'],
    };

    const unfavorableMatchups: Record<string, string[]> = {
      antimage: ['slardar', 'bloodseeker'],
      pudge: ['pugna', 'tinker'],
      storm_spirit: ['silencer', 'doom'],
    };

    for (const [hero, counters] of Object.entries(favorableMatchups)) {
      if (
        yourHero.includes(hero) &&
        counters.some((counter) => enemyHero.includes(counter))
      ) {
        return { bonus: 0.1, reason: 'مچاپ مطلوب' };
      }
    }

    for (const [hero, counters] of Object.entries(unfavorableMatchups)) {
      if (
        yourHero.includes(hero) &&
        counters.some((counter) => enemyHero.includes(counter))
      ) {
        return { bonus: -0.15, reason: 'مچاپ نامطلوب' };
      }
    }

    return { bonus: 0 };
  }
}
