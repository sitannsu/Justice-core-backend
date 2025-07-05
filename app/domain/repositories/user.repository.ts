import { User, IUser } from '../models/user.model';
import { db } from '../../core/database/mongodb.connection';

export class UserRepository {
  async create(userData: Partial<IUser>): Promise<IUser> {
    return await User.create(userData);
  }

  async findById(id: string): Promise<IUser | null> {
    return await User.findById(id);
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return await User.findOne({ email });
  }

  async update(id: string, userData: Partial<IUser>): Promise<IUser | null> {
    return await User.findByIdAndUpdate(id, userData, { new: true });
  }

  async delete(id: string): Promise<boolean> {
    const result = await User.findByIdAndDelete(id);
    return !!result;
  }

  async list(filters: Partial<IUser> = {}, page = 1, limit = 10): Promise<{ users: IUser[]; total: number }> {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(filters).skip(skip).limit(limit),
      User.countDocuments(filters)
    ]);
    return { users, total };
  }

  async updateWithTransaction(id: string, userData: Partial<IUser>): Promise<IUser | null> {
    return await db.runTransaction(async (session) => {
      const user = await User.findById(id).session(session);
      if (!user) return null;

      Object.assign(user, userData);
      await user.save();
      return user;
    });
  }
}
