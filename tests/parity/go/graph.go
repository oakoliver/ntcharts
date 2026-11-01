package main

import (
	"fmt"
	"strings"

	"charm.land/lipgloss/v2"
	"github.com/NimbleMarkets/ntcharts/v2/canvas"
	"github.com/NimbleMarkets/ntcharts/v2/canvas/graph"
	"github.com/NimbleMarkets/ntcharts/v2/canvas/runes"
)

func grFg(c string) lipgloss.Style { return lipgloss.NewStyle().Foreground(lipgloss.Color(c)) }

var (
	grPlain  = lipgloss.NewStyle()
	grRed    = grFg("1")
	grGreen  = grFg("2")
	grYellow = grFg("3")
	grBlue   = grFg("4")
	grBgOnly = lipgloss.NewStyle().Background(lipgloss.Color("5"))
	grBoldBg = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#ffffff")).Background(lipgloss.Color("#0000ff"))
	grHex    = grFg("#ff8800")
)

func grCanvas(w, h int) *canvas.Model {
	c := canvas.New(w, h)
	return &c
}

func grP(x, y int) canvas.Point { return canvas.Point{X: x, Y: y} }

func grPts(ps []canvas.Point) string {
	if len(ps) == 0 {
		return "nil"
	}
	var sb strings.Builder
	for _, p := range ps {
		fmt.Fprintf(&sb, "%d,%d ", p.X, p.Y)
	}
	return sb.String()
}

func grPlot(c *canvas.Model, ps []canvas.Point, r rune, s lipgloss.Style) {
	for _, p := range ps {
		c.SetRuneWithStyle(p, r, s)
	}
}

func grJoin(parts ...string) string { return strings.Join(parts, "\n--\n") }

