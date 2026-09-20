import asyncHandler from 'express-async-handler'; 
import jwt from 'jsonwebtoken'; 
import accessTokenSigning from '../../../utils/accessTokenSigning.js';
import dbConnection from '../../../../config/db.js';

const refreshToken = asyncHandler(async (req, res) => {
  const cookies = req?.cookies; 

  if (!cookies?.jwt) return res.status(401).json({
    message: 'Unauthorized!'
  });

  const refresh = cookies?.jwt;

  jwt.verify(
    refresh, 
    process.env.REFRESH_TOKEN_SECRET, 
    async (error, decoded) => {
      if (error) return res.status(403).json({
        message: 'Forbidden!'
      });

      const [userLookup] = await dbConnection.query(
        `
          SELECT 
            id, 
            first_name, 
            last_name, 
            username, 
            email, 
            phone, 
            role
          FROM users
          WHERE id = ? AND username = ?
          LIMIT 1
        `,
        [decoded?.user?.id, decoded?.user?.username]
      );
    
      if (userLookup?.length == 0) 
        return res.status(401).json({
          message: 'Unauthorized!'
        });
    
      const userFound = userLookup[0];

      const accessToken = accessTokenSigning(userFound);
      
      res.json({ access_token: accessToken });
    }
  );
});

export default refreshToken;