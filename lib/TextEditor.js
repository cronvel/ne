/*
	Neon

	Copyright (c) 2015 - 2022 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



/*
	This is a third-party Terminal-Kit document widget.
*/



const termkit = require( 'terminal-kit' ) ;
const Element = termkit.Element ;
const ToggleButton = termkit.ToggleButton ;
const DropDownMenu = termkit.DropDownMenu ;
const Text = termkit.Text ;
const TextBox = termkit.TextBox ;

const TextMachine = require( 'text-machine' ) ;

const EditorTextBox = require( './EditorTextBox.js' ) ;

const path = require( 'path' ) ;

const string = require( 'string-kit' ) ;
const Promise = require( 'seventh' ) ;



function TextEditor( options = {} ) {
	// Clone options if necessary
	options = ! options ? {} : options.internal ? options : Object.create( options ) ;
	options.internal = true ;

	Element.call( this , options ) ;

	this.onFocus = this.onFocus.bind( this ) ;
	this.onChange = this.onChange.bind( this ) ;
	this.onCursorMove = this.onCursorMove.bind( this ) ;
	this.onToggleMenu = this.onToggleMenu.bind( this ) ;
	this.onDropDownMenuSubmit = this.onDropDownMenuSubmit.bind( this ) ;
	this.onDropDownMenuBlinked = this.onDropDownMenuBlinked.bind( this ) ;

	// Widget
	this.editorTextBox = null ;
	this.statusBar = null ;
	this.contextBar = null ;
	this.inlineInput = null ;
	this.showHideMenuButton = null ;
	this.dropDownMenu = null ;

	this.lockStatus = false ;
	this.updateStatusTimer = null ;
	this.updateStatusAgain = false ;

	this.contextBarTimer = null ;
	//this.contextBarIsHint = false ;

	this.fileTypes = options.fileTypes || {} ;
	this.stateMachine = null ;

	// Used for storing logs for undo/redo
	this.changelog = [] ;
	this.changelogIndex = 0 ;
	this.changelogSize = options.changelogSize ?? 20 ;
	// Logs are grouped if the new entry is within the duration frame since the first entry of the group,
	// OR within the “burst” duration frame since the last entry of the group,
	// OR if the last entry was an internal entry (not a user entry).
	this.logGroupingDuration = options.logGroupingDuration ?? 10000 ;
	this.logGroupingBurstDuration = options.logGroupingBurstDuration ?? 500 ;

	this.cursors = [ {} ] ;
	this.activeCursor = 0 ;

	this.findSearchString = null ;
	this.findReplaceString = null ;
	this.findUseRegexp = false ;
	this.findSearchStringHistory = [] ;
	this.findReplaceStringHistory = [] ;
	this.regexpFindSearchStringHistory = [] ;
	this.regexpFindReplaceStringHistory = [] ;
	this.findHistorySize = 30 ;

	this.terminate = typeof options.terminate === 'function' ? options.terminate : null ;
	this.filePath = null ;
	this.textMachinePath = null ;

	if ( options.keyBindings ) { this.keyBindings = options.keyBindings ; }

	// Options/modes configurable by the user on runtime
	this.autoIndent = options.autoIndent ?? true ;
	this.autoRemoveTrailingSpaces = options.autoRemoveTrailingSpaces ?? true ;
	// TODO... It should be part of EditorTextBox
	this.scrollContextLines = options.scrollContextLines !== undefined ? options.scrollContextLines : 3 ;
	this.scrollContextColumns = options.scrollContextColumns !== undefined ? options.scrollContextColumns : 10 ;

	this.on( 'key' , this.onKey ) ;	// Don't remove: TextEditor does not inherit from EditorTextBox, it contains it
	this.on( 'focus' , this.onFocus ) ;

	this.initChildren() ;

	if ( this.setContent === TextEditor.prototype.setContent ) {
		this.setContent( options.content , true ) ;
	}

	// Only draw if we are not a superclass of the object
	if ( this.elementType === 'TextEditor' && ! options.noDraw ) { this.draw() ; }
}

module.exports = TextEditor ;
Element.inherit( TextEditor ) ;



TextEditor.prototype.needInput = true ;



