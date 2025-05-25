import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SQSEvent, SQSHandler } from 'aws-lambda';
import dataSource from 'db/data-source';
import { enrollOrUnenrollClassGroup } from 'src/aws/function/enrollClassGroup.function';
import { AWSConstants } from 'src/utils/constants';

const ddbClient = new DynamoDBClient({ region: AWSConstants.REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

export const handler: SQSHandler = async (event: SQSEvent) => {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);

      if (message.type === 'student-enrollment') {
        const result = await enrollOrUnenrollClassGroup(
          message.data,
          dataSource,
          docClient,
          AWSConstants.DYNAMO_ENROLLMENT_TABLE,
        );
        console.log(
          `handler@@Processedstudent:: ${JSON.stringify(message.data)}`,
        );
        console.log(`handler@@Enrollmentresult:: ${JSON.stringify(result)}`);
      } else {
        console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (err) {
      console.error(`Error processing message: ${err}`);
      throw err;
    }
  }
};
