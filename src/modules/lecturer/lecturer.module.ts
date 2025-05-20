import { Module } from '@nestjs/common';
import { LecturerService } from './lecturer.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LecturerEntity } from './entities/lecturer.entity';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([LecturerEntity]), UserModule],
  providers: [LecturerService],
  exports: [LecturerService],
})
export class LecturerModule {}
