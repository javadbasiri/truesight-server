// src/coaching/services/situation-database.service.ts
import { Injectable } from '@nestjs/common';
import type { CoachingAdvice } from '../interfaces/coaching.interface.js';
import type { ProcessedGameState } from '../../gsi/interfaces/processed-game-state.interface.js';
import {
  countAliveEnemies,
  countDeadEnemies,
  countReadyUltimates,
  getEnemyBuildings,
  getExpectedCS,
  getLowHealthTowers,
  getNetWorthDelta,
  getOwnBuildings,
  hasAnyItemInState,
} from '../utils/team-metrics.js';

interface Situation {
  id: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  check: (state: ProcessedGameState) => boolean;
  getAdvice: (state: ProcessedGameState) => string;
  cooldown?: number;
}

/**
 * پایگاه موقعیت‌ها: ۵۱ سناریوی مشخص بازی با تریگر، اولویت و پیام اقدام‌محور.
 * تنها بالاترین اولویت در هر تیک برگردانده می‌شود و هر موقعیت کول‌داون دارد.
 */
@Injectable()
export class SituationDatabaseService {
  private readonly lastTriggered = new Map<string, number>();
  private readonly cooldownBuffer = 30;
  private readonly situations: Situation[] = [];

  constructor() {
    this.initializeSituations();
  }

  public checkSituations(state: ProcessedGameState): CoachingAdvice | null {
    const now = Date.now();
    const valid = this.situations.filter((situation) => {
      const last = this.lastTriggered.get(situation.id) ?? 0;
      const cooldownMs = (situation.cooldown ?? this.cooldownBuffer) * 1000;
      if (now - last < cooldownMs) {
        return false;
      }

      try {
        return situation.check(state);
      } catch {
        return false;
      }
    });

    if (valid.length === 0) {
      return null;
    }

    const priorityOrder: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    valid.sort(
      (first, second) =>
        (priorityOrder[second.priority] ?? 0) -
        (priorityOrder[first.priority] ?? 0),
    );

    const top = valid[0];
    const message = top.getAdvice(state);
    if (!message) {
      return null;
    }

    this.lastTriggered.set(top.id, now);

    return {
      priority: top.priority,
      message,
      action: `situation:${top.id}`,
      timestamp: now,
      gameTime: state.gameTime,
    };
  }

  public clearCooldowns(): void {
    this.lastTriggered.clear();
  }

