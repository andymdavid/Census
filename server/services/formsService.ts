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
  `
  SELECT f.id, f.title, f.created_at, f.updated_at, f.published,
         (SELECT COUNT(*) FROM responses r WHERE r.form_id = f.id) as responses_count
  FROM forms f
  ORDER BY f.updated_at DESC
  `
);
const selectFormById = db.prepare(
  'SELECT id, title, schema_json, created_at, updated_at, published FROM forms WHERE id = ?'
);
const selectFormExists = db.prepare('SELECT 1 as exists_flag FROM forms WHERE id = ? LIMIT 1');
const updateForm = db.prepare(
  'UPDATE forms SET title = ?, schema_json = ?, updated_at = ? WHERE id = ?'
);
const publishForm = db.prepare(
  'UPDATE forms SET published = 1, updated_at = ? WHERE id = ?'
);

export const listForms = () => {
  return selectForms.all() as Array<
    Pick<FormRecord, 'id' | 'title' | 'created_at' | 'updated_at' | 'published'> & {
      responses_count: number;
    }
  >;
};

export const getFormById = (id: string) => {
  const row = selectFormById.get(id) as FormRecord | undefined;
  return row ?? null;
};

export const formExists = (id: string) => {
  const row = selectFormExists.get(id) as { exists_flag: number } | undefined;
  return Boolean(row?.exists_flag);
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
