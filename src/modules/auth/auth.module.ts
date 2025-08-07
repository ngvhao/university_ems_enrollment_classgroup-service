import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from './strategys/jwt.strategy';
import { StudentModule } from '../student/student.module';
import { AuthController } from './auth.controller';

@Module({
  imports: [UserModule, StudentModule],
  providers: [JwtService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
