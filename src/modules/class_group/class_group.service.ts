import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, FindOptionsWhere, Repository } from 'typeorm';
import { ClassGroupEntity } from './entities/class_group.entity';

@Injectable()
export class ClassGroupService {
  constructor(
    @InjectRepository(ClassGroupEntity)
    private readonly classGroupRepository: Repository<ClassGroupEntity>,
  ) {}

  /**
   * Helper: Tìm kiếm nhóm lớp theo ID và ném NotFoundException nếu không tồn tại.
   * @param id - ID của nhóm lớp cần tìm.
   * @param relations - Danh sách các mối quan hệ cần load cùng (ví dụ: ['enrollments']).
   * @returns Promise<ClassGroupEntity> - Entity nhóm lớp tìm được.
   * @throws NotFoundException nếu không tìm thấy nhóm lớp với ID cung cấp.
   */
  private async findGroupByIdOrThrow(
    id: number,
    relations?: string[],
  ): Promise<ClassGroupEntity> {
    const classGroup = await this.classGroupRepository.findOne({
      where: { id },
      relations,
    });
    if (!classGroup) {
      throw new NotFoundException(`Không tìm thấy Nhóm lớp với ID ${id}`);
    }
    return classGroup;
  }
  /**
   * Lấy thông tin chi tiết của một nhóm lớp theo điều kiện.
   * @param condition - Điều kiện để tìm nhóm lớp.
   * @param relations - Các quan hệ cần load kèm.
   * @returns Promise<ClassGroupEntity> - Thông tin chi tiết của nhóm lớp.
   * @throws NotFoundException nếu không tìm thấy nhóm lớp.
   */
  async findOne(
    condition:
      | FindOptionsWhere<ClassGroupEntity>
      | FindOptionsWhere<ClassGroupEntity>[],
    relations?: FindOptionsRelations<ClassGroupEntity>,
  ): Promise<ClassGroupEntity> {
    const classGroup = await this.classGroupRepository.findOne({
      where: condition,
      relations,
    });

    return classGroup;
  }
}
