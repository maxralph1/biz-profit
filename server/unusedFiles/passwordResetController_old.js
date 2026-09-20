import asyncHandler from 'express-async-handler'; 
import jwt from 'jsonwebtoken'; 
import passwordResetMailTemplate from '../../../mails/templates/passwordResetMail.js';
import sendMail from '../../../mails/sendMail.js'; 
import dbConnection from '../../../../config/db/dbClient.js'; 

/** Mail Password Reset Link generation and mailing */
const mailPasswordResetLink = asyncHandler(async (req, res) => {
  const { email } = req?.body;

  const [userLookup] = await dbConnection.query(
    `
      SELECT 
        id, 
        first_name, 
        last_name, 
        username, 
        email, 
        password, 
        secret_question_login
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email]
  );

  if (userLookup?.length == 0) 
    return res.status(200).json({
      success: 'Notification sent to email address if account exists.'
    });

  const userFound = userLookup[0];

  const passwordResetToken = jwt.sign(
    { "username": userFound?.username }, 
    process.env.PASSWORD_RESET_TOKEN_SECRET, 
    { expiresIn: 10 * 60 }
  );
  const passwordResetTokenExpiresAt = Date.now().addMinutes(10);

  try {
    const [userUpdate] = await dbConnection.query(
      `
        UPDATE users
        SET
          password_reset_token = ?,
          password_reset_expires_at = ?
        WHERE email = ?
      `,
      [passwordResetToken, 
       passwordResetTokenExpiresAt, 
       email]
    );
  } catch (error) {
    return res.status(500).json({
      message: 'Reset token generation failed!'
    });
  }

  const mailSubject = "Password Reset Request Link";
  const mailBody = passwordResetToken(userFound); 

  await sendMail(process.env.NOTIFICATION_MAIL, 
                userFound?.email, 
                mailSubject, 
                mailBody); 

  res.status(200).json({
    success: 'Notification sent to email address if account exists.'
  });
}); 

/** Password Reset */
const passwordReset = asyncHandler(async (req, res) => {
  const { token } = req?.params; 
  const { password } = req?.body; 

  const [userLookup] = await dbConnection.query(
    `
      SELECT 
        id, 
        first_name, 
        last_name, 
        username, 
        email, 
        password, 
        secret_question_login
      FROM users
      WHERE password_reset_token = ?
      LIMIT 1
    `,
    [token]
  );

  if (userLookup?.length == 0) 
    return res.status(200).json({
      success: 'User not found!.'
    });

  const userFound = userLookup[0];

  try {
    jwt.verify(
      userFound.password_reset_token. 
      process.env.PASSWORD_RESET_TOKEN_SECRET
    )
  } catch (error) {
    return res.status(400).json({
      message: 'Link expired!', 
      error: `${error}`
    })
  } 

  try {
    const [userUpdate] = await dbConnection.query(
      `
        UPDATE users
        SET
          password = ?, 
          password_reset_token = ? 
        WHERE username = ?
      `,
      [password, 
       NULL, 
       userFound.username]
    );
  } catch (error) {
    return res.status(500).json({
      message: 'Password reset failed!'
    });
  };

  res.json({
    success: 'Password reset successful.'
  })
});

export {
  mailPasswordResetLink, 
  passwordReset
};