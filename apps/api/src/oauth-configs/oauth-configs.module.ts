import { Module } from '@nestjs/common';
import { OAuthConfigsService } from './oauth-configs.service';
import { OAuthConfigsController } from './oauth-configs.controller';
import { CryptoModule } from '../common/crypto/crypto.module';

@Module({
  imports: [CryptoModule],
  providers: [OAuthConfigsService],
  controllers: [OAuthConfigsController],
  exports: [OAuthConfigsService],
})
export class OAuthConfigsModule {}
