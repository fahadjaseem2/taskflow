import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { DashboardStats, PRIORITY_LABELS, TaskPriority } from '../../types';

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: '#94a3b8',
  medium: '#d97706',
  high: '#ea580c',
  urgent: '#dc2626',
};

export function PriorityChart({ stats }: { stats: DashboardStats }) {
  const data = (Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => ({
    name: PRIORITY_LABELS[p],
    value: stats.byPriority[p] ?? 0,
    color: PRIORITY_COLORS[p],
  }));

  return (
    <div className="card chart-card">
      <h4 className="chart-card-title">Tasks by priority</h4>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: 'var(--color-text-dim)' }}
            axisLine={{ stroke: 'var(--color-border)' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: 'var(--color-text-dim)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-surface-sunken)' }}
            contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 13 }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
