"use client";

import { useEffect, useRef, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Loader2, AlertCircle, Download, Calendar,
  TrendingUp, PieChart as PieIcon, BarChart2, Users,
  ThumbsUp, FileText,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const COLORS = [
  "#003366","#C9A84C","#059669","#7c3aed","#dc2626",
  "#0891b2","#db2777","#65a30d","#f97316","#6366f1",
  "#14b8a6","#f59e0b","#8b5cf6","#10b981","#ef4444",
];
const LINE_COLORS = ["#003366","#C9A84C","#059669","#7c3aed","#dc2626","#0891b2"];

function SectionHeader({ icon: Icon, title, subtitle }: {
  icon: React.ElementType; title: string; subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-[#003366]/8 flex items-center justify-center">
        <Icon className="w-4 h-4 text-[#003366]" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-sm">
      <AlertCircle className="w-8 h-8 mb-2 text-gray-300" />
      {message}
    </div>
  );
}

export default function ReportingPage() {
  const printRef = useRef<HTMLDivElement>(null);

  const [monthlyData, setMonthlyData] = useState<{
    months: string[];
    products: string[];
    data: Record<string, Record<string, number>>;
  } | null>(null);
  const [industryData, setIndustryData] = useState<{ sector: string; count: number }[]>([]);
  const [rmData, setRmData]   = useState<{ rm: string; clients_scored: number; top_product: string }[]>([]);
  const [acceptData, setAcceptData] = useState<{
    product: string; total_feedback: number; accepted: number; rejected: number; acceptance_rate: number;
  }[]>([]);
  const [months, setMonths]   = useState(6);
  const [loading, setLoading] = useState(true);

  async function loadAll(m: number) {
    setLoading(true);
    try {
      const [monthly, industry, rm, accept] = await Promise.all([
        api.getMonthly(m),
        api.getIndustryBreakdown(),
        api.getRmPerformance(),
        api.getAcceptanceRates(),
      ]);
      setMonthlyData(monthly);
      setIndustryData(industry);
      setRmData(rm);
      setAcceptData(accept);
    } catch {
      toast.error("Failed to load report data — is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(months); }, [months]);

  // Build series for line chart
  const lineChartData = monthlyData
    ? monthlyData.months.map((m) => ({ month: m, ...monthlyData.data[m] }))
    : [];
  const topProducts = monthlyData?.products.slice(0, 6) ?? [];

  // CSV export helper
  function exportCSV(rows: object[], filename: string) {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const csv = [
      keys.join(","),
      ...rows.map((r) =>
        keys.map((k) => JSON.stringify((r as Record<string, unknown>)[k] ?? "")).join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // PDF export — browser print of the report div
  function exportPDF() {
    const el = printRef.current;
    if (!el) return;
    const originalTitle = document.title;
    document.title = `NBB_NBO_Report_${new Date().toISOString().slice(0, 10)}`;
    window.print();
    document.title = originalTitle;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <Loader2 className="w-8 h-8 animate-spin text-[#003366]" />
      </div>
    );
  }

  return (
    <>
      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          body > * { display: none !important; }
          #report-print-area { display: block !important; }
          .no-print { display: none !important; }
          @page { margin: 15mm; }
        }
      `}</style>

      <div id="report-print-area" ref={printRef} className="space-y-6 max-w-screen-xl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#003366]">Reporting</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              NBB corporate NBO analytics and performance insights
            </p>
          </div>
          <div className="flex items-center gap-2 no-print flex-wrap">
            {/* Date range (month) filter */}
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm">
              <Calendar size={14} className="text-gray-400" />
              <select
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className="text-sm border-none outline-none bg-transparent text-gray-700"
              >
                {[3, 6, 12, 24].map((m) => (
                  <option key={m} value={m}>Last {m} months</option>
                ))}
              </select>
            </div>
            {/* CSV export */}
            <button
              onClick={() => exportCSV(rmData, "nbb_rm_performance.csv")}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg
                text-xs font-medium text-gray-700 hover:bg-gray-50 bg-white"
            >
              <Download size={13} /> Export CSV
            </button>
            {/* PDF export */}
            <button
              onClick={exportPDF}
              className="flex items-center gap-1.5 px-3 py-2 border border-[#003366] rounded-lg
                text-xs font-medium text-[#003366] hover:bg-[#003366]/5 bg-white"
            >
              <FileText size={13} /> Export PDF
            </button>
          </div>
        </div>

        {/* Monthly Volume Line Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <SectionHeader
            icon={TrendingUp}
            title="Monthly Recommendation Volume by Product"
            subtitle={`Last ${months} months — top 6 products`}
          />
          {lineChartData.length === 0 ? (
            <EmptyState message="No monthly data yet. Score some clients to see trends." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={lineChartData} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {topProducts.map((product, i) => (
                  <Line
                    key={product}
                    type="monotone"
                    dataKey={product}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name={product.length > 30 ? product.slice(0, 30) + "…" : product}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Row: Industry Pie + Acceptance Rate Bar */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Industry Breakdown Pie */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <SectionHeader
              icon={PieIcon}
              title="Recommendations by Industry Sector"
              subtitle="Distribution across corporate client segments"
            />
            {industryData.length === 0 ? (
              <EmptyState message="No industry data available yet." />
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={industryData}
                      dataKey="count"
                      nameKey="sector"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={40}
                    >
                      {industryData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {industryData.map((item, i) => {
                    const total = industryData.reduce((s, r) => s + r.count, 0);
                    const pct   = total > 0 ? ((item.count / total) * 100).toFixed(1) : "0";
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="flex-1 text-gray-600 truncate">{item.sector}</span>
                        <span className="font-semibold text-gray-800">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Acceptance Rate by Product */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <SectionHeader
              icon={ThumbsUp}
              title="Acceptance Rate by Product"
              subtitle="Based on client feedback data (where available)"
            />
            {acceptData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-sm text-center">
                <ThumbsUp className="w-8 h-8 mb-2 text-gray-300" />
                <p>No feedback data yet.</p>
                <p className="text-xs text-gray-300 mt-1">
                  Use <code className="text-xs bg-gray-100 px-1 rounded">POST /reports/predictions/&#123;id&#125;/feedback</code> to record accepted offers.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={acceptData}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="product"
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    width={160}
                    tickFormatter={(v: string) => v.length > 25 ? v.slice(0, 25) + "…" : v}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(val: number) => [`${val}%`, "Acceptance Rate"]}
                  />
                  <Bar
                    dataKey="acceptance_rate"
                    name="Acceptance Rate"
                    radius={[0, 4, 4, 0]}
                  >
                    {acceptData.map((item, i) => (
                      <Cell
                        key={i}
                        fill={
                          item.acceptance_rate >= 70 ? "#059669"
                          : item.acceptance_rate >= 40 ? "#C9A84C"
                          : "#dc2626"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* RM Performance Bar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <SectionHeader
            icon={BarChart2}
            title="RM Performance — Clients Scored"
            subtitle="Number of corporate clients scored per relationship manager"
          />
          {rmData.length === 0 ? (
            <EmptyState message="No RM data available. Score corporate clients to populate." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={rmData} margin={{ top: 4, right: 8, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="rm"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="clients_scored" name="Clients Scored" fill="#003366" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* RM Performance Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users size={16} className="text-[#003366]" />
              <h2 className="text-sm font-semibold text-gray-900">RM Performance Table</h2>
            </div>
            <button
              onClick={() => exportCSV(rmData, "nbb_rm_performance.csv")}
              className="no-print flex items-center gap-1.5 text-xs text-[#003366] font-medium hover:underline"
            >
              <Download size={12} /> Export CSV
            </button>
          </div>
          {rmData.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              No RM data available. Score corporate clients to populate.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    {["#", "Relationship Manager", "Clients Scored", "Top Recommended Product"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...rmData]
                    .sort((a, b) => b.clients_scored - a.clients_scored)
                    .map((rm, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 text-gray-400 text-xs font-mono">{i + 1}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{rm.rm}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full
                          bg-[#003366]/8 text-[#003366] text-xs font-semibold">
                          {rm.clients_scored.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600 text-xs">{rm.top_product}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Print footer */}
        <div className="hidden print:block text-center text-xs text-gray-400 pt-4 border-t border-gray-200">
          National Bank of Bahrain — NBB NBO Platform · Generated {new Date().toLocaleString("en-BH")} · Internal use only
        </div>
      </div>
    </>
  );
}