// For instance, it's for both the EditorTextBox and the TextEditor (should probably be divided, like other widgets do)
TextEditor.prototype.keyBindings = {
	// Both

	CTRL_K: 'meta' ,


	// EditorTextBox

	ENTER: 'newLine' ,
	KP_ENTER: 'newLine' ,
	BACKSPACE: 'backDelete' ,
	DELETE: 'delete' ,
	CTRL_DELETE: 'deleteLine' ,
	TAB: 'tab' ,

	LEFT: 'backward' ,
	RIGHT: 'forward' ,
	CTRL_LEFT: 'startOfWord' ,
	CTRL_RIGHT: 'endOfWord' ,
	UP: 'up' ,
	DOWN: 'down' ,
	//HOME: 'startOfLine' ,
	HOME: 'smartStartOfLine' ,
	END: 'endOfLine' ,
	PAGE_UP: 'scrollUp' ,
	PAGE_DOWN: 'scrollDown' ,
	META_UNDERSCORE: 'scrollToCursor' ,
	META_HOME: 'scrollTop' ,
	META_END: 'scrollBottom' ,

	CTRL_B: 'startOfSelection' ,
	CTRL_E: 'endOfSelection' ,
	SHIFT_LEFT: 'expandSelectionBackward' ,
	SHIFT_RIGHT: 'expandSelectionForward' ,
	SHIFT_UP: 'expandSelectionUp' ,
	SHIFT_DOWN: 'expandSelectionDown' ,
	CTRL_SHIFT_LEFT: 'expandSelectionStartOfWord' ,
	CTRL_SHIFT_RIGHT: 'expandSelectionEndOfWord' ,

	// T for Transfer
	CTRL_T: 'moveSelection' ,
	ALT_T: 'copyToDocumentClipboard' ,
	META_T: 'copyToSystemClipboard' ,
	// P for Paste / Put
	CTRL_P: 'pasteSelection' ,
	ALT_P: 'pasteDocumentClipboard' ,
	META_P: 'pasteSystemClipboard' ,
	// D for Delete
	CTRL_D: 'deleteSelection' ,
	ALT_D: 'clearDocumentClipboard' ,
	META_D: 'clearSystemClipboard' ,


	// TextEditor

	ESCAPE: 'focusEditorTextBox' ,
	CTRL_S: 'save' ,
	ALT_S: 'saveAs' ,
	CTRL_O: 'open' ,
	CTRL_C: 'terminate' ,
	CTRL_F: 'find' ,
	ALT_F: 'findAndReplace' ,
	CTRL_G: 'regexpFind' ,
	ALT_G: 'regexpFindAndReplace' ,
	CTRL_N: 'findNext' ,
	ALT_N: 'findPrevious' ,
	CTRL_Z: 'undo' ,
	ALT_Z: 'redo' ,
	META_R: 'redraw' ,
	META_L: 'goToLine' ,

	// TMP: JOE keys
	META_O: 'newCursor' ,
	META_N: 'nextCursor' ,
	//: 'previousCursor' ,
	//: 'deleteCursor' ,

	META_M: 'toggleMenu'
} ;



TextEditor.prototype.initChildren = function() {
	// The main widget, where the text is edited
	this.editorTextBox = new EditorTextBox( {
		internal: true ,
		parent: this ,
		x: this.outputX ,
		y: this.outputY + 1 ,
		width: this.outputWidth ,
		height: this.outputHeight - 2 ,
		scrollable: true ,
		vScrollBar: true ,
		autoScrollContextLines: 3 ,
		autoScrollContextColumns: 12 ,
		keyBindings: this.keyBindings ,
		stateMachine: this.stateMachine ,
		autoIndent: this.autoIndent ,
		autoRemoveTrailingSpaces: this.autoRemoveTrailingSpaces
	} ) ;
	this.editorTextBox.on( 'change' , this.onChange ) ;
	this.editorTextBox.on( 'cursorMove' , this.onCursorMove ) ;

	// A button used to show/hide the drop-down menu
	this.showHideMenuButton = new ToggleButton( {
		internal: true ,
		parent: this ,
		content: ' » ' ,
		turnedOnContent: ' « ' ,
		turnedOffContent: ' » ' ,
		value: false ,
		x: this.outputX ,
		y: this.outputY ,
		width: 3
	} ) ;
	this.showHideMenuButton.on( 'toggle' , this.onToggleMenu ) ;

	// Top
	this.statusBar = new Text( {
		internal: true ,
		parent: this ,
		contentHasMarkup: true ,
		attr: { color: 'black' , bgColor: 'white' } ,
		x: this.outputX + 3 ,
		y: this.outputY ,
		width: this.outputWidth - 3 ,
		height: 1
	} ) ;

	// Bottom
	this.contextBar = new Text( {
		internal: true ,
		parent: this ,
		contentHasMarkup: true ,
		attr: { color: 'black' , bgColor: 'white' } ,
		x: this.outputX ,
		y: this.outputY + this.outputHeight - 1 ,
		width: this.outputWidth ,
		height: 1
	} ) ;

	// The drop-down menu
	this.dropDownMenu = new DropDownMenu( {
		parent: this ,
		hidden: true ,
		x: 3 ,
		y: 0 ,
		clearColumnMenuOnSubmit: true ,
		value: {
			autoIndent: this.autoIndent ,
			autoRemoveTrailingSpaces: this.autoRemoveTrailingSpaces
		} ,
		items: [
			{
				content: 'File' ,
				value: 'file' ,
				items: [
					{ content: 'Open' , value: 'open' } ,
					{ content: 'Save' , value: 'save' } ,
					{ content: 'Save as' , value: 'saveAs' } ,
					{ content: 'Quit' , value: 'terminate' }
				]
			} ,
			{
				content: 'Edit' ,
				value: 'edit' ,
				items: [
					{ content: 'Copy to document clipboard' , value: 'copyToDocumentClipboard' } ,
					{ content: 'Copy to system clipboard' , value: 'copyToSystemClipboard' } ,
					{ content: 'Paste selection' , value: 'pasteSelection' } ,
					{ content: 'Paste document clipboard' , value: 'pasteDocumentClipboard' } ,
					{ content: 'Paste system clipboard' , value: 'pasteSystemClipboard' } ,
					{ content: 'Undo' , value: 'undo' } ,
					{ content: 'Redo' , value: 'redo' } ,
					{ content: 'Auto-indent' , key: 'autoIndent' , type: 'toggle' } ,
					{ content: 'Auto-remove trailing spaces' , key: 'autoRemoveTrailingSpaces' , type: 'toggle' }
				]
			}
		]
	} ) ;

	this.dropDownMenu.on( 'submit' , this.onDropDownMenuSubmit ) ;
	this.dropDownMenu.on( 'blinked' , this.onDropDownMenuBlinked ) ;
} ;



//TextEditor.prototype.drawSelfCursor = function() { this.textBuffer.drawCursor() ; } ;

TextEditor.prototype.getValue = TextEditor.prototype.getContent = function() {
	return this.editorTextBox.getContent() ;
} ;

TextEditor.prototype.setValue = function( value , dontDraw ) {
	return this.editorTextBox.setValue( value , dontDraw ) ;
} ;

