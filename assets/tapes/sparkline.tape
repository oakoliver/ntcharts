# Render from the repo root: vhs assets/tapes/sparkline.tape
# six sparklines fed the same values
Output "/Users/oliveiraantoniocc/Documents/projects/ntcharts/assets/sparkline.gif"

Set Shell bash
Set Framerate 10
Set FontSize 16
Set Width 1080
Set Height 460
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms

Hide
Type "export PS1='> ' && clear"
Enter
Show

Type "bun examples/sparkline.ts"
Sleep 300ms
Enter
Sleep 4.5s
Type "q"
Sleep 500ms
