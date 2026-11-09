"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProductionPoint } from "@/lib/services/dashboard";
import { formatNumber } from "@/lib/utils";

export function ProductionChart({ data }: { data: ProductionPoint[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="productionFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8eef7" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => formatNumber(Number(value))}
            width={54}
          />
          <Tooltip
            cursor={{ stroke: "#93b4f5", strokeDasharray: "3 3" }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 30px rgba(23,43,77,0.12)",
              fontSize: 12,
            }}
            formatter={(value) => [`${formatNumber(Number(value))} pcs`, "Produced"]}
          />
          <Area
            type="monotone"
            dataKey="quantity"
            stroke="#2563eb"
            strokeWidth={2.2}
            fill="url(#productionFill)"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
