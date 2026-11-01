package main

import (
	"fmt"

	"charm.land/lipgloss/v2"
	"github.com/NimbleMarkets/ntcharts/v2/sparkline"
)

var (
	spPurple = lipgloss.NewStyle().Foreground(lipgloss.Color("63"))
	spRedOnG = lipgloss.NewStyle().Foreground(lipgloss.Color("9")).Background(lipgloss.Color("2"))
	spCyanOY = lipgloss.NewStyle().Foreground(lipgloss.Color("6")).Background(lipgloss.Color("3"))
	spYellow = lipgloss.NewStyle().Foreground(lipgloss.Color("3"))
	spHex    = lipgloss.NewStyle().Foreground(lipgloss.Color("#ff8800")).Bold(true)
)

// spData returns n deterministic pseudo-random values in 0..max.
func spData(n int, max float64) []float64 {
	d := make([]float64, n)
	for i := range d {
		d[i] = float64((i*37+11)%23) * max / 23.0
	}
	return d
}

// spRamp returns n values rising linearly to max.
func spRamp(n int, max float64) []float64 {
	d := make([]float64, n)
	for i := range d {
		d[i] = float64(i) * max / float64(n-1)
	}
	return d
}

func init() {
	register("sparkline/draw-columns", func() string {
		m := sparkline.New(25, 12, sparkline.WithMaxValue(100), sparkline.WithStyle(spPurple))
		m.PushAll(spData(25, 100))
		m.Draw()
		return m.View()
	})
	register("sparkline/draw-columns-background", func() string {
		m := sparkline.New(25, 5, sparkline.WithMaxValue(100), sparkline.WithStyle(spRedOnG))
		m.PushAll(spData(25, 100))
		m.Draw()
		return m.View()
	})
	register("sparkline/draw-columns-only", func() string {
		m := sparkline.New(25, 5, sparkline.WithMaxValue(100), sparkline.WithStyle(spRedOnG))
		m.PushAll(spData(25, 100))
		m.DrawColumnsOnly()
		return m.View()
	})
	register("sparkline/draw-braille", func() string {
		m := sparkline.New(25, 3, sparkline.WithMaxValue(100), sparkline.WithStyle(spYellow))
		m.PushAll(spData(25, 100))
		m.DrawBraille()
		return m.View()
	})
	register("sparkline/draw-braille-tall", func() string {
		m := sparkline.New(30, 8, sparkline.WithMaxValue(100), sparkline.WithStyle(spCyanOY))
		m.PushAll(spData(30, 100))
		m.DrawBraille()
		return m.View()
	})
	register("sparkline/draw-braille-partial", func() string {
		m := sparkline.New(30, 4, sparkline.WithStyle(spPurple))
		m.PushAll(spRamp(11, 50))
		m.DrawBraille()
		return m.View()
	})
	register("sparkline/draw-braille-interpolation-limit", func() string {
		m := sparkline.New(20, 6, sparkline.WithMaxValue(100), sparkline.WithMaxInterpolationPoints(3), sparkline.WithStyle(spPurple))
		m.PushAll(spData(20, 100))
		m.DrawBraille()
		return m.View()
	})
	register("sparkline/draw-quadrants", func() string {
		m := sparkline.New(12, 4, sparkline.WithMaxValue(100), sparkline.WithStyle(spYellow))
		m.PushAll(spData(24, 100))
		m.DrawQuadrants()
		return m.View()
	})
	register("sparkline/draw-quadrants-columns-only", func() string {
		m := sparkline.New(12, 4, sparkline.WithMaxValue(100), sparkline.WithStyle(spRedOnG))
		m.PushAll(spData(17, 100))
		m.DrawQuadrantsColumnsOnly()
		return m.View()
	})
	register("sparkline/push-beyond-width", func() string {
		m := sparkline.New(10, 4, sparkline.WithMaxValue(50), sparkline.WithStyle(spPurple))
		out := ""
		for i, v := range spData(35, 50) {
			m.Push(v)
			if i == 4 || i == 9 || i == 14 || i == 24 || i == 34 {
				m.Draw()
				out += m.View() + fmt.Sprintf("\n-- after %d pushes\n", i+1)
			}
		}
		return out
	})
	register("sparkline/push-beyond-width-braille", func() string {
		m := sparkline.New(10, 3, sparkline.WithMaxValue(50), sparkline.WithStyle(spYellow))
		m.PushAll(spData(37, 50))
		m.DrawBraille()
		return m.View()
	})
	register("sparkline/push-beyond-width-quadrants", func() string {
		m := sparkline.New(6, 3, sparkline.WithMaxValue(50), sparkline.WithStyle(spYellow))
		m.PushAll(spData(40, 50))
		m.DrawQuadrants()
		return m.View()
	})
	register("sparkline/auto-max-grows", func() string {
		m := sparkline.New(16, 6, sparkline.WithStyle(spPurple))
		m.PushAll([]float64{0.2, 0.5, 0.9, 0.4})
		m.Draw()
		out := m.View() + fmt.Sprintf("\nmax=%v scale=%v\n", m.MaxValue(), m.Scale())
		m.PushAll([]float64{3, 7.5, 2})
		m.Draw()
		return out + m.View() + fmt.Sprintf("\nmax=%v scale=%v", m.MaxValue(), m.Scale())
	})
	register("sparkline/fixed-max-clips", func() string {
		m := sparkline.New(16, 5, sparkline.WithMaxValue(10), sparkline.WithNoAutoMaxValue(), sparkline.WithStyle(spPurple))
		m.PushAll([]float64{1, 4, 9, 14, 40, 7, 3, 0})
		m.Draw()
		return m.View() + fmt.Sprintf("\nmax=%v scale=%v", m.MaxValue(), m.Scale())
	})
	register("sparkline/negative-values-clamp", func() string {
		m := sparkline.New(12, 4, sparkline.WithMaxValue(10), sparkline.WithStyle(spPurple))
		m.PushAll([]float64{-5, 3, -1, 8, -20, 6})
		m.Draw()
		return m.View()
	})
	register("sparkline/with-data-option", func() string {
		m := sparkline.New(14, 6, sparkline.WithData(spRamp(14, 9)), sparkline.WithStyle(spHex))
		m.Draw()
		return m.View()
	})
	register("sparkline/resize", func() string {
		m := sparkline.New(12, 5, sparkline.WithMaxValue(100), sparkline.WithStyle(spPurple))
		m.PushAll(spData(24, 100))
		m.Draw()
		out := m.View()
		m.Resize(6, 3)
		m.Draw()
		out += "\n--\n" + m.View()
		m.Resize(20, 6)
		m.PushAll(spData(5, 100))
		m.Draw()
		return out + "\n--\n" + m.View()
	})
	register("sparkline/resize-same-width", func() string {
		m := sparkline.New(12, 5, sparkline.WithMaxValue(100), sparkline.WithStyle(spPurple))
		m.PushAll(spData(12, 100))
		m.Resize(12, 8)
		m.Draw()
		return m.View()
	})
	register("sparkline/clear", func() string {
		m := sparkline.New(12, 4, sparkline.WithMaxValue(100), sparkline.WithStyle(spPurple))
		m.PushAll(spData(12, 100))
		m.Draw()
		m.Clear()
		m.Draw()
		out := m.View()
		m.PushAll(spData(3, 100))
		m.Draw()
		return out + "\n--\n" + m.View()
	})
	register("sparkline/height-one", func() string {
		m := sparkline.New(24, 1, sparkline.WithMaxValue(8), sparkline.WithStyle(spYellow))
		m.PushAll(spRamp(24, 8))
		m.Draw()
		return m.View()
	})
	register("sparkline/all-zero", func() string {
		m := sparkline.New(8, 3, sparkline.WithStyle(spPurple))
		m.PushAll([]float64{0, 0, 0, 0})
		m.Draw()
		out := m.View()
		m.DrawBraille()
		out += "\n--\n" + m.View()
		m.DrawQuadrants()
		return out + "\n--\n" + m.View()
	})
}
