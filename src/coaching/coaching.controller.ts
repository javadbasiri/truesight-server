// src/coaching/coaching.controller.ts
import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import type {
  CoachingStatus,
  PostGameSummary,
} from './interfaces/coaching.interface.js';
import { CoachingEngineService } from './services/coaching-engine.service.js';

@Controller('coach')
export class CoachingController {
  constructor(private readonly coachingEngine: CoachingEngineService) {}

  /** وضعیت زنده‌ی موتور کوچینگ برای داشبورد / دیباگ */
  @Get('status')
  getStatus(): CoachingStatus {
    return this.coachingEngine.getStatus();
  }

  /** تحلیل بعد از بازی (در صورت وجود) */
  @Get('post-game')
  getPostGame(): { summary: PostGameSummary | null; text: string | null } {
    return {
      summary: this.coachingEngine.getPostGameSummary(),
      text: this.coachingEngine.getPostGameText(),
    };
  }

  /** ریست دستی وضعیت موتور (برای تست یا شروع دستی مچ جدید) */
  @Post('reset')
  @HttpCode(200)
  reset(): { reset: true } {
    this.coachingEngine.reset();
    return { reset: true };
  }
}