TextEditor.prototype.setContent = function( value , dontDraw ) {
	return this.editorTextBox.setContent( value , dontDraw ) ;
} ;



TextEditor.prototype.setAutoIndent = function( value ) {
	this.autoIndent = this.editorTextBox.autoIndent = !! value ;
} ;



TextEditor.prototype.setAutoRemoveTrailingSpaces = function( value ) {
	this.autoRemoveTrailingSpaces = this.editorTextBox.autoRemoveTrailingSpaces = !! value ;
} ;



TextEditor.prototype.toggleMenu = function( turnOn = this.dropDownMenu.hidden ) {
	if ( turnOn !== this.dropDownMenu.hidden ) { return ; }
	var fromMouse = true ;

	if ( this.showHideMenuButton.getValue() !== turnOn ) {
		// Set the button to the correct status (probably turned on/off using keyboard)
		this.showHideMenuButton.setValue( turnOn , undefined , true ) ;
		fromMouse = false ;
	}

	if ( turnOn ) {
		this.statusBar.hide() ;
		this.dropDownMenu.show() ;
		if ( ! fromMouse ) {
			this.document.giveFocusTo( this.dropDownMenu , 'clear' ) ;
		}
	}
	else {
		this.dropDownMenu.hide() ;
		this.statusBar.show() ;
		this.document.giveFocusTo( this.editorTextBox ) ;
	}
} ;



// No more grouping will occurs on this group
TextEditor.prototype.freezeChangelogGroup = function() {
	if ( ! this.changelogIndex ) { return ; }
	this.changelog[ this.changelogIndex - 1 ].freeze = true ;
} ;



TextEditor.prototype.addChangeLog = function( entry ) {
	//console.error( "addChangeLog(): " , entry , entry.insertedString ? entry.insertedString.length : entry.deletedString ? entry.deletedString.length : null ) ;
	var now = Date.now() ,
		lastGroup = this.changelogIndex > 0 ? this.changelog[ this.changelogIndex - 1 ] : null ,
		lastEntry = lastGroup && lastGroup.entries.length ? lastGroup.entries[ lastGroup.entries.length - 1 ] : null ;

	if ( this.changelogIndex < this.changelog.length ) {
		// Most probably we have undone something, and now we start modifying from that point
		this.changelog.length = this.changelogIndex ;
	}


	// Grouping?
	if ( lastGroup && ! lastGroup.freeze && (
		lastEntry?.internal
		|| ! lastGroup.entries.length
		|| now < lastGroup.startTime + this.logGroupingDuration
		|| now < lastGroup.endTime + this.logGroupingBurstDuration
	) ) {
		// Merge entries?
		if (
			lastEntry
			&& entry.type === lastEntry.type
			&& entry.startPosition.x === lastEntry.endPosition.x
			&& entry.startPosition.y === lastEntry.endPosition.y
		) {
			//console.error( "merging: " , lastEntry , entry ) ;
			lastEntry.endPosition = entry.endPosition ;

			if ( entry.type === 'delete' ) {
				lastEntry.deletedString += entry.deletedString ;
				lastEntry.count += entry.count ;
			}
			else if ( entry.type === 'backDelete' ) {
				lastEntry.deletedString = entry.deletedString + lastEntry.deletedString ;
				lastEntry.count += entry.count ;
			}
			else if ( entry.type === 'insert' ) {
				lastEntry.insertedString += entry.insertedString ;
				lastEntry.count += entry.count ;
			}
		}
		else {
			lastGroup.entries.push( entry ) ;
		}

		if ( ! lastGroup.startTime ) { lastGroup.startTime = now ; }
		lastGroup.endTime = now ;
	}
	else {
		this.changelog.push( {
			startTime: now ,
			endTime: now ,
			freeze: false ,
			entries: [ entry ]
		} ) ;

		if ( this.changelog.length > this.changelogSize ) {
			this.changelog.splice( 0 , this.changelog.length - this.changelogSize ) ;
		}

		this.changelogIndex = this.changelog.length ;
	}

	//console.error( "changelog:" , this.changelog ) ;
} ;



TextEditor.prototype.interactiveGoToLine = async function() {
	try {
		var line = await this.askInline( 'Go to line: ' ) ;
		line = parseInt( line , 10 ) ;
		if ( line ) { this.goToLine( line ) ; }
	}
	catch {}
} ;



TextEditor.prototype.goToLine = function( line ) {
	if ( line <= 0 ) { return ; }

	var textBuffer = this.editorTextBox.textBuffer ;
	textBuffer.cy = line - 1 ;
	this.editorTextBox.autoScrollAndDraw() ;
	this.onCursorMove() ;
} ;



TextEditor.prototype.interactiveFind = async function() {
	try {
		this.findSearchString = this.findReplaceString = null ;
		this.findUseRegexp = false ;

		this.findSearchString = await this.askInline( 'Find: ' , {
			history: this.findSearchStringHistory ,
			autoComplete: this.stateMachine.store.autoCompletion ? Array.from( this.stateMachine.store.autoCompletion ) : undefined ,
			autoCompleteMenu: true ,
			autoCompleteHint: true ,
			autoCompleteHintMinInput: 3
		} ) ;
		if ( ! this.findSearchString ) { return ; }
		this.findSearchStringHistory.push( this.findSearchString ) ;
		if ( this.findSearchStringHistory.length > this.findHistorySize ) { this.findSearchStringHistory.shift() ; }

		this.findNext() ;
	}
	catch {}
} ;



