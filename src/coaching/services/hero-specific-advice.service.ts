// src/coaching/services/hero-specific-advice.service.ts
import { Injectable } from '@nestjs/common';
import type { CoachingAdvice } from '../interfaces/coaching.interface.js';
import type { ProcessedGameState } from '../../gsi/interfaces/processed-game-state.interface.js';
import {
  countAliveEnemies,
  getEnemyBuildings,
  hasAnyItemInState,
} from '../utils/team-metrics.js';

interface HeroAdvice {
  message: string;
  priority: CoachingAdvice['priority'];
  conditions?: (state: ProcessedGameState) => boolean;
}

/**
 * توصیه‌های مخصوص هر هیرو: مکانیک‌ها، تایمینگ آنلتی و آیتم‌های کلیدی.
 */
@Injectable()
export class HeroSpecificAdviceService {
  private readonly heroAdvice: Record<string, HeroAdvice[]> = {
    npc_dota_hero_antimage: [
      {
        message:
          'روی فارم تمرکز کن - AM قبل از Battle Fury و Manta نباید فایت بدهد',
        priority: 'HIGH',
        conditions: (state) => state.gameTime < 1800 && state.hero.level < 16,
      },
      {
        message: 'بلینک را برای فرار نگه دار، نه برای شروع فایت',
        priority: 'MEDIUM',
        conditions: (state) =>
          state.hero.healthPercent < 50 && state.hero.alive,
      },
      {
        message: 'Mana Break قدرت توست - اول هیروهای پرمعنا را هدف بگیر',
        priority: 'MEDIUM',
        conditions: (state) => countAliveEnemies(state) > 0,
      },
    ],
    npc_dota_hero_juggernaut: [
      {
        message: 'Blade Fury برای دوج اسپل است - قبل از استن فعالش کن',
        priority: 'HIGH',
        conditions: (state) =>
          state.hero.healthPercent < 40 && countAliveEnemies(state) > 0,
      },
      {
        message: 'تایمینگ Omnislash - وقتی دشمن تنها یا کم‌جان است بزن',
        priority: 'MEDIUM',
        conditions: (state) =>
          state.hero.level >= 6 && countAliveEnemies(state) > 0,
      },
      {
        message: 'Healing Ward را پشت درخت‌ها بگذار تا در فایت نماند',
        priority: 'LOW',
        conditions: (state) => state.hero.healthPercent < 60,
      },
    ],
    npc_dota_hero_phantom_assassin: [
      {
        message:
          'Blur تو را سخت‌تر برای زدن می‌کند - از آن برای دایو استفاده کن',
        priority: 'MEDIUM',
        conditions: (state) =>
          state.hero.level >= 6 && countAliveEnemies(state) > 0,
      },
      {
        message:
          'کریت Coup de Grace - تا Desolator فارم کن تا دمیج حداکثری بزنی',
        priority: 'HIGH',
        conditions: (state) => state.gameTime < 1500 && state.hero.level < 12,
      },
      {
        message: 'Stifling Dagger - برای لست‌هیت و هrass از راه دور استفاده کن',
        priority: 'LOW',
        conditions: (state) =>
          state.hero.manaPercent > 50 && state.gameTime < 900,
      },
    ],
    npc_dota_hero_invoker: [
      {
        message:
          'اسپل‌های کلیدی را Invoke کن - Tornado+EMP برای فایت، Cold Snap برای گنک',
        priority: 'MEDIUM',
        conditions: (state) =>
          state.hero.level >= 8 && countAliveEnemies(state) > 0,
      },
      {
        message: 'Sun Strike را با استن تیم هماهنگ کن تا کیل شود',
        priority: 'LOW',
        conditions: (state) => state.enemies.some((enemy) => !enemy.alive),
      },
      {
        message: 'Forge Spirit برای پوش - با آن‌ها تاور بزن',
        priority: 'MEDIUM',
        conditions: (state) =>
          (getEnemyBuildings(state).t1 ?? []).some((tower) => !tower.destroyed),
      },
    ],
    npc_dota_hero_pudge: [
      {
        message: 'از فوگ هوک بزن - بین درخت‌ها بایست تا هوک غافلگیرکننده باشد',
        priority: 'MEDIUM',
        conditions: (state) => countAliveEnemies(state) > 0,
      },
      {
        message: 'کمبو Rot + Dismember - قبل از آنلتی نزدیک شو',
        priority: 'HIGH',
        conditions: (state) =>
          state.hero.level >= 6 && countAliveEnemies(state) > 0,
      },
      {
        message: 'استک Flesh Heap - برای تانک شدن کیل و اسیست بگیر',
        priority: 'LOW',
        conditions: (state) => state.player.kills + state.player.assists < 10,
      },
    ],
    npc_dota_hero_puck: [
      {
        message: 'با Orb امن فارم کن - بعد از Blink دنبال پیک‌آف باش',
        priority: 'MEDIUM',
        conditions: (state) =>
          !hasAnyItemInState(state, 'blink') && state.gameTime < 1200,
      },
      {
        message: 'Dream Coil را وقتی دشمن گیر افتاده بزن، بیهوده استفاده نکن',
        priority: 'HIGH',
        conditions: (state) =>
          state.hero.level >= 6 && countAliveEnemies(state) >= 2,
      },
      {
        message:
          'Phase Shift برای دوج اسپل - تایمینگش را با اسپل دشمن هماهنگ کن',
        priority: 'LOW',
        conditions: (state) => state.hero.healthPercent < 70,
      },
    ],
    npc_dota_hero_storm_spirit: [
      {
        message: 'تا Orchid و Bloodstone فارم کن - بعد از آن تک‌تک شکار کن',
        priority: 'HIGH',
        conditions: (state) => state.gameTime < 1500 && state.hero.level < 16,
      },
      {
        message: 'Ball Lightning برای فرار و ورود - مانایت را مدیریت کن',
        priority: 'MEDIUM',
        conditions: (state) => state.hero.manaPercent < 40,
      },
      {
        message: 'با Orchid Soul Ring و آنلتی، ساپورت‌های دشمن را سولو بزن',
        priority: 'MEDIUM',
        conditions: (state) =>
          hasAnyItemInState(state, 'orchid') && countAliveEnemies(state) > 0,
      },
    ],
    npc_dota_hero_tinker: [
      {
        message: 'March of the Machines برای پاک کردن موج - بعد Rearm و پوش',
        priority: 'MEDIUM',
        conditions: (state) => state.hero.level >= 6,
      },
      {
        message: 'بعد از Blink و Dagon، پیک‌آف‌های تک‌نفره بزن',
        priority: 'HIGH',
        conditions: (state) =>
          hasAnyItemInState(state, 'blink') &&
          hasAnyItemInState(state, 'dagon'),
      },
      {
        message: 'مراقب موقعیت باش - Tinker بدون فاصله خیلی سریع می‌میرد',
        priority: 'LOW',
        conditions: (state) => state.hero.healthPercent < 50,
      },
    ],
    npc_dota_hero_crystal_maiden: [
      {
        message: 'پشت تیم بایست و از Frostbite برای کنترل استفاده کن',
        priority: 'MEDIUM',
        conditions: (state) => countAliveEnemies(state) > 0,
      },
      {
        message: 'Freezing Field فقط بعد از استن دشمن یا با BKB بزن',
        priority: 'HIGH',
        conditions: (state) =>
          state.hero.level >= 6 && countAliveEnemies(state) >= 2,
      },
      {
        message:
          'Glimmer و Force Staff برای نجات کری - آیتم ساپورت را فراموش نکن',
        priority: 'LOW',
        conditions: (state) =>
          !hasAnyItemInState(state, 'glimmer') && state.player.gold > 1000,
      },
    ],
    npc_dota_hero_centaur: [
      {
        message: 'بعد از Blink با Stampede و Double Edge فایت را باز کن',
        priority: 'HIGH',
        conditions: (state) =>
          hasAnyItemInState(state, 'blink') && countAliveEnemies(state) >= 2,
      },
      {
        message: 'Blade Mail را قبل از دایو فعال کن تا دمیج برگردد',
        priority: 'MEDIUM',
        conditions: (state) =>
          hasAnyItemInState(state, 'blade_mail') &&
          state.hero.healthPercent < 70,
      },
      {
        message: 'Retaliate با جان زیاد - در خط مقدم بایست و اسپیس بساز',
        priority: 'LOW',
        conditions: (state) => state.hero.level >= 10,
      },
    ],
    npc_dota_hero_earthshaker: [
      {
        message: 'Blink + Echo Slam - منتظر جمع شدن دشمن بمان، تنها نزن',
        priority: 'HIGH',
        conditions: (state) =>
          hasAnyItemInState(state, 'blink') && countAliveEnemies(state) >= 3,
      },
      {
        message: 'Fissure برای قطع مسیر فرار - قبل از فایت موقعیت بگیر',
        priority: 'MEDIUM',
        conditions: (state) => countAliveEnemies(state) > 0,
      },
      {
        message: 'Aghanim Shard روی Enchant Totem - برای دمیج پوش استفاده کن',
        priority: 'LOW',
        conditions: (state) => state.hero.hasAghanimsShard,
      },
    ],
    npc_dota_hero_sniper: [
      {
        message: 'فاصله‌ات را حفظ کن - Sniper نزدیک بماند می‌میرد',
        priority: 'HIGH',
        conditions: (state) =>
          state.hero.healthPercent < 60 && countAliveEnemies(state) > 0,
      },
      {
        message: 'Shrapnel برای فشار روی لین و پوش - فراموشش نکن',
        priority: 'MEDIUM',
        conditions: (state) => state.hero.level >= 4,
      },
      {
        message: 'Assassinate را برای فرار یا فینیش کردن بزن، اول فایت هدر نده',
        priority: 'MEDIUM',
        conditions: (state) =>
          state.hero.level >= 6 && countAliveEnemies(state) > 0,
      },
    ],
    npc_dota_hero_zeus: [
      {
        message: 'Arc Lightning برای هarrass و لست‌هیت - مانا را هدر نده',
        priority: 'LOW',
        conditions: (state) => state.hero.manaPercent > 40,
      },
      {
        message:
          'Thundergod Wrath برای فینیش کردن فراری‌ها - کیل را از دست نده',
        priority: 'MEDIUM',
        conditions: (state) => state.enemies.some((enemy) => !enemy.alive),
      },
      {
        message:
          "Zeus بدون فاصله می‌میرد - پشت تیم بایست و از Heaven's Halberd یا Force استفاده کن",
        priority: 'HIGH',
        conditions: (state) =>
          state.hero.healthPercent < 55 && countAliveEnemies(state) > 0,
      },
    ],
    npc_dota_hero_slardar: [
      {
        message: 'Amplify Damage را روی کری دشمن بزن تا سریع حذف شود',
        priority: 'HIGH',
        conditions: (state) =>
          state.hero.level >= 6 && countAliveEnemies(state) > 0,
      },
      {
        message: 'Blink + Slithereen Crush برای اینیشیشن - گروه را همراه ببر',
        priority: 'MEDIUM',
        conditions: (state) => hasAnyItemInState(state, 'blink'),
      },
      {
        message: 'با Sprint سرعت پوش بده ولی مراقب باش جان کم نکنی',
        priority: 'LOW',
        conditions: (state) => state.hero.healthPercent < 40,
      },
    ],
    npc_dota_hero_enigma: [
      {
        message: 'Black Hole فقط وقتی ۲+ نفر گیر افتادند - تنها نزن',
        priority: 'HIGH',
        conditions: (state) =>
          state.hero.level >= 6 && countAliveEnemies(state) >= 2,
      },
      {
        message: 'Midnight Pulse + Black Hole برای دمیج حداکثری',
        priority: 'MEDIUM',
        conditions: (state) =>
          state.hero.level >= 6 && countAliveEnemies(state) >= 2,
      },
      {
        message: 'Eidolon برای پوش و فارم - با آن‌ها تاور بزن',
        priority: 'MEDIUM',
        conditions: (state) =>
          (getEnemyBuildings(state).t1 ?? []).some((tower) => !tower.destroyed),
      },
    ],
    npc_dota_hero_medusa: [
      {
        message: 'تا ۲ آیتم کلیدی فارم کن - الان نمی‌توانی فایت بدهی',
        priority: 'HIGH',
        conditions: (state) => {
          const keyItems = ['manta', 'skadi', 'butterfly'];
          const owned = keyItems.filter((item) =>
            hasAnyItemInState(state, item),
          ).length;
          return owned < 2 && state.gameTime < 2400;
        },
      },
      {
        message: 'Stone Gaze را وقتی دشمن کامیت کرد بزن، هدر نده',
        priority: 'HIGH',
        conditions: (state) =>
          state.hero.level >= 6 && countAliveEnemies(state) >= 2,
      },
      {
        message: 'Mana Shield را مدیریت کن - مانا = جان توست',
        priority: 'MEDIUM',
        conditions: (state) => state.hero.manaPercent < 50,
      },
    ],
    npc_dota_hero_spectre: [
      {
        message: 'تا Radiance و Manta فارم کن - اسکیل لیت داری',
        priority: 'HIGH',
        conditions: (state) =>
          (!hasAnyItemInState(state, 'radiance') ||
            !hasAnyItemInState(state, 'manta')) &&
          state.gameTime < 1800,
      },
      {
        message: 'Haunt در فایت تیمی - حضور گلوبال و کیل را قطع نکن',
        priority: 'HIGH',
        conditions: (state) =>
          state.hero.level >= 6 && countAliveEnemies(state) >= 2,
      },
      {
        message: 'با Dispersion و Blade Mail دمیج را برگردان',
        priority: 'MEDIUM',
        conditions: (state) => state.hero.healthPercent < 60,
      },
    ],
  };

