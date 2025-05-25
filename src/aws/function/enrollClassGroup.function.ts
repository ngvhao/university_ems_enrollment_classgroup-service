import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ClassGroupEntity } from 'src/modules/class_group/entities/class_group.entity';
import { EnrollmentClassGroupDto } from 'src/modules/enrollment_course/dtos/enrollClassGroup.dto';
import { EnrollmentCourseEntity } from 'src/modules/enrollment_course/entities/enrollment_course.entity';
import { EClassGroupStatus } from 'src/utils/enums/class.enum';
import { EEnrollmentStatus } from 'src/utils/enums/course.enum';
import { DataSource } from 'typeorm';

const logPrefix = (batchId: string, classGroupId: string | number) =>
  `[${batchId}-${classGroupId}]`;

export async function enrollOrUnenrollClassGroup(
  createDto: EnrollmentClassGroupDto,
  dataSource: DataSource,
  docClient: DynamoDBDocumentClient,
  enrollmentDynamoDbTableName: string,
): Promise<{ status: EEnrollmentStatus; reason?: string; rdbId?: number }> {
  const {
    classGroupId,
    studentId,
    majorId,
    startAcademicYear,
    batchId,
    isRegistration,
  } = createDto;

  let rdbEnrollmentId: number | undefined;
  let finalStatusInRDS = EEnrollmentStatus.FAILED;
  let failureReason: string | undefined;

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  const currentLogPrefix = logPrefix(batchId, classGroupId);

  try {
    console.log(
      `${currentLogPrefix} Starting RDB transaction for student ${studentId}. Action: ${
        isRegistration ? 'ENROLL' : 'UNENROLL'
      }`,
    );

    const classGroup = await queryRunner.manager.findOne(ClassGroupEntity, {
      where: {
        id: classGroupId,
        course: {
          curriculumCourses: {
            curriculum: {
              majorId,
              startAcademicYear,
            },
          },
        },
      },
      lock: { mode: 'pessimistic_write' },
      relations: [
        'course',
        'course.curriculumCourses',
        'course.curriculumCourses.curriculum',
      ],
    });

    if (!classGroup) {
      failureReason = `Không tìm thấy Nhóm lớp học với ID ${classGroupId} hoặc không khớp chương trình học.`;
      throw new NotFoundException(failureReason);
    }

    const existingEnrollment = await queryRunner.manager.findOne(
      EnrollmentCourseEntity,
      {
        where: { studentId, classGroupId },
        select: ['id', 'status'],
      },
    );

    // LOGIC XỬ LÝ ĐĂNG KÝ (isRegistration = true)
    if (isRegistration) {
      console.log(
        `${currentLogPrefix} Processing ENROLLMENT for student ${studentId}.`,
      );
      if (classGroup.status !== EClassGroupStatus.OPEN) {
        failureReason = `Nhóm lớp học ID ${classGroupId} không còn mở để đăng ký. Status: ${EClassGroupStatus[classGroup.status]}.`;
        throw new BadRequestException(failureReason);
      }

      if (classGroup.registeredStudents >= classGroup.maxStudents) {
        failureReason = `Nhóm lớp học ID ${classGroupId} đã đầy. (${classGroup.registeredStudents}/${classGroup.maxStudents})`;
        throw new BadRequestException(failureReason);
      }

      if (existingEnrollment) {
        // Sinh viên đã có bản ghi, kiểm tra trạng thái
        if (existingEnrollment.status === EEnrollmentStatus.ENROLLED) {
          failureReason = `Sinh viên ID ${studentId} đã đăng ký và đang ở trạng thái ENROLLED cho nhóm lớp ID ${classGroupId}.`;
          throw new ConflictException(failureReason);
        } else if (
          existingEnrollment.status === EEnrollmentStatus.CANCELLED ||
          existingEnrollment.status === EEnrollmentStatus.FAILED
        ) {
          // Cho phép đăng ký lại nếu đã từng hủy/thất bại
          console.log(
            `${currentLogPrefix} Student ${studentId} is re-enrolling. Previous status: ${EEnrollmentStatus[existingEnrollment.status]}. Updating status to ENROLLED.`,
          );
          await queryRunner.manager.update(
            EnrollmentCourseEntity,
            existingEnrollment.id,
            { status: EEnrollmentStatus.ENROLLED },
          );
          rdbEnrollmentId = existingEnrollment.id;
        } else {
          failureReason = `Sinh viên ID ${studentId} đã có bản ghi với trạng thái ${EEnrollmentStatus[existingEnrollment.status]} cho nhóm lớp ID ${classGroupId}, không thể đăng ký lại.`;
          throw new ConflictException(failureReason);
        }
      } else {
        const newEnrollment = queryRunner.manager.create(
          EnrollmentCourseEntity,
          {
            studentId,
            classGroupId,
            status: EEnrollmentStatus.ENROLLED,
          },
        );
        const savedEnrollment = await queryRunner.manager.save(newEnrollment);
        rdbEnrollmentId = savedEnrollment.id;
        console.log(
          `${currentLogPrefix} New enrollment created for student ${studentId}. RDB ID: ${rdbEnrollmentId}`,
        );
      }

      // Tăng số lượng sinh viên đã đăng ký
      await queryRunner.manager.increment(
        ClassGroupEntity,
        { id: classGroupId },
        'registeredStudents',
        1,
      );
      console.log(
        `${currentLogPrefix} Incremented registeredStudents for class group ${classGroupId}.`,
      );

      // Kiểm tra và cập nhật trạng thái lớp nếu đầy
      const updatedClassGroup = await queryRunner.manager.findOneBy(
        ClassGroupEntity,
        { id: classGroupId },
      );
      if (
        updatedClassGroup &&
        updatedClassGroup.registeredStudents >= updatedClassGroup.maxStudents
      ) {
        if (updatedClassGroup.status === EClassGroupStatus.OPEN) {
          await queryRunner.manager.update(ClassGroupEntity, classGroupId, {
            status: EClassGroupStatus.CLOSED,
          });
          console.log(
            `${currentLogPrefix} Nhóm lớp ${classGroupId} được set trạng thái CLOSED.`,
          );
        }
      }
      finalStatusInRDS = EEnrollmentStatus.ENROLLED;
    }
    // LOGIC XỬ LÝ HỦY ĐĂNG KÝ (isRegistration = false)
    else {
      console.log(
        `${currentLogPrefix} Processing UNENROLLMENT for student ${studentId}.`,
      );
      if (!existingEnrollment) {
        failureReason = `Sinh viên ID ${studentId} chưa đăng ký nhóm lớp ID ${classGroupId} để có thể hủy.`;
        throw new NotFoundException(failureReason);
      }

      if (existingEnrollment.status !== EEnrollmentStatus.ENROLLED) {
        failureReason = `Sinh viên ID ${studentId} không ở trạng thái ENROLLED trong nhóm lớp ID ${classGroupId} để hủy. Trạng thái hiện tại: ${EEnrollmentStatus[existingEnrollment.status]}.`;
        throw new BadRequestException(failureReason);
      }

      await queryRunner.manager.update(
        EnrollmentCourseEntity,
        existingEnrollment.id,
        { status: EEnrollmentStatus.CANCELLED },
      );
      rdbEnrollmentId = existingEnrollment.id;
      console.log(
        `${currentLogPrefix} Student ${studentId} unregistered. Enrollment status set to WITHDRAWN. RDB ID: ${rdbEnrollmentId}`,
      );

      // Giảm số lượng sinh viên đã đăng ký
      if (classGroup.registeredStudents > 0) {
        await queryRunner.manager.decrement(
          ClassGroupEntity,
          { id: classGroupId },
          'registeredStudents',
          1,
        );
        console.log(
          `${currentLogPrefix} Decremented registeredStudents for class group ${classGroupId}.`,
        );

        // Lấy lại thông tin classGroup sau khi decrement
        const classGroupAfterDecrement = await queryRunner.manager.findOneBy(
          ClassGroupEntity,
          { id: classGroupId },
        );
        if (
          classGroupAfterDecrement &&
          classGroupAfterDecrement.registeredStudents <
            classGroup.maxStudents &&
          classGroupAfterDecrement.status === EClassGroupStatus.CLOSED
        ) {
          await queryRunner.manager.update(ClassGroupEntity, classGroupId, {
            status: EClassGroupStatus.OPEN,
          });
          console.log(
            `${currentLogPrefix} Class group ${classGroupId} status set back to OPEN.`,
          );
        }
      } else {
        console.warn(
          `${currentLogPrefix} Attempted to decrement registeredStudents for class group ${classGroupId}, but count was already 0 or less. This should ideally not happen if logic is correct.`,
        );
      }
      finalStatusInRDS = EEnrollmentStatus.CANCELLED;
    }

    await queryRunner.commitTransaction();
    console.log(
      `${currentLogPrefix} RDB transaction committed for student ${studentId}. Action: ${isRegistration ? 'ENROLL' : 'UNENROLL'}. Final RDB Status: ${EEnrollmentStatus[finalStatusInRDS]}. RDB ID: ${rdbEnrollmentId}`,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    console.error(
      `${currentLogPrefix} RDB transaction rolled back for student ${studentId}. Action: ${isRegistration ? 'ENROLL' : 'UNENROLL'}. Error:`,
      error.message,
    );

    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException ||
      error instanceof ConflictException
    ) {
      failureReason = error.message;
    } else if (error.driverError?.code === '23505') {
      failureReason = `Lỗi trùng lặp dữ liệu trong RDB. Sinh viên ID ${studentId} có thể đã đăng ký Nhóm lớp học ID ${classGroupId} (Lỗi DB).`;
    } else {
      failureReason = `Lỗi không xác định trong quá trình xử lý RDB: ${error.message}`;
    }
    finalStatusInRDS = EEnrollmentStatus.FAILED;
  } finally {
    await queryRunner.release();

    // Luôn cập nhật DynamoDB với trạng thái cuối cùng (thành công hoặc thất bại của RDB)
    const timestamp = new Date().toISOString();
    const updateExpressionParts: string[] = [
      '#status = :status',
      '#updatedAt = :updatedAt',
      '#action = :action',
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expressionAttributeValues: Record<string, any> = {
      ':status': finalStatusInRDS,
      ':updatedAt': timestamp,
      ':action': isRegistration ? 'ENROLL' : 'UNENROLL',
    };
    const expressionAttributeNames: Record<string, string> = {
      '#status': 'status',
      '#updatedAt': 'updatedAt',
      '#action': 'action',
    };

    if (rdbEnrollmentId) {
      updateExpressionParts.push('#rdbEnrollmentId = :rdbEnrollmentId');
      expressionAttributeValues[':rdbEnrollmentId'] = rdbEnrollmentId;
      expressionAttributeNames['#rdbEnrollmentId'] = 'rdbEnrollmentId';
    }
    if (failureReason) {
      updateExpressionParts.push('#failureReason = :failureReason');
      expressionAttributeValues[':failureReason'] = failureReason;
      expressionAttributeNames['#failureReason'] = 'failureReason';
    }

    const updateCommand = new UpdateCommand({
      TableName: enrollmentDynamoDbTableName,
      Key: { batchId: batchId, classGroupId: classGroupId.toString() },
      UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'NONE',
    });

    let finalOverallStatus: EEnrollmentStatus = finalStatusInRDS;
    let overallFailureReason = failureReason;

    try {
      await docClient.send(updateCommand);
      console.log(
        `${currentLogPrefix} DynamoDB record cập nhật. Status: ${EEnrollmentStatus[finalOverallStatus]}. Student: ${studentId}. Lý do: ${failureReason || 'N/A'}`,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (dynamoDbError: any) {
      console.error(
        `${currentLogPrefix} CRITICAL: Cập nhật record DynamoDB lỗi cho studentID: ${studentId}. Status: ${EEnrollmentStatus[finalOverallStatus]}. Lý do: ${failureReason || 'N/A'}. DDB Error:`,
        dynamoDbError.message,
      );
      if (finalStatusInRDS === EEnrollmentStatus.ENROLLED) {
        finalOverallStatus = EEnrollmentStatus.ENROLLED_DYNAMODB_UPDATE_FAILED;
        overallFailureReason = `RDS ${EEnrollmentStatus[finalStatusInRDS]} cập nhật thành công, nhưng DynamoDB cập nhật lỗi: ${dynamoDbError.message}`;
      } else {
        overallFailureReason = overallFailureReason
          ? `${overallFailureReason}. DynamoDB cập nhật lỗi: ${dynamoDbError.message}`
          : `DynamoDB cập nhật lỗi: ${dynamoDbError.message}`;
      }
    }
    return {
      status: finalOverallStatus,
      reason: overallFailureReason,
      rdbId: rdbEnrollmentId,
    };
  }
}
