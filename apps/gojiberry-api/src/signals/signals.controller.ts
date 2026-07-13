import { Controller, Get, Param, Post } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('leads/:leadId/signals')
export class SignalsController {
  constructor(private signals: SignalsService) {}

  @Get()
  list(@CurrentUser() user: any, @Param('leadId') leadId: string) {
    return this.signals.listForLead(user.id, leadId);
  }

  @Post('refresh')
  refresh(@CurrentUser() user: any, @Param('leadId') leadId: string) {
    return this.signals.refreshForLead(user.id, leadId);
  }
}
