# Render from the repo root: vhs assets/tapes/market.tape
Output "/Users/oliveiraantoniocc/Documents/projects/ntcharts/assets/market.gif"

Set Shell bash
Set Framerate 10
Set FontSize 16
Set Width 1160
Set Height 680
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms

Hide
Type "export PS1='> ' && clear"
Enter
Show

Type "bun examples/market.ts --demo"
Sleep 300ms
Enter
Sleep 2.4s

# next ticker, then block candles
Down
Sleep 1.2s
Type "b"
Sleep 1.4s

# scroll back in time, then follow live again
Left
Sleep 400ms
Left
Sleep 400ms
Left
Sleep 1s
End
Sleep 1s

# zoom out to see the session
Type "-"
Sleep 300ms
Type "-"
Sleep 300ms
Type "-"
Sleep 1.6s

Type "q"
Sleep 500ms
