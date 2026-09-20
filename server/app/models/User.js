/**
const User = `
  id INT AUTO_INCREMENT PRIMARY KEY, 
  first_name VARCHAR(255) NOT NULL, 
  last_name VARCHAR(255) NOT NULL, 
  username VARCHAR(255) NOT NULL UNIQUE, 
  email VARCHAR(255) NOT NULL UNIQUE, 
  password VARCHAR(255) NOT NULL, 
  secret_question_login BOOLEAN NOT NULL DEFAULT FALSE,
  secret_question VARCHAR(255) NOT NULL, 
  secret_question_answer VARCHAR(255) NOT NULL, 
  role VARCHAR(50) NOT NULL DEFAULT 'user', 
  country_phone_code VARCHAR(10) NOT NULL, 
  phone_number VARCHAR(30) NULL, 
  password_reset_token TEXT, 
  password_reset_token_expires_at DATETIME, 
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, 
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
`;
*/ 


/**
const User = `
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_code VARCHAR(6),
  verification_code_expires_at TIMESTAMPTZ,
  secret_question_login BOOLEAN NOT NULL DEFAULT FALSE,
  secret_question VARCHAR(255),
  secret_question_answer VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  country_phone_code VARCHAR(10) NOT NULL,
  phone_number VARCHAR(30) NULL,
  password_reset_token TEXT,
  password_reset_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
`;
*/


const User = `
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  password_changed_at TIMESTAMPTZ,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_code VARCHAR(6),
  verification_code_expires_at TIMESTAMPTZ,
  secret_question_login BOOLEAN NOT NULL DEFAULT FALSE,
  secret_question VARCHAR(255),
  secret_question_answer VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  country_phone_code VARCHAR(10) NOT NULL,
  phone_number VARCHAR(30) NULL,
  password_reset_token TEXT,
  password_reset_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_users_role
    CHECK (role IN ('user', 'admin'))
`;

export default User;