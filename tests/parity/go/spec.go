package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"sort"
	"strconv"
	"strings"

	tea "charm.land/bubbletea/v2"
	"github.com/NimbleMarkets/ntcharts/v2/spec"
)

// The spec scenarios are JSON specs shared with the TypeScript twin
// (tests/parity/spec.scenarios.ts) through tests/testdata/spec/scenarios.json,
// so both sides build exactly the same text.

type specScenario struct {
	Spec   json.RawMessage `json:"spec"`
	Resize [][2]int        `json:"resize"`
	Update [][2]int        `json:"update"`
}

func loadSpecScenarios() map[string]specScenario {
	b, err := os.ReadFile("../../testdata/spec/scenarios.json")
	if err != nil {
		panic(err)
	}
	var m map[string]specScenario
	if err := json.Unmarshal(b, &m); err != nil {
		panic(err)
	}
	return m
}

func specNames(m map[string]specScenario) []string {
	names := make([]string, 0, len(m))
	for k := range m {
		names = append(names, k)
	}
	sort.Strings(names)
	return names
}

type viewer interface{ View() string }

func prec(f spec.Format) int {
	if f.Precision == nil {
		return -1
	}
	return *f.Precision
}

// specRender builds a scenario and renders it, applying resizes or
// WindowSizeMsg updates first. Errors render as "error: <text>".
func specRender(sc specScenario) string {
	var s spec.Spec
	if err := json.Unmarshal(sc.Spec, &s); err != nil {
		return "json: " + err.Error()
	}
	built, err := spec.Build(s)
	if err != nil {
		return "error: " + err.Error()
	}
	var views []string
	for _, size := range sc.Resize {
		switch m := built.(type) {
		case *spec.CategoricalModel:
			m.Resize(size[0], size[1])
		case *spec.ComboModel:
			m.Resize(size[0], size[1])
		case *spec.OHLCModel:
			m.Resize(size[0], size[1])
		}
		views = append(views, built.(viewer).View())
	}
	for _, size := range sc.Update {
		msg := tea.WindowSizeMsg{Width: size[0], Height: size[1]}
		switch m := built.(type) {
		case *spec.CategoricalModel:
			u, _ := m.Update(msg)
			built = &u
		case *spec.ComboModel:
			u, _ := m.Update(msg)
			built = &u
		case *spec.OHLCModel:
			u, _ := m.Update(msg)
			built = &u
		}
		views = append(views, built.(viewer).View())
	}
	if len(views) == 0 {
		return built.(viewer).View()
	}
	return strings.Join(views, "\n----\n")
}

