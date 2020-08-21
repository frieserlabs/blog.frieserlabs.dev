---
title: "Functional Options Use Case I: HTTP Service Wrapper"
date: 2020-08-29
hero: "/post/http-service-functional-options/images/network.jpg"
excerpt: Improving an HTTP API Service library wrapper.
tags:
- Development
- Go
- Patterns
- Best practices
- Use case
- HTTP
---

In previous posts, we discussed in depth the **functional options pattern** and
listed the benefits of using this pattern over others such as the builder 
pattern when designing our APIs:

{{< post-link "functional-option-in-go" >}}

In this post, we are going to see a **common use case** where we can apply 
this pattern. Many times, the application we are building needs different
 information from other services, whether of our company or external to it.
 For this purpose we use the http protocol for the exchange of information.

The simplest way to do this exchange of information in Go is to use the
 net/http package. In most cases it can be adjusted to our needs:

#### Use net/http package
```go
package main

import (
	"fmt"
	"net/http"
)

func main() {
    // simple use
	resp, err := http.Get("http://service:port")

	if err != nil {
		panic(err)
	}
	fmt.Print(resp.StatusCode)
}
```

However, we quickly appreciate how the need to reuse the calls 
to these services and encapsulate certain business logic makes 
us think of creating a specific package for communication with 
these services.

#### Use a separate package
```go
package service

import (
	"errors"
	"fmt"
	"net/http"
	"time"
)

const url = "http://service:port"

// we hide the underlying http client
// to the consumer
type Client struct {
	client *http.Client
}

// but we offer a constructor to initialize our client
func New(timeout int, maxIdleConns int) *Client {
	return &Client{
		client: &http.Client{
			Timeout: time.Duration(timeout) * time.Second,
			Transport: &http.Transport{
				MaxIdleConns: maxIdleConns,
			},
		},
	}
}

// we implement some methods and use the http 
// underlying type
func (c *Client) Ping() (int, error) {
	resp, err := c.client.Get(url)

	if err != nil {
		return http.StatusServiceUnavailable, 
		errors.New(fmt.Sprintf(
			"error calling book service: %s", err))
	}
	defer resp.Body.Close()

	return resp.StatusCode, nil
}

// another method with some logic
func (c *Client) Header(key string) (string, error) {
	resp, err := c.client.Get(url)

	if err != nil {
		return "", errors.New(fmt.Sprintf(
			"error calling book service: %s", err))
	}
	defer resp.Body.Close()

	return resp.Header.Get(key), nil
}
```

Using this package results simple too:

```go
package main

import (
	"fmt"
    "service"
)

func main() {
    // can we figure what are this values
    // without seeing the implementation?
	client := service.New(10, 100)
	
	code, err := client.Ping()

	if err != nil {
		panic(err)
	}
	fmt.Println(code)

	header, err := client.Header("test")

	if err != nil {
		panic(err)
	}
	fmt.Println(header)
}
```

This solution is totally acceptable, however it is far from exposing
a friendly API, easy to read or can be easily extended.

## Functional Options

Let's build our API using the builder pattern:

#### Use Functional Options
```go
package service

import (
	"net/http"
	"time"
)

const url = "http://service:port"

// our type to build and return to the
// consumer
type Client struct {
	client *http.Client
	Url    string
	dryRun bool
}

// type option returns a function called
// when we call the constructor
type Option func(c *Client)

// Option definition
func Timeout(n int) Option {
	return func(c *Client) {
		c.client.Timeout = time.Duration(n)
	}
}

// Option definition
func MaxIdleConnections(n int) Option {
	return func(c *Client) {
		c.client.Transport = &http.Transport{
			MaxIdleConns: n,
		}
	}
}

// Option definition
func DryRun() Option {
	return func(c *Client) {
		c.dryRun = true
	}
}

// constructor with functional options
func New(options ...Option) *Client {
	// default values
	c := &Client{
		client: &http.Client{},
		Url:    url,
	}

	for _, o := range options {
		o(c)
	}

	return c
}

func (c *Client) Ping() (int, error) {
	// same implementation with the dry-run option logic	
}

func (c *Client) Header(key string) (string, error) {
	// same implementation with the dry-run option logic	
} 
```

The use of this package will be really improved:

```go
package main

import (
	"fmt"
	"service"
)

func main() {
	// with the defaults
	client := service.New()

    // now is clear what value is for
	client = service.New(
		service.Timeout(10),
		service.MaxIdleConnections(100),
		service.DryRun())

	// dry run client with the default 
	// timeout and idle connections
	client = service.New(service.DryRun())

    // we can also create our own options
    // not defined in the package
	url := func(url string) service.Option {
		return func(c *service.Client) {
			c.Url = url
		}
	}
	client = service.New(url("http://another:port"))

    code, err := client.Ping()

	if err != nil {
		panic(err)
	}
	fmt.Println(code)
}
```

As we can see, we made our API more friendly. Let's review the benefits of
using functional options in this particular case:

* Makes code easier to read and test it.
```go
// can we figure out what does this without
// reading the implementation?
client = service.New(
    service.Timeout(10),
    service.MaxIdleConnections(100),
    service.DryRun())
```
* Makes more consistent the default values behaviour.
```go
func New(options ...Option) *Client {
	// in the constructor, we can define
    // our default values before applying
    // the options that the consumer wants
	c := &Client{
		client: &http.Client{},
		Url:    url,
	}
    ...
}
```

* Avoids breaking API breaks.
```go
// using variadic functions we can add
// new options to the package without
// breaking our consumer code 
func New(options ...Option) *Client { ... }
```
* Safe use of the API, avoids bad uses and values.
```go
// providing our options to the consumer
// we enforce a safe use of the API
func Timeout(n int) Option {
	return func(c *Client) {
		c.client.Timeout = time.Duration(n)
	}
}
```
* Can be easily extended with our options implementation.
```go
// as we see, the consumers can implement
// theirs custom functional options and 
// extend the API
url := func(url string) service.Option {
    return func(c *service.Client) {
        c.Url = url
    }
}
client = service.New(url("http://another:port"))
```

* Self documenting API.
```go
// no need to comment what it does, its clear 
// thanks to the API naming
client = service.New(service.DryRun())
```
* Highly configurable.
```go
// the consumers can configure the API
// on their needs with the combination
// of functional options
client = service.New(service.Timeout(5))

client = service.New(
    service.Timeout(10),
    service.MaxIdleConnections(100))

client = service.New(
        service.Timeout(50),
        service.MaxIdleConnections(200),
        service.DryRun())

client = service.New(service.DryRun())
```

You can view the functional options pattern in other user cases:

{{< post-link "simple-orm-functional-options" >}}