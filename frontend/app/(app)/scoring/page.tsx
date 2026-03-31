"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload, Download, Filter, ArrowUpDown, X,
  FileSpreadsheet, CheckCircle2, Loader2, AlertCircle,
  ChevronUp, ChevronDown,
} from "lucide-react";
import { api, Prediction } from "@/lib/api";
import { formatBHD, confidenceClass, truncate } from "@/lib/utils";
import { toast } from "sonner";

type SortKey = keyof Prediction | null;
type SortDir = "asc" | "desc";

function ConfidenceBadge({ score }: { score: number }) {
  const cls = confidenceClass(score);
  const label = score >= 80 ? "High" : score >= 60 ? "Medium" : "Low";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500"}`} />
      {score.toFixed(1)}% · {label}
    </span>
  );
}

function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
        ${dragOver ? "border-[#C9A84C] bg-[#C9A84C]/5" : "border-gray-300 hover:border-[#003366] hover:bg-blue-50/30"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-gray-300" />
      <p className="text-sm font-semibold text-gray-700">Drop your CSV or Excel file here</p>
      <p className="text-xs text-gray-400 mt-1">or click to browse — .csv, .xlsx, .xls accepted</p>
    </div>
  );
}

export default function ScoringPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Prediction[]>([]);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("confidence_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [confidenceFilter, setConfidenceFilter] = useState<"all" | "high" | "mid" | "low">("all");

  async function handleScore() {
    if (!file) return;
    setLoading(true);
    try {
      const res = await api.predictFile(file);
      setResults(res.predictions);
      toast.success(`Scored ${res.count} clients successfully`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Scoring failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown size={12} className="text-gray-300" />;
    return sortDir === "asc"
      ? <ChevronUp size={12} className="text-[#003366]" />
      : <ChevronDown size={12} className="text-[#003366]" />;
  }

  const filtered = results
    .filter((r) => {
      const q = filter.toLowerCase();
      const matchText = !q ||
        r.client_id?.toLowerCase().includes(q) ||
        r.client_name?.toLowerCase().includes(q) ||
        r.recommended_product?.toLowerCase().includes(q) ||
        r.industry_sector?.toLowerCase().includes(q) ||
        r.relationship_manager?.toLowerCase().includes(q);
      const matchConf =
        confidenceFilter === "all" ||
        (confidenceFilter === "high" && r.confidence_score >= 80) ||
        (confidenceFilter === "mid" && r.confidence_score >= 60 && r.confidence_score < 80) ||
        (confidenceFilter === "low" && r.confidence_score < 60);
      return matchText && matchConf;
    })
    .sort((a, b) => {
      if (!sortKey) return 0;
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });

  // Heatmap stats
  const high = results.filter((r) => r.confidence_score >= 80).length;
  const mid  = results.filter((r) => r.confidence_score >= 60 && r.confidence_score < 80).length;
  const low  = results.filter((r) => r.confidence_score < 60).length;

  return (
    <div className="space-y-6 max-w-screen-xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#003366]">Client Scoring</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Upload a corporate client file to generate Next Best Offer predictions
        </p>
      </div>

      {/* Upload Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Upload Client File</h2>

        {!file ? (
          <DropZone onFile={setFile} />
        ) : (
          <div className="flex items-center gap-3 p-4 bg-[#003366]/5 border border-[#003366]/20 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-[#003366] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500 transition-colors">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Required fields hint */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
          <p className="font-semibold mb-1">Required CSV columns:</p>
          <p className="font-mono text-[11px] leading-relaxed text-blue-600">
            client_id · client_name · industry_sector · annual_revenue_bhd · years_with_nbb ·
            existing_products · last_transaction_date · avg_monthly_balance_bhd · fx_volume_bhd ·
            trade_finance_usage · loan_outstanding_bhd · relationship_manager
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleScore}
            disabled={!file || loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#003366] text-white text-sm font-semibold rounded-lg
              hover:bg-[#002244] transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload size={16} />}
            {loading ? "Scoring…" : "Run NBO Scoring"}
          </button>
          <a
            href="/samples/scoring_template.csv"
            download
            className="flex items-center gap-1.5 text-xs text-[#003366] hover:underline font-medium"
          >
            <Download size={13} /> Download template
          </a>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          {/* Confidence Heatmap Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "High Confidence", count: high, pct: ((high / results.length) * 100).toFixed(0), color: "emerald", filter: "high" as const },
              { label: "Medium Confidence", count: mid, pct: ((mid / results.length) * 100).toFixed(0), color: "amber", filter: "mid" as const },
              { label: "Low Confidence", count: low, pct: ((low / results.length) * 100).toFixed(0), color: "red", filter: "low" as const },
            ].map((band) => (
              <button
                key={band.filter}
                onClick={() => setConfidenceFilter(confidenceFilter === band.filter ? "all" : band.filter)}
                className={`rounded-xl border p-4 text-left transition-all hover:shadow-md
                  ${confidenceFilter === band.filter
                    ? `border-${band.color}-400 bg-${band.color}-50 shadow-sm`
                    : "border-gray-200 bg-white"}`}
              >
                <div className={`text-2xl font-bold text-${band.color}-700`}>{band.count}</div>
                <div className="text-xs font-medium text-gray-600 mt-0.5">{band.label}</div>
                <div className={`mt-2 h-1.5 rounded-full bg-${band.color}-100`}>
                  <div className={`h-1.5 rounded-full bg-${band.color}-500`} style={{ width: `${band.pct}%` }} />
                </div>
                <div className={`text-xs text-${band.color}-600 mt-1`}>{band.pct}% of clients</div>
              </button>
            ))}
          </div>

          {/* Table Controls */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 relative">
                <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter by client, product, industry, RM…"
                  className="w-full pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003366]/30"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{filtered.length} of {results.length} clients</span>
                <button
                  onClick={() => api.exportPredictions().catch(() => toast.error("Export failed"))}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg
                    hover:bg-gray-50 text-gray-700 transition-colors"
                >
                  <Download size={13} /> Export CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    {[
                      { label: "Client ID", key: "client_id" as SortKey },
                      { label: "Client Name", key: "client_name" as SortKey },
                      { label: "Industry", key: "industry_sector" as SortKey },
                      { label: "Revenue (BHD)", key: "annual_revenue_bhd" as SortKey },
                      { label: "RM", key: "relationship_manager" as SortKey },
                      { label: "Next Best Offer", key: "recommended_product" as SortKey },
                      { label: "Confidence", key: "confidence_score" as SortKey },
                      { label: "Alt. Offer 1", key: null },
                      { label: "Alt. Offer 2", key: null },
                    ].map(({ label, key }) => (
                      <th
                        key={label}
                        onClick={() => key && handleSort(key)}
                        className={`text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide
                          whitespace-nowrap ${key ? "cursor-pointer hover:text-[#003366]" : ""}`}
                      >
                        <div className="flex items-center gap-1">
                          {label}
                          {key && <SortIcon col={key} />}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-gray-500 whitespace-nowrap">{r.client_id}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.client_name}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.industry_sector}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatBHD(r.annual_revenue_bhd)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.relationship_manager}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 bg-[#003366]/8 text-[#003366] text-xs font-medium rounded-md">
                          {truncate(r.recommended_product, 38)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ConfidenceBadge score={r.confidence_score} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {truncate(r.alternative_offer_1 ?? "—", 30)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {truncate(r.alternative_offer_2 ?? "—", 30)}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-16 text-center text-gray-400 text-sm">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        No results match your filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
