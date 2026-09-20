import express from 'express'; 
const businessRouter = express.Router(); 
import authenticated from '../../middleware/authenticated.js'; 
import isAdmin from '../../middleware/isAdmin.js';
import {
  getBusinesses, 
  getMyBusinesses,
  createBusiness, 
  getBusiness, 
  updateBusiness, 
  deleteBusiness, 
} from '../../app/http/controllers/businessController.js'; 
import {
  getBusinessMembers,
  addBusinessMember,
  updateBusinessMember,
  removeBusinessMember,
} from '../../app/http/controllers/businessUserController.js';import {
  getTransactionTypes,
  createTransactionType,
  getTransactionType,
  updateTransactionType,
  deleteTransactionType,
} from '../../app/http/controllers/transactionTypeController.js';
import {
  getTransactions,
  createTransaction,
  getTransaction,
  updateTransaction,
  deleteTransaction, 
  reverseTransaction
} from '../../app/http/controllers/transactionController.js';
import {
  getMonthlyTotals,
  createMonthlyTotal,
  getMonthlyTotal,
  updateMonthlyTotal,
  deleteMonthlyTotal,
} from '../../app/http/controllers/monthlyTotalController.js';

businessRouter.use(authenticated); 

/** Businesses */

/** User Businesses */
businessRouter.get('/:businessId/members', authenticated, getBusinessMembers);
businessRouter.post('/:businessId/members', authenticated, addBusinessMember);
businessRouter.patch('/:businessId/members/:userId', authenticated, updateBusinessMember);
businessRouter.delete('/:businessId/members/:userId', authenticated, removeBusinessMember);

/** Transaction Types */
businessRouter.get('/:businessId/transaction-types', authenticated, getTransactionTypes);
businessRouter.post('/:businessId/transaction-types', authenticated, createTransactionType);
businessRouter.get('/:businessId/transaction-types/:id', authenticated, getTransactionType);
businessRouter.patch('/:businessId/transaction-types/:id', authenticated, updateTransactionType);
businessRouter.delete('/:businessId/transaction-types/:id', authenticated, deleteTransactionType);

/** Transactions */
businessRouter.get('/:businessId/transactions', authenticated, getTransactions);
businessRouter.post('/:businessId/transactions', authenticated, createTransaction);
businessRouter.post('/:businessId/transactions/:id/reverse', authenticated, reverseTransaction);
businessRouter.get('/:businessId/transactions/:id', authenticated, getTransaction);
businessRouter.patch('/:businessId/transactions/:id', authenticated, updateTransaction);
businessRouter.delete('/:businessId/transactions/:id', authenticated, deleteTransaction);

/** Monthly Totals */
businessRouter.get('/:businessId/monthly-totals', authenticated, getMonthlyTotals);
businessRouter.post('/:businessId/monthly-totals', authenticated, createMonthlyTotal);
businessRouter.get('/:businessId/monthly-totals/:id', authenticated, getMonthlyTotal);
businessRouter.patch('/:businessId/monthly-totals/:id', authenticated, updateMonthlyTotal);
businessRouter.delete('/:businessId/monthly-totals/:id', authenticated, deleteMonthlyTotal);


/** Businesses proper */
businessRouter.get('/me', getMyBusinesses);

businessRouter.route('/:id')
              .get(getBusiness)
              .put(updateBusiness)
              .patch(updateBusiness)
              .delete(deleteBusiness);

businessRouter.route('/')
              .get(isAdmin, getBusinesses)
              .post(createBusiness);

export default businessRouter;