package main

// The README snippets (examples/usage/*.ts), written with upstream ntcharts.

import (
	"time"

	"charm.land/lipgloss/v2"
	"github.com/NimbleMarkets/ntcharts/v2/barchart"
	"github.com/NimbleMarkets/ntcharts/v2/canvas"
	"github.com/NimbleMarkets/ntcharts/v2/heatmap"
	"github.com/NimbleMarkets/ntcharts/v2/linechart"
	"github.com/NimbleMarkets/ntcharts/v2/linechart/streamlinechart"
	"github.com/NimbleMarkets/ntcharts/v2/linechart/timeserieslinechart"
	"github.com/NimbleMarkets/ntcharts/v2/linechart/wavelinechart"
	"github.com/NimbleMarkets/ntcharts/v2/sparkline"
)

func init() {
	register("usage/canvas", func() string {
		c := canvas.New(5, 2)
		c.SetLinesWithStyle([]string{"hello", "world"}, lipgloss.NewStyle().Foreground(lipgloss.Color("6")))
		return c.View()
	})
	register("usage/barchart", func() string {
		bc := barchart.New(11, 10)
		bc.PushAll([]barchart.BarData{
			{Label: "A", Values: []barchart.BarValue{{Name: "Item1", Value: 21.2, Style: lipgloss.NewStyle().Foreground(lipgloss.Color("10"))}}},
			{Label: "B", Values: []barchart.BarValue{{Name: "Item1", Value: 15.2, Style: lipgloss.NewStyle().Foreground(lipgloss.Color("9"))}}},
		})
		bc.Draw()
		return bc.View()
	})
	register("usage/streamlinechart", func() string {
		slc := streamlinechart.New(13, 10)
		for _, v := range []float64{4, 6, 8, 10, 8, 6, 4, 2, 0, 2, 4} {
			slc.Push(v)
		}
		slc.Draw()
		return slc.View()
	})
	register("usage/timeserieslinechart", func() string {
		chart := timeserieslinechart.New(41, 10)
		start := time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)
		for i, v := range []float64{0, 4, 8, 10, 8, 4, 0, -4, -8, -10, -8, -4, 0} {
			chart.Push(timeserieslinechart.TimePoint{Time: start.Add(time.Duration(i) * 24 * time.Hour), Value: v})
		}
		chart.DrawBraille()
		return chart.View()
	})
	register("usage/wavelinechart", func() string {
		wlc := wavelinechart.New(12, 10, wavelinechart.WithYRange(-3, 3))
		for _, p := range []canvas.Float64Point{{X: 1, Y: 2}, {X: 3, Y: -2}, {X: 5, Y: 2}, {X: 7, Y: -2}, {X: 9, Y: 2}} {
			wlc.Plot(p)
		}
		wlc.Draw()
		return wlc.View()
	})
	register("usage/sparkline", func() string {
		sl := sparkline.New(10, 3)
		sl.PushAll([]float64{7.81, 3.82, 8.39, 2.06, 4.19, 4.74, 6.21, 4.41, 9.87, 3.53})
		sl.Draw()
		return sl.View()
	})
	register("usage/heatmap", func() string {
		days := []string{"Mon", "Tue", "Wed"}
		visits := [][]float64{{2, 9, 14, 6}, {1, 11, 16, 8}, {3, 7, 12, 10}}
		hm := heatmap.New(24, 8, heatmap.WithValueRange(0, 16), heatmap.WithCellSize(1, 1))
		hm.SetXLabels([]string{"00h", "06h", "12h", "18h"})
		hm.SetYLabels([]string{"Wed", "Tue", "Mon"})
		for d, row := range visits {
			for h, v := range row {
				hm.Push(heatmap.NewHeatPointInt(h, len(days)-1-d, v))
			}
		}
		hm.Draw()
		return hm.View()
	})
	register("usage/logscale", func() string {
		wlc := wavelinechart.New(24, 10,
			wavelinechart.WithYScale(linechart.ScaleLog),
			wavelinechart.WithXYRange(0, 5, 1, 10000))
		for i, v := range []float64{3, 40, 500, 6000} {
			wlc.Plot(canvas.Float64Point{X: float64(i + 1), Y: v})
		}
		wlc.Draw()
		return wlc.View()
	})
}
