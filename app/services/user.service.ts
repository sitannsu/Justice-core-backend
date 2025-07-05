import { IUser } from '../domain/models/user.model';
import { UserRepository } from '../domain/repositories/user.repository';

export class UserService {
  constructor(private userRepository: UserRepository) {}

  async createUser(userData: Partial<IUser>): Promise<IUser> {
    // Add any business logic here
    return await this.userRepository.create(userData);
  }

  async getUserById(id: string): Promise<IUser | null> {
    return await this.userRepository.findById(id);
  }

  async updateUser(id: string, userData: Partial<IUser>): Promise<IUser | null> {
    // Add any business logic here
    return await this.userRepository.updateWithTransaction(id, userData);
  }

  async deleteUser(id: string): Promise<boolean> {
    return await this.userRepository.delete(id);
  }

  async listUsers(filters: Partial<IUser> = {}, page = 1, limit = 10) {
    return await this.userRepository.list(filters, page, limit);
  }
}
