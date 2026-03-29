import { Role } from '../constants/roles';

export type JwtUser = {
  name: string;
  role: Role;
  sub: string;
};
