import { DepartmentEntity } from 'src/modules/department/entities/department.entity';
import { IEntity } from 'src/utils/interfaces/entity.interface';
import { Entity, Column, OneToMany, Index } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('faculties')
export class FacultyEntity extends IEntity {
  @ApiProperty({
    description: 'Mã duy nhất của Khoa',
    example: 'CNTT',
    maxLength: 20,
  })
  @Index({ unique: true })
  @Column({ unique: true, length: 20, nullable: false })
  facultyCode: string;

  @ApiProperty({
    description: 'Tên đầy đủ của Khoa',
    example: 'Công nghệ Thông tin',
    maxLength: 255,
  })
  @Column({ length: 255, nullable: false })
  name: string;

  @ApiPropertyOptional({ description: 'Mô tả thêm về Khoa' })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiPropertyOptional({
    type: () => [DepartmentEntity],
    description: 'Danh sách Khoa/Bộ môn trực thuộc',
  })
  @OneToMany(() => DepartmentEntity, (department) => department.faculty, {})
  departments: DepartmentEntity[];
}
