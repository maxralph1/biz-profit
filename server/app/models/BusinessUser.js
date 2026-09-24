/**
const BusinessUser = `
  id INT AUTO_INCREMENT PRIMARY KEY, 
  business_id INT NOT NULL, 
  user_id INT NOT NULL, 
  role VARCHAR(50) NOT NULL DEFAULT 'member', 
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, 
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP, 

  CONSTRAINT fk_business_user_business
    FOREIGN KEY (business_id)
    REFERENCES businesses(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_business_user_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT uq_business_user
    UNIQUE (business_id, user_id)
`;

export default BusinessUser;
*/ 

/**
const BusinessUser = `
  id SERIAL PRIMARY KEY,
  business_id INT NOT NULL,
  user_id INT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_business_user_business
    FOREIGN KEY (business_id)
    REFERENCES businesses(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_business_user_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT uq_business_user
    UNIQUE (business_id, user_id)
`;

export default BusinessUser;
*/


const BusinessUser = `
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL, 
  user_id UUID NOT NULL, 
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_business_user_business
    FOREIGN KEY (business_id)
    REFERENCES businesses(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_business_user_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT uq_business_user
    UNIQUE (business_id, user_id),

  CONSTRAINT chk_business_users_role
    CHECK (role IN ('owner', 'admin', 'member'))
`;

export default BusinessUser;