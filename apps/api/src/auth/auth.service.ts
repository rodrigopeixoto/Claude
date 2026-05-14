import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  async register(email: string, name: string, password: string) {
    const user = await this.users.create(email, name, password);
    return { user, token: this.sign(user.id) };
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user || !(await this.users.validatePassword(user, password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const { password: _, ...safe } = user;
    return { user: safe, token: this.sign(user.id) };
  }

  private sign(userId: string) {
    return this.jwt.sign({ sub: userId });
  }
}
