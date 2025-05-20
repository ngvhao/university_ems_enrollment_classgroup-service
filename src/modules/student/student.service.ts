import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, FindOptionsWhere, Repository } from 'typeorm';
import { UserEntity } from '../user/entities/user.entity';
import { StudentEntity } from './entities/student.entity';

import _ from 'lodash';

@Injectable()
export class StudentService {
  constructor(
    @InjectRepository(StudentEntity)
    private studentRepository: Repository<StudentEntity>,
  ) {}

  /**
   * Lấy thông tin chi tiết một sinh viên bằng ID.
   * Bao gồm thông tin user (không password), lớp, chuyên ngành, khoa, bộ môn.
   * @param id - ID của sinh viên cần tìm.
   * @returns Promise<StudentEntity> - Thông tin chi tiết sinh viên.
   * @throws NotFoundException - Nếu không tìm thấy sinh viên.
   */
  async findOneById(id: number): Promise<Partial<StudentEntity>> {
    const student = await this.studentRepository.findOne({
      where: {
        id: id,
      },
      relations: {
        major: true,
        user: true,
        class: true,
      },
    });

    if (!student) {
      throw new NotFoundException(`Không tìm thấy sinh viên với ID ${id}`);
    }
    return _.omit(student, ['user.password']);
  }

  /**
   * Lấy một sinh viên dựa trên điều kiện tùy chỉnh.
   * @param condition - Điều kiện tìm kiếm.
   * @param relations - Các quan hệ cần load.
   * @returns Promise<StudentEntity> - Thông tin sinh viên.
   * @throws NotFoundException - Nếu không tìm thấy sinh viên.
   */
  async getOne(
    condition:
      | FindOptionsWhere<StudentEntity>
      | FindOptionsWhere<StudentEntity>[],
    relations?: FindOptionsRelations<StudentEntity>,
  ): Promise<StudentEntity> {
    const student = await this.studentRepository.findOne({
      where: condition,
      relations: relations,
    });

    if (!student) {
      throw new NotFoundException(
        `Không tìm thấy sinh viên với điều kiện tìm kiếm.`,
      );
    }
    // Omit password nếu user được load
    if (student?.user) {
      student.user = _.omit(student.user, ['password']) as UserEntity;
    }
    return student;
  }

  /**
   * Lấy một sinh viên dựa trên điều kiện tùy chỉnh.
   * @param condition - Điều kiện tìm kiếm.
   * @param relations - Các quan hệ cần load.
   * @returns Promise<StudentEntity> - Thông tin sinh viên.
   * @throws NotFoundException - Nếu không tìm thấy sinh viên.
   */
  async getStudentByStudentCode(
    studentCode: string,
    omitPassword: boolean = true,
  ): Promise<StudentEntity> {
    const student = await this.studentRepository.findOne({
      where: { studentCode },
      relations: ['user', 'major', 'class'],
    });

    // Omit password
    if (student?.user && omitPassword) {
      student.user = _.omit(student.user, ['password']) as UserEntity;
    }
    return student;
  }
}
