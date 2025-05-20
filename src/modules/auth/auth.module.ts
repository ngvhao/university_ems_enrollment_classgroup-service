import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from './strategys/jwt.strategy';
import { StudentModule } from '../student/student.module';

@Module({
  imports: [UserModule, StudentModule],
  providers: [JwtService, JwtStrategy],
})
export class AuthModule {}
