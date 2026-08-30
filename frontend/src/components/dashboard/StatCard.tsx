interface Props {
  label: string;
  value: number | string;
  tone?: 'default' | 'danger';
}

export function StatCard({ label, value, tone = 'default' }: Props) {
  return (
    <div className="stat-card card">
      <span className="stat-card-label">{label}</span>
      <span className={`stat-card-value ${tone === 'danger' ? 'stat-card-value-danger' : ''}`}>{value}</span>
    </div>
  );
}
