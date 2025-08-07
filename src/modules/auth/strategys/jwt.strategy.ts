import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import _ from 'lodash';
import { Strategy } from 'passport-jwt';
import { UserService } from 'src/modules/user/user.service';
import { jwtConstants } from 'src/utils/constants';
import { LoggedInterface } from 'src/utils/interfaces/logged.interface';

const cookieExtractor = (req: Request): string | null => {
  let token = null;
  if (req && req.cookies) {
    token = req.cookies['accessToken'];
  }
  return token;
};
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly userService: UserService) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: jwtConstants.accessSecret,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async validate(payload: any): Promise<LoggedInterface> {
    try {
      console.log('payload', payload);
      const user = await this.userService.getUserById(payload.id);
      if (!user) {
        throw new UnauthorizedException();
      }
      return _.omit(user, ['password', 'refreshToken']) as LoggedInterface;
    } catch (error) {
      this.logger.error(`JWT validation failed: ${error.message}`);
      throw new UnauthorizedException();
    }
  }
}
