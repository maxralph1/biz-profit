/**
import express from 'express'; 
const monthlyTotalRouter = express.Router(); 
import {
  getMonthlyTotals, 
  createMonthlyTotal, 
  getMonthlyTotal, 
  updateMonthlyTotal, 
  deleteMonthlyTotal
} from '../../app/http/controllers/monthlyTotalController.js'; 

monthlyTotalRouter.route('/:id')
                  .get(getMonthlyTotal)
                  .put(updateMonthlyTotal)
                  .delete(deleteMonthlyTotal);

monthlyTotalRouter.route('/')
                  .get(getMonthlyTotals)
                  .post(createMonthlyTotal);

export default monthlyTotalRouter;
*/