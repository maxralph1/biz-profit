const AuditEvent = `
  id SERIAL PRIMARY KEY,
  actor_id INT NOT NULL,
  subject_type VARCHAR(50) NOT NULL,
  subject_id INT NOT NULL,
  business_id INT NULL,
  action VARCHAR(50) NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_audit_events_actor
    FOREIGN KEY (actor_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_audit_events_business
    FOREIGN KEY (business_id)
    REFERENCES businesses(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT chk_audit_events_subject_type
    CHECK (subject_type IN (
      'user', 'business', 'business_user',
      'transaction_type', 'transaction', 'monthly_total'
    ))
`;

export default AuditEvent;