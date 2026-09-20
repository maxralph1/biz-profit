import asyncHandler from 'express-async-handler';
import bcrypt from 'bcryptjs';
// import jwt from 'jsonwebtoken'; 
import dbConnection from '../../../../config/db.js'; 

const signUp = asyncHandler(async (req, res) => {
  const { first_name, 
          last_name, 
          username, 
          email, 
          password, 
          country_phone_code, 
          phone_number } = req?.body;

  const [duplicateUser] = await dbConnection.query(
    `
      SELECT id, username, email
      FROM users
      WHERE username = ? OR email = ?
      LIMIT 1
    `,
    [username, email]
  );
  
  if (duplicateUser.length > 0) {
    const oldUser = duplicateUser[0];
  
    if (oldUser.username === username) {
      return res.status(409).json({
        message: `Username ${oldUser?.username} is already in use!`
      }); 
    }
  
    if (oldUser.email === email) {
      return res.status(409).json({
        message: `Email ${oldUser?.email} is already in use!`
      }); 
    }
  }
  
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = new User({
    username, 
    first_name, 
    last_name, 
    email, 
    password: hashedPassword, 
    country_phone_code, 
    phone_number
  }); 

  newUser.save()
    .then(function () {
      res.status(201).json({
        success: 'Registration successful. Sign into your newly created account.' 
      });
    })
    .catch(function (error) {
      res.status(400).json({
        message: "An error occured! Retry later.", 
        error: `${error}`
      });
    });
});

export default signUp;