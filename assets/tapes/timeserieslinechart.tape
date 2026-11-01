# Render from the repo root: vhs assets/tapes/timeserieslinechart.tape
# lines, braille, then candles; zoom and fit Y
Output "/Users/oliveiraantoniocc/Documents/projects/ntcharts/assets/timeserieslinechart.gif"

Set Shell bash
Set Framerate 10
Set FontSize 16
Set Width 1060
Set Height 480
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms

Hide
Type "export PS1='> ' && clear"
Enter
Show

Type "bun examples/timeserieslinechart.ts"
Sleep 300ms
Enter
Sleep 1.4s
Type "c"
Sleep 1.2s
Type "c"
Sleep 1.2s
PageUp
Sleep 500ms
PageUp
Sleep 500ms
Left
Sleep 250ms
Left
Sleep 250ms
Left
Sleep 600ms
Type "f"
Sleep 1.4s
Type "q"
Sleep 500ms
