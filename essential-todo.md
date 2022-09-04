
## TODO

Essential features:

* Store multiple places in the text, and go to it
* Search and replace with fixed string



Less essentials features:

* Line of context (scroll up/down few more lines, so that the cursor is not at the top or bottom)
* File watcher, detecting if another app has changed the file, ask for reload or warn before saving
* Highlighter/TextMachine sub-program (run concurrently the host language and the child, while delegating to the child
  if the host grammar allow it - useful for highlighting Vue.js template)
* Load config at the start of the program (key bindings, etc...)
* In-app setting (like auto-indent char and step)



Quality of Life features:

* Ctrl-Up/Ctrl-Down moving indentation-wise: move to the next/previous closing indent-level, or the next/previous parent indent-level
* Alt-Left/Alt-Right moving through camelCase uppercase?
* Indent selection
* Search and replace with JS regexp
* Multiple screens, allowing moving part from one file to another
* Auto-completion based on the TextMachine (could use a cursor boolean as 2nd argument of .pushEvent(), and use bufferBranches to get the names)
* Auto-completion based on current content
* File explorer



Would be great but not essential features:

* Math REPL
* Have core methods argument tips (but would require to guess the type of the variable)
* Run third-party program/plugins like linters
* Run commands, maybe using slash-shell



Technical:

* Hilighter/TextMachine should support checkpoint for a better performance



Bugs:

* none



### DONE:

* Show/Hide menu (Meta-M)
* Line/Column in status bar
* Undo/redo (Ctrl-Z/Alt-Z)
* Delete line (Ctrl-Delete)
* Auto-indent
* Go to line (Meta-L)
* Delete selection (Ctrl-X)
* Extend selection (Shift-Arrows)

