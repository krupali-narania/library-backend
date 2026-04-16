import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  ExtractJwt,
  Strategy,
  StrategyOptionsWithoutRequest,
} from 'passport-jwt';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET'),
      // explicitly declare that we are _not_ passing the request to the
      // verify callback so the options type matches `StrategyOptionsWithoutRequest`
      passReqToCallback: false,
    } as StrategyOptionsWithoutRequest);
  }

  // specify a proper payload type rather than `any` if you know its shape
  validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      role: payload.role,
      libraryId: payload.libraryId,
    };
  }
}
