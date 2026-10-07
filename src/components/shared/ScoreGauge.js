import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { getScoreColor, getScoreLabel } from '@/lib/utils';

export const ScoreGauge = ({ score, size = 120 }) => {
  if (score === null || score === undefined) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-xs text-muted-foreground">No score</span>
      </div>
    );
  }

  const data = [
    { value: score },
    { value: 100 - score },
  ];
  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  return (
    <div className="score-gauge" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={size * 0.32}
            outerRadius={size * 0.42}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill="hsla(222, 22%, 18%, 0.5)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="score-gauge-text">
        <span className="font-display text-2xl font-semibold tabular-nums" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
    </div>
  );
};
