/**
import express from 'express'; 
const transactionRouter = express.Router(); 
import {
  getTransactions, 
  createTransaction, 
  getTransaction, 
  updateTransaction, 
  deleteTransaction
} from '../../app/http/controllers/transactionController.js'; 

transactionRouter.route('/:id')
                .get(getTransaction)
                .put(updateTransaction)
                .delete(deleteTransaction);

transactionRouter.route('/')
                .get(getTransactions)
                .post(createTransaction);

export default transactionRouter;
*/