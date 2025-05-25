import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassGroupService } from './class_group.service';
import { ClassGroupEntity } from './entities/class_group.entity';
import { LecturerModule } from '../lecturer/lecturer.module';

@Module({
  imports: [TypeOrmModule.forFeature([ClassGroupEntity]), LecturerModule],
  providers: [ClassGroupService],
  exports: [ClassGroupService],
})
export class ClassGroupModule {}
