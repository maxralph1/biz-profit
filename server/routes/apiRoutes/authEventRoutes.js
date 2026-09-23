import express from 'express';
const authEventRouter = express.Router();
import authenticated from '../../middleware/authenticated.js';
import isAdmin from '../../middleware/isAdmin.js';
import { getAuthEvents, getMyAuthEvents } from '../../app/http/controllers/auth/authEventController.js';


authEventRouter.get('/my-auth-events', authenticated, getMyAuthEvents);
authEventRouter.get('/', authenticated, isAdmin, getAuthEvents);

export default authEventRouter;