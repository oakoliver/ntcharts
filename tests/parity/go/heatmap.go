package main

import (
	"fmt"
	"image/color"
	"math"
	"strings"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
	"github.com/NimbleMarkets/ntcharts/v2/heatmap"
	"github.com/NimbleMarkets/ntcharts/v2/linechart"
)

// hmRamp returns n colours from blue to red through integer steps.
func hmRamp(n int) []color.Color {
	cs := make([]color.Color, n)
	for i := range cs {
		r := i * 255 / (n - 1)
		cs[i] = lipgloss.Color(fmt.Sprintf("#%02x%02x%02x", r, 40, 255-r))
	}
	return cs
}

var (
	hmDays  = []string{"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}
	hmHours = []string{"00", "03", "06", "09", "12", "15", "18", "21"}
)

// hmVisits is a deterministic day/time table: values 0..99 without trig.
func hmVisits(d, h int) float64 {
	return float64((d*31 + h*17 + d*h*7) % 100)
}

// hmGridPoints returns a cols x rows grid with value f(x, y), Y up.
func hmGridPoints(cols, rows int, f func(x, y int) float64) []heatmap.HeatPoint {
	var pts []heatmap.HeatPoint
	for y := 0; y < rows; y++ {
		for x := 0; x < cols; x++ {
			pts = append(pts, heatmap.NewHeatPointInt(x, y, f(x, y)))
		}
	}
	return pts
}

func hmDays2Labels() []string {
	l := make([]string, len(hmDays))
	for i, d := range hmDays {
		l[len(hmDays)-1-i] = d
	}
	return l
}

// hmWeek builds the upstream "labels" example: a day x time-of-day grid.
func hmWeek(w, h int, labels bool, opts ...heatmap.Option) heatmap.Model {
	all := append([]heatmap.Option{
		heatmap.WithColorScale(hmRamp(24)),
		heatmap.WithValueRange(0, 100),
		heatmap.WithCellSize(1, 1),
	}, opts...)
	m := heatmap.New(w, h, all...)
	if labels {
		m.SetXLabels(hmHours)
		m.SetYLabels(hmDays2Labels())
	} else {
		m.SetXStep(0)
		m.SetYStep(0)
		m.SetXYRange(-0.5, float64(len(hmHours))-0.5, -0.5, float64(len(hmDays))-0.5)
		m.SetViewXYRange(-0.5, float64(len(hmHours))-0.5, -0.5, float64(len(hmDays))-0.5)
	}
	for d := range hmDays {
		for h := range hmHours {
			m.Push(heatmap.NewHeatPointInt(h, len(hmDays)-1-d, hmVisits(d, h)))
		}
	}
	m.Draw()
	return m
}

func init() {
	register("heatmap/week-labels", func() string {
		m := hmWeek(48, 12, true)
		return m.View()
	})
	register("heatmap/week-labels-styled", func() string {
		m := hmWeek(48, 12, true)
		m.LabelStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("6")).Bold(true)
		m.Canvas.Clear()
		m.Draw()
		return m.View()
	})
	register("heatmap/week-no-labels", func() string {
		m := hmWeek(48, 12, false)
		return m.View()
	})
	register("heatmap/week-small-drops-labels", func() string {
		m := hmWeek(16, 5, true)
		return m.View()
	})
	register("heatmap/week-large", func() string {
		m := hmWeek(96, 25, true)
		return m.View()
	})
	register("heatmap/week-resize", func() string {
		m := hmWeek(48, 12, true)
		out := m.View()
		m.Resize(24, 9)
		m.Canvas.Clear()
		m.Draw()
		return out + "\n--\n" + m.View()
	})
	register("heatmap/simple-radial", func() string {
		m := heatmap.New(20, 20, heatmap.WithValueRange(0, 1))
		m.SetXYRange(-1, 1, -1, 1)
		for x := float64(-1); x < 1.0; x += 1.0 / float64(m.GraphWidth()) {
			for y := float64(-1); y < 1.0; y += 1.0 / float64(m.GraphHeight()) {
				m.Push(heatmap.NewHeatPoint(x, y, math.Sqrt(x*x+y*y)/math.Sqrt2))
			}
		}
		m.Draw()
		return m.View()
	})
	register("heatmap/single-cells-default-scale", func() string {
		m := heatmap.New(24, 8, heatmap.WithValueRange(0, 20))
		m.PushAll(hmGridPoints(6, 4, func(x, y int) float64 { return float64(x + y*6) }))
		m.Draw()
		return m.View()
	})
	register("heatmap/single-cells-custom-scale", func() string {
		m := heatmap.New(30, 10, heatmap.WithColorScale(hmRamp(8)), heatmap.WithValueRange(0, 29))
		m.PushAll(hmGridPoints(10, 3, func(x, y int) float64 { return float64(x + y*10) }))
		m.Draw()
		return m.View()
	})
	register("heatmap/auto-value-range", func() string {
		m := heatmap.New(30, 10, heatmap.WithColorScale(hmRamp(12)), heatmap.WithAutoValueRange())
		m.PushAll(hmGridPoints(8, 4, func(x, y int) float64 { return float64(x*x) - float64(y*3) }))
		m.Draw()
		return m.View()
	})
	register("heatmap/fixed-value-range-clamps", func() string {
		m := heatmap.New(30, 10, heatmap.WithColorScale(hmRamp(12)), heatmap.WithValueRange(10, 20))
		m.PushAll(hmGridPoints(8, 4, func(x, y int) float64 { return float64(x*3 + y*2) }))
		m.Draw()
		return m.View()
	})
	register("heatmap/set-value-range-after-push", func() string {
		m := heatmap.New(30, 10, heatmap.WithColorScale(hmRamp(12)), heatmap.WithValueRange(0, 10))
		m.PushAll(hmGridPoints(8, 4, func(x, y int) float64 { return float64(x + y*8) }))
		m.Draw()
		out := m.View()
		m.SetValueRange(0, 40)
		m.Canvas.Clear()
		m.Draw()
		return out + "\n--\n" + m.View()
	})
	register("heatmap/matrix-rows", func() string {
		m := heatmap.New(26, 9, heatmap.WithColorScale(hmRamp(10)), heatmap.WithValueRange(0, 9))
		m.PushAllMatrixRow([][]float64{
			{0, 1, 2, 3, 4},
			{5, 6, 7, 8, 9},
			{9, 8, 7, 6, 5},
			{4, 3, 2, 1, 0},
		})
		m.Draw()
		return m.View()
	})
	register("heatmap/cell-size-wide", func() string {
		m := heatmap.New(40, 10, heatmap.WithColorScale(hmRamp(16)), heatmap.WithValueRange(0, 11), heatmap.WithCellSize(2, 1))
		m.SetXYRange(-1, 7, -0.5, 2.5)
		m.SetViewXYRange(-1, 7, -0.5, 2.5)
		m.PushAll(hmGridPoints(4, 3, func(x, y int) float64 { return float64(x + y*4) }))
		m.Draw()
		return m.View()
	})
	register("heatmap/cell-size-fractional", func() string {
		m := heatmap.New(30, 8, heatmap.WithColorScale(hmRamp(16)), heatmap.WithValueRange(0, 8), heatmap.WithCellSize(0.5, 0.5))
		m.SetXYRange(0, 4, 0, 4)
		m.SetViewXYRange(0, 4, 0, 4)
		for i := 0; i < 8; i++ {
			m.Push(heatmap.NewHeatPoint(float64(i)/2, float64(i%4), float64(i)))
		}
		m.Draw()
		return m.View()
	})
	register("heatmap/only-x-labels", func() string {
		m := heatmap.New(36, 8, heatmap.WithColorScale(hmRamp(24)), heatmap.WithValueRange(0, 100), heatmap.WithCellSize(1, 1),
			heatmap.WithXLabels([]string{"jan", "feb", "mar", "apr", "may", "jun"}))
		m.SetYRange(-0.5, 2.5)
		m.SetViewYRange(-0.5, 2.5)
		m.PushAll(hmGridPoints(6, 3, func(x, y int) float64 { return hmVisits(y, x) }))
		m.Draw()
		return m.View()
	})
	register("heatmap/only-y-labels", func() string {
		m := heatmap.New(30, 9, heatmap.WithColorScale(hmRamp(24)), heatmap.WithValueRange(0, 100), heatmap.WithCellSize(1, 1),
			heatmap.WithYLabels([]string{"low", "medium", "high"}))
		m.SetXRange(-0.5, 5.5)
		m.SetViewXRange(-0.5, 5.5)
		m.PushAll(hmGridPoints(6, 3, func(x, y int) float64 { return hmVisits(y, x) }))
		m.Draw()
		return m.View()
	})
	register("heatmap/long-y-labels-margin", func() string {
		m := heatmap.New(40, 10, heatmap.WithColorScale(hmRamp(24)), heatmap.WithValueRange(0, 100), heatmap.WithCellSize(1, 1),
			heatmap.WithXLabels([]string{"a", "b", "c"}),
			heatmap.WithYLabels([]string{"x", "a much longer row name", "y"}))
		m.PushAll(hmGridPoints(3, 3, func(x, y int) float64 { return hmVisits(y, x) }))
		m.Draw()
		return m.View()
	})
	register("heatmap/dense-y-labels", func() string {
		var labels []string
		for i := 0; i < 30; i++ {
			labels = append(labels, string(rune('a'+i%26))+string(rune('0'+i/26)))
		}
		m := heatmap.New(30, 8, heatmap.WithColorScale(hmRamp(24)), heatmap.WithValueRange(0, 100), heatmap.WithCellSize(1, 1), heatmap.WithYLabels(labels))
		m.SetXRange(-0.5, 2.5)
		m.SetViewXRange(-0.5, 2.5)
		m.PushAll(hmGridPoints(3, 30, func(x, y int) float64 { return float64((x*13 + y*7) % 100) }))
		m.Draw()
		return m.View()
	})
	register("heatmap/zoom-view-range", func() string {
		m := hmWeek(48, 12, true)
		m.SetViewXYRange(1.5, 5.5, 1.5, 4.5)
		m.Canvas.Clear()
		m.Draw()
		return m.View()
	})
	register("heatmap/clear-data", func() string {
		m := hmWeek(48, 12, true)
		m.ClearData()
		m.Draw()
		out := m.View()
		m.Push(heatmap.NewHeatPointInt(2, 3, 80))
		m.Draw()
		return out + "\n--\n" + m.View()
	})
	register("heatmap/axis-drawn-with-points", func() string {
		m := heatmap.New(30, 10, heatmap.WithColorScale(hmRamp(12)), heatmap.WithValueRange(0, 20))
		m.SetXYRange(0, 10, 0, 5)
		m.SetViewXYRange(0, 10, 0, 5)
		m.DrawXYAxisAndLabel()
		m.PushAll(hmGridPoints(10, 5, func(x, y int) float64 { return float64(x + y*2) }))
		m.Draw()
		return m.View()
	})
	register("heatmap/auto-xy-range-single-cells", func() string {
		m := heatmap.New(30, 10, heatmap.WithColorScale(hmRamp(12)), heatmap.WithAutoValueRange())
		for i := -5; i <= 5; i++ {
			m.Push(heatmap.NewHeatPointInt(i, i*i/3-4, float64(i*i)))
		}
		m.DrawXYAxisAndLabel()
		m.Draw()
		return m.View()
	})
	register("heatmap/with-linechart-style", func() string {
		lm := linechart.New(28, 9, 0, 6, 0, 3, linechart.WithAutoXYRange(),
			linechart.WithStyles(lipgloss.NewStyle().Foreground(lipgloss.Color("3")), lipgloss.NewStyle().Foreground(lipgloss.Color("2")), lipgloss.NewStyle()))
		m := heatmap.New(28, 9, heatmap.WithStyle(lm), heatmap.WithColorScale(hmRamp(12)), heatmap.WithValueRange(0, 20))
		m.DrawXYAxisAndLabel()
		m.PushAll(hmGridPoints(7, 4, func(x, y int) float64 { return float64(x + y*3) }))
		m.Draw()
		return m.View()
	})
	register("heatmap/default-scale-swap", func() string {
		old := heatmap.SetDefaultColorScale(hmRamp(4))
		defer heatmap.SetDefaultColorScale(old)
		m := heatmap.New(20, 6, heatmap.WithValueRange(0, 9))
		m.PushAll(hmGridPoints(5, 3, func(x, y int) float64 { return float64(x + y*5) }))
		m.Draw()
		return m.View() + fmt.Sprintf("\nscale=%d", len(m.ColorScale))
	})
	register("heatmap/empty-scale-draws-nothing", func() string {
		m := heatmap.New(20, 6, heatmap.WithColorScale(nil), heatmap.WithValueRange(0, 9))
		m.PushAll(hmGridPoints(5, 3, func(x, y int) float64 { return float64(x + y*5) }))
		m.Draw()
		return m.View()
	})
	register("heatmap/hit-labels-api", func() string {
		m := hmWeek(48, 12, true)
		return strings.Join(m.XLabels(), ",") + "|" + strings.Join(m.YLabels(), ",") +
			fmt.Sprintf("|%d,%d|%d,%d", m.GraphWidth(), m.GraphHeight(), m.Origin().X, m.Origin().Y)
	})
	register("heatmap/viewport-update", func() string {
		m := hmWeek(48, 12, true)
		m.Canvas.ViewWidth = 20
		m.Canvas.ViewHeight = 6
		m.Canvas.Focus()
		out := m.View()
		for _, k := range []tea.KeyPressMsg{{Code: tea.KeyRight}, {Code: tea.KeyRight}, {Code: tea.KeyDown}, {Code: 'l', Text: "l"}} {
			m, _ = m.Update(k)
		}
		return out + "\n--\n" + m.View()
	})
}