func init() {
	all := loadSpecScenarios()
	var errs []string
	for _, name := range specNames(all) {
		sc := all[name]
		if strings.HasPrefix(name, "err-") {
			errs = append(errs, name)
			continue
		}
		register("spec/"+name, func() string { return specRender(sc) })
	}
	register("spec/errors", func() string {
		var b strings.Builder
		for _, name := range errs {
			fmt.Fprintf(&b, "%s: %s\n", name, specRender(all[name]))
		}
		return b.String()
	})

	// Every scenario spec re-marshaled by encoding/json.
	register("spec/marshal-json", func() string {
		var b strings.Builder
		for _, name := range specNames(all) {
			var s spec.Spec
			if err := json.Unmarshal(all[name].Spec, &s); err != nil {
				fmt.Fprintf(&b, "%s: json: %v\n", name, err)
				continue
			}
			out, err := json.Marshal(s)
			if err != nil {
				fmt.Fprintf(&b, "%s: marshal: %v\n", name, err)
				continue
			}
			fmt.Fprintf(&b, "%s: %s\n", name, out)
		}
		return b.String()
	})

	register("spec/marshal-json-edge", func() string {
		p := 3
		neg := math.Copysign(0, -1) // -0.0 is +0 as a Go constant
		s := spec.Spec{
			Type: spec.ChartTypeScatter, Title: "<b>&\"quotes\" </b>\x01\t", Width: 1, Height: 2,
			XAxis:  spec.XAxis{Labels: []string{}, Format: spec.Format{Precision: &p}},
			YAxis:  spec.YAxis{Min: &neg, Labels: []string{"é", "日本"}},
			Y2Axis: &spec.YAxis{},
			Data: spec.Data{
				XAxisData: []any{1e21, 1e-7, 123456789.0, 0.000001, -2.5, "s", nil, true},
				Series: []spec.Series{
					{Name: "a", Values: []spec.DataPoint{{X: 0.0, Y: 1e20}, {Y: 5e-324}, {X: 1.5e300, Y: -1e-6}}},
					{Name: "b", Values: []spec.DataPoint{}, OHLC: []spec.OHLCPoint{{T: nil, O: 1}, {T: 12.0, V: &neg}}},
					{Name: "c"},
				},
			},
			Heat:    &spec.HeatData{Matrix: [][]float64{nil, {}, {1, 2}}, Cells: []spec.HeatCell{}},
			Options: spec.Options{},
			Theme:   spec.Theme{Palette: []string{}},
		}
		out, err := json.Marshal(s)
		if err != nil {
			return err.Error()
		}
		return string(out)
	})

	register("spec/format-value", func() string {
		p := func(v int) *int { return &v }
		formats := []spec.Format{
			{}, {Kind: "number"}, {Kind: "number", Precision: p(0)}, {Kind: "number", Precision: p(3)},
			{Kind: "percent"}, {Kind: "percent", Precision: p(2)},
			{Kind: "currency"}, {Kind: "currency", Currency: "€", Precision: p(1)},
			{Kind: "si"}, {Kind: "si", Precision: p(0)}, {Kind: "si", Precision: p(3)},
			{Kind: "time"},
		}
		negZero, tenth, fifth := math.Copysign(0, -1), 0.1, 0.2 // variables: Go folds constants exactly
		values := []float64{0, negZero, 1, -1, 0.5, 1.5, 2.5, -2.5, 0.125, 0.375, 12.5, 999, 999.95, 1000, 12500, -2500000000,
			3.4e6, 1e12, 1.2345e15, 1e21, 1e22, 1e-7, 123456.789, tenth + fifth, 1767225600000, -1767225600000.5, 1e300,
			math.Inf(1), math.Inf(-1), math.NaN()}
		var b strings.Builder
		for _, f := range formats {
			for _, v := range values {
				fmt.Fprintf(&b, "%s/%d/%s %v => %s\n", f.Kind, prec(f), f.Currency, v, spec.FormatValue(f, v))
			}
		}
		return b.String()
	})

	register("spec/format-time-layouts", func() string {
		layouts := []string{
			"2006-01-02", "2006-01", "Jan", "Jan 02", "January 2, 2006", "Mon Jan _2 15:04:05 2006", "Monday 02/01/06 3:04PM",
			"15:04:05.000", "15:04:05.999", "15:04:05.000000", "15:04:05,000", "3:4:5 pm", "03 PM", "2006-01-02T15:04:05Z07:00",
			"2006-01-02T15:04:05.999999999Z07:00", "-0700 -07:00 -07 Z0700 Z07 MST", "002 __2 _2", "06 1 2", ".9 .99 .00",
			"literal text", "", "Mon Monday Jan January", "05 5 04 4 15 3 03", "Z07:00:00 -07:00:00",
		}
		times := []float64{0, 1767225600000, 1767225599999, 1735738512345, 951782400123, -86400001, 4102444800000, 1e14}
		var b strings.Builder
		for _, l := range layouts {
			f := spec.Format{Kind: "time", Layout: l}
			for _, v := range times {
				fmt.Fprintf(&b, "%q %v => %q\n", l, v, spec.FormatValue(f, v))
			}
		}
		return b.String()
	})

	register("spec/point-time", func() string {
		inputs := []any{
			"2026-01-05", "2026-1-05", "2026-01-5", "2026-02-29", "2024-02-29", "0000-01-01", "9999-12-31",
			"2026-01-01T00:00:00Z", "2026-01-01T00:00:00.123Z", "2026-01-01T00:00:00.123456789Z",
			"2026-01-01T00:00:00.1234567891Z", "2026-01-01T00:00:00,5Z", "2026-01-01T00:00:00.Z",
			"2026-01-01T00:00:00+01:00", "2026-01-01T00:00:00-07:30", "2026-01-01T00:00:00+24:00",
			"2026-01-01T00:00:00+01:60", "2026-01-01T00:00:00+0100", "2026-01-01T00:00:00", "2026-01-01 00:00:00Z",
			"2026-01-01t00:00:00z", "2026-01-01T5:04:05Z", "2026-01-01T24:00:00Z", "2026-01-01T23:59:60Z",
			"2026-01-01T23:59:59.999999999999Z", "2026-01-01T00:00:00Z ", " 2026-01-01", "2026-01-01x",
			"2026-01-01T00:00:00.5-00:00", "1969-12-31T23:59:59.9995Z", "2026-1-1T00:00:00Z", "+2026-01-01",
			"", "now", 0.0, 1767225600000.9, -1.5, 1e15, true, nil,
		}
		var b strings.Builder
		for _, in := range inputs {
			t, ok := spec.PointTime(in)
			desc := fmt.Sprint(in)
			if str, isStr := in.(string); isStr {
				desc = fmt.Sprintf("%q", str)
			}
			if ok {
				fmt.Fprintf(&b, "%s => %d\n", desc, t.UnixMilli())
			} else {
				fmt.Fprintf(&b, "%s => false %d\n", desc, t.UnixMilli())
			}
		}
		return b.String()
	})

	register("spec/derive-and-resolve", func() string {
		var b strings.Builder
		for _, name := range specNames(all) {
			var s spec.Spec
			if err := json.Unmarshal(all[name].Spec, &s); err != nil {
				continue
			}
			if s.Type == spec.ChartTypeBar {
				fmt.Fprintf(&b, "%s labels %q combo %v\n", name, spec.DeriveBarLabels(s.Data), spec.IsCategoricalCombo(s))
			}
			if !spec.IsCategoricalCombo(s) || s.Validate() != nil {
				continue
			}
			c, err := spec.ResolveCategoricalCombo(s)
			if err != nil {
				fmt.Fprintf(&b, "%s resolve error: %v\n", name, err)
				continue
			}
			vals := func(v []*float64) string {
				var parts []string
				for _, p := range v {
					if p == nil {
						parts = append(parts, "nil")
					} else {
						parts = append(parts, fmt.Sprint(*p))
					}
				}
				return strings.Join(parts, ",")
			}
			fmt.Fprintf(&b, "%s labels %q bars %s line %s idx %d/%d range %v..%v right %v..%v colours %s %s\n", name, c.Labels,
				vals(c.Bars), vals(c.Line), c.BarIndex, c.LineIndex, c.Min, c.Max, c.Min2, c.Max2,
				spec.ComboSeriesColor(s, c.BarIndex), spec.ComboSeriesColor(s, c.LineIndex))
		}
		return b.String()
	})
}

