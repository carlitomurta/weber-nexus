import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { type User, UsersRepository } from '@weber-nexus/repository';

export type SafeUser = Pick<User, 'id' | 'name' | 'email' | 'role'>;

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(private readonly usersRepository: UsersRepository) {}

  async onModuleInit() {
    await this.usersRepository.ensureDefaultAdmin();
  }

  async login(email: string, password: string): Promise<{ user: SafeUser }> {
    try {
      const user = await this.usersRepository.login(email, password);

      return {
        user: this.toSafeUser(user),
      };
    } catch {
      throw new UnauthorizedException('Invalid email or password.');
    }
  }

  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
