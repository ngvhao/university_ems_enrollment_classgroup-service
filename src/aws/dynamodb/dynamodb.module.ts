import { Module, Global } from '@nestjs/common';
import { dynamoDBClientProvider } from './dynamodb.provider';
import { AWSConstants } from 'src/utils/constants';

@Global()
@Module({
  imports: [],
  providers: [dynamoDBClientProvider],
  exports: [AWSConstants.DYNAMODB_CLIENT],
})
export class DynamoDBModule {}
