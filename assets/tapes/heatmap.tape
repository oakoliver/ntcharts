# Render from the repo root: vhs assets/tapes/heatmap.tape
# a labelled heatmap, then the radial one
Output "/Users/oliveiraantoniocc/Documents/projects/ntcharts/assets/heatmap.gif"

Set Shell bash
Set Framerate 10
Set FontSize 16
Set Width 1000
Set Height 600
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms

Hide
Type "export PS1='> ' && clear"
Enter
Show

Type "bun examples/heatmap.ts"
Sleep 300ms
Enter
Sleep 1.4s
Type "+"
Sleep 500ms
Type "+"
Sleep 900ms
Type "l"
Sleep 900ms
Type "l"
Sleep 600ms
Tab
Sleep 1.4s
Type "-"
Sleep 500ms
Type "-"
Sleep 1.2s
Type "q"
Sleep 500ms
