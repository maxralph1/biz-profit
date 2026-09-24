const AuthEvent = `
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL,
  event_type VARCHAR(50) NOT NULL,
  attempted_identifier TEXT,
  ip VARCHAR(45),
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_auth_events_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT chk_auth_events_type
    CHECK (event_type IN (
      'login_succeeded',
      'login_failed',
      'login_qa_challenge_issued',
      'login_qa_succeeded',
      'login_qa_failed',
      'refresh_succeeded',
      'refresh_failed',
      'signout',
      'verification_succeeded',
      'verification_failed',
      'password_reset_requested',
      'password_reset_completed'
    ))
`;

export default AuthEvent;