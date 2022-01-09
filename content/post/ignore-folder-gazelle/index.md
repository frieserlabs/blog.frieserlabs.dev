---
title: "Ignore a folder with Gazelle"
date: 2020-12-05
hero: "generator.jpg"
authors:
  - frieser
tags:
- Development
- Go
- Gazelle
- Bazel
- Monorepo
---

Gazelle is a Bazel build file generator for Bazel projects. 
Sometimes, we need to ignore some folder where Gazelle look 
into to generate build files.

Add this to your root BUILD.bazel file:   

```python
# BUILD.bazel
# gazelle:exclude folder_path
```