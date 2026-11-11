// src/coaching/utils/team-metrics.ts
import type {
  ProcessedBuilding,
  ProcessedBuildingSet,
  ProcessedGameState,
  ProcessedTeamSide,
} from '../../gsi/interfaces/processed-game-state.interface.js';
import { CS_TARGETS } from '../config/coaching.constants.js';

export function getEnemySide(state: ProcessedGameState): ProcessedTeamSide {
  return state.player.team === 'radiant' ? 'dire' : 'radiant';
}

export function getEnemyBuildings(
  state: ProcessedGameState,
): ProcessedBuildingSet {
  return state.buildings[getEnemySide(state)];
}

export function getOwnBuildings(
  state: ProcessedGameState,
): ProcessedBuildingSet {
  return state.buildings[state.player.team];
}

export function getTowers(
  buildings: ProcessedBuildingSet,
): ProcessedBuilding[] {
  return [
    ...(buildings.t1 ?? []),
    ...(buildings.t2 ?? []),
    ...(buildings.t3 ?? []),
    ...(buildings.t4 ?? []),
  ];
}

export function getLowHealthTowers(
  buildings: ProcessedBuildingSet,
  healthThreshold: number,
): ProcessedBuilding[] {
  return getTowers(buildings).filter(
    (tower) =>
      !tower.destroyed &&
      tower.healthPercent > 0 &&
      tower.healthPercent < healthThreshold,
  );
}

export function getEnemyNetWorth(state: ProcessedGameState): number {
  return state.enemies.reduce((sum, enemy) => sum + enemy.netWorth, 0);
}

/**
 * تفاضل ارزش خالص تیم ما و دشمن. اگر داده‌ی کافی از ترکیب دشمن نداشته
 * باشیم مقدار 0 برمی‌گردد تا هشدارهای اشتباه (مثلاً «۲۰ هزار گلد جلو هستی»)
 * تولید نشود.
 */
export function getNetWorthDelta(state: ProcessedGameState): number {
  if (state.enemies.length < 4) {
    return 0;
  }

  return state.team.netWorth - getEnemyNetWorth(state);
}

export function hasNetWorthData(state: ProcessedGameState): boolean {
  return state.enemies.length >= 4 && state.team.netWorth > 0;
}

export function normalizeItemName(name: string): string {
  return name.toLowerCase().replace(/^item_/, '');
}

export function hasItem(items: string[], itemName: string | string[]): boolean {
  const candidates = Array.isArray(itemName) ? itemName : [itemName];

  return candidates.some((candidate) => {
    const normalized = normalizeItemName(candidate);
    return items.some((item) => {
      const itemNormalized = normalizeItemName(item);
      return (
        itemNormalized.includes(normalized) ||
        normalized.includes(itemNormalized)
      );
    });
  });
}

export function hasAnyItemInState(
  state: ProcessedGameState,
  itemName: string | string[],
): boolean {
  return hasItem(
    state.items.allItems.map((item) => item.name),
    itemName,
  );
}

export function getInventoryItemNames(state: ProcessedGameState): string[] {
  return state.items.inventory.map((item) => item.name);
}

export function getExpectedCS(gameTime: number): number {
  const minute = Math.floor(gameTime / 60);

  if (minute <= 5) {
    return CS_TARGETS[5];
  }
  if (minute <= 10) {
    return CS_TARGETS[10];
  }
  if (minute <= 15) {
    return CS_TARGETS[15];
  }
  return CS_TARGETS[20];
}

export function formatClock(gameTime: number): string {
  const safe = Math.max(0, Math.floor(gameTime));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function isUltimateReady(state: ProcessedGameState): boolean {
  return Object.values(state.abilities).some(
    (ability) => ability.isUltimate && ability.ready && ability.level > 0,
  );
}

export function countReadyUltimates(state: ProcessedGameState): number {
  return Object.values(state.abilities).filter(
    (ability) => ability.isUltimate && ability.ready && ability.level > 0,
  ).length;
}

export function countDeadEnemies(state: ProcessedGameState): number {
  return state.enemies.filter((enemy) => !enemy.alive).length;
}

export function countAliveEnemies(state: ProcessedGameState): number {
  return state.enemies.filter((enemy) => enemy.alive).length;
}

export function countVisibleAliveEnemies(state: ProcessedGameState): number {
  return state.enemies.filter((enemy) => enemy.alive && enemy.visible).length;
}
