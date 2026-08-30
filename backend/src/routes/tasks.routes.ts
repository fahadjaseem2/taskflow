import { Router } from 'express';
import {
  listTasks,
  getSharedWithMe,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  listComments,
  addComment,
  listShares,
  shareTask,
  revokeShare,
} from '../controllers/tasks.controller';

const router = Router();

router.get('/', listTasks);
// Must be declared before '/:id' or Express treats "shared" as a task id.
router.get('/shared', getSharedWithMe);

router.get('/:id', getTask);
router.post('/', createTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

router.get('/:id/comments', listComments);
router.post('/:id/comments', addComment);

router.get('/:id/shares', listShares);
router.post('/:id/shares', shareTask);
router.delete('/:id/shares/:userId', revokeShare);

export default router;
