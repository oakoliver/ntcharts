# Render from the repo root: vhs assets/tapes/quickstart.tape
# zoom with pgup/pgdown, move with the arrow keys
Output "/Users/oliveiraantoniocc/Documents/projects/ntcharts/assets/quickstart.gif"

Set Shell bash
Set Framerate 10
Set FontSize 16
Set Width 440
Set Height 380
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms

Hide
Type "export PS1='> ' && clear"
Enter
Show

Type "bun examples/quickstart.ts"
Sleep 300ms
Enter
Sleep 1.5s
PageUp
Sleep 700ms
PageUp
Sleep 700ms
Left
Sleep 300ms
Left
Sleep 300ms
Left
Sleep 900ms
Right
Sleep 300ms
Right
Sleep 300ms
Right
Sleep 300ms
Right
Sleep 300ms
Right
Sleep 900ms
PageDown
Sleep 500ms
PageDown
Sleep 1.2s
Type "q"
Sleep 500ms
