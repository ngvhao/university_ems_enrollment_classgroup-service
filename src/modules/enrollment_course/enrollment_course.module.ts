import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrollmentCourseService } from './enrollment_course.service';
import { EnrollmentCourseController } from './enrollment_course.controller';
import { EnrollmentCourseEntity } from './entities/enrollment_course.entity';
import { StudentModule } from 'src/modules/student/student.module';
import { QueueModule } from 'src/aws/queue/queue.module';
import { UserModule } from '../user/user.module';
import { ClassGroupModule } from '../class_group/class_group.module';
import { ClassWeeklyScheduleEntity } from '../class_weekly_schedule/entities/class_weekly_schedule.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EnrollmentCourseEntity,
      ClassWeeklyScheduleEntity,
    ]),
    forwardRef(() => StudentModule),
    QueueModule,
    UserModule,
    ClassGroupModule,
  ],
  controllers: [EnrollmentCourseController],
  providers: [EnrollmentCourseService],
  exports: [EnrollmentCourseService],
})
export class EnrollmentCourseModule {}
