/**
 * API client for NBB NBO FastAPI backend.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Prediction {
  client_id: string;
  client_name: string;
  industry_sector: string;
  annual_revenue_bhd: number;
  relationship_manager: string;
  recommended_product: string;
  confidence_score: number;
  alternative_offer_1: string;
  alt1_confidence: number;
  alternative_offer_2: string;
  alt2_confidence: number;
}

export interface SummaryData {
  total_clients_scored: number;
  total_predictions: number;
  top_product_today: string;
  model_accuracy_pct: number | null;
  last_retrain_date: string;
  product_distribution: { product: string; count: number }[];
  top_clients: Prediction[];
}

export interface TrainResult {
  metrics: {
    accuracy: number;
    precision_macro: number;
    recall_macro: number;
    f1_macro: number;
    per_class: Record<string, { precision: number; recall: number; f1: number }>;
    confusion_matrix: number[][];
    confusion_matrix_labels: string[];
    feature_importance: { feature: string; importance: number }[];
    train_samples: number;
    test_samples: number;
  };
  meta: {
    version: string;
    trained_at: string;
    accuracy: number;
    n_samples: number;
  };
}

export interface ModelInfo {
  version?: string;
  trained_at?: string;
  accuracy?: number;
  n_samples?: number;
  status?: string;
}

export interface ModelVersionRow {
  id: number;
  version: string;
  trained_at: string;
  accuracy: number;
  f1_macro: number;
  n_samples: number;
  is_active: boolean;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // ── Predict ──────────────────────────────────────────────────────────────
  async predictFile(file: File): Promise<{ count: number; predictions: Prediction[] }> {
    const form = new FormData();
    form.append("file", file);
    return apiFetch("/predict/upload", { method: "POST", body: form });
  },

  async exportPredictions(): Promise<void> {
    const res = await fetch(`${API_URL}/predict/export`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nbo_predictions.csv";
    a.click();
    URL.revokeObjectURL(url);
  },

  // ── Retrain ───────────────────────────────────────────────────────────────
  async retrain(file: File): Promise<TrainResult> {
    const form = new FormData();
    form.append("file", file);
    return apiFetch("/retrain/", { method: "POST", body: form });
  },

  async retrainSynthetic(): Promise<TrainResult> {
    return apiFetch("/retrain/synthetic", { method: "POST" });
  },

  retrainStream(file: File): EventSource {
    // SSE — caller attaches onmessage/onerror
    const form = new FormData();
    form.append("file", file);
    // Note: EventSource only supports GET; use fetch + ReadableStream for POST SSE
    return new EventSource(`${API_URL}/retrain/stream`);
  },

  async retrainStreamPost(
    file: File,
    onProgress: (step: string, pct: number, result?: TrainResult) => void
  ): Promise<void> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/retrain/stream`, {
      method: "POST",
      body: form,
    });
    if (!res.body) throw new Error("No response body");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const json = line.slice(6).trim();
          if (!json) continue;
          const data = JSON.parse(json);
          onProgress(data.step, data.pct, data.result);
        }
      }
    }
  },

  // ── Reports ───────────────────────────────────────────────────────────────
  async getSummary(): Promise<SummaryData> {
    return apiFetch("/reports/summary");
  },

  async getMonthly(months = 6): Promise<{
    months: string[];
    products: string[];
    data: Record<string, Record<string, number>>;
  }> {
    return apiFetch(`/reports/monthly?months=${months}`);
  },

  async getIndustryBreakdown(): Promise<{ sector: string; count: number }[]> {
    return apiFetch("/reports/industry");
  },

  async getRmPerformance(): Promise<
    { rm: string; clients_scored: number; top_product: string }[]
  > {
    return apiFetch("/reports/rm-performance");
  },

  async getAcceptanceRates(): Promise<
    { product: string; total_feedback: number; accepted: number; rejected: number; acceptance_rate: number }[]
  > {
    return apiFetch("/reports/acceptance-rate");
  },

  async getModelVersions(): Promise<ModelVersionRow[]> {
    return apiFetch("/reports/model-versions");
  },

  // ── Products ──────────────────────────────────────────────────────────────
  async getProducts(): Promise<{ id: number; name: string; category: string; is_enabled: boolean }[]> {
    return apiFetch("/predict/products");
  },

  async toggleProduct(id: number, enabled: boolean): Promise<{ id: number; name: string; is_enabled: boolean }> {
    return apiFetch(`/predict/products/${id}/toggle?enabled=${enabled}`, { method: "PATCH" });
  },

  async activateModelVersion(id: number): Promise<{ activated: string }> {
    return apiFetch(`/reports/model-versions/${id}/activate`, { method: "POST" });
  },

  // ── Model Info ────────────────────────────────────────────────────────────
  async getModelInfo(): Promise<ModelInfo> {
    return apiFetch("/model/info");
  },
};