func init() {
	// ---- axes and straight lines -------------------------------------------------
	axes := []struct {
		name string
		fn   func(*canvas.Model, canvas.Point, lipgloss.Style)
	}{
		{"xy", graph.DrawXYAxis},
		{"down", graph.DrawXYAxisDown},
		{"left", graph.DrawXYAxisLeft},
		{"all", graph.DrawXYAxisAll},
	}
	for _, a := range axes {
		register("graph/axes-"+a.name, func() string {
			c := grCanvas(14, 8)
			a.fn(c, grP(5, 4), grRed)
			return c.View()
		})
	}
	register("graph/axes-edges", func() string {
		var outs []string
		for _, a := range axes {
			c := grCanvas(9, 5)
			a.fn(c, grP(0, 0), grGreen)
			a.fn(c, grP(8, 4), grBlue)
			outs = append(outs, c.View())
			c = grCanvas(9, 5)
			a.fn(c, grP(-1, 2), grGreen)
			a.fn(c, grP(12, 2), grBlue)
			a.fn(c, grP(4, -2), grRed)
			a.fn(c, grP(4, 9), grYellow)
			outs = append(outs, c.View())
		}
		return grJoin(outs...)
	})
	register("graph/axes-overlap-styles", func() string {
		c := grCanvas(14, 8)
		graph.DrawXYAxisAll(c, grP(6, 4), grPlain)
		graph.DrawXYAxis(c, grP(3, 6), grBoldBg)
		graph.DrawXYAxisLeft(c, grP(9, 2), grHex)
		return c.View()
	})
	register("graph/lines-straight", func() string {
		c := grCanvas(14, 8)
		graph.DrawVerticalLineUp(c, grP(2, 5), grRed)
		graph.DrawVerticalLineDown(c, grP(4, 2), grGreen)
		graph.DrawHorizonalLineLeft(c, grP(9, 1), grBlue)
		graph.DrawHorizonalLineRight(c, grP(5, 6), grYellow)
		graph.DrawVerticalLineUp(c, grP(20, 5), grRed)
		graph.DrawVerticalLineDown(c, grP(-3, 2), grRed)
		graph.DrawHorizonalLineLeft(c, grP(5, 40), grRed)
		graph.DrawHorizonalLineRight(c, grP(5, -3), grRed)
		graph.DrawVerticalLineUp(c, grP(12, 40), grHex)
		return c.View()
	})

	// ---- line sequences ---------------------------------------------------------
	for _, ls := range []struct {
		name string
		ls   runes.LineStyle
	}{{"thin", runes.ThinLineStyle}, {"arc", runes.ArcLineStyle}} {
		register("graph/line-seq-"+ls.name+"-yaxis", func() string {
			c := grCanvas(18, 10)
			graph.DrawXYAxis(c, grP(1, 8), grGreen)
			seq := canvas.CanvasYCoordinates(8, []int{0, 1, 3, 2, 5, 5, 4, 7, 1, 0, 2, 6})
			graph.DrawLineSequence(c, true, 1, seq, ls.ls, grRed)
			return c.View()
		})
		register("graph/line-seq-"+ls.name+"-first-on-axis", func() string {
			c := grCanvas(18, 10)
			graph.DrawXYAxis(c, grP(1, 8), grGreen)
			graph.DrawLineSequence(c, true, 1, canvas.CanvasYCoordinates(8, []int{3, 4, 2, 6, 6, 1}), ls.ls, grRed)
			graph.DrawLineSequence(c, true, 1, canvas.CanvasYCoordinates(8, []int{3, 5, 5, 0, 2}), ls.ls, grBlue)
			return c.View()
		})
		register("graph/line-seq-"+ls.name+"-axis-down", func() string {
			c := grCanvas(18, 11)
			graph.DrawXYAxisDown(c, grP(2, 5), grGreen)
			graph.DrawLineSequence(c, true, 2, canvas.CanvasYCoordinates(5, []int{0, 2, -3, -3, 4, 1, -2}), ls.ls, grRed)
			graph.DrawLineSequence(c, true, 2, canvas.CanvasYCoordinates(5, []int{-4, -1, 3}), ls.ls, grBlue)
			return c.View()
		})
		register("graph/line-seq-"+ls.name+"-axis-all", func() string {
			c := grCanvas(18, 11)
			graph.DrawXYAxisAll(c, grP(6, 5), grGreen)
			graph.DrawLineSequence(c, false, 2, canvas.CanvasYCoordinates(5, []int{2, 2, 3, -1, -1, -3, 0, 4, 4, 1}), ls.ls, grRed)
			graph.DrawLineSequence(c, false, 3, canvas.CanvasYCoordinates(5, []int{-2, 0, 0, 2, 5, 1}), ls.ls, grBlue)
			return c.View()
		})
		register("graph/line-seq-"+ls.name+"-no-yaxis", func() string {
			c := grCanvas(18, 8)
			graph.DrawLineSequence(c, false, 3, []int{5, 5, 2, 6, 1, 1, 4, 3, 3, 0}, ls.ls, grYellow)
			graph.DrawLineSequence(c, false, 0, []int{0, 3, 6, 7, 2}, ls.ls, grHex)
			return c.View()
		})
		register("graph/line-seq-"+ls.name+"-ltr", func() string {
			c := grCanvas(14, 8)
			graph.DrawLineSequenceLeftToRight(c, grP(1, 3), grP(2, 3), ls.ls, grRed)
			graph.DrawLineSequenceLeftToRight(c, grP(2, 3), grP(3, 6), ls.ls, grRed)
			graph.DrawLineSequenceLeftToRight(c, grP(3, 6), grP(4, 1), ls.ls, grGreen)
			graph.DrawLineSequenceLeftToRight(c, grP(8, 1), grP(8, 5), ls.ls, grBlue)
			graph.DrawLineSequenceLeftToRight(c, grP(9, 1), grP(7, 5), ls.ls, grBlue)
			graph.DrawLineSequenceLeftToRight(c, grP(10, 2), grP(11, 2), ls.ls, grYellow)
			return c.View()
		})
	}
	register("graph/line-seq-empty-single", func() string {
		c := grCanvas(8, 4)
		graph.DrawLineSequence(c, false, 1, nil, runes.ThinLineStyle, grRed)
		graph.DrawLineSequence(c, true, 1, []int{}, runes.ArcLineStyle, grRed)
		graph.DrawLineSequence(c, false, 2, []int{2}, runes.ThinLineStyle, grBlue)
		graph.DrawLineSequence(c, false, 5, []int{9}, runes.ThinLineStyle, grBlue)
		return c.View()
	})
	register("graph/line-seq-overlap-mixed-styles", func() string {
		c := grCanvas(16, 9)
		graph.DrawLineSequence(c, false, 0, []int{4, 4, 4, 4, 4, 4, 4, 4, 4, 4}, runes.ThinLineStyle, grGreen)
		graph.DrawLineSequence(c, false, 0, []int{0, 2, 4, 6, 8, 6, 4, 2, 0}, runes.ArcLineStyle, grRed)
		graph.DrawLineSequence(c, false, 2, []int{8, 6, 4, 2, 0, 2, 4, 6, 8}, runes.ThinLineStyle, grBlue)
		return c.View()
	})

	// ---- line points --------------------------------------------------------------
	linePairs := [][2]canvas.Point{
		{grP(1, 1), grP(14, 6)},
		{grP(14, 1), grP(2, 7)},
		{grP(3, 8), grP(3, 1)},
		{grP(1, 4), grP(15, 4)},
		{grP(5, 0), grP(7, 8)},
		{grP(12, 8), grP(9, 0)},
	}
	for _, ls := range []struct {
		name string
		ls   runes.LineStyle
	}{{"thin", runes.ThinLineStyle}, {"arc", runes.ArcLineStyle}} {
		register("graph/line-points-"+ls.name, func() string {
			c := grCanvas(18, 10)
			for i, lp := range linePairs {
				st := []lipgloss.Style{grRed, grGreen, grBlue, grYellow, grHex, grBoldBg}[i]
				graph.DrawLinePoints(c, graph.GetLinePoints(lp[0], lp[1]), ls.ls, st)
			}
			return c.View()
		})
	}
	register("graph/get-line-points", func() string {
		var sb strings.Builder
		for _, lp := range linePairs {
			sb.WriteString(grPts(graph.GetLinePoints(lp[0], lp[1])) + "\n")
		}
		sb.WriteString(grPts(graph.GetLinePoints(grP(2, 2), grP(2, 2))) + "\n")
		sb.WriteString(grPts(graph.GetLinePoints(grP(-3, -3), grP(3, 2))) + "\n")
		sb.WriteString(grPts(graph.GetLinePoints(grP(0, 0), grP(10, 1))) + "\n")
		sb.WriteString(grPts(graph.GetLinePoints(grP(0, 0), grP(1, 10))) + "\n")
		sb.WriteString(grPts(graph.GetLinePoints(grP(0, 0), grP(20000, 3))) + "\n")
		sb.WriteString(grPts(graph.GetLinePointsWithLimit(grP(0, 0), grP(9, 3), 9)) + "\n")
		sb.WriteString(grPts(graph.GetLinePointsWithLimit(grP(0, 0), grP(9, 3), 10)) + "\n")
		sb.WriteString(grPts(graph.GetLinePointsWithLimit(grP(0, 0), grP(0, 12), 0)) + "\n")
		sb.WriteString(grPts(graph.GetLinePointsWithLimit(grP(0, 0), grP(0, 12), -5)) + "\n")
		return sb.String()
	})
	register("graph/line-points-degenerate", func() string {
		c := grCanvas(10, 5)
		graph.DrawLinePoints(c, nil, runes.ThinLineStyle, grRed)
		graph.DrawLinePoints(c, []canvas.Point{grP(1, 1)}, runes.ThinLineStyle, grRed)
		graph.DrawLinePoints(c, []canvas.Point{grP(1, 1), grP(1, 1), grP(2, 1), grP(2, 1)}, runes.ThinLineStyle, grGreen)
		graph.DrawLinePoints(c, []canvas.Point{grP(2, 3), grP(3, 3), grP(3, 2), grP(4, 2), grP(4, 3), grP(4, 4), grP(3, 4)}, runes.ArcLineStyle, grBlue)
		graph.DrawLinePoints(c, []canvas.Point{grP(7, 0), grP(8, 1), grP(7, 2), grP(8, 3), grP(9, 4)}, runes.ThinLineStyle, grYellow)
		graph.DrawLinePoints(c, []canvas.Point{grP(9, 0), grP(8, 1), grP(9, 2), grP(8, 3)}, runes.ArcLineStyle, grHex)
		return c.View()
	})

	// ---- circles -------------------------------------------------------------------
	register("graph/circle-points", func() string {
		var sb strings.Builder
		for r := -1; r <= 7; r++ {
			sb.WriteString(fmt.Sprintf("r=%d: %s\n", r, grPts(graph.GetCirclePoints(grP(5, 5), r))))
		}
		sb.WriteString(grPts(graph.GetCirclePoints(grP(100, -3), 20)) + "\n")
		return sb.String()
	})
	register("graph/full-circle-points", func() string {
		var sb strings.Builder
		for r := 0; r <= 6; r++ {
			sb.WriteString(fmt.Sprintf("r=%d: %s\n", r, grPts(graph.GetFullCirclePoints(grP(7, 7), r))))
		}
		return sb.String()
	})
	register("graph/circle-draw", func() string {
		c := grCanvas(24, 14)
		grPlot(c, graph.GetFullCirclePoints(grP(6, 6), 5), '#', grBlue)
		grPlot(c, graph.GetCirclePoints(grP(16, 6), 5), 'o', grRed)
		grPlot(c, graph.GetFullCirclePoints(grP(16, 6), 2), '*', grYellow)
		grPlot(c, graph.GetLinePoints(grP(0, 13), grP(23, 8)), '+', grGreen)
		return c.View()
	})
	register("graph/circle-line-points", func() string {
		c := grCanvas(24, 14)
		graph.DrawLinePoints(c, graph.GetCirclePoints(grP(7, 7), 5), runes.ThinLineStyle, grRed)
		graph.DrawLinePoints(c, graph.GetFullCirclePoints(grP(17, 7), 4), runes.ArcLineStyle, grBlue)
		return c.View()
	})
	register("graph/circle-limits", func() string {
		old := graph.DefaultMaxPoints
		defer func() { graph.DefaultMaxPoints = old }()
		var sb strings.Builder
		sb.WriteString(grPts(graph.GetCirclePointsWithLimit(grP(5, 5), 10, 30)) + "\n")
		sb.WriteString(fmt.Sprintf("%d\n", len(graph.GetCirclePointsWithLimit(grP(5, 5), 10, 64))))
		sb.WriteString(fmt.Sprintf("%d\n", len(graph.GetCirclePointsWithLimit(grP(5, 5), 10, 40))))
		sb.WriteString(fmt.Sprintf("%d\n", len(graph.GetCirclePointsWithLimit(grP(5, 5), 10, 0))))
		sb.WriteString(grPts(graph.GetFullCirclePointsWithLimit(grP(5, 5), 4, 40)) + "\n")
		sb.WriteString(fmt.Sprintf("%d\n", len(graph.GetFullCirclePointsWithLimit(grP(5, 5), 4, 200))))
		sb.WriteString(fmt.Sprintf("%d\n", len(graph.GetFullCirclePointsWithLimit(grP(5, 5), 4, 60))))
		sb.WriteString(fmt.Sprintf("%d\n", len(graph.GetFullCirclePointsWithLimit(grP(5, 5), 4, 0))))
		graph.DefaultMaxPoints = 25
		sb.WriteString(grPts(graph.GetCirclePoints(grP(0, 0), 8)) + "\n")
		sb.WriteString(fmt.Sprintf("%d\n", len(graph.GetCirclePoints(grP(0, 0), 3))))
		sb.WriteString(grPts(graph.GetLinePoints(grP(0, 0), grP(30, 1))) + "\n")
		sb.WriteString(fmt.Sprintf("%d\n", len(graph.GetLinePoints(grP(0, 0), grP(24, 1)))))
		sb.WriteString(fmt.Sprintf("%d\n", len(graph.GetLinePoints(grP(0, 0), grP(25, 1)))))
		sb.WriteString(grPts(graph.GetFullCirclePoints(grP(0, 0), 3)) + "\n")
		return sb.String()
	})

	// ---- braille ---------------------------------------------------------------------
	register("graph/braille-grid-basic", func() string {
		c := grCanvas(14, 7)
		g := graph.NewBrailleGrid(12, 5, 0, 10, 0, 5)
		for i := 0; i <= 10; i++ {
			g.Set(g.GridPoint(canvas.Float64Point{X: float64(i), Y: float64(i*i) / 20.0}))
		}
		graph.DrawBraillePatterns(c, grP(1, 1), g.BraillePatterns(), grRed)
		return c.View()
	})
	register("graph/braille-grid-lines", func() string {
		c := grCanvas(20, 8)
		graph.DrawXYAxis(c, grP(0, 7), grGreen)
		g := graph.NewBrailleGrid(18, 6, 0, 9, -2, 7)
		ys := []float64{-1.5, 2.25, 6, 0.5, 3.75, 3.75, -2, 7, 1}
		var prev canvas.Point
		for i, y := range ys {
			p := g.GridPoint(canvas.Float64Point{X: float64(i), Y: y})
			if i > 0 {
				for _, lp := range graph.GetLinePoints(prev, p) {
					g.Set(lp)
				}
			}
			prev = p
		}
		graph.DrawBraillePatterns(c, grP(1, 0), g.BraillePatterns(), grBlue)
		return c.View()
	})
	register("graph/braille-overlap", func() string {
		c := grCanvas(10, 4)
		g1 := graph.NewBrailleGrid(8, 3, 0, 15, 0, 11)
		g2 := graph.NewBrailleGrid(8, 3, 0, 15, 0, 11)
		for i := 0; i <= 15; i++ {
			g1.Set(g1.GridPoint(canvas.Float64Point{X: float64(i), Y: float64(i) * 11.0 / 15.0}))
			g2.Set(g2.GridPoint(canvas.Float64Point{X: float64(i), Y: float64(11) - float64(i)*11.0/15.0}))
		}
		c.SetString(grP(0, 3), "xxxxxxxxxx")
		graph.DrawBraillePatterns(c, grP(1, 0), g1.BraillePatterns(), grRed)
		graph.DrawBraillePatterns(c, grP(1, 0), g2.BraillePatterns(), grBlue)
		graph.DrawBraillePatterns(c, grP(1, 3), g2.BraillePatterns(), grGreen)
		graph.DrawBraillePatterns(c, grP(-2, -1), g1.BraillePatterns(), grYellow)
		return c.View()
	})
	register("graph/braille-runes", func() string {
		c := grCanvas(10, 3)
		graph.DrawBrailleRune(c, grP(0, 0), '⠁', grRed)
		graph.DrawBrailleRune(c, grP(0, 0), '⠈', grBlue)
		graph.DrawBrailleRune(c, grP(1, 0), runes.Null, grRed)
		graph.DrawBrailleRune(c, grP(2, 0), 'a', grRed)
		graph.DrawBrailleRune(c, grP(3, 0), '⣿', grGreen)
		graph.DrawBrailleRune(c, grP(3, 0), '⠀', grYellow)
		c.SetRune(grP(4, 0), 'Z')
		graph.DrawBrailleRune(c, grP(4, 0), '⠒', grHex)
		c.SetRune(grP(5, 0), runes.LineVertical)
		graph.DrawBrailleRune(c, grP(5, 0), '⡇', grHex)
		graph.DrawBrailleRune(c, grP(20, 0), '⠁', grRed)
		graph.DrawBrailleRune(c, grP(0, 1), '⠀', grRed)
		graph.DrawBraillePatterns(c, grP(0, 2), [][]rune{{'⠁', '⠀', '⠃'}, {'⠿'}}, grBlue)
		return c.View()
	})
	register("graph/braille-gridpoint", func() string {
		var sb strings.Builder
		for _, g := range []*graph.BrailleGrid{
			graph.NewBrailleGrid(10, 5, 0, 10, 0, 5),
			graph.NewBrailleGrid(10, 5, -5, 5, -2.5, 2.5),
			graph.NewBrailleGrid(10, 5, 3, 3, 1, 1),
			graph.NewBrailleGrid(4, 2, 0, 1, 0, 1),
			graph.NewBrailleGrid(7, 3, 100, 160, -3, 33),
		} {
			for _, f := range []canvas.Float64Point{{X: 0, Y: 0}, {X: 10, Y: 5}, {X: 5, Y: 2.5}, {X: -3, Y: 8}, {X: 0.5, Y: 0.25}, {X: 2.49, Y: 1.01}, {X: 1.0 / 3.0, Y: 2.0 / 3.0}, {X: 130, Y: 15}, {X: 0.05, Y: 0.95}} {
				p := g.GridPoint(f)
				sb.WriteString(fmt.Sprintf("%d,%d ", p.X, p.Y))
			}
			sb.WriteString("\n")
		}
		return sb.String()
	})
	register("graph/braille-clear-circle", func() string {
		c := grCanvas(14, 6)
		g := graph.NewBrailleGrid(12, 5, 0, 23, 0, 19)
		for _, p := range graph.GetCirclePoints(grP(11, 9), 8) {
			g.Set(p)
		}
		g.Clear()
		for _, p := range graph.GetCirclePoints(grP(11, 9), 7) {
			g.Set(p)
		}
		g.Set(grP(-1, 0))
		g.Set(grP(24, 19))
		graph.DrawBraillePatterns(c, grP(1, 0), g.BraillePatterns(), grGreen)
		return c.View()
	})

	// ---- columns ------------------------------------------------------------------------
	register("graph/columns-basic", func() string {
		c := grCanvas(18, 10)
		graph.DrawColumns(c, grP(0, 9), []float64{0.5, 1, 1.25, 2.75, 3.9, 4, 0, -1, 0.06, 0.04, 8, 9.4, 0.0625, 0.9999, 5.5, 0.1875}, grRed)
		return c.View()
	})
	colPairs := []struct {
		name string
		a, b []float64
	}{
		{"taller", []float64{1, 1.5, 2, 2.25, 3.5, 0.4, 1, 4}, []float64{2, 2.5, 3.5, 4.75, 5, 3, 1.5, 7.5}},
		{"shorter", []float64{2, 2.5, 3.5, 4.75, 5, 3, 1.5, 7.5}, []float64{1, 1.5, 2, 2.25, 3.5, 0.4, 1, 4}},
		{"same", []float64{2, 2.5, 3.25, 1.9, 4, 1, 3.5, 0.5}, []float64{2, 2.3, 3.3, 1.6, 4, 1.5, 3.2, 0.3}},
	}
	for _, cp := range colPairs {
		register("graph/columns-overlap-"+cp.name, func() string {
			c := grCanvas(10, 10)
			graph.DrawColumns(c, grP(0, 9), cp.a, grRed)
			graph.DrawColumns(c, grP(0, 9), cp.b, grBlue)
			return c.View()
		})
	}
	register("graph/columns-overlap-layers", func() string {
		c := grCanvas(10, 10)
		graph.DrawColumns(c, grP(0, 9), []float64{6, 5.5, 3.25, 2, 7.8, 1, 4, 4}, grRed)
		graph.DrawColumns(c, grP(0, 9), []float64{3, 5.5, 4.5, 1.25, 2.4, 1, 4.5, 3.75}, grBlue)
		graph.DrawColumns(c, grP(0, 9), []float64{1.5, 2.5, 6, 0.6, 8.9, 0.25, 2, 4}, grBoldBg)
		return c.View()
	})
	register("graph/columns-overlap-background-styles", func() string {
		c := grCanvas(8, 8)
		graph.DrawColumns(c, grP(0, 7), []float64{5, 5.5, 3.25, 6.5}, grBgOnly)
		graph.DrawColumns(c, grP(0, 7), []float64{3.5, 3, 4.75, 2}, grHex)
		graph.DrawColumns(c, grP(4, 7), []float64{2.5, 5, 3.25, 6.5}, grBoldBg)
		graph.DrawColumns(c, grP(4, 7), []float64{3.5, 6, 3.25, 0.5}, grPlain)
		return c.View()
	})
	register("graph/column-single-and-rune", func() string {
		c := grCanvas(12, 8)
		graph.DrawColumnBottomToTop(c, grP(0, 7), 3.5, grRed)
		graph.DrawColumnBottomToTop(c, grP(1, 7), 0, grRed)
		graph.DrawColumnBottomToTop(c, grP(2, 7), 20, grGreen)
		graph.DrawColumnBottomToTop(c, grP(3, 7), 2, grBlue)
		graph.DrawColumnBottomToTop(c, grP(30, 7), 2, grBlue)
		graph.DrawColumnBottomToTop(c, grP(4, 12), 2, grBlue)
		graph.DrawColumnRune(c, grP(5, 7), runes.LowerBlockThree, grRed)
		graph.DrawColumnRune(c, grP(5, 7), runes.FullBlock, grBlue)
		graph.DrawColumnRune(c, grP(6, 7), runes.FullBlock, grRed)
		graph.DrawColumnRune(c, grP(6, 7), runes.LowerBlockFive, grBlue)
		graph.DrawColumnRune(c, grP(7, 7), runes.LowerBlockTwo, grRed)
		graph.DrawColumnRune(c, grP(7, 7), runes.LowerBlockSeven, grBlue)
		graph.DrawColumnRune(c, grP(8, 7), runes.Null, grRed)
		graph.DrawColumnRune(c, grP(9, 7), 'x', grRed)
		graph.DrawColumnRune(c, grP(10, 7), runes.LeftBlockFour, grRed)
		c.SetRune(grP(11, 7), 'q')
		graph.DrawColumnRune(c, grP(11, 7), runes.FullBlock, grRed)
		return c.View()
	})

	// ---- rows ---------------------------------------------------------------------------
	register("graph/rows-basic", func() string {
		c := grCanvas(12, 18)
		graph.DrawRows(c, grP(0, 0), []float64{0.5, 1, 1.25, 2.75, 3.9, 4, 0, -1, 0.06, 0.04, 8, 13.4, 0.0625, 0.9999, 5.5, 0.1875}, grRed)
		return c.View()
	})
	for _, cp := range colPairs {
		register("graph/rows-overlap-"+cp.name, func() string {
			c := grCanvas(10, 8)
			graph.DrawRows(c, grP(0, 0), cp.a, grRed)
			graph.DrawRows(c, grP(0, 0), cp.b, grBlue)
			return c.View()
		})
	}
	register("graph/rows-overlap-layers", func() string {
		c := grCanvas(10, 8)
		graph.DrawRows(c, grP(0, 0), []float64{6, 5.5, 3.25, 2, 7.8, 1, 4, 4}, grRed)
		graph.DrawRows(c, grP(0, 0), []float64{3, 5.5, 4.5, 1.25, 2.4, 1, 4.5, 3.75}, grBlue)
		graph.DrawRows(c, grP(0, 0), []float64{1.5, 2.5, 6, 0.6, 8.9, 0.25, 2, 4}, grBoldBg)
		return c.View()
	})
	register("graph/rows-overlap-background-styles", func() string {
		c := grCanvas(8, 8)
		graph.DrawRows(c, grP(0, 0), []float64{5, 5.5, 3.25, 6.5}, grBgOnly)
		graph.DrawRows(c, grP(0, 0), []float64{3.5, 3, 4.75, 2}, grHex)
		graph.DrawRows(c, grP(0, 4), []float64{2.5, 5, 3.25, 6.5}, grBoldBg)
		graph.DrawRows(c, grP(0, 4), []float64{3.5, 6, 3.25, 0.5}, grPlain)
		return c.View()
	})
	register("graph/row-single-and-rune", func() string {
		c := grCanvas(8, 12)
		graph.DrawRowLeftToRight(c, grP(0, 0), 3.5, grRed)
		graph.DrawRowLeftToRight(c, grP(0, 1), 0, grRed)
		graph.DrawRowLeftToRight(c, grP(0, 2), 20, grGreen)
		graph.DrawRowLeftToRight(c, grP(0, 3), 2, grBlue)
		graph.DrawRowLeftToRight(c, grP(0, 30), 2, grBlue)
		graph.DrawRowLeftToRight(c, grP(10, 4), 2, grBlue)
		graph.DrawRowRune(c, grP(0, 5), runes.LeftBlockThree, grRed)
		graph.DrawRowRune(c, grP(0, 5), runes.FullBlock, grBlue)
		graph.DrawRowRune(c, grP(0, 6), runes.FullBlock, grRed)
		graph.DrawRowRune(c, grP(0, 6), runes.LeftBlockFive, grBlue)
		graph.DrawRowRune(c, grP(0, 7), runes.LeftBlockTwo, grRed)
		graph.DrawRowRune(c, grP(0, 7), runes.LeftBlockSeven, grBlue)
		graph.DrawRowRune(c, grP(0, 8), runes.Null, grRed)
		graph.DrawRowRune(c, grP(0, 9), 'x', grRed)
		graph.DrawRowRune(c, grP(0, 10), runes.LowerBlockFour, grRed)
		c.SetRune(grP(0, 11), 'q')
		graph.DrawRowRune(c, grP(0, 11), runes.FullBlock, grRed)
		return c.View()
	})

	// ---- inverse (top-to-bottom, right-to-left) bars ------------------------------------------
	fracs := []float64{0.01, 0.0625, 0.1, 0.125, 0.2, 0.25, 0.3, 0.375, 0.4, 0.5, 0.55, 0.625, 0.7, 0.75, 0.8, 0.875, 0.95, 0.99, 1, 1.5, 2.25, 3.9}
	register("graph/columns-down-basic", func() string {
		c := grCanvas(24, 6)
		for i, f := range fracs {
			graph.DrawColumnTopToBottom(c, grP(i, 0), f, grRed)
		}
		graph.DrawColumnTopToBottom(c, grP(0, 5), 3, grBlue)
		graph.DrawColumnTopToBottom(c, grP(30, 0), 3, grBlue)
		graph.DrawColumnTopToBottom(c, grP(1, -2), 3.5, grBlue)
		graph.DrawColumnTopToBottom(c, grP(2, 0), -1, grBlue)
		return c.View()
	})
	register("graph/rows-left-basic", func() string {
		c := grCanvas(6, 24)
		for i, f := range fracs {
			graph.DrawRowRightToLeft(c, grP(5, i), f, grGreen)
		}
		graph.DrawRowRightToLeft(c, grP(0, 5), 3, grBlue)
		graph.DrawRowRightToLeft(c, grP(5, 30), 3, grBlue)
		graph.DrawRowRightToLeft(c, grP(7, 2), 3.5, grBlue)
		graph.DrawRowRightToLeft(c, grP(5, 3), -1, grBlue)
		return c.View()
	})
	inners := []float64{1.25, 1.5, 1.375, 1.75, 0.5, 0.1, 2.5, 3, 4, 1.0, 2.0, 1.9}
	register("graph/columns-down-stacked", func() string {
		c := grCanvas(len(inners)*2, 6)
		for i, in := range inners {
			graph.DrawColumnTopToBottom(c, grP(i*2, 0), 1.75, grRed)
			graph.DrawColumnTopToBottom(c, grP(i*2, 0), in, grBlue)
			graph.DrawColumnTopToBottom(c, grP(i*2+1, 0), 3, grRed)
			graph.DrawColumnTopToBottom(c, grP(i*2+1, 0), 1.75, grGreen)
			graph.DrawColumnTopToBottom(c, grP(i*2+1, 0), in, grBlue)
		}
		return c.View()
	})
	register("graph/rows-left-stacked", func() string {
		c := grCanvas(6, len(inners)*2)
		for i, in := range inners {
			graph.DrawRowRightToLeft(c, grP(5, i*2), 1.75, grRed)
			graph.DrawRowRightToLeft(c, grP(5, i*2), in, grBlue)
			graph.DrawRowRightToLeft(c, grP(5, i*2+1), 3, grRed)
			graph.DrawRowRightToLeft(c, grP(5, i*2+1), 1.75, grGreen)
			graph.DrawRowRightToLeft(c, grP(5, i*2+1), in, grBlue)
		}
		return c.View()
	})
	register("graph/columns-down-styles-and-existing", func() string {
		c := grCanvas(10, 6)
		graph.DrawColumnTopToBottom(c, grP(0, 0), 2.5, grBoldBg)
		graph.DrawColumnTopToBottom(c, grP(1, 0), 3, grBoldBg)
		graph.DrawColumnTopToBottom(c, grP(1, 0), 2.5, grHex)
		graph.DrawColumnTopToBottom(c, grP(2, 0), 3, grBgOnly)
		graph.DrawColumnTopToBottom(c, grP(2, 0), 1.5, grPlain)
		c.SetRune(grP(3, 2), 'x')
		graph.DrawColumnTopToBottom(c, grP(3, 0), 2.5, grRed)
		graph.DrawColumnBottomToTop(c, grP(4, 5), 3.5, grGreen)
		graph.DrawColumnTopToBottom(c, grP(4, 0), 2.5, grRed)
		graph.DrawColumnTopToBottom(c, grP(5, 0), 2.6, grRed)
		graph.DrawColumnTopToBottom(c, grP(5, 0), 2.3, grBlue)
		graph.DrawColumnTopToBottom(c, grP(5, 0), 2.1, grGreen)
		graph.DrawColumnTopToBottom(c, grP(6, 0), 1.9, grGreen)
		graph.DrawColumnTopToBottom(c, grP(6, 0), 2.1, grBlue)
		graph.DrawColumnTopToBottom(c, grP(7, 0), 2.2, grBgOnly)
		graph.DrawColumnTopToBottom(c, grP(7, 0), 2.2, grBoldBg)
		return c.View()
	})
	register("graph/rows-left-styles-and-existing", func() string {
		c := grCanvas(6, 10)
		graph.DrawRowRightToLeft(c, grP(5, 0), 2.5, grBoldBg)
		graph.DrawRowRightToLeft(c, grP(5, 1), 3, grBoldBg)
		graph.DrawRowRightToLeft(c, grP(5, 1), 2.5, grHex)
		graph.DrawRowRightToLeft(c, grP(5, 2), 3, grBgOnly)
		graph.DrawRowRightToLeft(c, grP(5, 2), 1.5, grPlain)
		c.SetRune(grP(3, 3), 'x')
		graph.DrawRowRightToLeft(c, grP(5, 3), 2.5, grRed)
		graph.DrawRowLeftToRight(c, grP(0, 4), 3.5, grGreen)
		graph.DrawRowRightToLeft(c, grP(5, 4), 2.5, grRed)
		graph.DrawRowRightToLeft(c, grP(5, 5), 2.6, grRed)
		graph.DrawRowRightToLeft(c, grP(5, 5), 2.3, grBlue)
		graph.DrawRowRightToLeft(c, grP(5, 5), 2.1, grGreen)
		graph.DrawRowRightToLeft(c, grP(5, 6), 1.9, grGreen)
		graph.DrawRowRightToLeft(c, grP(5, 6), 2.1, grBlue)
		graph.DrawRowRightToLeft(c, grP(5, 7), 2.2, grBgOnly)
		graph.DrawRowRightToLeft(c, grP(5, 7), 2.2, grBoldBg)
		return c.View()
	})
	register("graph/columns-bidirectional", func() string {
		c := grCanvas(12, 11)
		graph.DrawXYAxisDown(c, grP(0, 5), grPlain)
		pos := []float64{1.5, 3.25, 4.9, 0.4, 2, 4.5}
		neg := []float64{0.5, 2.25, 0.9, 4.4, 1, 3.5}
		for i := range pos {
			graph.DrawColumnBottomToTop(c, grP(2+i*2, 4), pos[i], grGreen)
			graph.DrawColumnTopToBottom(c, grP(2+i*2, 6), neg[i], grRed)
		}
		return c.View()
	})
	register("graph/rows-bidirectional", func() string {
		c := grCanvas(21, 12)
		graph.DrawXYAxisAll(c, grP(10, 5), grPlain)
		pos := []float64{1.5, 3.25, 4.9, 0.4, 2, 4.5}
		neg := []float64{0.5, 2.25, 0.9, 4.4, 1, 3.5}
		for i := range pos {
			graph.DrawRowLeftToRight(c, grP(11, 1+i), pos[i], grGreen)
			graph.DrawRowRightToLeft(c, grP(9, 1+i), neg[i], grRed)
		}
		return c.View()
	})

	// ---- candlesticks -----------------------------------------------------------------------------
	type candle struct{ l, bl, bh, h float64 }
	candles := []candle{
		{0, 1, 3, 4}, {0.4, 1.6, 3.2, 4.8}, {0.5, 2.5, 2.5, 3.5}, {1, 1, 1, 1},
		{0.2, 0.7, 4.7, 5.2}, {2.5, 3.5, 5.5, 7.5}, {0, 0, 6, 6}, {1.99, 2.01, 2.49, 2.5},
		{3, 3.5, 3.5, 3}, {0.75, 1.25, 6.25, 6.75},
	}
	register("graph/candle-basic", func() string {
		c := grCanvas(24, 11)
		for i, cd := range candles {
			graph.DrawCandlestickBottomToTop(c, grP(1+i*2, 9), cd.l, cd.bl, cd.bh, cd.h, []lipgloss.Style{grRed, grGreen}[i%2])
		}
		graph.DrawCandlestickBottomToTop(c, grP(30, 9), 1, 2, 3, 4, grRed)
		graph.DrawCandlestickBottomToTop(c, grP(22, 3), 0, 1, 3, 4, grRed)
		return c.View()
	})
	register("graph/candle-overlap", func() string {
		c := grCanvas(12, 10)
		graph.DrawCandlestickBottomToTop(c, grP(2, 9), 0, 1, 3, 4, grRed)
		graph.DrawCandlestickBottomToTop(c, grP(2, 9), 2, 3, 5, 7, grBlue)
		graph.DrawCandlestickBottomToTop(c, grP(4, 9), 1, 2, 4, 5, grRed)
		graph.DrawCandlestickBottomToTop(c, grP(4, 9), 1.5, 2.5, 3.5, 4.5, grGreen)
		graph.DrawCandlestickBottomToTop(c, grP(6, 9), 0.5, 1.5, 5.5, 6.5, grRed)
		graph.DrawCandlestickBottomToTop(c, grP(6, 9), 0.2, 1.7, 2.2, 8, grBlue)
		graph.DrawCandlestickBottomToTop(c, grP(8, 9), 0, 3, 3, 6, grHex)
		graph.DrawCandlestickBottomToTop(c, grP(8, 9), 0, 4, 4, 5, grYellow)
		return c.View()
	})
	register("graph/candle-wide", func() string {
		var outs []string
		for w := -1; w <= 7; w++ {
			c := grCanvas(12, 9)
			graph.DrawCandlestickBottomToTopWide(c, grP(5, 8), w, 0.3, 1.4, 4.6, 6.2, grRed)
			outs = append(outs, c.View())
		}
		return grJoin(outs...)
	})
	register("graph/candle-wide-overlap-clip", func() string {
		c := grCanvas(14, 9)
		graph.DrawCandlestickBottomToTopWide(c, grP(0, 8), 5, 0, 1, 4, 6, grRed)
		graph.DrawCandlestickBottomToTopWide(c, grP(13, 8), 4, 0.5, 2.5, 5.5, 7.5, grGreen)
		graph.DrawCandlestickBottomToTopWide(c, grP(5, 8), 3, 0, 2, 4, 6, grBlue)
		graph.DrawCandlestickBottomToTopWide(c, grP(7, 8), 3, 1, 3, 5, 8, grYellow)
		graph.DrawCandlestickBottomToTopWide(c, grP(6, 8), 1, 2, 3, 3, 4, grHex)
		return c.View()
	})
	register("graph/candle-block-basic", func() string {
		c := grCanvas(24, 11)
		for i, cd := range candles {
			graph.DrawCandlestickBlockBottomToTop(c, grP(1+i*2, 9), cd.l, cd.bl, cd.bh, cd.h, []lipgloss.Style{grRed, grGreen}[i%2])
		}
		graph.DrawCandlestickBlockBottomToTop(c, grP(30, 9), 1, 2, 3, 4, grRed)
		graph.DrawCandlestickBlockBottomToTop(c, grP(22, 3), 0, 1, 3, 4, grRed)
		return c.View()
	})
	register("graph/candle-block-fractions", func() string {
		c := grCanvas(18, 14)
		fr := []float64{0, 0.25, 0.5, 0.75}
		n := 0
		for _, fl := range fr {
			for _, fh := range fr {
				graph.DrawCandlestickBlockBottomToTop(c, grP(1+n, 12), 0.3+fl, 2+fl, 7+fh, 9.5+fh, grBlue)
				n++
			}
		}
		return c.View()
	})
	register("graph/candle-fractions-line", func() string {
		c := grCanvas(18, 14)
		fr := []float64{0, 0.25, 0.5, 0.75}
		n := 0
		for _, fl := range fr {
			for _, fh := range fr {
				graph.DrawCandlestickBottomToTop(c, grP(1+n, 12), 0.3+fl, 2+fl, 7+fh, 9.5+fh, grBlue)
				n++
			}
		}
		return c.View()
	})
	register("graph/candle-block-degenerate", func() string {
		c := grCanvas(16, 8)
		graph.DrawCandlestickBlockBottomToTop(c, grP(1, 7), 1, 1.2, 1.8, 2, grRed)
		graph.DrawCandlestickBlockBottomToTop(c, grP(3, 7), 2, 2, 2, 2, grGreen)
		graph.DrawCandlestickBlockBottomToTop(c, grP(5, 7), 0, 0, 5, 5, grBlue)
		graph.DrawCandlestickBlockBottomToTop(c, grP(7, 7), 0, 3, 3, 6, grRed)
		graph.DrawCandlestickBlockBottomToTop(c, grP(9, 7), 1.5, 1.5, 1.6, 1.6, grGreen)
		graph.DrawCandlestickBlockBottomToTop(c, grP(11, 7), 3, 3.2, 4.8, 3, grHex)
		graph.DrawCandlestickBlockBottomToTop(c, grP(13, 7), 0, 1, 2, 3, grBoldBg)
		graph.DrawCandlestickBlockBottomToTop(c, grP(15, 7), 0, 1, 2, 3, grBlue)
		graph.DrawCandlestickBlockBottomToTop(c, grP(-1, 7), 0, 1, 2, 3, grBlue)
		graph.DrawCandlestickBlockBottomToTop(c, grP(2, 9), 2, 3, 5, 9, grBlue)
		return c.View()
	})
	register("graph/candle-block-over-line", func() string {
		c := grCanvas(8, 10)
		graph.DrawCandlestickBottomToTop(c, grP(1, 9), 0, 1, 5, 7, grRed)
		graph.DrawCandlestickBlockBottomToTop(c, grP(1, 9), 2, 3, 4, 8, grBlue)
		graph.DrawCandlestickBlockBottomToTop(c, grP(4, 9), 0, 1, 5, 7, grBlue)
		graph.DrawCandlestickBottomToTop(c, grP(4, 9), 2, 3, 4, 8, grRed)
		return c.View()
	})
	register("graph/candle-rune", func() string {
		c := grCanvas(10, 3)
		all := []rune{runes.LineVertical, runes.LineVerticalHeavy, runes.LineUp, runes.LineDown, runes.LineUpHeavy, runes.LineDownHeavy, runes.LineUpDownHeavy, runes.LineUpHeavyDown}
		for i, r := range all {
			graph.DrawCandlestickRune(c, grP(i, 0), r, grRed)
			graph.DrawCandlestickRune(c, grP(i, 0), all[(i*3+1)%8], grBlue)
		}
		graph.DrawCandlestickRune(c, grP(0, 1), runes.Null, grRed)
		graph.DrawCandlestickRune(c, grP(1, 1), 'x', grRed)
		graph.DrawCandlestickRune(c, grP(2, 1), runes.LineHorizontal, grRed)
		c.SetRune(grP(3, 1), 'x')
		graph.DrawCandlestickRune(c, grP(3, 1), runes.LineUp, grRed)
		c.SetRune(grP(4, 1), runes.LineHorizontal)
		graph.DrawCandlestickRune(c, grP(4, 1), runes.LineVerticalHeavy, grBlue)
		graph.DrawCandlestickRune(c, grP(20, 1), runes.LineUp, grRed)
		return c.View()
	})
	register("graph/line-rune", func() string {
		c := grCanvas(18, 6)
		all := []rune{runes.LineHorizontal, runes.LineVertical, runes.LineDownRight, runes.LineDownLeft, runes.LineUpRight, runes.LineUpLeft,
			runes.LineVerticalRight, runes.LineVerticalLeft, runes.LineHorizontalUp, runes.LineHorizontalDown, runes.LineHorizontalVertical,
			runes.LineLeft, runes.LineUp, runes.LineRight, runes.LineDown, runes.ArcDownRight, runes.ArcDownLeft, runes.ArcUpLeft}
		for i, r := range all {
			graph.DrawLineRune(c, grP(i, 0), r, runes.ThinLineStyle, grRed)
			graph.DrawLineRune(c, grP(i, 1), r, runes.ArcLineStyle, grGreen)
			graph.DrawLineRune(c, grP(i, 2), r, runes.ThinLineStyle, grRed)
			graph.DrawLineRune(c, grP(i, 2), all[(i+5)%len(all)], runes.ThinLineStyle, grBlue)
			graph.DrawLineRune(c, grP(i, 3), r, runes.ArcLineStyle, grRed)
			graph.DrawLineRune(c, grP(i, 3), all[(i+7)%len(all)], runes.ArcLineStyle, grBlue)
			graph.DrawLineRune(c, grP(i, 4), r, runes.ThinLineStyle, grRed)
			graph.DrawLineRune(c, grP(i, 4), all[(i+3)%len(all)], runes.ArcLineStyle, grBlue)
		}
		graph.DrawLineRune(c, grP(0, 5), runes.Null, runes.ThinLineStyle, grRed)
		graph.DrawLineRune(c, grP(1, 5), 'x', runes.ThinLineStyle, grRed)
		graph.DrawLineRune(c, grP(2, 5), runes.LineUpHeavy, runes.ThinLineStyle, grRed)
		graph.DrawLineRune(c, grP(3, 5), runes.FullBlock, runes.ArcLineStyle, grRed)
		c.SetRune(grP(4, 5), 'x')
		graph.DrawLineRune(c, grP(4, 5), runes.LineHorizontal, runes.ThinLineStyle, grRed)
		c.SetRune(grP(5, 5), runes.LineVertical)
		graph.DrawLineRune(c, grP(5, 5), 'x', runes.ThinLineStyle, grRed)
		graph.DrawLineRune(c, grP(40, 5), runes.LineHorizontal, runes.ThinLineStyle, grRed)
		return c.View()
	})

	// ---- runes tables -------------------------------------------------------------------------------
	register("runes/lower-left-block-from-float", func() string {
		var sb strings.Builder
		vals := []float64{-0.5, 0, 0.0624, 0.0625, 0.0626, 0.9999, 1, 1.5, 0.125, 0.1875, 0.18749, 0.4375, 0.4374, 0.9375, 0.93749, 0.9374}
		for i := 0; i <= 70; i++ {
			vals = append(vals, float64(i)/64.0, float64(i)*0.017)
		}
		for _, f := range vals {
			sb.WriteString(fmt.Sprintf("%v:%d,%d\n", f, runes.LowerBlockElementFromFloat64(f), runes.LeftBlockElementFromFloat64(f)))
		}
		return sb.String()
	})
	register("runes/inverse-and-predicates", func() string {
		var sb strings.Builder
		for r := rune(0x2578); r <= 0x2592; r++ {
			sb.WriteString(fmt.Sprintf("%x:%d%d%d%d%d%d%d,%x,%x\n", r,
				b2i(runes.IsLowerBlockElement(r)), b2i(runes.IsLeftBlockElement(r)), b2i(runes.IsLine(r)), b2i(runes.IsCandlestick(r)),
				b2i(runes.IsBraillePattern(r)), 0, 0, runes.InverseLowerBlockElement(r), runes.InverseLeftBlockElement(r)))
		}
		for _, r := range []rune{runes.Null, 'x', 0x27ff, 0x2800, 0x2801, 0x28ff, 0x2900, 0x2500, 0x253c, 0x253d, 0x256c, 0x256d, 0x2570, 0x2571, 0x2574, 0x2577, 0x2578} {
			sb.WriteString(fmt.Sprintf("%x:%d%d%d%d%d,%x,%x\n", r,
				b2i(runes.IsLowerBlockElement(r)), b2i(runes.IsLeftBlockElement(r)), b2i(runes.IsLine(r)), b2i(runes.IsCandlestick(r)),
				b2i(runes.IsBraillePattern(r)), runes.InverseLowerBlockElement(r), runes.InverseLeftBlockElement(r)))
		}
		return sb.String()
	})
	register("runes/quadrant-blocks", func() string {
		var sb strings.Builder
		for i := 0; i < 16; i++ {
			sb.WriteString(fmt.Sprintf("%d:%x ", i, runes.QuadrantBlock(i&8 != 0, i&4 != 0, i&2 != 0, i&1 != 0)))
		}
		return sb.String()
	})
	register("runes/braille-patterns", func() string {
		var sb strings.Builder
		for i := 0; i < 256; i++ {
			r := rune(0x2800 + i)
			var d runes.PatternDots
			runes.SetPatternDots(r, &d)
			back := runes.BraillePatternFromPatternDots(d)
			sb.WriteString(fmt.Sprintf("%x:%v:%x:%x:%x\n", r, d, back, runes.CombineBraillePatterns(r, rune(0x2800+(255-i))), runes.CombineBraillePatterns(r, rune(0x2800+(i*7)%256))))
		}
		sb.WriteString(fmt.Sprintf("%x %x %x\n", runes.CombineBraillePatterns('a', '⠁'), runes.CombineBraillePatterns('⠁', 'b'), runes.CombineBraillePatterns('a', 'b')))
		var d runes.PatternDots
		runes.SetPatternDots('x', &d)
		sb.WriteString(fmt.Sprintf("%v\n", d))
		return sb.String()
	})
	register("runes/pattern-dots-grid", func() string {
		var sb strings.Builder
		for _, wh := range [][2]int{{4, 4}, {5, 5}, {3, 7}, {1, 1}, {2, 8}, {0, 0}} {
			g := runes.NewPatternDotsGrid(wh[0], wh[1])
			for y := -1; y <= wh[1]; y++ {
				for x := -1; x <= wh[0]; x++ {
					if (x*3+y*5)%3 != 0 {
						g.Set(x, y)
					}
				}
			}
			g.Unset(0, 0)
			g.Unset(-5, 40)
			sb.WriteString(fmt.Sprintf("%dx%d:", wh[0], wh[1]))
			for _, row := range g.BraillePatterns() {
				sb.WriteString(string(row) + "|")
			}
			g.Reset()
			sb.WriteString(fmt.Sprintf(" reset:%d\n", len(g.BraillePatterns())))
		}
		return sb.String()
	})
	register("runes/combine-lines", func() string {
		var sb strings.Builder
		all := []rune{runes.Null, 'x', runes.LineHorizontal, runes.LineVertical, runes.LineDownRight, runes.LineDownLeft, runes.LineUpRight, runes.LineUpLeft,
			runes.LineVerticalRight, runes.LineVerticalLeft, runes.LineHorizontalUp, runes.LineHorizontalDown, runes.LineHorizontalVertical,
			runes.LineLeft, runes.LineUp, runes.LineRight, runes.LineDown, runes.ArcDownRight, runes.ArcDownLeft, runes.ArcUpLeft, runes.ArcUpRight,
			runes.LineVerticalHeavy, runes.LineUpHeavy}
		for _, ls := range []runes.LineStyle{runes.ThinLineStyle, runes.ArcLineStyle} {
			for _, a := range all {
				for _, b := range all {
					sb.WriteString(fmt.Sprintf("%x", runes.CombineLines(a, b, ls)))
					sb.WriteByte(' ')
				}
				sb.WriteByte('\n')
			}
		}
		sb.WriteString(fmt.Sprintf("%x\n", runes.CombineLines(runes.LineHorizontal, runes.LineVertical, runes.LineStyle(7))))
		return sb.String()
	})
	register("runes/line-segments", func() string {
		var sb strings.Builder
		for i := 0; i < 16; i++ {
			l := runes.LineSegments{Up: i&8 != 0, Down: i&4 != 0, Left: i&2 != 0, Right: i&1 != 0}
			sb.WriteString(fmt.Sprintf("%d:%x,%x\n", i, runes.ArcLineFromLineSegments(l), runes.ThinLineFromLineSegments(l)))
		}
		for _, r := range []rune{runes.LineHorizontal, runes.LineVerticalHeavy, runes.ArcUpLeft, runes.LineUpRight, runes.LineHorizontalDown, runes.LineLeft, 'x'} {
			var l runes.LineSegments
			runes.SetLineSegments(r, &l)
			sb.WriteString(fmt.Sprintf("%x:%v\n", r, l))
		}
		return sb.String()
	})
	register("runes/candlesticks", func() string {
		var sb strings.Builder
		all := []rune{runes.Null, 'x', runes.LineHorizontal, runes.LineVertical, runes.LineVerticalHeavy, runes.LineUp, runes.LineDown, runes.LineUpHeavy,
			runes.LineDownHeavy, runes.LineUpDownHeavy, runes.LineUpHeavyDown}
		for _, a := range all {
			for _, b := range all {
				sb.WriteString(fmt.Sprintf("%x ", runes.CombineCandlesticks(a, b)))
			}
			sb.WriteByte('\n')
		}
		for i := 0; i < 16; i++ {
			c := runes.CandlestickSegments{Up: i&8 != 0, Down: i&4 != 0, UpHeavy: i&2 != 0, DownHeavy: i&1 != 0}
			sb.WriteString(fmt.Sprintf("%x ", runes.CandlestickFromCandlestickSegments(c)))
		}
		return sb.String()
	})
}

func b2i(b bool) int {
	if b {
		return 1
	}
	return 0
}
