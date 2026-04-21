import type { AiFormSpec } from '../../shared/aiFormSpec';
import { parseAndValidateAiFormSpec } from '../../shared/aiFormSpec';
import { compileAiFormSpec } from '../../shared/aiFormCompiler';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4.1-mini';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GenerateAiFormSpecInput {
  brief: string;
  model?: string;
}

interface GeneratedAiFormResult {
  spec: AiFormSpec;
  schema: ReturnType<typeof compileAiFormSpec> extends { schema: infer T } ? T : never;
  model: string;
  repaired: boolean;
}

const AI_FORM_SPEC_JSON_SCHEMA = {
  name: 'ai_form_spec',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['version', 'title', 'steps', 'results'],
    properties: {
      version: { type: 'string', enum: ['v1'] },
      title: { type: 'string' },
      description: { type: 'string' },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['stepRef', 'title', 'kind'],
          properties: {
            stepRef: { type: 'string' },
            title: { type: 'string' },
            kind: {
              type: 'string',
              enum: ['yesno', 'multiple', 'long', 'email', 'number', 'date', 'welcome', 'end', 'group'],
            },
            description: { type: 'string' },
            required: { type: 'boolean' },
            choices: {
              type: 'array',
              items: { type: 'string' },
            },
            allowMultipleSelection: { type: 'boolean' },
            allowOtherOption: { type: 'boolean' },
            numberRange: {
              type: 'object',
              additionalProperties: false,
              properties: {
                min: { type: 'number' },
                max: { type: 'number' },
              },
            },
            dateFormat: {
              type: 'object',
              additionalProperties: false,
              required: ['order', 'separator'],
              properties: {
                order: { type: 'string', enum: ['MMDDYYYY', 'DDMMYYYY', 'YYYYMMDD'] },
                separator: { type: 'string', enum: ['/', '-', '.'] },
              },
            },
            weight: { type: 'number' },
            defaultGoToStepRef: { type: 'string' },
            branchConditions: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['answer', 'goToStepRef'],
                properties: {
                  answer: { type: 'boolean' },
                  goToStepRef: { type: 'string' },
                },
              },
            },
            buttonLabel: { type: 'string' },
          },
        },
      },
      results: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['label', 'description'],
          properties: {
            label: { type: 'string' },
            description: { type: 'string' },
            minScore: { type: 'number' },
            maxScore: { type: 'number' },
          },
        },
      },
      theme: {
        type: 'object',
        additionalProperties: false,
        properties: {
          primaryColor: { type: 'string' },
          backgroundColor: { type: 'string' },
          textColor: { type: 'string' },
          fontFamily: { type: 'string' },
          logoUrl: { type: 'string' },
        },
      },
      assumptions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'message'],
          properties: {
            type: { type: 'string', enum: ['assumption', 'ambiguity'] },
            message: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You generate structured form specs for Census.

The user will provide a plain-English markdown brief.
Return only a valid AiFormSpec object that matches the provided JSON schema.

Rules:
- Use version "v1".
- Use stable stepRef strings.
- Prefer one welcome step only when the brief implies it.
- Prefer one end step only when the brief implies it.
- Use kind "yesno" for boolean qualification questions.
- Use kind "multiple" only when explicit choices make sense.
- Use branchConditions only on yes/no steps.
- Use defaultGoToStepRef for simple sequential flow.
- Use weight 0 for welcome, end, and group steps.
- Use assumptions to record any interpretation choices or unresolved ambiguity.
- Do not invent unsupported fields.
- Make the structure practical for a business form or assessment, not academic.`;

const buildRepairPrompt = (brief: string, error: string) => `The previous AiFormSpec attempt did not validate or compile.

Original brief:
${brief}

Validation or compile error:
${error}

Return a corrected AiFormSpec JSON object that satisfies the required schema and resolves the reported issue.`;

const extractMessageContent = (content: unknown) => {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => (item && typeof item === 'object' && 'text' in item ? String(item.text ?? '') : ''))
      .join('')
      .trim();
  }
  return '';
};

const parseOpenRouterResponse = async (response: Response) => {
  const data = (await response.json()) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: unknown } }>;
    model?: string;
  };

  if (!response.ok) {
    throw new Error(data.error?.message ?? `OpenRouter request failed (${response.status}).`);
  }

  const content = extractMessageContent(data.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error('OpenRouter returned an empty response.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as AiFormSpec;
  } catch {
    throw new Error('OpenRouter returned invalid JSON for AiFormSpec.');
  }

  return {
    parsed,
    model: data.model ?? null,
  };
};

const requestAiFormSpec = async (
  apiKey: string,
  model: string,
  messages: OpenRouterMessage[]
) => {
  const body = {
    model,
    temperature: 0.2,
    messages,
    response_format: {
      type: 'json_schema',
      json_schema: AI_FORM_SPEC_JSON_SCHEMA,
    },
  };

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return parseOpenRouterResponse(response);
};

export const generateAiFormSpecFromBrief = async (input: GenerateAiFormSpecInput) => {
  const brief = input.brief.trim();
  if (!brief) {
    throw new Error('Brief is required.');
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured.');
  }

  const model = input.model?.trim() || process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  let repaired = false;
  let lastError = 'AI form generation failed.';

  const baseMessages: OpenRouterMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: brief },
  ];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const messages =
      attempt === 0
        ? baseMessages
        : [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildRepairPrompt(brief, lastError) },
          ];

    const { parsed, model: resolvedModel } = await requestAiFormSpec(apiKey, model, messages);
    const { spec, errors } = parseAndValidateAiFormSpec(parsed);
    if (!spec || errors.length > 0) {
      lastError = errors[0] ?? 'OpenRouter returned an invalid AiFormSpec.';
      repaired = attempt > 0;
      continue;
    }

    const { schema, errors: compileErrors } = compileAiFormSpec(spec);
    if (!schema || compileErrors.length > 0) {
      lastError = compileErrors[0] ?? 'Unable to compile generated AiFormSpec.';
      repaired = attempt > 0;
      continue;
    }

    return {
      spec,
      schema,
      model: resolvedModel ?? model,
      repaired: attempt > 0,
    } satisfies GeneratedAiFormResult;
  }

  throw new Error(lastError);
};
