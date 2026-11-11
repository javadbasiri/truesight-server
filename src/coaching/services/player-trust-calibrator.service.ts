// src/coaching/services/player-trust-calibrator.service.ts
import { Injectable } from '@nestjs/common';
import type {
  CoachingAdvice,
  ComplianceRecord,
  ComplianceState,
  TrustMetrics,
} from '../interfaces/coaching.interface.js';
import type { ProcessedGameState } from '../../gsi/interfaces/processed-game-state.interface.js';
import { getEnemyBuildings } from '../utils/team-metrics.js';

/**
 * کالیبراسیون اعتماد: رفتار بازیکن را یاد می‌گیرد و میزان توضیح/تکرار
 * پیام‌ها را بر اساس نرخ پایبندی (Compliance) تنظیم می‌کند.
 */
@Injectable()
export class PlayerTrustCalibratorService {
  private complianceHistory: ComplianceRecord[] = [];
  private adviceTracking = new Map<string, CoachingAdvice>();
  private currentTrustMetrics: TrustMetrics = this.createNeutralMetrics();
  private readonly maxHistory = 100;

  public registerAdvice(
    advice: CoachingAdvice,
    state: ProcessedGameState,
  ): string {
    const adviceId = `${state.gameTime}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    this.adviceTracking.set(adviceId, advice);
    return adviceId;
  }

  public checkCompliance(
    adviceId: string,
    current: ProcessedGameState,
    previous: ProcessedGameState,
  ): void {
    const advice = this.adviceTracking.get(adviceId);
    if (!advice) {
      return;
    }

    const compliance = this.detectCompliance(advice, current, previous);
    const outcome = this.assessOutcome(advice, current, previous);

    this.complianceHistory.push({
      adviceId,
      advice,
      timestamp: Date.now(),
      gameTime: current.gameTime,
      followed: compliance.state !== 'no_compliance',
      complianceState: compliance.state,
      outcome,
      timeToComply:
        compliance.state !== 'no_compliance'
          ? Math.max(0, current.gameTime - advice.gameTime)
          : undefined,
      certainty: compliance.certainty,
    });

    if (this.complianceHistory.length > this.maxHistory) {
      this.complianceHistory.shift();
    }

    this.adviceTracking.delete(adviceId);

    if (this.complianceHistory.length >= 3) {
      this.updateTrustMetrics();
    }
  }

  public getTrustMetrics(): TrustMetrics {
    return { ...this.currentTrustMetrics };
  }

  public shouldReduceVerbosity(): boolean {
    return this.currentTrustMetrics.verbosityLevel === 'low';
  }

  public shouldIncreaseExplanation(): boolean {
    return this.currentTrustMetrics.explanationLevel === 'detailed';
  }

  public getComplianceHistory(): ComplianceRecord[] {
    return [...this.complianceHistory];
  }

  public clear(): void {
    this.complianceHistory = [];
    this.adviceTracking.clear();
    this.currentTrustMetrics = this.createNeutralMetrics();
  }

  private createNeutralMetrics(): TrustMetrics {
    return {
      complianceRate: 0.5,
      positiveOutcomeRate: 0.5,
      averageResponseTime: 0,
      verbosityLevel: 'medium',
      explanationLevel: 'standard',
    };
  }

  private detectCompliance(
    advice: CoachingAdvice,
    current: ProcessedGameState,
    previous: ProcessedGameState,
  ): { state: ComplianceState; certainty: number } {
    switch (advice.action) {
      case 'push':
        return this.detectPushCompliance(current, previous);
      case 'retreat':
      case 'back':
        return this.detectRetreatCompliance(current, previous);
      case 'farm':
        return this.detectFarmCompliance(current, previous);
      case 'end_game':
        return this.detectEndGameCompliance(current, previous);
      default:
        return { state: 'ambiguous_compliance', certainty: 0.3 };
    }
  }

  private detectPushCompliance(
    current: ProcessedGameState,
    previous: ProcessedGameState,
  ): { state: ComplianceState; certainty: number } {
    const objectivesGained =
      this.countDestroyedEnemyBuildings(current) -
      this.countDestroyedEnemyBuildings(previous);

    if (objectivesGained > 0) {
      return { state: 'full_compliance', certainty: 0.9 };
    }

    const enemyBuildings = getEnemyBuildings(current);
    const lowHealthBuildings = [
      ...(enemyBuildings.t1 ?? []),
      ...(enemyBuildings.t2 ?? []),
      ...(enemyBuildings.t3 ?? []),
    ].filter((building) => !building.destroyed && building.healthPercent < 50);

    if (lowHealthBuildings.length > 0) {
      return { state: 'partial_compliance', certainty: 0.6 };
    }

    return { state: 'no_compliance', certainty: 0.7 };
  }

  private detectRetreatCompliance(
    current: ProcessedGameState,
    previous: ProcessedGameState,
  ): { state: ComplianceState; certainty: number } {
    const healthIncrease =
      current.hero.healthPercent - previous.hero.healthPercent;
    const avoidedDeath =
      previous.hero.healthPercent < 30 &&
      current.hero.healthPercent > previous.hero.healthPercent;

    if (healthIncrease > 15 || avoidedDeath) {
      return { state: 'full_compliance', certainty: 0.8 };
    }
    if (healthIncrease > 5) {
      return { state: 'partial_compliance', certainty: 0.5 };
    }
    if (current.player.deaths === previous.player.deaths) {
      return { state: 'ambiguous_compliance', certainty: 0.4 };
    }

    return { state: 'no_compliance', certainty: 0.6 };
  }

  private detectFarmCompliance(
    current: ProcessedGameState,
    previous: ProcessedGameState,
  ): { state: ComplianceState; certainty: number } {
    const csIncrease = current.player.lastHits - previous.player.lastHits;
    const timeDelta = current.gameTime - previous.gameTime;
    const csPerSecond = timeDelta > 0 ? csIncrease / timeDelta : 0;

    if (csPerSecond > 0.5) {
      return { state: 'full_compliance', certainty: 0.7 };
    }
    if (csPerSecond > 0.2) {
      return { state: 'partial_compliance', certainty: 0.5 };
    }

    return { state: 'no_compliance', certainty: 0.6 };
  }

  private detectEndGameCompliance(
    current: ProcessedGameState,
    previous: ProcessedGameState,
  ): { state: ComplianceState; certainty: number } {
    const ancientBefore = this.getEnemyAncientHealth(previous);
    const ancientAfter = this.getEnemyAncientHealth(current);

    if (ancientAfter === 0 && ancientBefore > 0) {
      return { state: 'full_compliance', certainty: 1 };
    }
    if (ancientAfter < ancientBefore) {
      return { state: 'partial_compliance', certainty: 0.7 };
    }

    return { state: 'no_compliance', certainty: 0.6 };
  }

  private assessOutcome(
    advice: CoachingAdvice,
    current: ProcessedGameState,
    previous: ProcessedGameState,
  ): 'positive' | 'negative' | 'neutral' | 'unknown' {
    const objectivesGained =
      this.countDestroyedEnemyBuildings(current) -
      this.countDestroyedEnemyBuildings(previous);

    if (advice.action === 'push' || advice.action === 'end_game') {
      if (
        objectivesGained > 0 &&
        current.player.deaths === previous.player.deaths
      ) {
        return 'positive';
      }
      if (
        objectivesGained > 0 &&
        current.player.deaths > previous.player.deaths
      ) {
        return 'neutral';
      }
    }

    if (advice.action === 'retreat' || advice.action === 'back') {
      if (current.player.deaths === previous.player.deaths) {
        return 'positive';
      }
    }

    return 'unknown';
  }

  private updateTrustMetrics(): void {
    const weighted = this.complianceHistory.map((record) => ({
      record,
      weight: this.getWeightForCertainty(
        record.certainty,
        record.complianceState,
      ),
    }));

    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight === 0) {
      return;
    }

    const complianceWeight = weighted
      .filter((entry) => entry.record.followed)
      .reduce((sum, entry) => sum + entry.weight, 0);
    this.currentTrustMetrics.complianceRate = complianceWeight / totalWeight;

    const followed = weighted.filter((entry) => entry.record.followed);
    if (followed.length > 0) {
      const positiveWeight = followed
        .filter((entry) => entry.record.outcome === 'positive')
        .reduce((sum, entry) => sum + entry.weight, 0);
      const totalFollowedWeight = followed.reduce(
        (sum, entry) => sum + entry.weight,
        0,
      );
      this.currentTrustMetrics.positiveOutcomeRate =
        totalFollowedWeight > 0 ? positiveWeight / totalFollowedWeight : 0.5;
    }

    const responseTimes = this.complianceHistory
      .filter((record) => record.timeToComply !== undefined)
      .map((record) => ({
        time: record.timeToComply!,
        weight: record.certainty,
      }));

    if (responseTimes.length > 0) {
      const totalTimeWeight = responseTimes.reduce(
        (sum, entry) => sum + entry.weight,
        0,
      );
      const weightedTime = responseTimes.reduce(
        (sum, entry) => sum + entry.time * entry.weight,
        0,
      );
      this.currentTrustMetrics.averageResponseTime =
        totalTimeWeight > 0 ? weightedTime / totalTimeWeight : 0;
    }

    if (this.currentTrustMetrics.complianceRate > 0.75) {
      this.currentTrustMetrics.verbosityLevel = 'low';
      this.currentTrustMetrics.explanationLevel = 'minimal';
    } else if (this.currentTrustMetrics.complianceRate < 0.25) {
      this.currentTrustMetrics.verbosityLevel = 'high';
      this.currentTrustMetrics.explanationLevel = 'detailed';
    } else {
      this.currentTrustMetrics.verbosityLevel = 'medium';
      this.currentTrustMetrics.explanationLevel = 'standard';
    }
  }

  private getWeightForCertainty(
    certainty: number,
    state: ComplianceState,
  ): number {
    const multipliers: Record<ComplianceState, number> = {
      full_compliance: 1,
      partial_compliance: 0.5,
      ambiguous_compliance: 0.2,
      no_compliance: 1,
      delayed_compliance: 0.7,
    };

    return Math.max(0, Math.min(1, certainty * multipliers[state]));
  }

  private countDestroyedEnemyBuildings(state: ProcessedGameState): number {
    const enemyBuildings = getEnemyBuildings(state);

    return [
      ...(enemyBuildings.t1 ?? []),
      ...(enemyBuildings.t2 ?? []),
      ...(enemyBuildings.t3 ?? []),
      ...(enemyBuildings.barracks ?? []),
    ].filter((building) => building.destroyed).length;
  }

  private getEnemyAncientHealth(state: ProcessedGameState): number {
    const ancient = getEnemyBuildings(state).ancient;
    return ancient ? ancient.health : 0;
  }
}
