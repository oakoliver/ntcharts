package main

import (
	"fmt"
	"strings"

	"charm.land/lipgloss/v2"
	tea "charm.land/bubbletea/v2"
	"github.com/NimbleMarkets/ntcharts/v2/barchart"
	"github.com/NimbleMarkets/ntcharts/v2/canvas"
)

func bcFg(c string) lipgloss.Style { return lipgloss.NewStyle().Foreground(lipgloss.Color(c)) }

func bcBlock(c string) lipgloss.Style {
	return lipgloss.NewStyle().Foreground(lipgloss.Color(c)).Background(lipgloss.Color(c))
}

var (
	bcAxis  = bcFg("3")
	bcLabel = bcFg("63")
	bcRed   = bcBlock("9")
	bcGreen = bcBlock("2")
	bcCyan  = bcBlock("6")
	bcYel   = bcBlock("3")
)

func bcBar(label string, vs ...barchart.BarValue) barchart.BarData {
	return barchart.BarData{Label: label, Values: vs}
}

func bcV(name string, v float64, s lipgloss.Style) barchart.BarValue {
	return barchart.BarValue{Name: name, Value: v, Style: s}
}

// upstream example data: four bars of four segments, some negative
func bcExample() []barchart.BarData {
	return []barchart.BarData{
		bcBar("A", bcV("n1", 21.2, bcRed), bcV("n2", 10.1, bcGreen), bcV("n3", 6.5, bcCyan), bcV("n4", 7.7, bcYel)),
		bcBar("B", bcV("n1", 15.1, bcRed), bcV("n2", 15.1, bcGreen), bcV("n3", 3.3, bcCyan), bcV("n4", -7.7, bcYel)),
		bcBar("C", bcV("n1", 13.6, bcRed), bcV("n2", 14.1, bcGreen), bcV("n3", -4.4, bcCyan), bcV("n4", 4.4, bcYel)),
		bcBar("D", bcV("n1", 13.1, bcRed), bcV("n2", 11.1, bcGreen), bcV("n3", 10.9, bcCyan), bcV("n4", -9.8, bcYel)),
	}
}

func bcSimple() []barchart.BarData {
	return []barchart.BarData{
		bcBar("Mon", bcV("v", 3, bcRed)),
		bcBar("Tue", bcV("v", 7.5, bcGreen)),
		bcBar("Wed", bcV("v", 5.25, bcCyan)),
		bcBar("Thu", bcV("v", 9.9, bcYel)),
		bcBar("Fri", bcV("v", 1.125, bcRed)),
	}
}

func bcDraw(m barchart.Model) string {
	m.Draw()
	return m.View()
}

