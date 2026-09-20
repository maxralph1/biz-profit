import 'dotenv/config'; 
import jwt from 'jsonwebtoken';

function accessTokenSigning(userFound) {
  if (!process.env.ACCESS_TOKEN_SECRET) {
    throw new Error('ACCESS_TOKEN_SECRET is not set');
  }
  
  return jwt.sign(
    {
      user: {
        id: userFound?.id,
        first_name: userFound?.first_name,
        last_name: userFound?.last_name,
        username: userFound?.username,
        email: userFound?.email,
        phone: userFound?.country_phone_code && userFound?.phone_number
          ? userFound.country_phone_code + userFound.phone_number
          : null,
        role: userFound?.role,
      },
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: 60 * 60 } // 1 hour
  );
}

export default accessTokenSigning;