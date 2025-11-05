import { Request, Response } from 'express';
import { UserRepository } from '../../domain/repositories/user.repository';
import { UserService } from '../../services/user.service';

export class UserController {
  private userService: UserService;

  constructor() {
    const userRepository = new UserRepository();
    this.userService = new UserService(userRepository);
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const user = await this.userService.createUser(req.body);
      res.status(201).json(user);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Error creating user'
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const user = await this.userService.getUserById(req.params.id);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Error fetching user'
      });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const user = await this.userService.updateUser(req.params.id, req.body);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json(user);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Error updating user'
      });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const success = await this.userService.deleteUser(req.params.id);
      if (!success) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Error deleting user'
      });
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.userService.listUsers({}, page, limit);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Error listing users'
      });
    }
  }
}
