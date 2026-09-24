/**
const Transaction = `
  id INT AUTO_INCREMENT PRIMARY KEY, 
  transaction_type_id INT NOT NULL, 
  business_id INT NOT NULL, 
  created_by INT NOT NULL, 
  narration TEXT NOT NULL, 
  amount BIGINT NOT NULL, 
  currency CHAR(3) NOT NULL, 
  approved BOOLEAN NOT NULL DEFAULT FALSE, 
  approver_id INT NULL, 
  transaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, 
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, 
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_transaction_type
    FOREIGN KEY (transaction_type_id)
    REFERENCES transaction_types(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_transaction_business
    FOREIGN KEY (business_id)
    REFERENCES businesses(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_transaction_creator
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_transaction_approver
    FOREIGN KEY (approver_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
`;

export default Transaction; 
*/


/**
const Transaction = `
  id SERIAL PRIMARY KEY,
  transaction_type_id INT NOT NULL,
  business_id INT NOT NULL,
  created_by INT NOT NULL,
  narration TEXT NOT NULL,
  amount BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  approver_id INT NULL,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_transaction_transaction_type
    FOREIGN KEY (transaction_type_id)
    REFERENCES transaction_types(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_transaction_business
    FOREIGN KEY (business_id)
    REFERENCES businesses(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_transaction_creator
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_transaction_approver
    FOREIGN KEY (approver_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT chk_transaction_currency_format
    CHECK (currency ~ '^[A-Z]{3}$'),

  CONSTRAINT chk_transaction_approval_consistency
    CHECK (
      (approved = TRUE  AND approver_id IS NOT NULL) OR
      (approved = FALSE AND approver_id IS NULL)
    )
`;

export default Transaction;
*/





const Transaction = `
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type_id UUID NOT NULL, 
  business_id UUID NOT NULL, 
  created_by UUID NOT NULL, 
  narration TEXT NOT NULL,
  amount BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  approver_id UUID NULL, 
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reverses_transaction_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT fk_transaction_transaction_type
    FOREIGN KEY (transaction_type_id)
    REFERENCES transaction_types(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_transaction_business
    FOREIGN KEY (business_id)
    REFERENCES businesses(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_transaction_creator
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_transaction_approver
    FOREIGN KEY (approver_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_transaction_reverses
    FOREIGN KEY (reverses_transaction_id)
    REFERENCES transactions(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT uq_transaction_reverses
    UNIQUE (reverses_transaction_id),

  CONSTRAINT chk_transaction_not_self_reverse
    CHECK (reverses_transaction_id IS NULL OR reverses_transaction_id <> id),

  CONSTRAINT chk_transaction_currency_format
    CHECK (currency ~ '^[A-Z]{3}$'),

  CONSTRAINT chk_transaction_approval_consistency
    CHECK (
      (approved = TRUE  AND approver_id IS NOT NULL) OR
      (approved = FALSE AND approver_id IS NULL)
    )
`;

export default Transaction;