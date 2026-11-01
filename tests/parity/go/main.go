// Command parity renders the scenarios registered by the other files in this
// directory with upstream ntcharts and prints them as JSON. The TypeScript
// tests in tests/parity.test.ts render the same scenarios with the port and
// compare byte for byte. Regenerate with:
//
//	cd tests/parity/go && go run . > ../goldens.json
package main

import (
	"encoding/json"
	"os"
	"sort"
)

type scenario struct {
	name string
	fn   func() string
}

var scenarios []scenario

func register(name string, fn func() string) {
	scenarios = append(scenarios, scenario{name, fn})
}

func main() {
	sort.Slice(scenarios, func(i, j int) bool { return scenarios[i].name < scenarios[j].name })
	out := make(map[string]string, len(scenarios))
	for _, s := range scenarios {
		if _, dup := out[s.name]; dup {
			panic("duplicate scenario " + s.name)
		}
		out[s.name] = s.fn()
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)
	if err := enc.Encode(out); err != nil {
		panic(err)
	}
}
