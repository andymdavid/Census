import { describe, expect, test } from 'bun:test';
import { handleFormsRoutes } from './routes/forms';
import { handleResponsesRoutes } from './routes/responses';
import { handleLeadsRoutes } from './routes/leads';
import { handleWorkspacesRoutes } from './routes/workspaces';
import { handleAiRoutes } from './routes/ai';
import { createOrganization } from './services/organizationService';
import { addWorkspaceMember, createWorkspace } from './services/workspaceService';
import { createForm } from './services/formsService';
import { createSession } from './services/sessionService';
import { createLead } from './services/leadsService';
import { createResponse } from './services/responsesService';

const createPubkey = () => {
  const raw = `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
  return raw.slice(0, 64);
};

const createAuthedRequest = (input: {
  url: string;
  method?: string;
  sessionId?: string;
  body?: unknown;
}) => {
  const headers: Record<string, string> = {};
  if (input.sessionId) {
    headers.cookie = `session_id=${input.sessionId}`;
  }
  if (input.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  return new Request(input.url, {
    method: input.method ?? 'GET',
    headers,
    body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
  });
};

const createValidSchema = () => ({
  version: 'v0' as const,
  id: 'test-form',
  title: 'Test Form',
  questions: [
    {
      id: 1,
      text: 'Question 1',
      weight: 1,
      category: 'Yes/No',
      settings: { answerType: 'yesno' as const },
      branching: { next: 2 },
    },
    {
      id: 2,
      text: 'Question 2',
      weight: 1,
      category: 'Yes/No',
      settings: { answerType: 'yesno' as const },
    },
  ],
  results: [{ label: 'Default', description: 'Default result' }],
});

const createOwnedWorkspaceContext = () => {
  const pubkey = createPubkey();
  const organization = createOrganization(`Org ${crypto.randomUUID()}`, pubkey);
  const workspace = createWorkspace(`Workspace ${crypto.randomUUID()}`, pubkey, organization.id);
  const session = createSession(pubkey);

  return {
    pubkey,
    organizationId: organization.id,
    workspaceId: workspace.id,
    sessionId: session.id,
  };
};

describe('API routes', () => {
  test('rejects unauthenticated AI form spec generation requests', async () => {
    const response = await handleAiRoutes(
      createAuthedRequest({
        url: 'http://localhost/api/ai/forms/spec',
        method: 'POST',
        body: { brief: '# Build a form' },
      })
    );

    expect(response.status).toBe(401);
  });

  test('generates an AI form spec and compiled schema from a brief', async () => {
    const owner = createOwnedWorkspaceContext();
    const originalApiKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-key';

    const originalFetch = global.fetch;
    global.fetch = (async () =>
      new Response(
        JSON.stringify({
          model: 'openai/gpt-4.1-mini',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  version: 'v1',
                  title: 'AI Qualification Form',
                  steps: [
                    {
                      stepRef: 'welcome',
                      title: 'Welcome',
                      kind: 'welcome',
                      weight: 0,
                      defaultGoToStepRef: 'q1',
                    },
                    {
                      stepRef: 'q1',
                      title: 'Do you have budget approval?',
                      kind: 'yesno',
                      weight: 5,
                      branchConditions: [
                        { answer: true, goToStepRef: 'end' },
                        { answer: false, goToStepRef: 'end' },
                      ],
                    },
                    {
                      stepRef: 'end',
                      title: 'Thanks',
                      kind: 'end',
                      weight: 0,
                    },
                  ],
                  results: [{ label: 'Done', description: 'Done' }],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    try {
      const response = await handleAiRoutes(
        createAuthedRequest({
          url: 'http://localhost/api/ai/forms/spec',
          method: 'POST',
          sessionId: owner.sessionId,
          body: { brief: '# Build a qualification form' },
        })
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        model?: string;
        spec?: { title?: string };
        schema?: { version?: string; questions?: Array<{ id: number; category: string }> };
      };

      expect(data.model).toBe('openai/gpt-4.1-mini');
      expect(data.spec?.title).toBe('AI Qualification Form');
      expect(data.schema?.version).toBe('v0');
      expect(data.schema?.questions?.[0]).toMatchObject({ id: 1, category: 'Welcome Screen' });
    } finally {
      global.fetch = originalFetch;
      if (originalApiKey === undefined) {
        delete process.env.OPENROUTER_API_KEY;
      } else {
        process.env.OPENROUTER_API_KEY = originalApiKey;
      }
    }
  });

  test('creates an AI-generated draft form in an accessible workspace', async () => {
    const owner = createOwnedWorkspaceContext();
    const originalApiKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-key';

    const originalFetch = global.fetch;
    global.fetch = (async () =>
      new Response(
        JSON.stringify({
          model: 'openai/gpt-4.1-mini',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  version: 'v1',
                  title: 'AI Draft Form',
                  steps: [
                    {
                      stepRef: 'q1',
                      title: 'Do you need support?',
                      kind: 'yesno',
                      weight: 2,
                    },
                  ],
                  results: [{ label: 'Default', description: 'Default' }],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    try {
      const response = await handleAiRoutes(
        createAuthedRequest({
          url: 'http://localhost/api/ai/forms/draft',
          method: 'POST',
          sessionId: owner.sessionId,
          body: { brief: '# Build a support form', workspaceId: owner.workspaceId },
        })
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as { id?: string; schema?: { title?: string } };
      expect(data.id).toBeTruthy();
      expect(data.schema?.title).toBe('AI Draft Form');
    } finally {
      global.fetch = originalFetch;
      if (originalApiKey === undefined) {
        delete process.env.OPENROUTER_API_KEY;
      } else {
        process.env.OPENROUTER_API_KEY = originalApiKey;
      }
    }
  });

  test('repairs an invalid first-pass AI spec once and returns the corrected result', async () => {
    const owner = createOwnedWorkspaceContext();
    const originalApiKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-key';

    const originalFetch = global.fetch;
    let callCount = 0;
    global.fetch = (async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({
            model: 'openai/gpt-4.1-mini',
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    version: 'v1',
                    title: 'Broken Spec',
                    steps: [
                      {
                        stepRef: 'q1',
                        title: 'Pick one',
                        kind: 'multiple',
                        choices: [],
                      },
                    ],
                    results: [{ label: 'Default', description: 'Default' }],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          model: 'openai/gpt-4.1-mini',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  version: 'v1',
                  title: 'Recovered Spec',
                  steps: [
                    {
                      stepRef: 'q1',
                      title: 'Pick one',
                      kind: 'multiple',
                      choices: ['Alpha', 'Beta'],
                      weight: 1,
                    },
                  ],
                  results: [{ label: 'Default', description: 'Default' }],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    try {
      const response = await handleAiRoutes(
        createAuthedRequest({
          url: 'http://localhost/api/ai/forms/spec',
          method: 'POST',
          sessionId: owner.sessionId,
          body: { brief: '# Build a multiple-choice form' },
        })
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as { repaired?: boolean; spec?: { title?: string } };
      expect(callCount).toBe(2);
      expect(data.repaired).toBe(true);
      expect(data.spec?.title).toBe('Recovered Spec');
    } finally {
      global.fetch = originalFetch;
      if (originalApiKey === undefined) {
        delete process.env.OPENROUTER_API_KEY;
      } else {
        process.env.OPENROUTER_API_KEY = originalApiKey;
      }
    }
  });

  test('rejects invalid schemas on form create and update', async () => {
    const owner = createOwnedWorkspaceContext();
    const invalidSchema = {
      version: 'v0',
      id: 'invalid-form',
      title: 'Invalid',
      questions: [
        { id: 1, text: 'A', weight: 1, category: 'Yes/No' },
        { id: 1, text: 'B', weight: 1, category: 'Yes/No' },
      ],
      results: [{ label: 'Default', description: 'Default result' }],
    };

    const createResponse = await handleFormsRoutes(
      createAuthedRequest({
        url: 'http://localhost/api/forms',
        method: 'POST',
        sessionId: owner.sessionId,
        body: {
          title: 'Invalid Form',
          workspaceId: owner.workspaceId,
          schema: invalidSchema,
        },
      })
    );

    expect(createResponse.status).toBe(400);

    const created = createForm({
      title: 'Valid Form',
      workspaceId: owner.workspaceId,
      schema: createValidSchema(),
    });

    const updateResponse = await handleFormsRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${created.id}`,
        method: 'PUT',
        sessionId: owner.sessionId,
        body: {
          title: 'Still Invalid',
          schema: invalidSchema,
        },
      })
    );

    expect(updateResponse.status).toBe(400);
  });

  test('rejects invalid response submissions against the saved form schema', async () => {
    const owner = createOwnedWorkspaceContext();
    const form = createForm({
      title: 'Email Form',
      workspaceId: owner.workspaceId,
      schema: {
        version: 'v0' as const,
        id: 'email-form',
        title: 'Email Form',
        questions: [
          {
            id: 1,
            text: 'Email',
            weight: 1,
            category: 'Email',
            settings: { answerType: 'email' as const },
          },
        ],
        results: [{ label: 'Default', description: 'Default result' }],
      },
    });

    const response = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses`,
        method: 'POST',
        body: {
          answers: [{ questionId: '1', answer: 'not-an-email' }],
          score: 1,
          completed: false,
          meta: {
            visitedQuestionIds: [1],
            lastQuestionId: 1,
            completed: false,
          },
        },
      })
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as { details?: string[] };
    expect(data.details).toContain('Question 1 has an invalid answer value.');
  });

  test('rejects response submissions whose score does not match the answers', async () => {
    const owner = createOwnedWorkspaceContext();
    const form = createForm({
      title: 'Score Form',
      workspaceId: owner.workspaceId,
      schema: {
        version: 'v0' as const,
        id: 'score-form',
        title: 'Score Form',
        questions: [
          {
            id: 1,
            text: 'Question',
            weight: 5,
            category: 'Yes/No',
            settings: { answerType: 'yesno' as const },
          },
          {
            id: 2,
            text: 'Done',
            weight: 0,
            category: 'End Screen',
            settings: { kind: 'end' as const },
          },
        ],
        results: [{ label: 'Default', description: 'Default result' }],
      },
    });

    const response = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses`,
        method: 'POST',
        body: {
          answers: [{ questionId: '1', answer: 'no' }],
          score: 5,
          completed: true,
          meta: {
            visitedQuestionIds: [1],
            lastQuestionId: 1,
            completed: true,
          },
        },
      })
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as { details?: string[] };
    expect(data.details).toContain('Score does not match answers. Expected 0.');
  });

  test('blocks unrelated users from reading analytics and leads', async () => {
    const owner = createOwnedWorkspaceContext();
    const outsider = createOwnedWorkspaceContext();
    const form = createForm({
      title: 'Owned Form',
      workspaceId: owner.workspaceId,
      schema: createValidSchema(),
    });

    const createdResponse = createResponse({
      formId: form.id,
      score: 2,
      answers: [
        { questionId: '1', answer: 'yes' },
        { questionId: '2', answer: 'yes' },
      ],
      completed: true,
      meta: {
        visitedQuestionIds: [1, 2],
        lastQuestionId: 2,
        completed: true,
      },
    });
    createLead({
      formId: form.id,
      responseId: createdResponse.id,
      name: 'Lead User',
      email: 'lead@example.com',
    });

    const summaryResponse = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses/summary`,
        sessionId: outsider.sessionId,
      })
    );
    const leadsResponse = await handleLeadsRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/leads`,
        sessionId: outsider.sessionId,
      })
    );

    expect(summaryResponse.status).toBe(404);
    expect(leadsResponse.status).toBe(404);
  });

  test('upserts draft responses and counts a single start through completion', async () => {
    const owner = createOwnedWorkspaceContext();
    const form = createForm({
      title: 'Progress Form',
      workspaceId: owner.workspaceId,
      schema: {
        version: 'v0' as const,
        id: 'progress-form',
        title: 'Progress Form',
        questions: [
          {
            id: 1,
            text: 'Question 1',
            weight: 1,
            category: 'Yes/No',
            settings: { answerType: 'yesno' as const },
            branching: { next: 2 },
          },
          {
            id: 2,
            text: 'Question 2',
            weight: 1,
            category: 'Yes/No',
            settings: { answerType: 'yesno' as const },
            branching: { next: 3 },
          },
          {
            id: 3,
            text: 'Question 3',
            weight: 1,
            category: 'Yes/No',
            settings: { answerType: 'yesno' as const },
          },
        ],
        results: [{ label: 'Default', description: 'Default result' }],
      },
    });

    const draftResponse = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses`,
        method: 'POST',
        body: {
          answers: [{ questionId: '1', answer: 'yes' }],
          score: 1,
          completed: false,
          meta: {
            visitedQuestionIds: [1, 2],
            lastQuestionId: 2,
            completed: false,
          },
        },
      })
    );

    expect(draftResponse.status).toBe(200);
    const draftData = (await draftResponse.json()) as { id: string };

    const funnelAfterDraft = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses/funnel`,
        sessionId: owner.sessionId,
      })
    );
    const draftFunnel = (await funnelAfterDraft.json()) as {
      totalStarts: number;
      completions: number;
    };

    expect(draftFunnel.totalStarts).toBe(1);
    expect(draftFunnel.completions).toBe(0);

    const finalResponse = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses`,
        method: 'POST',
        body: {
          responseId: draftData.id,
          answers: [
            { questionId: '1', answer: 'yes' },
            { questionId: '2', answer: 'yes' },
            { questionId: '3', answer: 'yes' },
          ],
          score: 3,
          completed: true,
          meta: {
            visitedQuestionIds: [1, 2, 3],
            lastQuestionId: 3,
            completed: true,
          },
        },
      })
    );

    expect(finalResponse.status).toBe(200);
    const finalData = (await finalResponse.json()) as { id: string };
    expect(finalData.id).toBe(draftData.id);

    const funnelAfterComplete = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses/funnel`,
        sessionId: owner.sessionId,
      })
    );
    const completeFunnel = (await funnelAfterComplete.json()) as {
      totalStarts: number;
      completions: number;
    };

    expect(completeFunnel.totalStarts).toBe(1);
    expect(completeFunnel.completions).toBe(1);
  });

  test('allows only workspace owners to rename and invite members', async () => {
    const owner = createOwnedWorkspaceContext();
    const memberPubkey = createPubkey();
    const memberSession = createSession(memberPubkey);
    addWorkspaceMember(owner.workspaceId, memberPubkey);

    const renameAsMember = await handleWorkspacesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/workspaces/${owner.workspaceId}`,
        method: 'PUT',
        sessionId: memberSession.id,
        body: { name: 'Renamed by member' },
      })
    );
    expect(renameAsMember.status).toBe(403);

    const inviteAsMember = await handleWorkspacesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/workspaces/${owner.workspaceId}/invite`,
        method: 'POST',
        sessionId: memberSession.id,
        body: { pubkey: createPubkey() },
      })
    );
    expect(inviteAsMember.status).toBe(403);

    const renameAsOwner = await handleWorkspacesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/workspaces/${owner.workspaceId}`,
        method: 'PUT',
        sessionId: owner.sessionId,
        body: { name: 'Owner rename' },
      })
    );
    expect(renameAsOwner.status).toBe(200);

    const inviteAsOwner = await handleWorkspacesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/workspaces/${owner.workspaceId}/invite`,
        method: 'POST',
        sessionId: owner.sessionId,
        body: { pubkey: createPubkey() },
      })
    );
    expect(inviteAsOwner.status).toBe(200);
  });
});
