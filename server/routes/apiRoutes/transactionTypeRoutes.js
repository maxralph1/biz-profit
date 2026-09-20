/**
import express from 'express'; 
const transactionTypeRouter = express.Router(); 
import {
  getTransactionTypes, 
  createTransactionType, 
  getTransactionType, 
  updateTransactionType, 
  deleteTransactionType
} from '../../app/http/controllers/transactionTypeController.js'; 

transactionTypeRouter.route('/:id')
                    .get(getTransactionType)
                    .put(updateTransactionType)
                    .delete(deleteTransactionType);

transactionTypeRouter.route('/')
                    .get(getTransactionTypes)
                    .post(createTransactionType);

export default transactionTypeRouter;
*/