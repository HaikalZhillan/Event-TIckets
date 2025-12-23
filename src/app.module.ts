//app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './modules/users/users.module';
import { EventCategoriesModule } from './modules/event-categories/event-categories.module';
import { EventsModule } from './modules/events/events.module';
import { OrdersModule } from './modules/orders/orders.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { PaymentsModule } from 'src/modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { BackgroundJobsModule } from './background-jobs/background-jobs.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { MailModule } from './mail/mail.module';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import xenditConfig from './config/xendit.config';
import mailConfig from './config/mail.config';
import { ScheduleModule } from '@nestjs/schedule';
import { TestModule } from './test/test.module';


@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        xenditConfig,
        mailConfig,
      ],
      envFilePath: '.env',
      cache: true, 
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],

        synchronize: configService.get('database.synchronize'),
        logging: configService.get('database.logging'),
        
        ssl: configService.get('database.ssl'),
      }),
    }),

    AuthModule,
    RolesModule,
    UsersModule,
    EventCategoriesModule,
    EventsModule,
    OrdersModule,
    TicketsModule,
    PaymentsModule,
    NotificationsModule,
    BackgroundJobsModule,
    MailModule,
    TestModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}