  private initializeSituations(): void {
    this.situations.push(
      {
        id: 'enemy_riki_detection',
        priority: 'HIGH',
        check: (state) =>
          this.hasEnemyHero(state, 'riki') &&
          !this.hasDetection(state) &&
          state.gameTime > 300,
        getAdvice: () =>
          'ریکی در تیم دشمن است - همین حالا دتکشن بخر (سنتری/دست/جم) وگرنه می‌میری',
      },
      {
        id: 'enemy_clinkz_detection',
        priority: 'HIGH',
        check: (state) =>
          this.hasEnemyHero(state, 'clinkz') &&
          !this.hasDetection(state) &&
          state.gameTime > 600,
        getAdvice: () =>
          'کلینکز دشمن است - دتکشن بخر، بدون آن تو را پیک می‌کند',
      },
      {
        id: 'enemy_bounty_hunter_detection',
        priority: 'MEDIUM',
        check: (state) =>
          this.hasEnemyHero(state, 'bounty') &&
          !this.hasDetection(state) &&
          state.gameTime > 300,
        getAdvice: () =>
          'بانتی هانتر دشمن است - سنتری بخر تا Track را بی‌اثر کنی',
      },
      {
        id: 'heavy_magic_damage_no_bkb',
        priority: 'HIGH',
        check: (state) => {
          const magicHeroes = [
            'zeus',
            'lina',
            'lion',
            'skywrath',
            'pugna',
            'tinker',
            'invoker',
          ];
          const threats = state.enemies.filter(
            (enemy) =>
              (enemy.level ?? 0) > 8 &&
              magicHeroes.some((hero) =>
                (enemy.heroName ?? '').toLowerCase().includes(hero),
              ),
          );
          return (
            threats.length >= 2 &&
            !hasAnyItemInState(state, 'black_king_bar') &&
            state.gameTime > 1200 &&
            state.player.gold > 3000
          );
        },
        getAdvice: () =>
          'چند دمیج‌دیلر جادویی داری - فوراً BKB ببند وگرنه برست می‌شوی',
      },
      {
        id: 'enemy_zeus_no_pipe',
        priority: 'HIGH',
        check: (state) =>
          this.hasEnemyHero(state, 'zeus') &&
          !hasAnyItemInState(state, ['pipe', 'hood', 'black_king_bar']) &&
          state.hero.level > 10 &&
          state.gameTime > 1200,
        getAdvice: () =>
          'زئوس دشمن است و آیتم ضد جادو نداری - Pipe یا BKB ببند وگرنه برست می‌شوی',
      },
      {
        id: 'heavy_physical_no_armor',
        priority: 'MEDIUM',
        check: (state) => {
          const physicalHeroes = [
            'sven',
            'phantom_assassin',
            'troll',
            'ursa',
            'slardar',
          ];
          const threats = state.enemies.filter(
            (enemy) =>
              (enemy.level ?? 0) > 10 &&
              physicalHeroes.some((hero) =>
                (enemy.heroName ?? '').toLowerCase().includes(hero),
              ),
          );
          return (
            threats.length >= 2 &&
            !hasAnyItemInState(state, ['assault', 'shivas', 'crimson']) &&
            state.gameTime > 1500
          );
        },
        getAdvice: () =>
          'دمیج فیزیکی دشمن زیاد است - آیتم زره‌ای مثل AC یا شیواس بگیر',
      },
      {
        id: 'roshan_respawning_soon',
        priority: 'HIGH',
        check: (state) =>
          !state.roshan.alive &&
          state.roshan.respawnTime !== undefined &&
          state.roshan.respawnTime - state.gameTime < 90 &&
          state.roshan.respawnTime - state.gameTime > 0 &&
          state.gameTime > 1200,
        getAdvice: (state) =>
          `روشان ${Math.floor(((state.roshan.respawnTime ?? 0) - state.gameTime) / 60)} دقیقه دیگر اسپاون می‌شود - برای آیجیس آماده شو`,
      },
      {
        id: 'roshan_available_no_aegis',
        priority: 'HIGH',
        check: (state) =>
          state.roshan.alive &&
          state.gameTime > 1200 &&
          state.enemies.filter(
            (enemy) => !enemy.alive && !enemy.buybackAvailable,
          ).length >= 2,
        getAdvice: () => 'روشان آزاد است و دشمن مرده - همین حالا روشان بزن',
      },
      {
        id: 'enemy_has_aegis_push',
        priority: 'CRITICAL',
        check: (state) =>
          state.roshan.aegisHolder ===
            (state.player.team === 'radiant' ? 'dire' : 'radiant') &&
          state.gameTime > 1200,
        getAdvice: () =>
          'دشمن آیجیس دارد - دفاعی بازی کن و فایت بد نده تا آیجیسش تمام شود',
      },
    );

    this.situations.push(
      {
        id: 'enemy_tower_low_health',
        priority: 'MEDIUM',
        check: (state) =>
          getLowHealthTowers(getEnemyBuildings(state), 30).length > 0 &&
          state.hero.healthPercent > 50 &&
          state.hero.alive,
        getAdvice: (state) => {
          const tower = getLowHealthTowers(getEnemyBuildings(state), 30)[0];
          return `تاور دشمن روی ${Math.floor(tower.healthPercent)}% است - قبل از دفاع کردنشان تمامش کن`;
        },
      },
      {
        id: 'your_tower_low_health',
        priority: 'HIGH',
        check: (state) =>
          getLowHealthTowers(getOwnBuildings(state), 40).length > 0 &&
          state.enemies.some((enemy) => enemy.alive),
        getAdvice: () =>
          'تاور خودت جان کم دارد - دفاعش کن یا TP برگرد، افتادن تاور مپ را باز می‌کند',
      },
      {
        id: 'enemy_core_dead_no_buyback',
        priority: 'HIGH',
        check: (state) =>
          state.enemies.filter(
            (enemy) =>
              !enemy.alive &&
              !enemy.buybackAvailable &&
              enemy.netWorth > state.team.netWorth * 0.15,
          ).length >= 1 && state.gameTime > 1800,
        getAdvice: () =>
          'کری دشمن مرده و بای‌بک ندارد - همین حالا پوش بده، پنجره‌ی توست',
      },
      {
        id: 'you_dead_buyback_available',
        priority: 'MEDIUM',
        check: (state) =>
          !state.hero.alive &&
          state.hero.buybackAvailable &&
          state.gameTime > 1800 &&
          state.enemies.some((enemy) => enemy.alive) &&
          state.player.gold >= state.hero.buybackCost * 1.2,
        getAdvice: (state) =>
          `بای‌بک آماده داری (${Math.floor(state.hero.buybackCost)} گلد) - برای فایت حیاتی نگهش دار`,
      },
      {
        id: 'large_lead_enemies_dead',
        priority: 'HIGH',
        check: (state) =>
          getNetWorthDelta(state) > 5000 &&
          countDeadEnemies(state) >= 2 &&
          state.gameTime > 1500,
        getAdvice: () =>
          'برتری بزرگ + دشمن مرده - بازی را تمام کن، با فارم ترو نکن',
      },
      {
        id: 'behind_networth_farm',
        priority: 'MEDIUM',
        check: (state) =>
          getNetWorthDelta(state) < -3000 &&
          state.gameTime < 2400 &&
          state.hero.level < 18,
        getAdvice: () =>
          'از نظر ارزش خالص عقبی - امن فارم کن و تا جبران نشده فایت نده',
      },
    );

    this.situations.push(
      {
        id: 'ultimate_ready_long_time',
        priority: 'MEDIUM',
        check: (state) =>
          countReadyUltimates(state) > 0 &&
          state.enemies.some((enemy) => enemy.alive) &&
          state.gameTime > 600,
        getAdvice: (state) => {
          const ultimate = Object.values(state.abilities).find(
            (ability) =>
              ability.isUltimate && ability.ready && ability.level > 0,
          );
          return `آنلتی ${ultimate?.name ?? ''} آماده است - در فایت بعدی استفاده کن، هدر نده`;
        },
      },
      {
        id: 'low_mana_cant_cast',
        priority: 'MEDIUM',
        check: (state) =>
          state.hero.manaPercent < 30 &&
          Object.values(state.abilities).some(
            (ability) =>
              ability.isUltimate &&
              ability.level > 0 &&
              ability.cooldownRemaining < 30,
          ) &&
          state.enemies.some((enemy) => enemy.alive),
        getAdvice: () =>
          'مانا کم داری - کلریتی یا مانگو بخر، برای فایت بعدی مانا لازم داری',
      },
      {
        id: 'no_vision_enemy_side',
        priority: 'MEDIUM',
        check: (state) =>
          (getEnemyBuildings(state).t1 ?? []).filter((tower) => tower.destroyed)
            .length >= 2 && state.gameTime > 1200,
        getAdvice: () =>
          'T1های دشمن افتاده - در جنگل خودشان وارد بگذار تا کنترل مپ بگیری',
      },
      {
        id: 'pushing_highground_no_vision',
        priority: 'HIGH',
        check: (state) =>
          (getEnemyBuildings(state).t2 ?? []).filter((tower) => tower.destroyed)
            .length >= 2 &&
          (getEnemyBuildings(state).t3 ?? []).some(
            (tower) => !tower.destroyed,
          ) &&
          state.enemies.some((enemy) => enemy.alive),
        getAdvice: () =>
          'داری هایگراند می‌زنی - قبل از ورود سنتری و وارد بگذار، دید حیاتی است',
      },
    );

    this.situations.push(
      {
        id: 'close_to_bkb_timing',
        priority: 'MEDIUM',
        check: (state) =>
          !hasAnyItemInState(state, 'black_king_bar') &&
          state.player.gold > 3000 &&
          state.player.gold < 4500 &&
          state.gameTime > 1200,
        getAdvice: () =>
          'نزدیک BKB هستی - هر چه زودتر ببندش، برای فایت بعدی ایمنی جادویی لازم داری',
      },
      {
        id: 'blink_dagger_timing',
        priority: 'MEDIUM',
        check: (state) => {
          const needsBlink = [
            'axe',
            'centaur',
            'tide',
            'enigma',
            'magnus',
            'sand_king',
          ].some((hero) => state.hero.name.toLowerCase().includes(hero));
          return (
            needsBlink &&
            !hasAnyItemInState(state, 'blink') &&
            state.player.gold > 1800 &&
            state.player.gold < 2500 &&
            state.gameTime > 600
          );
        },
        getAdvice: () =>
          'تایمینگ بلینک دگر - ببندش تا پاور اسپایک اینیشیشن بگیری',
      },
      {
        id: 'teamfight_advantage',
        priority: 'HIGH',
        check: (state) =>
          countReadyUltimates(state) >= 2 &&
          countAliveEnemies(state) >= 3 &&
          state.hero.healthPercent > 60,
        getAdvice: () =>
          'فایت تیمی به نفع توست - ۲+ آنلتی آماده، عدد را فورس کن',
      },
      {
        id: 'split_push_opportunity',
        priority: 'MEDIUM',
        check: (state) =>
          state.gameTime > 1200 &&
          state.enemies.filter((enemy) => enemy.alive && enemy.visible)
            .length <= 2 &&
          hasAnyItemInState(state, ['travel', 'manta', 'necronomicon']),
        getAdvice: () =>
          'دشمن روی یک لین جمع شده - با هیروی اسپلیت‌پوشت لین خالی را بزن',
      },
      {
        id: 'losing_lane_cs',
        priority: 'MEDIUM',
        check: (state) =>
          state.gameTime < 900 &&
          state.player.lastHits < getExpectedCS(state.gameTime) * 0.6,
        getAdvice: () => 'لین را باختی - روی لست‌هیت تمرکز کن، بیهوده ترید نکن',
      },
      {
        id: 'winning_lane_pressure',
        priority: 'MEDIUM',
        check: (state) => {
          const enemy = state.enemies.find((entry) => entry.alive);
          return (
            !!enemy &&
            state.gameTime < 900 &&
            state.player.lastHits > getExpectedCS(state.gameTime) * 0.8 &&
            state.hero.level > (enemy.level ?? 0)
          );
        },
        getAdvice: () =>
          'داری لین را می‌بری - فشار بده، کریپ دینی کن و گنک بخواه',
      },
    );

    this.situations.push(
      {
        id: 'level_6_power_spike',
        priority: 'MEDIUM',
        check: (state) =>
          state.hero.level === 6 &&
          state.gameTime < 600 &&
          Object.values(state.abilities).some(
            (ability) => ability.isUltimate && ability.level === 1,
          ),
        getAdvice: () =>
          'پاور اسپایک لول ۶ - با آنلتی کیل بگیر یا دشمن را از لین بیرون کن',
      },
      {
        id: 'key_item_timing',
        priority: 'HIGH',
        cooldown: 120,
        check: (state) =>
          state.gameTime > 600 &&
          state.enemies.some((enemy) => enemy.alive) &&
          ['battle_fury', 'radiance', 'blink', 'black_king_bar'].some((item) =>
            hasAnyItemInState(state, item),
          ),
        getAdvice: () =>
          'آیتم کلیدی کامل شد - این پاور اسپایک توست، دنبال فایت یا آبجکتیو باش',
      },
      {
        id: 'level_12_talent_spike',
        priority: 'MEDIUM',
        check: (state) =>
          state.hero.level === 12 &&
          state.gameTime >= 600 &&
          state.gameTime < 1800,
        getAdvice: () => 'تالنت لول ۱۲ باز شد - قدرتت زیاد شد، دنبال پلی باش',
      },
      {
        id: 'level_20_talent_spike',
        priority: 'HIGH',
        check: (state) => state.hero.level === 20 && state.gameTime >= 1200,
        getAdvice: () => 'تالنت لول ۲۰ - پاور اسپایک بزرگ، آبجکتیو را فورس کن',
      },
      {
        id: 'dont_chase_kills',
        priority: 'HIGH',
        check: (state) =>
          getNetWorthDelta(state) > 5000 &&
          countDeadEnemies(state) >= 1 &&
          state.hero.healthPercent < 50 &&
          state.gameTime > 900,
        getAdvice: () => 'دنبال کیل نرو - آبجکتیو بزن، کیل ارزشش را ندارد',
      },
      {
        id: 'back_after_objective',
        priority: 'HIGH',
        check: (state) =>
          state.gameTime > 600 &&
          state.hero.healthPercent < 40 &&
          state.hero.alive &&
          [
            ...(getEnemyBuildings(state).t1 ?? []),
            ...(getEnemyBuildings(state).t2 ?? []),
          ].some((tower) => tower.destroyed),
        getAdvice: () =>
          'بعد از آبجکتیو جان کم داری - برگرد و هیل کن، برتری را ترو نکن',
      },
      {
        id: 'dont_dive_fountain',
        priority: 'CRITICAL',
        check: (state) => {
          const enemyBuildings = getEnemyBuildings(state);
          const allT3Down = (enemyBuildings.t3 ?? []).every(
            (tower) => tower.destroyed,
          );
          const barracksDown =
            (enemyBuildings.barracks ?? []).length > 0 &&
            (enemyBuildings.barracks ?? []).every(
              (barracks) => barracks.destroyed,
            );
          return (
            allT3Down &&
            barracksDown &&
            state.enemies.some((enemy) => enemy.alive) &&
            state.gameTime > 1800
          );
        },
        getAdvice: () =>
          'فارم فواره نرو - Ancient را بزن، دایو کردن یعنی ترو کردن بازی',
      },
      {
        id: 'huge_lead_dont_force',
        priority: 'HIGH',
        check: (state) =>
          getNetWorthDelta(state) > 20000 && state.gameTime > 1500,
        getAdvice: () =>
          '۲۰ هزار گلد جلو هستی - ایمن بازی کن، یک اشتباه مساوی از دست دادن برتری است',
      },
      {
        id: 'push_t1_mid_4_dead',
        priority: 'HIGH',
        check: (state) => {
          const midT1 = (getEnemyBuildings(state).t1 ?? []).find((tower) =>
            tower.name.toLowerCase().includes('mid'),
          );
          return (
            countDeadEnemies(state) >= 4 &&
            !!midT1 &&
            !midT1.destroyed &&
            state.hero.alive
          );
        },
        getAdvice: () =>
          'T1 مید را بزن - ۴ نفر از دشمن مرده‌اند، تاور آزاد است',
      },
      {
        id: 'take_t2_and_back',
        priority: 'MEDIUM',
        check: (state) =>
          getLowHealthTowers(getEnemyBuildings(state), 30).some((tower) =>
            tower.name.includes('t2'),
          ) &&
          (getEnemyBuildings(state).t3 ?? []).some(
            (tower) => !tower.destroyed,
          ) &&
          state.hero.healthPercent < 60,
        getAdvice: () => 'T2 را بزن و برگرد - هایگراند نرو، اول هیل کن',
      },
      {
        id: 'siege_t3_with_aegis',
        priority: 'CRITICAL',
        check: (state) =>
          state.roshan.aegisHolder === state.player.team &&
          (getEnemyBuildings(state).t3 ?? []).some(
            (tower) => !tower.destroyed,
          ) &&
          state.gameTime > 1200,
        getAdvice: () => 'T3 را بزن - آیجیس داری، هایگراند را فورس کن',
      },
    );

    this.situations.push(
      {
        id: 'rosh_3_dead_60_sec_window',
        priority: 'HIGH',
        check: (state) => {
          const dead = state.enemies.filter((enemy) => !enemy.alive);
          const minRespawn =
            dead.length > 0
              ? Math.min(...dead.map((enemy) => enemy.respawnSeconds))
              : 999;
          return (
            state.roshan.alive &&
            dead.length >= 3 &&
            minRespawn >= 60 &&
            state.gameTime > 1200
          );
        },
        getAdvice: () =>
          'روشان آزاد است - ۳ نفر مرده‌اند، ۶۰ ثانیه پنجره داری، بزنش',
      },
      {
        id: 'dont_rosh_no_vision',
        priority: 'CRITICAL',
        check: (state) =>
          state.roshan.alive &&
          !hasAnyItemInState(state, ['ward', 'gem']) &&
          countAliveEnemies(state) >= 3 &&
          state.gameTime > 1200,
        getAdvice: () =>
          'روشان نرو - دید نداری و دشمن کامیت است، این دقیقاً ترو کردن است',
      },
      {
        id: 'rosh_respawn_30_sec',
        priority: 'MEDIUM',
        check: (state) =>
          !state.roshan.alive &&
          state.roshan.respawnTime !== undefined &&
          state.roshan.respawnTime - state.gameTime <= 30 &&
          state.roshan.respawnTime - state.gameTime > 0 &&
          state.gameTime > 1200,
        getAdvice: () =>
          'روشان ۳۰ ثانیه دیگر اسپاون می‌شود - نزدیک پیت موقعیت بگیر',
      },
      {
        id: 'enemy_no_buyback_end_game',
        priority: 'CRITICAL',
        check: (state) => {
          const noBuyback = state.enemies.filter(
            (enemy) =>
              !enemy.buybackAvailable &&
              enemy.netWorth > state.team.netWorth * 0.15,
          );
          return (
            noBuyback.length >= 1 &&
            countDeadEnemies(state) >= 1 &&
            state.gameTime > 2400
          );
        },
        getAdvice: () =>
          'کری دشمن بای‌بک ندارد - بکش و بازی را تمام کن، این همان پنجره است',
      },
      {
        id: 'save_buyback_ancient',
        priority: 'HIGH',
        check: (state) =>
          state.hero.buybackAvailable &&
          (getEnemyBuildings(state).t3 ?? []).filter(
            (tower) => !tower.destroyed,
          ).length === 0 &&
          state.gameTime > 2400,
        getAdvice: () =>
          'بای‌بک را نگه دار - فقط برای دفاع از Ancient یا تمام کردن بازی استفاده کن',
      },
      {
        id: 'massive_lead_end_game',
        priority: 'CRITICAL',
        check: (state) =>
          getNetWorthDelta(state) > 15000 &&
          countDeadEnemies(state) >= 2 &&
          state.gameTime > 2400,
        getAdvice: () =>
          'برتری عظیم + دشمن مرده - همین حالا بازی را تمام کن، فارم نکن',
      },
      {
        id: 'behind_smoke_gank',
        priority: 'MEDIUM',
        check: (state) =>
          getNetWorthDelta(state) < -5000 &&
          state.gameTime > 1200 &&
          state.gameTime < 2400,
        getAdvice: () =>
          'از نظر گلد عقبی - با اسموک کری دشمن را گنک کن، پیک‌آف لازم داری',
      },
      {
        id: 'all_ultimates_ready',
        priority: 'HIGH',
        check: (state) =>
          countReadyUltimates(state) >= 2 &&
          countAliveEnemies(state) >= 3 &&
          state.gameTime > 900,
        getAdvice: () =>
          'همه‌ی آنلتی‌ها آماده‌اند - همین حالا فایت را فورس کن، برتری داری',
      },
      {
        id: 'enemy_bkb_cooldown',
        priority: 'MEDIUM',
        check: (state) =>
          getNetWorthDelta(state) > 0 &&
          state.enemies.some((enemy) => enemy.alive) &&
          state.gameTime > 1200,
        getAdvice: () =>
          'BKB دشمن احتمالاً روی کول‌داون است - قبل از برگشتنش فایت کن',
      },
      {
        id: 'disengage_fight_lost',
        priority: 'HIGH',
        check: (state) =>
          getNetWorthDelta(state) < -3000 &&
          countAliveEnemies(state) >= 3 &&
          state.hero.healthPercent < 40,
        getAdvice: () =>
          'همین حالا عقب بکش - فایت باخته شده، برگرد و ری‌گروپ کن',
      },
    );

    this.situations.push(
      {
        id: 'antimage_farm_until_items',
        priority: 'MEDIUM',
        check: (state) =>
          state.hero.name.toLowerCase().includes('antimage') &&
          (!hasAnyItemInState(state, 'battle_fury') ||
            !hasAnyItemInState(state, 'manta')) &&
          state.gameTime < 1800,
        getAdvice: () =>
          'تا Battle Fury + Manta فارم کن - الان نمی‌توانی فایت بدهی، روی فارم تمرکز کن',
      },
      {
        id: 'invoker_level_16_combo',
        priority: 'HIGH',
        check: (state) =>
          state.hero.name.toLowerCase().includes('invoker') &&
          state.hero.level >= 16 &&
          state.gameTime > 900,
        getAdvice: () =>
          'لول ۱۶ اینوکر - کمبوهای کامل را بزن، پاور اسپایک بزرگی داری',
      },
      {
        id: 'pudge_hook_carry',
        priority: 'HIGH',
        check: (state) =>
          state.hero.name.toLowerCase().includes('pudge') &&
          state.hero.level >= 6 &&
          countAliveEnemies(state) > 0,
        getAdvice: () =>
          'با هوک کری دشمن را جدا کن - هوک + Rot + Dismember کری را حذف می‌کند',
      },
      {
        id: 'crystal_maiden_ult_positioning',
        priority: 'HIGH',
        check: (state) =>
          state.hero.name.toLowerCase().includes('crystal_maiden') &&
          state.hero.level >= 6 &&
          countAliveEnemies(state) >= 2 &&
          !state.hero.magicImmune,
        getAdvice: () =>
          'Freezing Field را از پشت درخت یا بعد از استن دشمن بزن - جلوی چشم نزن',
      },
      {
        id: '10min_mark_stack_camps',
        priority: 'LOW',
        check: (state) => state.gameTime >= 600 && state.gameTime <= 620,
        getAdvice: () =>
          'دقیقه ۱۰ - کمپ‌ها را استک کن و موج کریپ را قبل از فایت پوش بده',
      },
      {
        id: '20min_mark_aegis_available',
        priority: 'HIGH',
        check: (state) => state.gameTime >= 1200 && state.gameTime <= 1210,
        getAdvice: () =>
          'دقیقه ۲۰ - آیجیس در دسترس است، برای روشان موقعیت بگیر',
      },
      {
        id: '35min_plus_critical_deaths',
        priority: 'HIGH',
        check: (state) => state.gameTime > 2100,
        getAdvice: () =>
          'بعد از ۳۵ دقیقه هر مرگ حیاتی است - فقط پیک‌آف بازی کن و ریسک نکن',
      },
    );
  }

  private hasEnemyHero(state: ProcessedGameState, heroName: string): boolean {
    return state.enemies.some((enemy) =>
      `${enemy.heroName ?? ''} ${enemy.name}`.toLowerCase().includes(heroName),
    );
  }

  private hasDetection(state: ProcessedGameState): boolean {
    return hasAnyItemInState(state, ['gem', 'sentry', 'dust']);
  }
}
