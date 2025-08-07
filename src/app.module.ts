import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { LoggerMiddleware } from './middlewares/logger.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LecturerModule } from './modules/lecturer/lecturer.module';
import dataSource from 'db/data-source';
import { StudentModule } from './modules/student/student.module';
import { UserModule } from './modules/user/user.module';
import { EnrollmentCourseModule } from './modules/enrollment_course/enrollment_course.module';
import { HttpModule } from '@nestjs/axios';
import { DynamoDBModule } from './aws/dynamodb/dynamodb.module';
import { SettingModule } from './modules/setting/setting.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSource.options),
    AuthModule,
    UserModule,
    StudentModule,
    LecturerModule,
    EnrollmentCourseModule,
    HttpModule,
    DynamoDBModule,
    SettingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('/*');
  }
}
