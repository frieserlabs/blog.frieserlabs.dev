---
title: Functional Options for your API in Go
date: 2020-08-29
hero: "startup.jpg"
excerpt: Make your packages API more friendly in Go.
authors:
  - frieser
tags:
- Development
- Go
- Patterns
- Best practices
---

**Design patterns** constantly help us to design our software architecture,
and allow programmers to speak in a **common language** that make easier the 
transmission of concepts regardless of the programming language used.

The most used are those that help us to initialize type values: Creational Patterns.
Recently I found a functional pattern that in my case fits most of the time:
 **`Functional Options`**.
Before define and look at examples of how to use this pattern, I want to 
dive in **how we normally initialize objects in Go**.

## Building objects: Passing arguments

Let's imagine that we want to create a package called table that let the consumers
build tables. The simplest way would be using the struct literal itself:

```go
package table

type Table struct {
	legs int
}
```

```go
package main

func main() {
	// use the struct literal
	t := table.Table{legs: 4}
}
```

In most cases, we need to add some logic or property validations to build the
object. For example, we can figure that the minimum legs of a table should be 3 to 
be stable. In these cases we need to use a constructor for the table: 


```go
func New(legs int) *Table {
    // 3 is the minimum legs to be stable 
	if legs < 3 {
		legs = 3
	}

	return &Table{
		legs: legs,
	}
}
```

```go
package main

func main() {
	// use the constructor
	t := table.New(5)
}
```

Ok, simple, effective... but What happens if we need to add more
properties to our type?

```go
package table

type Table struct {
	legs     int
	color    string
	material string
	shape    string
}

func New(legs int, color, material, shape string) *Table {
	if legs < 3 {
		legs = 3
	}

	return &Table{
		legs:     legs,
		color:    color,
		material: material,
		shape:    shape,
	}
}
```

```go
package main

func main() {
	// use the constructor
	t := table.New(5, "white", "wood", "rectangular")
}
```

Every change of the constructor's parameters will **break compatibility** and
will force us to change every call and makes **harder to understand and test** your API.
It also forces the consumer of the package to 
**memorize the order of the parameters**, which one are **optional or mandatory**
and their default values.

A logical evolution of this design would be passing a **configuration struct** instead
a list of arguments:

```go
package table

type Config struct {
	Legs     int
	Color    string
	Material string
	Shape    string
}

func New(c Config) *Table {
	if c.legs < 3 {
		legs := 3
	}

	return &Table{
		legs:     legs,
		color:    c.color,
		material: c.material,
		shape:    c.shape,
	}
}

```

```go
package main

func main() {
	// use a config struct
	t := table.New(table.Config{
		legs:     5,
		color:    "white",
		material: "wood",
		shape:    "rectangular"})
}
```

This approach give us the possibility to add more properties without breaking 
the API compatibility, however we still do not know which of these parameters 
are optional or mandatory, and which are their default values.

