import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

interface ResponseItem {
  id: string;
  created_at: number;
  score: number;
  meta_json: string | null;
}

interface SummaryResponse {
  count: number;
  avgScore: number;
  questionStats: Array<{ question_id: string; answer: string; count: number }>;
}

interface FunnelResponse {
  totalStarts: number;
  completions: number;
  dropOffByQuestionId: Record<string, number>;
}

interface LeadItem {
  id: string;
  name: string;
  email: string;
  company: string | null;
  created_at: number;
  response_id: string | null;
}

const Analytics: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [funnel, setFunnel] = useState<FunnelResponse | null>(null);
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [count, setCount] = useState(0);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!id) {
        setError('Missing form id.');
        setLoading(false);
        return;
      }

      try {
        const [summaryResponse, listResponse, funnelResponse, leadsResponse] = await Promise.all([
          fetch(`/api/forms/${id}/responses/summary`),
          fetch(`/api/forms/${id}/responses`),
          fetch(`/api/forms/${id}/responses/funnel`),
          fetch(`/api/forms/${id}/leads`),
        ]);

        if (
          !summaryResponse.ok ||
          !listResponse.ok ||
          !funnelResponse.ok ||
          !leadsResponse.ok
        ) {
          throw new Error('Failed to load analytics.');
        }

        const summaryData = (await summaryResponse.json()) as SummaryResponse;
        const listData = (await listResponse.json()) as {
          responses?: ResponseItem[];
          count?: number;
        };
        const funnelData = (await funnelResponse.json()) as FunnelResponse;
        const leadData = (await leadsResponse.json()) as { leads?: LeadItem[] };

        if (isMounted) {
          setSummary(summaryData);
          setResponses(listData.responses ?? []);
          setCount(listData.count ?? 0);
          setFunnel(funnelData);
          setLeads(leadData.leads ?? []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [id]);

  return (
    <div className="typeform-fullscreen typeform-fullscreen-scroll">
      <div className="typeform-content typeform-content-scroll">
        <div className="flex flex-col items-center w-full">
          <div className="text-sm text-gray-400 mb-4 font-medium">Analytics</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Form Analytics</h2>

          <div className="w-full max-w-3xl mb-6 flex items-center justify-between">
            <Link
              to={`/forms/${id}/edit`}
              className="text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              Back to Builder
            </Link>
            <a
              href={`/api/forms/${id}/responses/export`}
              className="typeform-button"
            >
              Download CSV
            </a>
          </div>

          {loading && <div className="text-gray-500">Loading...</div>}
          {error && <div className="text-red-600">{error}</div>}

          {!loading && !error && summary && (
            <div className="w-full max-w-3xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-gray-200 rounded-md p-4">
                  <div className="text-sm text-gray-500">Total responses</div>
                  <div className="text-2xl font-bold text-gray-800">{summary.count}</div>
                </div>
                <div className="border border-gray-200 rounded-md p-4">
                  <div className="text-sm text-gray-500">Average score</div>
                  <div className="text-2xl font-bold text-gray-800">
                    {summary.avgScore.toFixed(1)}
                  </div>
                </div>
                <div className="border border-gray-200 rounded-md p-4">
                  <div className="text-sm text-gray-500">Latest responses</div>
                  <div className="text-2xl font-bold text-gray-800">{responses.length}</div>
                </div>
              </div>

              {funnel && (
                <div>
                  <div className="text-sm text-gray-500 mb-2">Funnel</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="border border-gray-200 rounded-md p-4">
                      <div className="text-sm text-gray-500">Total starts</div>
                      <div className="text-2xl font-bold text-gray-800">{funnel.totalStarts}</div>
                    </div>
                    <div className="border border-gray-200 rounded-md p-4">
                      <div className="text-sm text-gray-500">Completions</div>
                      <div className="text-2xl font-bold text-gray-800">{funnel.completions}</div>
                    </div>
                    <div className="border border-gray-200 rounded-md p-4">
                      <div className="text-sm text-gray-500">Completion rate</div>
                      <div className="text-2xl font-bold text-gray-800">
                        {funnel.totalStarts > 0
                          ? `${Math.round((funnel.completions / funnel.totalStarts) * 100)}%`
                          : '0%'}
                      </div>
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-md p-4">
                    <div className="text-sm text-gray-500 mb-2">Drop-off by question</div>
                    {Object.keys(funnel.dropOffByQuestionId).length === 0 && (
                      <div className="text-gray-500">No data yet.</div>
                    )}
                    {Object.entries(funnel.dropOffByQuestionId)
                      .sort(([, a], [, b]) => b - a)
                      .map(([questionId, value]) => (
                        <div key={questionId} className="text-sm text-gray-700">
                          Q{questionId}: {value}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm text-gray-500 mb-2">Per-question stats</div>
                <div className="border border-gray-200 rounded-md p-4">
                  {summary.questionStats.length === 0 && (
                    <div className="text-gray-500">No answers yet.</div>
                  )}
                  {summary.questionStats.map((stat) => (
                    <div key={`${stat.question_id}-${stat.answer}`} className="text-sm text-gray-700">
                      Q{stat.question_id} · {stat.answer}: {stat.count}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500 mb-2">Leads</div>
                <div className="border border-gray-200 rounded-md p-4 space-y-2">
                  {leads.length === 0 && <div className="text-gray-500">No leads yet.</div>}
                  {leads.map((lead) => (
                    <div key={lead.id} className="text-sm text-gray-700">
                      <div className="font-medium text-gray-800">
                        {lead.name} {lead.company ? `· ${lead.company}` : ''}
                      </div>
                      <div className="text-xs text-gray-500">
                        {lead.email} · {new Date(lead.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500 mb-2">Recent responses ({count})</div>
                <div className="space-y-2">
                  {responses.length === 0 && (
                    <div className="text-gray-500">No responses yet.</div>
                  )}
                  {responses.map((response) => (
                    <div
                      key={response.id}
                      className="border border-gray-200 rounded-md p-3 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-800">Score: {response.score}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(response.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
