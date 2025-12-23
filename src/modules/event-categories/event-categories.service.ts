import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventCategory } from '../../entities/event-category.entity';
import { Event } from '../../entities/event.entity';
import { CreateEventCategoryDto } from './dto/create-event-category.dto';
import { UpdateEventCategoryDto } from './dto/update-event-category.dto';
import { FilterEventCategoryDto } from './dto/filter-event-category.dto';

@Injectable()
export class EventCategoriesService {
  constructor(
    @InjectRepository(EventCategory)
    private readonly categoryRepository: Repository<EventCategory>,
    
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
  ) {}

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async create(createEventCategoryDto: CreateEventCategoryDto) {
    const { name, slug } = createEventCategoryDto;

    const existingByName = await this.categoryRepository.findOne({
      where: { name },
    });

    if (existingByName) {
      throw new ConflictException(
        `Category with name '${name}' already exists`,
      );
    }

    const finalSlug = slug || this.generateSlug(name);

    const existingBySlug = await this.categoryRepository.findOne({
      where: { slug: finalSlug },
    });

    if (existingBySlug) {
      throw new ConflictException(
        `Category with slug '${finalSlug}' already exists`,
      );
    }

    const category = this.categoryRepository.create({
      ...createEventCategoryDto,
      slug: finalSlug,
    });

    return await this.categoryRepository.save(category);
  }

  async findAll(filterDto: FilterEventCategoryDto) {
    const { search, isActive, sortBy, sortOrder } = filterDto;
    const page = filterDto.page || 1;
    const limit = filterDto.limit || 10;

    const queryBuilder = this.categoryRepository.createQueryBuilder('category');

    if (search) {
      queryBuilder.where(
        'category.name ILIKE :search OR category.description ILIKE :search',
        { search: `%${search}%` },
      );
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('category.isActive = :isActive', { isActive });
    }

    queryBuilder.orderBy(
      `category.${sortBy || 'createdAt'}`,
      sortOrder || 'DESC',
    );

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const category = await this.categoryRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }

    return category;
  }

  async findBySlug(slug: string) {
    const category = await this.categoryRepository.findOne({
      where: { slug },
    });

    if (!category) {
      throw new NotFoundException(`Category with slug '${slug}' not found`);
    }

    return category;
  }

  async update(id: string, updateEventCategoryDto: UpdateEventCategoryDto) {
    const category = await this.findOne(id);

    if (
      updateEventCategoryDto.name &&
      updateEventCategoryDto.name !== category.name
    ) {
      const existingByName = await this.categoryRepository.findOne({
        where: { name: updateEventCategoryDto.name },
      });

      if (existingByName) {
        throw new ConflictException(
          `Category with name '${updateEventCategoryDto.name}' already exists`,
        );
      }

      if (!updateEventCategoryDto.slug) {
        updateEventCategoryDto.slug = this.generateSlug(
          updateEventCategoryDto.name,
        );
      }
    }

    if (
      updateEventCategoryDto.slug &&
      updateEventCategoryDto.slug !== category.slug
    ) {
      const existingBySlug = await this.categoryRepository.findOne({
        where: { slug: updateEventCategoryDto.slug },
      });

      if (existingBySlug) {
        throw new ConflictException(
          `Category with slug '${updateEventCategoryDto.slug}' already exists`,
        );
      }
    }

    Object.assign(category, updateEventCategoryDto);
    return await this.categoryRepository.save(category);
  }

  async softDelete(id: string) {
    const category = await this.findOne(id);

    const eventsCount = await this.eventRepository.count({
      where: { categoryId: id },
    });

    if (eventsCount > 0) {
      throw new BadRequestException(
        `Cannot deactivate category '${category.name}'. ` +
        `${eventsCount} event(s) are still using this category. ` +
        `Please reassign or delete those events first.`
      );
    }

    category.isActive = false;
    await this.categoryRepository.save(category);

    return {
      message: `Category '${category.name}' has been deactivated`,
      data: category
    };
  }

  async remove(id: string) {
    const category = await this.findOne(id);

    const eventsCount = await this.eventRepository.count({
      where: { categoryId: id },
    });

    if (eventsCount > 0) {
      throw new BadRequestException(
        `Cannot delete category '${category.name}'. ` +
        `${eventsCount} event(s) are still using this category. ` +
        `Please delete all related events first or use soft delete endpoint: DELETE /categories/${id}/soft`
      );
    }

    await this.categoryRepository.remove(category);

    return {
      message: `Category '${category.name}' has been permanently deleted`,
    };
  }

  async restore(id: string) {
    const category = await this.categoryRepository.findOne({ where: { id } });

    if (!category) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }

    category.isActive = true;
    return await this.categoryRepository.save(category);
  }
}