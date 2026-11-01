package main

import (
	"fmt"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
	"github.com/NimbleMarkets/ntcharts/v2/canvas"
	"github.com/NimbleMarkets/ntcharts/v2/canvas/runes"
	"github.com/NimbleMarkets/ntcharts/v2/linechart"
)

func lcFg(c string) lipgloss.Style { return lipgloss.NewStyle().Foreground(lipgloss.Color(c)) }

var (
	lcAxis  = lcFg("3")
	lcLabel = lcFg("6")
	lcLine  = lcFg("4")
	lcRed   = lcFg("9")
	lcGreen = lcFg("10")
)

func lcPt(x, y float64) canvas.Float64Point { return canvas.Float64Point{X: x, Y: y} }

func lcPath(m *linechart.Model, ls runes.LineStyle, s lipgloss.Style, pts ...canvas.Float64Point) {
	for i := 1; i < len(pts); i++ {
		m.DrawLineWithStyle(pts[i-1], pts[i], ls, s)
	}
}

var lcZigzag = []canvas.Float64Point{{X: 0, Y: 2}, {X: 3, Y: 9}, {X: 6, Y: 4}, {X: 9, Y: 13}, {X: 12, Y: 1}, {X: 15, Y: 11}, {X: 18, Y: 7}, {X: 20, Y: 15}}

func lcKey(code rune) tea.KeyPressMsg { return tea.KeyPressMsg{Code: code} }

