import validate from '../../../utils/validation/validate.js';

export default function updateBusinessRequest(reqBody) {
  const UPDATE_BUSINESS_SCHEMA = {
    name: { type: 'string', max: 255 },
    description: { type: 'string' },
  };

  return validate(reqBody, UPDATE_BUSINESS_SCHEMA);
}

export const BUSINESS_FK_VIOLATIONS = {
  fk_business_user_business:   'Cannot delete business: it has members.',
  fk_transaction_type_business: 'Cannot delete business: it has transaction types.',
  fk_transaction_business:      'Cannot delete business: it has transactions.',
  fk_monthly_total_business:    'Cannot delete business: it has monthly totals.',
};