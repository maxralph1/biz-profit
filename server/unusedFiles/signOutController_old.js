import asyncHandler from 'express-async-handler'; 
import jwt from 'jsonwebtoken'; 

const signOut = asyncHandler(async (req, res) => {
  const cookies = req?.cookies; 

  if (!cookies?.jwt) return res.sendStatus(204); 

  res.clearCookie('jwt', {
    httpOnly: true, 
    sameSite: 'None', 
    secure: false
  });

  return res.sendStatus(204);
});

export default signOut;