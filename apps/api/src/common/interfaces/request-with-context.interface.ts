import { Request } from 'express';
import { JwtUser } from './jwt-user.interface';

export type RequestWithContext = Request & {
  requestId?: string;
  user?: JwtUser;
};
