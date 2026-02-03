import db from '../db';

export interface LeadRecord {
  id: string;
  form_id: string;
  response_id: string | null;
  name: string;
  email: string;
  company: string | null;
  created_at: number;
}

const insertLead = db.prepare(
  'INSERT INTO leads (id, form_id, response_id, name, email, company, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const selectLeads = db.prepare(
  'SELECT id, form_id, response_id, name, email, company, created_at FROM leads WHERE form_id = ? ORDER BY created_at DESC LIMIT ?'
);

export const createLead = (input: {
  formId: string;
  responseId?: string | null;
  name: string;
  email: string;
  company?: string | null;
}) => {
  const now = Date.now();
  const id = crypto.randomUUID();
  insertLead.run(
    id,
    input.formId,
    input.responseId ?? null,
    input.name,
    input.email,
    input.company ?? null,
    now
  );
  return { id, created_at: now };
};

export const listLeads = (formId: string, limit = 50) => {
  return selectLeads.all(formId, limit) as LeadRecord[];
};