TextEditor.prototype.interactiveFindAndReplace = async function() {
	try {
		this.findSearchString = this.findReplaceString = null ;
		this.findUseRegexp = false ;

		this.findSearchString = await this.askInline( 'Find: ' , {
			history: this.findSearchStringHistory ,
			autoComplete: this.stateMachine.store.autoCompletion ? Array.from( this.stateMachine.store.autoCompletion ) : undefined ,
			autoCompleteMenu: true ,
			autoCompleteHint: true ,
			autoCompleteHintMinInput: 3
		} ) ;
		if ( ! this.findSearchString ) { return ; }
		this.findSearchStringHistory.push( this.findSearchString ) ;
		if ( this.findSearchStringHistory.length > this.findHistorySize ) { this.findSearchStringHistory.shift() ; }

		this.findReplaceString = await this.askInline( 'Replace with: ' , {
			history: this.findReplaceStringHistory ,
			autoComplete: this.stateMachine.store.autoCompletion ? Array.from( this.stateMachine.store.autoCompletion ) : undefined ,
			autoCompleteMenu: true ,
			autoCompleteHint: true ,
			autoCompleteHintMinInput: 3
		} ) ;
		if ( ! this.findReplaceString ) { return ; }
		this.findReplaceStringHistory.push( this.findReplaceString ) ;
		if ( this.findReplaceStringHistory.length > this.findHistorySize ) { this.findReplaceStringHistory.shift() ; }

		this.findNext() ;
	}
	catch {}
} ;



TextEditor.prototype.interactiveRegexpFind = async function() {
	try {
		this.findSearchString = this.findReplaceString = null ;
		this.findUseRegexp = true ;

		this.findSearchString = await this.askInline( 'Find (Regexp): ' , {
			history: this.regexpFindSearchStringHistory ,
			autoComplete: this.stateMachine.store.autoCompletion ? Array.from( this.stateMachine.store.autoCompletion ) : undefined ,
			autoCompleteMenu: true ,
			autoCompleteHint: true ,
			autoCompleteHintMinInput: 3
		} ) ;
		if ( ! this.findSearchString ) { return ; }
		this.regexpFindSearchStringHistory.push( this.findSearchString ) ;
		if ( this.regexpFindSearchStringHistory.length > this.findHistorySize ) { this.regexpFindSearchStringHistory.shift() ; }

		this.findNext() ;
	}
	catch {}
} ;



TextEditor.prototype.interactiveRegexpFindAndReplace = async function() {
	try {
		this.findSearchString = this.findReplaceString = null ;
		this.findUseRegexp = true ;

		this.findSearchString = await this.askInline( 'Find (Regexp): ' , {
			history: this.regexpFindSearchStringHistory ,
			autoComplete: this.stateMachine.store.autoCompletion ? Array.from( this.stateMachine.store.autoCompletion ) : undefined ,
			autoCompleteMenu: true ,
			autoCompleteHint: true ,
			autoCompleteHintMinInput: 3
		} ) ;
		if ( ! this.findSearchString ) { return ; }
		this.regexpFindSearchStringHistory.push( this.findSearchString ) ;
		if ( this.regexpFindSearchStringHistory.length > this.findHistorySize ) { this.regexpFindSearchStringHistory.shift() ; }

		this.findReplaceString = await this.askInline( 'Replace with (Regexp): ' , {
			history: this.regexpFindReplaceStringHistory ,
			autoComplete: this.stateMachine.store.autoCompletion ? Array.from( this.stateMachine.store.autoCompletion ) : undefined ,
			autoCompleteMenu: true ,
			autoCompleteHint: true ,
			autoCompleteHintMinInput: 3
		} ) ;
		if ( ! this.findReplaceString ) { return ; }
		this.regexpFindReplaceStringHistory.push( this.findReplaceString ) ;
		if ( this.regexpFindReplaceStringHistory.length > this.findHistorySize ) { this.regexpFindReplaceStringHistory.shift() ; }

		this.findNext() ;
	}
	catch {}
} ;



TextEditor.prototype.findNext = async function( reverse = false ) {
	var offset , region , replaceString , replaceStringDisplay ,
		textBuffer = this.editorTextBox.textBuffer ;

	if ( ! this.findSearchString ) {
		this.setContextBar( { timeout: 2000 } , "No active search" ) ;
		return ;
	}

	if ( reverse && this.findUseRegexp ) {
		this.setContextBar( { timeout: 2000 } , "Can't match regexp in reverse mode" ) ;
		return ;
	}

	offset = textBuffer.getCursorOffset() ;

	if ( reverse ) {
		region = textBuffer.findPrevious( this.findSearchString , offset ) ;
	}
	else {
		region = this.findUseRegexp ? textBuffer.regexpFindNext( this.findSearchString , offset ) :
			textBuffer.findNext( this.findSearchString , offset ) ;
	}

	if ( ! region ) {
		this.setContextBar( { timeout: 2000 } , "No occurence found" ) ;
		return ;
	}

	textBuffer.setSelectionRegion( region ) ;

	if ( reverse ) {
		textBuffer.cy = region.ymin ;
		textBuffer.cx = region.xmin ;
	}
	else {
		textBuffer.cy = region.ymax ;
		textBuffer.cx = region.xmax + 1 ;
	}

	this.editorTextBox.autoScrollAndDraw() ;
	this.updateStatusDebounced() ;

	if ( ! this.findReplaceString ) { return ; }


	replaceString = this.findUseRegexp ? this.regexpSubstitute( this.findReplaceString , region.match ) :
		this.findReplaceString ;

	if ( this.findUseRegexp ) {
		replaceStringDisplay = string.formatThirdPartyMarkup(
			'Replace with ^r%s^ ? ' ,
			replaceString.length <= 30 ? replaceString : replaceString.slice( 0 , 30 ) + '…'
		) ;
	}
	else {
		replaceStringDisplay = 'Replace? ' ;
	}

	// Ask interactively here
	var choice = await this.askChoiceInline( replaceStringDisplay , [
		[ '(Y)es' , 'yes' , 'y' , 'Y' ] ,
		[ '(N)o' , 'no' , 'n' , 'N' ] ,
		[ '(R)est' , 'rest' , 'r' , 'R' ] ,
		[ '(A)bort (Esc)' , 'abort' , 'a' , 'A' , 'ESCAPE' ]
	] ) ;

	switch ( choice ) {
		case 'yes' :
			this.editorTextBox.deleteSelection( true ) ;
			this.editorTextBox.insert( replaceString , true ) ;
			this.updateStatusDebounced() ;
			return this.findNext( reverse ) ;
		case 'no' :
			return this.findNext( reverse ) ;
		case 'rest' :
			// Rewind the cursor before replacing the rest of the file
			textBuffer.cy = region.ymin ;
			textBuffer.cx = region.xmin ;
			return this.replaceRest( reverse ) ;
		case 'abort' :
			return ;
	}
} ;

