import { Router } from 'express';
import { UserController } from '../controllers/user.controller';

const router = Router();
const userController = new UserController();

router.post('/', (req, res) => userController.create(req, res));
router.get('/:id', (req, res) => userController.getById(req, res));
router.put('/:id', (req, res) => userController.update(req, res));
router.delete('/:id', (req, res) => userController.delete(req, res));
router.get('/', (req, res) => userController.list(req, res));

export const userRoutes = router;
