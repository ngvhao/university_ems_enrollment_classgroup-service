import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
} from 'class-validator';

export class CreateEnrollmentCourseDto {
  @ApiProperty({
    description: 'Danh sách ID của Nhóm lớp học (ClassGroup) cần đăng ký',
    example: [25, 26],
    required: true,
    type: [Number],
  })
  @IsArray({ message: 'registerClassGroupIds phải là một mảng' })
  @ArrayNotEmpty({ message: 'registerClassGroupIds không được để trống' })
  @ArrayMinSize(1, {
    message: 'registerClassGroupIds phải chứa ít nhất 1 phần tử',
  })
  @IsNumber(
    {},
    {
      each: true,
      message: 'Mỗi phần tử trong registerClassGroupIds phải là số',
    },
  )
  @IsPositive({ each: true, message: 'Mỗi ID Nhóm lớp học phải là số dương' })
  @Type(() => Number)
  @IsOptional()
  registerClassGroupIds?: number[];

  @ApiProperty({
    description: 'Danh sách ID của Nhóm lớp học (ClassGroup) cần hủy',
    example: [25, 26],
    required: true,
    type: [Number],
  })
  @IsArray({ message: 'cancelClassGroupIds phải là một mảng' })
  @ArrayNotEmpty({ message: 'cancelClassGroupIds không được để trống' })
  @ArrayMinSize(0, {
    message: 'cancelClassGroupIds phải chứa ít nhất 1 phần tử',
  })
  @IsNumber(
    {},
    { each: true, message: 'Mỗi phần tử trong cancelClassGroupIds phải là số' },
  )
  @IsPositive({ each: true, message: 'Mỗi ID Nhóm lớp học phải là số dương' })
  @IsOptional()
  @Type(() => Number)
  cancelClassGroupIds?: number[];

  @ApiPropertyOptional({
    description: 'ID của Sinh viên (chỉ dùng bởi Admin/Academic Manager)',
    example: 101,
    required: false,
    type: Number,
  })
  @IsOptional()
  @IsPositive({ message: 'ID Sinh viên phải là số dương' })
  studentId?: number;
}