TextEditor.prototype.findPrevious = function() { return this.findNext( true ) ; } ;



TextEditor.prototype.replaceRest = function( reverse = false ) {
	var offset , region , replaceString ,
		count = 0 ,
		textBuffer = this.editorTextBox.textBuffer ;

	if ( ! this.findSearchString || ! this.findReplaceString ) {
		this.setContextBar( { timeout: 2000 } , "No active replace" ) ;
		return ;
	}

	if ( reverse && this.findUseRegexp ) {
		this.setContextBar( { timeout: 2000 } , "Can't match regexp in reverse mode" ) ;
		return ;
	}

	// Force a new changelog group for the whole operation
	this.freezeChangelogGroup() ;

	/*
		Note that we could apply the search and replace by simply doing:
		textBuffer.setText( textBuffer.getText().replace( regexp , substitute ) )
		... but doing so would lose incremental changelog, lose saved cursor, and cause many more bad user experiences.
	*/

	for ( ;; ) {
		offset = textBuffer.getCursorOffset() ;

		if ( reverse ) {
			region = textBuffer.findPrevious( this.findSearchString , offset ) ;
		}
		else {
			region = this.findUseRegexp ? textBuffer.regexpFindNext( this.findSearchString , offset ) :
				textBuffer.findNext( this.findSearchString , offset ) ;
		}

		if ( ! region ) {
			if ( ! count ) {
				this.setContextBar( { timeout: 2000 } , "No occurence found" ) ;
			}
			else {
				this.setContextBar( { timeout: 2000 } , "Replaced %i occurence(s)" , count ) ;
			}

			if ( this.stateMachine ) {
				textBuffer.runStateMachine() ;
			}

			// Force closing the changelog group
			this.freezeChangelogGroup() ;

			this.editorTextBox.autoScrollAndDraw() ;
			this.updateStatusDebounced() ;
			return ;
		}

		count ++ ;

		if ( reverse ) {
			textBuffer.cy = region.ymin ;
			textBuffer.cx = region.xmin ;
		}
		else {
			textBuffer.cy = region.ymax ;
			textBuffer.cx = region.xmax + 1 ;
		}

		replaceString = this.findUseRegexp ? this.regexpSubstitute( this.findReplaceString , region.match ) :
			this.findReplaceString ;

		this.editorTextBox.deleteRegion( region , true ) ;
		this.editorTextBox.insert( replaceString , false , true ) ;
	}
} ;



TextEditor.prototype.regexpSubstitute = function( format , capture ) {
	return format.replace( /\$(\$)|\$(&)|\$([0-9]+)/g , ( match , dollar , full , captureIndex ) => {
		if ( dollar ) { return dollar ; }
		if ( full ) { return capture[ 0 ] ; }
		return capture[ + captureIndex ] || '' ;
		// Unsupported: $' $` (make no sense for a text editor)
	} ) ;
} ;



TextEditor.prototype.undo = function() {
	if ( this.changelogIndex <= 0 ) {
		this.setContextBar( { timeout: 2000 } , "Nothing to undo..." ) ;
		return ;
	}

	this.revertLogGroup( this.changelog[ -- this.changelogIndex ] ) ;
	this.editorTextBox.textBuffer.runStateMachine() ;
	this.editorTextBox.autoScrollAndDraw() ;
} ;



TextEditor.prototype.redo = function() {
	if ( this.changelogIndex >= this.changelog.length ) {
		this.setContextBar( { timeout: 2000 } , "Nothing to redo..." ) ;
		return ;
	}

	this.playLogGroup( this.changelog[ this.changelogIndex ++ ] ) ;
	this.editorTextBox.textBuffer.runStateMachine() ;
	this.editorTextBox.autoScrollAndDraw() ;
} ;



// Play a whole changelog's group of entries
TextEditor.prototype.playLogGroup = function( group ) {
	group.entries.forEach( entry => this.playLog( entry ) ) ;
} ;



// Revert a whole changelog's group of entries
TextEditor.prototype.revertLogGroup = function( group ) {
	var i = group.entries.length ;
	while ( i -- ) {
		this.revertLog( group.entries[ i ] ) ;
	}
} ;



// Play a changelog's entry
TextEditor.prototype.playLog = function( entry ) {
	var textBuffer = this.editorTextBox.textBuffer ;
	textBuffer.cx = entry.startPosition.x ;
	textBuffer.cy = entry.startPosition.y ;

	switch ( entry.type ) {
		case 'insert' :
			textBuffer.insert( entry.insertedString ) ;
			break ;
		case 'delete' :
			textBuffer.delete( entry.count ) ;
			break ;
		case 'backDelete' :
			textBuffer.backDelete( entry.count ) ;
			break ;
	}

	// Should not be necessary
	textBuffer.cx = entry.endPosition.x ;
	textBuffer.cy = entry.endPosition.y ;
} ;



