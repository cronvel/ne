

# Neon (a.k.a 'Ne')

*Neon* is a terminal-based text editor, build on top of [Terminal Kit](https://github.com/cronvel/terminal-kit).
It's a stand-alone CLI app **AND** also a Terminal Kit's widget you can embed in your own app.

It's still a bit alpha, so **save your files frequently**, and it's not well optimized yet,
but it's optimizable, and it will be done in the future, once all major features have been implemented.

If you want to embed it in a Terminal Kit app, you may require the Terminal Kit widget located
at `ne/lib/TextEditor.js` or at `ne/lib/EditorTextBox.js`.



Major features:

* **Mouse support!** for selecting, pasting, moving the cursor, mouse wheel scrolling.
  The mouse is even supported in the Linux console if you have GPM installed.
* Syntax hilighting for Javascript, XML, HTML, CSS and Vue.js (rough support at the moment, but Javascript is OK)
* Drop-down menu that can be navigated with the mouse or the keyboard
* Auto-indent
* Undo-redo
* Selection: start, end, expand, select with the mouse, move, copy to clipboard
* Search and replace with fixed string AND Javascript regexp (also the replace string accepts things like `$1`, etc)
* Store multiple cursor (location) and cycle to them
* Math/Javascript inline interpreter
* ... *and more...*