func init() {
	// upstream examples/linechart/lines: arc and thin lines with styles
	register("linechart/lines_styled", func() string {
		m := linechart.New(40, 14, 0, 20, 0, 16, linechart.WithXYSteps(3, 3), linechart.WithStyles(lcAxis, lcLabel, lcLine))
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ArcLineStyle, lcLine, lcZigzag...)
		lcPath(&m, runes.ThinLineStyle, lcRed, lcPt(0, 14), lcPt(10, 3), lcPt(20, 9))
		return m.View()
	})
	register("linechart/thin_lines_overlap", func() string {
		m := linechart.New(32, 12, -10, 10, -10, 10)
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ThinLineStyle, lcGreen, lcPt(-10, -10), lcPt(10, 10))
		lcPath(&m, runes.ThinLineStyle, lcRed, lcPt(-10, 10), lcPt(10, -10))
		lcPath(&m, runes.ArcLineStyle, lcLine, lcPt(-10, 0), lcPt(10, 0))
		lcPath(&m, runes.ArcLineStyle, lcLine, lcPt(0, -10), lcPt(0, 10))
		return m.View()
	})
	// upstream examples/linechart/circles
	register("linechart/circles", func() string {
		m := linechart.New(44, 18, -20, 20, -20, 20, linechart.WithXYSteps(4, 4), linechart.WithStyles(lcAxis, lcLabel, lcLine))
		m.DrawXYAxisAndLabel()
		m.DrawRuneCircle(lcPt(0, 0), 10, '*')
		m.DrawRuneCircleWithStyle(lcPt(-8, 6), 5, 'o', lcRed)
		m.DrawBrailleCircle(lcPt(8, -6), 7)
		m.DrawBrailleCircleWithStyle(lcPt(12, 12), 4, lcGreen)
		return m.View()
	})
	// upstream examples/linechart/scatter
	register("linechart/scatter", func() string {
		m := linechart.New(36, 14, 0, 100, 0, 100, linechart.WithXYSteps(4, 2), linechart.WithStyles(lcAxis, lcLabel, lcRed))
		m.DrawXYAxisAndLabel()
		for i := 0; i < 40; i++ {
			x := float64((i*37)%100) + 0.5
			y := float64((i*61+13)%100) * 0.97
			r := '•'
			if i%3 == 0 {
				r = 'x'
			}
			m.DrawRune(lcPt(x, y), r)
		}
		return m.View()
	})
	register("linechart/braille_lines", func() string {
		m := linechart.New(40, 12, 0, 20, 0, 16, linechart.WithStyles(lcAxis, lcLabel, lcLine))
		m.DrawXYAxisAndLabel()
		for i := 1; i < len(lcZigzag); i++ {
			m.DrawBrailleLine(lcZigzag[i-1], lcZigzag[i])
		}
		m.DrawBrailleLineWithStyle(lcPt(0, 16), lcPt(20, 0), lcRed)
		return m.View()
	})
	register("linechart/rune_lines", func() string {
		m := linechart.New(30, 10, 0, 10, 0, 10, linechart.WithMaxInterpolationPoints(100))
		m.DrawXYAxisAndLabel()
		m.DrawRuneLine(lcPt(0, 0), lcPt(10, 10), '#')
		m.DrawRuneLineWithStyle(lcPt(0, 10), lcPt(10, 0), '+', lcGreen)
		return m.View()
	})
	register("linechart/label_formatters", func() string {
		m := linechart.New(44, 12, 0.5, 3.25, -0.4, 1.1,
			linechart.WithXYSteps(5, 2),
			linechart.WithXLabelFormatter(func(i int, v float64) string { return fmt.Sprintf("%.2fs", v) }),
			linechart.WithYLabelFormatter(func(i int, v float64) string { return fmt.Sprintf("%.1f%%", v*100) }),
			linechart.WithStyles(lcAxis, lcLabel, lcLine))
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ArcLineStyle, lcLine, lcPt(0.5, 0), lcPt(1.2, 1.1), lcPt(2.1, -0.4), lcPt(3.25, 0.7))
		return m.View()
	})
	// fractional ranges exercise Go's fused multiply-add in the label walk
	register("linechart/fractional_labels", func() string {
		m := linechart.New(50, 16, 0.1, 0.7, 0.3, 1.9,
			linechart.WithXYSteps(4, 1),
			linechart.WithXLabelFormatter(func(i int, v float64) string { return fmt.Sprintf("%.3f", v) }),
			linechart.WithYLabelFormatter(func(i int, v float64) string { return fmt.Sprintf("%.4f", v) }))
		m.DrawXYAxisAndLabel()
		return m.View()
	})
	register("linechart/default_labels_repeat", func() string {
		m := linechart.New(30, 14, 0, 3, 0, 2, linechart.WithXYSteps(1, 1))
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ArcLineStyle, lcLine, lcPt(0, 0), lcPt(1.5, 2), lcPt(3, 0.5))
		return m.View()
	})
	register("linechart/negative_ranges", func() string {
		m := linechart.New(36, 12, -100, -10, -50, -5, linechart.WithXYSteps(3, 2))
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ArcLineStyle, lcLine, lcPt(-100, -50), lcPt(-70, -5), lcPt(-40, -30), lcPt(-10, -12))
		m.DrawRune(lcPt(-55, -20), 'o')
		return m.View()
	})
	register("linechart/no_axes", func() string {
		m := linechart.New(24, 8, 0, 10, 0, 10, linechart.WithXYSteps(0, 0))
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ArcLineStyle, lcLine, lcPt(0, 0), lcPt(5, 10), lcPt(10, 3))
		m.DrawRune(lcPt(2, 8), '*')
		return m.View()
	})
	register("linechart/log_y_styled", func() string {
		m := linechart.New(40, 14, 0, 10, 1, 1e5, linechart.WithYScale(linechart.ScaleLog), linechart.WithStyles(lcAxis, lcLabel, lcLine))
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ArcLineStyle, lcLine, lcPt(0, 1), lcPt(2, 30), lcPt(4, 7), lcPt(6, 900), lcPt(8, 2e4), lcPt(10, 1e5))
		return m.View()
	})
	register("linechart/log_xy", func() string {
		m := linechart.New(48, 14, 0.01, 1e4, 0.5, 5000, linechart.WithXScale(linechart.ScaleLog), linechart.WithYScale(linechart.ScaleLog))
		m.DrawXYAxisAndLabel()
		for _, v := range []float64{0.01, 0.05, 0.3, 2, 15, 80, 600, 4000, 1e4} {
			m.DrawRune(lcPt(v, v/2+0.5), '*')
		}
		m.DrawBrailleLine(lcPt(0.01, 5000), lcPt(1e4, 0.5))
		return m.View()
	})
	register("linechart/log_minor_ticks", func() string {
		m := linechart.New(40, 14, 1, 10, 20, 500, linechart.WithXScale(linechart.ScaleLog), linechart.WithYScale(linechart.ScaleLog),
			linechart.WithXLabelFormatter(func(i int, v float64) string { return fmt.Sprint(v) }),
			linechart.WithYLabelFormatter(func(i int, v float64) string { return fmt.Sprint(v) }))
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ThinLineStyle, lcLine, lcPt(1, 20), lcPt(3, 300), lcPt(10, 45))
		return m.View()
	})
	register("linechart/log_narrow_even", func() string {
		m := linechart.New(36, 10, 30, 40, 30, 40, linechart.WithXScale(linechart.ScaleLog), linechart.WithYScale(linechart.ScaleLog),
			linechart.WithXLabelFormatter(func(i int, v float64) string { return fmt.Sprintf("%.1f", v) }),
			linechart.WithYLabelFormatter(func(i int, v float64) string { return fmt.Sprintf("%.2f", v) }))
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ArcLineStyle, lcLine, lcPt(30, 31), lcPt(35, 39), lcPt(40, 33))
		return m.View()
	})
	register("linechart/log_zoom_pan", func() string {
		m := linechart.New(40, 12, 1, 1e6, 1, 1e6, linechart.WithXScale(linechart.ScaleLog), linechart.WithYScale(linechart.ScaleLog))
		m.ZoomIn(1, 0.5)
		m.MoveRight(0.7)
		m.MoveUp(0.3)
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ArcLineStyle, lcLine, lcPt(1, 1), lcPt(1e3, 1e5), lcPt(1e6, 30))
		return m.View() + fmt.Sprintf("\n%v %v %v %v", m.ViewMinX(), m.ViewMaxX(), m.ViewMinY(), m.ViewMaxY())
	})
	register("linechart/y2_linear", func() string {
		red := lcFg("1")
		m := linechart.New(44, 14, 0, 10, 0, 50,
			linechart.WithStyles(lcAxis, lcLabel, lcLine),
			linechart.WithY2Axis(linechart.Axis{Min: -200, Max: 600, LabelStyle: red}))
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ArcLineStyle, lcLine, lcPt(0, 5), lcPt(3, 40), lcPt(6, 20), lcPt(10, 48))
		r := []float64{-150, 400, 100, 550, -50}
		for i := 1; i < len(r); i++ {
			m.DrawLineWithStyle(lcPt(float64(i-1)*2.5, m.Y2ToY(r[i-1])), lcPt(float64(i)*2.5, m.Y2ToY(r[i])), runes.ThinLineStyle, red)
		}
		return m.View()
	})
	register("linechart/y2_log_zoomed", func() string {
		m := linechart.New(46, 14, 0, 10, 0, 100,
			linechart.WithY2Axis(linechart.Axis{Min: 1, Max: 1e5, Scale: linechart.ScaleLog}))
		m.SetViewYRange(20, 80)
		m.DrawXYAxisAndLabel()
		for _, v := range []float64{3, 40, 900, 2e4} {
			m.DrawRune(lcPt(v/2e3, m.Y2ToY(v)), 'o')
		}
		m.DrawBrailleLine(lcPt(0, 20), lcPt(10, 80))
		a, _ := m.Y2Axis()
		return m.View() + fmt.Sprintf("\n%v %v", a.ViewMin, a.ViewMax)
	})
	register("linechart/y2_set_axes", func() string {
		m := linechart.New(40, 12, 0, 10, 0, 1)
		m.SetYAxis(linechart.Axis{Min: 0, Max: 1000, ViewMin: 100, ViewMax: 900, Scale: linechart.ScaleLinear, LabelStyle: lcLabel,
			LabelFormatter: func(i int, v float64) string { return fmt.Sprintf("%.0fk", v/100) }})
		m.SetY2Axis(linechart.Axis{Min: 0, Max: 1, LabelFormatter: func(i int, v float64) string { return fmt.Sprintf("%.2f", v) }})
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ArcLineStyle, lcLine, lcPt(0, 0), lcPt(5, 1000), lcPt(10, 500))
		return m.View()
	})
	register("linechart/auto_range_draw", func() string {
		m := linechart.New(36, 12, 0, 1, 0, 1, linechart.WithAutoXYRange())
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ArcLineStyle, lcLine, lcPt(-4, 3), lcPt(2, 12), lcPt(9, -6))
		m.Clear()
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ArcLineStyle, lcLine, lcPt(-4, 3), lcPt(2, 12), lcPt(9, -6))
		return m.View()
	})
	register("linechart/keys_zoom_move", func() string {
		m := linechart.New(40, 12, 0, 40, 0, 40)
		m.Focus()
		for _, k := range []tea.KeyPressMsg{lcKey(tea.KeyPgUp), lcKey(tea.KeyPgUp), lcKey(tea.KeyUp), lcKey(tea.KeyLeft), {Code: 'l', Text: "l"}, lcKey(tea.KeyPgDown)} {
			m, _ = m.Update(k)
		}
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ArcLineStyle, lcLine, lcPt(0, 0), lcPt(20, 40), lcPt(40, 10))
		return m.View() + fmt.Sprintf("\n%v %v %v %v", m.ViewMinX(), m.ViewMaxX(), m.ViewMinY(), m.ViewMaxY())
	})
	register("linechart/wheel_x_handler", func() string {
		m := linechart.New(40, 10, 0, 100, 0, 10, linechart.WithUpdateHandler(linechart.XAxisUpdateHandler(10)))
		m.Focus()
		m, _ = m.Update(tea.MouseWheelMsg{Button: tea.MouseWheelUp})
		m, _ = m.Update(tea.MouseWheelMsg{Button: tea.MouseWheelUp})
		m, _ = m.Update(lcKey(tea.KeyRight))
		m, _ = m.Update(lcKey(tea.KeyUp)) // ignored: X only
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ArcLineStyle, lcLine, lcPt(0, 0), lcPt(50, 10), lcPt(100, 2))
		return m.View()
	})
	register("linechart/nozoom_handlers", func() string {
		m := linechart.New(40, 10, 0, 100, 0, 100, linechart.WithUpdateHandler(linechart.XAxisNoZoomUpdateHandler(5)))
		m.SetViewXYRange(20, 60, 10, 50)
		m.Focus()
		m, _ = m.Update(tea.MouseWheelMsg{Button: tea.MouseWheelDown})
		m, _ = m.Update(tea.MouseWheelMsg{Button: tea.MouseWheelRight})
		m, _ = m.Update(lcKey(tea.KeyPgUp)) // ignored: no zoom
		m.UpdateHandler = linechart.YAxisNoZoomUpdateHandler(7)
		m, _ = m.Update(tea.MouseWheelMsg{Button: tea.MouseWheelUp})
		m, _ = m.Update(lcKey(tea.KeyDown))
		m, _ = m.Update(lcKey(tea.KeyDown))
		m.UpdateHandler = linechart.YAxisUpdateHandler(4)
		m, _ = m.Update(tea.MouseWheelMsg{Button: tea.MouseWheelUp})
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ThinLineStyle, lcLine, lcPt(0, 0), lcPt(100, 100))
		return m.View() + fmt.Sprintf("\n%v %v %v %v", m.ViewMinX(), m.ViewMaxX(), m.ViewMinY(), m.ViewMaxY())
	})
	register("linechart/blurred_ignores_update", func() string {
		m := linechart.New(30, 8, 0, 10, 0, 10)
		m, _ = m.Update(lcKey(tea.KeyPgUp))
		m.DrawXYAxisAndLabel()
		return m.View()
	})
	register("linechart/resize", func() string {
		m := linechart.New(30, 10, 0, 10, 0, 100)
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ArcLineStyle, lcLine, lcPt(0, 0), lcPt(10, 100))
		before := m.View()
		m.Resize(44, 14)
		m.Clear()
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ArcLineStyle, lcLine, lcPt(0, 0), lcPt(10, 100))
		return before + "\n--\n" + m.View()
	})
	register("linechart/set_steps_and_ranges", func() string {
		m := linechart.New(40, 12, 0, 10, 0, 10)
		m.SetXStep(6)
		m.SetYStep(4)
		m.SetXYRange(-50, 50, -1000, 1000)
		m.SetViewXYRange(-20, 40, -500, 800)
		m.DrawXYAxisAndLabel()
		lcPath(&m, runes.ArcLineStyle, lcLine, lcPt(-50, -1000), lcPt(0, 900), lcPt(50, 0))
		return m.View()
	})
	// labels printed with their shortest float representation expose the
	// last bit of each label value, where Go's fused multiply-add rounds once
	register("linechart/fma_label_values", func() string {
		m := linechart.New(120, 14, 0.1, 0.7, 0.3, 1.9,
			linechart.WithXYSteps(20, 1),
			linechart.WithXLabelFormatter(func(i int, v float64) string { return fmt.Sprint(v) }),
			linechart.WithYLabelFormatter(func(i int, v float64) string { return fmt.Sprint(v) }),
			linechart.WithY2Axis(linechart.Axis{Min: 0.7, Max: 2.3, LabelFormatter: func(i int, v float64) string { return fmt.Sprint(v) }}))
		m.SetViewYRange(0.35, 1.7)
		m.DrawXYAxisAndLabel()
		a, _ := m.Y2Axis()
		return m.View() + fmt.Sprintf("\n%v %v %v", a.ViewMin, a.ViewMax, m.Y2ToY(1.3))
	})
}
