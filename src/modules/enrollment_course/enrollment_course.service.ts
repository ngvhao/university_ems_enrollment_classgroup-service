import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnrollmentCourseEntity } from './entities/enrollment_course.entity';
import { StudentService } from 'src/modules/student/student.service';
import { EUserRole } from 'src/utils/enums/user.enum';
import { EEnrollmentStatus } from 'src/utils/enums/course.enum';
import { CreateEnrollmentCourseDto } from './dtos/createEnrollmentCourse.dto';
import { UserEntity } from '../user/entities/user.entity';
import { QueueProducer } from 'src/aws/queue/queue.producer';
import { SendMessageOptions } from 'src/utils/interfaces/queue.interface';
import { UserService } from '../user/user.service';
import { ClassGroupService } from '../class_group/class_group.service';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { AWSConstants } from 'src/utils/constants';
import { EnrollStatusDynamoDto } from './dtos/enrollStatusDynamo.dto';
import { EClassGroupStatus } from 'src/utils/enums/class.enum';
import { CourseHelper } from 'src/utils/helpers/course.helper';
import { ClassWeeklyScheduleEntity } from '../class_weekly_schedule/entities/class_weekly_schedule.entity';
import { In } from 'typeorm';
import { ClassGroupEntity } from '../class_group/entities/class_group.entity';
import { MetaDataInterface } from 'src/utils/interfaces/meta-data.interface';
import { generatePaginationMeta } from 'src/utils/common/getPagination.utils';

@Injectable()
export class EnrollmentCourseService {
  private readonly enrollmentLogTableName: string =
    AWSConstants.DYNAMO_ENROLLMENT_TABLE;
  constructor(
    @InjectRepository(EnrollmentCourseEntity)
    private readonly enrollmentRepository: Repository<EnrollmentCourseEntity>,
    @InjectRepository(ClassWeeklyScheduleEntity)
    private readonly classWeeklyScheduleRepository: Repository<ClassWeeklyScheduleEntity>,
    @Inject(forwardRef(() => StudentService))
    private readonly studentService: StudentService,
    private readonly queueProducer: QueueProducer,
    private readonly classGroupService: ClassGroupService,
    private readonly userService: UserService,
    @Inject(AWSConstants.DYNAMODB_CLIENT)
    private readonly docClient: DynamoDBDocumentClient,
  ) {}

