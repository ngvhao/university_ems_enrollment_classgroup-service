import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  FindOptionsRelations,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { LecturerEntity } from './entities/lecturer.entity';
import { generatePaginationMeta } from 'src/utils/common/getPagination.utils';
import { PaginationDto } from 'src/utils/dtos/pagination.dto';
import { MetaDataInterface } from 'src/utils/interfaces/meta-data.interface';
import { PAGINATION } from 'src/utils/constants';

@Injectable()
export class LecturerService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(LecturerEntity)
    private readonly lecturerRepository: Repository<LecturerEntity>,
  ) {}

  async findAllLecturersId(): Promise<{ lecturerId: number }[]> {
    const data = await this.lecturerRepository.find({
      select: {
        id: true,
      },
    });
    return data.map((lecturer) => {
      return { lecturerId: lecturer.id };
    });
  }

  async findAll(
    paginationDto: PaginationDto = PAGINATION,
  ): Promise<{ data: LecturerEntity[]; meta: MetaDataInterface }> {
    const { page = 1, limit = 10 } = paginationDto;

    const [data, total] = await this.lecturerRepository.findAndCount({
      relations: ['user', 'department'],
      skip: (page - 1) * limit,
      take: limit,
    });

    const meta = generatePaginationMeta(total, page, limit);

    return { data, meta };
  }

  async findOne(id: number): Promise<LecturerEntity> {
    const lecturer = await this.lecturerRepository.findOne({
      where: { id },
      relations: ['user', 'department'],
    });
    if (!lecturer) {
      throw new NotFoundException(`Lecturer with ID ${id} not found`);
    }
    return lecturer;
  }

  async getOne(
    condition:
      | FindOptionsWhere<LecturerEntity>
      | FindOptionsWhere<LecturerEntity>[],
    relations?: FindOptionsRelations<LecturerEntity>,
  ): Promise<LecturerEntity> {
    const lecturer = await this.lecturerRepository.findOne({
      where: condition,
      relations: relations,
    });
    if (!lecturer) {
      throw new NotFoundException(`Lecturer not found`);
    }
    return lecturer;
  }
}
