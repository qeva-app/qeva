'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, ChevronDown, ChevronUp, History, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import AnimatedCard from '@/components/AnimatedCard';
import LoadingSpinner from '@/components/LoadingSpinner';

interface ScanResult {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedCount: number;
  affectedPasswords: string[];
}

interface ScanHistoryEntry {
  id: string;
  grade: string;
  riskScore: number;
  totalIssues: number;
  createdAt: string;
}

export default function SecurityScanDashboard() {
  const [results, setResults] = useState<ScanResult[]>([]);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [grade, setGrade] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/security/scan?limit=10');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.scans || []);
      }
    } catch {
      // Silently fail
    }
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const toggleExpand = (type: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/security/scan', { method: 'POST' });
      const data = await res.json();
      setResults(data.results || []);
      setRiskScore(data.riskScore ?? null);
      setGrade(data.grade || '');
      setScanned(true);
      // Refresh history after scan
      fetchHistory();
    } catch {
      // Error handling
    }
    setScanning(false);
  };

  const severityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 border-destructive/20',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-primary/10 text-primary border-blue-200',
  };

  const gradeColorForValue = (g: string) => {
    if (g === 'A') return 'text-success bg-success/10 border-green-200';
    if (g === 'B') return 'text-primary bg-primary/10 border-blue-200';
    if (g === 'C') return 'text-warning bg-amber-50 border-amber-200';
    if (g === 'D') return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-destructive bg-destructive/10 border-destructive/20';
  };

  const gradeColor = () => gradeColorForValue(grade);

  const trendIcon = (current: number, previous: number) => {
    if (current < previous) return <TrendingDown size={14} className="text-success" />;
    if (current > previous) return <TrendingUp size={14} className="text-destructive" />;
    return <Minus size={14} className="text-muted-foreground" />;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Security Scan</h1>
          <p className="text-muted-foreground text-sm mt-1">Analyze your password security</p>
        </div>
        <button onClick={runScan} disabled={scanning} className="btn-primary">
          <RefreshCw size={18} className={scanning ? 'animate-spin' : ''} />
          {scanning ? 'Scanning...' : 'Run Security Scan'}
        </button>
      </div>

      {scanning && <LoadingSpinner className="h-64" text="Analyzing passwords..." />}

      {scanned && !scanning && (
        <>
          {/* Score Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AnimatedCard className="p-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">Security Grade</p>
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl border-2 ${gradeColor()}`}>
                <span className="text-4xl font-bold">{grade}</span>
              </div>
            </AnimatedCard>
            <AnimatedCard delay={0.1} className="p-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">Risk Score</p>
              <p className="text-4xl font-bold text-foreground">{riskScore ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Lower is better</p>
            </AnimatedCard>
            <AnimatedCard delay={0.2} className="p-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">Issues Found</p>
              <p className="text-4xl font-bold text-foreground">{results.reduce((a, r) => a + r.affectedCount, 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">Across {results.length} checks</p>
            </AnimatedCard>
          </div>

          {/* Results */}
          <div className="space-y-3">
            {results.length === 0 && (
              <AnimatedCard className="p-8 text-center">
                <h3 className="text-lg font-semibold text-foreground">All clear</h3>
                <p className="text-sm text-muted-foreground mt-1">No security issues were found in your passwords.</p>
              </AnimatedCard>
            )}
            {results.map((result, i) => {
              const isExpanded = expandedItems.has(result.type);
              return (
              <AnimatedCard key={result.type} delay={i * 0.05} className="p-5">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-3">
                    {result.affectedCount > 0 ? (
                      <AlertTriangle size={20} className={result.severity === 'critical' ? 'text-destructive' : 'text-warning'} />
                    ) : (
                      <CheckCircle size={20} className="text-success" />
                    )}
                    <div>
                      <h3 className="font-medium text-foreground">{result.title}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">{result.description}</p>
                    </div>
                  </div>
                  <span className={`badge ${severityColors[result.severity]} capitalize`}>{result.severity}</span>
                </div>
                {result.affectedPasswords?.length > 0 && (
                  <div className="ml-8 mt-3">
                    <button
                      onClick={() => toggleExpand(result.type)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {isExpanded ? 'Hide' : 'Show'} affected passwords ({result.affectedPasswords.length})
                    </button>
                    {isExpanded && (
                      <div className="space-y-1 border-l-2 border-muted pl-3">
                        {result.affectedPasswords.slice(0, 10).map((name, j) => (
                          <p key={j} className="text-sm text-muted-foreground">• {name}</p>
                        ))}
                        {result.affectedPasswords.length > 10 && (
                          <p className="text-xs text-muted-foreground">...and {result.affectedPasswords.length - 10} more</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </AnimatedCard>
              );
            })}
          </div>
        </>
      )}

      {!scanned && !scanning && (
        <AnimatedCard className="p-8 text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">No scan results</h3>
          <p className="text-muted-foreground text-sm mb-4">Run a security scan to analyze your password health</p>
          <button onClick={runScan} className="btn-primary">
            Start Scan
          </button>
        </AnimatedCard>
      )}

      {/* Scan History */}
      <AnimatedCard delay={0.3} className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <History size={20} className="text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Scan History</h2>
        </div>
        {loadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner className="h-16" text="Loading history..." />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No scan history yet. Run your first scan to start tracking.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Date</th>
                  <th className="text-center py-2 px-3 text-muted-foreground font-medium">Grade</th>
                  <th className="text-center py-2 px-3 text-muted-foreground font-medium">Risk Score</th>
                  <th className="text-center py-2 px-3 text-muted-foreground font-medium">Issues</th>
                  <th className="text-center py-2 px-3 text-muted-foreground font-medium">Trend</th>
                </tr>
              </thead>
              <tbody>
                {history.map((scan, i) => (
                  <tr key={scan.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 text-foreground">{formatDate(scan.createdAt)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border text-sm font-bold ${gradeColorForValue(scan.grade)}`}>
                        {scan.grade}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-foreground font-medium">{scan.riskScore}</td>
                    <td className="py-2.5 px-3 text-center text-foreground">{scan.totalIssues}</td>
                    <td className="py-2.5 px-3 text-center">
                      {i < history.length - 1 ? (
                        <span className="inline-flex items-center gap-1">
                          {trendIcon(scan.riskScore, history[i + 1].riskScore)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AnimatedCard>
    </div>
  );
}