func init() {
	register("barchart/vertical-styled", func() string {
		m := barchart.New(23, 12, barchart.WithDataSet(bcExample()), barchart.WithStyles(bcAxis, bcLabel))
		return bcDraw(m)
	})
	register("barchart/vertical-simple-labels", func() string {
		m := barchart.New(20, 10, barchart.WithDataSet(bcSimple()), barchart.WithStyles(bcAxis, bcLabel))
		return bcDraw(m)
	})
	register("barchart/vertical-stacked-positive", func() string {
		m := barchart.New(16, 14, barchart.WithStyles(bcAxis, bcLabel))
		m.PushAll([]barchart.BarData{
			bcBar("a", bcV("x", 4.3, bcRed), bcV("y", 2.7, bcGreen), bcV("z", 1.4, bcCyan)),
			bcBar("b", bcV("x", 1.2, bcRed), bcV("y", 6.6, bcGreen)),
			bcBar("c", bcV("x", 0.4, bcRed), bcV("y", 0.4, bcGreen), bcV("z", 0.4, bcCyan), bcV("w", 0.4, bcYel)),
		})
		return bcDraw(m)
	})
	register("barchart/vertical-negative-stacked", func() string {
		m := barchart.New(16, 14, barchart.WithStyles(bcAxis, bcLabel))
		m.PushAll([]barchart.BarData{
			bcBar("a", bcV("x", 4, bcRed), bcV("y", -3.3, bcGreen), bcV("z", -2.6, bcCyan)),
			bcBar("b", bcV("x", -5.5, bcRed), bcV("y", -1.2, bcGreen)),
			bcBar("c", bcV("x", 2.5, bcRed), bcV("y", 1.9, bcGreen), bcV("z", -0.7, bcCyan)),
		})
		return bcDraw(m)
	})
	register("barchart/vertical-negative-only", func() string {
		m := barchart.New(12, 10, barchart.WithStyles(bcAxis, bcLabel))
		m.PushAll([]barchart.BarData{
			bcBar("p", bcV("x", -2.3, bcRed)),
			bcBar("q", bcV("x", -6.4, bcGreen)),
			bcBar("r", bcV("x", -4.9, bcCyan)),
		})
		return bcDraw(m)
	})
	register("barchart/vertical-no-axis", func() string {
		m := barchart.New(23, 12, barchart.WithNoAxis(), barchart.WithDataSet(bcExample()))
		return bcDraw(m)
	})
	register("barchart/vertical-fixed-range", func() string {
		m := barchart.New(23, 12,
			barchart.WithDataSet(bcExample()),
			barchart.WithMaxValue(100.0), barchart.WithMinValue(-20.0),
			barchart.WithNoAutoMaxValue(), barchart.WithNoAxis())
		return bcDraw(m)
	})
	register("barchart/vertical-fixed-range-axis", func() string {
		m := barchart.New(23, 12,
			barchart.WithMaxValue(30.0), barchart.WithMinValue(-10.0),
			barchart.WithNoAutoMaxValue(), barchart.WithBarGap(0),
			barchart.WithStyles(bcAxis, bcLabel),
			barchart.WithDataSet(bcExample()))
		return bcDraw(m)
	})
	register("barchart/vertical-gap-zero", func() string {
		m := barchart.New(20, 10, barchart.WithBarGap(0), barchart.WithDataSet(bcSimple()))
		return bcDraw(m)
	})
	register("barchart/vertical-gap-two", func() string {
		m := barchart.New(24, 10, barchart.WithBarGap(2), barchart.WithDataSet(bcSimple()[:4]), barchart.WithStyles(bcAxis, bcLabel))
		return bcDraw(m)
	})
	register("barchart/vertical-fixed-bar-width", func() string {
		m := barchart.New(24, 10, barchart.WithNoAutoBarWidth(), barchart.WithBarWidth(3), barchart.WithDataSet(bcSimple()))
		return bcDraw(m)
	})
	register("barchart/vertical-label-truncated", func() string {
		m := barchart.New(15, 8, barchart.WithStyles(bcAxis, bcLabel))
		m.PushAll([]barchart.BarData{
			bcBar("alpha", bcV("v", 3, bcRed)),
			bcBar("bravo", bcV("v", 6, bcGreen)),
			bcBar("charlie", bcV("v", 4.5, bcCyan)),
		})
		return bcDraw(m)
	})
	register("barchart/vertical-unicode-label", func() string {
		// labels are cut by bytes upstream: a multi-byte rune can be split
		m := barchart.New(14, 8, barchart.WithStyles(bcAxis, bcLabel))
		m.PushAll([]barchart.BarData{
			bcBar("héllo", bcV("v", 3, bcRed)),
			bcBar("日本語", bcV("v", 6, bcGreen)),
			bcBar("ñ", bcV("v", 4.5, bcCyan)),
		})
		return bcDraw(m)
	})
	register("barchart/vertical-fractions", func() string {
		m := barchart.New(18, 6, barchart.WithMaxValue(8))
		for i := 0; i < 9; i++ {
			m.Push(bcBar(fmt.Sprint(i), bcV("v", float64(i)+float64(i)/9, bcGreen)))
		}
		return bcDraw(m)
	})
	register("barchart/vertical-auto-max-grows", func() string {
		m := barchart.New(20, 10, barchart.WithStyles(bcAxis, bcLabel))
		m.Push(bcBar("a", bcV("v", 2, bcRed)))
		m.Push(bcBar("b", bcV("v", 4, bcGreen)))
		first := bcDraw(m)
		m.Push(bcBar("c", bcV("v", 40, bcCyan)))
		return first + "\n--\n" + bcDraw(m) + fmt.Sprintf("\nmax=%v min=%v scale=%v", m.MaxValue(), m.MinValue(), m.Scale())
	})
	register("barchart/vertical-more-bars-than-width", func() string {
		m := barchart.New(7, 6, barchart.WithDataSet(bcSimple()))
		return bcDraw(m)
	})
	register("barchart/vertical-resize", func() string {
		m := barchart.New(20, 10, barchart.WithStyles(bcAxis, bcLabel), barchart.WithDataSet(bcSimple()[:3]))
		out := bcDraw(m)
		m.Resize(12, 7)
		out += "\n--\n" + bcDraw(m)
		m.Resize(30, 14)
		out += "\n--\n" + bcDraw(m)
		return out
	})
	register("barchart/vertical-clear-repush", func() string {
		m := barchart.New(20, 10, barchart.WithDataSet(bcExample()))
		m.Clear()
		m.PushAll(bcSimple()[:2])
		return bcDraw(m)
	})
	register("barchart/vertical-tiny", func() string {
		m := barchart.New(3, 3, barchart.WithDataSet(bcSimple()[:2]))
		return bcDraw(m)
	})
	register("barchart/horizontal-styled", func() string {
		m := barchart.New(40, 8, barchart.WithHorizontalBars(), barchart.WithDataSet(bcExample()), barchart.WithStyles(bcAxis, bcLabel))
		return bcDraw(m)
	})
	register("barchart/horizontal-simple-labels", func() string {
		m := barchart.New(30, 5, barchart.WithHorizontalBars(), barchart.WithDataSet(bcSimple()), barchart.WithStyles(bcAxis, bcLabel))
		return bcDraw(m)
	})
	register("barchart/horizontal-negative", func() string {
		m := barchart.New(36, 6, barchart.WithHorizontalBars(), barchart.WithStyles(bcAxis, bcLabel))
		m.PushAll([]barchart.BarData{
			bcBar("up", bcV("x", 8.4, bcRed), bcV("y", -3.2, bcGreen)),
			bcBar("down", bcV("x", -9.9, bcCyan)),
			bcBar("both", bcV("x", 4.4, bcYel), bcV("y", 2.2, bcRed), bcV("z", -5.6, bcGreen), bcV("w", -1.1, bcCyan)),
		})
		m.Resize(36, 6)
		return bcDraw(m)
	})
	register("barchart/horizontal-no-axis", func() string {
		m := barchart.New(30, 6, barchart.WithHorizontalBars(), barchart.WithNoAxis(), barchart.WithDataSet(bcExample()))
		return bcDraw(m)
	})
	register("barchart/horizontal-long-labels", func() string {
		m := barchart.New(34, 4, barchart.WithHorizontalBars(), barchart.WithStyles(bcAxis, bcLabel))
		m.PushAll([]barchart.BarData{
			bcBar("short", bcV("v", 3, bcRed)),
			bcBar("a rather long label", bcV("v", 5, bcGreen)),
			bcBar("mid label", bcV("v", 4, bcCyan)),
		})
		m.Resize(34, 4)
		return bcDraw(m)
	})
	register("barchart/horizontal-stale-label-width", func() string {
		// the label column is only recomputed on Resize/SetHorizontal/SetShowAxis,
		// so a label pushed afterwards is cut to the old width
		m := barchart.New(30, 3, barchart.WithHorizontalBars(), barchart.WithStyles(bcAxis, bcLabel))
		m.Push(bcBar("ab", bcV("v", 3, bcRed)))
		m.Resize(30, 3)
		m.Push(bcBar("abcdefgh", bcV("v", 4, bcGreen)))
		return bcDraw(m)
	})
	register("barchart/horizontal-fixed-range", func() string {
		m := barchart.New(32, 6, barchart.WithHorizontalBars(), barchart.WithMaxValue(50), barchart.WithMinValue(-30),
			barchart.WithNoAutoMaxValue(), barchart.WithBarGap(0), barchart.WithStyles(bcAxis, bcLabel),
			barchart.WithDataSet(bcSimple()[:4]))
		m.Resize(32, 6)
		return bcDraw(m)
	})
	register("barchart/toggle-orientation", func() string {
		m := barchart.New(28, 8, barchart.WithDataSet(bcExample()), barchart.WithStyles(bcAxis, bcLabel))
		out := bcDraw(m)
		m.SetHorizontal(true)
		out += "\n--\n" + bcDraw(m)
		m.SetShowAxis(false)
		out += "\n--\n" + bcDraw(m)
		m.SetHorizontal(false)
		return out + "\n--\n" + bcDraw(m)
	})
	register("barchart/hit-map", func() string {
		var sb strings.Builder
		for _, horizontal := range []bool{false, true} {
			m := barchart.New(15, 9, barchart.WithDataSet(bcExample()[:3]))
			if horizontal {
				m.SetHorizontal(true)
				m.Resize(15, 9)
			}
			m.Draw()
			for y := -1; y <= m.Height(); y++ {
				for x := -1; x <= m.Width(); x++ {
					d := m.BarDataFromPoint(canvas.Point{X: x, Y: y})
					names := make([]string, 0, len(d.Values))
					for _, v := range d.Values {
						names = append(names, v.Name)
					}
					fmt.Fprintf(&sb, "%d,%d=%s[%s] ", x, y, d.Label, strings.Join(names, "+"))
				}
				sb.WriteString("\n")
			}
		}
		return sb.String()
	})
	register("barchart/viewport-update", func() string {
		m := barchart.New(20, 8, barchart.WithDataSet(bcSimple()[:4]), barchart.WithStyles(bcAxis, bcLabel))
		m.Draw()
		m.Canvas.ViewWidth = 8
		m.Canvas.ViewHeight = 5
		m.Canvas.Focus()
		out := m.View()
		for _, k := range []tea.KeyPressMsg{{Code: tea.KeyRight}, {Code: tea.KeyRight}, {Code: tea.KeyDown}, {Code: 'l', Text: "l"}} {
			m, _ = m.Update(k)
		}
		return out + "\n--\n" + m.View()
	})
}
