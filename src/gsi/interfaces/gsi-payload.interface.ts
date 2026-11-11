export type GsiGameState =
  | 'DOTA_GAMERULES_STATE_INIT'
  | 'DOTA_GAMERULES_STATE_WAIT_FOR_PLAYERS_TO_LOAD'
  | 'DOTA_GAMERULES_STATE_HERO_SELECTION'
  | 'DOTA_GAMERULES_STATE_STRATEGY_TIME'
  | 'DOTA_GAMERULES_STATE_PRE_GAME'
  | 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS'
  | 'DOTA_GAMERULES_STATE_POST_GAME'
  | 'DOTA_GAMERULES_STATE_DISCONNECT'
  | 'DOTA_GAMERULES_STATE_TEAM_SHOWCASE'
  | 'DOTA_GAMERULES_STATE_CUSTOM_GAME_SETUP'
  | string;

export type DotaTeam = 'radiant' | 'dire' | 'none' | 'spectator' | string;

export interface GsiProvider {
  name: string; // "Dota 2"
  appid: number; // 570
  version: number;
  timestamp: number; // Unix timestamp
}

export interface GsiMap {
  name: string;
  matchid: string;
  game_time: number; // زمان کل از لحظه لود شدن مپ (ثانیه)
  clock_time: number; // تایمر اصلی بازی (قبل از بوق دقیقه صفر منفی است)
  daytime: boolean; // true = روز، false = شب
  nightstalker_night: boolean; // شب ناشی از اولتیمیت Night Stalker
  radiant_score: number;
  dire_score: number;
  game_state: GsiGameState;
  paused: boolean;
  win_team: DotaTeam;
  customgamename: string;
  ward_purchase_cooldown: number; // کول‌داون خرید Observer Ward در شاپ
  roshan_state?: 'alive' | 'dead' | 'respawn_timer' | string;
  roshan_state_end_seconds?: number; // ثانیه‌ی باقی‌مانده تا اسپاون مجدد روشان
}

export interface GsiPlayer {
  steamid: string;
  accountid?: string;
  name: string;
  activity: 'playing' | 'menu' | string;
  kills: number;
  deaths: number;
  assists: number;
  last_hits: number;
  denies: number;
  kill_streak: number;
  commands_issued: number;
  kill_list?: Record<string, number>; // مثال: { "victimid_0": 2 }
  team_name: DotaTeam;
  player_slot?: number;
  team_slot?: number;
  gold: number; // کل طلای فعلی
  gold_reliable: number; // طلای مطمئن (با مردن کم نمی‌شود)
  gold_unreliable: number; // طلای غیرمطمئن (با مردن کم می‌شود)
  gold_from_hero_kills: number;
  gold_from_creep_kills: number;
  gold_from_income: number;
  gold_from_shared: number;
  gpm: number; // Gold Per Minute
  xpm: number; // XP Per Minute
  net_worth?: number; // ارزش خالص (در صورت فعال بودن allplayers/دقت بیشتر)
}

/**
 * اطلاعات مختصر سایر بازیکنان که فقط وقتی سکشن `allplayers` در فایل
 * gamestate_integration فعال باشد ارسال می‌شود. برای تحلیل دشمن، خرید
 * Buyback و پوش‌تایمینگ حیاتی است.
 */
export interface GsiAllPlayer {
  steamid: string;
  accountid?: string;
  name: string;
  activity?: string;
  kills: number;
  deaths: number;
  assists: number;
  last_hits: number;
  denies: number;
  kill_streak?: number;
  team_name: DotaTeam;
  gold?: number;
  gold_reliable?: number;
  gold_unreliable?: number;
  gpm?: number;
  xpm?: number;
  net_worth?: number;
  respawn_seconds?: number;
  buyback_cost?: number;
  buyback_cooldown?: number;
  position?: number[];
  hero_name?: string; // در GSI استاندارد موجود نیست؛ در صورت غنی‌سازی خارجی
  hero_id?: number;
}

export interface GsiDraft {
  activeteam: number;
  pick: boolean;
  activeteam_time_remaining: number;
  radiant_bonus_time: number;
  dire_bonus_time: number;
}

export interface GsiHero {
  xpos: number;
  ypos: number;
  id: number;
  name: string; // مثال: "npc_dota_hero_nevermore" یا "npc_dota_hero_puck"
  level: number;
  xp: number;
  alive: boolean;
  respawn_seconds: number;
  buyback_cost: number;
  buyback_cooldown: number; // اگر 0 باشد یعنی Buyback آماده است
  health: number;
  max_health: number;
  health_percent: number; // عدد بین 0 تا 100
  mana: number;
  max_mana: number;
  mana_percent: number; // عدد بین 0 تا 100
  silenced: boolean;
  stunned: boolean;
  disarmed: boolean;
  magicimmune: boolean; // وضعیت BKB / Debuff Immunity
  hexed: boolean;
  muted: boolean;
  break: boolean; // غیرفعال شدن Passiveها
  aghanims_scepter: boolean;
  aghanims_shard: boolean;
  smoked: boolean; // وضعیت Smoke of Deceit
  has_debuff: boolean;
  attributes_level?: number;
  talent_1?: boolean;
  talent_2?: boolean;
  talent_3?: boolean;
  talent_4?: boolean;
  talent_5?: boolean;
  talent_6?: boolean;
  talent_7?: boolean;
  talent_8?: boolean;
}

