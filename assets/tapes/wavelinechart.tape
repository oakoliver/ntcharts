# Render from the repo root: vhs assets/tapes/wavelinechart.tape
# sine and cosine waves
Output "/Users/oliveiraantoniocc/Documents/projects/ntcharts/assets/wavelinechart.gif"

Set Shell bash
Set Framerate 10
Set FontSize 16
Set Width 820
Set Height 480
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms

Hide
Type "export PS1='> ' && clear"
Enter
Show

Type "bun examples/wavelinechart.ts"
Sleep 300ms
Enter
Sleep 1.4s
PageUp
Sleep 500ms
PageUp
Sleep 600ms
Right
Sleep 300ms
Right
Sleep 600ms
Type "s"
Sleep 1.2s
Type "q"
Sleep 500ms
