import {
  Body,
  Controller,
  Post,
  Res,
  UseGuards,
  Req,
  UseInterceptors,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import { EUserRole } from 'src/utils/enums/user.enum';
import { StudentService } from '../student/student.service';
import { RolesGuard } from './guards/roles.guard';
import { StudentInterceptor } from 'src/interceptors/get-student.interceptor';
import { Roles } from 'src/decorators/roles.decorator';
import { RequestHasStudentDto } from 'src/utils/request-has-student-dto';
import { Helpers } from 'src/utils/helpers';
import { SuccessResponse } from 'src/utils/response';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly studentService: StudentService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles([EUserRole.STUDENT])
  @UseInterceptors(StudentInterceptor)
  @Post('/verify-password')
  async verifyPassword(
    @Body('password') password: string,
    @Req() req: RequestHasStudentDto & Request,
    @Res() res: Response,
  ) {
    const { studentCode } = req.student;
    const student = await this.studentService.getStudentByStudentCode(
      studentCode,
      false,
    );
    if (await Helpers.comparePassword(password, student.user.password)) {
      return new SuccessResponse({
        message: 'Xác thực thành công',
      }).send(res);
    }
    throw new UnauthorizedException(
      'Xác thực thất bại. Mật khẩu không chính xác',
    );
  }
}
