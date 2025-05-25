import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
} from 'class-validator';

export class EnrollmentClassGroupDto {
  @ApiProperty({
    description: 'ID của Nhóm lớp học (ClassGroup) cần đăng ký',
    example: 25,
    required: true,
    type: Number,
  })
  @IsPositive({ message: 'ID Nhóm lớp học phải là số dương' })
  @IsNotEmpty({ message: 'ID Nhóm lớp học không được để trống' })
  @IsNumber()
  classGroupId: number;

  @ApiPropertyOptional({
    description: 'ID của Sinh viên (chỉ dùng bởi Admin/Academic Manager)',
    example: 101,
    required: false,
    type: Number,
  })
  @IsNumber()
  @IsPositive({ message: 'ID Sinh viên phải là số dương' })
  studentId: number;

  @IsNumber()
  @IsPositive()
  majorId: number;

  @IsNumber()
  @IsPositive()
  startAcademicYear: number;

  @IsString()
  @IsNotEmpty()
  batchId: string;

  @IsBoolean()
  @IsNotEmpty()
  isRegistration: boolean;
}
