package main

import (
	"fmt"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
	"github.com/NimbleMarkets/ntcharts/v2/canvas/runes"
	"github.com/NimbleMarkets/ntcharts/v2/linechart"
	"github.com/NimbleMarkets/ntcharts/v2/linechart/streamlinechart"
)

func slcFg(c string) lipgloss.Style { return lipgloss.NewStyle().Foreground(lipgloss.Color(c)) }

// slcWave is a deterministic stand-in for upstream's random streaming example.
func slcWave(n int, period, amp, offset float64) []float64 {
	r := make([]float64, n)
	for i := range r {
		// triangle wave: exact in float64, no transcendental functions
		p := float64(i%int(period)) / period
		if p > 0.5 {
			p = 1 - p
		}
		r[i] = offset + amp*(4*p-1)
	}
	return r
}

func init() {
	// upstream examples/linechart/streaming
	register("streamlinechart/streaming_styled", func() string {
		m := streamlinechart.New(40, 12,
			streamlinechart.WithAxesStyles(slcFg("3"), slcFg("6")),
			streamlinechart.WithStyles(runes.ArcLineStyle, slcFg("4")),
			streamlinechart.WithYRange(-10, 10),
			streamlinechart.WithStream(slcWave(50, 12, 8, 0)))
		m.Draw()
		return m.View()
	})
	register("streamlinechart/thin_multi", func() string {
		m := streamlinechart.New(36, 10,
			streamlinechart.WithYRange(0, 20),
			streamlinechart.WithStyles(runes.ThinLineStyle, slcFg("2")),
			streamlinechart.WithDataSetStyles("hi", runes.ArcLineStyle, slcFg("1")),
			streamlinechart.WithStream(slcWave(30, 10, 5, 6)),
			streamlinechart.WithDataSetStream("hi", slcWave(25, 8, 3, 15)))
		m.DrawAll()
		return m.View()
	})
	register("streamlinechart/draw_data_sets_order", func() string {
		m := streamlinechart.New(30, 9, streamlinechart.WithYRange(0, 10))
		m.SetDataSetStyles("b", runes.ArcLineStyle, slcFg("5"))
		for i := 0; i < 20; i++ {
			m.PushDataSet("a", float64(i%10))
			m.PushDataSet("b", float64(9-i%10))
		}
		m.DrawDataSets([]string{"b", "a", "missing"})
		return m.View()
	})
	register("streamlinechart/xy_steps", func() string {
		m := streamlinechart.New(34, 12, streamlinechart.WithXYSteps(4, 3), streamlinechart.WithYRange(-5, 25),
			streamlinechart.WithStream(slcWave(40, 9, 12, 10)))
		m.Draw()
		return m.View()
	})
	register("streamlinechart/auto_range", func() string {
		m := streamlinechart.New(30, 10)
		for _, v := range []float64{3, 7, -4, 15, 9, 22, -8, 11, 5} {
			m.Push(v)
		}
		m.Draw()
		return m.View() + fmt.Sprintf("\n%v %v", m.MinY(), m.MaxY())
	})
	register("streamlinechart/ring_wraps", func() string {
		m := streamlinechart.New(20, 8, streamlinechart.WithYRange(0, 30))
		for i := 0; i < 70; i++ {
			m.Push(float64(i % 31))
		}
		m.Draw()
		return m.View()
	})
	register("streamlinechart/label_formatter", func() string {
		m := streamlinechart.New(36, 10, streamlinechart.WithYRange(0, 1))
		m.YLabelFormatter = func(i int, v float64) string { return fmt.Sprintf("%.0f%%", v*100) }
		m.UpdateGraphSizes()
		for _, v := range slcWave(40, 16, 0.4, 0.5) {
			m.Push(v)
		}
		m.Draw()
		return m.View()
	})
	register("streamlinechart/log_scale", func() string {
		m := streamlinechart.New(40, 10, streamlinechart.WithYScale(linechart.ScaleLog), streamlinechart.WithYRange(0.1, 1000),
			streamlinechart.WithStyles(runes.ArcLineStyle, slcFg("4")))
		for _, v := range []float64{0.2, 0.5, 3, 8, 40, 0, 120, 600, 900, 300, -1, 50, 10, 2, 1, 0.4} {
			m.Push(v)
		}
		m.Draw()
		return m.View()
	})
	register("streamlinechart/y2_axis", func() string {
		m := streamlinechart.New(40, 12,
			streamlinechart.WithYRange(0, 10),
			streamlinechart.WithY2Axis(linechart.Axis{Min: 0, Max: 1000, LabelStyle: slcFg("1")}),
			streamlinechart.WithDataSetYAxis("rpm", linechart.YAxisRight),
			streamlinechart.WithDataSetStyles("rpm", runes.ThinLineStyle, slcFg("1")),
			streamlinechart.WithStream(slcWave(30, 10, 4, 5)),
			streamlinechart.WithDataSetStream("rpm", slcWave(30, 14, 400, 500)))
		m.DrawAll()
		return m.View()
	})
	register("streamlinechart/y2_log_auto", func() string {
		m := streamlinechart.New(40, 12,
			streamlinechart.WithYRange(0, 100),
			streamlinechart.WithY2Axis(linechart.Axis{Min: 1, Max: 100, Scale: linechart.ScaleLog, AutoMax: true}),
			streamlinechart.WithDataSetYAxis("r", linechart.YAxisRight))
		for _, v := range []float64{2, 5, 30, 0, 200, 4000, 80, 9} {
			m.PushDataSet("r", v)
			m.Push(v / 50)
		}
		m.DrawAll()
		a, _ := m.Y2Axis()
		return m.View() + fmt.Sprintf("\n%v %v", a.Min, a.Max)
	})
	register("streamlinechart/clear_y2", func() string {
		m := streamlinechart.New(36, 10, streamlinechart.WithYRange(0, 10),
			streamlinechart.WithY2Axis(linechart.Axis{Min: 0, Max: 100}),
			streamlinechart.WithDataSetYAxis("r", linechart.YAxisRight),
			streamlinechart.WithDataSetStream("r", []float64{10, 30, 80, 50, 90}))
		m.ClearY2Axis()
		m.DrawAll()
		return m.View()
	})
	register("streamlinechart/keys_zoom_move", func() string {
		m := streamlinechart.New(36, 12, streamlinechart.WithYRange(0, 40), streamlinechart.WithStream(slcWave(40, 10, 15, 20)))
		m.Focus()
		for _, k := range []tea.KeyPressMsg{{Code: tea.KeyPgUp}, {Code: tea.KeyPgUp}, {Code: tea.KeyUp}, {Code: 'k', Text: "k"}, {Code: tea.KeyLeft}} {
			m, _ = m.Update(k)
		}
		m.Draw()
		return m.View() + fmt.Sprintf("\n%v %v", m.ViewMinY(), m.ViewMaxY())
	})
	register("streamlinechart/wheel_zoom", func() string {
		m := streamlinechart.New(36, 10, streamlinechart.WithYRange(-20, 20), streamlinechart.WithStream(slcWave(36, 12, 18, 0)))
		m.Focus()
		m, _ = m.Update(tea.MouseWheelMsg{Button: tea.MouseWheelUp})
		m, _ = m.Update(tea.MouseWheelMsg{Button: tea.MouseWheelUp})
		m, _ = m.Update(tea.MouseWheelMsg{Button: tea.MouseWheelUp})
		m, _ = m.Update(tea.MouseWheelMsg{Button: tea.MouseWheelDown})
		m.Draw()
		return m.View()
	})
	register("streamlinechart/view_range", func() string {
		m := streamlinechart.New(36, 10, streamlinechart.WithYRange(0, 100), streamlinechart.WithStream(slcWave(40, 20, 45, 50)))
		m.SetViewYRange(25, 75)
		m.Draw()
		return m.View()
	})
	register("streamlinechart/set_view_xy_range", func() string {
		m := streamlinechart.New(36, 10, streamlinechart.WithXYRange(0, 10, 0, 100), streamlinechart.WithXYSteps(2, 2),
			streamlinechart.WithStream(slcWave(40, 20, 45, 50)))
		m.SetViewXYRange(2, 8, 10, 60)
		m.Draw()
		return m.View()
	})
	register("streamlinechart/resize", func() string {
		m := streamlinechart.New(24, 8, streamlinechart.WithYRange(0, 10), streamlinechart.WithStream(slcWave(30, 6, 4, 5)))
		m.Draw()
		before := m.View()
		m.Resize(40, 12)
		m.Draw()
		mid := m.View()
		m.Resize(16, 6)
		m.Draw()
		return before + "\n--\n" + mid + "\n--\n" + m.View()
	})
	register("streamlinechart/clear_data", func() string {
		m := streamlinechart.New(30, 8, streamlinechart.WithYRange(0, 10),
			streamlinechart.WithStream([]float64{1, 2, 3, 4, 5}),
			streamlinechart.WithDataSetStream("x", []float64{9, 8, 7}))
		m.ClearDataSet("x")
		m.DrawAll()
		a := m.View()
		m.ClearAllData()
		m.Push(6)
		m.Push(2)
		m.DrawAll()
		return a + "\n--\n" + m.View()
	})
	register("streamlinechart/with_linechart", func() string {
		lc := linechart.New(30, 10, 0, 1, -5, 5, linechart.WithXYSteps(3, 3), linechart.WithStyles(slcFg("3"), slcFg("6"), slcFg("2")),
			linechart.WithUpdateHandler(linechart.YAxisNoZoomUpdateHandler(1)))
		m := streamlinechart.New(30, 10, streamlinechart.WithLineChart(&lc), streamlinechart.WithStream(slcWave(30, 8, 4, 0)))
		m.Focus()
		m, _ = m.Update(tea.MouseWheelMsg{Button: tea.MouseWheelUp})
		m.Draw()
		return m.View()
	})
	register("streamlinechart/set_y_axis", func() string {
		m := streamlinechart.New(36, 10, streamlinechart.WithStream(slcWave(30, 10, 40, 50)))
		m.SetYAxis(linechart.Axis{Min: 0, Max: 100, ViewMin: 10, ViewMax: 90,
			LabelFormatter: func(i int, v float64) string { return fmt.Sprintf("%.1f", v) }})
		m.Draw()
		return m.View()
	})
}
