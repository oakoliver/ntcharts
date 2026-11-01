package main

import (
	"charm.land/lipgloss/v2"
	"github.com/NimbleMarkets/ntcharts/v2/canvas"
)

func init() {
	register("canvas/hello", func() string {
		c := canvas.New(5, 2)
		c.SetLinesWithStyle([]string{"hello", "world"}, lipgloss.NewStyle().Foreground(lipgloss.Color("6")))
		return c.View()
	})
}
