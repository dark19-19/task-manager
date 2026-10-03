// backend/src/routes/tasks.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
} from '../controllers/taskController.js';

const router = Router();

// Every route here requires a valid JWT
router.use(requireAuth);

router.get('/', listTasks);
router.post('/', createTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

export default router;