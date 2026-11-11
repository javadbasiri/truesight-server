// src/gsi/rule-engine.service.ts
import { Injectable } from '@nestjs/common';
import {
  CoachAlertPayload,
  GsiHero,
  GsiItems,
  GsiMap,
  GsiPayload,
  GsiPlayer
} from './gsi-payload.interface.js';
import { CoachGateway } from '../../coach.gateway.js';

interface PowerSpikeConfig {
  message: string;
  audioKey: string;
}

@Injectable()
export class RuleEngineService {
  private lastTriggeredClockTime: number = -9999;
  private currentMatchId: string = '';

  // قفل‌های وضعیت (Hysteresis Locks) برای جلوگیری از اسپم
  private lowManaWarned: boolean = false;
  private lowHpWarned: boolean = false;
  private noBuybackWarned: boolean = false;

  // لیست آیتم‌هایی که در این مچ هشدار آن‌ها داده شده است (مقاوم در برابر جابه‌جایی اسلات)
  private notifiedItems: Set<string> = new Set();

  // دیکشنری آیتم‌های کلیدی و پیام‌های پاور اسپایک
  private readonly POWER_SPIKE_ITEMS: Record<string, PowerSpikeConfig> = {
    item_bottle: {
      message:
        'باتل آماده شد! برای ترید کردن در لین و کنترل Water Rune استفاده کن.',
      audioKey: 'spike_bottle',
    },
    item_blink: {
      message:
        'بلینک دگر کامل شد! با اسموک یا تاریکی شب دنبال شروع فایت و پیک‌آف باش.',
      audioKey: 'spike_blink',
    },
    item_black_king_bar: {
      message:
        'آیتم BKB آماده است! بهترین تایمینگ برای گرفتن فایت ۵ نفره و آبجکتیو.',
      audioKey: 'spike_bkb',
    },
    item_orchid: {
      message:
        'ارکید (Orchid) کامل شد! قبل از اینکه حریف آیتم دیسپل بیاورد سولو کیل بگیر.',
      audioKey: 'spike_orchid',
    },
    item_witch_blade: {
      message:
        'ویچ‌بلید آماده است! دمیج و اسلوی خودت رو در درگیری‌های اولیه اعمال کن.',
      audioKey: 'spike_witch_blade',
    },
    item_kaya_and_sange: {
      message:
        'آیتم Kaya & Sange کامل شد! پاور اسپایک مانا و مقاومت در فایت‌ها.',
      audioKey: 'spike_kns',
    },
    item_aghanims_scepter: {
      message:
        'آگانیم سپتر کامل شد! از قابلیت ارتقایافته هیرو در فایت بعدی بهره ببر.',
      audioKey: 'spike_scepter',
    },
    item_desolator: {
      message:
        'دزولیتور آماده است! فشار روی تاورها و احتمال زدن روشان را بررسی کن.',
      audioKey: 'spike_desolator',
    },
    item_manta: {
      message:
        'مانتا استایل کامل شد! از آن برای دیسپل کردن سایلنس و پوش دادن لین‌ها استفاده کن.',
      audioKey: 'spike_manta',
    },
    item_sphere: {
      message:
        'لینکنز اسفر آماده است! با خیال راحت‌تر لین‌های کناری را پوش بده.',
      audioKey: 'spike_linkens',
    },
  };

  constructor(private readonly coachGateway: CoachGateway) {}

  /**
   * نقطه ورود اصلی پردازش هر تیک GSI
   */
  public processGsiTick(payload: GsiPayload): void {
    if (
      !payload.map ||
      payload.map.game_state !== 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS'
    ) {
      return;
    }

    const { map, hero, items, player } = payload;

    // بررسی شروع بازی جدید یا ریست شدن تایمر در حالت Demo Hero
    this.checkAndResetMatchState(map);

    // ۱. ارزیابی قوانین زمان‌محور (فقط یک بار در هر ثانیه از بازی)
    if (map.clock_time !== this.lastTriggeredClockTime) {
      this.lastTriggeredClockTime = map.clock_time;
      this.evaluateMacroTimers(map);
    }

    // ۲. ارزیابی منابع هیرو و اقتصاد (State-based)
    if (hero && hero.alive) {
      this.evaluateHeroResources(hero, player, map.clock_time);
    }

    // ۳. ارزیابی خرید آیتم‌های جدید و پاور اسپایک‌ها (Inventory Diffing)
    if (items) {
      this.evaluateItemSpikes(items);
    }
  }

  /**
   * پاکسازی حافظه در صورت تغییر Match ID یا عقب برگشتن تایمر (در Demo Hero)
   */
  private checkAndResetMatchState(map: GsiMap): void {
    const isClockRewound = map.clock_time < this.lastTriggeredClockTime - 5;
    const isNewMatch = map.matchid !== this.currentMatchId;

    if (isNewMatch || isClockRewound) {
      this.currentMatchId = map.matchid;
      this.lastTriggeredClockTime = map.clock_time;
      this.lowManaWarned = false;
      this.lowHpWarned = false;
      this.noBuybackWarned = false;
      this.notifiedItems.clear();
    }
  }

