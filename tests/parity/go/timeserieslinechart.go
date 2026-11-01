package main

import (
	"fmt"
	"time"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
	"github.com/NimbleMarkets/ntcharts/v2/canvas/runes"
	"github.com/NimbleMarkets/ntcharts/v2/linechart"
	tslc "github.com/NimbleMarkets/ntcharts/v2/linechart/timeserieslinechart"
)

func tsFg(c string) lipgloss.Style { return lipgloss.NewStyle().Foreground(lipgloss.Color(c)) }

var tsDay0 = time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)

// tsSeries returns n daily points of a deterministic zigzag around base.
func tsSeries(n int, start time.Time, step time.Duration, base, amp float64) []tslc.TimePoint {
	r := make([]tslc.TimePoint, n)
	for i := range r {
		v := base + amp*float64((i*7)%11-5)/5
		r[i] = tslc.TimePoint{Time: start.Add(time.Duration(i) * step), Value: v}
	}
	return r
}

// tsCandles pushes n daily OHLC candles.
func tsCandles(m *tslc.Model, n int, start time.Time) {
	price := 100.0
	for i := 0; i < n; i++ {
		ts := start.Add(time.Duration(i) * 24 * time.Hour)
		move := float64((i*5)%9-4) * 1.5
		open, close := price, price+move
		high := max(open, close) + float64(i%3) + 0.5
		low := min(open, close) - float64((i+1)%3) - 0.5
		m.PushDataSet("open", tslc.TimePoint{Time: ts, Value: open})
		m.PushDataSet("high", tslc.TimePoint{Time: ts, Value: high})
		m.PushDataSet("low", tslc.TimePoint{Time: ts, Value: low})
		m.PushDataSet("close", tslc.TimePoint{Time: ts, Value: close})
		price = close
	}
}

