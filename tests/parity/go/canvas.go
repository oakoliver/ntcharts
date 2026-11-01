package main

import (
	"fmt"
	"strings"

	"charm.land/bubbles/v2/key"
	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
	"github.com/NimbleMarkets/ntcharts/v2/canvas"
)

func cvStyle(fg string) lipgloss.Style { return lipgloss.NewStyle().Foreground(lipgloss.Color(fg)) }

var (
	cvRed   = cvStyle("1")
	cvGreen = cvStyle("2")
	cvBlue  = cvStyle("4")
	cvBold  = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#ff8800")).Background(lipgloss.Color("#202020"))
)

func cvKey(code rune) tea.Msg { return tea.KeyPressMsg{Code: code} }
func cvText(c rune) tea.Msg   { return tea.KeyPressMsg{Code: c, Text: string(c)} }
func cvWheel(b tea.MouseButton) tea.Msg {
	return tea.MouseWheelMsg{Button: b}
}

// cvDigits returns a w x h canvas filled with the digits of the column+row.
func cvDigits(w, h int, opts ...canvas.Option) canvas.Model {
	c := canvas.New(w, h, opts...)
	lines := make([]string, h)
	for y := 0; y < h; y++ {
		var sb strings.Builder
		for x := 0; x < w; x++ {
			sb.WriteByte(byte('a' + (x+y*3)%26))
		}
		lines[y] = sb.String()
	}
	c.SetLines(lines)
	return c
}

func cvCursor(c canvas.Model) string {
	p := c.Cursor()
	return fmt.Sprintf("\ncursor=%d,%d", p.X, p.Y)
}

func cvUpdates(c canvas.Model, msgs ...tea.Msg) canvas.Model {
	for _, m := range msgs {
		c, _ = c.Update(m)
	}
	return c
}

