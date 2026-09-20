import express from 'express'; 
const userRouter = express.Router(); 
import authenticated from '../../middleware/authenticated.js';
import isAdmin from '../../middleware/isAdmin.js';
import {
  getUsers, 
  createUser, 
  getUser, 
  updateUser, 
  deleteUser
} from '../../app/http/controllers/userController.js'; 
userRouter.use(authenticated, isAdmin);

userRouter.route('/:id')
          .get(getUser)
          .put(updateUser)
          .patch(updateUser)
          .delete(deleteUser);

userRouter.route('/')
          .get(getUsers)
          .post(createUser);

export default userRouter;