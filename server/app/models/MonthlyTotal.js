/**
const MonthlyTotal = `
  id INT AUTO_INCREMENT PRIMARY KEY, 
  business_id INT NOT NULL, 
  created_by INT NOT NULL, 
  narration TEXT NOT NULL, 
  amount BIGINT NOT NULL, 
  currency CHAR(3) NOT NULL, 
  approved BOOLEAN NOT NULL DEFAULT FALSE, 
  approver_id INT NULL, 
  month_in_review DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_monthly_total_business
    FOREIGN KEY (business_id)
    REFERENCES businesses(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_monthly_total_creator
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_monthly_total_approver
    FOREIGN KEY (approver_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT uq_monthly_total
    UNIQUE (business_id, month_in_review, currency)
`;

export default MonthlyTotal;
*/

const MonthlyTotal = `
  id SERIAL PRIMARY KEY,
  business_id INT NOT NULL,
  created_by INT NOT NULL,
  narration TEXT NOT NULL,
  amount BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  approver_id INT NULL,
  month_in_review DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_monthly_total_business
    FOREIGN KEY (business_id)
    REFERENCES businesses(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_monthly_total_creator
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_monthly_total_approver
    FOREIGN KEY (approver_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT uq_monthly_total
    UNIQUE (business_id, month_in_review, currency),

  CONSTRAINT chk_monthly_total_currency_format
    CHECK (currency ~ '^[A-Z]{3}$'),

  CONSTRAINT chk_monthly_total_month_normalized
    CHECK (EXTRACT(DAY FROM month_in_review) = 1),

  CONSTRAINT chk_monthly_total_approval_consistency
    CHECK (
      (approved = TRUE  AND approver_id IS NOT NULL) OR
      (approved = FALSE AND approver_id IS NULL)
    )
`;

export default MonthlyTotal;