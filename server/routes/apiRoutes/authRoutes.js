import express from 'express'; 
const authRouter = express.Router();
import signUp from '../../app/http/controllers/auth/signUpController.js';
import verify from '../../app/http/controllers/auth/verifyController.js'
import { signIn, signInWithSecretQA } from '../../app/http/controllers/auth/signInController.js';
import refreshToken from '../../app/http/controllers/auth/refreshTokenController.js';
import { mailPasswordResetLink, passwordReset } from '../../app/http/controllers/auth/passwordResetController.js';
import signOut from '../../app/http/controllers/auth/signOutController.js';
authRouter.post('/sign-up', signUp);
authRouter.post('/verify', verify);
authRouter.post('/sign-in', signIn);
authRouter.post('/sign-in-with-qa', signInWithSecretQA);
authRouter.post('/refresh-token', refreshToken); 
authRouter.post('/mail-password-reset-link', mailPasswordResetLink); 
authRouter.put('/password-reset', passwordReset);
authRouter.post('/sign-out', signOut);

export default authRouter;