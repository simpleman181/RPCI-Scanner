"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, CheckCircle2, Loader2, Plus, Trash2,
  ArrowLeft, Save, RefreshCw, Shield, Activity, Search
} from "lucide-react";
import Link from "next/link";

interface StocksConfig {
  symbols: string[];
  fno: string[];
  sha: string;
}

export default function StocksPage() {
  const [config, setConfig] = useState<StocksConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveMsg, setSaveMsg] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [bulkFno, setBulkFno] = useState(false);
  const [addError, setAddError] = useState("");
  const [search, setSearch] = useState("");

  const loadStocks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stocks");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setConfig(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setSaveMsg(msg);
      setSaveStatus("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStocks();
  }, [loadStocks]);

  const handleAdd = () => {
    if (!config) return;
    setAddError("");

    const raw = bulkInput.trim().toUpperCase();
    if (!raw) { setAddError("Enter at least one symbol"); return; }

    const parts = raw.split(/[;,

]+/).map((s: string) => s.trim()).filter(Boolean);
    if (parts.length === 0) { setAddError("No valid symbols found"); return; }

    const toAdd: string[] = [];
    const skipped: string[] = [];

    for (const part of parts) {
      const sym = part.endsWith(".NS") ? part : part + ".NS";
      if (config.symbols.includes(sym)) {
        skipped.push(sym.replace(".NS", ""));
      } else {
        toAdd.push(sym);
      }
    }

    if (toAdd.length === 0) {
      setAddError("All symbols already in list: " + skipped.join(", "));
      return;
    }

    const bases = toAdd.map((s: string) => s.replace(".NS", ""));
    const newSymbols = [...config.symbols, ...toAdd];
    const newFno = bulkFno ? [...config.fno, ...bases] : config.fno;
    setConfig({ ...config, symbols: newSymbols, fno: newFno });
    setBulkInput("");
    setBulkFno(false);

    const msg = skipped.length > 0
      ? "Added " + toAdd.length + " stock" + (toAdd.length > 1 ? "s" : "") + ". Skipped (already present): " + skipped.join(", ")
      : "Added " + toAdd.length + " stock" + (toAdd.length > 1 ? "s" : "") + " successfully";
    setAddError("✓ " + msg);
  };

  const handleRemove = (sym: string) => {
    if (!config) return;
    const base = sym.replace(".NS", "");
    setConfig({
      ...config,
      symbols: config.symbols.filter((s) => s !== sym),
      fno: config.fno.filter((f) => f !== base),
    });
  };

  const handleToggleFno = (sym: string) => {
    if (!config) return;
    const base = sym.replace(".NS", "");
    const isFno = config.fno.includes(base);
    setConfig({
      ...config,
      fno: isFno ? config.fno.filter((f) => f !== base) : [...config.fno, base],
    });
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setSaveStatus("idle");
    setSaveMsg("");
    try {
      const res = await fetch("/api/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols: config.symbols,
          fno: config.fno,
          sha: config.sha,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setConfig({ ...config, sha: data.sha });
      setSaveStatus("success");
      setSaveMsg("Saved to GitHub. Vercel will redeploy in ~3 minutes.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setSaveStatus("error");
      setSaveMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const filtered = config?.symbols.filter((s) =>
    s.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const fnoCount = config?.symbols.filter((s) => config.fno.includes(s.replace(".NS", ""))).length ?? 0;
  const nonFnoCount = (config?.symbols.length ?? 0) - fnoCount;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Scanner
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">Manage Stock List</h1>
            <p className="text-xs text-gray-500">Add or remove NSE stocks from the scanner</p>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Save status */}
        {saveStatus !== "idle" && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            saveStatus === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            {saveStatus === "success"
              ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
            {saveMsg}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="py-3 px-4">
            <div className="text-xs text-gray-500">Total Stocks</div>
            <div className="text-2xl font-bold text-gray-900">{config?.symbols.length ?? "—"}</div>
          </Card>
          <Card className="py-3 px-4">
            <div className="text-xs text-gray-500 flex items-center gap-1"><Shield className="w-3 h-3" /> F&O</div>
            <div className="text-2xl font-bold text-blue-600">{fnoCount}</div>
          </Card>
          <Card className="py-3 px-4">
            <div className="text-xs text-gray-500 flex items-center gap-1"><Activity className="w-3 h-3" /> Non-F&O</div>
            <div className="text-2xl font-bold text-gray-600">{nonFnoCount}</div>
          </Card>
        </div>

        {/* Add stock */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-800">Add Stocks</CardTitle>
            <CardDescription className="text-xs">
              Enter one or multiple NSE symbols separated by <strong>semicolons</strong>, commas, or new lines.
              The <code className="bg-gray-100 px-1 rounded font-mono">.NS</code> suffix is added automatically.
              New stocks default to <strong>Non-F&O</strong> — toggle individual rows after adding.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              placeholder={"360ONE; 3MINDIA; ACC; AIAENG
or one per line:
360ONE
3MINDIA
ACC"}
              value={bulkInput}
              onChange={(e) => { setBulkInput(e.target.value.toUpperCase()); setAddError(""); }}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono uppercase shadow-sm placeholder:text-muted-foreground placeholder:normal-case placeholder:font-sans focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y min-h-[72px]"
            />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkFno}
                  onChange={(e) => setBulkFno(e.target.checked)}
                  className="rounded"
                />
                <span className="text-xs text-gray-600">Mark all entered symbols as F&O stocks</span>
              </label>
              <Button onClick={handleAdd} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 shrink-0">
                <Plus className="w-4 h-4" /> Add Stocks
              </Button>
            </div>
            {addError && (
              <p className={"text-xs " + (addError.startsWith("✓") ? "text-emerald-600 font-medium" : "text-red-500")}>
                {addError}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Stock list */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-800">
                Current Stock List
                {config && <span className="ml-2 text-gray-400 font-normal">({filtered.length}{search ? ` of ${config.symbols.length}` : ""})</span>}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={loadStocks} disabled={loading} className="gap-1 text-xs">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Reload
              </Button>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="Search symbols..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                {filtered.map((sym) => {
                  const base = sym.replace(".NS", "");
                  const isFno = config?.fno.includes(base) ?? false;
                  return (
                    <div key={sym} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 group">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-medium text-gray-900">{base}</span>
                        <button
                          onClick={() => handleToggleFno(sym)}
                          title="Click to toggle F&O status"
                          className="focus:outline-none"
                        >
                          <Badge
                            variant={isFno ? "default" : "secondary"}
                            className={`text-[10px] px-1.5 py-0 cursor-pointer transition-opacity ${
                              isFno
                                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            }`}
                          >
                            {isFno ? (
                              <span className="flex items-center gap-0.5"><Shield className="w-2.5 h-2.5" /> F&O</span>
                            ) : (
                              <span className="flex items-center gap-0.5"><Activity className="w-2.5 h-2.5" /> Non-F&O</span>
                            )}
                          </Badge>
                        </button>
                      </div>
                      <button
                        onClick={() => handleRemove(sym)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 p-1 rounded"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="text-center py-10 text-sm text-gray-400">
                    {search ? "No stocks match your search" : "No stocks in the list"}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="border-blue-100 bg-blue-50/50">
          <CardContent className="py-3 px-4 text-xs text-blue-800 space-y-1">
            <p className="font-semibold">How this works</p>
            <p>Changes are saved to <code className="bg-blue-100 px-1 rounded font-mono">public/stocks.json</code> in GitHub. Vercel redeploys automatically (~3 min). The list persists across all visits.</p>
            <p><strong>Bulk add:</strong> paste symbols separated by <code className="bg-blue-100 px-1 rounded">;</code> semicolons, commas, or new lines — e.g. <code className="bg-blue-100 px-1 rounded font-mono">360ONE; 3MINDIA; ACC</code>. New stocks default to <strong>Non-F&O</strong>; toggle after adding if needed.</p>
            <p>Click the <strong>F&O / Non-F&O badge</strong> on any row to toggle. Hover a row and click the <strong>trash icon</strong> to remove.</p>
            <p className="text-blue-600">⚠️ Click <strong>Save Changes</strong> to persist edits to GitHub.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
