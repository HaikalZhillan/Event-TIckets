import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EventCategoriesService } from './event-categories.service';
import { CreateEventCategoryDto } from './dto/create-event-category.dto';
import { UpdateEventCategoryDto } from './dto/update-event-category.dto';
import { FilterEventCategoryDto } from './dto/filter-event-category.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventCategoriesController {
  constructor(
    private readonly eventCategoriesService: EventCategoriesService,
  ) {}

  @Roles('admin')
  @Post()
  create(@Body() createEventCategoryDto: CreateEventCategoryDto) {
    return this.eventCategoriesService.create(createEventCategoryDto);
  }

  @Public()
  @Get()
  findAll(@Query() filterDto: FilterEventCategoryDto) {
    return this.eventCategoriesService.findAll(filterDto);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventCategoriesService.findOne(id);
  }

  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEventCategoryDto: UpdateEventCategoryDto,
  ) {
    return this.eventCategoriesService.update(id, updateEventCategoryDto);
  }

  @Roles('admin')
  @Delete(':id/soft')
  @HttpCode(HttpStatus.OK)
  softDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventCategoriesService.softDelete(id);
  }

  @Roles('admin')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventCategoriesService.remove(id);
  }

  @Roles('admin')
  @Patch(':id/restore')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventCategoriesService.restore(id);
  }
}
