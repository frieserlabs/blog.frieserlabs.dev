---
title: "Functional Options Use Case II: Simple ORM"
date: 2020-08-29
hero: "/post/simple-orm-functional-options/images/datacenter.jpg"
excerpt: Prototype a simple ORM using functional options pattern.
authors:
  - frieser
tags:
- Development
- Go
- Patterns
- Best practices
- Use case
- Database
- SQL
- ORM
---

In previous posts, we discussed in depth the **functional options pattern** and
listed the benefits of using this pattern over others such as the builder 
pattern when designing our APIs:

{{< post-link "functional-option-in-go" >}}

In this one, we are going to apply this pattern to another common use case
in our projects, **accessing a database**. We are going to build a **simple ORM**
to map our **User** type values from our database.

The go "database/sql" package let us to access to a database, and in most 
of the cases we can simply use this package directly. But at certain 
point, we are going to need to create our own package to encapsulate
our database logic:

#### User Package
```go
package User

import (
	"database/sql"
	_ "github.com/go-sql-driver/mysql"
	"github.com/pkg/errors"
)

const source = "user:password@tcp(127.0.0.1:3306)"

// type that maps the user data in the database
type User struct {
	Id      int
	Name    string
	Surname string
	Email   string
}

func FindOne(name, surname, email string) (*User, error) {
	db, err := sql.Open("mysql", source)

	if err != nil {
		return nil,
			errors.Wrap(err, "error connecting to database")
	}
	defer db.Close()

	err = db.Ping()

	if err != nil {
		return nil,
			errors.Wrap(err, "error reaching the database")
	}
	u := User{}

	q := "select * where name = ? " +
		"AND surname = ? AND email = ?"
	err = db.
		QueryRow(q, name, surname, email).
		Scan(&u.Id, &u.Name, &u.Surname, &u.Email)
	
	if err != nil {
		return nil,
			errors.Wrap(err, "error executing query")
	}

	return &u, nil
}
```

```go
package main

import "user"

func main() {
    // this API lacks of readability
    u, err := user.FindOne("bob", "acme", "bob@acme.com")
}
```

In the previous posts, we saw the problems with this type of
API approach. The major problem with this API is that if we need
to add another filter to the FindOne function, we are going to
**break the backward compatibility** and force the consumer to change
his code. Another problem we face is that we have to memorize 
or inspect the function code to figure the **order of the parameters**,
and their **default values**. Also, is **hard to read and test** this
code.


## Builder pattern

One improvement to our API, is to use the builder pattern:

#### Builder
```go
package User

import (
	"database/sql"
	"fmt"
	_ "github.com/go-sql-driver/mysql"
	"github.com/pkg/errors"
	"strings"
)

const source = "user:password@tcp(127.0.0.1:3306)"

type User struct {
	Id      int
	Name    string
	Surname string
	Email   string
}

type Builder struct {
	query string
}

func (b *Builder) Build() (*User, error) {
    // connect to the database and with
    // the value built with the builder
    // execute the query and return the user
    // using the database/sql package 
	// ...
}

// init the query
func (b *Builder) Find() *Builder {
	b.query = "SELECT * FROM users"

	return b
}

// appends WHERE to the query
// value inside the builder type value
func (b *Builder) Where(q string, arg interface{}) *Builder {
	b.query = strings.Join(
		[]string{b.query, "WHERE", fmt.Sprintf(q, arg)}, " ")

	return b
}

// appends AND parameter = value to the query
// value inside the builder type value
func (b *Builder) And(q string, arg interface{}) *Builder {
	b.query = strings.Join(
		[]string{b.query, "AND", fmt.Sprintf(q, arg)}, " ")

	return b
}

func (b *Builder) Or(q string, arg interface{}) *Builder {
	b.query = strings.Join(
		[]string{b.query, "OR", fmt.Sprintf(q, arg)}, " ")

	return b
}

func (b *Builder) First() *Builder {
	b.query = strings.Join(
		[]string{b.query, "LIMIT 1"}, " ")

	return b
}
```

The consumer's code results more comfortable to read now:

```go
package main

import (
	"log"
	"user"
)

func main() {
	u, err := user.Builder{}.
		Where("email = %s", "bob@acme.com").
		And("name = %s", "Bob").
		Or("surname = %s", "Acme").
		First().
		Build()

	if err != nil {
		log.Fatal("error retrieving the user")
	}
	log.Println(u)
}
```

With the builder pattern we get rid of the parameters order problem, the default
values problem, and makes the code easier to read and test.

In the other hand, we have to create a builder for every concrete type, and we still
have to pass in some builder methods a parameter value.

## Functional Options

Maybe we can improve this design with Functional Options. We are going to extract
some methods and options from the user package to a db package to let us to reuse them in another 
domain's data.

#### DB package with functional options
```go
package db

import (
	"fmt"
	"strings"
)

const Source = "user:password@tcp(127.0.0.1:3306)"

// type option is a function that modifies the query
type Option func(q *string) *string

// where option that accepts other options
func Where(options ...Option) Option {
	return func(q *string) *string {
		*q = strings.Join(
			[]string{fmt.Sprintf("%s", *q), "WHERE"}, " ")

		// we apply the options inside the where option
		for _, o := range options {
			o(q)
		}

		return q
	}
}

// and option that accepts other options
func And(options ...Option) Option {
	return func(q *string) *string {
		// add '(' before and ')' after the subquery
		*q = strings.Join(
			[]string{fmt.Sprintf("%s", *q), "("}, " ")

		// we apply the options inside the and option
		for i, o := range options {
			o(q)

			if i < len(options)-1 {
				*q = strings.Join(
					[]string{fmt.Sprintf("%s", *q), "AND"}, " ")
			}
		}
		*q = strings.Join(
			[]string{fmt.Sprintf("%s", *q), ")"}, " ")

		return q
	}
}

// or option that accepts other options
func Or(options ...Option) Option {
	return func(q *string) *string {
		*q = strings.Join(
			[]string{fmt.Sprintf("%s", *q), "("}, " ")

		for i, o := range options {
			o(q)

			if i < len(options)-1 {
				*q = strings.Join(
					[]string{fmt.Sprintf("%s", *q), "OR"}, " ")
			}
		}
		*q = strings.Join(
			[]string{fmt.Sprintf("%s", *q), ")"}, " ")

		return q
	}
}

// options that add field = value where clause
func Equal(field string, value interface{}) Option {
	return func(q *string) *string {
		*q = strings.Join(
			[]string{fmt.Sprintf("%s", *q),
				fmt.Sprintf("%s = %s", field, value)}, " ")

		return q
	}
}

```


#### User package with functional options
```go
package user

import (
	"bbva.com/lra/lra_deployer/internal/db"
	"database/sql"
	"fmt"
	"github.com/pkg/errors"
	"log"
	"strings"
)

type User struct {
	Id      int
	Name    string
	Surname string
	Email   string
}

// option that add name = value where clause
func Name(name string) db.Option {
	return func(q *string) *string {
		*q = strings.Join(
			[]string{fmt.Sprintf("%s", *q), fmt.Sprintf("name = %s", name)}, " ")

		return q
	}
}

// option that add surname = value where clause
func Surname(surname string) db.Option {
	return func(q *string) *string {
		*q = strings.Join(
			[]string{fmt.Sprintf("%s", *q), fmt.Sprintf("surname = %s", surname)}, " ")

		return q
	}
}

// option that add email IS NOT NULL
func EmailIsNotNull() db.Option {
	return func(q *string) *string {
		*q = strings.Join(
			[]string{fmt.Sprintf("%s", *q), "email IS NOT NULL"}, " ")

		return q
	}
}

// option that add LIMIT 1 clause
func First(options ...db.Option) (*User, error) {
	q := "SELECT * FROM users"

	for _, o := range options {
		o(&q)
	}
	q = strings.Join(
		[]string{q, "LIMIT 1"}, " ")

	return execute(q)
}

// this acts as the init of the query
func Find(options ...db.Option) ([]*User, error) {
	q := "SELECT * FROM users"

	for _, o := range options {
		o(&q)
	}
	u, err := execute(q)

	return []*User{u}, err
}

// hide in this private function the logic
// to open and query the database
func execute(q string) (*User, error) {
	d, err := sql.Open("mysql", db.Source)
	
	if err != nil {
		return nil,
			errors.Wrap(err, "error connecting to database")
	}
	defer d.Close()
	
	err = d.Ping()
	
	if err != nil {
		return nil,
			errors.Wrap(err, "error reaching the database")
	}
	u := User{}

	log.Println(fmt.Sprintf("executing query: %s", q))

	err = d.
		QueryRow(q).
		Scan(&u.Id, &u.Name, &u.Surname, &u.Email)
	
	if err != nil {
		return nil,
			errors.Wrap(err, "error executing query")
	}

	return &u, nil
}
```

