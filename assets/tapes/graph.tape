# Render from the repo root: vhs assets/tapes/graph.tape
# pages 1-6: lines, circles, braille, columns, rows, candlesticks
Output "/Users/oliveiraantoniocc/Documents/projects/ntcharts/assets/graph.gif"

Set Shell bash
Set Framerate 10
Set FontSize 16
Set Width 780
Set Height 420
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms

Hide
Type "export PS1='> ' && clear"
Enter
Show

Type "bun examples/graph.ts"
Sleep 300ms
Enter
Sleep 1.4s
Right
Sleep 250ms
Right
Sleep 250ms
Up
Sleep 250ms
Up
Sleep 800ms
Type "2"
Sleep 1s
Left
Sleep 250ms
Left
Sleep 800ms
Type "3"
Sleep 1.2s
Type "4"
Sleep 1.2s
Type "5"
Sleep 1.2s
Type "6"
Sleep 1.4s
Type "q"
Sleep 500ms
