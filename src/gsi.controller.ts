// src/gsi.controller.ts
import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { RuleEngineService } from './gsi/interfaces/rule-engine.service.js';
import { type GsiPayload } from './gsi/interfaces/gsi-payload.interface.js';


@Controller('gsi')
export class GsiController {
  constructor(private readonly ruleEngineService: RuleEngineService) {}

  @Post()
  @HttpCode(200)
  handleGsiData(@Body() payload: GsiPayload): void {
    this.ruleEngineService.processGsiTick(payload);
  }
}