  /**
   * Helper: Tìm Enrollment theo ID, ném lỗi nếu không tìm thấy.
   * @param id - ID của Enrollment.
   * @param relations - Các mối quan hệ cần load.
   * @returns Promise<EnrollmentCourseEntity> - Enrollment tìm được.
   * @throws NotFoundException nếu không tìm thấy.
   */
  private async findEnrollmentByIdOrThrow(
    id: number,
    relations?: string[],
  ): Promise<EnrollmentCourseEntity> {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { id },
      relations,
    });
    if (!enrollment) {
      throw new NotFoundException(`Không tìm thấy lượt đăng ký với ID ${id}`);
    }
    return enrollment;
  }

  /**
   * Helper: Kiểm tra quyền truy cập enrollment của người dùng hiện tại.
   * @param enrollment - Bản ghi enrollment cần kiểm tra.
   * @param currentUser - Thông tin người dùng hiện tại.
   * @throws ForbiddenException nếu không có quyền.
   */
  private async checkEnrollmentAccessPermission(
    enrollment: EnrollmentCourseEntity,
    currentUser: UserEntity,
  ): Promise<void> {
    if (!currentUser) {
      throw new ForbiddenException('Hành động yêu cầu xác thực.');
    }

    if (
      [EUserRole.ADMINISTRATOR, EUserRole.ACADEMIC_MANAGER].includes(
        currentUser.role,
      )
    ) {
      return;
    }
    if (currentUser.role === EUserRole.STUDENT) {
      const studentProfile = await this.studentService.findOneById(
        currentUser.id,
      );
      if (!studentProfile || enrollment.studentId !== studentProfile.id) {
        throw new ForbiddenException(
          'Bạn không có quyền truy cập lượt đăng ký này.',
        );
      }
      return;
    }
    throw new ForbiddenException('Bạn không có quyền thực hiện hành động này.');
  }

  /**
   * Kiểm tra điều kiện trước khi đăng ký: conflict giữa các nhóm lớp gửi lên và với lịch học đã đăng ký.
   */
  private async checkEnrollmentPreConditions(
    classGroupIds: number[],
    studentId: number,
  ) {
    const classGroups = await this.enrollmentRepository.manager.find(
      ClassGroupEntity,
      {
        where: { id: In(classGroupIds) },
        relations: ['semester'],
      },
    );
    if (!classGroups.length)
      throw new BadRequestException('Không tìm thấy nhóm lớp nào.');
    const semesterCode = classGroups[0]?.semester?.semesterCode;
    if (!semesterCode)
      throw new BadRequestException('Không xác định được học kỳ.');

    const allNewSchedules = await this.classWeeklyScheduleRepository.find({
      where: { classGroupId: In(classGroupIds) },
      relations: {
        classGroup: true,
        room: true,
        timeSlot: true,
      },
    });

    const studentSchedules = await this.classWeeklyScheduleRepository.find({
      where: {
        classGroup: {
          enrollments: {
            studentId: studentId,
          },
          semester: {
            semesterCode: semesterCode,
          },
        },
      },
    });

    for (let i = 0; i < allNewSchedules.length; i++) {
      for (let j = i + 1; j < allNewSchedules.length; j++) {
        if (
          allNewSchedules[i].dayOfWeek === allNewSchedules[j].dayOfWeek &&
          allNewSchedules[i].timeSlotId === allNewSchedules[j].timeSlotId &&
          allNewSchedules[i].scheduledDates.some((date) =>
            allNewSchedules[j].scheduledDates.includes(date),
          )
        ) {
          throw new ConflictException(
            `Các nhóm lớp đăng ký cùng lúc bị trùng lịch với nhau (Thứ ${allNewSchedules[i].dayOfWeek}, khung giờ ${allNewSchedules[i].timeSlotId}, ngày ${allNewSchedules[i].scheduledDates.filter((date) => allNewSchedules[j].scheduledDates.includes(date)).join(', ')})`,
          );
        }
      }
    }

    for (const newSchedule of allNewSchedules) {
      for (const existSchedule of studentSchedules) {
        if (
          newSchedule.dayOfWeek === existSchedule.dayOfWeek &&
          newSchedule.timeSlotId === existSchedule.timeSlotId &&
          newSchedule.scheduledDates.some((date) =>
            existSchedule.scheduledDates.includes(date),
          )
        ) {
          throw new ConflictException(
            `Lịch học bị trùng với lớp đã đăng ký trước đó (Thứ ${newSchedule.dayOfWeek}, khung giờ ${newSchedule.timeSlotId}, ngày ${newSchedule.scheduledDates.filter((date) => existSchedule.scheduledDates.includes(date)).join(', ')})`,
          );
        }
      }
    }
  }

  async enrollClassGroup(
    enrollDTO: CreateEnrollmentCourseDto,
    currentUser: UserEntity,
  ): Promise<{
    data: {
      batchId: string;
      validClassGroupIds: { classGroupId: number; isRegistered: boolean }[];
    };
    message: string;
  }> {
    const {
      studentId: studentIdDto,
      registerClassGroupIds = [],
      cancelClassGroupIds = [],
    } = enrollDTO;
    let majorId: number;
    let startAcademicYear: number;
    let studentCode: string;
    let studentId: number;
    const registerValidClassGroupIds: number[] = [];
    const cancelValidClassGroupIds: number[] = [];
    if (!studentIdDto) {
      if (currentUser.role !== EUserRole.STUDENT) {
        throw new ForbiddenException('Chỉ sinh viên mới có thể tự đăng ký.');
      }
      const userProfile = await this.userService.getOne(
        {
          id: currentUser.id,
          role: EUserRole.STUDENT,
        },
        {
          student: true,
        },
      );

      if (!userProfile?.student) {
        throw new ForbiddenException(
          'Tài khoản của bạn chưa được liên kết với hồ sơ sinh viên.',
        );
      }
      console.log('enrollClassGroup@@userProfile::', userProfile);
      majorId = userProfile.student.majorId;
      startAcademicYear = userProfile.student.academicYear;
      studentCode = userProfile.student.studentCode;
      studentId = userProfile.student.id;
    } else {
      const student = await this.studentService.findOneById(
        enrollDTO.studentId || currentUser.student.id,
      );
      majorId = student.majorId;
      startAcademicYear = student.academicYear;
      studentCode = student.studentCode;
      studentId = student.id;
    }
    console.log('enrollClassGroup@@@@enrollDTO: ', enrollDTO);
    let semesterId: number;

    await this.checkEnrollmentPreConditions(registerClassGroupIds, studentId);

    for (const classGroupId of registerClassGroupIds) {
      const classGroup = await this.classGroupService.findOne({
        id: classGroupId,
        course: {
          curriculumCourses: {
            curriculum: {
              majorId,
              startAcademicYear,
            },
          },
        },
        status: EClassGroupStatus.OPEN_FOR_REGISTER,
      });
      if (!classGroup) {
        console.log(`Nhóm lớp không tìm thấy với id: ${classGroupId}`);
        continue;
      } else {
        //Kiểm tra sinh viên đã đăng ký môn này chưa
        const registeredClassGroup = await this.enrollmentRepository.findOne({
          where: {
            classGroupId: classGroupId,
            status: EEnrollmentStatus.ENROLLED,
            studentId: studentId,
          },
        });
        console.log(
          'enrollClassGroup@@registeredClassGroup::',
          registeredClassGroup,
        );
        if (registeredClassGroup) {
          console.log(
            `Nhóm lớp với id  ${classGroupId} đã được đăng ký cho sinh viên ${studentId}`,
          );
        } else {
          registerValidClassGroupIds.push(classGroupId);
          semesterId = classGroup.semesterId;
        }
      }
    }
    for (const classGroupId of cancelClassGroupIds) {
      const classGroup = await this.classGroupService.findOne({
        id: classGroupId,
        course: {
          curriculumCourses: {
            curriculum: {
              majorId,
              startAcademicYear,
            },
          },
        },
        status: EClassGroupStatus.OPEN_FOR_REGISTER,
      });
      if (!classGroup) {
        console.log(`Nhóm lớp không tìm thấy với id: ${classGroupId}`);
        continue;
      } else {
        //Kiểm tra sinh viên đã huỷ đăng ký môn này chưa
        const cancelledClassGroup = await this.enrollmentRepository.findOne({
          where: {
            classGroupId: classGroupId,
            status: EEnrollmentStatus.CANCELLED,
            studentId: studentId,
          },
        });
        console.log(
          'enrollClassGroup@@cancelledClassGroup::',
          cancelledClassGroup,
        );
        if (cancelledClassGroup) {
          console.log(
            `Nhóm lớp với id  ${classGroupId} đã được hủy đăng ký cho sinh viên ${studentId}`,
          );
        } else {
          cancelValidClassGroupIds.push(classGroupId);
          semesterId = classGroup.semesterId;
        }
      }
    }
    if (
      registerValidClassGroupIds.length == 0 &&
      cancelValidClassGroupIds.length == 0
    ) {
      throw new BadRequestException('Không có nhóm lớp nào hợp lệ');
    }
    if (!semesterId) {
      throw new BadRequestException('SemesterId không hợp lệ');
    }
    const timestamp = new Date().toISOString();
    const batchId = `${semesterId}_${studentCode}_${Date.now()}`;
    let finalClassGroups: { classGroupId: number; isRegistered: boolean }[];
    if (cancelValidClassGroupIds && cancelValidClassGroupIds.length > 0) {
      finalClassGroups = CourseHelper.mergeAndMarkClassGroups(
        cancelValidClassGroupIds,
        registerValidClassGroupIds,
      );
    } else {
      finalClassGroups = CourseHelper.mergeAndMarkClassGroups(
        [],
        registerValidClassGroupIds,
      );
    }
    for (const classGroup of finalClassGroups) {
      const dynamoItem = {
        batchId: batchId,
        classGroupId: classGroup.classGroupId.toString(),
        studentId: studentId,
        semesterId: semesterId,
        status: EEnrollmentStatus.PENDING,
        updatedAt: timestamp,
      };
      try {
        const putCommand = new PutCommand({
          TableName: this.enrollmentLogTableName,
          Item: dynamoItem,
        });
        await this.docClient.send(putCommand);
        console.log(
          `Bản ghi với trạng thái PENDING được tạo ở DynamoDB: batchId=${batchId}, classGroupId=${classGroup.classGroupId}`,
        );
      } catch (error) {
        console.error(
          `Lỗi khi tạo bản ghi PENDING trong DynamoDB cho batch ${batchId}, classGroup ${classGroup.classGroupId}:`,
          error,
        );
        continue; // Cho phép xử lí các nhóm lớp khác
        // throw new InternalServerErrorException(
        //   `Không thể tạo bản ghi đăng ký chờ cho nhóm lớp ${classGroupId}. Vui lòng thử lại.`,
        // );
      }
      const options: SendMessageOptions = {
        isFifo: true,
        groupId: `enrollment-${classGroup.classGroupId}`, // Đảm bảo FIFO theo classGroupId, ai đăng ký trước sẽ được xử lí trước
      };
      const messageBody = {
        studentId: studentId,
        classGroupId: classGroup.classGroupId,
        batchId: batchId,
        majorId: majorId,
        startAcademicYear: startAcademicYear,
        isRegistration: classGroup.isRegistered,
      };
      console.log('enrollClassGroup@@@@messageBody: ', messageBody);
      await this.queueProducer.produce(
        process.env.QUEUE_STUDENT_ENROLLMENT_CLASSGROUP_URL,
        {
          type: 'student-enrollment',
          data: messageBody,
        },
        options,
      );
    }
    return {
      data: {
        batchId: batchId,
        validClassGroupIds: finalClassGroups,
      },
      message: 'Các yêu cầu đăng ký nhóm lớp hợp lệ đã được gửi',
    };
  }

  async getEnrollmentsByBatchId(
    batchId: string,
  ): Promise<EnrollStatusDynamoDto[]> {
    console.log('getEnrollmentsByBatchId@@batchId::', batchId);
    const command = new QueryCommand({
      TableName: this.enrollmentLogTableName,
      KeyConditionExpression: 'batchId = :batchId',
      ExpressionAttributeValues: {
        ':batchId': batchId,
      },
      ProjectionExpression:
        'batchId, studentId, #s, semesterId, updatedAt, classGroupId',
      ExpressionAttributeNames: {
        '#s': 'status',
      },
    });

    const result = await this.docClient.send(command);

    console.log('getEnrollmentsByBatchId@@result: ', result);

    if (!result.Items) return [];

    return result.Items.map((item) => {
      return {
        batchId: item.batchId,
        classGroupId: item.classGroupId,
        studentId: item.studentId,
        semesterId: item.semesterId,
        status: item.status,
        updatedAt: item.updatedAt,
      } as EnrollStatusDynamoDto;
    });
  }

  async getEnrollmentsBySemesterId(
    studentId: number,
    semesterId: string,
  ): Promise<{ data: EnrollmentCourseEntity[]; meta: MetaDataInterface }> {
    const [data, total] = await this.enrollmentRepository.findAndCount({
      where: {
        studentId: studentId,
        classGroup: {
          semesterId: Number(semesterId),
        },
        status: EEnrollmentStatus.ENROLLED,
      },
      relations: {
        classGroup: {
          course: {
            curriculumCourses: {
              prerequisiteCourse: true,
            },
          },
          schedules: {
            room: true,
            timeSlot: true,
          },
          semester: true,
        },
      },
    });
    const meta = generatePaginationMeta(total, 1, 1000);
    return {
      data,
      meta,
    };
  }
}
