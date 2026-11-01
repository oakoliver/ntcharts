# Render from the repo root: vhs assets/tapes/streamlinechart.tape
# two streams, one on a right Y axis
Output "/Users/oliveiraantoniocc/Documents/projects/ntcharts/assets/streamlinechart.gif"

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

Type "bun examples/streamlinechart.ts"
Sleep 300ms
Enter
Sleep 6s
PageUp
Sleep 1s
PageUp
Sleep 1.5s
Type "q"
Sleep 500ms
