import { describe, expect, test } from 'bun:test';
import { handleFormsRoutes } from './routes/forms';
import { handleResponsesRoutes } from './routes/responses';
import { handleLeadsRoutes } from './routes/leads';
import { handleWorkspacesRoutes } from './routes/workspaces';
import { handleOrganizationsRoutes } from './routes/organizations';
import { handleAiRoutes } from './routes/ai';
import { addOrganizationMember, createOrganization } from './services/organizationService';
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

  test('uses organization admin settings as the default AI model for a workspace', async () => {
    const owner = createOwnedWorkspaceContext();
    const settingsResponse = await handleOrganizationsRoutes(
      createAuthedRequest({
        url: `http://localhost/api/organizations/${owner.organizationId}/settings`,
        method: 'PUT',
        sessionId: owner.sessionId,
        body: {
          name: 'Org Admin',
          aiEnabled: true,
          aiDefaultModel: 'openai/gpt-5-mini',
        },
      })
    );
    expect(settingsResponse.status).toBe(200);

    const originalApiKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-key';

    const originalFetch = global.fetch;
    let capturedModel: string | null = null;
    global.fetch = (async (_input, init) => {
      if (init?.body && typeof init.body === 'string') {
        capturedModel = (JSON.parse(init.body) as { model?: string }).model ?? null;
      }
      return new Response(
        JSON.stringify({
          model: capturedModel,
          choices: [
            {
              message: {
                content: JSON.stringify({
                  version: 'v1',
                  title: 'AI Qualification Form',
                  steps: [
                    {
                      stepRef: 'q1',
                      title: 'Do you have budget approval?',
                      kind: 'yesno',
                      weight: 5,
                    },
                  ],
                  results: [{ label: 'Done', description: 'Done' }],
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
          body: { brief: '# Build a qualification form', workspaceId: owner.workspaceId },
        })
      );

      expect(response.status).toBe(200);
      expect(capturedModel).toBe('openai/gpt-5-mini');
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
        scoringEnabled: true,
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

  test('filters response review lists by completed and in-progress status', async () => {
    const owner = createOwnedWorkspaceContext();
    const form = createForm({
      title: 'Draft Review Form',
      workspaceId: owner.workspaceId,
      schema: {
        version: 'v0',
        id: 'draft-review-form',
        title: 'Draft Review Form',
        questions: [
          {
            id: 1,
            text: 'Submitter name',
            weight: 1,
            category: 'Short Text',
            settings: { answerType: 'short' as const },
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
      },
    });

    await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses`,
        method: 'POST',
        body: {
          answers: [{ questionId: '1', answer: 'Alice' }],
          score: 0,
          completed: false,
          meta: {
            visitedQuestionIds: [1],
            lastQuestionId: 1,
            completed: false,
          },
        },
      })
    );

    await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses`,
        method: 'POST',
        body: {
          answers: [
            { questionId: '1', answer: 'Bob' },
            { questionId: '2', answer: 'yes' },
          ],
          score: 0,
          completed: true,
          meta: {
            visitedQuestionIds: [1, 2],
            lastQuestionId: 2,
            completed: true,
          },
        },
      })
    );

    const inProgressResponse = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses/review?status=in_progress`,
        sessionId: owner.sessionId,
      })
    );
    expect(inProgressResponse.status).toBe(200);
    const inProgressData = (await inProgressResponse.json()) as { responses: Array<{ completed: boolean }> };
    expect(inProgressData.responses).toHaveLength(1);
    expect(inProgressData.responses[0]?.completed).toBe(false);

    const allResponse = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses/review?status=all`,
        sessionId: owner.sessionId,
      })
    );
    expect(allResponse.status).toBe(200);
    const allData = (await allResponse.json()) as { responses: Array<{ completed: boolean }> };
    expect(allData.responses).toHaveLength(2);
    expect(allData.responses.some((response) => response.completed === false)).toBe(true);
    expect(allData.responses.some((response) => response.completed === true)).toBe(true);
  });

  test('includes an empty started draft in the in-progress review list', async () => {
    const owner = createOwnedWorkspaceContext();
    const form = createForm({
      title: 'Started Form',
      workspaceId: owner.workspaceId,
      schema: {
        version: 'v0' as const,
        id: 'started-form',
        title: 'Started Form',
        questions: [
          {
            id: 1,
            text: 'Question 1',
            weight: 1,
            category: 'Short Text',
            settings: { answerType: 'short' as const },
          },
        ],
        results: [{ label: 'Default', description: 'Default result' }],
      },
    });

    const startResponse = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses`,
        method: 'POST',
        body: {
          answers: [],
          score: 0,
          completed: false,
          meta: {
            visitedQuestionIds: [1],
            lastQuestionId: 1,
            completed: false,
          },
        },
      })
    );

    expect(startResponse.status).toBe(200);

    const inProgressResponse = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses/review?status=in_progress`,
        sessionId: owner.sessionId,
      })
    );
    expect(inProgressResponse.status).toBe(200);

    const data = (await inProgressResponse.json()) as {
      responses: Array<{ completed: boolean; answerCount: number; submitterName: string }>;
    };

    expect(data.responses).toHaveLength(1);
    expect(data.responses[0]?.completed).toBe(false);
    expect(data.responses[0]?.answerCount).toBe(0);
    expect(data.responses[0]?.submitterName).toBe('Anonymous response');
  });

  test('deleting an in-progress response invalidates its draft token for local reset', async () => {
    const owner = createOwnedWorkspaceContext();
    const form = createForm({
      title: 'Resettable Draft Form',
      workspaceId: owner.workspaceId,
      schema: {
        version: 'v0' as const,
        id: 'resettable-draft-form',
        title: 'Resettable Draft Form',
        questions: [
          {
            id: 1,
            text: "What's your name?",
            weight: 0,
            category: 'Short Text',
            settings: { answerType: 'short' as const },
          },
        ],
        results: [{ label: 'Default', description: 'Default result' }],
      },
    });

    const draftToken = 'draft-token-123';
    const createDraftResponse = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses`,
        method: 'POST',
        body: {
          answers: [{ questionId: '1', answer: 'Ada Lovelace' }],
          score: 0,
          completed: false,
          meta: {
            visitedQuestionIds: [1],
            lastQuestionId: 1,
            completed: false,
            draftToken,
          },
        },
      })
    );

    expect(createDraftResponse.status).toBe(200);
    const created = (await createDraftResponse.json()) as { id: string };

    const statusBeforeDelete = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses/draft-status?responseId=${created.id}&draftToken=${draftToken}`,
      })
    );
    expect(statusBeforeDelete.status).toBe(200);
    expect((await statusBeforeDelete.json()) as { resetRequired: boolean }).toEqual({
      resetRequired: false,
    });

    const deleteResult = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses/${created.id}`,
        method: 'DELETE',
        sessionId: owner.sessionId,
      })
    );
    expect(deleteResult.status).toBe(200);

    const statusAfterDelete = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses/draft-status?responseId=${created.id}&draftToken=${draftToken}`,
      })
    );
    expect(statusAfterDelete.status).toBe(200);
    expect((await statusAfterDelete.json()) as { resetRequired: boolean }).toEqual({
      resetRequired: true,
    });
  });

  test('returns resumable draft state by draft token', async () => {
    const owner = createOwnedWorkspaceContext();
    const form = createForm({
      title: 'Resume Draft Form',
      workspaceId: owner.workspaceId,
      schema: {
        version: 'v0' as const,
        id: 'resume-draft-form',
        title: 'Resume Draft Form',
        questions: [
          {
            id: 1,
            text: 'Question 1',
            weight: 0,
            category: 'Short Text',
            settings: { answerType: 'short' as const },
          },
          {
            id: 2,
            text: 'Question 2',
            weight: 0,
            category: 'Yes/No',
            settings: { answerType: 'yesno' as const },
          },
        ],
        results: [{ label: 'Default', description: 'Default result' }],
      },
    });

    const draftToken = 'resume-token-123';
    const createDraftResponse = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses`,
        method: 'POST',
        body: {
          answers: [
            { questionId: '1', answer: 'Ada Lovelace' },
            { questionId: '2', answer: 'yes' },
          ],
          score: 0,
          completed: false,
          meta: {
            visitedQuestionIds: [1, 2],
            lastQuestionId: 2,
            completed: false,
            draftToken,
          },
        },
      })
    );
    expect(createDraftResponse.status).toBe(200);
    const created = (await createDraftResponse.json()) as { id: string };

    const resumeResponse = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses/draft-resume?draftToken=${draftToken}`,
      })
    );
    expect(resumeResponse.status).toBe(200);
    const data = (await resumeResponse.json()) as {
      draft: {
        responseId: string;
        draftToken: string;
        currentQuestionId: number;
        history: number[];
        showWelcome: boolean;
        answers: Record<string, boolean | string | string[]>;
      } | null;
    };
    expect(data.draft).not.toBeNull();
    expect(data.draft?.responseId).toBe(created.id);
    expect(data.draft?.draftToken).toBe(draftToken);
    expect(data.draft?.currentQuestionId).toBe(2);
    expect(data.draft?.history).toEqual([1]);
    expect(data.draft?.showWelcome).toBe(false);
    expect(data.draft?.answers['1']).toBe('Ada Lovelace');
    expect(data.draft?.answers['2']).toBe(true);
  });

  test('prefers the exact name question when inferring submitter name in review lists', async () => {
    const owner = createOwnedWorkspaceContext();
    const form = createForm({
      title: 'Name Priority Form',
      workspaceId: owner.workspaceId,
      schema: {
        version: 'v0' as const,
        id: 'name-priority-form',
        title: 'Name Priority Form',
        questions: [
          {
            id: 1,
            text: 'Process Name',
            weight: 0,
            category: 'Short Text',
            settings: { answerType: 'short' as const },
          },
          {
            id: 2,
            text: "What's your name?",
            weight: 0,
            category: 'Short Text',
            settings: { answerType: 'short' as const },
          },
        ],
        results: [{ label: 'Default', description: 'Default result' }],
      },
    });

    await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses`,
        method: 'POST',
        body: {
          answers: [
            { questionId: '1', answer: 'LinkedIn Ad Campaigns' },
            { questionId: '2', answer: 'Ada Lovelace' },
          ],
          score: 0,
          completed: false,
          meta: {
            visitedQuestionIds: [1, 2],
            lastQuestionId: 2,
            completed: false,
          },
        },
      })
    );

    const reviewResponse = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses/review?status=in_progress`,
        sessionId: owner.sessionId,
      })
    );
    expect(reviewResponse.status).toBe(200);
    const data = (await reviewResponse.json()) as {
      responses: Array<{ submitterName: string }>;
    };
    expect(data.responses[0]?.submitterName).toBe('Ada Lovelace');
  });

  test('creates a new response when a stale completed response id is reused', async () => {
    const owner = createOwnedWorkspaceContext();
    const form = createForm({
      title: 'Repeatable Form',
      workspaceId: owner.workspaceId,
      schema: {
        version: 'v0' as const,
        id: 'repeatable-form',
        title: 'Repeatable Form',
        scoringEnabled: true,
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
      },
    });

    const firstResponse = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses`,
        method: 'POST',
        body: {
          answers: [
            { questionId: '1', answer: 'yes' },
            { questionId: '2', answer: 'yes' },
          ],
          score: 2,
          completed: true,
          meta: {
            visitedQuestionIds: [1, 2],
            lastQuestionId: 2,
            completed: true,
          },
        },
      })
    );

    expect(firstResponse.status).toBe(200);
    const firstData = (await firstResponse.json()) as { id: string };

    const secondResponse = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses`,
        method: 'POST',
        body: {
          responseId: firstData.id,
          answers: [
            { questionId: '1', answer: 'no' },
            { questionId: '2', answer: 'yes' },
          ],
          score: 1,
          completed: true,
          meta: {
            visitedQuestionIds: [1, 2],
            lastQuestionId: 2,
            completed: true,
          },
        },
      })
    );

    expect(secondResponse.status).toBe(200);
    const secondData = (await secondResponse.json()) as { id: string };
    expect(secondData.id).not.toBe(firstData.id);

    const funnelResponse = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses/funnel`,
        sessionId: owner.sessionId,
      })
    );
    const funnel = (await funnelResponse.json()) as {
      totalStarts: number;
      completions: number;
    };

    expect(funnel.totalStarts).toBe(2);
    expect(funnel.completions).toBe(2);
  });

  test('returns reviewable response summaries and ordered answer details', async () => {
    const owner = createOwnedWorkspaceContext();
    const form = createForm({
      title: 'Review Form',
      workspaceId: owner.workspaceId,
      schema: {
        version: 'v0' as const,
        id: 'review-form',
        title: 'Review Form',
        scoringEnabled: false,
        questions: [
          {
            id: 1,
            text: 'Welcome',
            weight: 0,
            category: 'Welcome Screen',
            settings: { kind: 'welcome' as const },
          },
          {
            id: 2,
            text: 'Submitter Details',
            weight: 0,
            category: 'Question Group',
            settings: { kind: 'group' as const },
          },
          {
            id: 3,
            text: 'Submitter Name',
            weight: 0,
            category: 'Text',
            settings: { answerType: 'long' as const },
          },
          {
            id: 4,
            text: 'Process Details',
            weight: 0,
            category: 'Question Group',
            settings: { kind: 'group' as const },
          },
          {
            id: 5,
            text: 'Process Name',
            weight: 0,
            category: 'Text',
            settings: { answerType: 'long' as const },
          },
        ],
        results: [],
      },
    });

    const response = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses`,
        method: 'POST',
        body: {
          answers: [
            { questionId: '3', answer: 'Ada Lovelace' },
            { questionId: '5', answer: 'Invoice matching' },
          ],
          score: 0,
          completed: true,
          meta: {
            visitedQuestionIds: [2, 3, 4, 5],
            lastQuestionId: 5,
            completed: true,
          },
        },
      })
    );

    expect(response.status).toBe(200);
    const responseData = (await response.json()) as { id: string };

    const listResponse = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses/review`,
        sessionId: owner.sessionId,
      })
    );

    expect(listResponse.status).toBe(200);
    const listData = (await listResponse.json()) as {
      responses: Array<{ id: string; submitterName: string; answerCount: number }>;
    };
    expect(listData.responses[0]).toMatchObject({
      id: responseData.id,
      submitterName: 'Ada Lovelace',
      answerCount: 2,
    });

    const detailResponse = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses/review/${responseData.id}`,
        sessionId: owner.sessionId,
      })
    );

    expect(detailResponse.status).toBe(200);
    const detailData = (await detailResponse.json()) as {
      response: {
        submitterName: string;
        sections: Array<{ title: string; answers: Array<{ question: string; answer: string }> }>;
      };
    };

    expect(detailData.response.submitterName).toBe('Ada Lovelace');
    expect(detailData.response.sections).toEqual([
      {
        title: 'Submitter Details',
        answers: [{ questionId: 3, question: 'Submitter Name', answer: 'Ada Lovelace' }],
      },
      {
        title: 'Process Details',
        answers: [{ questionId: 5, question: 'Process Name', answer: 'Invoice matching' }],
      },
    ]);
  });

  test('deletes a completed response and removes it from review lists', async () => {
    const owner = createOwnedWorkspaceContext();
    const form = createForm({
      workspaceId: owner.workspaceId,
      title: 'Response Delete Form',
      schema: {
        version: 'v0',
        id: 'response-delete-form',
        title: 'Response Delete Form',
        description: '',
        questions: [
          {
            id: 1,
            text: 'Submitter Name',
            weight: 0,
            category: 'Text',
            settings: { answerType: 'short' as const },
          },
          {
            id: 2,
            text: 'Process Name',
            weight: 0,
            category: 'Text',
            settings: { answerType: 'long' as const },
          },
        ],
        results: [],
      },
    });

    const createResponseResult = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses`,
        method: 'POST',
        body: {
          answers: [
            { questionId: '1', answer: 'Grace Hopper' },
            { questionId: '2', answer: 'Quarterly planning' },
          ],
          score: 0,
          completed: true,
          meta: {
            visitedQuestionIds: [1, 2],
            lastQuestionId: 2,
            completed: true,
          },
        },
      })
    );

    expect(createResponseResult.status).toBe(200);
    const createdResponse = (await createResponseResult.json()) as { id: string };

    const deleteResult = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses/${createdResponse.id}`,
        method: 'DELETE',
        sessionId: owner.sessionId,
      })
    );

    expect(deleteResult.status).toBe(200);

    const listAfterDelete = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses/review`,
        sessionId: owner.sessionId,
      })
    );

    expect(listAfterDelete.status).toBe(200);
    const listData = (await listAfterDelete.json()) as {
      responses: Array<{ id: string }>;
    };
    expect(listData.responses).toEqual([]);

    const detailAfterDelete = await handleResponsesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/forms/${form.id}/responses/review/${createdResponse.id}`,
        sessionId: owner.sessionId,
      })
    );

    expect(detailAfterDelete.status).toBe(404);
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

  test('allows only organization owners to invite organization members', async () => {
    const owner = createOwnedWorkspaceContext();
    const memberPubkey = createPubkey();
    const memberSession = createSession(memberPubkey);

    const inviteAsMember = await handleOrganizationsRoutes(
      createAuthedRequest({
        url: `http://localhost/api/organizations/${owner.organizationId}/invite`,
        method: 'POST',
        sessionId: memberSession.id,
        body: { pubkey: createPubkey() },
      })
    );
    expect(inviteAsMember.status).toBe(404);

    const invitedPubkey = createPubkey();
    const inviteAsOwner = await handleOrganizationsRoutes(
      createAuthedRequest({
        url: `http://localhost/api/organizations/${owner.organizationId}/invite`,
        method: 'POST',
        sessionId: owner.sessionId,
        body: { pubkey: invitedPubkey },
      })
    );
    expect(inviteAsOwner.status).toBe(200);

    const membersResponse = await handleOrganizationsRoutes(
      createAuthedRequest({
        url: `http://localhost/api/organizations/${owner.organizationId}/members`,
        sessionId: owner.sessionId,
      })
    );
    expect(membersResponse.status).toBe(200);
    const membersData = (await membersResponse.json()) as {
      members: Array<{ pubkey: string; role: string }>;
    };
    expect(membersData.members.some((member) => member.pubkey === invitedPubkey)).toBe(true);
  });

  test('allows organization members to read admin settings and only owners to update them', async () => {
    const owner = createOwnedWorkspaceContext();
    const memberPubkey = createPubkey();
    addOrganizationMember(owner.organizationId, memberPubkey);
    const memberSession = createSession(memberPubkey);

    const readAsMember = await handleOrganizationsRoutes(
      createAuthedRequest({
        url: `http://localhost/api/organizations/${owner.organizationId}/settings`,
        sessionId: memberSession.id,
      })
    );
    expect(readAsMember.status).toBe(200);

    const updateAsMember = await handleOrganizationsRoutes(
      createAuthedRequest({
        url: `http://localhost/api/organizations/${owner.organizationId}/settings`,
        method: 'PUT',
        sessionId: memberSession.id,
        body: {
          name: 'Blocked Update',
          aiEnabled: false,
        },
      })
    );
    expect(updateAsMember.status).toBe(403);

    const updateAsOwner = await handleOrganizationsRoutes(
      createAuthedRequest({
        url: `http://localhost/api/organizations/${owner.organizationId}/settings`,
        method: 'PUT',
        sessionId: owner.sessionId,
        body: {
          name: 'Configured Org',
          aiEnabled: false,
          aiDefaultModel: 'openai/gpt-5-mini',
          brandLogoUrl: 'https://example.com/logo.png',
          brandPrimaryColor: '#123456',
          brandBackgroundColor: '#f5f6fa',
          brandTextColor: '#111827',
        },
      })
    );
    expect(updateAsOwner.status).toBe(200);
    const ownerData = (await updateAsOwner.json()) as {
      organization: { name: string };
      settings: { aiEnabled: boolean; aiDefaultModel: string | null; brandLogoUrl: string | null };
    };
    expect(ownerData.organization.name).toBe('Configured Org');
    expect(ownerData.settings.aiEnabled).toBe(false);
    expect(ownerData.settings.aiDefaultModel).toBe('openai/gpt-5-mini');
    expect(ownerData.settings.brandLogoUrl).toBe('https://example.com/logo.png');
  });

  test('workspace invite also grants organization membership so the workspace is discoverable', async () => {
    const owner = createOwnedWorkspaceContext();
    const invitedPubkey = createPubkey();
    const invitedSession = createSession(invitedPubkey);

    const inviteResponse = await handleWorkspacesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/workspaces/${owner.workspaceId}/invite`,
        method: 'POST',
        sessionId: owner.sessionId,
        body: { pubkey: invitedPubkey },
      })
    );
    expect(inviteResponse.status).toBe(200);

    const organizationsResponse = await handleOrganizationsRoutes(
      createAuthedRequest({
        url: 'http://localhost/api/organizations',
        sessionId: invitedSession.id,
      })
    );
    expect(organizationsResponse.status).toBe(200);
    const organizationsData = (await organizationsResponse.json()) as {
      organizations: Array<{ id: string }>;
    };
    expect(organizationsData.organizations.map((organization) => organization.id)).toContain(
      owner.organizationId
    );

    const workspacesResponse = await handleWorkspacesRoutes(
      createAuthedRequest({
        url: `http://localhost/api/workspaces?orgId=${owner.organizationId}`,
        sessionId: invitedSession.id,
      })
    );
    expect(workspacesResponse.status).toBe(200);
    const workspacesData = (await workspacesResponse.json()) as {
      workspaces: Array<{ id: string }>;
    };
    expect(workspacesData.workspaces.map((workspace) => workspace.id)).toContain(owner.workspaceId);
  });
});
