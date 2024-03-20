package main

import (
	"flag"
	"fmt"
)

func cli() {
	// Define flags
	name := flag.String("name", "World", "a name to say hello to")

	// Parse the flags
	flag.Parse()

	// Use the flags
	fmt.Printf("Hello, %s!\n", *name)
}