export interface GsiAbility {
  name: string;
  level: number;
  can_cast: boolean;
  passive: boolean;
  ability_active: boolean;
  cooldown: number; // ثانیه باقی‌مانده از کول‌داون (0 یعنی آماده)
  ultimate: boolean;
  charges?: number;
  max_charges?: number;
  charge_cooldown?: number;
}

export interface GsiAbilities {
  ability0?: GsiAbility;
  ability1?: GsiAbility;
  ability2?: GsiAbility;
  ability3?: GsiAbility;
  ability4?: GsiAbility;
  ability5?: GsiAbility;
  [key: string]: GsiAbility | undefined;
}

export type BottleRuneType =
  | 'empty'
  | 'water'
  | 'bounty'
  | 'double_damage'
  | 'haste'
  | 'illusion'
  | 'invisibility'
  | 'regeneration'
  | 'arcane'
  | 'shield'
  | string;

export interface GsiItem {
  name: string; // اگر اسلات خالی باشد مقدار "empty" دارد، در غیر این صورت مثل "item_blink"
  purchaser?: number;
  item_level?: number; // برای آیتم‌های چندسطحی مثل Dagon
  contains_rune?: BottleRuneType; // مخصوص آیتم Bottle
  can_cast?: boolean;
  cooldown?: number;
  passive?: boolean;
  item_charges?: number;
  charges?: number; // تعداد شارژ آیتم‌هایی مثل Magic Wand یا BKB
}

export interface GsiItems {
  // ۶ اسلات اصلی اینونتوری
  slot0?: GsiItem;
  slot1?: GsiItem;
  slot2?: GsiItem;
  slot3?: GsiItem;
  slot4?: GsiItem;
  slot5?: GsiItem;
  // ۳ اسلات Backpack
  slot6?: GsiItem;
  slot7?: GsiItem;
  slot8?: GsiItem;
  // ۶ اسلات Stash در بیس
  stash0?: GsiItem;
  stash1?: GsiItem;
  stash2?: GsiItem;
  stash3?: GsiItem;
  stash4?: GsiItem;
  stash5?: GsiItem;
  // اسلات مخصوص TP و Neutral Item
  teleport0?: GsiItem;
  neutral0?: GsiItem;
  [key: string]: GsiItem | undefined;
}

export interface GsiBuildingState {
  health: number;
  max_health: number;
}

export interface GsiBuildings {
  radiant?: Record<string, GsiBuildingState>;
  dire?: Record<string, GsiBuildingState>;
}

/**
 * ساختار اصلی پکت ارسالی از کلاینت Dota 2 به اندپوینت POST /gsi
 */
export interface GsiPayload {
  provider?: GsiProvider;
  map?: GsiMap;
  player?: GsiPlayer;
  hero?: GsiHero;
  abilities?: GsiAbilities;
  items?: GsiItems;
  buildings?: GsiBuildings;
  draft?: GsiDraft;
  allplayers?: GsiAllPlayer[];
  /**
   * کلاینت دوتا ۲ در هر تیک، مقادیری که نسبت به تیک قبلی تغییر کرده‌اند را
   * در آبجکت previously قرار می‌دهد (بسیار کاربردی برای تشخیص لحظه خرید آیتم یا لول‌آپ)
   */
  previously?: Partial<Omit<GsiPayload, 'previously' | 'added'>>;
  added?: Record<string, any>;
}

/**
 * ساختار استاندارد پیام‌های ارسالی از سرور به کلاینت Tauri از طریق Socket.io
 */
export type CoachAlertType = 'info' | 'warning' | 'spike';

export interface CoachAlertPayload {
  id: string;
  message: string;
  type: CoachAlertType;
  audioKey?: string;
}

/**
 * خلاصه‌ی اطلاعات بازیکن/هیرو/مپ که برای داشبورد کلاینت ارسال می‌شود
 * (رویداد `game-state`). نام فیلدها camelCase است تا در React مستقیم استفاده شوند.
 */
export interface GameStatePlayer {
  name: string;
  team: DotaTeam;
  kills: number;
  deaths: number;
  assists: number;
  lastHits: number;
  denies: number;
  gpm: number;
  xpm: number;
  gold: number;
}

export interface GameStateHero {
  name: string;
  level: number;
  alive: boolean;
  respawnSeconds: number;
  healthPercent: number;
  manaPercent: number;
}

export interface GameStatePayload {
  gameState: GsiGameState;
  clockTime: number;
  radiantScore: number;
  direScore: number;
  paused: boolean;
  player?: GameStatePlayer;
  hero?: GameStateHero;
}