  public getAdvice(state: ProcessedGameState): CoachingAdvice | null {
    const adviceList = this.findHeroAdvice(state.hero.name);
    if (adviceList.length === 0) {
      return null;
    }

    const matching = adviceList.find(
      (advice) => !advice.conditions || advice.conditions(state),
    );
    const chosen = matching ?? adviceList[0];

    return {
      priority: chosen.priority,
      message: chosen.message,
      action: 'hero_specific',
      timestamp: Date.now(),
      gameTime: state.gameTime,
    };
  }

  public getAbilityTips(state: ProcessedGameState): CoachingAdvice | null {
    const readyUltimates = Object.values(state.abilities).filter(
      (ability) => ability.isUltimate && ability.ready && ability.level > 0,
    );

    if (readyUltimates.length === 0 || state.gameTime <= 600) {
      return null;
    }

    const unusedUltTime =
      state.gameTime - (readyUltimates[0].cooldownRemaining || 0);
    if (unusedUltTime <= 60 || !state.enemies.some((enemy) => enemy.alive)) {
      return null;
    }

    return {
      priority: 'MEDIUM',
      message: `آنلتی ${readyUltimates[0].name} آماده است - دنبال فرصت استفاده از آن باش`,
      action: 'ability_usage',
      timestamp: Date.now(),
      gameTime: state.gameTime,
    };
  }

  private findHeroAdvice(heroName: string): HeroAdvice[] {
    if (this.heroAdvice[heroName]) {
      return this.heroAdvice[heroName];
    }

    const normalized = heroName.toLowerCase();
    const match = Object.keys(this.heroAdvice).find((key) =>
      normalized.includes(key.replace('npc_dota_hero_', '')),
    );

    return match ? this.heroAdvice[match] : [];
  }
}
