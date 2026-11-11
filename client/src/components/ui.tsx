import * as React from "react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Plus,
  RefreshCw,
  Upload,
} from "lucide-react";
import type { Activity, Tone } from "@/lib/types";

export const cx = (...classes: Array<string | false | undefined>) =>
  classes.filter(Boolean).join(" ");

export function StatusPill({
  label,
  tone = "neutral",
  dot = true,
}: {
  label: string;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span className={cx("status-pill", `status-${tone}`)}>
      {dot && <span className="status-dot" />}
      {label}
    </span>
  );
}

export function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <div className="section-eyebrow">{children}</div>;
}

export function MetricCard({
  label,
  value,
  detail,
  trend,
  tone = "ink",
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  trend?: string;
  tone?: "ink" | "coral" | "sage" | "sand";
  icon: typeof Check;
}) {
  return (
    <div className={cx("metric-card", `metric-${tone}`)}>
      <div className="metric-topline">
        <span className="metric-label">{label}</span>
        <span className="metric-icon">
          <Icon size={16} strokeWidth={1.8} />
        </span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-detail">
        {trend && <span className="trend-positive">{trend}</span>}
        {detail}
      </div>
    </div>
  );
}

const activityIcons = {
  sync: RefreshCw,
  verify: FileCheck2,
  upload: Upload,
  gate: AlertTriangle,
  inspection: ClipboardCheck,
  intake: Plus,
  action: Check,
  visit: ClipboardCheck,
} as const;

export function ActivityItem({ item }: { item: Activity }) {
  const Icon = activityIcons[item.kind] ?? Check;
  return (
    <div className="activity-item">
      <div className={cx("activity-icon", item.tone !== "default" && item.tone)}>
        <Icon size={15} strokeWidth={2} />
      </div>
      <div className="activity-copy">
        <strong>{item.title}</strong>
        <span>{item.detail}</span>
      </div>
      <time>{item.time}</time>
    </div>
  );
}

export function MissingState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="missing-state">
      <div className="missing-icon">
        <AlertTriangle size={20} />
      </div>
      <h2>{title}</h2>
      <p>{detail}</p>
      {action}
    </div>
  );
}

type ToastContextValue = { notify: (message: string, tone?: "success" | "error") => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  const timer = useRef<number | undefined>(undefined);

  const notify = useCallback((next: string, tone?: "success" | "error") => {
    setMessage(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(""), 3600);
    if (tone === "error") {
      // keep the toast visible for the same duration while preserving the current style
      return;
    }
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      {message && (
        <div className="toast" role="status">
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}