import express from 'express'; 
const router = express.Router();

import authRouter from './apiRoutes/authRoutes.js';
import authEventRouter from './apiRoutes/authEventRoutes.js';
import businessRouter from './apiRoutes/businessRoutes.js';
// import monthlyTotalRouter from './apiRoutes/monthlyTotalRoutes.js';
// import transactionTypeRouter from './apiRoutes/transactionTypeRoutes.js';
// import transactionRouter from './apiRoutes/transactionRoutes.js';
import userRouter from './apiRoutes/userRoutes.js'; 
import meRouter from './apiRoutes/meRoutes.js';

router.use('/auth', authRouter);
router.use('/auth-events', authEventRouter);
router.use('/businesses', businessRouter);
// router.use('/monthly-totals', monthlyTotalRouter);
// router.use('/transaction-types', transactionTypeRouter);
// router.use('/transactions', transactionRouter);
router.use('/users', userRouter);
router.use('/me', meRouter);

export default router;