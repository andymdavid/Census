import db from '../db';

export interface FormRecord {
  id: string;
  title: string;
  schema_json: string;
  created_at: number;
  updated_at: number;
  published: number;
}

const insertForm = db.prepare(
  'INSERT INTO forms (id, title, schema_json, created_at, updated_at, published) VALUES (?, ?, ?, ?, ?, ?)'
);
const selectForms = db.prepare(
  'SELECT id, title, created_at, updated_at, published FROM forms ORDER BY updated_at DESC'
);
const selectFormById = db.prepare(
  'SELECT id, title, schema_json, created_at, updated_at, published FROM forms WHERE id = ?'
);
const updateForm = db.prepare(
  'UPDATE forms SET title = ?, schema_json = ?, updated_at = ? WHERE id = ?'
);
const publishForm = db.prepare(
  'UPDATE forms SET published = 1, updated_at = ? WHERE id = ?'
);

export const listForms = () => {
  return selectForms.all() as Array<
    Pick<FormRecord, 'id' | 'title' | 'created_at' | 'updated_at' | 'published'>
  >;
};

export const getFormById = (id: string) => {
  const row = selectFormById.get(id) as FormRecord | undefined;
  return row ?? null;
};

export const createForm = (input: { title: string; schema: unknown }) => {
  const id = crypto.randomUUID();
  const now = Date.now();
  const schemaJson = JSON.stringify(input.schema ?? {});

  insertForm.run(id, input.title, schemaJson, now, now, 0);

  return { id, created_at: now, updated_at: now, published: 0 };
};

export const updateFormById = (id: string, input: { title: string; schema: unknown }) => {
  const now = Date.now();
  const schemaJson = JSON.stringify(input.schema ?? {});
  updateForm.run(input.title, schemaJson, now, id);
  return { updated_at: now };
};

export const publishFormById = (id: string) => {
  const now = Date.now();
  publishForm.run(now, id);
  return { updated_at: now, published: 1 };
};