// Revert a changelog's entry
TextEditor.prototype.revertLog = function( entry ) {
	var textBuffer = this.editorTextBox.textBuffer ;
	textBuffer.cx = entry.endPosition.x ;
	textBuffer.cy = entry.endPosition.y ;

	switch ( entry.type ) {
		case 'insert' :
			// /!\ Maybe use textBuffer.deleteRegion() instead
			textBuffer.backDelete( entry.count ) ;
			break ;
		case 'delete' :
			textBuffer.insert( entry.deletedString ) ;
			break ;
		case 'backDelete' :
			textBuffer.insert( entry.deletedString ) ;
			break ;
	}

	// Should not be necessary
	textBuffer.cx = entry.startPosition.x ;
	textBuffer.cy = entry.startPosition.y ;
} ;



const DEBOUNCE_DELAY = 500 ;

TextEditor.prototype.updateStatusDebounced = function() {
	if ( this.lockStatus ) { return ; }

	if ( this.updateStatusTimer ) {
		this.updateStatusAgain = true ;
	}
	else {
		this.updateStatus() ;
		this.updateStatusTimer = setTimeout( () => {
			this.updateStatusTimer = null ;
			if ( this.updateStatusAgain ) {
				this.updateStatusAgain = false ;
				this.updateStatusDebounced() ;
			}
		} , DEBOUNCE_DELAY ) ;
	}
} ;



TextEditor.prototype.updateStatus = function() {
	if ( this.lockStatus ) { return ; }
	var textBuffer = this.editorTextBox.textBuffer ;
	this.setStatusBar( "Line %i^B/%i^  Col %i  Cur %i^B/%i^:" , textBuffer.cy + 1 , textBuffer.buffer.length , textBuffer.cx + 1 , this.activeCursor + 1 , this.cursors.length ) ;
} ;



TextEditor.prototype.setStatusBar = function( format , ... args ) {
	var str = args.length ? string.formatThirdPartyMarkup( format , ... args ) : format ;
	this.statusBar.setContent( str , true ) ;

	//this.document.drawCursor() ;
	if ( this.document?.focusElement ) { this.document.focusElement.drawCursor() ; }
} ;



TextEditor.prototype.setContextBar = function( options , format , ... args ) {
	var str ;

	// Argument management
	if ( ! options || typeof options !== 'object' ) {
		str = arguments.length > 1 ? string.formatThirdPartyMarkup( options , format , ... args ) : options ;
		options = null ;
	}
	else {
		str = args.length ? string.formatThirdPartyMarkup( format , ... args ) : format ;
	}

	if ( this.contextBarTimer ) {
		clearTimeout( this.contextBarTimer ) ;
		this.contextBarTimer = null ;
	}

	// Useful?
	//if ( options.hint ) { this.contextBarIsHint = true ; }

	this.contextBar.setContent( str , true ) ;

	if ( options?.timeout ) {
		this.contextBarTimer = setTimeout( () => this.setContextBar( '' ) , options.timeout ) ;
	}

	//this.document.drawCursor() ;
	if ( this.document?.focusElement ) { this.document.focusElement.drawCursor() ; }
} ;



TextEditor.prototype.setFilePath = async function( filePath ) {
	if ( this.filePath === filePath ) { return ; }

	// Should advertise? With a .setContextBar()?
	this.filePath = filePath ;
} ;



TextEditor.prototype.openFile = async function( filePath , createIfNotExist = false ) {
	var extension = path.extname( filePath ).slice( 1 ) ,
		textBuffer = this.editorTextBox.textBuffer ;

	try {
		await textBuffer.load( filePath ) ;
	}
	catch ( error ) {
		if ( error.code === 'ENOENT' && createIfNotExist ) {
			this.setFilePath( filePath ) ;
			this.editorTextBox.setContent( '' ) ;
			this.setContextBar( { timeout: 2000 } , 'New file' , filePath ) ;
		}
		else {
			throw error ;
		}
	}

	this.setFilePath( filePath ) ;

	// Now search for a stateMachine
	this.stateMachine = null ;

	for ( let type in this.fileTypes ) {
		let config = this.fileTypes[ type ] ;
		if ( config.extensions.includes( extension ) ) {
			this.stateMachine = new TextMachine( {
				program: require( 'text-machine/languages/' + config.syntax + '.js' ) ,
				api: termkit.TextBuffer.TextMachineApi
			} ) ;
			this.editorTextBox.setStateMachine( this.stateMachine , true ) ;
			break ;
		}
	}

	textBuffer.runStateMachine() ;
	this.editorTextBox.draw() ;
} ;



TextEditor.prototype.interactiveOpen = async function() {
	try {
		var filePath = await this.askFileInline( 'Open file: ' ) ;
		this.openFile( filePath , true ) ;
	}
	catch {}
} ;



TextEditor.prototype.save = async function() {
	if ( ! this.filePath ) { return ; }
	this.saveFile( this.filePath ) ;
} ;



TextEditor.prototype.saveFile = async function( filePath ) {
	var textBuffer = this.editorTextBox.textBuffer ;

	this.setContextBar( 'Saving %s ...' , filePath ) ;
	await textBuffer.save( filePath ) ;
	this.setContextBar( { timeout: 2000 } , '%s saved!' , filePath ) ;
	this.setFilePath( filePath ) ;
} ;



