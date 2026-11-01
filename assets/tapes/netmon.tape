# Render from the repo root: vhs assets/tapes/netmon.tape
Output "/Users/oliveiraantoniocc/Documents/projects/ntcharts/assets/netmon.gif"

Set Shell bash
Set Framerate 10
Set FontSize 16
Set Width 1200
Set Height 700
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms

Hide
Type "export PS1='> ' && clear"
Enter
Show

Type "bun examples/netmon.ts --demo"
Sleep 300ms
Enter
Sleep 2s

# select api.example.net: its loss bursts show on the right axis
Down
Sleep 200ms
Down
Sleep 1.6s

# 15 minute window: the congestion on edge-fra-2 shows up; then 1 minute
Type "3"
Sleep 1.6s
Type "1"
Sleep 1.2s

# linear Y axis, then log again
Type "g"
Sleep 1.2s
Type "g"
Sleep 500ms
Type "q"
Sleep 400ms
