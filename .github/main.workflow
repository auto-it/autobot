workflow "Validate" {
  resolves = [
    "Install",
    "Lint",
    "Test",
    "Build",
  ]
  on = "push"
}

action "Install" {
  uses = "Borales/actions-yarn@0.0.1"
  args = "install"
}

action "Lint" {
  needs = "Install"
  uses = "Borales/actions-yarn@0.0.1"
  args = "lint"
}

action "Test" {
  needs = "Install"
  uses = "Borales/actions-yarn@0.0.1"
  args = "test"
}

action "Build" {
  needs = "Install"
  uses = "Borales/actions-yarn@0.0.1"
  args = "build"
}
