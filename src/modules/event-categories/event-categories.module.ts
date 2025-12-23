import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventCategoriesService } from './event-categories.service';
import { EventCategoriesController } from './event-categories.controller';
import { EventCategory } from '../../entities/event-category.entity';
import { Event } from '../../entities/event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventCategory,
      Event,
    ]),
  ],
  controllers: [EventCategoriesController],
  providers: [EventCategoriesService],
  exports: [EventCategoriesService],
})
export class EventCategoriesModule {}