"use client";

import { useState, useRef, useCallback } from "react";
import {
  RefreshCw, Upload, FileSpreadsheet, CheckCircle2,
  X, Loader2, ChevronDown, ChevronUp, Download,
  AlertCircle, TrendingUp, Target, Award, BarChart2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { api, TrainResult } from "@/lib/api";
import { toast } from "sonner";

interface ProgressStep {
  step: string;
  pct: number;
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 text-center shadow-sm">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 font-medium mt-1 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function DropZone({ onFile, label }: { onFile: (f: File) => void; label: string }) {
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
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
        ${dragOver ? "border-[#C9A84C] bg-[#C9A84C]/5" : "border-gray-300 hover:border-[#003366] hover:bg-blue-50/30"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-gray-300" />
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      <p className="text-xs text-gray-400 mt-1">Drop or click · .csv, .xlsx, .xls</p>
    </div>
  );
}

function ProgressLog({ steps }: { steps: ProgressStep[] }) {
  if (steps.length === 0) return null;
  const latest = steps[steps.length - 1];
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Training Progress</h3>
      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>{latest.step}</span>
          <span>{latest.pct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-2 rounded-full bg-[#003366] transition-all duration-500"
            style={{ width: `${latest.pct}%` }}
          />
        </div>
      </div>
      {/* Step Log */}
      <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-600 space-y-1 max-h-40 overflow-y-auto">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.pct === 100 ? "bg-emerald-500" : "bg-[#003366]"}`} />
            <span>[{s.pct.toString().padStart(3)}%] {s.step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfusionMatrix({ matrix, labels }: { matrix: number[][]; labels: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!matrix || matrix.length === 0) return null;
  const maxVal = Math.max(...matrix.flat());

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-900 hover:bg-gray-50"
        onClick={() => setExpanded((v) => !v)}
      >
        <span>Confusion Matrix</span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {expanded && (
        <div className="px-5 pb-5 overflow-x-auto">
          <table className="text-[10px] border-collapse">
            <thead>
              <tr>
                <th className="p-1 text-gray-400 font-normal">Pred →</th>
                {labels.map((l, i) => (
                  <th key={i} className="p-1 font-medium text-gray-600 max-w-[60px] truncate whitespace-nowrap" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 70 }}>
                    {l.length > 20 ? l.slice(0, 20) + "…" : l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, ri) => (
                <tr key={ri}>
                  <td className="p-1 text-right font-medium text-gray-600 max-w-[100px] truncate pr-2 whitespace-nowrap text-[9px]">
                    {labels[ri]?.length > 22 ? labels[ri].slice(0, 22) + "…" : labels[ri]}
                  </td>
                  {row.map((val, ci) => {
                    const intensity = maxVal > 0 ? val / maxVal : 0;
                    const bg = ri === ci
                      ? `rgba(0, 51, 102, ${0.15 + intensity * 0.75})`
                      : `rgba(201, 168, 76, ${intensity * 0.6})`;
                    const textColor = intensity > 0.5 ? "text-white" : "text-gray-700";
                    return (
                      <td
                        key={ci}
                        className={`p-1 text-center w-8 h-8 font-semibold ${textColor}`}
                        style={{ backgroundColor: bg, border: "1px solid #f0f0f0" }}
                      >
                        {val > 0 ? val : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-2">Navy = correct predictions · Gold = misclassifications</p>
        </div>
      )}
    </div>
  );
}

export default function RetrainingPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [result, setResult] = useState<TrainResult | null>(null);

  async function handleRetrain() {
    if (!file) return;
    setLoading(true);
    setSteps([]);
    setResult(null);

    try {
      await api.retrainStreamPost(file, (step, pct, res) => {
        setSteps((prev) => [...prev, { step, pct }]);
        if (res) setResult(res);
      });
      toast.success("Model retrained successfully!");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Retraining failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSynthetic() {
    setLoading(true);
    setSteps([{ step: "Generating synthetic NBB corporate data…", pct: 10 }]);
    setResult(null);
    try {
      const res = await api.retrainSynthetic();
      setResult(res);
      setSteps([
        { step: "Generating synthetic NBB corporate data…", pct: 10 },
        { step: "Feature engineering…", pct: 40 },
        { step: "Training XGBoost model…", pct: 70 },
        { step: "Evaluating & saving model…", pct: 95 },
        { step: "Done", pct: 100 },
      ]);
      toast.success("Model retrained on synthetic data!");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  const metrics = result?.metrics;
  const featImportance = metrics?.feature_importance ?? [];

  return (
    <div className="space-y-6 max-w-screen-xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#003366]">Model Retraining</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Upload labelled training data to retrain the XGBoost NBO model
        </p>
      </div>

      {/* Upload Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Training Data Upload</h2>

        {!file ? (
          <DropZone onFile={setFile} label="Drop your labelled training CSV here" />
        ) : (
          <div className="flex items-center gap-3 p-4 bg-[#003366]/5 border border-[#003366]/20 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-[#003366] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500">
              <X size={16} />
            </button>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
          <p className="font-semibold mb-1">Required training columns (includes ground truth label):</p>
          <p className="font-mono text-[11px] leading-relaxed text-blue-600">
            client_id · industry_sector · annual_revenue_bhd · years_with_nbb · existing_products ·
            last_transaction_date · avg_monthly_balance_bhd · fx_volume_bhd · trade_finance_usage ·
            loan_outstanding_bhd · <span className="font-bold text-blue-700">actual_product_taken</span>
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleRetrain}
            disabled={!file || loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#003366] text-white text-sm font-semibold rounded-lg
              hover:bg-[#002244] transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload size={16} />}
            {loading ? "Training…" : "Retrain Model"}
          </button>
          <button
            onClick={handleSynthetic}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#C9A84C] text-white text-sm font-semibold rounded-lg
              hover:bg-[#b8963e] transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw size={16} />}
            Retrain on Synthetic Data
          </button>
          <a
            href="/samples/training_template.csv"
            download
            className="flex items-center gap-1.5 text-xs text-[#003366] hover:underline font-medium"
          >
            <Download size={13} /> Download training template
          </a>
        </div>
      </div>

      {/* Progress */}
      <ProgressLog steps={steps} />

      {/* Results */}
      {metrics && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h2 className="text-sm font-semibold text-gray-900">
              Model Performance — Version {result?.meta.version}
            </h2>
          </div>

          {/* Overall Metrics */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard label="Accuracy" value={`${(metrics.accuracy * 100).toFixed(1)}%`} color="text-[#003366]" />
            <MetricCard label="F1 Macro" value={`${(metrics.f1_macro * 100).toFixed(1)}%`} color="text-emerald-600" />
            <MetricCard label="Precision" value={`${(metrics.precision_macro * 100).toFixed(1)}%`} color="text-[#C9A84C]" />
            <MetricCard label="Recall" value={`${(metrics.recall_macro * 100).toFixed(1)}%`} color="text-purple-600" />
          </div>

          {/* Train / Test samples */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex gap-6 text-sm">
            <span className="text-gray-500">Training samples: <strong className="text-gray-900">{metrics.train_samples.toLocaleString()}</strong></span>
            <span className="text-gray-500">Test samples: <strong className="text-gray-900">{metrics.test_samples.toLocaleString()}</strong></span>
          </div>

          {/* Feature Importance */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              <span className="flex items-center gap-2"><BarChart2 size={16} className="text-[#C9A84C]" /> Top 10 Feature Importances</span>
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={featImportance}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 160, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="feature"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  width={155}
                />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                  {featImportance.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#C9A84C" : i < 3 ? "#003366" : "#6090c0"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Per-class Metrics Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Per-Product Class Metrics</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    {["Product", "Precision", "Recall", "F1 Score"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(metrics.per_class).map(([product, m]) => (
                    <tr key={product} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-gray-800 font-medium">{product}</td>
                      <td className="px-4 py-2.5">
                        <span className={`font-semibold ${m.precision >= 0.7 ? "text-emerald-600" : m.precision >= 0.5 ? "text-amber-600" : "text-red-500"}`}>
                          {(m.precision * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`font-semibold ${m.recall >= 0.7 ? "text-emerald-600" : m.recall >= 0.5 ? "text-amber-600" : "text-red-500"}`}>
                          {(m.recall * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`font-semibold ${m.f1 >= 0.7 ? "text-emerald-600" : m.f1 >= 0.5 ? "text-amber-600" : "text-red-500"}`}>
                          {(m.f1 * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Confusion Matrix */}
          <ConfusionMatrix
            matrix={metrics.confusion_matrix}
            labels={metrics.confusion_matrix_labels}
          />
        </div>
      )}
    </div>
  );
}
