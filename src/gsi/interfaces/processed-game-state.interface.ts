/**
 * نورمالایز شده‌ی پکت خام GSI برای مصرف موتور کوچینگ.
 * این ساختار از `GsiPayload` ساخته می‌شود تا قوانین کوچینگ بدون
 * درگیری با فیلدهای optional/غایب GSI کار کنند.
 */

export type ProcessedTeamSide = 'radiant' | 'dire';

export interface ProcessedPlayer {
  steamId: string;
  name: string;
  kills: number;
  deaths: number;
  assists: number;
  lastHits: number;
  denies: number;
  gold: number;
  goldReliable: number;
  goldUnreliable: number;
  netWorth: number;
  gpm: number;
  xpm: number;
  team: ProcessedTeamSide;
}

export interface ProcessedHero {
  id: number;
  name: string;
  level: number;
  x: number;
  y: number;
  alive: boolean;
  respawnSeconds: number;
  buybackCost: number;
  buybackAvailable: boolean;
  health: number;
  maxHealth: number;
  healthPercent: number;
  mana: number;
  maxMana: number;
  manaPercent: number;
  magicImmune: boolean;
  hasAghanimsScepter: boolean;
  hasAghanimsShard: boolean;
}

export interface ProcessedTeam {
  players: ProcessedPlayer[];
  netWorth: number;
  totalKills: number;
  totalDeaths: number;
}

export interface ProcessedEnemy {
  steamId: string;
  name: string;
  heroId?: number;
  heroName?: string;
  level?: number;
  alive: boolean;
  respawnSeconds: number;
  buybackAvailable: boolean;
  buybackCost: number;
  position?: number[];
  visible: boolean;
  kills: number;
  deaths: number;
  netWorth: number;
}

export interface ProcessedBuilding {
  name: string;
  health: number;
  maxHealth: number;
  healthPercent: number;
  destroyed: boolean;
}

export interface ProcessedBuildingSet {
  ancient?: ProcessedBuilding;
  t4?: ProcessedBuilding[];
  t3?: ProcessedBuilding[];
  t2?: ProcessedBuilding[];
  t1?: ProcessedBuilding[];
  barracks?: ProcessedBuilding[];
}

export interface ProcessedBuildings {
  radiant: ProcessedBuildingSet;
  dire: ProcessedBuildingSet;
}

export interface ProcessedRoshan {
  alive: boolean;
  respawnTime?: number;
  lastDeathTime?: number;
  aegisHolder?: ProcessedTeamSide | null;
}

export interface ProcessedItem {
  name: string;
  slot: string;
  canCast: boolean;
  cooldown: number;
  charges?: number;
}

export interface ProcessedItems {
  inventory: ProcessedItem[];
  stash: ProcessedItem[];
  backpack: ProcessedItem[];
  allItems: ProcessedItem[];
}

export interface ProcessedAbility {
  name: string;
  level: number;
  canCast: boolean;
  cooldown: number;
  cooldownRemaining: number;
  isUltimate: boolean;
  ready: boolean;
}

export type ProcessedAbilities = Record<string, ProcessedAbility>;

export interface ProcessedGameState {
  gameTime: number;
  clockTime: number;
  gameState: string;
  matchId: string;
  isDaytime: boolean;
  player: ProcessedPlayer;
  hero: ProcessedHero;
  team: ProcessedTeam;
  enemies: ProcessedEnemy[];
  buildings: ProcessedBuildings;
  roshan: ProcessedRoshan;
  items: ProcessedItems;
  abilities: ProcessedAbilities;
}
