# Render from the repo root: vhs assets/tapes/canvas.tape
# enter switches canvas, the arrow keys move its viewport
Output "/Users/oliveiraantoniocc/Documents/projects/ntcharts/assets/canvas.gif"

Set Shell bash
Set Framerate 10
Set FontSize 16
Set Width 860
Set Height 340
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms

Hide
Type "export PS1='> ' && clear"
Enter
Show

Type "bun examples/canvas.ts"
Sleep 300ms
Enter
Sleep 1.5s
Down
Sleep 400ms
Right
Sleep 400ms
Right
Sleep 900ms
Enter
Sleep 500ms
Down
Sleep 400ms
Down
Sleep 400ms
Right
Sleep 400ms
Right
Sleep 400ms
Right
Sleep 1.2s
Type "q"
Sleep 500ms