// specFloats is a deterministic spread of float64s: exact ties, powers of
// ten, subnormals, huge and tiny values.
func specFloats() []float64 {
	vs := []float64{0, 1, 0.5, 1.5, 2.5, 0.125, 0.375, 1.005, 2.675, 1e23, 5e-324, 1.7976931348623157e308,
		123456789.125, 0.1, 0.2, 9.995, 99.95, 999999.5, 1e21, 1e-7, 4.35, 0.045, 1.25e-5}
	a := 12345
	for k := 0; k < 120; k++ {
		a = (a*7919 + 13) % 1000003
		v := float64(a) / 1024 * math.Pow10(k%40-20)
		if k%3 == 0 {
			v = -v
		}
		vs = append(vs, v)
	}
	return vs
}

func init() {
	register("spec/strconv-format-float", func() string {
		var b strings.Builder
		for _, v := range specFloats() {
			fmt.Fprintf(&b, "%v:", v)
			for _, p := range []int{-1, 0, 1, 2, 3, 6, 9} {
				fmt.Fprintf(&b, " e%d=%s f%d=%s g%d=%s", p, strconv.FormatFloat(v, 'e', p, 64),
					p, strconv.FormatFloat(v, 'f', p, 64), p, strconv.FormatFloat(v, 'g', p, 64))
			}
			j, _ := json.Marshal(v)
			fmt.Fprintf(&b, " json=%s\n", j)
		}
		return b.String()
	})
	register("spec/strconv-quote", func() string {
		var b strings.Builder
		for _, s := range []string{"", "plain", "tab\there", "quote\"back\\slash", "\a\b\f\n\r\v\x00\x1f\x7f",
			"\u00e9\u65e5\u672c\u8a9e", "\u00ad\u200b\u2028\ufeff", "\U0001F600\U0001F1F5\U0001F1F9", "\U0001F9FF\U000E0001", "<&>", "\u0085\u00a0"} {
			fmt.Fprintf(&b, "%s %q\n", strconv.Quote(s), s)
		}
		return b.String()
	})
}
