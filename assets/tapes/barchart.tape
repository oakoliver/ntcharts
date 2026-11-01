# Render from the repo root: vhs assets/tapes/barchart.tape
# vertical stacked bars with negative values
Output "/Users/oliveiraantoniocc/Documents/projects/ntcharts/assets/barchart.gif"

Set Shell bash
Set Framerate 10
Set FontSize 16
Set Width 1340
Set Height 460
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms

Hide
Type "export PS1='> ' && clear"
Enter
Show

Type "bun examples/barchart.ts"
Sleep 300ms
Enter
Sleep 3s
Type "q"
Sleep 500ms
