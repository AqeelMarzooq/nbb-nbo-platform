"use client";

import { useEffect, useState } from "react";
import {
  Settings, Brain, Package, Users, CheckCircle2,
  XCircle, Loader2, RefreshCw, ChevronDown, ChevronUp,
  Star, AlertCircle,
} from "lucide-react";
import { api, ModelVersionRow } from "@/lib/api";
import { toast } from "sonner";

const NBB_PRODUCTS = [
  { name: "Corporate Current Accounts", category: "Accounts" },
  { name: "Trade Finance – Letters of Credit (LC)", category: "Trade Finance" },
  { name: "Trade Finance – Bank Guarantees", category: "Trade Finance" },
  { name: "Trade Finance – Documentary Collections", category: "Trade Finance" },
  { name: "Corporate Term Loans", category: "Lending" },
  { name: "Syndicated Loans", category: "Lending" },
  { name: "Working Capital Finance", category: "Lending" },
  { name: "Foreign Exchange (FX) Solutions – Spot, Forward, Swap", category: "FX & Treasury" },
  { name: "Cash Management & Liquidity Solutions", category: "Cash Management" },
  { name: "Corporate Overdraft Facilities", category: "Lending" },
  { name: "Investment Products – Fixed Deposits (BHD & USD)", category: "Investments" },
  { name: "Treasury Bills & Bonds", category: "Investments" },
  { name: "Corporate Credit Cards", category: "Cards" },
  { name: "Payroll Management Services (WPS – Wage Protection System)", category: "Payroll" },
  { name: "Internet Banking – Corporate (NBB Direct)", category: "Digital Banking" },
];

const DEMO_USERS = [
  { name: "Admin User", email: "admin@nbb.bh", role: "Admin", active: true },
  { name: "Relationship Manager", email: "rm@nbb.bh", role: "RM", active: true },
  { name: "Data Analyst", email: "analyst@nbb.bh", role: "Analyst", active: true },
];

const ROLE_COLORS: Record<string, string> = {
  Admin: "bg-red-100 text-red-700",
  RM: "bg-[#003366]/10 text-[#003366]",
  Analyst: "bg-[#C9A84C]/15 text-[#8a6e28]",
};

