package main

import (
	"fmt"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
	"github.com/NimbleMarkets/ntcharts/v2/canvas"
	"github.com/NimbleMarkets/ntcharts/v2/canvas/runes"
	"github.com/NimbleMarkets/ntcharts/v2/linechart"
	"github.com/NimbleMarkets/ntcharts/v2/linechart/wavelinechart"
)

func wlcFg(c string) lipgloss.Style { return lipgloss.NewStyle().Foreground(lipgloss.Color(c)) }

// wlcTri returns n points of a triangle wave over x in [x0, x0+n*dx).
func wlcTri(n int, x0, dx, amp float64) []canvas.Float64Point {
	r := make([]canvas.Float64Point, n)
	for i := range r {
		p := float64(i%8) / 8
		if p > 0.5 {
			p = 1 - p
		}
		r[i] = canvas.Float64Point{X: x0 + float64(i)*dx, Y: amp * (4*p - 1)}
	}
	return r
}

func init() {
	// upstream examples/linechart/wavelines
	register("wavelinechart/wavelines_styled", func() string {
		m := wavelinechart.New(40, 14,
			wavelinechart.WithXYRange(0, 20, -10, 10),
			wavelinechart.WithAxesStyles(wlcFg("3"), wlcFg("6")),
			wavelinechart.WithStyles(runes.ArcLineStyle, wlcFg("4")),
			wavelinechart.WithDataSetStyles("b", runes.ThinLineStyle, wlcFg("9")),
			wavelinechart.WithPoints(wlcTri(21, 0, 1, 8)),
			wavelinechart.WithDataSetPoints("b", wlcTri(11, 0.5, 2, 5)))
		m.DrawAll()
		return m.View()
	})
	register("wavelinechart/sparse_points", func() string {
		m := wavelinechart.New(36, 10, wavelinechart.WithXRange(0, 100), wavelinechart.WithYRange(0, 50))
		for _, p := range []canvas.Float64Point{{X: 5, Y: 10}, {X: 30, Y: 45}, {X: 31, Y: 2}, {X: 70, Y: 25}, {X: 99, Y: 50}} {
			m.Plot(p)
		}
		m.Draw()
		return m.View()
	})
	register("wavelinechart/draw_all_includes_default", func() string {
		m := wavelinechart.New(30, 10, wavelinechart.WithXYRange(0, 10, -5, 5),
			wavelinechart.WithDataSetPoints("x", []canvas.Float64Point{{X: 2, Y: 4}, {X: 6, Y: -4}}))
		m.DrawAll()
		return m.View()
	})
	register("wavelinechart/auto_range", func() string {
		m := wavelinechart.New(36, 12)
		for _, p := range wlcTri(16, -3, 1.5, 30) {
			m.Plot(p)
		}
		m.Draw()
		return m.View() + fmt.Sprintf("\n%v %v %v %v", m.MinX(), m.MaxX(), m.MinY(), m.MaxY())
	})
	register("wavelinechart/xy_steps_formatters", func() string {
		m := wavelinechart.New(40, 12, wavelinechart.WithXYSteps(6, 2), wavelinechart.WithXYRange(0, 2, -1, 1),
			wavelinechart.WithPoints(wlcTri(17, 0, 0.125, 0.9)))
		m.XLabelFormatter = func(i int, v float64) string { return fmt.Sprintf("%.2fπ", v) }
		m.YLabelFormatter = func(i int, v float64) string { return fmt.Sprintf("%+.1f", v) }
		m.UpdateGraphSizes()
		m.Draw()
		return m.View()
	})
	register("wavelinechart/no_axes", func() string {
		m := wavelinechart.New(30, 8, wavelinechart.WithXYSteps(0, 0), wavelinechart.WithXYRange(0, 10, -5, 5),
			wavelinechart.WithPoints(wlcTri(11, 0, 1, 4)))
		m.Draw()
		return m.View()
	})
	register("wavelinechart/log_x", func() string {
		m := wavelinechart.New(40, 10, wavelinechart.WithXScale(linechart.ScaleLog), wavelinechart.WithXYRange(1, 1e4, 0, 10))
		for _, p := range []canvas.Float64Point{{X: 1, Y: 2}, {X: 5, Y: 9}, {X: 30, Y: 4}, {X: 200, Y: 7}, {X: 0, Y: 5}, {X: 1500, Y: 1}, {X: 9000, Y: 10}} {
			m.Plot(p)
		}
		m.Draw()
		return m.View()
	})
	register("wavelinechart/log_y_styled", func() string {
		m := wavelinechart.New(40, 12, wavelinechart.WithYScale(linechart.ScaleLog), wavelinechart.WithXYRange(0, 10, 1, 1e4),
			wavelinechart.WithStyles(runes.ThinLineStyle, wlcFg("2")), wavelinechart.WithAxesStyles(wlcFg("8"), wlcFg("7")))
		for i, v := range []float64{3, 50, 1, 700, 20, 9000, 0, 150, 4, 1e4} {
			m.Plot(canvas.Float64Point{X: float64(i) + 0.5, Y: v})
		}
		m.Draw()
		return m.View()
	})
	register("wavelinechart/y2_axis", func() string {
		m := wavelinechart.New(42, 12,
			wavelinechart.WithXYRange(0, 10, 0, 10),
			wavelinechart.WithY2Axis(linechart.Axis{Min: -100, Max: 100, LabelStyle: wlcFg("1")}),
			wavelinechart.WithDataSetYAxis("r", linechart.YAxisRight),
			wavelinechart.WithDataSetStyles("r", runes.ThinLineStyle, wlcFg("1")),
			wavelinechart.WithPoints([]canvas.Float64Point{{X: 1, Y: 8}, {X: 4, Y: 3}, {X: 8, Y: 9}}),
			wavelinechart.WithDataSetPoints("r", []canvas.Float64Point{{X: 2, Y: -80}, {X: 5, Y: 60}, {X: 9, Y: -20}}))
		m.DrawAll()
		return m.View()
	})
	register("wavelinechart/y2_log", func() string {
		m := wavelinechart.New(42, 12,
			wavelinechart.WithXYRange(0, 10, 0, 10),
			wavelinechart.WithY2Axis(linechart.Axis{Min: 1, Max: 1000, Scale: linechart.ScaleLog, AutoMax: true}),
			wavelinechart.WithDataSetYAxis("r", linechart.YAxisRight),
			wavelinechart.WithDataSetPoints("r", []canvas.Float64Point{{X: 1, Y: 5}, {X: 3, Y: 0}, {X: 5, Y: 400}, {X: 7, Y: 5000}, {X: 9, Y: 20}}))
		m.DrawAll()
		return m.View()
	})
	register("wavelinechart/view_and_zoom", func() string {
		m := wavelinechart.New(40, 12, wavelinechart.WithXYRange(0, 20, -10, 10), wavelinechart.WithPoints(wlcTri(21, 0, 1, 9)))
		m.SetViewXYRange(4, 16, -6, 6)
		m.Draw()
		return m.View()
	})
	register("wavelinechart/keys", func() string {
		m := wavelinechart.New(40, 12, wavelinechart.WithXYRange(0, 20, -10, 10), wavelinechart.WithPoints(wlcTri(21, 0, 1, 9)))
		m.Focus()
		for _, k := range []tea.KeyPressMsg{{Code: tea.KeyPgUp}, {Code: tea.KeyPgUp}, {Code: tea.KeyRight}, {Code: tea.KeyRight}, {Code: 'h', Text: "h"}, {Code: tea.KeyUp}} {
			m, _ = m.Update(k)
		}
		m.Draw()
		return m.View() + fmt.Sprintf("\n%v %v", m.ViewMinX(), m.ViewMaxX())
	})
	register("wavelinechart/wheel_xy_handler", func() string {
		m := wavelinechart.New(40, 12, wavelinechart.WithXYRange(0, 20, -10, 10), wavelinechart.WithPoints(wlcTri(21, 0, 1, 9)),
			wavelinechart.WithUpdateHandler(linechart.XYAxesUpdateHandler(2, 1)))
		m.Focus()
		m, _ = m.Update(tea.MouseWheelMsg{Button: tea.MouseWheelUp})
		m, _ = m.Update(tea.MouseWheelMsg{Button: tea.MouseWheelUp})
		m, _ = m.Update(tea.KeyPressMsg{Code: tea.KeyDown})
		m.Draw()
		return m.View() + fmt.Sprintf("\n%v %v %v %v", m.ViewMinX(), m.ViewMaxX(), m.ViewMinY(), m.ViewMaxY())
	})
	register("wavelinechart/resize", func() string {
		m := wavelinechart.New(30, 10, wavelinechart.WithXYRange(0, 10, -5, 5), wavelinechart.WithPoints(wlcTri(11, 0, 1, 4)))
		m.Draw()
		before := m.View()
		m.Resize(46, 14)
		m.Draw()
		return before + "\n--\n" + m.View()
	})
	register("wavelinechart/clear_data", func() string {
		m := wavelinechart.New(30, 9, wavelinechart.WithXYRange(0, 10, -5, 5),
			wavelinechart.WithPoints(wlcTri(11, 0, 1, 4)),
			wavelinechart.WithDataSetPoints("b", []canvas.Float64Point{{X: 3, Y: 3}}))
		m.ClearDataSet("b")
		m.DrawAll()
		a := m.View()
		m.ClearAllData()
		m.Plot(canvas.Float64Point{X: 5, Y: 2})
		m.DrawAll()
		return a + "\n--\n" + m.View()
	})
	register("wavelinechart/set_scales_after_plot", func() string {
		m := wavelinechart.New(40, 12, wavelinechart.WithXYRange(1, 1000, 1, 1000))
		m.AutoMinX, m.AutoMaxX, m.AutoMinY, m.AutoMaxY = false, false, false, false
		for _, v := range []float64{1, 4, 20, 90, 300, 1000} {
			m.Plot(canvas.Float64Point{X: v, Y: v})
		}
		m.SetXScale(linechart.ScaleLog)
		m.SetYScale(linechart.ScaleLog)
		m.Draw()
		return m.View()
	})
}
