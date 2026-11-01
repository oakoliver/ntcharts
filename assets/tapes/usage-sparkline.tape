# Render from the repo root: vhs assets/tapes/usage-sparkline.tape
Output "/private/tmp/claude-501/-Users-oliveiraantoniocc-Documents-projects-vibe/8ac41bf5-11e9-4454-8b40-1508f3f65369/scratchpad/usage-sparkline.gif"

Set Shell bash
Set FontSize 16
Set Width 420
Set Height 300
Set Padding 20
Set Theme "Catppuccin Mocha"

Hide
Type "export PS1='> ' && clear"
Enter
Type "bun examples/usage/sparkline.ts"
Enter
Sleep 1.5s
Show
Sleep 200ms
Screenshot "/Users/oliveiraantoniocc/Documents/projects/ntcharts/assets/usage-sparkline.png"
Sleep 200ms
