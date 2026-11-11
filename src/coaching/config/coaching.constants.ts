/**
 * ثابت‌های موتور کوچینگ (پورت‌شده از منطق مرجع و بومی‌سازی‌شده)
 */

import type { WinCondition } from '../interfaces/coaching.interface.js';

export const WIN_CONDITIONS: Record<
  Exclude<WinCondition, 'unknown'>,
  { heroes: string[]; timing: string; strategy: string; keyItems: string[] }
> = {
  earlyPush: {
    heroes: [
      'chen',
      'enchantress',
      'lycan',
      'beastmaster',
      'shadow_shaman',
      'pugna',
      'death_prophet',
    ],
    timing: '۵ تا ۱۵ دقیقه',
    strategy:
      'از ابتدا گروهی بازی کن و قبل از آنلاین شدن کری‌های حریف، تاورها را بردار.',
    keyItems: ['mekansm', 'pipe', 'soul_ring', 'arcane_boots'],
  },
  timingPush: {
    heroes: [
      'sven',
      'dragon_knight',
      'leshrac',
      'death_prophet',
      'luna',
      'drow_ranger',
    ],
    timing: '۱۵ تا ۲۵ دقیقه',
    strategy:
      'با کامل شدن BKB یا آیتم کلیدی، گروهی پوش بده و حریف را مجبور به دفاع از هایگراند کن.',
    keyItems: [
      'black_king_bar',
      'blink_dagger',
      'desolator',
      'assault_cuirass',
    ],
  },
  splitPush: {
    heroes: [
      'natures_prophet',
      'lycan',
      'arc_warden',
      'terrorblade',
      'tinker',
      'broodmother',
    ],
    timing: 'هر زمان',
    strategy: 'با فشار روی لین‌های کناری، حریف را بچرخان و ساختمان بزن.',
    keyItems: ['boots_of_travel', 'manta_style', 'necronomicon'],
  },
  highgroundSiege: {
    heroes: [
      'sniper',
      'techies',
      'keeper_of_the_light',
      'tinker',
      'pugna',
      'jakiro',
    ],
    timing: '۲۵ تا ۴۰ دقیقه',
    strategy:
      'حریف را از فارم گرسنه نگه دار و با برتری رنج، آرام هایگراند را بزن.',
    keyItems: ['aether_lens', 'octarine_core', 'refresher_orb'],
  },
  outscale: {
    heroes: [
      'medusa',
      'spectre',
      'anti_mage',
      'phantom_assassin',
      'faceless_void',
      'troll_warlord',
    ],
    timing: '۳۵ دقیقه به بعد',
    strategy: 'بازی را طول بده، از هایگراند دفاع کن و تا ۶ اسلات فارم کن.',
    keyItems: ['manta_style', 'skadi', 'butterfly', 'satanic'],
  },
};

export const POWER_SPIKES = {
  level: {
    6: 'آنلتی آماده شد - پاور اسپایک اصلی اکثر هیروها',
    12: 'آنلتی سطح ۲',
    15: 'تالنت کلیدی باز شد',
    20: 'تالنت سطح ۲۰',
    25: 'تالنت بازی‌تغییردهنده',
  },
  items: {
    blink_dagger: {
      description: 'پاور اسپایک اینیشیشن - فایت را شروع کن',
      timing: '۱۰ تا ۱۵ دقیقه',
    },
    arcane_boots: {
      description: 'مانای پایدار - پوش را فعال کن',
      timing: '۳ تا ۵ دقیقه',
    },
    soul_ring: { description: 'اسپم اسپل برای پوش', timing: '۵ تا ۸ دقیقه' },
    mekansm: { description: 'سustain تیمی برای پوش', timing: '۸ تا ۱۲ دقیقه' },
    pipe_of_insight: {
      description: 'مقاومت جادویی برای پوش',
      timing: '۱۲ تا ۱۵ دقیقه',
    },
    black_king_bar: {
      description: 'پاور اسپایک بزرگ - پنجره‌ی ایمنی جادویی',
      timing: '۱۵ تا ۲۰ دقیقه',
    },
    desolator: {
      description: 'پاور اسپایک دمیج ساختمان',
      timing: '۱۵ تا ۲۰ دقیقه',
    },
    maelstrom: {
      description: 'پاور اسپایک پاک کردن موج کریپ',
      timing: '۱۲ تا ۱۸ دقیقه',
    },
    shadow_blade: { description: 'پتانسیل پیک‌آف', timing: '۱۲ تا ۱۸ دقیقه' },
    assault_cuirass: {
      description: 'فایت تیمی + دمیج ساختمان',
      timing: '۲۰ تا ۲۵ دقیقه',
    },
    refresher_orb: {
      description: 'آنلتی دوبل - بازی را همین حالا تمام کن',
      timing: '۳۰ دقیقه به بعد',
    },
    aegis: {
      description: 'روشان - بلافاصله هایگراند را فورس کن',
      timing: '۲۰ دقیقه به بعد',
    },
    cheese: { description: 'جان اضافه برای کری‌ها', timing: '۲۰ دقیقه به بعد' },
  },
  heroSpecific: {
    phantom_assassin: ['battle_fury', 'desolator'],
    sven: ['echo_sabre', 'blink_dagger', 'black_king_bar'],
    medusa: ['manta_style', 'skadi'],
    alchemist: ['radiance'],
    lone_druid: 'level_5',
    nightstalker: 'first_night',
    dragon_knight: 'level_6',
  },
};

export const TOWER_PRIORITY: Record<string, number> = {
  ancient: 100,
  t4: 85,
  t3: 80,
  barracks: 75,
  t2_mid: 60,
  t2_safelane: 55,
  t2_offlane: 50,
  t1_mid: 40,
  t1_safelane: 35,
  t1_offlane: 30,
};

/** حداقل فاصله‌ی ارسال بین پیام‌ها بر اساس اولویت (میلی‌ثانیه) */
export const RATE_LIMITS: Record<string, number> = {
  GAME_ENDING: 0,
  CRITICAL: 10000,
  HIGH: 30000,
  MEDIUM: 60000,
  LOW: 120000,
};

/** کول‌داون اختصاصی پیام‌های CRITICAL برای جلوگیری از اسپم */
export const CRITICAL_COOLDOWN_MS = 30000;

/** اهداف CS بر اساس دقیقه‌ی بازی */
export const CS_TARGETS: Record<number, number> = {
  5: 38,
  10: 82,
  15: 120,
  20: 160,
};

export const GAME_PHASES = {
  laning: { start: 0, end: 600 },
  midgame: { start: 600, end: 1800 },
  lategame: { start: 1800, end: Number.POSITIVE_INFINITY },
} as const;

/** فاصله‌ی زمانی بین ارزیابی‌های موتور کوچینگ (میلی‌ثانیه) */
export const COACHING_EVALUATION_THROTTLE_MS = 1000;

/** فاصله‌ی ارسال وضعیت کوچینگ به داشبورد (میلی‌ثانیه) */
export const COACHING_STATUS_THROTTLE_MS = 2000;
