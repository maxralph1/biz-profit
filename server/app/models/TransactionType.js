/** 
const TransactionType = `
  id INT AUTO_INCREMENT PRIMARY KEY, 
  business_id INT NOT NULL, 
  user_id INT NOT NULL, 
  name VARCHAR(255) NOT NULL, 
  description TEXT NOT NULL, 
  type VARCHAR(50) NOT NULL DEFAULT 'debit', 
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP, 

  CONSTRAINT fk_transaction_type_business
    FOREIGN KEY (business_id)
    REFERENCES businesses(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_transaction_type_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
`;

export default TransactionType;
*/ 

/**
type VARCHAR(50) NOT NULL DEFAULT 'debit'
  CHECK (type IN ('debit', 'credit'))
*/


/**
const TransactionType = `
  id SERIAL PRIMARY KEY,
  business_id INT NOT NULL,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'debit',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_transaction_type_business
    FOREIGN KEY (business_id)
    REFERENCES businesses(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_transaction_type_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
`;

export default TransactionType;
*/



const TransactionType = `
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL, 
  user_id UUID NOT NULL, 
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'debit',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, 
  deleted_at TIMESTAMPTZ, 

  CONSTRAINT fk_transaction_type_business
    FOREIGN KEY (business_id)
    REFERENCES businesses(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_transaction_type_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT uq_transaction_type_business_name
    UNIQUE (business_id, name),

  CONSTRAINT chk_transaction_types_type
    CHECK (type IN ('debit', 'credit'))
`;

export default TransactionType;