TextEditor.prototype.interactiveSave = async function() {
	try {
		var filePath = await this.askFileInline( 'Save file: ' ) ;
		this.saveFile( filePath , true ) ;
	}
	catch {}
} ;



// Return a promise resolving to the input string, or reject if cancelled or various errors
TextEditor.prototype.askInline = function( text , options = null ) {
	// Already doing things with files?
	if ( this.inlineInput ) { return Promise.rejected ; }

	var promise = new Promise() ;

	var inlineInputOptions = {
		internal: true ,
		parent: this ,
		noEmpty: true ,
		cancelable: true ,
		menu: { justify: false } ,
		//autoCompleteHint: false ,
		textAttr: { bgColor: 'blue' } ,
		altTextAttr: { bgColor: 'blue' , color: 'gray' , italic: true } ,
		voidAttr: { bgColor: 'blue' } ,
		x: this.outputX ,
		y: this.outputY + this.outputHeight - 2 ,
		z: 1 ,
		width: this.outputWidth ,

		//*
		prompt: {
			//textAttr: { bgColor: 'green' } ,
			textAttr: { bgColor: 'yellow' , color: 'black' } ,
			content: text ,
			contentHasMarkup: true
		}
		//*/
	} ;

	if ( options ) { Object.assign( inlineInputOptions , options ) ; }

	this.inlineInput = new termkit.InlineInput( inlineInputOptions ) ;

	this.document.giveFocusTo( this.inlineInput ) ;

	this.inlineInput.once( 'cancel' , () => {
		//console.error( "Cancelling" ) ;
		this.inlineInput.destroy() ;
		this.inlineInput = null ;
		this.document.giveFocusTo( this.editorTextBox ) ;
		promise.reject() ;
	} ) ;

	this.inlineInput.once( 'submit' , inputStr => {
		//console.error( "Submitting:" , filePath ) ;
		this.inlineInput.destroy() ;
		this.inlineInput = null ;
		this.document.giveFocusTo( this.editorTextBox ) ;
		promise.resolve( inputStr ) ;
	} ) ;

	return promise ;
} ;



// Return a promise resolving to the file path, or reject if cancelled or various errors
TextEditor.prototype.askFileInline = function( text , options = null ) {
	// Already doing things with files?
	if ( this.inlineInput ) { return Promise.rejected ; }

	var promise = new Promise() ;

	var inlineFileInputOptions = {
		internal: true ,
		parent: this ,
		noEmpty: true ,
		accept: {
			unexistant: true ,
			file: true
		} ,
		cancelable: true ,
		baseDir: './' ,
		menu: { justify: false } ,
		//autoCompleteHint: false ,
		textAttr: { bgColor: 'blue' } ,
		altTextAttr: { bgColor: 'blue' , color: 'gray' , italic: true } ,
		voidAttr: { bgColor: 'blue' } ,
		x: this.outputX ,
		y: this.outputY + this.outputHeight - 2 ,
		z: 1 ,
		width: this.outputWidth ,

		//*
		prompt: {
			//textAttr: { bgColor: 'green' } ,
			textAttr: { bgColor: 'yellow' , color: 'black' } ,
			content: text || 'Select a file' ,
			contentHasMarkup: true
		}
		//*/
	} ;

	if ( options ) { Object.assign( inlineFileInputOptions , options ) ; }

	this.inlineInput = new termkit.InlineFileInput( inlineFileInputOptions ) ;

	this.document.giveFocusTo( this.inlineInput ) ;

	this.inlineInput.once( 'cancel' , () => {
		//console.error( "Cancelling" ) ;
		this.inlineInput.destroy() ;
		this.inlineInput = null ;
		this.document.giveFocusTo( this.editorTextBox ) ;
		promise.reject() ;
	} ) ;

	this.inlineInput.once( 'submit' , filePath => {
		//console.error( "Submitting:" , filePath ) ;
		this.inlineInput.destroy() ;
		this.inlineInput = null ;
		this.document.giveFocusTo( this.editorTextBox ) ;
		promise.resolve( filePath ) ;
	} ) ;

	return promise ;
} ;



// Return a promise resolving to the input string, or reject if cancelled or various errors
TextEditor.prototype.askChoiceInline = function( text , choices , options = null ) {
	// Already doing things with files?
	if ( this.inlineInput ) { return Promise.rejected ; }

	var promise = new Promise() ;

	var inlineMenuOptions = {
		internal: true ,
		parent: this ,
		//cancelable: true ,
		justify: false ,
		x: this.outputX ,
		y: this.outputY + this.outputHeight - 1 ,
		z: 1 ,
		width: this.outputWidth ,
		items: choices.map( choice => ( {
			content: choice[ 0 ] ,
			value: choice[ 1 ] ,
			hotkey: choice.slice( 2 )
		} ) ) ,

		//*
		prompt: {
			textAttr: { bgColor: 'yellow' , color: 'black' } ,
			//textAttr: { bgColor: 'green' } ,
			content: text ,
			contentHasMarkup: true
		}
		//*/
	} ;

	if ( options ) { Object.assign( inlineMenuOptions , options ) ; }

	this.inlineInput = new termkit.InlineMenu( inlineMenuOptions ) ;

	this.document.giveFocusTo( this.inlineInput ) ;

	this.inlineInput.once( 'cancel' , () => {
		//console.error( "Cancelling" ) ;
		this.inlineInput.destroy() ;
		this.inlineInput = null ;
		this.document.giveFocusTo( this.editorTextBox ) ;
		promise.reject() ;
	} ) ;

	this.inlineInput.once( 'submit' , value => {
		//console.error( "Submitting:" , filePath ) ;
		this.inlineInput.destroy() ;
		this.inlineInput = null ;
		this.document.giveFocusTo( this.editorTextBox ) ;
		promise.resolve( value ) ;
	} ) ;

	return promise ;
} ;



