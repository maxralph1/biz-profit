import 'dotenv/config'; 
import jwt from 'jsonwebtoken'; 

function refreshTokenSigning(userFound) {
  if (!process.env.REFRESH_TOKEN_SECRET) {
    throw new Error('REFRESH_TOKEN_SECRET is not set');
  }
  
  return jwt.sign(
    {
      "user": {
        "id": userFound?.id, 
        "username": userFound?.username
      }
    }, 
    process.env.REFRESH_TOKEN_SECRET, 
    { expiresIn: 15 * 24 * 60 * 60 }
  );
}; 

export default refreshTokenSigning;