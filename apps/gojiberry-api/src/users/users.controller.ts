import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('me')
export class UsersController {
  @Get()
  me(@CurrentUser() user: any) {
    const { password: _password, ...safe } = user;
    return safe;
  }
}
