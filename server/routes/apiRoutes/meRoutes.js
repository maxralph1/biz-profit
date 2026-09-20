import express from 'express';
const meRouter = express.Router();
import authenticated from '../../middleware/authenticated.js';
import { getMe, updateMe, updatePassword } from '../../app/http/controllers/meController.js';

meRouter.use(authenticated);

meRouter.get('/', getMe);
meRouter.patch('/', updateMe);
meRouter.put('/password', updatePassword);

export default meRouter;