## Building objects: Builder pattern
Another approach we can take is to implement the builder pattern. 
You can look for a full implementation
[here](https://github.com/tmrts/go-patterns/blob/master/creational/builder.md). 

This is how our API would look:

```go
package main

func main() {
	// use a builder
	b := table.NewBuilder()

	t := b.Legs().
		Color("blue").
		Material("wood").
		Shape("rectangular").
		Build()
}

```

With the builder pattern we get rid of the parameters order problem, the default
values problem(notice that `int Legs()` method invocation we accept the 3 legs default value)
and makes the code easier to read and test.

In the other hand, we have to create a builder for every concrete type, and we don't have
the opportunity as a consumer to extend the behaviour of the constructor.

We can improve this design with Functional Options.

## Building objects: Functional options pattern

In the post 
[Self-referential functions and the design of options](https://commandcenter.blogspot.com/2014/01/self-referential-functions-and-design.html) 
Rob Pike introduces the concept of the Functional Options and his motivation.

Functional Options is a **functional pattern** that lets us set the state of type value 
we want to create with a series of options. 

An option is not more than a function that returns another function: a **closure**. 
This closure will be executed inside the constructor and set the state of the type value.

#### Formal definition
```go
package somepackage

// our type
type T struct {
	property string
}
// alias type definition
type Option func(*T)

// option function that return a function: closure
func SomeOption() Option {
	// this function will be executed inside the constructor
	// and set the state of our value type.
	return func(value *T) {
		value.property = "value"
	}
}

// constructor that receives a list of options
func New(options ...Option) *T {
	value := &T{}
	// loop over the passed options
	for _, option := range options {
		// this will execute the inner function 
		// of every option passed
		option(value)
	}

	return value
}
```

```go
package main

import "somepackage"

func main() {
	// Note that mypackage.SomeOption() pass to
	// the constructor the inner function:
	// func(value *T) {
	//		value.property = "value"
	//	}
	v := somepackage.New(somepackage.SomeOption())
}
```
Now, let's look to our previous table example using Functional Options.

#### Table example

```go
package table

const (
	Black Color = "black"
	White       = "white"
	Gray        = "gray"
)

const (
	Wood    Material = "wood"
	Metal            = "metal"
	Plastic          = "plastic"
)

const (
	Square   Shape = "square"
	Round          = "round"
	Triangle       = "triangle"
)

type Color string
type Material string
type Shape string

// our type to build and return to the
// consumer
type Table struct {
	Legs     int
	Color    Color
	Material Material
	Shape    Shape
}

// type option returns a function called
// when we call the constructor
type Option func(*Table)

// Option definition
func WithWood() Option {
	// inner closure
	return func(t *Table) {
		t.Material = Wood
	}
}

// Option definition
func WithPlastic() Option {
	return func(t *Table) {
		t.Material = Plastic
	}
}

// Option definition
func Rounded() Option {
	return func(t *Table) {
		t.Shape = Round
	}
}

// Option definition
func Triangular() Option {
	return func(t *Table) {
		t.Shape = Triangle
	}
}

// Option definition with parameters
func Legs(n int) Option {
	return func(t *Table) {
		t.Legs = n
	}
}

// constructor receives a list of options
func New(options ...Option) *Table {
	t := &Table{
		// default values
		Legs:     3,
		Color:    Black,
		Material: Metal,
		Shape:    Square,
	}
	// loop over the options arguments 
	// and call his inner function
	for _, o := range options {
		o(t)
	}

	// and finally return the built Table
	return t
}

```

```go
package main

func main() {
    // note that we can read this and figure how our table
    // will be without looking at the implementation
	t := table.New(table.WithPlastic(), table.Rounded())
	t = table.New(table.Legs(6),
		table.WithWood(),
		table.Triangular())

	// with the default values
	t = table.New()

	// we can also create our own options
	// not defined in the package
	withoutLegs := func() table.Option {
		return func(t *table.Table) {
			t.Legs = 0
		}
	}
	t = table.New(withoutLegs())

	// another example more concise
	t = table.New(func() table.Option {
		return func(t *table.Table) {
			t.Color = "red"
		}
	}())
}

```

Maybe it could seem a lot of code a first time, but the benefits justify
this downside.

## Benefits
* Makes code easier to read and test it.
* Makes more consistent the default values behaviour.
* Avoids breaking API breaks.
* Safe use of the API, avoids bad uses and values.
* Can be easily extended with our options implementation.
* Self documenting API.
* Highly configurable.

## Practical use cases

The table example code is useful to understand the concept, but is more useful
to see this pattern in real daily use cases.

{{< post-link "http-service-functional-options" >}}

{{< post-link "simple-orm-functional-options" >}}

## Conclusions
Functional Options pattern lets us to define **friendly APIs**
and make the architecture of our libraries more readable, 
testable, extendable and configurable.

For me, a good rule to follow while designing any private or public library/package
exposing an API is "**design your APIs like you were the consumer**".

However, remember that sometimes we don't need this type of patterns, if a simple literal 
type value initialization fits your need, use it, don't feel the need to create an 
unnecessary constructor or to use this Functional Options pattern.