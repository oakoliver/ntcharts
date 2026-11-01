# Render from the repo root: vhs assets/tapes/linechart.tape
# lines, circles and a zoomable scatter plot
Output "/Users/oliveiraantoniocc/Documents/projects/ntcharts/assets/linechart.gif"

Set Shell bash
Set Framerate 10
Set FontSize 16
Set Width 960
Set Height 440
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms

Hide
Type "export PS1='> ' && clear"
Enter
Show

Type "bun examples/linechart.ts"
Sleep 300ms
Enter
Sleep 1.2s
Type " "
Sleep 900ms
Type " "
Sleep 900ms
Type " "
Sleep 900ms
PageUp
Sleep 500ms
PageUp
Sleep 600ms
Left
Sleep 250ms
Left
Sleep 250ms
Up
Sleep 800ms
PageDown
Sleep 500ms
PageDown
Sleep 1.2s
Type "q"
Sleep 500ms
