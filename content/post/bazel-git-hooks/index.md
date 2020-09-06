---
title: "Git Hooks in Bazel"
date: 2020-12-05
hero: "/post/bazel-git-hooks/images/hook.jpg"
excerpt: "Distribute your Git Hooks and Templates across your team with Bazel"
authors:
  - frieser
tags:
- Development
- Go
- Git
- Bazel
- Monorepo
---

Recently, we have adopted the monorepo philosophy for our projects at my work team. We started
 to use it in a project that has multiple services.

The first concern that came to our mind, is that a single change in one of our
services or common libraries, could break other services. When someone makes a change to any 
library to correct a bug or introduce a new feature for a particular service, it could break 
compatibility with other services or affect the behavior of another service without anyone noticing.

The second concern, was to identify in every single change which services were affected by it.

So we needed a mechanism to ensure that at every single change, all is running without errors
and keep the information of the services and libs involved. We used previously git hooks and git 
templates for another projects, but we need to use then now with Bazel and made them 
distributable across the team members. 
 
Here is how the file structure of all we need to achieve it:

```tree
├── .githooks/
│   ├── pre-commit
│   └── pre-push
├── .gitmsg/
│   └── gitcommitmsg.txt
├── scripts/
│   └── print-workspace-status.sh
├── bazel.rc
├── BUILD.bazel
├── CHANGELOG.md
└── WORKSPACE
```

First, we need to add our git hooks and templates to the git configuration. To automate that task
we use the file bazel.rc. This file is a configuration file that generally is the root of our monorepo
and allow us to configure some flags that modify how Bazel runs. 

```shell
# bazel.rc
build --workspace_status_command scripts/workspace_status.sh
```

The flag `workspace_status_command`, allow us to indicate a binary/script that Bazel runs before each build. 
The program can report information about the status of the workspace, such as the current source 
control revision. We take the advantage of this flag to include our hooks and templates to git.


```shell script
# workspace_status.sh
#!/usr/bin/env bash

git config commit.template .gitmsg/gitcommitmsg.txt
git config core.hooksPath .githooks
```

We also need to make executable this script:
```shell script
chmod a+x scripts/workspace_status.sh
```

### Git Hooks

Now, we are going to implement the scripts that will run before a git commit, and a git push.

#### Pre Commit
```shell script
# pre-commit
#!/usr/bin/env bash
set -e

exitcode=0

echo "Running pre-commit hook"

# fix gofmt
hash gofmt 2>&- || { echo >&2 "gofmt not in PATH."; exit 1; }
    IFS='
'
for file in `git diff --cached --name-only --diff-filter=ACM | grep '\.go$'`
do
    output=`gofmt -w "$file"`
    if test -n "$output"
    then
        # any output is a syntax error
        echo >&2 "$output"
        exitcode=1
    fi
    git add "$file"
done

exit $exitcode
```

In our case, we use the pre-commit script to run gofmt, to ensure all the committed code is
well formatted. Don't forget to make the script executable:

```shell script
chmod a+x .githooks/pre-commit
```

#### Pre Push

Now it comes the interesting part:

```shell script
# pre-push
#!/usr/bin/env bash
set -e

echo "Running pre-push hook"

echo "Running staticcheck"
staticcheck ./...

echo "Running tests"
bazel test //...

echo "Build all artifacts"
bazel build //...
```

This hook, runs before every git push. We use [staticcheck](https://staticcheck.io) to ensure some quality
and syntax rules, run the tests of all the services and libraries, and build all the
services. With this, we ensure that all of our services are still working fine before 
pushing it to our code repository. 

Also, don't forget to make the script executable:

```shell script
chmod a+x .githooks/pre-commit
```

### Git Message templates

This simple git template is the one we use in each commit message. Only we have to do is only
to leave the services or libraries affected by the change.  

```shell script
[COMPONENT A][COMPONENT B][LIB] your message here
```