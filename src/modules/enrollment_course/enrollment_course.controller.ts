import {
  Controller,
  Get,
  Res,
  UseGuards,
  Req,
  HttpStatus,
  Body,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { EnrollmentCourseService } from './enrollment_course.service';
import { Roles } from 'src/decorators/roles.decorator';
import { EUserRole } from 'src/utils/enums/user.enum';
import { SuccessResponse } from 'src/utils/response';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestHasUserDto } from 'src/utils/request-has-user-dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { EEnrollmentStatus } from 'src/utils/enums/course.enum';
import { CreateEnrollmentCourseDto } from './dtos/createEnrollmentCourse.dto';
import { EnrollmentCourseEntity } from './entities/enrollment_course.entity';
import { RequestHasStudentDto } from 'src/utils/request-has-student-dto';
import { StudentInterceptor } from 'src/interceptors/get-student.interceptor';
import { SettingService } from '../setting/setting.service';

@ApiTags('Quản lý Đăng ký Môn học (Enrollments)')
@ApiBearerAuth('token')
@UseGuards(JwtAuthGuard)
@Controller('enrollments')
export class EnrollmentCourseController {
  constructor(
    private readonly enrollmentService: EnrollmentCourseService,
    private readonly settingService: SettingService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles([
    EUserRole.STUDENT,
    EUserRole.ACADEMIC_MANAGER,
    EUserRole.ADMINISTRATOR,
  ])
  @ApiOperation({ summary: 'Tạo một lượt đăng ký môn học mới' })
  @ApiBody({ type: CreateEnrollmentCourseDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Đăng ký thành công.',
    type: EnrollmentCourseEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Dữ liệu không hợp lệ (thiếu studentId, lớp đầy, lớp không mở,...).',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Chưa xác thực.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'Không có quyền thực hiện (vd: user không có profile SV, cố đăng ký cho SV khác).',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description:
      'Không tìm thấy Nhóm lớp hoặc Sinh viên (nếu studentId được cung cấp).',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Sinh viên đã đăng ký nhóm lớp này rồi.',
  })
  async enrollClassGroup(
    @Body() createDto: CreateEnrollmentCourseDto,
    @Req() req: RequestHasUserDto & Request,
    @Res() res: Response,
  ) {
    const currentUser = req.user;
    const result = await this.enrollmentService.enrollClassGroup(
      createDto,
      currentUser,
    );
    return new SuccessResponse({
      statusCode: HttpStatus.CREATED,
      data: result.data,
      message: result.message,
    }).send(res);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles([EUserRole.STUDENT])
  @ApiOperation({ summary: '[Student] Lấy danh sách đăng ký của bản thân' })
  async getCurrentEnrollmentByBatchId(
    @Query('batchId') batchId: string,
    @Req() req: RequestHasUserDto & Request,
    @Res() res: Response,
  ) {
    const currentUser = req.user;
    console.log(currentUser);
    const enrollment =
      await this.enrollmentService.getEnrollmentsByBatchId(batchId);

    console.log(batchId);
    return new SuccessResponse({
      data: enrollment,
      message: 'Lấy danh sách đăng ký của bạn thành công.',
    }).send(res);
  }

  @Get('/me')
  @UseGuards(RolesGuard)
  @Roles([EUserRole.STUDENT])
  @UseInterceptors(StudentInterceptor)
  @ApiOperation({ summary: '[Student] Lấy danh sách đăng ký của bản thân' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Số trang',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Số lượng kết quả mỗi trang',
  })
  @ApiQuery({
    name: 'classGroupId',
    required: false,
    type: Number,
    description: 'Lọc theo ID Nhóm lớp học',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: EEnrollmentStatus,
    description: 'Lọc theo trạng thái đăng ký',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy danh sách thành công.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Chưa xác thực.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không phải sinh viên hoặc chưa liên kết hồ sơ SV.',
  })
  async findMyEnrollments(
    @Query('semesterId') semesterId: string,
    @Req() req: RequestHasStudentDto & Request,
    @Res() res: Response,
  ) {
    const student = req.student;
    console.log('student', student);
    console.log(semesterId);
    const nextRegisterCourseSemester = await this.settingService.findOne(
      'nextRegisterCourseSemesterId',
    );
    const { data, meta } =
      await this.enrollmentService.getEnrollmentsBySemesterId(
        student.id,
        nextRegisterCourseSemester.value,
      );
    return new SuccessResponse({
      data,
      metadata: meta,
      message: 'Lấy danh sách đăng ký môn học thành công.',
    }).send(res);
  }
}
