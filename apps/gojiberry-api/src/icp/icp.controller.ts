import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MinLength } from 'class-validator';
import { IcpService } from './icp.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class CreateIcpDto {
  @MinLength(10)
  prompt!: string;
}

@Controller('icp')
export class IcpController {
  constructor(private icp: IcpService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateIcpDto) {
    return this.icp.createFromPrompt(user.id, dto.prompt);
  }

  @Get()
  list(@CurrentUser() user: any) {
    return this.icp.list(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.icp.findOne(user.id, id);
  }
}
