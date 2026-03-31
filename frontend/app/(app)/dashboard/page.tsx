"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  Users, TrendingUp, Brain, Calendar,
  ArrowUpRight, Loader2, AlertCircle,
} from "lucide-react";
import { api, SummaryData, Prediction } from "@/lib/api";
import { formatBHD, confidenceClass, truncate } from "@/lib/utils";
import { toast } from "sonner";

const NAVY = "#003366";
const GOLD = "#C9A84C";

const BAR_COLORS = [
  "#003366","#004080","#005099","#0060b3","#C9A84C",
  "#d4a83d","#7c3aed","#059669","#dc2626","#0891b2",
  "#db2777","#65a30d","#f97316","#6366f1","#14b8a6",
];

function KpiCard({
  label, value, sub, icon: Icon, accent = false,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-white p-5 shadow-sm flex items-start gap-4 ${accent ? "border-[#C9A84C]" : "border-gray-200"}`}>
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${accent ? "bg-[#C9A84C]/10" : "bg-[#003366]/8"}`}>
        <Icon className={`w-5 h-5 ${accent ? "text-[#C9A84C]" : "text-[#003366]"}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  const cls = confidenceClass(score);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {score.toFixed(1)}%
    </span>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSummary()
      .then(setData)
      .catch((e: Error) => {
        setError(e.message);
        toast.error("Failed to load dashboard data");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <Loader2 className="w-8 h-8 animate-spin text-[#003366]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3 text-gray-500">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm">Could not connect to the NBB NBO API.</p>
        <p className="text-xs text-gray-400">Make sure the FastAPI backend is running on port 8000.</p>
      </div>
    );
  }

  const topProducts = [...data.product_distribution]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="space-y-6 max-w-screen-xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#003366]">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            NBB Corporate NBO Overview — {new Date().toLocaleDateString("en-BH", { dateStyle: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-xs text-emerald-700 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Model Active
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Clients Scored"
          value={data.total_clients_scored.toLocaleString()}
          sub={`${data.total_predictions.toLocaleString()} total predictions`}
          icon={Users}
        />
        <KpiCard
          label="Top Product Today"
          value={truncate(data.top_product_today, 30)}
          sub="Most recommended today"
          icon={TrendingUp}
          accent
        />
        <KpiCard
          label="Model Accuracy"
          value={data.model_accuracy_pct != null ? `${data.model_accuracy_pct}%` : "N/A"}
          sub="XGBoost multi-class"
          icon={Brain}
        />
        <KpiCard
          label="Last Retrain"
          value={data.last_retrain_date === "Never" ? "Not yet" : data.last_retrain_date.split(" ")[0]}
          sub={data.last_retrain_date}
          icon={Calendar}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Bar Chart — Product Distribution */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Product Recommendation Distribution</h2>
              <p className="text-xs text-gray-400">Top 10 products across all corporate clients</p>
            </div>
          </div>
          {topProducts.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
              No prediction data yet. Run Client Scoring to populate.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topProducts} margin={{ top: 4, right: 8, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="product"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  tickFormatter={(v: string) => truncate(v, 22)}
                />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(val: number) => [val, "Count"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {topProducts.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quick Stats Panel */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Product Breakdown</h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-400">No data available.</p>
          ) : (
            <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
              {topProducts.map((item, i) => {
                const total = topProducts.reduce((s, r) => s + r.count, 0);
                const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : "0";
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600 truncate max-w-[160px]">{item.product}</span>
                      <span className="font-semibold text-gray-800 ml-2">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top 10 Clients Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Top Scored Clients</h2>
            <p className="text-xs text-gray-400">Most recently scored corporate clients with NBO</p>
          </div>
          <a
            href="/scoring"
            className="flex items-center gap-1 text-xs font-medium text-[#003366] hover:underline"
          >
            Score more <ArrowUpRight size={13} />
          </a>
        </div>
        {data.top_clients.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            No clients scored yet. Upload a CSV in the Client Scoring module.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  {["Client ID", "Client Name", "Industry", "RM", "Next Best Offer", "Confidence"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.top_clients.map((client: Prediction, i: number) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">{client.client_id}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{client.client_name}</td>
                    <td className="px-4 py-3 text-gray-600">{client.industry_sector}</td>
                    <td className="px-4 py-3 text-gray-600">{client.relationship_manager}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 bg-[#003366]/8 text-[#003366] text-xs font-medium rounded-md">
                        {truncate(client.recommended_product, 36)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ConfidenceBadge score={client.confidence_score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
