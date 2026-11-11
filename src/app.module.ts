import { Module } from '@nestjs/common';
import { GsiController } from './gsi.controller.js';
import { CoachGateway } from './coach.gateway.js';
import { RuleEngineService } from './gsi/interfaces/rule-engine.service.js';

@Module({
  imports: [],
  controllers: [GsiController],
  providers: [CoachGateway, RuleEngineService],
})
export class AppModule {}