func init() {
	// upstream examples/linechart/timeseries
	register("timeserieslinechart/timeseries_styled", func() string {
		m := tslc.New(44, 14,
			tslc.WithTimeRange(tsDay0, tsDay0.Add(29*24*time.Hour)),
			tslc.WithYRange(0, 100),
			tslc.WithAxesStyles(tsFg("3"), tsFg("6")),
			tslc.WithStyle(tsFg("4")),
			tslc.WithTimeSeries(tsSeries(30, tsDay0, 24*time.Hour, 50, 40)))
		m.Draw()
		return m.View()
	})
	register("timeserieslinechart/multi_styles", func() string {
		m := tslc.New(44, 12,
			tslc.WithTimeRange(tsDay0, tsDay0.Add(19*24*time.Hour)),
			tslc.WithYRange(0, 20),
			tslc.WithLineStyle(runes.ThinLineStyle),
			tslc.WithDataSetStyle("b", tsFg("9")),
			tslc.WithDataSetLineStyle("b", runes.ArcLineStyle),
			tslc.WithDataSetTimeSeries("a", tsSeries(20, tsDay0, 24*time.Hour, 6, 5)),
			tslc.WithDataSetTimeSeries("b", tsSeries(20, tsDay0, 24*time.Hour, 14, 4)))
		m.SetDataSetStyle("a", tsFg("2"))
		m.DrawAll()
		return m.View()
	})
	register("timeserieslinechart/braille_styled", func() string {
		m := tslc.New(44, 12,
			tslc.WithTimeRange(tsDay0, tsDay0.Add(19*24*time.Hour)),
			tslc.WithYRange(0, 20),
			tslc.WithDataSetStyle("a", tsFg("2")),
			tslc.WithDataSetStyle("b", tsFg("5")),
			tslc.WithDataSetTimeSeries("a", tsSeries(20, tsDay0, 24*time.Hour, 6, 5)),
			tslc.WithDataSetTimeSeries("b", tsSeries(20, tsDay0, 24*time.Hour, 14, 4)))
		m.DrawBrailleAll()
		return m.View()
	})
	register("timeserieslinechart/many_points_average", func() string {
		m := tslc.New(30, 10, tslc.WithTimeRange(tsDay0, tsDay0.Add(10*24*time.Hour)), tslc.WithYRange(0, 10))
		for i := 0; i <= 240; i++ {
			m.Push(tslc.TimePoint{Time: tsDay0.Add(time.Duration(i) * time.Hour), Value: float64((i*13)%11) - 0.25})
		}
		m.Draw()
		return m.View()
	})
	register("timeserieslinechart/candles_styled", func() string {
		m := tslc.New(44, 14, tslc.WithTimeRange(tsDay0, tsDay0.Add(15*24*time.Hour)), tslc.WithYRange(85, 115))
		tsCandles(&m, 16, tsDay0)
		m.DrawCandle("open", "high", "low", "close", tsFg("10"), tsFg("9"))
		return m.View()
	})
	register("timeserieslinechart/candles_wide", func() string {
		m := tslc.New(60, 14, tslc.WithTimeRange(tsDay0, tsDay0.Add(9*24*time.Hour)), tslc.WithYRange(85, 115))
		tsCandles(&m, 10, tsDay0)
		m.DrawCandleWithOpts("open", "high", "low", "close", tsFg("10"), tsFg("9"), tslc.DrawCandleOpts{Width: 3})
		return m.View()
	})
	register("timeserieslinechart/candles_block_even", func() string {
		m := tslc.New(60, 14, tslc.WithTimeRange(tsDay0, tsDay0.Add(9*24*time.Hour)), tslc.WithYRange(85, 115))
		tsCandles(&m, 10, tsDay0)
		m.DrawCandleWithOpts("open", "high", "low", "close", tsFg("10"), tsFg("9"), tslc.DrawCandleOpts{Width: 4, Block: true, SnapTimeBounds: true})
		return m.View()
	})
	register("timeserieslinechart/candles_missing_sets", func() string {
		m := tslc.New(30, 8, tslc.WithTimeRange(tsDay0, tsDay0.Add(4*24*time.Hour)), tslc.WithYRange(85, 115))
		tsCandles(&m, 5, tsDay0)
		m.DrawXYAxisAndLabel()
		m.DrawCandle("open", "high", "low", "nope", tsFg("10"), tsFg("9")) // no-op
		return m.View()
	})
	register("timeserieslinechart/hour_formatter_keys", func() string {
		start := time.Date(2026, 3, 1, 9, 0, 0, 0, time.UTC)
		m := tslc.New(48, 12,
			tslc.WithTimeRange(start, start.Add(12*time.Hour)),
			tslc.WithYRange(0, 50),
			tslc.WithXLabelFormatter(tslc.HourTimeLabelFormatter()),
			tslc.WithUpdateHandler(tslc.HourUpdateHandler(1)),
			tslc.WithXYSteps(10, 2),
			tslc.WithTimeSeries(tsSeries(49, start, 15*time.Minute, 25, 20)))
		m.Focus()
		for _, k := range []tea.KeyPressMsg{{Code: tea.KeyPgUp}, {Code: tea.KeyPgUp}, {Code: tea.KeyRight}, {Code: tea.KeyRight}, {Code: tea.KeyLeft}} {
			m, _ = m.Update(k)
		}
		m.Draw()
		return m.View()
	})
	register("timeserieslinechart/date_nozoom_wheel", func() string {
		m := tslc.New(44, 10,
			tslc.WithTimeRange(tsDay0, tsDay0.Add(29*24*time.Hour)),
			tslc.WithYRange(0, 100),
			tslc.WithUpdateHandler(tslc.DateNoZoomUpdateHandler(2)),
			tslc.WithTimeSeries(tsSeries(30, tsDay0, 24*time.Hour, 50, 40)))
		m.SetViewTimeRange(tsDay0.Add(5*24*time.Hour), tsDay0.Add(15*24*time.Hour))
		m.Focus()
		m, _ = m.Update(tea.MouseWheelMsg{Button: tea.MouseWheelDown})
		m, _ = m.Update(tea.MouseWheelMsg{Button: tea.MouseWheelDown})
		m, _ = m.Update(tea.MouseWheelMsg{Button: tea.MouseWheelUp})
		m.DrawBraille()
		return m.View()
	})
	register("timeserieslinechart/second_handlers", func() string {
		start := time.Unix(1_700_000_000, 0)
		m := tslc.New(44, 10,
			tslc.WithTimeRange(start, start.Add(60*time.Second)),
			tslc.WithYRange(-10, 10),
			tslc.WithXLabelFormatter(tslc.HourTimeLabelFormatter()),
			tslc.WithXYSteps(12, 2),
			tslc.WithUpdateHandler(tslc.SecondUpdateHandler(5)),
			tslc.WithTimeSeries(tsSeries(61, start, time.Second, 0, 9)))
		m.Focus()
		m, _ = m.Update(tea.MouseWheelMsg{Button: tea.MouseWheelUp})
		m.UpdateHandler = tslc.SecondNoZoomUpdateHandler(3)
		m, _ = m.Update(tea.KeyPressMsg{Code: tea.KeyLeft})
		m.UpdateHandler = tslc.DateUpdateHandler(1)
		m, _ = m.Update(tea.KeyPressMsg{Code: tea.KeyRight}) // a day: clamps at the end
		m.UpdateHandler = tslc.HourNoZoomUpdateHandler(1)
		m, _ = m.Update(tea.KeyPressMsg{Code: tea.KeyLeft})
		m.Draw()
		return m.View()
	})
	register("timeserieslinechart/log_scale", func() string {
		m := tslc.New(44, 12, tslc.WithYScale(linechart.ScaleLog),
			tslc.WithTimeRange(tsDay0, tsDay0.Add(11*24*time.Hour)), tslc.WithYRange(1, 1e5),
			tslc.WithStyle(tsFg("4")))
		for i, v := range []float64{2, 9, 40, 0, 300, 1200, 800, 5000, -2, 30000, 60000, 1e5} {
			m.Push(tslc.TimePoint{Time: tsDay0.Add(time.Duration(i) * 24 * time.Hour), Value: v})
		}
		m.Draw()
		a := m.View()
		m.DrawBraille()
		return a + "\n--\n" + m.View()
	})
	register("timeserieslinechart/y2_lines_braille", func() string {
		m := tslc.New(48, 12,
			tslc.WithTimeRange(tsDay0, tsDay0.Add(15*24*time.Hour)),
			tslc.WithYRange(0, 30),
			tslc.WithY2Axis(linechart.Axis{Min: 0, Max: 3000, LabelStyle: tsFg("1")}),
			tslc.WithDataSetYAxis("vol", linechart.YAxisRight),
			tslc.WithDataSetStyle("vol", tsFg("1")),
			tslc.WithDataSetTimeSeries("px", tsSeries(16, tsDay0, 24*time.Hour, 15, 12)),
			tslc.WithDataSetTimeSeries("vol", tsSeries(16, tsDay0, 24*time.Hour, 1500, 1200)))
		m.DrawAll()
		a := m.View()
		m.DrawBrailleAll()
		return a + "\n--\n" + m.View()
	})
	register("timeserieslinechart/y2_log_candles", func() string {
		m := tslc.New(48, 14,
			tslc.WithTimeRange(tsDay0, tsDay0.Add(9*24*time.Hour)),
			tslc.WithYRange(85, 115),
			tslc.WithY2Axis(linechart.Axis{Min: 10, Max: 1e5, Scale: linechart.ScaleLog}),
			tslc.WithDataSetYAxis("vol", linechart.YAxisRight))
		tsCandles(&m, 10, tsDay0)
		m.DrawCandleWithOpts("open", "high", "low", "close", tsFg("10"), tsFg("9"), tslc.DrawCandleOpts{Width: 2})
		return m.View()
	})
	register("timeserieslinechart/fit_include_zero", func() string {
		m := tslc.New(44, 12, tslc.WithTimeRange(tsDay0, tsDay0.Add(19*24*time.Hour)),
			tslc.WithTimeSeries(tsSeries(20, tsDay0, 24*time.Hour, 60, 25)),
			tslc.WithDataSetTimeSeries("other", tsSeries(20, tsDay0, 24*time.Hour, 500, 300)))
		m.SetViewTimeRange(tsDay0.Add(3*24*time.Hour), tsDay0.Add(12*24*time.Hour))
		m.FitYToViewWithOpts(tslc.FitYOpts{DataSets: []string{tslc.DefaultDataSetName}, IncludeZero: true})
		m.DrawAll()
		return m.View() + fmt.Sprintf("\n%v %v %v %v", m.MinY(), m.MaxY(), m.ViewMinY(), m.ViewMaxY())
	})
	register("timeserieslinechart/fit_constant_log", func() string {
		m := tslc.New(40, 10, tslc.WithYScale(linechart.ScaleLog), tslc.WithTimeRange(tsDay0, tsDay0.Add(5*24*time.Hour)))
		for i := 0; i < 6; i++ {
			m.Push(tslc.TimePoint{Time: tsDay0.Add(time.Duration(i) * 24 * time.Hour), Value: 40})
		}
		m.FitYToView()
		m.Draw()
		return m.View() + fmt.Sprintf("\n%v %v", m.ViewMinY(), m.ViewMaxY())
	})
	register("timeserieslinechart/trim_before", func() string {
		m := tslc.New(40, 10, tslc.WithTimeRange(tsDay0, tsDay0.Add(19*24*time.Hour)), tslc.WithYRange(0, 100),
			tslc.WithTimeSeries(tsSeries(20, tsDay0, 24*time.Hour, 50, 40)))
		n := m.TrimBefore(tsDay0.Add(8 * 24 * time.Hour))
		m.Draw()
		return m.View() + fmt.Sprintf("\n%d", n)
	})
	register("timeserieslinechart/column_background", func() string {
		m := tslc.New(40, 10, tslc.WithTimeRange(tsDay0, tsDay0.Add(9*24*time.Hour)), tslc.WithYRange(0, 100),
			tslc.WithStyle(tsFg("4")),
			tslc.WithTimeSeries(tsSeries(10, tsDay0, 24*time.Hour, 50, 40)))
		m.Draw()
		hl := lipgloss.NewStyle().Background(lipgloss.Color("236"))
		m.SetColumnBackgroundStyle(tsDay0.Add(3*24*time.Hour), hl)
		m.SetColumnBackgroundStyle(tsDay0.Add(7*24*time.Hour), hl)
		m.SetColumnBackgroundStyle(tsDay0.Add(30*24*time.Hour), hl) // outside: ignored
		return m.View()
	})
	register("timeserieslinechart/resize_and_view", func() string {
		m := tslc.New(30, 9, tslc.WithTimeRange(tsDay0, tsDay0.Add(19*24*time.Hour)), tslc.WithYRange(0, 100),
			tslc.WithTimeSeries(tsSeries(20, tsDay0, 24*time.Hour, 50, 40)))
		m.Draw()
		before := m.View()
		m.Resize(50, 13)
		m.SetViewTimeAndYRange(tsDay0.Add(2*24*time.Hour), tsDay0.Add(14*24*time.Hour), 20, 80)
		m.Draw()
		return before + "\n--\n" + m.View()
	})
	register("timeserieslinechart/axes_variants", func() string {
		mk := func(x, y int) string {
			m := tslc.New(36, 9, tslc.WithTimeRange(tsDay0, tsDay0.Add(9*24*time.Hour)), tslc.WithYRange(0, 100),
				tslc.WithXYSteps(x, y), tslc.WithYLabelFormatter(func(i int, v float64) string { return fmt.Sprintf("$%.0f", v) }),
				tslc.WithTimeSeries(tsSeries(10, tsDay0, 24*time.Hour, 50, 40)))
			m.Draw()
			return m.View()
		}
		return mk(0, 2) + "\n--\n" + mk(6, 0) + "\n--\n" + mk(0, 0) + "\n--\n" + mk(8, 4)
	})
	register("timeserieslinechart/year_boundary_labels", func() string {
		start := time.Date(2025, 12, 20, 0, 0, 0, 0, time.UTC)
		m := tslc.New(60, 9, tslc.WithTimeRange(start, start.Add(30*24*time.Hour)), tslc.WithYRange(0, 10),
			tslc.WithXYSteps(8, 2),
			tslc.WithTimeSeries(tsSeries(31, start, 24*time.Hour, 5, 4)))
		m.Draw()
		return m.View()
	})
	register("timeserieslinechart/clear_data", func() string {
		m := tslc.New(36, 9, tslc.WithTimeRange(tsDay0, tsDay0.Add(9*24*time.Hour)), tslc.WithYRange(0, 100),
			tslc.WithTimeSeries(tsSeries(10, tsDay0, 24*time.Hour, 50, 40)),
			tslc.WithDataSetTimeSeries("x", tsSeries(10, tsDay0, 24*time.Hour, 20, 10)))
		m.ClearDataSet("x")
		m.DrawAll()
		a := m.View()
		m.ClearAllData()
		m.Push(tslc.TimePoint{Time: tsDay0.Add(24 * time.Hour), Value: 30})
		m.Push(tslc.TimePoint{Time: tsDay0.Add(5 * 24 * time.Hour), Value: 70})
		m.DrawAll()
		return a + "\n--\n" + m.View()
	})
	register("timeserieslinechart/with_linechart_auto", func() string {
		lc := linechart.New(40, 10, float64(tsDay0.UnixMilli())/1e3, float64(tsDay0.Add(24*time.Hour).UnixMilli())/1e3, 0, 1,
			linechart.WithXYSteps(5, 2), linechart.WithAutoXYRange(),
			linechart.WithXLabelFormatter(tslc.DateTimeLabelFormatter()),
			linechart.WithStyles(tsFg("8"), tsFg("7"), tsFg("2")))
		m := tslc.New(40, 10, tslc.WithLineChart(&lc), tslc.WithTimeSeries(tsSeries(12, tsDay0, 24*time.Hour, 30, 20)))
		m.Draw()
		return m.View() + fmt.Sprintf("\n%v %v", m.MinY(), m.MaxY())
	})
}
