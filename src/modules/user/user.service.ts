import { Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsRelations, FindOptionsWhere, Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  /**
   * Lấy thông tin người dùng bằng ID.
   * @param id - ID của người dùng cần tìm.
   * @returns Promise<UserEntity> - Thông tin chi tiết người dùng.
   * @throws NotFoundException - Nếu không tìm thấy người dùng.
   */
  async getUserById(id: number): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng với ID ${id}.`);
    }
    return user;
  }

  /**
   * Lấy một người dùng dựa trên điều kiện tùy chỉnh, có thể chọn trường và quan hệ.
   * @param condition - Điều kiện tìm kiếm (ví dụ: { email: '...' }).
   * @param relations - Các quan hệ cần load (ví dụ: { student: true }).
   * @param selectFields - Các trường của UserEntity cần lấy (ví dụ: ['id', 'firstName']).
   * @param selectRelationsFields - Các trường của quan hệ cần lấy (ví dụ: { student: ['majorId'] }).
   * @returns Promise<Partial<UserEntity> | null> - Thông tin người dùng (có thể chỉ một phần) hoặc null.
   */
  async getOne(
    condition: FindOptionsWhere<UserEntity> | FindOptionsWhere<UserEntity>[],
    relations?: FindOptionsRelations<UserEntity>,
    selectFields?: (keyof UserEntity)[],
    selectRelationsFields?: { [K in keyof UserEntity]?: string[] },
  ): Promise<Partial<UserEntity> | null> {
    const query = this.userRepository.createQueryBuilder('user');

    query.where(condition);

    if (selectFields?.length) {
      query.select(selectFields.map((field) => `user.${field}`));
    }

    if (relations) {
      for (const relationName of Object.keys(relations)) {
        if (relations[relationName as keyof UserEntity]) {
          query.leftJoinAndSelect(`user.${relationName}`, relationName);

          const relationSelects =
            selectRelationsFields?.[relationName as keyof UserEntity];
          if (relationSelects?.length) {
            query.addSelect(
              relationSelects.map((field) => `${relationName}.${field}`),
            );
          }
        }
      }
    }

    return query.getOne();
  }

  /**
   * Tìm người dùng dựa trên email cá nhân. Có thể có nhiều người dùng tạm thời trùng email cá nhân?
   * Cân nhắc lại logic nếu email cá nhân phải là duy nhất.
   * @param email - Email cá nhân cần tìm.
   * @returns Promise<UserEntity[]> - Mảng các người dùng tìm thấy (thường là 0 hoặc 1 nếu email là duy nhất).
   */
  async getUserByPersonalEmail(email: string): Promise<UserEntity[]> {
    return this.userRepository.find({ where: { personalEmail: email } });
  }

  /**
   * Tìm người dùng dựa trên email trường cấp (universityEmail).
   * Email này thường là duy nhất.
   * @param email - Email trường cấp cần tìm.
   * @returns Promise<UserEntity | null> - Thông tin người dùng hoặc null nếu không tìm thấy.
   */
  async getUserByUniEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({ where: { universityEmail: email } });
  }
}