function SectionCard({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#003366]/8 flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#003366]" />
        </div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

interface ProductRow { id: number; name: string; category: string; is_enabled: boolean; }

export default function SettingsPage() {
  const [versions, setVersions] = useState<ModelVersionRow[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [activating, setActivating] = useState<number | null>(null);
  const [expandVersions, setExpandVersions] = useState(true);

  // Products — loaded from DB, persisted via API
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [togglingProduct, setTogglingProduct] = useState<number | null>(null);

  useEffect(() => {
    api.getModelVersions()
      .then(setVersions)
      .catch(() => toast.error("Could not load model versions"))
      .finally(() => setLoadingVersions(false));

    api.getProducts()
      .then(setProducts)
      .catch(() => {
        // Backend may not have products seeded yet — fall back to static list
        setProducts(NBB_PRODUCTS.map((p, i) => ({ id: i + 1, name: p.name, category: p.category, is_enabled: true })));
      })
      .finally(() => setLoadingProducts(false));
  }, []);

  async function handleActivate(id: number) {
    setActivating(id);
    try {
      const res = await api.activateModelVersion(id);
      toast.success(`Activated model version: ${res.activated}`);
      setVersions((prev) => prev.map((v) => ({ ...v, is_active: v.id === id })));
    } catch {
      toast.error("Failed to activate model version");
    } finally {
      setActivating(null);
    }
  }

  async function toggleProduct(product: ProductRow) {
    setTogglingProduct(product.id);
    const newEnabled = !product.is_enabled;
    // Optimistic update
    setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, is_enabled: newEnabled } : p));
    try {
      await api.toggleProduct(product.id, newEnabled);
      toast.success(`${product.name} ${newEnabled ? "enabled" : "disabled"}`);
    } catch {
      // Revert on failure
      setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, is_enabled: !newEnabled } : p));
      toast.error(`Failed to update product status`);
    } finally {
      setTogglingProduct(null);
    }
  }

  async function resetAllProducts() {
    for (const p of products.filter((p) => !p.is_enabled)) {
      await api.toggleProduct(p.id, true).catch(() => null);
    }
    setProducts((prev) => prev.map((p) => ({ ...p, is_enabled: true })));
    toast.success("All products re-enabled");
  }

  const categories = [...new Set(products.map((p) => p.category))];

  return (
    <div className="space-y-6 max-w-screen-lg">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#003366]">Settings & Admin</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage model versions, products, and users
        </p>
      </div>

      {/* Model Registry */}
      <SectionCard title="Model Registry" icon={Brain}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">All trained XGBoost model versions. Set the active model for predictions.</p>
            <button
              onClick={() => setExpandVersions((v) => !v)}
              className="text-gray-400 hover:text-gray-600"
            >
              {expandVersions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {expandVersions && (
            <>
              {loadingVersions ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading model versions…
                </div>
              ) : versions.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  <Brain className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  No models trained yet. Go to Model Retraining to train your first model.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/70">
                        {["Version", "Trained At", "Accuracy", "F1 Macro", "Samples", "Status", "Action"].map((h) => (
                          <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map((v) => (
                        <tr key={v.id} className={`border-b border-gray-50 transition-colors ${v.is_active ? "bg-emerald-50/40" : "hover:bg-gray-50/50"}`}>
                          <td className="px-3 py-2.5 font-mono text-xs text-gray-700">{v.version}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                            {v.trained_at ? new Date(v.trained_at).toLocaleString("en-BH", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-[#003366]">
                            {v.accuracy != null ? `${(v.accuracy * 100).toFixed(1)}%` : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-gray-700">
                            {v.f1_macro != null ? `${(v.f1_macro * 100).toFixed(1)}%` : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600">{v.n_samples?.toLocaleString() ?? "—"}</td>
                          <td className="px-3 py-2.5">
                            {v.is_active ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                <CheckCircle2 size={11} /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                                <XCircle size={11} /> Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {!v.is_active && (
                              <button
                                onClick={() => handleActivate(v.id)}
                                disabled={activating === v.id}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#003366] text-white rounded-md
                                  hover:bg-[#002244] transition-colors disabled:opacity-50"
                              >
                                {activating === v.id
                                  ? <Loader2 size={11} className="animate-spin" />
                                  : <Star size={11} />}
                                Set Active
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </SectionCard>

      {/* Product Management */}
      <SectionCard title="Product Management" icon={Package}>
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Enable or disable NBB products from the recommendation universe.
            Disabled products will <strong>not be recommended</strong> by the model — changes take effect immediately.
          </p>
          {loadingProducts ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading products…
            </div>
          ) : (
            <>
              {categories.map((cat) => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{cat}</p>
                  <div className="space-y-1">
                    {products.filter((p) => p.category === cat).map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-gray-100 hover:bg-gray-50/50 transition-colors"
                      >
                        <span className={`text-sm ${product.is_enabled ? "text-gray-800" : "text-gray-400 line-through"}`}>
                          {product.name}
                        </span>
                        <button
                          onClick={() => toggleProduct(product)}
                          disabled={togglingProduct === product.id}
                          className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-60
                            ${product.is_enabled ? "bg-[#003366]" : "bg-gray-300"}`}
                        >
                          {togglingProduct === product.id ? (
                            <Loader2 className="absolute top-0.5 left-0.5 w-4 h-4 animate-spin text-white" />
                          ) : (
                            <span
                              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
                                ${product.is_enabled ? "translate-x-5" : "translate-x-0"}`}
                            />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="pt-2 flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  {products.filter((p) => p.is_enabled).length} of {products.length} products enabled
                </span>
                <button
                  onClick={resetAllProducts}
                  className="text-xs text-[#003366] hover:underline font-medium flex items-center gap-1"
                >
                  <RefreshCw size={11} /> Enable all
                </button>
              </div>
            </>
          )}
        </div>
      </SectionCard>

      {/* User Management */}
      <SectionCard title="User Management" icon={Users}>
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            <AlertCircle size={14} className="flex-shrink-0" />
            Demo mode: users are hard-coded. Connect a database for full user management.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  {["Name", "Email", "Role", "Status"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEMO_USERS.map((u, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs font-mono">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role]}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                        <CheckCircle2 size={11} /> Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      {/* Platform Info */}
      <div className="bg-[#003366] rounded-xl p-5 text-white">
        <div className="flex items-center gap-3 mb-3">
          <Settings className="w-5 h-5 text-[#C9A84C]" />
          <h3 className="font-semibold">Platform Information</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          {[
            { label: "Platform", value: "NBB NBO v1.0" },
            { label: "ML Algorithm", value: "XGBoost" },
            { label: "Products", value: "15 Corporate" },
            { label: "Regulatory", value: "CBB / Basel III" },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-blue-300 text-xs">{item.label}</p>
              <p className="font-semibold text-white mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
