import 'dotenv/config';

/**
* ---------------------------------------------------
* POST /api/v1/auth/sign-out
* ---------------------------------------------------
*/
const signOut = (req, res) => {
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  res.json({ message: 'Signed out' });
};

export default signOut;