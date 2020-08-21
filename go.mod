module github.com/frieserlabs/blog.frieserlabs.dev

go 1.15

require github.com/frieserlabs/hugo-theme-novela v0.0.0-20200821151023-66415bb10067 // indirect

replace (
	github.com/frieserlabs/hugo-theme-novela => ../hugo-theme-novela
)