/*
TextEditor.prototype.cursorHint = function() {
	var misc ;

	if ( this.textBuffer.cx ) {
		misc = this.textBuffer.getMiscAt( this.textBuffer.cx - 1 , this.textBuffer.cy ) ;
	}

	this.setContextBar( misc && misc.hint , { hint: true } ) ;
} ;

TextEditor.prototype.onTerminal = function( name , data ) {
	if ( name === 'SCREEN_RESIZE' && this.standAlone ) {
		this.resize( data.width , data.height ) ;
	}
} ;
*/



TextEditor.prototype.onFocus = function( focus , type ) {
	if ( focus ) {
		this.document.giveFocusTo( this.editorTextBox ) ;
	}
} ;



TextEditor.prototype.onChange = function( data ) {
	if ( data ) { this.addChangeLog( data ) ; }
	if ( ! data.internal ) { this.updateStatusDebounced() ; }
} ;



TextEditor.prototype.onCursorMove = function() {
	this.updateStatusDebounced() ;
} ;



TextEditor.prototype.onToggleMenu = function( turnOn ) {
	this.toggleMenu( turnOn ) ;
} ;



TextEditor.prototype.onDropDownMenuSubmit = function( buttonValue , action , dropDownMenu , button ) {
	// We are only interested in ToggleButton
	if ( button instanceof ToggleButton ) {
		switch ( buttonValue ) {
			case 'autoIndent' :
				this.setAutoIndent( action ) ;
				break ;
			case 'autoRemoveTrailingSpaces' :
				this.setAutoRemoveTrailingSpaces( action ) ;
				break ;
		}
	}
} ;



TextEditor.prototype.onDropDownMenuBlinked = function( buttonValue , action , dropDownMenu , button ) {
	// ToggleButton does not blink, this is a regular entry
	if ( this.userActions[ buttonValue ] ) {
		process.nextTick( () => this.userActions[ buttonValue ].call( this ) ) ;
	}
	else if ( this.editorTextBox.userActions[ buttonValue ] ) {
		process.nextTick( () => this.editorTextBox.userActions[ buttonValue ].call( this.editorTextBox ) ) ;
	}
} ;



// User Actions

const userActions = TextEditor.prototype.userActions ;

userActions.focusEditorTextBox = function() {
	this.document.giveFocusTo( this.editorTextBox ) ;
} ;

userActions.toggleMenu = function() {
	this.toggleMenu() ;
} ;

userActions.goToLine = function() {
	this.interactiveGoToLine() ;
} ;

userActions.newCursor = function() {
	var cursor = this.cursors[ this.activeCursor ] ,
		textBuffer = this.editorTextBox.textBuffer ;

	// First, save current cursor
	cursor.x = textBuffer.cx ;
	cursor.y = textBuffer.cy ;
	cursor.relScrollX = -this.editorTextBox.scrollX - textBuffer.cx ;
	cursor.relScrollY = -this.editorTextBox.scrollY - textBuffer.cy ;
	cursor.cell = textBuffer.buffer[ textBuffer.cy ]?.[ textBuffer.cx ] ?? null ;

	this.activeCursor = this.cursors.length ;
	this.cursors.push( {} ) ;
	this.updateStatusDebounced() ;
} ;

userActions.nextCursor = function() {
	if ( this.cursors.length <= 1 ) { return ; }

	var cursor = this.cursors[ this.activeCursor ] ,
		textBuffer = this.editorTextBox.textBuffer ;

	// First, save current cursor
	cursor.x = textBuffer.cx ;
	cursor.y = textBuffer.cy ;
	cursor.relScrollX = -this.editorTextBox.scrollX - textBuffer.cx ;
	cursor.relScrollY = -this.editorTextBox.scrollY - textBuffer.cy ;
	cursor.cell = textBuffer.buffer[ textBuffer.cy ]?.[ textBuffer.cx ] ?? null ;

	this.activeCursor = ( this.activeCursor + 1 ) % this.cursors.length ;
	cursor = this.cursors[ this.activeCursor ] ;
	if ( ! cursor.cell || ! textBuffer.updateCursorFromCell( cursor.cell ) ) {
		textBuffer.cx = cursor.x ;
		textBuffer.cy = cursor.y ;
	}
	//this.editorTextBox.autoScrollAndDraw() ;
	this.editorTextBox.scrollTo( -textBuffer.cx - cursor.relScrollX , -textBuffer.cy - cursor.relScrollY ) ;
	this.updateStatusDebounced() ;
} ;

userActions.find = function() {
	this.interactiveFind() ;
} ;

userActions.findAndReplace = function() {
	this.interactiveFindAndReplace() ;
} ;

userActions.regexpFind = function() {
	this.interactiveRegexpFind() ;
} ;

userActions.regexpFindAndReplace = function() {
	this.interactiveRegexpFindAndReplace() ;
} ;

userActions.findNext = function() {
	this.findNext() ;
} ;

userActions.findPrevious = function() {
	this.findPrevious() ;
} ;

userActions.undo = function() {
	this.undo() ;
} ;

userActions.redo = function() {
	this.redo() ;
} ;

userActions.redraw = function() {
	this.redraw() ;
} ;

userActions.save = function() {
	this.save() ;
} ;

userActions.saveAs = function() {
	this.interactiveSave() ;
} ;

userActions.open = function() {
	this.interactiveOpen() ;
} ;

userActions.terminate = function( key , alt , data , element , sourceElement ) {
	if ( this.terminate ) { this.terminate() ; }
} ;

