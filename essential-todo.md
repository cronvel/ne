
## TODO

Essential features:

* done?



Less essentials features:

* Indent selection
* Purify indentation (re-indent the whole file)
* In-app settings (like auto-indent char and step)
* Load config at the start of the program (key bindings, etc...)
* Highlighter/TextMachine sub-program (run concurrently the host language and the child, while delegating to the child
  if the host grammar allow it - useful for highlighting Vue.js template)
* File watcher, detecting if another app has changed the file, ask for reload or warn before saving



Quality of Life features:

* Ctrl-Up/Ctrl-Down moving indentation-wise: move to the next/previous closing indent-level, or the next/previous parent indent-level
* Alt-Left/Alt-Right moving through camelCase uppercase?
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

* New Terminal-Kit 'text' event: debounce 'key' and send a bunch of character all at once:
  avoid triggering the hilighter and redraw too much time
* Debounce .runStateMachine()
* Hilighter/TextMachine should support checkpoint for a better performance



Bugs:

* Auto-indent behvior when placed before remaining indentation



### DONE:

* Show/Hide menu (Meta-M)
* Line/Column in status bar
* Undo/redo (Ctrl-Z/Alt-Z)
* Delete line (Ctrl-Delete)
* Auto-indent
* Go to line (Meta-L)
* Delete selection (Ctrl-D)
* Extend selection (Shift-Arrows)
* Search and replace with fixed string (Ctrl-F/Alt-F)
* Store multiple cursors in the text, and go to it
* Line of context (scroll up/down few more lines, so that the cursor is not at the top or bottom)
* “smart-home”: HOME move to the begining of the line, if pressed again it move AFTER indentation
* Search and replace with JS regexp (Ctrl-G/Alt-G)
* Auto-completion in find/replace input (based on TextMachine found identifier)
* Undo/redo smart grouping
