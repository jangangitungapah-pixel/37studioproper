import ReactECharts from 'echarts-for-react';

export default function EChartsRenderer({ height, option }) {
  return (
    <ReactECharts
      lazyUpdate
      notMerge
      option={option}
      opts={{ renderer: 'canvas' }}
      style={{ height, width: '100%' }}
    />
  );
}
