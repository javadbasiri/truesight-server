import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

import { GsiController } from './gsi.controller.js';
import { CoachingModule } from './coaching/coaching.module.js';
import { RuleEngineService } from './gsi/interfaces/rule-engine.service.js';

@Module({
  imports: [CoachingModule],
  controllers: [AppController, GsiController],
  providers: [AppService, RuleEngineService],
})
export class AppModule {}
