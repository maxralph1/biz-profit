import 'dotenv/config'; 
import asyncHandler from 'express-async-handler';
import writeAuthEvent from '../../../../utils/auth/writeAuthEvent.js';

/**
* ---------------------------------------------------
* POST /api/v1/auth/sign-out
* ---------------------------------------------------
*/
const signOut = asyncHandler(async (req, res) => {
  await writeAuthEvent(req, {
    user_id: req.user?.id ?? null, 
    event_type: 'signout'
  });

  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  res.json({ message: 'Signed out' });
});

export default signOut;