```go
package main

import (

"db"
"fmt"
"log"
"strings"
"user"
"db"
	"fmt"
	"strings"
	"user"
	"log"
)

func main() {
	//cmd.Execute()

	// SELECT * FROM users
	users, err := user.Find()
	log.Println(users)

	// SELECT * FROM users WHERE email IS NOT NULL
	users, err = user.Find(db.Where(user.EmailIsNotNull()))
	log.Println(users)

	// SELECT * FROM users 
	// WHERE ( name = bob AND email IS NOT NULL )
	users, err = user.Find(
		db.Where(
			db.And(
				user.Name("bob"),
				user.EmailIsNotNull())))
	log.Println(users)

	// SELECT * FROM users WHERE ( 
	// 				( name = bob AND email IS NOT NULL ) 
	//			OR 
	//				( name = bob AND surname = acme ) ) 
	//			LIMIT 1
	usr, err := user.First(
		db.Where(
			db.Or(
				db.And(
					user.Name("bob"),
					user.EmailIsNotNull()),
				db.And(
					user.Name("bob"),
					db.Equal("surname", "acme"),
				),
			),
		),
	)
	log.Println(usr)
	
	// we can define our query options
	// and extend the functionality
	workOnAcme := func () db.Option {
		return func (q *string) *string {
			*q = strings.Join(
				[]string{fmt.Sprintf("%s", *q), 
                    "email LIKE '%@acme.com'"}, " ")

			return q
		}
	}
	// SELECT * FROM users WHERE email LIKE '@acme'
	users, err = user.Find(db.Where(workOnAcme()))
	log.Println(users)
	
}
```

As we can see, we made our API more friendly. Let's review the benefits of
using functional options in this particular case:

* Makes code easier to read and test it.
```go
// can we figure out what does this without
// reading the implementation?
users, err = user.Find(db.Where(user.EmailIsNotNull()))
```
* Avoids breaking API breaks.
```go
// using variadic functions we can add
// new options to the package without
// breaking our consumer code 
// this acts as the init of the query
func Find(options ...db.Option) ([]*User, error) {
	...
}
```
* Safe use of the API, avoids bad uses and values.
```go
// providing our options to the consumer
// we enforce a safe use of the API
// option that add email IS NOT NULL
func EmailIsNotNull() db.Option {
	...
}
```
* Can be easily extended with our options implementation.
```go
// as we see, the consumers can implement
// theirs custom functional options and 
// extend the API
workOnAcme := func () db.Option {
    return func (q *string) *string {
        *q = strings.Join(
            []string{fmt.Sprintf("%s", *q), "email LIKE '%@acme.com'"}, " ")

        return q
    }
}
// SELECT * FROM users WHERE email LIKE '@acme'
users, err = user.Find(db.Where(workOnAcme()))
```

* Self documenting API.
```go
// no need to comment what it does, its clear 
// thanks to the API naming
users, err = user.Find(db.Where(user.EmailIsNotNull()))
```
* Highly configurable.
```go
// the consumers can configure the API
// on their needs with the combination
// of functional options
usr, err := user.First(
		db.Where(
			db.And(
				db.And(
					user.EmailIsNotNull()),
				db.Or(
					db.Equal("surname", "acme"),
				),
			),
		),
	)
```
* Makes more consistent the default values behaviour.

You can view the functional options pattern in other user cases:

{{< post-link "http-service-functional-options" >}}