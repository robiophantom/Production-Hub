"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { UnitPoint } from "@/lib/services/dashboard";
import { formatNumber } from "@/lib/utils";

export function UnitComparisonChart({ data }: { data: UnitPoint[] }) {
  const chartData = data.map((unit) => ({
    ...unit,
    name: unit.name.replace(/^Unit\s*/, "U").split("—")[0].trim(),
  }));

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8eef7" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => formatNumber(Number(value))}
            width={54}
          />
          <Tooltip
            cursor={{ fill: "rgba(37,99,235,0.05)" }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 30px rgba(23,43,77,0.12)",
              fontSize: 12,
            }}
            formatter={(value, name) => [
              `${formatNumber(Number(value))} pcs`,
              name === "ordered" ? "Ordered" : "Produced",
            ]}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span className="text-[11px] text-muted">
                {value === "ordered" ? "Ordered" : "Produced"}
              </span>
            )}
          />
          <Bar dataKey="ordered" fill="#dbeafe" radius={[5, 5, 0, 0]} maxBarSize={38} />
          <Bar dataKey="produced" fill="#2563eb" radius={[5, 5, 0, 0]} maxBarSize={38} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