  /**
   * قوانین تایمرهای ماکرو (Runes, Stacking, Day/Night, Tormentor)
   */
  private evaluateMacroTimers(map: GsiMap): void {
    const t = map.clock_time;

    // هشدار Water Rune (دقیقه 2:00 و 4:00 -> اعلام در 1:45 و 3:45)
    if (t === 105 || t === 225) {
      this.emit({
        id: `water-rune-${t}`,
        message:
          '۱۵ ثانیه تا اسپاون Water Rune! موج کریپ‌های میدلین را سریع پوش بده.',
        type: 'info',
        audioKey: 'timer_water_rune',
      });
    }

    // هشدار اولین شب بازی (دقیقه 5:00 -> اعلام در 4:45)
    if (t === 285) {
      this.emit({
        id: 'first-night-285',
        message:
          '۱۵ ثانیه تا اولین شب بازی! دید مپ کم می‌شود، مراقب گنک ساپورت‌ها باش.',
        type: 'warning',
        audioKey: 'timer_first_night',
      });
    }

    // هشدار Power Rune از دقیقه 6:00 به بعد (هر ۲ دقیقه، ۱۵ ثانیه قبل از اسپاون)
    if (t >= 345 && (t + 15) % 120 === 0) {
      this.emit({
        id: `power-rune-${t}`,
        message:
          'پاور رون تا ۱۵ ثانیه دیگر اسپاون می‌شود! وضعیت باتل و مپ را چک کن.',
        type: 'spike',
        audioKey: 'timer_power_rune',
      });
    }

    // هشدار Wisdom Rune (هر ۷ دقیقه، ۲۰ ثانیه قبل از اسپاون: 6:40، 13:40 و...)
    if (t >= 400 && (t + 20) % 420 === 0) {
      this.emit({
        id: `wisdom-rune-${t}`,
        message:
          '۲۰ ثانیه تا اسپاون Wisdom Rune! آماده گرفتن XP یا دزدیدن رون حریف باش.',
        type: 'spike',
        audioKey: 'timer_wisdom_rune',
      });
    }

    // هشدار Lotus Pool (هر ۳ دقیقه تا دقیقه ۱۵، ۱۵ ثانیه قبل از اسپاون)
    if (t > 0 && t <= 900 && (t + 15) % 180 === 0) {
      this.emit({
        id: `lotus-${t}`,
        message: '۱۵ ثانیه تا آماده شدن لوتوس (Lotus Pool) در کنار لین‌ها.',
        type: 'info',
        audioKey: 'timer_lotus',
      });
    }

    // هشدار استک کردن کمپ‌های جنگل (ثانیه 45 هر دقیقه، از دقیقه ۱ تا ۱۵)
    if (t >= 105 && t <= 900 && t % 60 === 45) {
      this.emit({
        id: `stack-camp-${t}`,
        message:
          '۱۰ ثانیه تا زمان استک کردن کمپ‌های جنگل و Triangle (ثانیه ۵۵).',
        type: 'info',
        audioKey: 'timer_stack',
      });
    }
  }

  /**
   * قوانین وضعیت هیرو (HP, Mana, Buyback)
   */
  private evaluateHeroResources(
    hero: GsiHero,
    player: GsiPlayer | undefined,
    clockTime: number,
  ): void {
    // ۱. مدیریت هشدار مانا با Hysteresis (هشدار زیر ۲۵٪، ریست شدن قفل بالای ۳۵٪)
    if (hero.mana_percent < 25 && !this.lowManaWarned) {
      this.lowManaWarned = true;
      this.emit({
        id: `low-mana-${Date.now()}`,
        message:
          'مانای شما زیر ۲۵٪ است! کلریتی یا باتل بزن و بدون مانا جلو نرو.',
        type: 'warning',
        audioKey: 'warn_low_mana',
      });
    } else if (hero.mana_percent >= 35) {
      this.lowManaWarned = false;
    }

    // ۲. مدیریت هشدار سلامتی (HP) (هشدار زیر ۲۵٪، ریست شدن قفل بالای ۴۵٪)
    if (hero.health_percent < 25 && !this.lowHpWarned) {
      this.lowHpWarned = true;
      this.emit({
        id: `low-hp-${Date.now()}`,
        message:
          'خطر مرگ! اچ‌پی شما بحرانی است، عقب بکش یا آیتم هیلینگ استفاده کن.',
        type: 'warning',
        audioKey: 'warn_low_hp',
      });
    } else if (hero.health_percent >= 45) {
      this.lowHpWarned = false;
    }

    // ۳. بررسی وضعیت Buyback در لیت‌گیم (از دقیقه ۲۵ به بعد)
    if (player && clockTime >= 1500 && hero.buyback_cooldown === 0) {
      const hasBuybackGold = player.gold >= hero.buyback_cost;
      if (!hasBuybackGold && !this.noBuybackWarned) {
        this.noBuybackWarned = true;
        this.emit({
          id: `no-buyback-${Date.now()}`,
          message:
            'طلای کافی برای Buyback نداری! در فایت‌های ریسکی با احتیاط بازی کن.',
          type: 'warning',
          audioKey: 'warn_no_buyback',
        });
      } else if (hasBuybackGold) {
        this.noBuybackWarned = false;
      }
    }
  }

  /**
   * بررسی اسلات‌های اصلی اینونتوری برای تشخیص خرید آیتم‌های Power Spike
   */
  private evaluateItemSpikes(items: GsiItems): void {
    const activeSlots = [
      items.slot0,
      items.slot1,
      items.slot2,
      items.slot3,
      items.slot4,
      items.slot5,
    ];

    for (const slot of activeSlots) {
      if (!slot || slot.name === 'empty') {
        continue;
      }

      const itemName = slot.name;
      const spikeConfig = this.POWER_SPIKE_ITEMS[itemName];

      // اگر آیتم جزو لیست پاور اسپایک است و قبلاً در این بازی اعلام نشده است
      if (spikeConfig && !this.notifiedItems.has(itemName)) {
        this.notifiedItems.add(itemName);
        this.emit({
          id: `spike-${itemName}-${Date.now()}`,
          message: spikeConfig.message,
          type: 'spike',
          audioKey: spikeConfig.audioKey,
        });
      }
    }
  }

  private emit(alert: CoachAlertPayload): void {
    this.coachGateway.sendAlert(alert);
  }
}
