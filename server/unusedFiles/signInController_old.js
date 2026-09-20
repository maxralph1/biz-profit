import asyncHandler from 'express-async-handler'; 
import bcrypt from 'bcryptjs'; 
import accessTokenSigning from '../../../utils/accessTokenSigning.js';
import refreshTokenSigning from '../../../utils/refreshTokenSigning.js';
import dbConnection from '../../../../config/db.js'; 

/** Sign in with email/username and password */
const signIn = asyncHandler(async (req, res) => {
  const { email_username, password } = req?.body;

  if (!email_username || !password) 
    return res.status(400).json({
      message: 'Email/username and password are required!'
    });
  
  // let accessToken, refreshToken, loginQA;
 
  const [userLookup] = await dbConnection.query(
    `
      SELECT 
        id, 
        first_name, 
        last_name, 
        username, 
        email, 
        phone, 
        role, 
        password, 
        secret_question_login
      FROM users
      WHERE username = ? OR email = ?
      LIMIT 1
    `,
    [email_username, email_username]
  );

  if (userLookup?.length == 0) 
    return res.status(401).json({
      message: 'Unauthorized!'
    });

  const userFound = userLookup[0];
  const passwordMatch = await bcrypt.compare(password, userFound?.password);

  if (!passwordMatch) 
    return res.status(401).json({
      message: "Unauthorized"
    });

  const loginQA = userFound?.secret_question_login;

  const accessToken = accessTokenSigning(userFound);
  const refreshToken = refreshTokenSigning(userFound);

  /** Note that the QA page validity lasts for 4.5 minutes */
  if (loginQA == false) {
    res.cookie('jwt', refreshToken, {
      httpOnly: true, 
      secure: false, 
      sameSite: "lax" , 
      maxAge: 15 * 24 * 60 * 60 * 1000
    }); 
    
    res.json({ access_token: accessToken });
  } else {
    /** add a check on the feontend, if the last page was lohij. of it was not, redirect them to login page */
    res.status(202).json({
      data: {
        user_id: userFound?.id, 
        user_username: userFound?.username
      }
    })
  }

});

/** Get signed in after answering the security question */
const signInWithSecretQA = asyncHandler(async (req, res) => {
  const { user_id, user_username } = req?.body; 

  if (!(user_id && user_username)) 
    return res.status(401).json({
      message: 'Unauthorized!'
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
        role, 
        password, 
        secret_question_login, 
        secret_question_answer
      FROM users
      WHERE id = ? 
        AND username = ? 
        AND secret_question_login = TRUE
      LIMIT 1
    `,
    [user_id, 
     user_username]
  );

  if (userLookup?.length == 0) 
    return res.status(401).json({
      message: 'Unauthorized!'
    });

  const userFound = userLookup[0];

  /** Handle Q&A */
  const { secret_question_answer } = req.body;

  const securityAnswerMatch = await bcrypt.compare(
    secret_question_answer,
    userFound?.secret_question_answer
  );

  if (!securityAnswerMatch) 
    return res.status(401).json({
      message: 'Unauthorized!'
    });

  const accessToken = accessTokenSigning(userFound); 
  const refreshToken = refreshTokenSigning(userFound); 

  res.cookie('jwt', refreshToken, {
    httpOnly: true, 
    secure: false, // true in production
    sameSite: "lax" , 
    maxAge: 15 * 24 * 60 * 60 * 1000
  }); 

  res.json({ access_token: accessToken });
});

export { signIn, signInWithSecretQA };