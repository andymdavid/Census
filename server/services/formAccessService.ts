import { getFormById } from './formsService';
import { isWorkspaceMember } from './workspaceService';

export const getAccessibleFormForUser = (formId: string, pubkey: string) => {
  const form = getFormById(formId);
  if (!form) {
    return null;
  }

  if (!isWorkspaceMember(form.workspace_id, pubkey)) {
    return null;
  }

  return form;
};
