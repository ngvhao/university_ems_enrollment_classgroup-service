import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ERoomType } from 'src/utils/enums/room.enum';
import { IEntity } from 'src/utils/interfaces/entity.interface';
import { Entity, Column, OneToMany } from 'typeorm';
import { ClassWeeklyScheduleEntity } from 'src/modules/class_weekly_schedule/entities/class_weekly_schedule.entity';

@Entity('rooms')
export class RoomEntity extends IEntity {
  @ApiProperty({ description: 'Số phòng', example: 'A101' })
  @Column()
  roomNumber: string;

  @ApiProperty({ description: 'Tên tòa nhà', example: 'Tòa nhà A' })
  @Column()
  buildingName: string;

  @ApiProperty({ description: 'Tầng chứa phòng', example: 'Tầng 1' })
  @Column()
  floor: string;

  @ApiProperty({
    description: 'Loại phòng',
    enum: ERoomType,
    example: ERoomType.CLASSROOM,
    default: ERoomType.CLASSROOM,
  })
  @Column({
    type: 'enum',
    enum: ERoomType,
    default: ERoomType.CLASSROOM,
  })
  roomType: ERoomType;

  @ApiProperty({
    description: 'Sức chứa',
    example: 60,
    default: 60,
  })
  @Column()
  capacity: number;

  @ApiPropertyOptional({
    type: () => [ClassWeeklyScheduleEntity],
    description: 'Danh sách lịch học tại phòng này',
  })
  @OneToMany(
    () => ClassWeeklyScheduleEntity,
    (classWeeklySchedule) => classWeeklySchedule.room,
  )
  classWeeklySchedules: ClassWeeklyScheduleEntity[];
}