func init() {
	register("canvas/hello", func() string {
		c := canvas.New(5, 2)
		c.SetLinesWithStyle([]string{"hello", "world"}, lipgloss.NewStyle().Foreground(lipgloss.Color("6")))
		return c.View()
	})

	register("canvas/set-lines-styles", func() string {
		c := canvas.New(12, 4, canvas.WithStyle(cvGreen))
		c.SetLines([]string{"default green", "short", "", "fourth", "overflow row"})
		c.SetLinesWithStyle([]string{"red top"}, cvRed)
		c.SetStringWithStyle(canvas.Point{X: 3, Y: 1}, "bold", cvBold)
		c.SetString(canvas.Point{X: 8, Y: 2}, "truncated text")
		c.SetString(canvas.Point{X: -2, Y: 3}, "negative x")
		ok1 := c.SetString(canvas.Point{X: 0, Y: -1}, "above")
		ok2 := c.SetString(canvas.Point{X: 0, Y: 4}, "below")
		ok3 := c.SetLinesWithStyle([]string{"a", "b"}, cvBlue)
		return fmt.Sprintf("%s\n%v %v %v", c.View(), ok1, ok2, ok3)
	})

	register("canvas/set-runes", func() string {
		c := canvas.New(10, 3)
		c.SetRunes(canvas.Point{X: 1, Y: 0}, []rune("héllo█"))
		c.SetRunesWithStyle(canvas.Point{X: 0, Y: 1}, []rune{'日', '本', '語', '⠿'}, cvRed)
		c.SetRunesWithStyle(canvas.Point{X: 8, Y: 2}, []rune("abcdef"), cvBold)
		c.SetRunesWithStyle(canvas.Point{X: -3, Y: 2}, []rune("xyzwv"), cvBlue)
		return c.View()
	})

	register("canvas/set-cells", func() string {
		c := canvas.New(8, 4, canvas.WithStyle(cvBlue))
		r1 := c.SetRune(canvas.Point{X: 0, Y: 0}, 'A')
		r2 := c.SetRuneWithStyle(canvas.Point{X: 1, Y: 1}, 'B', cvRed)
		r3 := c.SetCell(canvas.Point{X: 2, Y: 2}, canvas.NewCellWithStyle('C', cvBold))
		r4 := c.SetCell(canvas.Point{X: 3, Y: 3}, canvas.NewCell('D'))
		r5 := c.SetRune(canvas.Point{X: 8, Y: 0}, 'X')
		r6 := c.SetRuneWithStyle(canvas.Point{X: 0, Y: -1}, 'X', cvRed)
		r7 := c.SetCell(canvas.Point{X: -1, Y: 0}, canvas.NewCell('X'))
		r8 := c.SetCellStyle(canvas.Point{X: 0, Y: 0}, cvGreen)
		r9 := c.SetCellStyle(canvas.Point{X: 4, Y: 4}, cvGreen)
		c.SetCellStyle(canvas.Point{X: 5, Y: 1}, cvRed) // style on an empty cell
		gs := c.GetCellStyle(canvas.Point{X: 0, Y: 0})
		gn := c.GetCellStyle(canvas.Point{X: 9, Y: 9})
		cell := c.Cell(canvas.Point{X: 1, Y: 1})
		out := c.Cell(canvas.Point{X: 99, Y: 1})
		return fmt.Sprintf("%s\n%v %v %v %v %v %v %v %v %v %v %v %d %d %v", c.View(),
			r1, r2, r3, r4, r5, r6, r7, r8, r9, gs != nil, gn == nil, cell.Rune, out.Rune, gs.Render("z"))
	})

	register("canvas/fill", func() string {
		c := canvas.New(6, 3)
		c.Fill(canvas.NewCellWithStyle('#', cvRed))
		c.SetString(canvas.Point{X: 1, Y: 1}, "ok")
		return c.View()
	})

	register("canvas/fill-line", func() string {
		c := canvas.New(7, 5)
		c.FillLine(0, canvas.NewCellWithStyle('=', cvGreen))
		c.FillLine(2, canvas.NewCell('-'))
		c.FillLine(4, canvas.NewCellWithStyle('~', cvBold))
		c.FillLine(5, canvas.NewCell('!'))
		c.FillLine(-1, canvas.NewCell('!'))
		return c.View()
	})

	register("canvas/set-style", func() string {
		c := cvDigits(8, 3)
		c.SetStyle(cvBlue)
		c.SetString(canvas.Point{X: 2, Y: 1}, "ZZ")
		return c.View()
	})

	register("canvas/clear", func() string {
		c := cvDigits(6, 3, canvas.WithStyle(cvRed))
		before := c.View()
		c.Clear()
		c.SetRune(canvas.Point{X: 5, Y: 2}, '.')
		return before + "\n--\n" + c.View()
	})

	register("canvas/shift-up", func() string {
		c := cvDigits(5, 4, canvas.WithStyle(cvRed))
		c.SetStyle(cvRed)
		c.SetRuneWithStyle(canvas.Point{X: 0, Y: 3}, '@', cvBlue)
		c.ShiftUp()
		return c.View()
	})

	register("canvas/shift-down", func() string {
		c := cvDigits(5, 4)
		c.SetRuneWithStyle(canvas.Point{X: 0, Y: 0}, '@', cvBlue)
		c.ShiftDown()
		c.ShiftDown()
		return c.View()
	})

	register("canvas/shift-left", func() string {
		c := cvDigits(6, 3)
		c.SetRuneWithStyle(canvas.Point{X: 1, Y: 1}, '@', cvBlue)
		c.ShiftLeft()
		return c.View()
	})

	register("canvas/shift-right", func() string {
		c := cvDigits(6, 3)
		c.SetRuneWithStyle(canvas.Point{X: 4, Y: 1}, '@', cvBlue)
		c.ShiftRight()
		c.ShiftRight()
		return c.View()
	})

	register("canvas/shift-single-cell", func() string {
		c := canvas.New(1, 1)
		c.SetRune(canvas.Point{X: 0, Y: 0}, 'q')
		c.ShiftUp()
		a := c.View()
		c.SetRune(canvas.Point{X: 0, Y: 0}, 'q')
		c.ShiftLeft()
		b := c.View()
		c.SetRune(canvas.Point{X: 0, Y: 0}, 'q')
		c.ShiftDown()
		d := c.View()
		c.SetRune(canvas.Point{X: 0, Y: 0}, 'q')
		c.ShiftRight()
		return a + "|" + b + "|" + d + "|" + c.View() + "|"
	})

	register("canvas/resize-grow", func() string {
		c := cvDigits(4, 2, canvas.WithStyle(cvGreen))
		c.SetCursor(canvas.Point{X: 2, Y: 1})
		c.Resize(7, 4)
		c.SetString(canvas.Point{X: 3, Y: 3}, "new")
		return c.View() + cvCursor(c) + fmt.Sprintf(" %dx%d", c.Width(), c.Height())
	})

	register("canvas/resize-shrink", func() string {
		c := cvDigits(8, 5)
		c.Resize(3, 2)
		c.Resize(5, 3)
		return c.View() + fmt.Sprintf(" %dx%d view=%dx%d", c.Width(), c.Height(), c.ViewWidth, c.ViewHeight)
	})

	register("canvas/resize-zero-negative", func() string {
		c := cvDigits(4, 3)
		c.Resize(-5, 2)
		a := c.View()
		c.Resize(3, -1)
		b := c.View()
		c.Resize(0, 0)
		return fmt.Sprintf("%q %q %q %dx%d", a, b, c.View(), c.Width(), c.Height())
	})

	register("canvas/resize-with-view-size", func() string {
		c := cvDigits(6, 4, canvas.WithViewWidth(3), canvas.WithViewHeight(2))
		c.Resize(9, 6)
		a := c.View()
		c.ViewWidth = 9
		c.ViewHeight = 6
		return a + "\n--\n" + c.View()
	})

	register("canvas/with-options", func() string {
		c := canvas.New(10, 4,
			canvas.WithStyle(cvRed),
			canvas.WithContent([]string{"line one", "line two", "three"}),
			canvas.WithViewWidth(6),
			canvas.WithViewHeight(3),
			canvas.WithCursor(canvas.Point{X: 2, Y: 1}),
			canvas.WithFocus(),
		)
		return c.View() + cvCursor(c) + fmt.Sprintf(" focused=%v", c.Focused())
	})

	register("canvas/cursor-clamp", func() string {
		c := cvDigits(6, 4, canvas.WithViewWidth(3), canvas.WithViewHeight(2))
		c.SetCursor(canvas.Point{X: 99, Y: 99})
		a := c.View() + cvCursor(c)
		c.SetCursor(canvas.Point{X: -4, Y: 2})
		return a + "\n--\n" + c.View() + cvCursor(c)
	})

	register("canvas/viewport-smaller", func() string {
		c := cvDigits(12, 6, canvas.WithViewWidth(5), canvas.WithViewHeight(3), canvas.WithStyle(cvBlue))
		c.SetCursor(canvas.Point{X: 3, Y: 2})
		return c.View()
	})

	register("canvas/viewport-clipped-by-canvas", func() string {
		c := cvDigits(6, 4, canvas.WithViewWidth(5), canvas.WithViewHeight(3))
		c.SetCursor(canvas.Point{X: 4, Y: 3})
		return fmt.Sprintf("%q", c.View())
	})

	register("canvas/viewport-larger", func() string {
		c := cvDigits(4, 3, canvas.WithViewWidth(9), canvas.WithViewHeight(5))
		return fmt.Sprintf("%q", c.View())
	})

	register("canvas/viewport-zero", func() string {
		a := canvas.New(0, 0)
		b := canvas.New(3, 0)
		d := canvas.New(0, 3)
		return fmt.Sprintf("%q %q %q", a.View(), b.View(), d.View())
	})

	register("canvas/update-keys", func() string {
		c := cvDigits(10, 8, canvas.WithViewWidth(6), canvas.WithViewHeight(3), canvas.WithFocus())
		c = cvUpdates(c, cvKey(tea.KeyDown), cvText('j'), cvKey(tea.KeyRight), cvText('l'), cvKey(tea.KeyPgDown))
		a := c.View() + cvCursor(c)
		c = cvUpdates(c, cvKey(tea.KeyUp), cvText('k'), cvKey(tea.KeyLeft), cvText('h'), cvKey(tea.KeyPgUp))
		return a + "\n--\n" + c.View() + cvCursor(c)
	})

	register("canvas/update-keys-limits", func() string {
		c := cvDigits(10, 8, canvas.WithViewWidth(6), canvas.WithViewHeight(3), canvas.WithFocus())
		for i := 0; i < 20; i++ {
			c = cvUpdates(c, cvKey(tea.KeyDown), cvKey(tea.KeyRight))
		}
		a := c.View() + cvCursor(c)
		for i := 0; i < 20; i++ {
			c = cvUpdates(c, cvKey(tea.KeyUp), cvKey(tea.KeyLeft))
		}
		return a + "\n--\n" + c.View() + cvCursor(c)
	})

	register("canvas/update-unfocused", func() string {
		c := cvDigits(10, 8, canvas.WithViewWidth(6), canvas.WithViewHeight(3))
		c = cvUpdates(c, cvKey(tea.KeyDown), cvWheel(tea.MouseWheelDown))
		a := cvCursor(c)
		c.Focus()
		c = cvUpdates(c, cvKey(tea.KeyDown))
		b := cvCursor(c)
		c.Blur()
		c = cvUpdates(c, cvKey(tea.KeyDown))
		return a + b + cvCursor(c)
	})

	register("canvas/update-wheel", func() string {
		c := cvDigits(10, 8, canvas.WithViewWidth(6), canvas.WithViewHeight(3), canvas.WithFocus())
		c = cvUpdates(c, cvWheel(tea.MouseWheelDown), cvWheel(tea.MouseWheelDown), cvWheel(tea.MouseWheelRight), cvWheel(tea.MouseWheelRight), cvWheel(tea.MouseWheelRight))
		a := c.View() + cvCursor(c)
		c = cvUpdates(c, cvWheel(tea.MouseWheelUp), cvWheel(tea.MouseWheelLeft), cvWheel(tea.MouseWheelLeft), cvWheel(tea.MouseWheelUp), cvWheel(tea.MouseWheelUp))
		return a + "\n--\n" + c.View() + cvCursor(c)
	})

	register("canvas/update-ignored-msgs", func() string {
		c := cvDigits(10, 8, canvas.WithViewWidth(6), canvas.WithViewHeight(3), canvas.WithFocus())
		c = cvUpdates(c,
			tea.KeyPressMsg{Code: 'x', Text: "x"},
			tea.KeyPressMsg{Code: tea.KeyEnter},
			tea.MouseClickMsg{Button: tea.MouseLeft},
			tea.MouseMotionMsg{Button: tea.MouseLeft, X: 3, Y: 3},
			tea.MouseReleaseMsg{Button: tea.MouseLeft},
			tea.MouseWheelMsg{Button: tea.MouseLeft},
			tea.WindowSizeMsg{Width: 10, Height: 10},
			"a string", 42, nil,
		)
		return cvCursor(c)
	})

	register("canvas/update-key-release", func() string {
		c := cvDigits(10, 8, canvas.WithViewWidth(6), canvas.WithViewHeight(3), canvas.WithFocus())
		c = cvUpdates(c, tea.KeyReleaseMsg{Code: tea.KeyDown}, tea.KeyReleaseMsg{Code: tea.KeyRight})
		return cvCursor(c)
	})

	register("canvas/update-custom-keymap", func() string {
		km := canvas.DefaultKeyMap()
		km.Down = key.NewBinding(key.WithKeys("s"))
		km.Up = key.NewBinding(key.WithKeys("w"))
		km.Right = key.NewBinding(key.WithKeys("d", "right"))
		c := cvDigits(10, 8, canvas.WithViewWidth(6), canvas.WithViewHeight(3), canvas.WithFocus(), canvas.WithKeyMap(km))
		c = cvUpdates(c, cvKey(tea.KeyDown), cvText('j'), cvText('s'), cvText('s'), cvText('d'), cvKey(tea.KeyRight), cvText('l'))
		a := cvCursor(c)
		c = cvUpdates(c, cvText('w'), cvKey(tea.KeyUp), cvText('k'), cvText('h'), cvKey(tea.KeyLeft))
		return a + cvCursor(c) + "\n" + c.View()
	})

	register("canvas/update-custom-handler", func() string {
		calls := 0
		h := func(m *canvas.Model, msg tea.Msg) {
			calls++
			switch msg.(type) {
			case tea.KeyPressMsg:
				m.MoveRight(2)
				m.MoveDown(1)
			case tea.MouseWheelMsg:
				m.MoveLeft(1)
			}
		}
		c := cvDigits(12, 8, canvas.WithViewWidth(5), canvas.WithViewHeight(3), canvas.WithFocus(), canvas.WithUpdateHandler(h))
		c = cvUpdates(c, cvKey(tea.KeyEnter), cvKey(tea.KeyEnter), cvWheel(tea.MouseWheelUp))
		return c.View() + cvCursor(c) + fmt.Sprintf(" calls=%d", calls)
	})

	register("canvas/move-direct", func() string {
		c := cvDigits(10, 6, canvas.WithViewWidth(4), canvas.WithViewHeight(2))
		c.MoveDown(3)
		c.MoveRight(4)
		a := cvCursor(c)
		c.MoveDown(10)
		c.MoveRight(10)
		b := cvCursor(c)
		c.MoveUp(100)
		c.MoveLeft(100)
		return a + b + cvCursor(c) + "\n" + c.View()
	})

	register("canvas/draw-then-view-scrolled", func() string {
		c := canvas.New(8, 6, canvas.WithViewWidth(8), canvas.WithViewHeight(3), canvas.WithFocus())
		for i := 0; i < 6; i++ {
			c.SetStringWithStyle(canvas.Point{X: i, Y: i}, fmt.Sprintf("r%d", i), cvRed)
		}
		var sb strings.Builder
		for i := 0; i < 4; i++ {
			sb.WriteString(c.View())
			sb.WriteString("\n==\n")
			c = cvUpdates(c, cvKey(tea.KeyDown))
		}
		return sb.String()
	})
}
