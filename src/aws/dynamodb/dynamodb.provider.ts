import { Provider } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { AWSConstants } from 'src/utils/constants';

export const dynamoDBClientProvider: Provider = {
  provide: AWSConstants.DYNAMODB_CLIENT,
  useFactory: () => {
    const client = new DynamoDBClient({
      region: AWSConstants.REGION,
    });
    return DynamoDBDocumentClient.from(client);
  },
};
