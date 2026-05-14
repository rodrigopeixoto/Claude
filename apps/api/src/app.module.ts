import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MeetingsModule } from './meetings/meetings.module';
import { ParticipantsModule } from './participants/participants.module';
import { InviteModule } from './invite/invite.module';
import { CalendarsModule } from './calendars/calendars.module';
import { SlotsModule } from './slots/slots.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { CryptoModule } from './common/crypto/crypto.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    RedisModule,
    CryptoModule,
    AuthModule,
    UsersModule,
    MeetingsModule,
    ParticipantsModule,
    InviteModule,
    CalendarsModule,
    SlotsModule,
    WebhooksModule,
    NotificationsModule,
    ApiKeysModule,
  ],
})
export class AppModule {}
